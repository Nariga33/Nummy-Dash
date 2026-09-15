import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { enqueueContacts } from "@/lib/enrichment-queue";

const bodySchema = z.object({
  contactIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

/**
 * Coloca empresas na fila de enriquecimento (agente de IA com busca na
 * web). Aceita uma lista de IDs específicos, ou `{ all: true }` pra
 * enfileirar todas as empresas ainda não verificadas (NAO_VERIF).
 */
export async function POST(request: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  let contactIds = parsed.data.contactIds ?? [];

  if (parsed.data.all) {
    const pending = await prisma.contact.findMany({
      where: { ecommerceStatus: "NAO_VERIF", enrichmentQueued: false },
      select: { id: true },
    });
    contactIds = pending.map((c) => c.id);
  }

  const { job, queued } = await enqueueContacts(contactIds, session!.user.id);

  return NextResponse.json({ job, queued });
}
