export function KpiCard({
  label,
  value,
  hint,
  accent = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "neutral" | "blue" | "orange";
}) {
  const accentClass =
    accent === "blue"
      ? "text-[#3987e5]"
      : accent === "orange"
        ? "text-[#d95926]"
        : "text-slate-100";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${accentClass}`}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
