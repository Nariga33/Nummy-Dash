export type { ApolloConfig } from "@/lib/integrations/settings";
import type { ApolloConfig } from "@/lib/integrations/settings";

/**
 * Cliente para a API de Organization Search do Apollo.io
 * (docs.apollo.io — endpoint /api/v1/mixed_companies/search).
 *
 * O problema que este cliente existe pra resolver: filtrando direto na UI do
 * Apollo, o resultado tende a vir dominado por empresas grandes — porque é
 * fácil esquecer de marcar as faixas pequenas de funcionários, e o Apollo não
 * seleciona "1,10" por padrão. Aqui as faixas usadas na busca são sempre
 * explícitas (nunca "todas"), então uma faixa pequena marcada de fato entra
 * na query em vez de ser diluída pelas faixas maiores.
 */

const DEFAULT_BASE_URL = "https://api.apollo.io/api/v1";

export class ApolloApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "ApolloApiError";
  }
}

function buildHeaders(apiKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": apiKey,
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

/** Faixas de nº de funcionários no formato exigido pelo Apollo ("min,max"). */
export const EMPLOYEE_RANGES = [
  { value: "1,10", label: "1–10 (micro)" },
  { value: "11,20", label: "11–20" },
  { value: "21,50", label: "21–50" },
  { value: "51,100", label: "51–100" },
  { value: "101,200", label: "101–200" },
  { value: "201,500", label: "201–500" },
  { value: "501,1000", label: "501–1.000" },
  { value: "1001,5000", label: "1.001–5.000 (grande)" },
  { value: "5001,50000", label: "5.001+ (enterprise)" },
] as const;

/** Faixas marcadas por padrão: exatamente a lacuna que o concorrente ignora. */
export const DEFAULT_EMPLOYEE_RANGES = ["1,10", "11,20", "21,50", "51,100"];

/** Plataformas de carrinho/e-commerce reconhecidas nas technologies do Apollo. */
export const CART_PLATFORMS = [
  "Shopify",
  "Shopify Plus",
  "Nuvemshop",
  "Loja Integrada",
  "VTEX",
  "Tray Commerce",
  "Tray",
  "WooCommerce",
  "Magento",
  "BigCommerce",
  "Wake Commerce",
  "Linx Commerce",
  "Vnda",
  "Yampi",
  "Wix Stores",
  "Salesforce Commerce Cloud",
  "OpenCart",
  "PrestaShop",
  "Cartpanda",
] as const;

export type NormalizedOrganization = {
  apolloOrgId: string;
  name: string;
  domain: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  employeeCount: number | null;
  employeeRange: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  technologies: string[];
  ecommercePlatforms: string[];
  raw: unknown;
};

/** Faz uma chamada simples de teste (1 resultado) para validar a chave de API. */
export async function testApolloConnection(config: ApolloConfig) {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/mixed_companies/search`, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify({ page: 1, per_page: 1 }),
  });
  const body = await parseResponseBody(res);

  if (!res.ok) {
    throw new ApolloApiError(`Apollo respondeu ${res.status}`, res.status, body);
  }
  if (typeof body === "string") {
    throw new ApolloApiError(
      "Apollo respondeu com HTML em vez de JSON — a Base URL configurada provavelmente está incorreta.",
      res.status,
      body.slice(0, 300)
    );
  }

  return { status: res.status, body };
}

export type SearchOrganizationsParams = {
  config: ApolloConfig;
  employeeRanges: string[];
  technologies: string[];
  locations: string[];
  keywords?: string;
  page?: number;
  perPage?: number;
};

type ApolloSearchResponse = {
  organizations?: unknown[];
  accounts?: unknown[];
  pagination?: {
    page?: number;
    per_page?: number;
    total_entries?: number;
    total_pages?: number;
  };
};

/** Busca uma página de organizações. As faixas de funcionários nunca são omitidas. */
export async function searchOrganizationsPage(
  params: SearchOrganizationsParams
): Promise<{ items: unknown[]; totalEntries: number; totalPages: number }> {
  const { config, employeeRanges, technologies, locations, keywords, page = 1, perPage = 50 } = params;
  if (employeeRanges.length === 0) {
    throw new ApolloApiError("Selecione ao menos uma faixa de nº de funcionários antes de buscar.");
  }

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const body: Record<string, unknown> = {
    page,
    per_page: perPage,
    organization_num_employees_ranges: employeeRanges,
  };
  if (technologies.length > 0) body.q_organization_keyword_tags = technologies;
  if (locations.length > 0) body.organization_locations = locations;
  if (keywords) body.q_organization_name = keywords;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/mixed_companies/search`, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
  });
  const parsed = await parseResponseBody(res);

  if (!res.ok) {
    throw new ApolloApiError(`Apollo respondeu ${res.status} ao buscar empresas`, res.status, parsed);
  }
  if (typeof parsed === "string") {
    throw new ApolloApiError(
      "Apollo respondeu com HTML em vez de JSON — verifique a Base URL configurada.",
      res.status,
      parsed.slice(0, 300)
    );
  }

  const data = parsed as ApolloSearchResponse;
  const items = data.organizations ?? data.accounts ?? [];
  return {
    items,
    totalEntries: data.pagination?.total_entries ?? items.length,
    totalPages: data.pagination?.total_pages ?? 1,
  };
}

/** Busca todas as páginas até `maxPages`, já normalizadas. */
export async function searchAllOrganizations(
  params: Omit<SearchOrganizationsParams, "page"> & { maxPages?: number }
): Promise<{ organizations: NormalizedOrganization[]; totalEntries: number }> {
  const { maxPages = 5, ...rest } = params;
  const organizations: NormalizedOrganization[] = [];
  let page = 1;
  let totalPages = 1;
  let totalEntries = 0;

  do {
    const result = await searchOrganizationsPage({ ...rest, page });
    totalPages = result.totalPages;
    totalEntries = result.totalEntries;
    for (const item of result.items) {
      const normalized = normalizeOrganization(item);
      if (normalized) organizations.push(normalized);
    }
    page += 1;
  } while (page <= totalPages && page <= maxPages);

  return { organizations, totalEntries };
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function pickStringArray(obj: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = obj[key];
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

/**
 * Normaliza uma organização crua do Apollo para o formato salvo no banco.
 * Único lugar a ajustar se os nomes de campo reais divergirem do esperado —
 * use "Testar conexão" em Integrações para inspecionar a resposta bruta.
 */
export function normalizeOrganization(raw: unknown): NormalizedOrganization | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const apolloOrgId = pickString(obj, ["id", "organization_id"]);
  const name = pickString(obj, ["name"]);
  if (!apolloOrgId || !name) return null;

  const technologies = pickStringArray(obj, ["technology_names", "technologies"]);
  const technologiesLower = technologies.map((t) => t.toLowerCase());
  const ecommercePlatforms = CART_PLATFORMS.filter((platform) =>
    technologiesLower.includes(platform.toLowerCase())
  );

  const employeeCount = pickNumber(obj, ["estimated_num_employees", "num_employees"]);
  const employeeRange = EMPLOYEE_RANGES.find(({ value }) => {
    if (employeeCount == null) return false;
    const [min, max] = value.split(",").map(Number);
    return employeeCount >= min && employeeCount <= max;
  })?.value ?? null;

  return {
    apolloOrgId,
    name,
    domain: pickString(obj, ["primary_domain", "domain", "website_url"]),
    linkedinUrl: pickString(obj, ["linkedin_url"]),
    websiteUrl: pickString(obj, ["website_url"]),
    employeeCount,
    employeeRange,
    industry: pickString(obj, ["industry"]),
    city: pickString(obj, ["city"]),
    state: pickString(obj, ["state"]),
    country: pickString(obj, ["country"]),
    technologies,
    ecommercePlatforms,
    raw,
  };
}
