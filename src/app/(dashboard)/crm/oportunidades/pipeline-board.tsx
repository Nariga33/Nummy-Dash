"use client";

import { useEffect, useState } from "react";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/crm";

type OpportunityStage = (typeof STAGE_ORDER)[number];

type Opportunity = {
  id: string;
  title: string;
  value: number | null;
  stage: OpportunityStage;
  notes: string | null;
  contact: {
    id: string;
    companyName: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
};

const STAGE_ACCENT: Record<OpportunityStage, string> = {
  NEW: "border-t-slate-500",
  CONTACTED: "border-t-sky-500",
  QUALIFIED: "border-t-indigo-500",
  PROPOSAL: "border-t-amber-500",
  NEGOTIATION: "border-t-orange-500",
  WON: "border-t-emerald-500",
  LOST: "border-t-red-500",
};

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return null;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function OpportunityCard({
  opportunity,
  onDragStart,
  onClick,
}: {
  opportunity: Opportunity;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, opportunity.id)}
      onClick={onClick}
      className="cursor-grab rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-left shadow-sm transition hover:border-slate-600 active:cursor-grabbing"
    >
      <p className="text-sm font-medium text-slate-100">{opportunity.title}</p>
      <p className="mt-0.5 text-xs text-slate-500">{opportunity.contact.companyName}</p>
      <p className="text-xs text-slate-500">{opportunity.contact.name}</p>
      {opportunity.value !== null && (
        <p className="mt-2 text-sm font-semibold text-brand">{formatCurrency(opportunity.value)}</p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand";

export function PipelineBoard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverStage, setDragOverStage] = useState<OpportunityStage | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/opportunities");
      if (res.ok) {
        const json = await res.json();
        setOpportunities(json.opportunities);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load reuses the same loader called after mutations
    load();
  }, []);

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
  }

  async function onDrop(e: React.DragEvent, stage: OpportunityStage) {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData("text/plain");
    const opportunity = opportunities.find((o) => o.id === id);
    if (!opportunity || opportunity.stage === stage) return;

    setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o)));
    await fetch(`/api/crm/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
  }

  function openDetail(opportunity: Opportunity) {
    setSelected(opportunity);
    setEditValue(opportunity.value?.toString() ?? "");
    setEditNotes(opportunity.notes ?? "");
  }

  async function saveDetail() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/opportunities/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: editValue ? Number(editValue) : null,
          notes: editNotes,
        }),
      });
      if (res.ok) {
        setSelected(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteOpportunity() {
    if (!selected) return;
    if (!confirm("Excluir esta oportunidade?")) return;
    await fetch(`/api/crm/opportunities/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    await load();
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando pipeline...</p>;
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_ORDER.map((stage) => {
          const items = opportunities.filter((o) => o.stage === stage);
          const total = items.reduce((sum, o) => sum + (o.value ?? 0), 0);
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => onDrop(e, stage)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-4 border-slate-800 bg-slate-900/40 ${STAGE_ACCENT[stage]} ${
                dragOverStage === stage ? "ring-2 ring-brand/50" : ""
              }`}
            >
              <div className="flex items-center justify-between px-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-200">{STAGE_LABELS[stage]}</p>
                  <p className="text-xs text-slate-500">
                    {items.length} · {formatCurrency(total) ?? "R$ 0,00"}
                  </p>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-3 pb-3 min-h-[80px]">
                {items.map((o) => (
                  <OpportunityCard key={o.id} opportunity={o} onDragStart={onDragStart} onClick={() => openDetail(o)} />
                ))}
                {items.length === 0 && <p className="py-4 text-center text-xs text-slate-600">Sem oportunidades</p>}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-100">{selected.title}</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                aria-label="Fechar"
              >
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                <p className="text-sm font-medium text-slate-200">{selected.contact.companyName}</p>
                <p>{selected.contact.name}</p>
                {selected.contact.email && <p>{selected.contact.email}</p>}
                {selected.contact.phone && <p>{selected.contact.phone}</p>}
              </div>
              <label className="text-xs font-medium text-slate-400">
                Valor (R$)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-xs font-medium text-slate-400">
                Observações
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={saveDetail}
                  disabled={saving}
                  className="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button
                  type="button"
                  onClick={deleteOpportunity}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 transition hover:border-red-500/50 hover:text-red-400"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
