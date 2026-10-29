import { describe, expect, it } from "vitest";
import { buildDailySeries, computeKpis, daysInclusive, proratedCostCents, reelEngagementRate, summarizeByCreator, sumKnown, type ReelWithMetrics } from "./metrics";
import { EMPTY_METRICS, type ReelMetrics } from "./types";

const m = (values: Partial<ReelMetrics>): ReelMetrics => ({ ...EMPTY_METRICS, ...values });

const october = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-30T23:59:59Z") };

const reels: ReelWithMetrics[] = [
  { id: "a", creatorId: "c1", publishedAt: new Date("2026-10-05T12:00:00Z"), latest: m({ views: 10000, reach: 8000, likes: 400, comments: 50, shares: 30, saved: 20 }) },
  { id: "b", creatorId: "c2", publishedAt: new Date("2026-10-12T12:00:00Z"), latest: m({ views: 5000, reach: 2000, likes: 100, comments: 10, shares: null, saved: 5 }) },
  { id: "c", creatorId: "c1", publishedAt: new Date("2026-10-20T12:00:00Z"), latest: null },
  { id: "old", creatorId: "c2", publishedAt: new Date("2026-09-20T12:00:00Z"), latest: m({ views: 99999, reach: 99999 }) },
];

describe("sumKnown", () => {
  it("ignores nulls but returns null when nothing is known", () => {
    expect(sumKnown([1, null, 2])).toBe(3);
    expect(sumKnown([null, undefined])).toBeNull();
    expect(sumKnown([0, null])).toBe(0);
  });
});

describe("reelEngagementRate", () => {
  it("is (likes + comments + shares + saves) / reach", () => {
    expect(reelEngagementRate(m({ likes: 40, comments: 5, shares: 3, saved: 2, reach: 1000 }))).toBeCloseTo(0.05);
  });

  it("is null when a component is unknown or reach is 0", () => {
    expect(reelEngagementRate(m({ likes: 40, comments: 5, shares: null, saved: 2, reach: 1000 }))).toBeNull();
    expect(reelEngagementRate(m({ likes: 0, comments: 0, shares: 0, saved: 0, reach: 0 }))).toBeNull();
    expect(reelEngagementRate(null)).toBeNull();
  });
});

describe("cost", () => {
  it("counts calendar days inclusively", () => {
    expect(daysInclusive(october.from, october.to)).toBe(30);
    expect(daysInclusive(new Date("2026-10-02"), new Date("2026-10-01"))).toBe(0);
  });

  it("prorates the monthly price over subscribed days only", () => {
    const now = new Date("2026-12-31T00:00:00Z");
    expect(proratedCostCents(30000, october, new Date("2026-01-01"), now)).toBe(30000);
    // Subscribed from 16 October: 15 days of 30.
    expect(proratedCostCents(30000, october, new Date("2026-10-16T00:00:00Z"), now)).toBe(15000);
    // Period ends in the future: only days up to now count.
    expect(proratedCostCents(30000, october, new Date("2026-01-01"), new Date("2026-10-10T08:00:00Z"))).toBe(10000);
  });
});

describe("computeKpis", () => {
  const kpis = computeKpis(reels, {
    period: october,
    monthlyPriceCents: 30000,
    subscriptionStartedAt: new Date("2026-01-01"),
    now: new Date("2026-12-01"),
  });

  it("counts only Reels published in the period", () => {
    expect(kpis.reelCount).toBe(3);
    expect(kpis.syncedReelCount).toBe(2);
    expect(kpis.views).toBe(15000);
    expect(kpis.reach).toBe(10000);
  });

  it("computes engagement only on Reels where every part is known", () => {
    expect(kpis.engagementReelCount).toBe(1);
    expect(kpis.engagementRate).toBeCloseTo(500 / 8000);
    expect(kpis.interactions).toBe(500 + 115);
  });

  it("computes the cost per 1,000 views", () => {
    expect(kpis.costCents).toBe(30000);
    expect(kpis.costPerThousandViewsCents).toBe(2000);
  });

  it("reports missing values instead of zeros", () => {
    expect(kpis.missing.views).toBe(1);
    const empty = computeKpis([reels[2]!], { period: october, monthlyPriceCents: 30000, subscriptionStartedAt: new Date("2026-01-01") });
    expect(empty.views).toBeNull();
    expect(empty.engagementRate).toBeNull();
    expect(empty.costPerThousandViewsCents).toBeNull();
  });
});

describe("summarizeByCreator", () => {
  it("groups the period's Reels by creator, most viewed first", () => {
    const summary = summarizeByCreator(reels, october);
    expect(summary.map((s) => [s.creatorId, s.reelCount, s.views])).toEqual([
      ["c1", 2, 10000],
      ["c2", 1, 5000],
    ]);
  });
});

describe("buildDailySeries", () => {
  it("carries cumulative values forward and sums Reels", () => {
    const series = buildDailySeries(
      [
        [
          { ...m({ views: 100, reach: 50 }), day: "2026-10-02" },
          { ...m({ views: 300, reach: 120 }), day: "2026-10-04" },
        ],
        [{ ...m({ views: 40, reach: null }), day: "2026-10-03" }],
      ],
      "2026-10-01",
      "2026-10-04",
    );
    expect(series).toEqual([
      { day: "2026-10-01", views: null, reach: null },
      { day: "2026-10-02", views: 100, reach: 50 },
      { day: "2026-10-03", views: 140, reach: 50 },
      { day: "2026-10-04", views: 340, reach: 120 },
    ]);
  });
});
