/**
 * Detecção de plataforma de carrinho visitando o site da empresa direto —
 * sem depender de nenhuma API paga. O Apollo tem esse dado, mas só devolve
 * numa consulta individual (Organization Enrichment, cobra crédito por
 * empresa); a busca em lote usada em /prospeccao não traz esse campo (ver
 * comentário em normalizeOrganization no apollo.ts). Isso aqui faz o mesmo
 * que ferramentas tipo BuiltWith/Wappalyzer fazem: busca o HTML da home e
 * procura assinaturas conhecidas de cada plataforma.
 *
 * Limitação honesta: só pega o que aparece no HTML da página inicial sem
 * JS executado (sem headless browser) — funciona bem pra maioria das
 * plataformas porque elas deixam script/CDN/cookie visível no HTML cru,
 * mas pode não detectar site muito customizado ou headless commerce.
 *
 * NÃO TESTADO com site real nesta sessão: a rede deste ambiente de
 * desenvolvimento bloqueia fetch pra domínio arbitrário (allowlist), só
 * alcança o que já foi liberado (ex: api.apollo.io). A Vercel roda numa
 * rede sem essa restrição, então em produção deve funcionar normalmente —
 * mas os padrões de SIGNATURES abaixo são baseados em conhecimento geral de
 * cada plataforma, não confirmados contra HTML real. Teste com "Verificar
 * carrinho" numa empresa cuja plataforma você já sabe, e ajuste os regex
 * aqui se o resultado vier errado.
 */

const SIGNATURES: { platform: string; patterns: RegExp[] }[] = [
  { platform: "Shopify", patterns: [/cdn\.shopify\.com/i, /myshopify\.com/i, /Shopify\.theme/i] },
  { platform: "VTEX", patterns: [/vteximg\.com\.br/i, /vtexassets\.com/i, /vtex\.com\.br/i] },
  { platform: "Nuvemshop", patterns: [/nuvemshop\.com\.br/i, /tiendanube\.com/i, /lojavirtualnuvem/i] },
  { platform: "Loja Integrada", patterns: [/lojaintegrada\.com\.br/i] },
  { platform: "Tray Commerce", patterns: [/tray\.com\.br/i, /traycorp/i, /catalog\.tray/i] },
  { platform: "WooCommerce", patterns: [/wp-content\/plugins\/woocommerce/i, /woocommerce[-_]?\w*\.js/i] },
  { platform: "Magento", patterns: [/Mage\.Cookies/i, /\/static\/version\d+\/frontend\//i, /mage-init/i] },
  { platform: "BigCommerce", patterns: [/cdn11\.bigcommerce\.com/i, /bigcommerce\.com/i] },
  { platform: "Wake Commerce", patterns: [/wakecommerce\.com\.br/i, /static\.wake\.tech/i] },
  { platform: "Linx Commerce", patterns: [/linx\.com\.br/i, /linxcommerce/i, /neemu/i] },
  { platform: "Vnda", patterns: [/vnda\.com\.br/i, /cdn\.vnda\.com\.br/i] },
  { platform: "Yampi", patterns: [/yampi\.com\.br/i, /yampi\.me/i] },
  { platform: "Cartpanda", patterns: [/cartpanda\.com/i] },
  { platform: "Wix Stores", patterns: [/static\.wixstatic\.com/i, /wix\.com\/stores/i] },
  { platform: "Salesforce Commerce Cloud", patterns: [/demandware\.(net|com)/i, /cquotient\.com/i] },
  { platform: "PrestaShop", patterns: [/prestashop/i] },
  { platform: "OpenCart", patterns: [/route=product\/product/i, /catalog\/view\/theme/i] },
];

export type PlatformDetectionResult = {
  platform: string | null;
  checkedUrl: string;
  error: string | null;
};

/** Visita o domínio informado e tenta identificar a plataforma de carrinho pelo HTML. */
export async function detectCartPlatform(domain: string): Promise<PlatformDetectionResult> {
  const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const url = `https://${cleanDomain}`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NummyDashProspectingBot/1.0)",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      return { platform: null, checkedUrl: url, error: `Site respondeu ${res.status}` };
    }

    const html = await res.text();
    const headers = Array.from(res.headers.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const haystack = `${headers}\n${html}`;

    for (const { platform, patterns } of SIGNATURES) {
      if (patterns.some((p) => p.test(haystack))) {
        return { platform, checkedUrl: url, error: null };
      }
    }

    return { platform: null, checkedUrl: url, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido ao acessar o site.";
    return { platform: null, checkedUrl: url, error: message };
  }
}
