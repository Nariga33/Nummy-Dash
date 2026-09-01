"use client";

import { useState } from "react";

type Partner = { name: string; role: string | null };

type CompanyCnpjFields = {
  id: string;
  cnpj: string | null;
  cnpjStatus: string | null;
  cnpjStatusDate: string | null;
  cnpjPartners: Partner[];
};

function formatCnpj(cnpj: string) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function statusColor(status: string | null) {
  if (!status) return "bg-slate-700 text-slate-300";
  const normalized = status.toLowerCase();
  if (normalized.includes("ativ")) return "bg-emerald-500/15 text-emerald-400";
  return "bg-red-500/10 text-red-400";
}

export function CnpjPanel({
  company,
  onUpdated,
}: {
  company: CompanyCnpjFields;
  onUpdated: (id: string, data: Partial<CompanyCnpjFields>) => void;
}) {
  const [cnpjInput, setCnpjInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prospeccao/companies/${company.id}/cnpj`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: cnpjInput }),
      });
      const json = await res.json();
      if (res.ok) {
        onUpdated(company.id, json.company);
        setCnpjInput("");
      } else {
        setError(json.error ?? "Erro ao consultar o CNPJ.");
      }
    } catch {
      setError("Erro de rede ao consultar o CNPJ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/40 p-4">
      {company.cnpj ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-slate-200">{formatCnpj(company.cnpj)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor(company.cnpjStatus)}`}>
              {company.cnpjStatus ?? "situação desconhecida"}
            </span>
          </div>
          {company.cnpjPartners.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {company.cnpjPartners.map((p) => (
                <span key={p.name} className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                  {p.name}
                  {p.role ? ` · ${p.role}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600">Nenhum sócio retornado.</p>
          )}
        </div>
      ) : (
        <form onSubmit={consultar} className="flex flex-col gap-2 sm:flex-row">
          <input
            required
            placeholder="CNPJ da empresa (só números ou formatado)"
            value={cnpjInput}
            onChange={(e) => setCnpjInput(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
          >
            {loading ? "Consultando..." : "Consultar CNPJ"}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
