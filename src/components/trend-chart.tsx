"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { DayPoint } from "@/lib/metrics";

const COLOR_CALLS = "#3987e5";
const COLOR_WHATSAPP = "#d95926";

function formatDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-slate-300">{label ? formatDay(label) : ""}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-slate-100">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: DayPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#2c2c2a" strokeDasharray="0" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            stroke="#898781"
            tick={{ fill: "#898781", fontSize: 12 }}
            axisLine={{ stroke: "#383835" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            stroke="#898781"
            tick={{ fill: "#898781", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#383835", strokeWidth: 1 }} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: "#c3c2b7", paddingTop: 12 }}
          />
          <Line
            type="monotone"
            dataKey="calls"
            name="Ligações"
            stroke={COLOR_CALLS}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="whatsapp"
            name="Mensagens WhatsApp"
            stroke={COLOR_WHATSAPP}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
