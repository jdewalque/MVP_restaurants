// Typed Meta Graph API client for "Instagram API with Facebook Login".
// Server-side only: it handles user tokens and the app secret.
//
// Everything specific to the login flow lives in `login.ts`; switching to Facebook
// Login for Business / unified login later means changing that file, not this one.

import { REEL_METRICS, type ReelMetricName, type ReelMetrics } from "../types";
import { isFatalForAccount, MetaApiError } from "./errors";
import { consoleLogger, graphGet, type FetchLike, type GraphResponse, type MetaLogger } from "./http";
import {
  isReel,
  parseAccounts,
  parseDebugToken,
  parseInsightValues,
  parseMedia,
  parseTokenResponse,
  toReelMetrics,
  type InstagramAccount,
  type InstagramMedia,
  type RawDebugToken,
  type RawInsightsResponse,
  type RawMedia,
  type RawPage,
  type RawTokenResponse,
  type TokenInfo,
  type TokenResult,
} from "./parse";

export const ACCOUNT_FIELDS = "name,access_token,instagram_business_account{id,username,followers_count}";
export const MEDIA_FIELDS =
  "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp,like_count,comments_count";

export interface MetaClientOptions {
  appId: string;
  appSecret: string;
  graphVersion: string;
  /** Defaults to https://graph.facebook.com. */
  baseUrl?: string;
  fetch?: FetchLike;
  logger?: MetaLogger;
  onResponse?: (response: GraphResponse) => void;
  /** Safety cap when following `paging.next` links. */
  maxPages?: number;
}

export type MetricStatus = { value: number | null; error: string | null };

export interface ReelInsightsResult {
  metrics: ReelMetrics;
  /** How the values were obtained: one grouped call, or one call per metric after the grouped call failed. */
  mode: "grouped" | "per-metric" | "unavailable";
  /** Per-metric outcome, including the error message when a metric could not be read. */
  perMetric: Record<ReelMetricName, MetricStatus>;
  /** Raw response bodies (tokens redacted by the caller before display). */
  raw: unknown[];
  /** Error of the grouped call, when it failed. */
  groupedError: MetaApiError | null;
}

interface Paged<T> {
  data?: T[];
  paging?: { next?: string };
}

/** Insights errors that mean "no data for this media" rather than "this metric is wrong". */
function isMediaWithoutInsights(error: MetaApiError): boolean {
  return /not enough viewers|posted before .* (business|professional)|does not have insights/i.test(error.message);
}

export function createMetaClient(options: MetaClientOptions) {
  const http = {
    graphVersion: options.graphVersion,
    baseUrl: options.baseUrl,
    fetch: options.fetch ?? ((url: string, init?: RequestInit) => fetch(url, init)),
    logger: options.logger ?? consoleLogger,
    onResponse: options.onResponse,
  };
  const maxPages = options.maxPages ?? 20;
  const appToken = `${options.appId}|${options.appSecret}`;

  async function getOrThrow<T>(path: string, params: Record<string, string | undefined>, token: string | null): Promise<T> {
    const response = await graphGet<T>(http, path, params, token);
    if (response.error) throw response.error;
    return response.body as T;
  }

  async function getAllPages<T>(path: string, params: Record<string, string>, token: string): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined;
    let page = 0;
    do {
      const body: Paged<T> = await getOrThrow<Paged<T>>(next ?? path, next ? {} : params, token);
      items.push(...(body.data ?? []));
      next = body.paging?.next;
      page += 1;
    } while (next && page < maxPages);
    if (next) http.logger.warn(`Stopped paginating ${path} after ${maxPages} pages`);
    return items;
  }

  return {
    graphVersion: options.graphVersion,

    /** Facebook Pages of the user, with their linked Instagram professional account (if any). */
    async getInstagramAccounts(userToken: string): Promise<InstagramAccount[]> {
      const pages = await getAllPages<RawPage>("me/accounts", { fields: ACCOUNT_FIELDS, limit: "100" }, userToken);
      return parseAccounts(pages);
    },

    /** Current username and follower count of an Instagram professional account. */
    async getInstagramUser(igUserId: string, token: string): Promise<{ id: string; username: string | null; followersCount: number | null }> {
      const body = await getOrThrow<{ id: string; username?: string; followers_count?: number }>(
        igUserId,
        { fields: "id,username,followers_count" },
        token,
      );
      return {
        id: body.id,
        username: body.username ?? null,
        followersCount: typeof body.followers_count === "number" ? body.followers_count : null,
      };
    },

    /** All media of the account (all pages), filtered to Reels. */
    async listMedia(igUserId: string, token: string): Promise<InstagramMedia[]> {
      const media = await getAllPages<RawMedia>(`${igUserId}/media`, { fields: MEDIA_FIELDS, limit: "50" }, token);
      return media.map(parseMedia).filter(isReel);
    },

    /**
     * Reel insights. Asks for every metric in one call; if Meta rejects the call
     * (typically because one metric is not supported), asks metric by metric.
     * Metrics that cannot be read are null, never 0.
     */
    async getReelInsights(mediaId: string, token: string, metrics: readonly ReelMetricName[] = REEL_METRICS): Promise<ReelInsightsResult> {
      const perMetric = Object.fromEntries(
        REEL_METRICS.map((name) => [name, { value: null, error: metrics.includes(name) ? null : "not requested" }]),
      ) as Record<ReelMetricName, MetricStatus>;

      const grouped = await graphGet<RawInsightsResponse>(http, `${mediaId}/insights`, { metric: metrics.join(",") }, token);
      if (!grouped.error) {
        const values = parseInsightValues(grouped.body);
        for (const name of metrics) {
          perMetric[name] = name in values ? { value: values[name] ?? null, error: null } : { value: null, error: "not returned by Meta" };
        }
        return { metrics: toReelMetrics(values), mode: "grouped", perMetric, raw: [grouped.body], groupedError: null };
      }

      const groupedError = grouped.error;
      if (isMediaWithoutInsights(groupedError)) {
        for (const name of metrics) perMetric[name] = { value: null, error: groupedError.message };
        return { metrics: toReelMetrics({}), mode: "unavailable", perMetric, raw: [grouped.body], groupedError };
      }
      if (isFatalForAccount(groupedError) || groupedError.kind === "network") throw groupedError;

      const raw: unknown[] = [grouped.body];
      const values: Partial<Record<ReelMetricName, number | null>> = {};
      for (const name of metrics) {
        const single = await graphGet<RawInsightsResponse>(http, `${mediaId}/insights`, { metric: name }, token);
        raw.push(single.body);
        if (single.error) {
          if (isFatalForAccount(single.error)) throw single.error;
          perMetric[name] = { value: null, error: single.error.message };
          continue;
        }
        const value = parseInsightValues(single.body)[name] ?? null;
        values[name] = value;
        perMetric[name] = { value, error: value === null ? "not returned by Meta" : null };
      }
      return { metrics: toReelMetrics(values), mode: "per-metric", perMetric, raw, groupedError };
    },

    /** Exchanges a short-lived user token (≈1 h) for a long-lived one (≈60 days). */
    async exchangeForLongLivedToken(shortToken: string): Promise<TokenResult> {
      const body = await getOrThrow<RawTokenResponse>(
        "oauth/access_token",
        {
          grant_type: "fb_exchange_token",
          client_id: options.appId,
          client_secret: options.appSecret,
          fb_exchange_token: shortToken,
        },
        null,
      );
      return parseTokenResponse(body);
    },

    /** Exchanges the OAuth `code` from the login redirect for a short-lived user token. */
    async exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenResult> {
      const body = await getOrThrow<RawTokenResponse>(
        "oauth/access_token",
        { client_id: options.appId, client_secret: options.appSecret, redirect_uri: redirectUri, code },
        null,
      );
      return parseTokenResponse(body);
    },

    /** Validity, expiry and granted scopes of a token (uses the app token). */
    async debugToken(token: string): Promise<TokenInfo> {
      const body = await getOrThrow<RawDebugToken>("debug_token", { input_token: token }, appToken);
      return parseDebugToken(body);
    },

    /** Raw GET for the debug page: returns status, body, usage headers and error without throwing. */
    raw<T = unknown>(path: string, params: Record<string, string | undefined>, token: string | null): Promise<GraphResponse<T>> {
      return graphGet<T>(http, path, params, token);
    },

    /** Raw debug_token call (needs the app token, which must stay on the server). */
    rawDebugToken(token: string): Promise<GraphResponse<RawDebugToken>> {
      return graphGet<RawDebugToken>(http, "debug_token", { input_token: token }, appToken);
    },
  };
}

export type MetaClient = ReturnType<typeof createMetaClient>;
