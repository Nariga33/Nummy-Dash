"use client";

import { useEffect, useState } from "react";
import type { MetricsSummary } from "@/lib/metrics";
import { KpiCard } from "@/components/kpi-card";
import { TrendChart } from "@/components/trend-chart";
import { StatusBreakdown } from "@/components/status-breakdown";
import { DateRangeSelect } from "@/components/date-range-select";

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function DashboardContent({ isAdmin }: { isAdmin: boolean }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets loading state when `days` changes before the refetch below resolves
    setLoading(true);
    fetch(`/api/metrics/summary?days=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error("Falha ao carregar métricas.");
        return res.json();
      })
      .then((json: MetricsSummary) => {
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey]);

  async function clearDemoData() {
    if (!confirm("Isso apaga permanentemente os dados de demonstração. Continuar?")) return;
    setClearing(true);
    try {
      const res = await fetch("/api/demo-data/clear", { method: "POST" });
      if (res.ok) setRefreshKey((k) => k + 1);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Visão geral</h1>
          <p className="mt-1 text-sm text-slate-500">Operação outbound — ligações e mensagens WhatsApp</p>
        </div>
        <DateRangeSelect value={days} onChange={setDays} />
      </div>

      {data?.isDemoData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
          <span>
            Exibindo dados de demonstração. {isAdmin ? (
              <>
                Configure a chave da API4COM em{" "}
                <a href="/settings/integrations" className="underline underline-offset-2">
                  Integrações
                </a>{" "}
                para ver dados reais.
              </>
            ) : (
              "Peça a um administrador para conectar as integrações reais."
            )}
          </span>
          {isAdmin && (
            <button
              onClick={clearDemoData}
              disabled={clearing}
              className="shrink-0 rounded-full border border-amber-700/60 px-3 py-1 text-xs font-medium text-amber-200 transition hover:border-amber-500 disabled:opacity-60"
            >
              {clearing ? "Zerando..." : "Zerar dados de demonstração"}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total de ligações"
          value={loading || !data ? "—" : String(data.calls.total)}
          hint={loading || !data ? undefined : `${data.calls.answered} atendidas`}
          accent="blue"
        />
        <KpiCard
          label="Duração média"
          value={loading || !data ? "—" : formatDuration(data.calls.avgDurationSec)}
          hint="por ligação"
        />
        <KpiCard
          label="Mensagens WhatsApp"
          value={loading || !data ? "—" : String(data.whatsapp.total)}
          hint={loading || !data ? undefined : `${data.whatsapp.sent} enviadas · ${data.whatsapp.received} recebidas`}
          accent="orange"
        />
        <KpiCard
          label="Taxa de atendimento"
          value={
            loading || !data || data.calls.total === 0
              ? "—"
              : `${Math.round((data.calls.answered / data.calls.total) * 100)}%`
          }
          hint="ligações atendidas / total"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Ligações e mensagens por dia</h2>
          {loading || !data ? (
            <div className="flex h-72 items-center justify-center text-sm text-slate-600">Carregando...</div>
          ) : (
            <TrendChart data={data.daily} />
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="mb-4 text-sm font-medium text-slate-300">Ligações por status</h2>
          {loading || !data ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-600">Carregando...</div>
          ) : (
            <StatusBreakdown data={data.calls.byStatus} />
          )}
        </div>
      </div>
    </div>
  );
}
