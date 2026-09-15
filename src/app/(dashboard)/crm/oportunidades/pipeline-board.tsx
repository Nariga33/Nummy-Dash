"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Mail,
  Phone,
  User,
} from "lucide-react";
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
  "w-full rounded-lg border border-white/[0.08] bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand/60 transition-colors";

function ColorDots({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DEFAULT_STAGE_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`h-5 w-5 rounded-full ring-offset-2 ring-offset-slate-900 transition-all hover:ring-2 hover:ring-white/40 ${
            value === c ? "ring-2 ring-white" : ""
          }`}
          aria-label={c}
        />
      ))}
    </div>
  );
}

function OpportunityCard({
  opportunity,
  canManage,
  isDragging,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  opportunity: Opportunity;
  canManage: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable={canManage}
      onDragStart={(e) => canManage && onDragStart(e, opportunity.id)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group rounded-xl border bg-slate-900 p-3.5 transition-all duration-200 ${
        isDragging
          ? "scale-[0.97] border-brand/20 opacity-30 shadow-[0_0_20px_#f5b40033]"
          : `border-white/[0.06] hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_0_14px_#f5b40022] ${
              canManage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            }`
      }`}
    >
      <p className="mb-2.5 text-sm font-bold leading-snug text-white transition-colors group-hover:text-brand">
        {opportunity.title}
      </p>
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/[0.08] bg-slate-800">
          <User className="h-2.5 w-2.5 text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase leading-none tracking-widest text-slate-500">
            {opportunity.contact.companyName}
          </p>
          <p className="truncate text-xs font-medium text-slate-300">{opportunity.contact.name}</p>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/[0.05] pt-2.5">
        {opportunity.value !== null ? (
          <span className="text-[11px] font-black text-brand">{formatCurrency(opportunity.value)}</span>
        ) : (
          <span className="text-[11px] text-slate-500">Sem valor</span>
        )}
        {opportunity.owner && (
          <div
            title={opportunity.owner.name}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-black text-brand-ink shadow-[0_0_8px_#f5b40040]"
          >
            {initials(opportunity.owner.name) || "?"}
          </div>
        )}
      </div>
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
      className="flex w-72 shrink-0 flex-col gap-2.5 rounded-2xl border border-brand/30 bg-slate-900/60 p-4"
    >
      <input
        autoFocus
        placeholder="Nome da coluna"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <ColorDots value={color} onChange={setColor} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-brand-ink shadow-[0_0_16px_#f5b40030] transition hover:bg-brand-hover hover:shadow-[0_0_20px_#f5b40050] disabled:opacity-60"
        >
          {saving ? "Criando..." : "Criar coluna"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-white/[0.08] px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-white/20 hover:text-slate-200"
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
  const [draggingId, setDraggingId] = useState<string | null>(null);

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
    setDraggingId(id);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDragOverStage(null);
  }

  async function onDrop(e: React.DragEvent, stageId: string) {
    e.preventDefault();
    setDragOverStage(null);
    setDraggingId(null);
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
          const isDragTarget = dragOverStage === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => onDrop(e, stage.id)}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-slate-900/60 transition-all duration-150 ${
                isDragTarget ? "scale-[1.01] border-brand/50 shadow-[0_0_20px_#f5b40033]" : "border-white/[0.06]"
              }`}
            >
              <div className="shrink-0 px-4 pb-3 pt-4">
                {isEditing ? (
                  <div className="flex flex-col gap-2.5">
                    <input
                      autoFocus
                      value={editStageName}
                      onChange={(e) => setEditStageName(e.target.value)}
                      className={inputClass}
                    />
                    <ColorDots value={editStageColor} onChange={setEditStageColor} />
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
                        className="rounded-full border border-white/[0.08] px-3 py-1 text-xs text-slate-400 hover:border-white/20"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <h3 className="truncate text-sm font-bold text-white">{stage.name}</h3>
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-white/[0.08] px-1.5 text-[11px] font-bold text-slate-300">
                          {items.length}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex shrink-0 items-center gap-0.5 text-slate-500">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveStage(stage, -1)}
                            className="rounded-lg p-1 transition-colors hover:bg-brand/10 hover:text-brand disabled:opacity-30"
                            aria-label="Mover para a esquerda"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortedStages.length - 1}
                            onClick={() => moveStage(stage, 1)}
                            className="rounded-lg p-1 transition-colors hover:bg-brand/10 hover:text-brand disabled:opacity-30"
                            aria-label="Mover para a direita"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditStage(stage)}
                            className="rounded-lg p-1 transition-colors hover:bg-brand/10 hover:text-brand"
                            aria-label="Editar coluna"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStage(stage)}
                            className="rounded-lg p-1 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            aria-label="Excluir coluna"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    {total > 0 && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-slate-500" />
                        <p className="text-xs font-semibold text-slate-300">{formatCurrency(total)}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex min-h-[96px] flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
                {items.map((o) => (
                  <OpportunityCard
                    key={o.id}
                    opportunity={o}
                    canManage={canManage(o)}
                    isDragging={draggingId === o.id}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onClick={() => openDetail(o)}
                  />
                ))}
                {items.length === 0 && (
                  <div
                    className={`flex h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed text-xs transition-all duration-150 ${
                      isDragTarget
                        ? "scale-[1.02] border-brand bg-brand/[0.08] text-brand shadow-[inset_0_0_20px_#f5b40018]"
                        : "border-white/[0.06] text-slate-600"
                    }`}
                  >
                    {isDragTarget ? "⬇ Soltar aqui" : "Sem oportunidades"}
                  </div>
                )}
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
              className="flex w-72 shrink-0 items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-white/[0.08] py-8 text-sm font-medium text-slate-500 transition-all hover:border-brand/40 hover:bg-brand/[0.04] hover:text-brand"
            >
              <Plus className="h-4 w-4" />
              Nova coluna
            </button>
          ))}
      </div>
      {stageError && <p className="mt-2 text-xs text-red-400">{stageError}</p>}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-white/[0.08] bg-slate-900 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
              <h3 className="text-base font-semibold tracking-tight text-white">{selected.title}</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto px-6 py-5">
              <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 p-3.5 text-xs text-slate-400">
                <p className="mb-1.5 text-sm font-semibold text-slate-100">{selected.contact.companyName}</p>
                <p className="flex items-center gap-1.5">
                  <User className="h-3 w-3" /> {selected.contact.name}
                </p>
                {selected.contact.email && (
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> {selected.contact.email}
                  </p>
                )}
                {selected.contact.phone && (
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> {selected.contact.phone}
                  </p>
                )}
              </div>

              {!selectedCanManage && (
                <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
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
                    className="flex-1 rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink shadow-[0_0_16px_#f5b40030] transition hover:bg-brand-hover hover:shadow-[0_0_20px_#f5b40050] disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={deleteOpportunity}
                    className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-medium text-slate-400 transition hover:border-red-500/40 hover:text-red-400"
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
