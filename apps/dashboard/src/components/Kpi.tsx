export function Kpi({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="kpi">
      <p className="kpi__label">{label}</p>
      <p className="kpi__value">{children}</p>
      {note ? <p className="kpi__note">{note}</p> : null}
    </div>
  );
}
