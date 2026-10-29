import { describe, expect, it, vi } from "vitest";
import { createMetaClient } from "./client";
import { MetaApiError } from "./errors";
import { parseUsageHeaders, type MetaLogger } from "./http";
import { redactDeep, redactToken, redactUrl } from "./redact";

const TOKEN = "EAAGtesttoken1234567890abcdefXYZ9";

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function graphError(code: number, message: string, status = 400): Response {
  return json({ error: { message, type: "OAuthException", code, fbtrace_id: "trace" } }, status);
}

function setup(handler: (url: URL) => Response) {
  const calls: URL[] = [];
  const logs: Array<{ level: string; message: string; data?: Record<string, unknown> }> = [];
  const logger: MetaLogger = {
    info: (message, data) => logs.push({ level: "info", message, data }),
    warn: (message, data) => logs.push({ level: "warn", message, data }),
  };
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input);
    calls.push(url);
    return handler(url);
  });
  const client = createMetaClient({ appId: "123", appSecret: "shh-secret", graphVersion: "v26.0", fetch: fetchMock, logger });
  return { client, calls, logs };
}

describe("listMedia", () => {
  it("follows pagination and keeps only Reels", async () => {
    const { client, calls } = setup((url) => {
      if (url.searchParams.get("after") === "CURSOR") {
        return json({ data: [{ id: "3", media_product_type: "REELS", timestamp: "2026-10-03T10:00:00+0000" }] });
      }
      return json({
        data: [
          { id: "1", media_product_type: "REELS", timestamp: "2026-10-01T10:00:00+0000" },
          { id: "2", media_product_type: "FEED", timestamp: "2026-10-02T10:00:00+0000" },
        ],
        paging: { next: `https://graph.facebook.com/v26.0/1784/media?access_token=${TOKEN}&after=CURSOR` },
      });
    });

    const reels = await client.listMedia("1784", TOKEN);
    expect(reels.map((r) => r.id)).toEqual(["1", "3"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.pathname).toBe("/v26.0/1784/media");
    expect(calls[0]!.searchParams.get("fields")).toContain("media_product_type");
  });
});

describe("getReelInsights", () => {
  it("uses one grouped call when Meta accepts every metric", async () => {
    const { client, calls } = setup(() =>
      json({ data: [{ name: "views", values: [{ value: 100 }] }, { name: "reach", values: [{ value: 80 }] }] }),
    );
    const result = await client.getReelInsights("m1", TOKEN);
    expect(calls).toHaveLength(1);
    expect(result.mode).toBe("grouped");
    expect(result.metrics.views).toBe(100);
    expect(result.metrics.shares).toBeNull();
    expect(result.perMetric.shares.error).toBe("not returned by Meta");
  });

  it("retries metric by metric when the grouped call fails, storing null for unsupported metrics", async () => {
    const { client, calls } = setup((url) => {
      const metric = url.searchParams.get("metric")!;
      if (metric.includes(",")) return graphError(100, "(#100) metric[7] must be one of the following values: ...");
      if (metric === "ig_reels_avg_watch_time") return graphError(100, "(#100) Unsupported metric");
      if (metric === "saved") return json({ data: [] });
      return json({ data: [{ name: metric, values: [{ value: 7 }] }] });
    });

    const result = await client.getReelInsights("m1", TOKEN);
    expect(result.mode).toBe("per-metric");
    expect(calls).toHaveLength(1 + 9);
    expect(result.metrics.views).toBe(7);
    expect(result.metrics.avgWatchTimeMs).toBeNull();
    expect(result.perMetric.ig_reels_avg_watch_time.error).toContain("Unsupported metric");
    expect(result.metrics.saved).toBeNull();
    expect(result.groupedError?.kind).toBe("invalid_request");
  });

  it("returns all-null metrics without retrying when the media has no insights", async () => {
    const { client, calls } = setup(() => graphError(10, "(#10) Not enough viewers for the media to show insights", 400));
    const result = await client.getReelInsights("m1", TOKEN);
    expect(calls).toHaveLength(1);
    expect(result.mode).toBe("unavailable");
    expect(Object.values(result.metrics).every((v) => v === null)).toBe(true);
  });

  it("throws on an expired token instead of retrying", async () => {
    const { client, calls } = setup(() => graphError(190, "Error validating access token: Session has expired", 400));
    await expect(client.getReelInsights("m1", TOKEN)).rejects.toMatchObject({ kind: "token_expired" });
    expect(calls).toHaveLength(1);
  });
});

describe("errors and logging", () => {
  it("classifies rate limits and missing permissions", async () => {
    const rate = setup(() => graphError(4, "Application request limit reached"));
    await expect(rate.client.getInstagramAccounts(TOKEN)).rejects.toMatchObject({ kind: "rate_limited" });

    const perm = setup(() => graphError(200, "Requires pages_read_engagement permission", 403));
    const error = await perm.client.getInstagramAccounts(TOKEN).catch((e) => e);
    expect(error).toBeInstanceOf(MetaApiError);
    expect(error.kind).toBe("permission_denied");
  });

  it("reports network failures", async () => {
    const { client } = setup(() => {
      throw new Error("ECONNRESET");
    });
    await expect(client.getInstagramUser("1", TOKEN)).rejects.toMatchObject({ kind: "network" });
  });

  it("logs usage headers and never logs the full token or secret", async () => {
    const { client, logs } = setup(() =>
      json({ access_token: "LONG_LIVED_TOKEN_0123456789", expires_in: 5184000 }, 200, {
        "x-app-usage": JSON.stringify({ call_count: 80, total_time: 5, total_cputime: 4 }),
      }),
    );
    const result = await client.exchangeForLongLivedToken(TOKEN);
    expect(result.accessToken).toBe("LONG_LIVED_TOKEN_0123456789");

    const logged = JSON.stringify(logs);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("shh-secret");
    expect(logs[0]!.level).toBe("warn");
    expect(logs[0]!.data?.appUsage).toEqual({ call_count: 80, total_time: 5, total_cputime: 4 });
  });

  it("parses the business use case usage header", () => {
    const usage = parseUsageHeaders(
      new Headers({
        "x-business-use-case-usage": JSON.stringify({ "1784": [{ type: "instagram", call_count: 12, total_cputime: 30, total_time: 2 }] }),
      }),
    );
    expect(usage.maxPercent).toBe(30);
    expect(usage.appUsage).toBeNull();
  });
});

describe("redaction", () => {
  it("shortens tokens", () => {
    expect(redactToken(TOKEN)).toBe(`EAAGte…XYZ9 (${TOKEN.length} chars)`);
    expect(redactToken(null)).toBe("(none)");
  });

  it("redacts URLs and nested payloads", () => {
    expect(redactUrl(`https://x/y?fields=id&access_token=${TOKEN}`)).not.toContain(TOKEN);
    const redacted = redactDeep({ data: [{ access_token: TOKEN, name: "Page" }], paging: { next: `https://x?access_token=${TOKEN}` } });
    expect(JSON.stringify(redacted)).not.toContain(TOKEN);
    expect(redacted.data[0]!.name).toBe("Page");
  });
});
