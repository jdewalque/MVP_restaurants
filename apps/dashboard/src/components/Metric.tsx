import { NOT_AVAILABLE } from "@passaparola/shared/format";

/** Renders a formatted metric, or a clearly marked "n/a" when Meta did not provide it. */
export function Metric({ value, format }: { value: number | null | undefined; format: (v: number) => string }) {
  if (value == null) {
    return (
      <span className="na" title="Not available: Meta did not return this metric">
        {NOT_AVAILABLE}
      </span>
    );
  }
  return <>{format(value)}</>;
}
