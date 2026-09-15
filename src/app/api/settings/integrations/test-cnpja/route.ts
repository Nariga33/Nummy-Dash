import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import type { CnpjaConfig } from "@/lib/integrations/settings";
import { CnpjaApiError, lookupCnpj } from "@/lib/integrations/cnpja";

// CNPJ público de uma empresa grande e estável (Magazine Luiza S.A.), só pra
// validar que a chave/endpoint funcionam — não tem relação com o negócio.
const TEST_CNPJ = "47960950000121";

/** Testa a chave de API do CNPJá configurada (admin only). */
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  const config = await getIntegrationConfig<CnpjaConfig>(PROVIDERS.CNPJA);
  if (!config?.apiKey) {
    return NextResponse.json({ error: "Configure a chave do CNPJá antes de testar." }, { status: 400 });
  }

  try {
    const result = await lookupCnpj(config, TEST_CNPJ);
    return NextResponse.json({ ok: true, sample: result.name });
  } catch (error) {
    const message =
      error instanceof CnpjaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido ao testar o CNPJá.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
