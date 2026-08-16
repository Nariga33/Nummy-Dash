"use client";

import { useEffect, useState } from "react";

type IntegrationsStatus = {
  api4com: {
    enabled: boolean;
    lastSyncAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
    apiKeyMasked: string | null;
    baseUrl: string;
  };
  whatsapp: {
    enabled: boolean;
    lastSyncAt: string | null;
    lastStatus: string | null;
    lastError: string | null;
    webhookTokenMasked: string | null;
    webhookUrl: string;
  };
};

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  const ok = status === "ok";
  return (
    <span className={`text-xs ${ok ? "text-emerald-400" : "text-red-400"}`}>
      {ok ? "ok" : "erro"}
    </span>
  );
}

export function IntegrationsManager() {
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [origin, setOrigin] = useState("");

  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [savingApi4com, setSavingApi4com] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [webhookToken, setWebhookToken] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);

  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualCount, setManualCount] = useState(0);
  const [manualDirection, setManualDirection] = useState<"SENT" | "RECEIVED">("SENT");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  async function loadStatus() {
    const res = await fetch("/api/settings/integrations");
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load reuses the same loader called after mutations
    loadStatus();
    setOrigin(window.location.origin);
  }, []);

  async function saveApi4com(e: React.FormEvent) {
    e.preventDefault();
    setSavingApi4com(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "api4com", apiKey, baseUrl }),
      });
      if (res.ok) {
        setApiKey("");
        await loadStatus();
      }
    } finally {
      setSavingApi4com(false);
    }
  }

  async function testConnection() {
    setTestResult(null);
    const res = await fetch("/api/settings/integrations/test-api4com", { method: "POST" });
    const json = await res.json();
    setTestResult({ ok: res.ok, message: res.ok ? "Conexão OK." : json.error ?? "Falha ao conectar." });
  }

  async function syncNow() {
    setSyncResult("Sincronizando...");
    const res = await fetch("/api/sync/api4com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysBack: 30 }),
    });
    const json = await res.json();
    setSyncResult(
      res.ok
        ? `${json.fetched} chamadas processadas (${json.created} novas, ${json.updated} atualizadas).`
        : json.error ?? "Erro ao sincronizar."
    );
    await loadStatus();
  }

  async function saveWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    setSavingWhatsapp(true);
    try {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "whatsapp", webhookToken }),
      });
      if (res.ok) {
        setWebhookToken("");
        await loadStatus();
      }
    } finally {
      setSavingWhatsapp(false);
    }
  }

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setManualSaving(true);
    setManualMessage(null);
    try {
      const res = await fetch("/api/whatsapp/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: manualDate, count: manualCount, direction: manualDirection }),
      });
      const json = await res.json();
      setManualMessage(res.ok ? `${json.created} mensagens registradas em ${manualDate}.` : json.error);
      if (res.ok) setManualCount(0);
    } finally {
      setManualSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">API4COM · Ligações</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Chave atual: {status?.api4com.apiKeyMasked ?? "não configurada"} · última sincronização:{" "}
              {status?.api4com.lastSyncAt ? new Date(status.api4com.lastSyncAt).toLocaleString("pt-BR") : "nunca"}{" "}
              <StatusPill status={status?.api4com.lastStatus ?? null} />
            </p>
            {status?.api4com.lastError && (
              <p className="mt-1 text-xs text-red-400">{status.api4com.lastError}</p>
            )}
          </div>
        </div>

        <form onSubmit={saveApi4com} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            required
            placeholder="Chave da API (API Key)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand sm:col-span-2"
          />
          <input
            placeholder="Base URL (opcional, padrão: api.api4com.com/v1)"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
          />
          <button
            type="submit"
            disabled={savingApi4com}
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
          >
            {savingApi4com ? "Salvando..." : "Salvar chave"}
          </button>
          <button
            type="button"
            onClick={testConnection}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500"
          >
            Testar conexão
          </button>
          <button
            type="button"
            onClick={syncNow}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500"
          >
            Sincronizar agora
          </button>
        </form>

        {testResult && (
          <p className={`mt-3 text-xs ${testResult.ok ? "text-emerald-400" : "text-red-400"}`}>{testResult.message}</p>
        )}
        {syncResult && <p className="mt-2 text-xs text-slate-400">{syncResult}</p>}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-200">WhatsApp · Mensagens</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Token atual: {status?.whatsapp.webhookTokenMasked ?? "não configurado"} · última atividade:{" "}
            {status?.whatsapp.lastSyncAt ? new Date(status.whatsapp.lastSyncAt).toLocaleString("pt-BR") : "nunca"}{" "}
            <StatusPill status={status?.whatsapp.lastStatus ?? null} />
          </p>
        </div>

        <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
          <p className="mb-1 font-medium text-slate-300">Como conectar</p>
          <p>
            Configure a plataforma de WhatsApp usada pela operação (Evolution API, Z-API, WPPConnect, Meta Cloud API
            etc.) para enviar um webhook a cada mensagem para:
          </p>
          <code className="mt-1 block break-all rounded bg-slate-900 px-2 py-1 text-brand">
            POST {origin}
            {status?.whatsapp.webhookUrl}
          </code>
          <p className="mt-1">
            Com o header <code className="text-slate-300">x-webhook-token</code> igual ao token definido abaixo.
          </p>
        </div>

        <form onSubmit={saveWhatsapp} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            required
            placeholder="Token do webhook"
            value={webhookToken}
            onChange={(e) => setWebhookToken(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand sm:col-span-2"
          />
          <button
            type="submit"
            disabled={savingWhatsapp}
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-brand-ink transition hover:bg-brand-hover disabled:opacity-60"
          >
            {savingWhatsapp ? "Salvando..." : "Salvar token"}
          </button>
        </form>

        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="mb-2 text-xs font-medium text-slate-300">
            Lançamento manual (enquanto nenhuma API estiver conectada)
          </p>
          <form onSubmit={submitManual} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="date"
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            />
            <input
              type="number"
              min={1}
              placeholder="Quantidade"
              value={manualCount || ""}
              onChange={(e) => setManualCount(Number(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-brand"
            />
            <select
              value={manualDirection}
              onChange={(e) => setManualDirection(e.target.value as "SENT" | "RECEIVED")}
              className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand"
            >
              <option value="SENT">Enviadas</option>
              <option value="RECEIVED">Recebidas</option>
            </select>
            <button
              type="submit"
              disabled={manualSaving || manualCount < 1}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 disabled:opacity-60"
            >
              {manualSaving ? "Salvando..." : "Registrar"}
            </button>
          </form>
          {manualMessage && <p className="mt-2 text-xs text-slate-400">{manualMessage}</p>}
        </div>
      </section>
    </div>
  );
}
