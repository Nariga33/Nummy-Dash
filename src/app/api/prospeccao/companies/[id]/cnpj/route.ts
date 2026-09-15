import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import type { CnpjaConfig } from "@/lib/integrations/settings";
import { CnpjaApiError, lookupCnpj } from "@/lib/integrations/cnpja";

const bodySchema = z.object({ cnpj: z.string().min(11) });

/** Consulta um CNPJ informado manualmente e salva os dados na empresa. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;

  const config = await getIntegrationConfig<CnpjaConfig>(PROVIDERS.CNPJA);
  if (!config?.apiKey) {
    return NextResponse.json(
      { error: "Configure a chave do CNPJá em Integrações antes de consultar." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe um CNPJ." }, { status: 400 });
  }

  const company = await prisma.prospectCompany.findUnique({ where: { id } });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  try {
    const result = await lookupCnpj(config, parsed.data.cnpj);
    const updated = await prisma.prospectCompany.update({
      where: { id },
      data: {
        cnpj: result.cnpj,
        cnpjStatus: result.status,
        cnpjStatusDate: result.statusDate ? new Date(result.statusDate) : null,
        cnpjPartners: JSON.stringify(result.partners),
        cnpjLookedUpAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      company: {
        ...updated,
        technologies: JSON.parse(updated.technologies) as string[],
        ecommercePlatforms: JSON.parse(updated.ecommercePlatforms) as string[],
        cnpjPartners: JSON.parse(updated.cnpjPartners) as { name: string; role: string | null }[],
      },
    });
  } catch (error) {
    const message =
      error instanceof CnpjaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido ao consultar o CNPJá.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
