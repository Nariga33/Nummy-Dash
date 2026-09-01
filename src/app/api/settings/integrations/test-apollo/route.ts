import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import { ApolloApiError, testApolloConnection } from "@/lib/integrations/apollo";
import type { ApolloConfig } from "@/lib/integrations/settings";

/** Testa a chave de API do Apollo configurada (admin only). */
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  const config = await getIntegrationConfig<ApolloConfig>(PROVIDERS.APOLLO);
  if (!config?.apiKey) {
    return NextResponse.json({ error: "Configure a chave do Apollo antes de testar." }, { status: 400 });
  }

  try {
    await testApolloConnection(config);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof ApolloApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido ao testar o Apollo.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
