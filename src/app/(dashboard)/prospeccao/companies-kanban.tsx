"use client";

import { useState } from "react";

type KanbanCompany = {
  id: string;
  name: string;
  domain: string | null;
  linkedinUrl: string | null;
  employeeCount: number | null;
  ecommercePlatforms: string[];
  status: "NOVO" | "CONTATADO" | "QUALIFICADO" | "DESCARTADO";
};

const COLUMNS: { status: KanbanCompany["status"]; label: string; accent: string }[] = [
  { status: "NOVO", label: "Novo", accent: "border-t-slate-500" },
  { status: "CONTATADO", label: "Contatado", accent: "border-t-amber-500" },
  { status: "QUALIFICADO", label: "Qualificado", accent: "border-t-emerald-500" },
  { status: "DESCARTADO", label: "Descartado", accent: "border-t-red-500" },
];

function sizeLabel(count: number | null) {
  if (count == null) return "— func.";
  if (count <= 20) return `${count} func. · pequena`;
  return `${count} func.`;
}

export function CompaniesKanban({
  companies,
  onStatusChange,
}: {
  companies: KanbanCompany[];
  onStatusChange: (id: string, status: KanbanCompany["status"]) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanCompany["status"] | null>(null);

  function handleDrop(status: KanbanCompany["status"]) {
    if (draggingId) onStatusChange(draggingId, status);
    setDraggingId(null);
    setDragOverColumn(null);
  }

  return (
    <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = companies.filter((c) => c.status === col.status);
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(col.status);
            }}
            onDragLeave={() => setDragOverColumn((prev) => (prev === col.status ? null : prev))}
            onDrop={() => handleDrop(col.status)}
            className={`flex min-h-[200px] flex-col gap-2 rounded-xl border border-t-2 border-slate-800 bg-slate-900/40 p-3 ${col.accent} ${
              dragOverColumn === col.status ? "ring-2 ring-brand/60" : ""
            }`}
          >
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-300">{col.label}</h3>
              <span className="text-xs text-slate-500">{items.length}</span>
            </div>

            {items.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => setDraggingId(c.id)}
                onDragEnd={() => setDraggingId(null)}
                className={`cursor-grab rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm active:cursor-grabbing ${
                  draggingId === c.id ? "opacity-40" : ""
                }`}
              >
                <p className="font-medium text-slate-100">{c.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{c.domain ?? "—"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                    {sizeLabel(c.employeeCount)}
                  </span>
                </div>
              </div>
            ))}

            {items.length === 0 && <p className="text-xs text-slate-600">Nenhuma empresa aqui.</p>}
          </div>
        );
      })}
    </div>
  );
}
