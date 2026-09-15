import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import type { ApolloConfig } from "@/lib/integrations/settings";
import { ApolloApiError, requestPhoneReveal } from "@/lib/integrations/apollo";

/**
 * Pede a revelação do telefone de um decisor (consome crédito Apollo). O
 * número não vem nessa resposta — o Apollo confirma depois via webhook, então
 * o contato fica "PENDENTE" até /api/webhooks/apollo-phone atualizar.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;

  const config = await getIntegrationConfig<ApolloConfig>(PROVIDERS.APOLLO);
  if (!config?.apiKey) {
    return NextResponse.json(
      { error: "Configure a chave do Apollo em Integrações antes de revelar telefones." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const contact = await prisma.prospectContact.findUnique({ where: { id } });
  if (!contact) {
    return NextResponse.json({ error: "Decisor não encontrado." }, { status: 404 });
  }
  if (!contact.apolloPersonId) {
    return NextResponse.json(
      { error: "Esse decisor não tem ID do Apollo — não dá pra revelar o telefone." },
      { status: 400 }
    );
  }
  if (contact.phone) {
    return NextResponse.json({ ok: true, phone: contact.phone, phoneStatus: contact.phoneStatus });
  }

  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/webhooks/apollo-phone?token=${config.webhookToken}`;

  try {
    const { requestId } = await requestPhoneReveal({
      config,
      apolloPersonId: contact.apolloPersonId,
      webhookUrl,
    });

    const updated = await prisma.prospectContact.update({
      where: { id },
      data: { phoneStatus: "PENDENTE", phoneRequestId: requestId },
    });

    return NextResponse.json({ ok: true, phoneStatus: updated.phoneStatus, requestId });
  } catch (error) {
    const message =
      error instanceof ApolloApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido ao pedir o telefone no Apollo.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
