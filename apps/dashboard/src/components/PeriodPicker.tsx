import Link from "next/link";
import { toDay } from "@passaparola/shared/metrics";
import { PERIOD_PRESETS, type ResolvedPeriod } from "@/lib/period";

export function PeriodPicker({ basePath, period }: { basePath: string; period: ResolvedPeriod }) {
  return (
    <div className="period" aria-label="Period">
      {PERIOD_PRESETS.map((preset) => (
        <Link key={preset.id} href={`${basePath}?period=${preset.id}`} aria-current={period.preset === preset.id ? "true" : undefined}>
          {preset.label}
        </Link>
      ))}
      <form action={basePath} method="get">
        <input type="date" name="from" defaultValue={toDay(period.from)} aria-label="From" required />
        <span aria-hidden="true">→</span>
        <input type="date" name="to" defaultValue={toDay(period.to)} aria-label="To" required />
        <button className="btn btn--small btn--ghost" type="submit">
          Apply
        </button>
      </form>
    </div>
  );
}
