import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const opportunities = await prisma.opportunity.findMany({
    include: { contact: true, stage: true, owner: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ opportunities });
}

const createSchema = z.object({
  contactId: z.string().min(1, "Selecione um contato."),
  title: z.string().min(1, "Informe o título da oportunidade."),
  value: z.number().nonnegative().optional().nullable(),
  stageId: z.string().optional(),
  ownerId: z.string().optional().nullable(),
  expectedCloseAt: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id: parsed.data.contactId } });
  if (!contact) {
    return NextResponse.json({ error: "Contato não encontrado." }, { status: 404 });
  }

  let stageId = parsed.data.stageId;
  if (!stageId) {
    const firstStage = await prisma.pipelineStage.findFirst({ orderBy: { order: "asc" } });
    if (!firstStage) {
      return NextResponse.json({ error: "Nenhuma coluna do pipeline configurada." }, { status: 400 });
    }
    stageId = firstStage.id;
  }

  const ownerId = parsed.data.ownerId || session!.user.id;
  if (ownerId !== session!.user.id && session!.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Somente administradores podem atribuir a oportunidade a outra pessoa." },
      { status: 403 }
    );
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      contactId: parsed.data.contactId,
      title: parsed.data.title.trim(),
      value: parsed.data.value ?? undefined,
      stageId,
      ownerId,
      expectedCloseAt: parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : undefined,
      notes: parsed.data.notes?.trim() || undefined,
    },
    include: { contact: true, stage: true, owner: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ opportunity }, { status: 201 });
}
