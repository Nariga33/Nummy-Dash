import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const stages = await prisma.pipelineStage.findMany({
    include: { _count: { select: { opportunities: true } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ stages });
}

const createSchema = z.object({
  name: z.string().min(1, "Informe o nome da coluna."),
  color: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const last = await prisma.pipelineStage.findFirst({ orderBy: { order: "desc" } });
  const stage = await prisma.pipelineStage.create({
    data: {
      name: parsed.data.name.trim(),
      color: parsed.data.color || "#f5b400",
      order: (last?.order ?? -1) + 1,
    },
  });

  return NextResponse.json({ stage }, { status: 201 });
}
