import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const bodySchema = z.object({
  status: z.enum(["NOVO", "CONTATADO", "QUALIFICADO", "DESCARTADO"]).optional(),
  notes: z.string().optional(),
});

/** Atualiza status/observações de uma empresa prospectada. */
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
    const company = await prisma.prospectCompany.update({ where: { id }, data: parsed.data });
    return NextResponse.json({
      ok: true,
      company: {
        ...company,
        technologies: JSON.parse(company.technologies) as string[],
        ecommercePlatforms: JSON.parse(company.ecommercePlatforms) as string[],
      },
    });
  } catch {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }
}
