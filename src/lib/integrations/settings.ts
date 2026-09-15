import { prisma } from "@/lib/prisma";
import { decryptJSON, encryptJSON } from "@/lib/crypto";

export type Api4comConfig = {
  apiKey: string;
  baseUrl: string;
};

export type WhatsAppConfig = {
  webhookToken: string;
};

export type ApolloConfig = {
  apiKey: string;
  baseUrl: string;
  /** Token gerado automaticamente pra validar o webhook de revelação de telefone. */
  webhookToken: string;
};

export type CnpjaConfig = {
  apiKey: string;
  baseUrl: string;
};

export const PROVIDERS = {
  API4COM: "api4com",
  WHATSAPP: "whatsapp",
  APOLLO: "apollo",
  CNPJA: "cnpja",
} as const;

export async function getIntegration(provider: string) {
  return prisma.integration.findUnique({ where: { provider } });
}

export async function getIntegrationConfig<T>(provider: string): Promise<T | null> {
  const integration = await getIntegration(provider);
  if (!integration) return null;
  try {
    return decryptJSON<T>(integration.config);
  } catch {
    return null;
  }
}

export async function saveIntegrationConfig(
  provider: string,
  config: unknown,
  enabled: boolean
) {
  const encrypted = encryptJSON(config);
  return prisma.integration.upsert({
    where: { provider },
    create: { provider, config: encrypted, enabled },
    update: { config: encrypted, enabled },
  });
}

export async function markSyncResult(provider: string, status: "ok" | "error", error?: string) {
  return prisma.integration.update({
    where: { provider },
    data: {
      lastSyncAt: new Date(),
      lastStatus: status,
      lastError: error ?? null,
    },
  });
}
