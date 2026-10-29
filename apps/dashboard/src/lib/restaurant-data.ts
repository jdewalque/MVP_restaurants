// Loads everything the restaurant dashboard page needs and computes the indicators.

import {
  buildDailySeries,
  computeKpis,
  isInPeriod,
  reelEngagementRate,
  summarizeByCreator,
  toDay,
  type ReelWithMetrics,
} from "@passaparola/shared/metrics";
import type { MetricSnapshot, ReelMetrics } from "@passaparola/shared/types";
import type { ReelMetricSnapshot } from "@/generated/prisma/client";
import { db } from "./db";
import { resolvePeriod } from "./period";

export function snapshotToMetrics(s: ReelMetricSnapshot): ReelMetrics {
  return {
    views: s.views,
    reach: s.reach,
    likes: s.likes,
    comments: s.comments,
    shares: s.shares,
    saved: s.saved,
    totalInteractions: s.totalInteractions,
    avgWatchTimeMs: s.avgWatchTimeMs,
    totalWatchTimeMs: s.totalWatchTimeMs,
  };
}

export async function loadRestaurantDashboard(slug: string, params: { period?: string; from?: string; to?: string }) {
  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    include: {
      reels: {
        include: { creator: true, snapshots: { orderBy: { day: "asc" } } },
        orderBy: { publishedAt: "desc" },
      },
    },
  });
  if (!restaurant) return null;

  const earliestReel = restaurant.reels.at(-1)?.publishedAt;
  const earliest = earliestReel && earliestReel < restaurant.subscriptionStartedAt ? earliestReel : restaurant.subscriptionStartedAt;
  const period = resolvePeriod(params, { earliest });

  const reels = restaurant.reels.map((reel) => {
    const last = reel.snapshots.at(-1) ?? null;
    return { ...reel, latest: last ? snapshotToMetrics(last) : null, latestDay: last?.day ?? null };
  });
  const forKpis: ReelWithMetrics[] = reels.map((r) => ({ id: r.id, creatorId: r.creatorId, publishedAt: r.publishedAt, latest: r.latest }));
  const inPeriod = reels.filter((r) => isInPeriod(r.publishedAt, period));

  const kpis = computeKpis(forKpis, {
    period,
    monthlyPriceCents: restaurant.monthlyPriceCents,
    subscriptionStartedAt: restaurant.subscriptionStartedAt,
  });

  const creatorsById = new Map(reels.map((r) => [r.creatorId, r.creator]));
  const byCreator = summarizeByCreator(forKpis, period).map((summary) => ({ ...summary, creator: creatorsById.get(summary.creatorId)! }));

  // Chart: from the first snapshot of the period's Reels (or the period start) to the period end.
  const snapshotsByReel: MetricSnapshot[][] = inPeriod.map((r) => r.snapshots.map((s) => ({ ...snapshotToMetrics(s), day: s.day })));
  const firstSnapshotDay = snapshotsByReel.flat().reduce<string | null>((min, s) => (min === null || s.day < min ? s.day : min), null);
  const periodStart = toDay(period.from);
  const periodEnd = toDay(period.to < new Date() ? period.to : new Date());
  const chartStart = firstSnapshotDay && firstSnapshotDay > periodStart ? firstSnapshotDay : periodStart;
  const series = firstSnapshotDay ? buildDailySeries(snapshotsByReel, chartStart, periodEnd) : [];

  return {
    restaurant,
    period,
    kpis,
    reels: inPeriod.map((r) => ({ ...r, engagementRate: reelEngagementRate(r.latest) })),
    byCreator,
    series,
  };
}

export type RestaurantDashboard = NonNullable<Awaited<ReturnType<typeof loadRestaurantDashboard>>>;
