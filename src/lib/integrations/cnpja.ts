export type { CnpjaConfig } from "@/lib/integrations/settings";
import type { CnpjaConfig } from "@/lib/integrations/settings";

/**
 * Cliente para a API do CNPJá (cnpja.com) — consulta de CNPJ com dados da
 * Receita Federal (situação cadastral, sócios).
 *
 * IMPORTANTE: diferente do cliente Apollo, este NÃO foi validado com uma
 * chamada real — o domínio api.cnpja.com está bloqueado pela política de
 * rede do ambiente onde isso foi construído, então o endpoint/formato aqui
 * é a melhor suposição com base em documentação pública conhecida do CNPJá,
 * não uma chamada testada. Use "Testar conexão" em Integrações assim que
 * a chave estiver configurada em produção — se der erro, o corpo da
 * resposta real do CNPJá aparece na mensagem (ver apolloError-style em
 * apollo.ts) e dá pra ajustar buildUrl/normalizeCnpjLookup a partir disso.
 *
 * Também: essa API (no plano testado) só resolve CNPJ → dados. Não busca
 * empresa a partir de nome de sócio nem de nome de empresa — por isso o
 * fluxo aqui é sempre "usuário informa o CNPJ", nunca uma busca automática.
 */

const DEFAULT_BASE_URL = "https://api.cnpja.com";

export class CnpjaApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "CnpjaApiError";
  }
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: apiKey,
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

function extractErrorDetail(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const direct = obj["message"] ?? obj["error"];
  return typeof direct === "string" ? direct : null;
}

/** Remove tudo que não for dígito — aceita CNPJ formatado ("00.000.000/0001-00") ou não. */
export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

export type CnpjPartner = {
  name: string;
  role: string | null;
};

export type NormalizedCnpjLookup = {
  cnpj: string;
  name: string | null;
  tradeName: string | null;
  status: string | null;
  statusDate: string | null;
  founded: string | null;
  mainActivity: string | null;
  partners: CnpjPartner[];
  raw: unknown;
};

/** Consulta um CNPJ. Lança CnpjaApiError com o corpo real em caso de erro. */
export async function lookupCnpj(config: CnpjaConfig, cnpjRaw: string): Promise<NormalizedCnpjLookup> {
  const cnpj = cleanCnpj(cnpjRaw);
  if (cnpj.length !== 14) {
    throw new CnpjaApiError("CNPJ inválido — precisa ter 14 dígitos.");
  }

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/office/${cnpj}`, {
    headers: buildHeaders(config.apiKey),
  });
  const body = await parseResponseBody(res);

  if (!res.ok) {
    const detail = extractErrorDetail(body);
    throw new CnpjaApiError(`CNPJá respondeu ${res.status}${detail ? `: ${detail}` : ""}`, res.status, body);
  }
  if (typeof body === "string") {
    throw new CnpjaApiError(
      "CNPJá respondeu com HTML em vez de JSON — a Base URL configurada provavelmente está incorreta.",
      res.status,
      body.slice(0, 300)
    );
  }

  const normalized = normalizeCnpjLookup(body, cnpj);
  if (!normalized) {
    throw new CnpjaApiError("CNPJá respondeu OK mas em formato inesperado — veja o log do servidor.", res.status, body);
  }
  return normalized;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function pickNested(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Normaliza a resposta crua do CNPJá. Formato baseado na doc pública
 * conhecida do endpoint /office/{cnpj} — ajustar aqui se divergir da
 * resposta real (nunca testada nesta sessão, ver aviso no topo do arquivo).
 */
export function normalizeCnpjLookup(raw: unknown, cnpj: string): NormalizedCnpjLookup | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const companyName = pickNested(obj, ["company", "name"]);
  const name = (typeof companyName === "string" ? companyName : null) ?? pickString(obj, ["name", "razao_social"]);

  const statusObj = obj["status"];
  const status =
    (statusObj && typeof statusObj === "object" ? pickString(statusObj as Record<string, unknown>, ["text"]) : null) ??
    pickString(obj, ["situacao", "status"]);

  const members = pickNested(obj, ["company", "members"]);
  const partners: CnpjPartner[] = Array.isArray(members)
    ? members
        .map((m): CnpjPartner | null => {
          if (!m || typeof m !== "object") return null;
          const mObj = m as Record<string, unknown>;
          const personName = pickNested(mObj, ["person", "name"]);
          const roleText = pickNested(mObj, ["role", "text"]);
          const partnerName = typeof personName === "string" ? personName : null;
          if (!partnerName) return null;
          return { name: partnerName, role: typeof roleText === "string" ? roleText : null };
        })
        .filter((p): p is CnpjPartner => p !== null)
    : [];

  const mainActivityObj = obj["mainActivity"];
  const mainActivity =
    mainActivityObj && typeof mainActivityObj === "object"
      ? pickString(mainActivityObj as Record<string, unknown>, ["text"])
      : null;

  return {
    cnpj,
    name,
    tradeName: pickString(obj, ["alias", "nome_fantasia"]),
    status,
    statusDate: pickString(obj, ["statusDate", "data_situacao"]),
    founded: pickString(obj, ["founded", "data_abertura"]),
    mainActivity,
    partners,
    raw,
  };
}
