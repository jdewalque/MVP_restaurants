// Display helpers. Every formatter shows "n/a" for null, so "not available" never looks like 0.

export const NOT_AVAILABLE = "n/a";

const LOCALE = "en-GB";
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat(LOCALE, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const euro = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR" });
const date = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });
const utcDate = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });

export const formatInt = (value: number | null | undefined) => (value == null ? NOT_AVAILABLE : integer.format(value));
export const formatCompact = (value: number | null | undefined) => (value == null ? NOT_AVAILABLE : compact.format(value));
export const formatPercent = (value: number | null | undefined) => (value == null ? NOT_AVAILABLE : percent.format(value));
export const formatEuroCents = (cents: number | null | undefined) => (cents == null ? NOT_AVAILABLE : euro.format(cents / 100));
export const formatDate = (value: Date | null | undefined) => (value == null ? NOT_AVAILABLE : date.format(value));
/** A calendar day stored in UTC (periods, snapshot days), shown without time-zone shift. */
export const formatUtcDate = (value: Date | null | undefined) => (value == null ? NOT_AVAILABLE : utcDate.format(value));
export const formatDateTime = (value: Date | null | undefined) => (value == null ? NOT_AVAILABLE : dateTime.format(value));

/** Milliseconds as "12.3 s" or "4 min 05 s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return NOT_AVAILABLE;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(Math.round(seconds % 60)).padStart(2, "0")} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}
