"use client";

import { useEffect, useState } from "react";

type Contact = {
  id: string;
  name: string;
  title: string | null;
  seniority: string | null;
  linkedinUrl: string | null;
  email: string | null;
  phone: string | null;
  phoneStatus: "NAO_SOLICITADO" | "PENDENTE" | "DISPONIVEL" | "INDISPONIVEL";
  status: "NOVO" | "CONTATADO" | "QUALIFICADO" | "DESCARTADO";
};

const STATUS_LABELS: Record<Contact["status"], string> = {
  NOVO: "Novo",
  CONTATADO: "Contatado",
  QUALIFICADO: "Qualificado",
  DESCARTADO: "Descartado",
};

const STATUS_COLORS: Record<Contact["status"], string> = {
  NOVO: "bg-slate-700 text-slate-200",
  CONTATADO: "bg-amber-500/15 text-amber-400",
  QUALIFICADO: "bg-emerald-500/15 text-emerald-400",
  DESCARTADO: "bg-red-500/10 text-red-400",
};

export function ContactsPanel({ companyId }: { companyId: string }) {
  const [titles, setTitles] = useState("Sócio, Fundador, CEO, Diretor, Gerente de E-commerce");
  const [keywords, setKeywords] = useState("");

  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealingId, setRevealingId] = useState<string | null>(null);

  async function loadContacts() {
    setLoading(true);
    try {
      const res = await fetch(`/api/prospeccao/people?companyId=${companyId}`);
      if (res.ok) {
        const json = await res.json();
        setContacts(json.contacts);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load for this company's contacts
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const res = await fetch("/api/prospeccao/people/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          titles: titles
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
          keywords: keywords || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSearchResult(`${json.fetched} pessoas encontradas — ${json.created} novas, ${json.updated} atualizadas.`);
        await loadContacts();
      } else {
        setSearchError(json.error ?? "Erro ao buscar decisores.");
      }
    } catch {
      setSearchError("Erro de rede ao buscar decisores.");
    } finally {
      setSearching(false);
    }
  }

  async function updateContact(id: string, data: { status?: Contact["status"] }) {
    const res = await fetch(`/api/prospeccao/people/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const json = await res.json();
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...json.contact } : c)));
    }
  }

  async function revealPhone(contact: Contact) {
    const confirmed = window.confirm(
      `Revelar o telefone de ${contact.name} consome 1 crédito do Apollo. Continuar?`
    );
    if (!confirmed) return;

    setRevealingId(contact.id);
    try {
      const res = await fetch(`/api/prospeccao/people/${contact.id}/reveal-phone`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, phoneStatus: json.phoneStatus } : c)));
      } else {
        window.alert(json.error ?? "Erro ao pedir o telefone.");
      }
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <div className="border-t border-slate-800 bg-slate-950/40 p-4">
      <form onSubmit={runSearch} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          placeholder="Cargo (separe por vírgula)"
          value={titles}
          onChange={(e) => setTitles(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
        />
        <input
          placeholder="Nome (opcional)"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
        >
          {searching ? "Buscando..." : "Buscar decisores"}
        </button>
      </form>
      {searchError && <p className="mb-3 text-xs text-red-400">{searchError}</p>}
      {searchResult && <p className="mb-3 text-xs text-emerald-400">{searchResult}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum decisor ainda — busque por cargo ou nome acima.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Nome</th>
                <th className="py-2 pr-3 font-medium">Cargo</th>
                <th className="py-2 pr-3 font-medium">Telefone</th>
                <th className="py-2 pr-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-slate-900 align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium text-slate-100">{c.name}</p>
                    {c.linkedinUrl && (
                      <a href={c.linkedinUrl} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-brand">
                        LinkedIn
                      </a>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-400">{c.title ?? "—"}</td>
                  <td className="py-3 pr-3">
                    {c.phoneStatus === "DISPONIVEL" && c.phone ? (
                      <span className="font-medium text-emerald-400">{c.phone}</span>
                    ) : c.phoneStatus === "PENDENTE" ? (
                      <span className="text-xs text-amber-400">Pendente (atualize a página em instantes)</span>
                    ) : c.phoneStatus === "INDISPONIVEL" ? (
                      <span className="text-xs text-slate-600">Apollo não tem esse telefone</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => revealPhone(c)}
                        disabled={revealingId === c.id}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-brand hover:text-brand disabled:opacity-60"
                      >
                        {revealingId === c.id ? "Pedindo..." : "Revelar telefone"}
                      </button>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={c.status}
                      onChange={(e) => updateContact(c.id, { status: e.target.value as Contact["status"] })}
                      className={`rounded-full border-0 px-2 py-1 text-xs font-medium outline-none ${STATUS_COLORS[c.status]}`}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value} className="bg-slate-900 text-slate-200">
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
