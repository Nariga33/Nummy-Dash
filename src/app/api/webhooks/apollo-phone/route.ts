import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import type { ApolloConfig } from "@/lib/integrations/settings";
import { normalizePhoneWebhook } from "@/lib/integrations/apollo";

/**
 * Recebe o callback assíncrono do Apollo com o telefone revelado (ver
 * requestPhoneReveal em src/lib/integrations/apollo.ts). A URL é gerada com
 * um token próprio (?token=) na hora do pedido — não depende de header, já
 * que não é o app que controla como o Apollo assina a chamada.
 *
 * O formato exato do payload ainda não foi confirmado com uma chamada real —
 * o corpo é logado abaixo pra dar pra ajustar normalizePhoneWebhook assim que
 * a primeira revelação real acontecer.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  const config = await getIntegrationConfig<ApolloConfig>(PROVIDERS.APOLLO);
  if (!config?.webhookToken || token !== config.webhookToken) {
    return NextResponse.json({ error: "Token de webhook inválido." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  console.log("[apollo-phone webhook] payload recebido:", JSON.stringify(body).slice(0, 2000));

  const { requestId, phone } = normalizePhoneWebhook(body);
  if (!requestId) {
    return NextResponse.json({ ok: true, note: "Sem request_id reconhecível no payload — só logado." });
  }

  const contact = await prisma.prospectContact.findUnique({ where: { phoneRequestId: requestId } });
  if (!contact) {
    return NextResponse.json({ ok: true, note: "Nenhum decisor pendente com esse request_id." });
  }

  await prisma.prospectContact.update({
    where: { id: contact.id },
    data: {
      phone,
      phoneStatus: phone ? "DISPONIVEL" : "INDISPONIVEL",
    },
  });

  return NextResponse.json({ ok: true });
}
