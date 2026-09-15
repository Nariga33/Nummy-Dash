import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const bodySchema = z.object({
  status: z.enum(["NOVO", "CONTATADO", "QUALIFICADO", "DESCARTADO"]).optional(),
  notes: z.string().optional(),
});

/** Atualiza status/observações de um decisor. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  try {
    const contact = await prisma.prospectContact.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true, contact });
  } catch {
    return NextResponse.json({ error: "Decisor não encontrado." }, { status: 404 });
  }
}
