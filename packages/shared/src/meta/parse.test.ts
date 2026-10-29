import { describe, expect, it } from "vitest";
import { parseAccounts, parseDebugToken, parseInsightValues, parseMedia, parseTokenResponse, toReelMetrics } from "./parse";

describe("parseInsightValues", () => {
  it("reads values[0].value and total_value.value", () => {
    const values = parseInsightValues({
      data: [
        { name: "views", period: "lifetime", values: [{ value: 1520 }] },
        { name: "reach", period: "lifetime", total_value: { value: 980 } },
      ],
    });
    expect(values).toEqual({ views: 1520, reach: 980 });
  });

  it("keeps a real 0 as 0", () => {
    expect(parseInsightValues({ data: [{ name: "shares", values: [{ value: 0 }] }] })).toEqual({ shares: 0 });
  });

  it("turns missing or non-numeric values into null", () => {
    const values = parseInsightValues({
      data: [
        { name: "saved", values: [] },
        { name: "likes", values: [{ value: "12" }] },
        { name: "comments", total_value: { value: { breakdown: 3 } } },
      ],
    });
    expect(values).toEqual({ saved: null, likes: null, comments: null });
  });

  it("ignores unknown metric names and empty payloads", () => {
    expect(parseInsightValues({ data: [{ name: "plays", values: [{ value: 4 }] }] })).toEqual({});
    expect(parseInsightValues(null)).toEqual({});
    expect(parseInsightValues({})).toEqual({});
  });
});

describe("toReelMetrics", () => {
  it("maps Meta names to fields and fills unknown metrics with null, not 0", () => {
    const metrics = toReelMetrics({ views: 10, ig_reels_avg_watch_time: 4200, total_interactions: 3 });
    expect(metrics).toEqual({
      views: 10,
      reach: null,
      likes: null,
      comments: null,
      shares: null,
      saved: null,
      totalInteractions: 3,
      avgWatchTimeMs: 4200,
      totalWatchTimeMs: null,
    });
  });
});

describe("parseMedia", () => {
  it("parses a Reel and keeps absent counts as null", () => {
    const media = parseMedia({
      id: "179",
      media_type: "VIDEO",
      media_product_type: "REELS",
      permalink: "https://www.instagram.com/reel/abc/",
      timestamp: "2026-10-01T18:30:00+0000",
      comments_count: 4,
    });
    expect(media.publishedAt?.toISOString()).toBe("2026-10-01T18:30:00.000Z");
    expect(media.likeCount).toBeNull();
    expect(media.commentsCount).toBe(4);
    expect(media.caption).toBeNull();
  });

  it("returns a null date for an invalid timestamp", () => {
    expect(parseMedia({ id: "1", timestamp: "not a date" }).publishedAt).toBeNull();
  });
});

describe("parseAccounts", () => {
  it("keeps only Pages with a linked Instagram account", () => {
    const accounts = parseAccounts([
      { id: "p1", name: "Page without IG" },
      {
        id: "p2",
        name: "Trattoria",
        access_token: "PAGE_TOKEN",
        instagram_business_account: { id: "1784", username: "trattoria", followers_count: 2100 },
      },
    ]);
    expect(accounts).toEqual([
      { pageId: "p2", pageName: "Trattoria", pageAccessToken: "PAGE_TOKEN", igUserId: "1784", username: "trattoria", followersCount: 2100 },
    ]);
  });
});

describe("tokens", () => {
  it("computes the expiry date from expires_in", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    const result = parseTokenResponse({ access_token: "abc", expires_in: 5184000 }, now);
    expect(result.expiresAt?.toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });

  it("leaves the expiry unknown when Meta omits it", () => {
    expect(parseTokenResponse({ access_token: "abc" }).expiresAt).toBeNull();
  });

  it("throws when no token is returned", () => {
    expect(() => parseTokenResponse({})).toThrow();
  });

  it("reads debug_token, with 0 meaning 'never expires'", () => {
    const info = parseDebugToken({
      data: { is_valid: true, type: "USER", expires_at: 0, data_access_expires_at: 1798761600, scopes: ["instagram_basic"] },
    });
    expect(info.isValid).toBe(true);
    expect(info.expiresAt).toBeNull();
    expect(info.dataAccessExpiresAt?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(info.scopes).toEqual(["instagram_basic"]);
  });
});
