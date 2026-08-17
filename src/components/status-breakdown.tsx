const STATUS_LABELS: Record<string, string> = {
  ANSWERED: "Atendida",
  COMPLETED: "Atendida",
  SUCCESS: "Atendida",
  NO_ANSWER: "Não atendida",
  NOANSWER: "Não atendida",
  BUSY: "Ocupado",
  USER_BUSY: "Ocupado",
  FAILED: "Falhou",
  UNKNOWN: "Desconhecido",
  MANUAL: "Lançamento manual",
  // Causas de desligamento reais da API4COM (padrão FreeSWITCH)
  ORIGINATOR_CANCEL: "Cancelada por quem ligou",
  UNALLOCATED_NUMBER: "Número inexistente",
  NO_USER_RESPONSE: "Não atendida",
  NO_ROUTE_DESTINATION: "Sem rota/destino",
  CALL_REJECTED: "Rejeitada",
  NORMAL_TEMPORARY_FAILURE: "Falha temporária",
  RECOVERY_ON_TIMER_EXPIRE: "Tempo esgotado",
};

export function StatusBreakdown({ data }: { data: { status: string; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return <p className="text-sm text-slate-500">Sem chamadas no período selecionado.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((item) => {
        const pct = Math.round((item.count / total) * 100);
        return (
          <div key={item.status}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-300">{STATUS_LABELS[item.status] ?? item.status}</span>
              <span className="tabular-nums text-slate-500">
                {item.count} ({pct}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-[#3987e5]"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
