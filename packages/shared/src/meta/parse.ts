// Parsing of raw Graph API payloads into typed values. Pure functions, unit-tested.

import { EMPTY_METRICS, METRIC_FIELD_BY_NAME, REEL_METRICS, type ReelMetricName, type ReelMetrics } from "../types";

export interface RawInsightItem {
  name?: string;
  period?: string;
  values?: Array<{ value?: unknown; end_time?: string }>;
  total_value?: { value?: unknown };
  title?: string;
  description?: string;
  id?: string;
}

export interface RawInsightsResponse {
  data?: RawInsightItem[];
}

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Reads metric values from an insights response. Handles both shapes Meta uses
 * (`values[0].value` and `total_value.value`). A metric that is missing or not a
 * plain number is reported as null.
 */
export function parseInsightValues(body: RawInsightsResponse | null | undefined): Partial<Record<ReelMetricName, number | null>> {
  const out: Partial<Record<ReelMetricName, number | null>> = {};
  for (const item of body?.data ?? []) {
    if (!item?.name || !(REEL_METRICS as readonly string[]).includes(item.name)) continue;
    const raw = item.total_value?.value !== undefined ? item.total_value.value : item.values?.[0]?.value;
    out[item.name as ReelMetricName] = asCount(raw);
  }
  return out;
}

/** Builds a full ReelMetrics object; every metric not in `values` is null. */
export function toReelMetrics(values: Partial<Record<ReelMetricName, number | null>>): ReelMetrics {
  const metrics: ReelMetrics = { ...EMPTY_METRICS };
  for (const name of REEL_METRICS) {
    const value = values[name];
    metrics[METRIC_FIELD_BY_NAME[name]] = value ?? null;
  }
  return metrics;
}

export interface RawMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramMedia {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaProductType: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  likeCount: number | null;
  commentsCount: number | null;
}

export function parseMedia(raw: RawMedia): InstagramMedia {
  const publishedAt = raw.timestamp ? new Date(raw.timestamp) : null;
  return {
    id: raw.id,
    caption: raw.caption ?? null,
    mediaType: raw.media_type ?? null,
    mediaProductType: raw.media_product_type ?? null,
    permalink: raw.permalink ?? null,
    thumbnailUrl: raw.thumbnail_url ?? null,
    publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    likeCount: asCount(raw.like_count),
    commentsCount: asCount(raw.comments_count),
  };
}

export function isReel(media: Pick<InstagramMedia, "mediaProductType">): boolean {
  return media.mediaProductType === "REELS";
}

export interface RawPage {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string; followers_count?: number };
}

export interface InstagramAccount {
  pageId: string;
  pageName: string | null;
  /** Page access token, kept server-side only. */
  pageAccessToken: string | null;
  igUserId: string;
  username: string | null;
  followersCount: number | null;
}

/** Keeps only the Pages that have a linked Instagram professional account. */
export function parseAccounts(pages: RawPage[]): InstagramAccount[] {
  return pages
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name ?? null,
      pageAccessToken: page.access_token ?? null,
      igUserId: page.instagram_business_account!.id,
      username: page.instagram_business_account!.username ?? null,
      followersCount: asCount(page.instagram_business_account!.followers_count),
    }));
}

export interface RawTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface TokenResult {
  accessToken: string;
  /** null when Meta does not say (long-lived tokens may omit expires_in). */
  expiresAt: Date | null;
}

export function parseTokenResponse(body: RawTokenResponse, now: Date = new Date()): TokenResult {
  if (!body.access_token) throw new Error("Meta did not return an access_token");
  return {
    accessToken: body.access_token,
    expiresAt: typeof body.expires_in === "number" && body.expires_in > 0 ? new Date(now.getTime() + body.expires_in * 1000) : null,
  };
}

export interface RawDebugToken {
  data?: {
    app_id?: string;
    type?: string;
    is_valid?: boolean;
    expires_at?: number;
    data_access_expires_at?: number;
    scopes?: string[];
    user_id?: string;
  };
}

export interface TokenInfo {
  isValid: boolean;
  type: string | null;
  /** null = never expires (Meta returns 0). */
  expiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
  scopes: string[];
  userId: string | null;
}

export function parseDebugToken(body: RawDebugToken): TokenInfo {
  const data = body.data ?? {};
  const toDate = (seconds: number | undefined) => (seconds && seconds > 0 ? new Date(seconds * 1000) : null);
  return {
    isValid: data.is_valid === true,
    type: data.type ?? null,
    expiresAt: toDate(data.expires_at),
    dataAccessExpiresAt: toDate(data.data_access_expires_at),
    scopes: data.scopes ?? [],
    userId: data.user_id ?? null,
  };
}
