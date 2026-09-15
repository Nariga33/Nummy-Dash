import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { detectCartPlatform } from "@/lib/integrations/tech-detect";

/** Visita o site da empresa e tenta identificar a plataforma de carrinho pelo HTML. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const company = await prisma.prospectCompany.findUnique({ where: { id } });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }
  if (!company.domain) {
    return NextResponse.json({ error: "Essa empresa não tem domínio salvo pra visitar." }, { status: 400 });
  }

  const result = await detectCartPlatform(company.domain);
  const ecommercePlatforms = result.platform ? [result.platform] : [];

  const updated = await prisma.prospectCompany.update({
    where: { id },
    data: { ecommercePlatforms: JSON.stringify(ecommercePlatforms) },
  });

  return NextResponse.json({
    ok: true,
    platform: result.platform,
    error: result.error,
    company: {
      ...updated,
      technologies: JSON.parse(updated.technologies) as string[],
      ecommercePlatforms: JSON.parse(updated.ecommercePlatforms) as string[],
      cnpjPartners: JSON.parse(updated.cnpjPartners) as { name: string; role: string | null }[],
    },
  });
}
