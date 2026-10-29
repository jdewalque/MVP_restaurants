// Dashboard indicators. Pure functions: no database, no Meta calls.
//
// Period rule: a period counts the Reels *published* during it, with their latest
// known (cumulative) values. The subscription price is prorated over the days of the
// period during which the restaurant was subscribed (price × days / 30).

import { DAYS_PER_BILLING_MONTH } from "./config";
import type { MetricSnapshot, ReelMetrics } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Period {
  /** Inclusive start (UTC midnight). */
  from: Date;
  /** Inclusive end (any time on the last day). */
  to: Date;
}

export interface ReelWithMetrics {
  id: string;
  creatorId: string;
  publishedAt: Date;
  /** Latest snapshot values, or null when the Reel was never synced. */
  latest: ReelMetrics | null;
}

/** Sum of the non-null values; null when every value is null (nothing known). */
export function sumKnown(values: Array<number | null | undefined>): number | null {
  let total: number | null = null;
  for (const value of values) {
    if (typeof value === "number") total = (total ?? 0) + value;
  }
  return total;
}

/** (likes + comments + shares + saves) / reach for one Reel, null if any part is unknown or reach is 0. */
export function reelEngagementRate(metrics: ReelMetrics | null): number | null {
  if (!metrics) return null;
  const { likes, comments, shares, saved, reach } = metrics;
  if (likes === null || comments === null || shares === null || saved === null || !reach) return null;
  return (likes + comments + shares + saved) / reach;
}

/** Number of calendar days (UTC) covered by [from, to], inclusive. */
export function daysInclusive(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return end < start ? 0 : Math.round((end - start) / DAY_MS) + 1;
}

/** Subscription cost for the part of the period during which the restaurant was subscribed. */
export function proratedCostCents(monthlyPriceCents: number, period: Period, subscriptionStartedAt: Date, now: Date = new Date()): number {
  const from = period.from > subscriptionStartedAt ? period.from : subscriptionStartedAt;
  const to = period.to < now ? period.to : now;
  return (monthlyPriceCents * daysInclusive(from, to)) / DAYS_PER_BILLING_MONTH;
}

export interface Kpis {
  reelCount: number;
  /** Reels with at least one snapshot. */
  syncedReelCount: number;
  views: number | null;
  reach: number | null;
  /** likes + comments + shares + saves (our definition, used for the engagement rate). */
  interactions: number | null;
  /** Meta's own `total_interactions` metric, summed. */
  metaTotalInteractions: number | null;
  /** Interactions / reach over the Reels where all five values are known. */
  engagementRate: number | null;
  /** Number of Reels used for the engagement rate. */
  engagementReelCount: number;
  costCents: number;
  /** Cost (euro cents) per 1,000 views. */
  costPerThousandViewsCents: number | null;
  /** Count of Reels where each headline metric is unknown, to show "n/a for X Reels". */
  missing: { views: number; reach: number };
}

export function isInPeriod(date: Date, period: Period): boolean {
  return date >= period.from && date <= period.to;
}

export function computeKpis(
  reels: ReelWithMetrics[],
  options: { period: Period; monthlyPriceCents: number; subscriptionStartedAt: Date; now?: Date },
): Kpis {
  const inPeriod = reels.filter((reel) => isInPeriod(reel.publishedAt, options.period));
  const latest = inPeriod.map((reel) => reel.latest);

  let engagementNumerator = 0;
  let engagementReach = 0;
  let engagementReelCount = 0;
  for (const metrics of latest) {
    if (reelEngagementRate(metrics) === null || !metrics) continue;
    engagementNumerator += metrics.likes! + metrics.comments! + metrics.shares! + metrics.saved!;
    engagementReach += metrics.reach!;
    engagementReelCount += 1;
  }

  const views = sumKnown(latest.map((m) => m?.views));
  const costCents = proratedCostCents(options.monthlyPriceCents, options.period, options.subscriptionStartedAt, options.now);

  return {
    reelCount: inPeriod.length,
    syncedReelCount: latest.filter(Boolean).length,
    views,
    reach: sumKnown(latest.map((m) => m?.reach)),
    interactions: sumKnown(latest.map((m) => (m ? sumKnown([m.likes, m.comments, m.shares, m.saved]) : null))),
    metaTotalInteractions: sumKnown(latest.map((m) => m?.totalInteractions)),
    engagementRate: engagementReelCount > 0 ? engagementNumerator / engagementReach : null,
    engagementReelCount,
    costCents,
    costPerThousandViewsCents: views ? (costCents / views) * 1000 : null,
    missing: {
      views: latest.filter((m) => m?.views == null).length,
      reach: latest.filter((m) => m?.reach == null).length,
    },
  };
}

export interface CreatorSummary {
  creatorId: string;
  reelCount: number;
  views: number | null;
  reach: number | null;
  interactions: number | null;
  engagementRate: number | null;
}

export function summarizeByCreator(reels: ReelWithMetrics[], period: Period): CreatorSummary[] {
  const groups = new Map<string, ReelWithMetrics[]>();
  for (const reel of reels) {
    if (!isInPeriod(reel.publishedAt, period)) continue;
    groups.set(reel.creatorId, [...(groups.get(reel.creatorId) ?? []), reel]);
  }
  return [...groups.entries()]
    .map(([creatorId, group]) => {
      const kpis = computeKpis(group, { period, monthlyPriceCents: 0, subscriptionStartedAt: period.from });
      return {
        creatorId,
        reelCount: kpis.reelCount,
        views: kpis.views,
        reach: kpis.reach,
        interactions: kpis.interactions,
        engagementRate: kpis.engagementRate,
      };
    })
    .sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
}

export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface DailyPoint {
  day: string;
  views: number | null;
  reach: number | null;
}

/**
 * Day-by-day cumulative views and reach of a set of Reels. For each day, each Reel
 * contributes its most recent snapshot taken on or before that day (values are
 * cumulative, so they carry forward). Days before any snapshot have null values.
 */
export function buildDailySeries(snapshotsByReel: MetricSnapshot[][], fromDay: string, toDay_: string): DailyPoint[] {
  const sorted = snapshotsByReel.map((snapshots) => [...snapshots].sort((a, b) => a.day.localeCompare(b.day)));
  const points: DailyPoint[] = [];
  for (let day = fromDay; day <= toDay_; day = nextDay(day)) {
    const viewsValues: Array<number | null> = [];
    const reachValues: Array<number | null> = [];
    for (const snapshots of sorted) {
      viewsValues.push(lastKnown(snapshots, day, "views"));
      reachValues.push(lastKnown(snapshots, day, "reach"));
    }
    points.push({ day, views: sumKnown(viewsValues), reach: sumKnown(reachValues) });
  }
  return points;
}

function lastKnown(snapshots: MetricSnapshot[], day: string, key: "views" | "reach"): number | null {
  let value: number | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.day > day) break;
    if (snapshot[key] !== null) value = snapshot[key];
  }
  return value;
}

function nextDay(day: string): string {
  return toDay(new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS));
}
