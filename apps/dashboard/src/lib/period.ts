// Period selection for the restaurant dashboard (?period=30d|90d|month|prev-month|all or ?from=&to=).

import type { Period } from "@passaparola/shared/metrics";

export const PERIOD_PRESETS = [
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "month", label: "This month" },
  { id: "prev-month", label: "Last month" },
  { id: "all", label: "All time" },
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number]["id"] | "custom";

export interface ResolvedPeriod extends Period {
  preset: PeriodPreset;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfUtcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const endOfUtcDay = (d: Date) => new Date(startOfUtcDay(d).getTime() + DAY_MS - 1);

function parseDay(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolvePeriod(
  params: { period?: string; from?: string; to?: string },
  options: { earliest: Date; now?: Date },
): ResolvedPeriod {
  const now = options.now ?? new Date();
  const today = endOfUtcDay(now);

  const from = parseDay(params.from);
  const to = parseDay(params.to);
  if (from && to && from <= to) {
    return { preset: "custom", label: `${params.from} → ${params.to}`, from, to: endOfUtcDay(to) };
  }

  const preset = PERIOD_PRESETS.find((p) => p.id === params.period)?.id ?? "30d";
  const label = PERIOD_PRESETS.find((p) => p.id === preset)!.label;
  switch (preset) {
    case "90d":
      return { preset, label, from: startOfUtcDay(new Date(today.getTime() - 89 * DAY_MS)), to: today };
    case "month":
      return { preset, label, from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: today };
    case "prev-month":
      return {
        preset,
        label,
        from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
        to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1),
      };
    case "all":
      return { preset, label, from: startOfUtcDay(options.earliest), to: today };
    default:
      return { preset: "30d", label, from: startOfUtcDay(new Date(today.getTime() - 29 * DAY_MS)), to: today };
  }
}
