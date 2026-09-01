import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-auth";
import { getIntegration, getIntegrationConfig, saveIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import type { Api4comConfig } from "@/lib/integrations/api4com";
import type { WhatsAppConfig, ApolloConfig } from "@/lib/integrations/settings";

function maskKey(key: string | undefined | null) {
  if (!key) return null;
  if (key.length <= 4) return "••••";
  return `••••${key.slice(-4)}`;
}

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  const [api4com, api4comConfig, whatsapp, whatsappConfig, apollo, apolloConfig] = await Promise.all([
    getIntegration(PROVIDERS.API4COM),
    getIntegrationConfig<Api4comConfig>(PROVIDERS.API4COM),
    getIntegration(PROVIDERS.WHATSAPP),
    getIntegrationConfig<WhatsAppConfig>(PROVIDERS.WHATSAPP),
    getIntegration(PROVIDERS.APOLLO),
    getIntegrationConfig<ApolloConfig>(PROVIDERS.APOLLO),
  ]);

  return NextResponse.json({
    api4com: {
      enabled: api4com?.enabled ?? false,
      lastSyncAt: api4com?.lastSyncAt ?? null,
      lastStatus: api4com?.lastStatus ?? null,
      lastError: api4com?.lastError ?? null,
      apiKeyMasked: maskKey(api4comConfig?.apiKey),
      baseUrl: api4comConfig?.baseUrl ?? "",
    },
    whatsapp: {
      enabled: whatsapp?.enabled ?? false,
      lastSyncAt: whatsapp?.lastSyncAt ?? null,
      lastStatus: whatsapp?.lastStatus ?? null,
      lastError: whatsapp?.lastError ?? null,
      webhookTokenMasked: maskKey(whatsappConfig?.webhookToken),
      webhookUrl: "/api/webhooks/whatsapp",
    },
    apollo: {
      enabled: apollo?.enabled ?? false,
      lastSyncAt: apollo?.lastSyncAt ?? null,
      lastStatus: apollo?.lastStatus ?? null,
      lastError: apollo?.lastError ?? null,
      apiKeyMasked: maskKey(apolloConfig?.apiKey),
      baseUrl: apolloConfig?.baseUrl ?? "",
    },
  });
}

const bodySchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("api4com"),
    apiKey: z.string().min(1),
    baseUrl: z.string().optional().default(""),
  }),
  z.object({
    provider: z.literal("whatsapp"),
    webhookToken: z.string().min(1),
  }),
  z.object({
    provider: z.literal("apollo"),
    apiKey: z.string().min(1),
    baseUrl: z.string().optional().default(""),
  }),
]);

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  try {
    if (parsed.data.provider === "api4com") {
      const config: Api4comConfig = {
        apiKey: parsed.data.apiKey,
        baseUrl: parsed.data.baseUrl || "https://api.api4com.com/v1",
      };
      await saveIntegrationConfig(PROVIDERS.API4COM, config, true);
      return NextResponse.json({ ok: true });
    }

    if (parsed.data.provider === "whatsapp") {
      const config: WhatsAppConfig = { webhookToken: parsed.data.webhookToken };
      await saveIntegrationConfig(PROVIDERS.WHATSAPP, config, true);
      return NextResponse.json({ ok: true });
    }

    const existingApollo = await getIntegrationConfig<ApolloConfig>(PROVIDERS.APOLLO);
    const config: ApolloConfig = {
      apiKey: parsed.data.apiKey,
      baseUrl: parsed.data.baseUrl || "https://api.apollo.io/api/v1",
      webhookToken: existingApollo?.webhookToken || crypto.randomBytes(24).toString("hex"),
    };
    await saveIntegrationConfig(PROVIDERS.APOLLO, config, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar integração.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
