"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DailyPoint } from "@passaparola/shared/metrics";

const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-GB");
const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Cumulative views and reach per day, built from the daily snapshots. */
export function ViewsChart({ data }: { data: DailyPoint[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#f3e5cd" vertical={false} />
          <XAxis dataKey="day" tickFormatter={shortDay} tick={{ fontSize: 12, fill: "#5c4a3f" }} minTickGap={24} />
          <YAxis tickFormatter={(v: number) => compact.format(v)} tick={{ fontSize: 12, fill: "#5c4a3f" }} width={48} />
          <Tooltip
            labelFormatter={(label) => shortDay(String(label))}
            formatter={(value, name) => [value == null ? "n/a" : integer.format(Number(value)), name]}
            contentStyle={{ borderRadius: 12, borderColor: "#f3e5cd" }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line type="monotone" dataKey="views" name="Views" stroke="#b04e2e" strokeWidth={2.5} dot={false} connectNulls={false} animationDuration={500} />
          <Line type="monotone" dataKey="reach" name="Reach" stroke="#5f6b34" strokeWidth={2} dot={false} connectNulls={false} animationDuration={500} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
