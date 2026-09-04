import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { STAGE_ORDER } from "@/lib/crm";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  value: z.number().nonnegative().optional().nullable(),
  stage: z.enum(STAGE_ORDER as [string, ...string[]]).optional(),
  expectedCloseAt: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title.trim();
  if (parsed.data.value !== undefined) data.value = parsed.data.value;
  if (parsed.data.stage !== undefined) data.stage = parsed.data.stage;
  if (parsed.data.expectedCloseAt !== undefined) {
    data.expectedCloseAt = parsed.data.expectedCloseAt ? new Date(parsed.data.expectedCloseAt) : null;
  }
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes.trim() || null;

  const opportunity = await prisma.opportunity.update({ where: { id }, data, include: { contact: true } });
  return NextResponse.json({ opportunity });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;
  const { id } = await params;

  await prisma.opportunity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
