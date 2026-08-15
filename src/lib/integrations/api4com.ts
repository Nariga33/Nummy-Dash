export type { Api4comConfig } from "@/lib/integrations/settings";
import type { Api4comConfig } from "@/lib/integrations/settings";

/**
 * Cliente para a API de voz da API4COM (https://developers.api4com.com).
 *
 * A API4COM é uma API de VOZ (ligações) — ela não tem canal de WhatsApp.
 * Este cliente busca o histórico de chamadas (calls) para alimentar as
 * métricas de "quantidade de ligações" do dashboard.
 *
 * IMPORTANT — ajuste ao plugar a chave real:
 * O formato exato do endpoint de listagem de chamadas (paginação, nomes de
 * campos de status/duração) pode variar por conta/plano. `fetchCallsPage`
 * e `normalizeCall` abaixo são o único lugar que precisa mudar caso a
 * resposta real da API4COM tenha um formato diferente do assumido aqui.
 * Use a página "Integrações" no dashboard (botão "Testar conexão") para
 * validar a resposta bruta assim que a chave for configurada.
 */

export type NormalizedCall = {
  externalId: string;
  direction: "OUTBOUND" | "INBOUND";
  status: string;
  agentName: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  durationSec: number;
  startedAt: Date;
  raw: unknown;
};

const DEFAULT_BASE_URL = "https://api.api4com.com/v1";

export class Api4comApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "Api4comApiError";
  }
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "x-api-key": apiKey,
    Accept: "application/json",
  };
}

/** Faz uma chamada simples de teste para validar a chave de API. */
export async function testApi4comConnection(config: Api4comConfig) {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl.replace(/\/$/, "")}/calls?limit=1`;

  const res = await fetch(url, { headers: buildHeaders(config.apiKey) });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // resposta não era JSON, mantém texto bruto
  }

  if (!res.ok) {
    throw new Api4comApiError(`API4COM respondeu ${res.status}`, res.status, body);
  }

  return { status: res.status, body };
}

type FetchCallsParams = {
  config: Api4comConfig;
  startDate: Date;
  endDate: Date;
  page?: number;
  pageSize?: number;
};

/** Busca uma página de chamadas dentro do período informado. */
async function fetchCallsPage({
  config,
  startDate,
  endDate,
  page = 1,
  pageSize = 100,
}: FetchCallsParams): Promise<{ items: unknown[]; hasMore: boolean }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const params = new URLSearchParams({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    page: String(page),
    limit: String(pageSize),
  });
  const url = `${baseUrl.replace(/\/$/, "")}/calls?${params.toString()}`;

  const res = await fetch(url, { headers: buildHeaders(config.apiKey) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Api4comApiError(`API4COM respondeu ${res.status} ao listar chamadas`, res.status, body);
  }

  const data = await res.json();
  const items: unknown[] = Array.isArray(data) ? data : (data.items ?? data.data ?? data.results ?? []);
  const hasMore = Boolean(data?.hasMore ?? data?.hasNextPage ?? items.length === pageSize);

  return { items, hasMore };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
}

/** Normaliza um registro cru da API4COM para o formato salvo no banco. */
export function normalizeCall(raw: unknown): NormalizedCall | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const externalId = pickString(obj, ["id", "callId", "uuid", "_id"]);
  const startedAtRaw = pickString(obj, ["startedAt", "createdAt", "startTime", "date"]);
  if (!externalId || !startedAtRaw) return null;

  const directionRaw = (pickString(obj, ["direction", "type"]) ?? "outbound").toLowerCase();
  const direction: "OUTBOUND" | "INBOUND" = directionRaw.includes("in") ? "INBOUND" : "OUTBOUND";

  const status = (pickString(obj, ["status", "state", "hangupCause"]) ?? "UNKNOWN").toUpperCase();

  return {
    externalId,
    direction,
    status,
    agentName: pickString(obj, ["agentName", "userName", "extensionName", "agent"]),
    fromNumber: pickString(obj, ["from", "fromNumber", "caller", "source"]),
    toNumber: pickString(obj, ["to", "toNumber", "callee", "destination"]),
    durationSec: pickNumber(obj, ["duration", "durationSec", "billsec", "talkTime"]),
    startedAt: new Date(startedAtRaw),
    raw,
  };
}

/** Busca todas as chamadas do período (paginado) já normalizadas. */
export async function fetchAllCalls(params: {
  config: Api4comConfig;
  startDate: Date;
  endDate: Date;
  maxPages?: number;
}): Promise<NormalizedCall[]> {
  const { config, startDate, endDate, maxPages = 50 } = params;
  const calls: NormalizedCall[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= maxPages) {
    const { items, hasMore: more } = await fetchCallsPage({ config, startDate, endDate, page });
    for (const item of items) {
      const normalized = normalizeCall(item);
      if (normalized) calls.push(normalized);
    }
    hasMore = more && items.length > 0;
    page += 1;
  }

  return calls;
}
