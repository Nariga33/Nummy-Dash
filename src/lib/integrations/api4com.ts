export type { Api4comConfig } from "@/lib/integrations/settings";
import type { Api4comConfig } from "@/lib/integrations/settings";

/**
 * Cliente para a API de voz da API4COM (https://developers.api4com.com),
 * construída em LoopBack (por isso o parâmetro `filter` no formato
 * stringified JSON documentado em loopback.io/doc/en/lb3/Querying-data).
 *
 * Endpoint confirmado na doc oficial (operations/Call.find.html):
 *   GET https://api.api4com.com/api/v1/calls?page=<n>&filter=<json>
 * Resposta: { data: [...], meta: { totalItemCount, totalPageCount, ... } }
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

const DEFAULT_BASE_URL = "https://api.api4com.com/api/v1";

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

function buildUrl(baseUrl: string, path: string, apiKey: string, extraParams: Record<string, string> = {}) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}${path}`);
  url.searchParams.set("access_token", apiKey);
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }
  return url;
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
}

async function parseResponseBody(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Faz uma chamada simples de teste para validar a chave de API. */
export async function testApi4comConnection(config: Api4comConfig) {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = buildUrl(baseUrl, "/calls", config.apiKey, { page: "1" });

  const res = await fetch(url, { headers: buildHeaders(config.apiKey) });
  const body = await parseResponseBody(res);

  if (!res.ok) {
    throw new Api4comApiError(`API4COM respondeu ${res.status}`, res.status, body);
  }
  if (typeof body === "string") {
    throw new Api4comApiError(
      "API4COM respondeu com HTML em vez de JSON — a Base URL configurada provavelmente está incorreta.",
      res.status,
      body.slice(0, 300)
    );
  }

  return { status: res.status, body };
}

type FetchCallsParams = {
  config: Api4comConfig;
  startDate: Date;
  endDate: Date;
  page?: number;
};

type Api4comListResponse = {
  data?: unknown[];
  meta?: {
    totalPageCount?: number;
    currentPage?: number;
    nextPage?: number | null;
  };
};

/** Busca uma página de chamadas dentro do período informado. */
async function fetchCallsPage({
  config,
  startDate,
  endDate,
  page = 1,
}: FetchCallsParams): Promise<{ items: unknown[]; hasMore: boolean }> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const filter = JSON.stringify({
    where: { started_at: { between: [startDate.toISOString(), endDate.toISOString()] } },
    order: "started_at DESC",
  });
  const url = buildUrl(baseUrl, "/calls", config.apiKey, { page: String(page), filter });

  const res = await fetch(url, { headers: buildHeaders(config.apiKey) });
  const body = await parseResponseBody(res);

  if (!res.ok) {
    throw new Api4comApiError(`API4COM respondeu ${res.status} ao listar chamadas`, res.status, body);
  }
  if (typeof body === "string") {
    throw new Api4comApiError(
      "API4COM respondeu com HTML em vez de JSON — verifique a Base URL configurada.",
      res.status,
      body.slice(0, 300)
    );
  }

  const data = body as Api4comListResponse;
  const items = Array.isArray(data.data) ? data.data : [];
  const totalPages = data.meta?.totalPageCount ?? 1;
  const currentPage = data.meta?.currentPage ?? page;
  const hasMore = Boolean(data.meta?.nextPage) || currentPage < totalPages;

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

const ANSWERED_HANGUP_CAUSES = new Set(["NORMAL_CLEARING"]);

/** Normaliza um registro cru da API4COM (formato /api/v1/calls) para o banco. */
export function normalizeCall(raw: unknown): NormalizedCall | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const externalId = pickString(obj, ["id"]);
  const startedAtRaw = pickString(obj, ["started_at"]);
  if (!externalId || !startedAtRaw) return null;

  const callType = (pickString(obj, ["call_type"]) ?? "").toLowerCase();
  const direction: "OUTBOUND" | "INBOUND" = callType.includes("in") ? "INBOUND" : "OUTBOUND";

  const durationSec = pickNumber(obj, ["duration"]);
  const hangupCause = pickString(obj, ["hangup_cause"]);
  const status = durationSec > 0 || (hangupCause && ANSWERED_HANGUP_CAUSES.has(hangupCause.toUpperCase()))
    ? "ANSWERED"
    : (hangupCause ?? "UNKNOWN").toUpperCase();

  const firstName = pickString(obj, ["first_name"]);
  const lastName = pickString(obj, ["last_name"]);
  const agentName = [firstName, lastName].filter(Boolean).join(" ") || pickString(obj, ["email"]);

  return {
    externalId,
    direction,
    status,
    agentName,
    fromNumber: pickString(obj, ["from"]),
    toNumber: pickString(obj, ["to"]),
    durationSec,
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
