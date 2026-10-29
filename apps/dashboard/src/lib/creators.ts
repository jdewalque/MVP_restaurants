// Connecting creator accounts: shared by the manual token form (mode A) and OAuth (mode B).

import { TOKEN_EXPIRY_WARNING_DAYS } from "@passaparola/shared/config";
import { MetaApiError, redactToken } from "@passaparola/shared/meta";
import { db } from "./db";
import { getMetaClient } from "./meta";
import { encryptToken } from "./tokens";

export type ConnectionMode = "manual" | "oauth";

export interface ConnectedAccount {
  creatorId: string;
  username: string;
  igUserId: string;
  pageName: string | null;
  created: boolean;
}

export interface ConnectResult {
  accounts: ConnectedAccount[];
  tokenExpiresAt: Date | null;
  /** Pages found without a linked Instagram professional account. */
  warnings: string[];
}

/**
 * Takes a short-lived user token (from the Graph API Explorer or the OAuth code exchange),
 * exchanges it for a long-lived one, finds the Instagram accounts linked to the user's
 * Pages and stores each one as a creator.
 */
export async function connectCreatorsFromUserToken(shortToken: string, mode: ConnectionMode): Promise<ConnectResult> {
  const meta = getMetaClient();
  const warnings: string[] = [];

  let longLived = await meta.exchangeForLongLivedToken(shortToken).catch((error: unknown) => {
    // A token that is already long-lived can also be exchanged; if the exchange fails for
    // another reason (e.g. token from another app), keep the original and say so.
    if (error instanceof MetaApiError && error.kind === "token_expired") throw error;
    warnings.push(`Long-lived exchange failed (${error instanceof Error ? error.message : String(error)}); the token was stored as is.`);
    return { accessToken: shortToken, expiresAt: null as Date | null };
  });

  // debug_token gives the exact expiry and the granted scopes.
  const info = await meta.debugToken(longLived.accessToken).catch(() => null);
  if (info) {
    if (!info.isValid) throw new Error("Meta reports this token as invalid.");
    longLived = { ...longLived, expiresAt: info.expiresAt ?? longLived.expiresAt };
  }

  const accounts = await meta.getInstagramAccounts(longLived.accessToken);
  if (accounts.length === 0) {
    throw new Error(
      "No Instagram professional account found. Check that the Instagram account is linked to a Facebook Page and that the token has pages_show_list and instagram_basic.",
    );
  }

  const encrypted = encryptToken(longLived.accessToken);
  const result: ConnectedAccount[] = [];
  for (const account of accounts) {
    const existing = await db.creator.findUnique({ where: { igUserId: account.igUserId } });
    const data = {
      username: account.username ?? account.igUserId,
      followersCount: account.followersCount,
      pageId: account.pageId,
      pageName: account.pageName,
      connectedVia: mode,
      accessTokenEnc: encrypted,
      tokenExpiresAt: longLived.expiresAt,
      dataAccessExpiresAt: info?.dataAccessExpiresAt ?? null,
      tokenScopes: info?.scopes.join(",") ?? null,
      lastSyncError: null,
    };
    const creator = existing
      ? await db.creator.update({ where: { id: existing.id }, data })
      : await db.creator.create({ data: { igUserId: account.igUserId, ...data } });
    result.push({ creatorId: creator.id, username: creator.username, igUserId: creator.igUserId, pageName: account.pageName, created: !existing });
  }

  console.info(`[creators] connected ${result.length} account(s) via ${mode} with token ${redactToken(longLived.accessToken)}`);
  return { accounts: result, tokenExpiresAt: longLived.expiresAt, warnings };
}

export type TokenHealth = "ok" | "expiring" | "expired" | "unknown" | "none";

interface TokenDates {
  accessTokenEnc: string | null;
  tokenExpiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
}

/** The earlier of the token expiry and the data access expiry (after which calls fail too). */
export function effectiveExpiry(creator: TokenDates): Date | null {
  const dates = [creator.tokenExpiresAt, creator.dataAccessExpiresAt].filter((d): d is Date => d !== null);
  return dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
}

export function tokenHealth(creator: TokenDates, now: Date = new Date()): TokenHealth {
  if (!creator.accessTokenEnc) return "none";
  const expiry = effectiveExpiry(creator);
  if (!expiry) return "unknown";
  if (expiry <= now) return "expired";
  const warnAt = new Date(now.getTime() + TOKEN_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
  return expiry <= warnAt ? "expiring" : "ok";
}
