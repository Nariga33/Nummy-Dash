export const DEFAULT_STAGE_COLORS = [
  "#94a3b8",
  "#38bdf8",
  "#a78bfa",
  "#f5b400",
  "#fb923c",
  "#34d399",
  "#f87171",
  "#f472b6",
  "#22d3ee",
];

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
