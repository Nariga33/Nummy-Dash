"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Plus, X, Search, Trash2, CheckCircle2 } from "lucide-react";
import { initials } from "@/lib/crm";

type Contact = {
  id: string;
  companyName: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  notes: string | null;
  createdAt: string;
  _count: { opportunities: number };
};

type Stage = { id: string; name: string; color: string; order: number };
type CrmUser = { id: string; name: string };

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-white/[0.08] bg-slate-900 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand/60 transition-colors";

function normalizeHeader(h: string) {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, "companyName" | "name" | "email" | "phone" | "phone2"> = {
  nomedaempresa: "companyName",
  empresa: "companyName",
  nomedolead: "name",
  lead: "name",
  nome: "name",
  nomedocontato: "name",
  email: "email",
  telefone: "phone",
  telefone1: "phone",
  celular: "phone",
  telefone2: "phone2",
  telefonesecundario: "phone2",
};

function parseWorkbookRows(data: ArrayBuffer) {
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return raw.map((row) => {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const field = HEADER_ALIASES[normalizeHeader(key)];
      if (field && value !== undefined && value !== null) {
        mapped[field] = String(value).trim();
      }
    }
    return mapped;
  });
}

export function ProspeccaoManager({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stages, setStages] = useState<Stage[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);

  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ companyName: "", name: "", email: "", phone: "", phone2: "" });
  const [savingContact, setSavingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [opportunityContact, setOpportunityContact] = useState<Contact | null>(null);
  const [newOpportunity, setNewOpportunity] = useState({
    title: "",
    value: "",
    stageId: "",
    ownerId: currentUserId,
    notes: "",
  });
  const [savingOpportunity, setSavingOpportunity] = useState(false);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [opportunityDone, setOpportunityDone] = useState(false);

  async function loadContacts(q?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (res.ok) {
        const json = await res.json();
        setContacts(json.contacts);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load reuses the same loader called after mutations
    loadContacts();
    (async () => {
      const [stagesRes, usersRes] = await Promise.all([fetch("/api/crm/stages"), fetch("/api/crm/users")]);
      if (stagesRes.ok) {
        const json = await stagesRes.json();
        setStages(json.stages);
      }
      if (usersRes.ok) {
        const json = await usersRes.json();
        setUsers(json.users);
      }
    })();
  }, []);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function onSearchChange(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadContacts(value), 300);
  }

  async function createContact(e: React.FormEvent) {
    e.preventDefault();
    setSavingContact(true);
    setContactError(null);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowNewContact(false);
        setNewContact({ companyName: "", name: "", email: "", phone: "", phone2: "" });
        await loadContacts(search);
      } else {
        setContactError(json.error ?? "Erro ao salvar contato.");
      }
    } catch {
      setContactError("Erro de rede ao salvar contato.");
    } finally {
      setSavingContact(false);
    }
  }

  async function deleteContact(id: string) {
    if (!confirm("Excluir este contato e suas oportunidades?")) return;
    await fetch(`/api/crm/contacts/${id}`, { method: "DELETE" });
    await loadContacts(search);
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportResult(null);
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseWorkbookRows(reader.result as ArrayBuffer);
        const valid = rows.filter((r) => r.companyName && r.name);
        if (valid.length === 0) {
          setImportError(
            "Nenhuma linha válida encontrada. Confira se a planilha tem as colunas Nome da empresa e Nome do Lead."
          );
        }
        setImportRows(valid);
      } catch {
        setImportError("Não foi possível ler o arquivo. Envie um .xlsx ou .csv válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/crm/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setImportResult(
          `${json.created} contato(s) criado(s), ${json.updated} atualizado(s)${json.skipped ? `, ${json.skipped} ignorado(s)` : ""}.`
        );
        setImportRows([]);
        setImportFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        await loadContacts(search);
      } else {
        setImportError(json.error ?? "Erro ao importar planilha.");
      }
    } catch {
      setImportError("Erro de rede ao importar planilha.");
    } finally {
      setImporting(false);
    }
  }

  function openOpportunityModal(contact: Contact) {
    setOpportunityContact(contact);
    setNewOpportunity({
      title: `Oportunidade - ${contact.companyName}`,
      value: "",
      stageId: stages[0]?.id ?? "",
      ownerId: currentUserId,
      notes: "",
    });
    setOpportunityError(null);
    setOpportunityDone(false);
  }

  async function createOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (!opportunityContact) return;
    setSavingOpportunity(true);
    setOpportunityError(null);
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: opportunityContact.id,
          title: newOpportunity.title,
          value: newOpportunity.value ? Number(newOpportunity.value) : undefined,
          stageId: newOpportunity.stageId || undefined,
          ownerId: newOpportunity.ownerId,
          notes: newOpportunity.notes || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setOpportunityDone(true);
        await loadContacts(search);
      } else {
        setOpportunityError(json.error ?? "Erro ao criar oportunidade.");
      }
    } catch {
      setOpportunityError("Erro de rede ao criar oportunidade.");
    } finally {
      setSavingOpportunity(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por empresa, lead, e-mail ou telefone..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-brand/30 hover:text-brand"
          >
            <Upload className="h-4 w-4" />
            Importar Excel
          </button>
          <button
            type="button"
            onClick={() => setShowNewContact(true)}
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink shadow-[0_0_16px_#f5b40030] transition hover:bg-brand-hover hover:shadow-[0_0_20px_#f5b40050]"
          >
            <Plus className="h-4 w-4" />
            Novo contato
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-900/60">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">Oportunidades</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Nenhum contato encontrado. Importe uma planilha ou cadastre manualmente.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="border-b border-white/[0.05] transition-colors last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[10px] font-black text-brand">
                      {initials(c.companyName) || "?"}
                    </div>
                    <span className="font-semibold text-white">{c.companyName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">{c.name}</td>
                <td className="px-4 py-3 text-slate-400">
                  <div className="flex flex-col gap-0.5">
                    {c.email && <span>{c.email}</span>}
                    {c.phone && <span>{c.phone}</span>}
                    {c.phone2 && <span className="text-slate-500">{c.phone2}</span>}
                    {!c.email && !c.phone && !c.phone2 && <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-[11px] font-bold text-slate-300">
                    {c._count.opportunities}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openOpportunityModal(c)}
                      className="flex items-center gap-1 rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Oportunidade
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteContact(c.id)}
                      className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Excluir contato"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewContact && (
        <Modal title="Novo contato" onClose={() => setShowNewContact(false)}>
          <form onSubmit={createContact} className="flex flex-col gap-3">
            <input
              required
              placeholder="Nome da empresa"
              value={newContact.companyName}
              onChange={(e) => setNewContact({ ...newContact, companyName: e.target.value })}
              className={inputClass}
            />
            <input
              required
              placeholder="Nome do lead"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className={inputClass}
            />
            <input
              type="email"
              placeholder="E-mail"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Telefone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className={inputClass}
              />
              <input
                placeholder="Telefone 2"
                value={newContact.phone2}
                onChange={(e) => setNewContact({ ...newContact, phone2: e.target.value })}
                className={inputClass}
              />
            </div>
            {contactError && <p className="text-xs text-red-400">{contactError}</p>}
            <button
              type="submit"
              disabled={savingContact}
              className="mt-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink shadow-[0_0_16px_#f5b40030] transition hover:bg-brand-hover hover:shadow-[0_0_20px_#f5b40050] disabled:opacity-60"
            >
              {savingContact ? "Salvando..." : "Salvar contato"}
            </button>
          </form>
        </Modal>
      )}

      {showImport && (
        <Modal
          title="Importar contatos via Excel"
          onClose={() => {
            setShowImport(false);
            setImportRows([]);
            setImportFileName("");
            setImportError(null);
            setImportResult(null);
          }}
        >
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500">
              Envie um arquivo .xlsx ou .csv com as colunas <b>Nome da empresa</b>, <b>Nome do Lead</b>,{" "}
              <b>E-mail</b>, <b>Telefone</b> e <b>Telefone 2</b>. Contatos com e-mail já cadastrado serão
              atualizados.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={onFileSelected}
              className="text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/[0.08] file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-brand/20 hover:file:text-brand"
            />
            {importFileName && importRows.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {importFileName}: {importRows.length} contato(s) prontos para importar.
              </p>
            )}
            {importError && <p className="text-xs text-red-400">{importError}</p>}
            {importResult && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {importResult}
              </p>
            )}
            <button
              type="button"
              disabled={importRows.length === 0 || importing}
              onClick={confirmImport}
              className="mt-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink shadow-[0_0_16px_#f5b40030] transition hover:bg-brand-hover hover:shadow-[0_0_20px_#f5b40050] disabled:opacity-60"
            >
              {importing ? "Importando..." : `Importar ${importRows.length || ""} contato(s)`}
            </button>
          </div>
        </Modal>
      )}

      {opportunityContact && (
        <Modal title={`Nova oportunidade · ${opportunityContact.companyName}`} onClose={() => setOpportunityContact(null)}>
          {opportunityDone ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-1.5 text-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                Oportunidade criada com sucesso.
              </p>
              <button
                type="button"
                onClick={() => setOpportunityContact(null)}
                className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink shadow-[0_0_16px_#f5b40030] transition hover:bg-brand-hover hover:shadow-[0_0_20px_#f5b40050]"
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={createOpportunity} className="flex flex-col gap-3">
              <input
                required
                placeholder="Título da oportunidade"
                value={newOpportunity.title}
                onChange={(e) => setNewOpportunity({ ...newOpportunity, title: e.target.value })}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Valor (R$)"
                  value={newOpportunity.value}
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, value: e.target.value })}
                  className={inputClass}
                />
                <select
                  value={newOpportunity.stageId}
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, stageId: e.target.value })}
                  className={inputClass}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {isAdmin ? (
                <select
                  value={newOpportunity.ownerId}
                  onChange={(e) => setNewOpportunity({ ...newOpportunity, ownerId: e.target.value })}
                  className={inputClass}
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.id === currentUserId ? `${u.name} (eu)` : u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500">
                  Responsável: <span className="text-slate-300">você</span>
                </p>
              )}
              <textarea
                placeholder="Observações (opcional)"
                value={newOpportunity.notes}
                onChange={(e) => setNewOpportunity({ ...newOpportunity, notes: e.target.value })}
                rows={3}
                className={inputClass}
              />
              {opportunityError && <p className="text-xs text-red-400">{opportunityError}</p>}
              <button
                type="submit"
                disabled={savingOpportunity}
                className="mt-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink shadow-[0_0_16px_#f5b40030] transition hover:bg-brand-hover hover:shadow-[0_0_20px_#f5b40050] disabled:opacity-60"
              >
                {savingOpportunity ? "Criando..." : "Criar oportunidade"}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
