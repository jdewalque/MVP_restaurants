import { describe, expect, it } from "vitest";
import { resolvePeriod } from "./period";

const now = new Date("2026-10-29T15:00:00Z");
const earliest = new Date("2026-08-15T10:00:00Z");
const iso = (d: Date) => d.toISOString();

describe("resolvePeriod", () => {
  it("defaults to the last 30 days, today included", () => {
    const p = resolvePeriod({}, { earliest, now });
    expect(p.preset).toBe("30d");
    expect(iso(p.from)).toBe("2026-09-30T00:00:00.000Z");
    expect(iso(p.to)).toBe("2026-10-29T23:59:59.999Z");
  });

  it("handles calendar months and all time", () => {
    expect(iso(resolvePeriod({ period: "month" }, { earliest, now }).from)).toBe("2026-10-01T00:00:00.000Z");
    const prev = resolvePeriod({ period: "prev-month" }, { earliest, now });
    expect([iso(prev.from), iso(prev.to)]).toEqual(["2026-09-01T00:00:00.000Z", "2026-09-30T23:59:59.999Z"]);
    expect(iso(resolvePeriod({ period: "all" }, { earliest, now }).from)).toBe("2026-08-15T00:00:00.000Z");
  });

  it("accepts a custom range and ignores an invalid one", () => {
    const custom = resolvePeriod({ from: "2026-10-01", to: "2026-10-15" }, { earliest, now });
    expect(custom.preset).toBe("custom");
    expect(iso(custom.to)).toBe("2026-10-15T23:59:59.999Z");
    expect(resolvePeriod({ from: "2026-10-15", to: "2026-10-01" }, { earliest, now }).preset).toBe("30d");
    expect(resolvePeriod({ from: "yesterday", to: "2026-10-01" }, { earliest, now }).preset).toBe("30d");
  });
});
