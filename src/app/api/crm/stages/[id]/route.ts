import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  order: z.number().int().optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.color !== undefined) data.color = parsed.data.color;
  if (parsed.data.order !== undefined) data.order = parsed.data.order;
  if (parsed.data.isWon !== undefined) data.isWon = parsed.data.isWon;
  if (parsed.data.isLost !== undefined) data.isLost = parsed.data.isLost;

  const stage = await prisma.pipelineStage.update({ where: { id }, data });
  return NextResponse.json({ stage });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;

  const count = await prisma.opportunity.count({ where: { stageId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: "Mova ou exclua as oportunidades desta coluna antes de excluí-la." },
      { status: 400 }
    );
  }

  await prisma.pipelineStage.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
