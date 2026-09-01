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

/** Extrai a mensagem de erro do corpo de uma resposta não-ok do Apollo, quando houver. */
function extractErrorDetail(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const direct = obj["error"] ?? obj["message"] ?? obj["error_message"];
  if (typeof direct === "string") return direct;
  if (Array.isArray(obj["errors"])) {
    return obj["errors"]
      .map((e) => (typeof e === "string" ? e : JSON.stringify(e)))
      .join("; ");
  }
  return null;
}

function apolloError(action: string, res: Response, body: unknown): ApolloApiError {
  const detail = extractErrorDetail(body);
  return new ApolloApiError(
    `Apollo respondeu ${res.status} ao ${action}${detail ? `: ${detail}` : ""}`,
    res.status,
    body
  );
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

/**
 * Mapa de cargos de decisor pra busca de pessoas (person_titles), agrupado por
 * papel. Cobre desde quem decide (sócio/diretor) até quem opera o dia a dia
 * (analista/vendedor) — em empresa pequena o dono às vezes É o vendedor.
 */
export const DECISION_MAKER_TITLE_GROUPS = [
  {
    label: "Dono / Sócio",
    titles: ["Sócio", "Fundador", "Co-fundador", "CEO", "Proprietário"],
  },
  {
    label: "Diretoria",
    titles: ["Diretor", "Diretor Comercial", "Diretor de Marketing", "Diretor de E-commerce"],
  },
  {
    label: "Gerência",
    titles: ["Gerente Comercial", "Gerente de E-commerce", "Gerente de Marketing", "Gerente de Vendas"],
  },
  {
    label: "Operação",
    titles: ["Coordenador de E-commerce", "Analista de E-commerce", "Analista de Marketing", "Vendedor"],
  },
] as const;

/**
 * Plataformas de carrinho/e-commerce reconhecidas, mapeadas para o technology_uid
 * usado pelo filtro `currently_using_any_of_technology_uids` do Apollo (slugs em
 * snake_case).
 *
 * Slugs CONFIRMADOS em busca real (2026-09-01, Brasil + 1-50 funcionários — o
 * Apollo devolveu um display_name capitalizado pra eles, sinal de que o slug foi
 * reconhecido): shopify, loja_integrada, vtex, wake_commerce, linx_commerce, vnda,
 * cartpanda.
 *
 * Slugs NÃO reconhecidos na mesma busca (vieram com display_name igual ao slug em
 * minúsculo, sinal de que o Apollo não achou correspondência): nuvemshop,
 * tray_commerce, yampi, woocommerce — inclusive woocommerce, o que é estranho pra
 * uma plataforma tão grande, então o slug real provavelmente é outro (candidatos:
 * "woo_commerce", "wordpress_woocommerce"; Nuvemshop é vendida internacionalmente
 * como "Tienda Nube", então o slug pode ser "tienda_nube" ou "tiendanube"). Os
 * demais (Shopify Plus, Magento, BigCommerce, Wix, Salesforce Commerce Cloud,
 * OpenCart, PrestaShop) ainda não foram testados nesta busca. Trate os marcados
 * "não confirmado" como chute e valide contra o technology_names de um resultado
 * real antes de confiar neles pra excluir empresas.
 *
 * Mesmo os slugs confirmados tiveram falso-positivo na prática (empresas sem
 * carrinho nenhum apareceram no resultado) — a detecção de tecnologia do Apollo
 * não é garantia de e-commerce ativo, é sinal pra priorizar. Por isso a lista
 * volta com status "Novo" e passa pelo funil manual (Contatado/Qualificado/
 * Descartado) em vez de já vir pré-qualificada.
 */
export const CART_PLATFORM_TECH_UIDS: Record<string, string> = {
  Shopify: "shopify",
  "Shopify Plus": "shopify_plus", // não confirmado
  Nuvemshop: "nuvemshop", // não reconhecido pelo Apollo — tentar "tienda_nube"
  "Loja Integrada": "loja_integrada",
  VTEX: "vtex",
  "Tray Commerce": "tray_commerce", // não reconhecido pelo Apollo — tentar "tray"
  WooCommerce: "woocommerce", // não reconhecido pelo Apollo — tentar "woo_commerce"
  Magento: "magento", // não confirmado
  BigCommerce: "bigcommerce", // não confirmado
  "Wake Commerce": "wake_commerce",
  "Linx Commerce": "linx_commerce",
  Vnda: "vnda",
  Yampi: "yampi", // não reconhecido pelo Apollo nesta busca
  "Wix Stores": "wix", // não confirmado
  "Salesforce Commerce Cloud": "salesforce_commerce_cloud", // não confirmado
  OpenCart: "opencart", // não confirmado
  PrestaShop: "prestashop", // não confirmado
  Cartpanda: "cartpanda"
};

export const CART_PLATFORMS = Object.keys(CART_PLATFORM_TECH_UIDS) as (keyof typeof CART_PLATFORM_TECH_UIDS)[];

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
    throw apolloError("testar a conexão", res, body);
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
  if (technologies.length > 0) {
    body.currently_using_any_of_technology_uids = technologies.map(
      (t) => CART_PLATFORM_TECH_UIDS[t] ?? t.toLowerCase().replace(/[\s.]+/g, "_")
    );
  }
  if (locations.length > 0) body.organization_locations = locations;
  if (keywords) body.q_organization_name = keywords;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/mixed_companies/search`, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
  });
  const parsed = await parseResponseBody(res);

  if (!res.ok) {
    throw apolloError("buscar empresas", res, parsed);
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

export type NormalizedPerson = {
  apolloPersonId: string;
  name: string;
  title: string | null;
  seniority: string | null;
  linkedinUrl: string | null;
  organizationApolloId: string | null;
  organizationName: string | null;
  email: string | null;
  raw: unknown;
};

export type SearchPeopleParams = {
  config: ApolloConfig;
  organizationApolloIds?: string[];
  titles?: string[];
  keywords?: string;
  seniorities?: string[];
  page?: number;
  perPage?: number;
};

type ApolloPeopleSearchResponse = {
  people?: unknown[];
  contacts?: unknown[];
  pagination?: { total_entries?: number; total_pages?: number };
};

/**
 * Busca decisores (pessoas) por cargo e/ou nome, opcionalmente restrita às
 * empresas informadas. Nunca traz telefone — a busca de pessoas do Apollo não
 * devolve contato direto, só o perfil (ver revealPersonPhone).
 */
export async function searchPeoplePage(
  params: SearchPeopleParams
): Promise<{ items: unknown[]; totalEntries: number; totalPages: number }> {
  const { config, organizationApolloIds = [], titles = [], keywords, seniorities = [], page = 1, perPage = 25 } =
    params;
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const body: Record<string, unknown> = { page, per_page: perPage };
  if (organizationApolloIds.length > 0) body.organization_ids = organizationApolloIds;
  if (titles.length > 0) body.person_titles = titles;
  if (keywords) body.q_keywords = keywords;
  if (seniorities.length > 0) body.person_seniorities = seniorities;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/mixed_people/search`, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify(body),
  });
  const parsed = await parseResponseBody(res);

  if (!res.ok) {
    throw apolloError("buscar pessoas", res, parsed);
  }
  if (typeof parsed === "string") {
    throw new ApolloApiError(
      "Apollo respondeu com HTML em vez de JSON — verifique a Base URL configurada.",
      res.status,
      parsed.slice(0, 300)
    );
  }

  const data = parsed as ApolloPeopleSearchResponse;
  const items = data.people ?? data.contacts ?? [];
  return {
    items,
    totalEntries: data.pagination?.total_entries ?? items.length,
    totalPages: data.pagination?.total_pages ?? 1,
  };
}

/**
 * Normaliza uma pessoa crua do Apollo. Único lugar a ajustar se os nomes de
 * campo reais divergirem — sobrenome pode vir mascarado dependendo do plano
 * (ex: "Silva" vira "S."), isso é esperado e só é resolvido revelando o contato.
 */
export function normalizePerson(raw: unknown): NormalizedPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const apolloPersonId = pickString(obj, ["id"]);
  const firstName = pickString(obj, ["first_name"]);
  const lastName = pickString(obj, ["last_name"]);
  const name = pickString(obj, ["name"]) ?? [firstName, lastName].filter(Boolean).join(" ");
  if (!apolloPersonId || !name) return null;

  const org = obj["organization"];
  const orgObj = org && typeof org === "object" ? (org as Record<string, unknown>) : {};

  return {
    apolloPersonId,
    name,
    title: pickString(obj, ["title"]),
    seniority: pickString(obj, ["seniority"]),
    linkedinUrl: pickString(obj, ["linkedin_url"]),
    organizationApolloId: pickString(obj, ["organization_id"]) ?? pickString(orgObj, ["id"]),
    organizationName: pickString(obj, ["organization_name"]) ?? pickString(orgObj, ["name"]),
    email: pickString(obj, ["email"]),
    raw,
  };
}

export type RequestPhoneRevealParams = {
  config: ApolloConfig;
  apolloPersonId: string;
  webhookUrl: string;
};

/**
 * Pede a revelação assíncrona do telefone de uma pessoa (People Match com
 * reveal_phone_number). Segundo a documentação do Apollo, essa chamada NÃO
 * devolve o número na hora — ela dispara a verificação e o Apollo envia o
 * resultado depois via POST em `webhookUrl` (normalmente poucos segundos a
 * poucos minutos depois). Consome crédito Apollo por revelação bem-sucedida.
 *
 * Este fluxo (o parâmetro `webhook_url` e o formato do callback) segue a
 * documentação pública do Apollo mas NÃO foi testado com uma chamada real
 * nesta sessão — diferente do restante do cliente Apollo, que foi validado.
 * Confira o payload que chega em /api/webhooks/apollo-phone (ele é logado)
 * na primeira revelação real e ajuste normalizePhoneWebhook se precisar.
 */
export async function requestPhoneReveal(
  params: RequestPhoneRevealParams
): Promise<{ requestId: string | null; raw: unknown }> {
  const { config, apolloPersonId, webhookUrl } = params;
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/people/match`, {
    method: "POST",
    headers: buildHeaders(config.apiKey),
    body: JSON.stringify({
      id: apolloPersonId,
      reveal_phone_number: true,
      webhook_url: webhookUrl,
    }),
  });
  const parsed = await parseResponseBody(res);

  if (!res.ok) {
    throw apolloError("pedir o telefone", res, parsed);
  }
  if (typeof parsed === "string") {
    throw new ApolloApiError(
      "Apollo respondeu com HTML em vez de JSON — verifique a Base URL configurada.",
      res.status,
      parsed.slice(0, 300)
    );
  }

  const obj = parsed as Record<string, unknown>;
  const requestId = pickString(obj, ["request_id", "id"]);
  return { requestId, raw: parsed };
}

/**
 * Normaliza o payload que o Apollo envia ao webhook depois de revelar um
 * telefone. Formato não confirmado por chamada real — ajuste as chaves
 * procuradas assim que um payload real chegar em produção (fica no campo
 * `raw` da requisição pra inspeção).
 */
export function normalizePhoneWebhook(raw: unknown): { requestId: string | null; phone: string | null } {
  if (!raw || typeof raw !== "object") return { requestId: null, phone: null };
  const obj = raw as Record<string, unknown>;

  const requestId = pickString(obj, ["request_id", "id"]);

  const phoneNumbers = obj["phone_numbers"];
  let phone: string | null = null;
  if (Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
    const first = phoneNumbers[0];
    if (typeof first === "string") phone = first;
    else if (first && typeof first === "object") {
      phone = pickString(first as Record<string, unknown>, ["sanitized_number", "raw_number", "number"]);
    }
  }
  phone = phone ?? pickString(obj, ["phone_number", "phone"]);

  return { requestId, phone };
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
