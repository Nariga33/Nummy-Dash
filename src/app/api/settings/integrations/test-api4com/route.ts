import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import { Api4comApiError, testApi4comConnection, type Api4comConfig } from "@/lib/integrations/api4com";

export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  const config = await getIntegrationConfig<Api4comConfig>(PROVIDERS.API4COM);
  if (!config?.apiKey) {
    return NextResponse.json({ error: "Nenhuma chave da API4COM configurada." }, { status: 400 });
  }

  try {
    const result = await testApi4comConnection(config);
    return NextResponse.json({ ok: true, status: result.status, sample: result.body });
  } catch (error) {
    if (error instanceof Api4comApiError) {
      return NextResponse.json({ ok: false, error: error.message, body: error.body }, { status: 502 });
    }
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
