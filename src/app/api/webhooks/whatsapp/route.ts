import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIntegrationConfig, markSyncResult, PROVIDERS, type WhatsAppConfig } from "@/lib/integrations/settings";

/**
 * Endpoint genérico para receber eventos de mensagens do WhatsApp e contar
 * como "atividade" no dashboard. Compatível com o formato mais comum de
 * webhooks (Evolution API / WPPConnect / Z-API / Meta Cloud API): aceita
 * tanto um único evento quanto um array de eventos no corpo da requisição.
 *
 * Autenticação: header `x-webhook-token` deve bater com o token configurado
 * em Integrações > WhatsApp (ou com WHATSAPP_WEBHOOK_TOKEN no .env).
 *
 * Corpo aceito (campos reconhecidos, o resto é ignorado e guardado em `raw`):
 *   { id?, direction? ("SENT"|"RECEIVED"|"in"|"out"), status?, from?, to?,
 *     contact?, agentName?, timestamp? | sentAt? | date? }
 */

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function normalizeDirection(obj: Record<string, unknown>): "SENT" | "RECEIVED" {
  const raw = (pickString(obj, ["direction", "type", "fromMe"]) ?? "sent").toLowerCase();
  if (raw === "true" || raw.includes("sent") || raw.includes("out")) return "SENT";
  if (raw.includes("recv") || raw.includes("in") || raw === "false") return "RECEIVED";
  return "SENT";
}

async function ingestEvent(event: Record<string, unknown>) {
  const externalId = pickString(event, ["id", "messageId", "key"]);
  const timestampRaw = pickString(event, ["timestamp", "sentAt", "date", "moment"]);
  const sentAt = timestampRaw ? new Date(timestampRaw) : new Date();

  await prisma.whatsAppMessage.upsert({
    where: { externalId: externalId ?? `generated:${crypto.randomUUID()}` },
    create: {
      externalId,
      direction: normalizeDirection(event),
      status: pickString(event, ["status", "ack"]),
      agentName: pickString(event, ["agentName", "operator", "sender"]),
      contact: pickString(event, ["contact", "from", "to", "number"]),
      sentAt: Number.isNaN(sentAt.getTime()) ? new Date() : sentAt,
      isDemo: false,
      raw: JSON.stringify(event),
    },
    update: {},
  });
}

export async function POST(request: Request) {
  const config = await getIntegrationConfig<WhatsAppConfig>(PROVIDERS.WHATSAPP);
  const expectedToken = config?.webhookToken || process.env.WHATSAPP_WEBHOOK_TOKEN;
  const providedToken = request.headers.get("x-webhook-token");

  if (expectedToken && providedToken !== expectedToken) {
    return NextResponse.json({ error: "Token de webhook inválido." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const events: Record<string, unknown>[] = Array.isArray(body) ? body : [body];

  try {
    for (const event of events) {
      if (event && typeof event === "object") {
        await ingestEvent(event);
      }
    }
    await markSyncResult(PROVIDERS.WHATSAPP, "ok");
    return NextResponse.json({ ok: true, received: events.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao processar evento.";
    await markSyncResult(PROVIDERS.WHATSAPP, "error", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
