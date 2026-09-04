"use client";

import { useEffect, useState } from "react";
import { DEFAULT_STAGE_COLORS, formatCurrency, initials } from "@/lib/crm";

type Stage = {
  id: string;
  name: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  _count: { opportunities: number };
};

type CrmUser = { id: string; name: string };

type Opportunity = {
  id: string;
  title: string;
  value: number | null;
  stageId: string;
  notes: string | null;
  contact: {
    id: string;
    companyName: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  owner: CrmUser | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand";

function Avatar({ name }: { name: string }) {
  return (
    <div
      title={name}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand"
    >
      {initials(name) || "?"}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  canManage,
  onDragStart,
  onClick,
}: {
  opportunity: Opportunity;
  canManage: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable={canManage}
      onDragStart={(e) => canManage && onDragStart(e, opportunity.id)}
      onClick={onClick}
      className={`rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-left shadow-sm transition hover:border-slate-600 ${
        canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-100">{opportunity.title}</p>
        {opportunity.owner && <Avatar name={opportunity.owner.name} />}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">{opportunity.contact.companyName}</p>
      <p className="text-xs text-slate-500">{opportunity.contact.name}</p>
      {opportunity.value !== null && (
        <p className="mt-2 text-sm font-semibold text-brand">{formatCurrency(opportunity.value)}</p>
      )}
    </div>
  );
}

function NewStageForm({ onCreate, onCancel }: { onCreate: (name: string, color: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_STAGE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        await onCreate(name.trim(), color);
        setSaving(false);
      }}
      className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900/20 p-3"
    >
      <input
        autoFocus
        placeholder="Nome da coluna"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_STAGE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            style={{ backgroundColor: c }}
            className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-slate-900 transition ${
              color === c ? "ring-2 ring-white" : ""
            }`}
            aria-label={c}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
        >
          {saving ? "Criando..." : "Criar coluna"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export function PipelineBoard({ currentUserId, isAdmin }: { currentUserId: string; isAdmin: boolean }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const [showNewStage, setShowNewStage] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageColor, setEditStageColor] = useState("");
  const [stageError, setStageError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editStageId, setEditStageId] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [stagesRes, oppsRes, usersRes] = await Promise.all([
        fetch("/api/crm/stages"),
        fetch("/api/crm/opportunities"),
        fetch("/api/crm/users"),
      ]);
      if (stagesRes.ok) setStages((await stagesRes.json()).stages);
      if (oppsRes.ok) setOpportunities((await oppsRes.json()).opportunities);
      if (usersRes.ok) setUsers((await usersRes.json()).users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load reuses the same loader called after mutations
    load();
  }, []);

  function canManage(o: Opportunity) {
    return isAdmin || o.owner?.id === currentUserId;
  }

  function onDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.setData("text/plain", id);
  }

  async function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData("text/plain");
    const opportunity = opportunities.find((o) => o.id === id);
    if (!opportunity || opportunity.stageId === stageId || !canManage(opportunity)) return;

    setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, stageId } : o)));
    await fetch(`/api/crm/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
  }

  function openDetail(opportunity: Opportunity) {
    setSelected(opportunity);
    setEditValue(opportunity.value?.toString() ?? "");
    setEditStageId(opportunity.stageId);
    setEditOwnerId(opportunity.owner?.id ?? "");
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
          stageId: editStageId,
          ownerId: isAdmin ? editOwnerId || null : undefined,
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

  async function createStage(name: string, color: string) {
    setStageError(null);
    const res = await fetch("/api/crm/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (res.ok) {
      setShowNewStage(false);
      await load();
    } else {
      const json = await res.json().catch(() => ({}));
      setStageError(json.error ?? "Erro ao criar coluna.");
    }
  }

  function startEditStage(stage: Stage) {
    setEditingStageId(stage.id);
    setEditStageName(stage.name);
    setEditStageColor(stage.color);
    setStageError(null);
  }

  async function saveStageEdit() {
    if (!editingStageId || !editStageName.trim()) return;
    const res = await fetch(`/api/crm/stages/${editingStageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editStageName.trim(), color: editStageColor }),
    });
    if (res.ok) {
      setEditingStageId(null);
      await load();
    } else {
      const json = await res.json().catch(() => ({}));
      setStageError(json.error ?? "Erro ao salvar coluna.");
    }
  }

  async function deleteStage(stage: Stage) {
    if (stage._count.opportunities > 0) {
      alert("Mova ou exclua as oportunidades desta coluna antes de excluí-la.");
      return;
    }
    if (!confirm(`Excluir a coluna "${stage.name}"?`)) return;
    const res = await fetch(`/api/crm/stages/${stage.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function moveStage(stage: Stage, direction: -1 | 1) {
    const sorted = [...stages].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((s) => s.id === stage.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const target = sorted[targetIndex];

    setStages((prev) =>
      prev.map((s) => {
        if (s.id === stage.id) return { ...s, order: target.order };
        if (s.id === target.id) return { ...s, order: stage.order };
        return s;
      })
    );
    await Promise.all([
      fetch(`/api/crm/stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: target.order }),
      }),
      fetch(`/api/crm/stages/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: stage.order }),
      }),
    ]);
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando pipeline...</p>;
  }

  const sortedStages = [...stages].sort((a, b) => a.order - b.order);
  const selectedCanManage = selected ? canManage(selected) : false;

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {sortedStages.map((stage, index) => {
          const items = opportunities.filter((o) => o.stageId === stage.id);
          const total = items.reduce((sum, o) => sum + (o.value ?? 0), 0);
          const isEditing = editingStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => onDrop(e, stage.id)}
              style={{ borderTopColor: stage.color }}
              className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-4 border-slate-800 bg-slate-900/40 ${
                dragOverStage === stage.id ? "ring-2 ring-brand/50" : ""
              }`}
            >
              <div className="px-3 py-3">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      autoFocus
                      value={editStageName}
                      onChange={(e) => setEditStageName(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {DEFAULT_STAGE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditStageColor(c)}
                          style={{ backgroundColor: c }}
                          className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-slate-900 transition ${
                            editStageColor === c ? "ring-2 ring-white" : ""
                          }`}
                          aria-label={c}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveStageEdit}
                        className="flex-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-ink hover:bg-brand-hover"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingStageId(null)}
                        className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:border-slate-500"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{stage.name}</p>
                      <p className="text-xs text-slate-500">
                        {items.length} · {formatCurrency(total) ?? "R$ 0,00"}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-0.5 text-slate-500">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveStage(stage, -1)}
                          className="rounded p-1 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          aria-label="Mover para a esquerda"
                        >
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          disabled={index === sortedStages.length - 1}
                          onClick={() => moveStage(stage, 1)}
                          className="rounded p-1 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"
                          aria-label="Mover para a direita"
                        >
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditStage(stage)}
                          className="rounded p-1 hover:bg-slate-800 hover:text-slate-200"
                          aria-label="Editar coluna"
                        >
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteStage(stage)}
                          className="rounded p-1 hover:bg-slate-800 hover:text-red-400"
                          aria-label="Excluir coluna"
                        >
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M6 7h12M9 7V4h6v3m-8 0l1 13a2 2 0 002 2h4a2 2 0 002-2l1-13"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 px-3 pb-3 min-h-[80px]">
                {items.map((o) => (
                  <OpportunityCard
                    key={o.id}
                    opportunity={o}
                    canManage={canManage(o)}
                    onDragStart={onDragStart}
                    onClick={() => openDetail(o)}
                  />
                ))}
                {items.length === 0 && <p className="py-4 text-center text-xs text-slate-600">Sem oportunidades</p>}
              </div>
            </div>
          );
        })}

        {isAdmin &&
          (showNewStage ? (
            <NewStageForm onCreate={createStage} onCancel={() => setShowNewStage(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setShowNewStage(true)}
              className="flex w-72 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 py-8 text-sm font-medium text-slate-500 transition hover:border-brand/50 hover:text-brand"
            >
              + Nova coluna
            </button>
          ))}
      </div>
      {stageError && <p className="mt-2 text-xs text-red-400">{stageError}</p>}

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

              {!selectedCanManage && (
                <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-400">
                  Somente o responsável ({selected.owner?.name ?? "—"}) ou um administrador pode editar esta
                  oportunidade.
                </p>
              )}

              <label className="text-xs font-medium text-slate-400">
                Coluna
                <select
                  disabled={!selectedCanManage}
                  value={editStageId}
                  onChange={(e) => setEditStageId(e.target.value)}
                  className={`${inputClass} mt-1 disabled:opacity-60`}
                >
                  {sortedStages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-slate-400">
                Responsável
                {isAdmin ? (
                  <select
                    value={editOwnerId}
                    onChange={(e) => setEditOwnerId(e.target.value)}
                    className={`${inputClass} mt-1`}
                  >
                    <option value="">Sem responsável</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-sm text-slate-300">{selected.owner?.name ?? "—"}</p>
                )}
              </label>

              <label className="text-xs font-medium text-slate-400">
                Valor (R$)
                <input
                  disabled={!selectedCanManage}
                  type="number"
                  min={0}
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className={`${inputClass} mt-1 disabled:opacity-60`}
                />
              </label>
              <label className="text-xs font-medium text-slate-400">
                Observações
                <textarea
                  disabled={!selectedCanManage}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-1 disabled:opacity-60`}
                />
              </label>
              {selectedCanManage && (
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
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
