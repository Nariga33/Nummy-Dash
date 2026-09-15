import Anthropic from "@anthropic-ai/sdk";

/**
 * Agente de enriquecimento: usa a API da Anthropic com a ferramenta de
 * busca na web (server-side, roda automático — não precisamos executar
 * nada localmente) pra achar o site oficial de uma empresa e confirmar se
 * ela tem e-commerce PRÓPRIO — carrinho + checkout no mesmo domínio da
 * empresa. Não conta: site institucional sem carrinho, "compre pelo
 * WhatsApp", ou loja só em marketplace (Shopee, Mercado Livre, Amazon).
 *
 * Modelo padrão claude-opus-5 (mais caro, mas é o recomendado por padrão
 * pra tarefas que envolvem julgamento — aqui decide se um lead é
 * qualificado). Pra lote grande, ANTHROPIC_MODEL="claude-sonnet-5" é uma
 * troca razoável de custo por qualidade (também suporta a ferramenta de
 * busca web); claude-haiku-4-5 NÃO suporta essa versão da ferramenta.
 */

const DEFAULT_MODEL = "claude-opus-5";
const MAX_TURNS = 4;

export type EnrichmentVerdict = {
  ecommerceStatus: "SIM" | "NAO" | "DUVIDA";
  website: string | null;
  evidence: string | null;
  role: string | null;
  sector: string | null;
};

export class EnrichmentError extends Error {}

const SYSTEM_PROMPT = `Você verifica se uma empresa brasileira tem uma loja virtual (e-commerce) PRÓPRIA.

Critério RÍGIDO — só responda "SIM" se confirmar que o carrinho de compras e o checkout ficam no PRÓPRIO domínio da empresa (ex: comprar.empresa.com.br, empresa.com.br/checkout, ou uma plataforma de e-commerce — Shopify, VTEX, Nuvemshop, WooCommerce etc. — rodando sob o domínio da empresa).

NÃO conta como e-commerce próprio:
- Site institucional sem botão de comprar / carrinho.
- "Compre pelo WhatsApp" ou só telefone/e-mail para pedido.
- Loja apenas em marketplace de terceiros (Mercado Livre, Shopee, Amazon, Magalu Marketplace) sem loja própria.
- Página do Instagram/Facebook sem site próprio.

Use a busca na web pra achar o site oficial da empresa e confirmar. Se não achar o site oficial com confiança, ou achar mas não conseguir confirmar o carrinho, responda "DUVIDA" — não invente.

Depois de pesquisar, responda com UM ÚNICO bloco JSON, sem nenhum texto antes ou depois, exatamente neste formato:

{"ecommerceStatus": "SIM" | "NAO" | "DUVIDA", "website": "https://..." ou null, "evidence": "frase curta explicando o que você achou", "role": "cargo da pessoa de contato, se aparecer em algum lugar, senão null", "sector": "setor/segmento da empresa, ex: moda, alimentos, eletrônicos"}`;

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeVerdict(raw: Record<string, unknown> | null): EnrichmentVerdict {
  const status = raw?.ecommerceStatus;
  const ecommerceStatus: EnrichmentVerdict["ecommerceStatus"] =
    status === "SIM" || status === "NAO" ? status : "DUVIDA";

  return {
    ecommerceStatus,
    website: typeof raw?.website === "string" ? raw.website : null,
    evidence: typeof raw?.evidence === "string" ? raw.evidence : null,
    role: typeof raw?.role === "string" ? raw.role : null,
    sector: typeof raw?.sector === "string" ? raw.sector : null,
  };
}

/**
 * Investiga uma empresa e devolve o veredito. Em caso de erro da API
 * (chave inválida, rate limit etc.), lança EnrichmentError — quem chama
 * decide o que fazer (o worker da fila marca como DUVIDA e segue).
 */
export async function enrichCompany(params: {
  apiKey: string;
  model?: string;
  companyName: string;
  existingWebsite?: string | null;
}): Promise<EnrichmentVerdict> {
  const client = new Anthropic({ apiKey: params.apiKey });
  const model = params.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const userPrompt = [
    `Empresa: ${params.companyName}`,
    params.existingWebsite ? `Site já conhecido: ${params.existingWebsite}` : null,
    "",
    "Busque na web o site oficial dessa empresa (no Brasil) e confirme se ela tem e-commerce próprio.",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  try {
    let finalText = "";

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        output_config: { effort: "medium" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages,
      });

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      if (response.stop_reason === "refusal") {
        throw new EnrichmentError("O modelo recusou a solicitação.");
      }

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );
      finalText = textBlock?.text ?? "";
      break;
    }

    return normalizeVerdict(extractJson(finalText));
  } catch (error) {
    if (error instanceof EnrichmentError) throw error;
    if (error instanceof Anthropic.APIError) {
      throw new EnrichmentError(`Anthropic respondeu ${error.status}: ${error.message}`);
    }
    throw new EnrichmentError(error instanceof Error ? error.message : "Erro desconhecido no enriquecimento.");
  }
}
