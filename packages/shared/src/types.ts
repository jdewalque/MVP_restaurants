// Domain types shared by the landing page, the dashboard and future apps.
// They describe plain data (no Prisma or React types) so they can cross any boundary.

/** Reel metrics we request from the Instagram media insights endpoint. */
export const REEL_METRICS = [
  "views",
  "reach",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
  "ig_reels_avg_watch_time",
  "ig_reels_video_view_total_time",
] as const;

export type ReelMetricName = (typeof REEL_METRICS)[number];

/**
 * Normalised metric values. `null` means "not available" (Meta returned an error,
 * an empty result or a non-numeric value) — never treat it as 0.
 * Watch times are in milliseconds, as returned by Meta.
 */
export interface ReelMetrics {
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saved: number | null;
  totalInteractions: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null;
}

export const METRIC_FIELD_BY_NAME: Record<ReelMetricName, keyof ReelMetrics> = {
  views: "views",
  reach: "reach",
  likes: "likes",
  comments: "comments",
  shares: "shares",
  saved: "saved",
  total_interactions: "totalInteractions",
  ig_reels_avg_watch_time: "avgWatchTimeMs",
  ig_reels_video_view_total_time: "totalWatchTimeMs",
};

export const EMPTY_METRICS: ReelMetrics = {
  views: null,
  reach: null,
  likes: null,
  comments: null,
  shares: null,
  saved: null,
  totalInteractions: null,
  avgWatchTimeMs: null,
  totalWatchTimeMs: null,
};

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  neighborhood: string;
  /** Monthly subscription price in euro cents. */
  monthlyPriceCents: number;
  instagramHandle: string | null;
  subscriptionStartedAt: Date;
}

export interface Creator {
  id: string;
  igUserId: string;
  username: string;
  followersCount: number | null;
}

export interface Reel {
  id: string;
  igMediaId: string;
  creatorId: string;
  restaurantId: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  publishedAt: Date;
}

/** One stored metrics snapshot: the cumulative values Meta reported on `day` (YYYY-MM-DD, UTC). */
export interface MetricSnapshot extends ReelMetrics {
  day: string;
}
