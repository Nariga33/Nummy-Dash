"use client";

import { Fragment, useEffect, useState } from "react";
import {
  EMPLOYEE_RANGES,
  DEFAULT_EMPLOYEE_RANGES,
  CART_PLATFORMS,
  CONFIRMED_CART_PLATFORMS,
} from "@/lib/integrations/apollo";
import { ContactsPanel } from "./contacts-panel";
import { CompaniesKanban } from "./companies-kanban";

type Company = {
  id: string;
  name: string;
  domain: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  ecommercePlatforms: string[];
  status: "NOVO" | "CONTATADO" | "QUALIFICADO" | "DESCARTADO";
  notes: string | null;
};

const STATUS_LABELS: Record<Company["status"], string> = {
  NOVO: "Novo",
  CONTATADO: "Contatado",
  QUALIFICADO: "Qualificado",
  DESCARTADO: "Descartado",
};

const STATUS_COLORS: Record<Company["status"], string> = {
  NOVO: "bg-slate-700 text-slate-200",
  CONTATADO: "bg-amber-500/15 text-amber-400",
  QUALIFICADO: "bg-emerald-500/15 text-emerald-400",
  DESCARTADO: "bg-red-500/10 text-red-400",
};

function sizeBadge(count: number | null) {
  if (count == null) return null;
  if (count <= 20) return { label: "Pequena (acesso fácil)", cls: "bg-brand/15 text-brand" };
  if (count <= 100) return { label: "Média", cls: "bg-slate-700 text-slate-300" };
  return { label: "Grande", cls: "bg-slate-800 text-slate-400" };
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function ProspectingManager() {
  const [searchName, setSearchName] = useState("Empresas pequenas de e-commerce");
  const [employeeRanges, setEmployeeRanges] = useState<string[]>(DEFAULT_EMPLOYEE_RANGES);
  const [platforms, setPlatforms] = useState<string[]>([...CONFIRMED_CART_PLATFORMS]);
  const [locations, setLocations] = useState("Brazil");
  const [keywords, setKeywords] = useState("");

  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "kanban">("table");

  async function loadCompanies() {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (sizeFilter) params.set("size", sizeFilter);
      const res = await fetch(`/api/prospeccao/companies?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCompanies(json.companies);
      }
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial + filtered load reuses the same loader
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, sizeFilter]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const res = await fetch("/api/prospeccao/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: searchName,
          employeeRanges,
          technologies: platforms,
          locations: locations
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          keywords: keywords || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        const discardedNote =
          json.discardedByPlatformFilter > 0
            ? ` (${json.discardedByPlatformFilter} descartadas por não ter carrinho detectado)`
            : "";
        setSearchResult(
          `${json.fetched} empresas com carrinho detectado${discardedNote} (${json.totalEntries} no total no Apollo) — ${json.created} novas, ${json.updated} atualizadas.`
        );
        await loadCompanies();
      } else {
        setSearchError(json.error ?? "Erro ao buscar no Apollo.");
      }
    } catch {
      setSearchError("Erro de rede ao buscar no Apollo.");
    } finally {
      setSearching(false);
    }
  }

  async function updateCompany(id: string, data: { status?: Company["status"]; notes?: string }) {
    const res = await fetch(`/api/prospeccao/companies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.company } : c)));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-200">Nova busca no Apollo</h2>
        <form onSubmit={runSearch} className="flex flex-col gap-4">
          <input
            required
            placeholder="Nome da busca (só pra você lembrar depois)"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
          />

          <div>
            <p className="mb-2 text-xs font-medium text-slate-300">
              Porte (nº de funcionários) — as faixas pequenas já vêm marcadas
            </p>
            <div className="flex flex-wrap gap-2">
              {EMPLOYEE_RANGES.map((range) => {
                const checked = employeeRanges.includes(range.value);
                return (
                  <button
                    type="button"
                    key={range.value}
                    onClick={() => setEmployeeRanges((prev) => toggle(prev, range.value))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      checked
                        ? "border-brand bg-brand/15 text-brand"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-300">
              Plataforma de carrinho/loja (technologies detectadas pelo Apollo)
            </p>
            <div className="flex flex-wrap gap-2">
              {CART_PLATFORMS.map((platform) => {
                const checked = platforms.includes(platform);
                const confirmed = (CONFIRMED_CART_PLATFORMS as readonly string[]).includes(platform);
                return (
                  <button
                    type="button"
                    key={platform}
                    title={confirmed ? undefined : "Slug não confirmado no Apollo — pode não filtrar nada"}
                    onClick={() => setPlatforms((prev) => toggle(prev, platform))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      checked
                        ? "border-brand bg-brand/15 text-brand"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    } ${!confirmed ? "opacity-60" : ""}`}
                  >
                    {platform}
                    {!confirmed && <span className="ml-1 text-amber-400">?</span>}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Nenhuma marcada = não filtra por plataforma (traz e-commerce e não-e-commerce). As com{" "}
              <span className="text-amber-400">?</span> ainda não tiveram o slug confirmado no Apollo — empresas sem
              nenhuma plataforma detectada são descartadas automaticamente quando pelo menos uma está marcada, então
              usar só as confirmadas dá mais resultado.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              placeholder="Locais, separados por vírgula (ex: Brazil)"
              value={locations}
              onChange={(e) => setLocations(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
            />
            <input
              placeholder="Palavra-chave no nome da empresa (opcional)"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
            />
          </div>

          <button
            type="submit"
            disabled={searching || employeeRanges.length === 0}
            className="self-start rounded-full bg-brand px-5 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
          >
            {searching ? "Buscando..." : "Buscar no Apollo"}
          </button>
        </form>
        {searchError && <p className="mt-3 text-xs text-red-400">{searchError}</p>}
        {searchResult && <p className="mt-3 text-xs text-emerald-400">{searchResult}</p>}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-200">Empresas prospectadas ({companies.length})</h2>
          <div className="flex flex-wrap gap-2">
            <div className="flex overflow-hidden rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setView("table")}
                className={`px-3 py-1.5 font-medium transition ${
                  view === "table" ? "bg-brand/15 text-brand" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setView("kanban")}
                className={`px-3 py-1.5 font-medium transition ${
                  view === "kanban" ? "bg-brand/15 text-brand" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Kanban
              </button>
            </div>
            <select
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand"
            >
              <option value="">Todos os portes</option>
              <option value="micro">Pequenas (≤20)</option>
              <option value="small">Médias (21–100)</option>
              <option value="large">Grandes ({">"}100)</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-brand"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingList ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma empresa ainda — rode uma busca acima.</p>
        ) : view === "kanban" ? (
          <CompaniesKanban companies={companies} onStatusChange={(id, status) => updateCompany(id, { status })} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Empresa</th>
                  <th className="py-2 pr-3 font-medium">Porte</th>
                  <th className="py-2 pr-3 font-medium">Plataforma</th>
                  <th className="py-2 pr-3 font-medium">Local</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const badge = sizeBadge(c.employeeCount);
                  const expanded = expandedCompanyId === c.id;
                  return (
                    <Fragment key={c.id}>
                    <tr className="border-b border-slate-900 align-top">
                      <td className="py-3 pr-3">
                        <p className="font-medium text-slate-100">{c.name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500">
                          {c.domain && (
                            <a
                              href={`https://${c.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-brand"
                            >
                              {c.domain}
                            </a>
                          )}
                          {c.linkedinUrl && (
                            <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="hover:text-brand">
                              LinkedIn
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-slate-300">{c.employeeCount ?? "—"} func.</p>
                        {badge && (
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        {c.ecommercePlatforms.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {c.ecommercePlatforms.map((p) => (
                              <span
                                key={p}
                                className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">não detectada</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-400">
                        {[c.city, c.state, c.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          value={c.status}
                          onChange={(e) => updateCompany(c.id, { status: e.target.value as Company["status"] })}
                          className={`rounded-full border-0 px-2 py-1 text-xs font-medium outline-none ${STATUS_COLORS[c.status]}`}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value} className="bg-slate-900 text-slate-200">
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => setExpandedCompanyId(expanded ? null : c.id)}
                          className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-brand hover:text-brand"
                        >
                          {expanded ? "Fechar" : "Decisores"}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <ContactsPanel companyId={c.id} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
