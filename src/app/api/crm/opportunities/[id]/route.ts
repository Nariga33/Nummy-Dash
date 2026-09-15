import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  value: z.number().nonnegative().optional().nullable(),
  stageId: z.string().optional(),
  ownerId: z.string().optional().nullable(),
  expectedCloseAt: z.string().optional().nullable(),
  notes: z.string().optional(),
});

async function canManage(opportunityId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true;
  const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
  return opportunity?.ownerId === userId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;
  const { id } = await params;

  const isAdmin = session!.user.role === "ADMIN";
  if (!(await canManage(id, session!.user.id, isAdmin))) {
    return NextResponse.json(
      { error: "Somente o responsável ou um administrador pode alterar esta oportunidade." },
      { status: 403 }
    );
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (parsed.data.ownerId !== undefined && parsed.data.ownerId !== session!.user.id && !isAdmin) {
    return NextResponse.json(
      { error: "Somente administradores podem atribuir a oportunidade a outra pessoa." },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title.trim();
  if (parsed.data.value !== undefined) data.value = parsed.data.value;
  if (parsed.data.stageId !== undefined) data.stageId = parsed.data.stageId;
  if (parsed.data.ownerId !== undefined) data.ownerId = parsed.data.ownerId;
  if (parsed.data.expectedCloseAt !== undefined) {
    data.expectedCloseAt = parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : null;
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes.trim() || null;

  const opportunity = await prisma.opportunity.update({
    where: { id },
    data,
    include: { contact: true, stage: true, owner: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ opportunity });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireSession();
  if (response) return response;
  const { id } = await params;

  const isAdmin = session!.user.role === "ADMIN";
  if (!(await canManage(id, session!.user.id, isAdmin))) {
    return NextResponse.json(
      { error: "Somente o responsável ou um administrador pode excluir esta oportunidade." },
      { status: 403 }
    );
  }

  await prisma.opportunity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
