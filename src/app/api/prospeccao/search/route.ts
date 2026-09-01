import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import type { ApolloConfig } from "@/lib/integrations/settings";
import { ApolloApiError, searchAllOrganizations } from "@/lib/integrations/apollo";

const bodySchema = z.object({
  name: z.string().min(1).default("Busca sem nome"),
  employeeRanges: z.array(z.string()).min(1, "Selecione ao menos uma faixa de funcionários."),
  technologies: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  keywords: z.string().optional(),
});

/** Dispara uma busca de empresas de e-commerce no Apollo e salva os resultados. */
export async function POST(request: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const config = await getIntegrationConfig<ApolloConfig>(PROVIDERS.APOLLO);
  if (!config?.apiKey) {
    return NextResponse.json(
      { error: "Configure a chave do Apollo em Integrações antes de buscar." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }
  const { name, employeeRanges, technologies, locations, keywords } = parsed.data;

  try {
    const { organizations: allOrganizations, totalEntries } = await searchAllOrganizations({
      config,
      employeeRanges,
      technologies,
      locations,
      keywords,
    });

    // O filtro de tecnologia do Apollo não é confiável quando algum slug não é
    // reconhecido (vira um no-op silencioso — foi o que trouxe empresa sem
    // carrinho nenhum na busca). Quando o usuário pediu filtro por plataforma,
    // reforça aqui: só entra quem realmente teve uma plataforma detectada.
    const organizations =
      technologies.length > 0 ? allOrganizations.filter((org) => org.ecommercePlatforms.length > 0) : allOrganizations;
    const discardedByPlatformFilter = allOrganizations.length - organizations.length;

    const search = await prisma.prospectSearch.create({
      data: {
        name,
        employeeRanges: JSON.stringify(employeeRanges),
        technologies: JSON.stringify(technologies),
        locations: JSON.stringify(locations),
        keywords: keywords ?? null,
        resultsCount: organizations.length,
      },
    });

    let created = 0;
    let updated = 0;
    for (const org of organizations) {
      const existing = await prisma.prospectCompany.findFirst({
        where: {
          OR: [
            { apolloOrgId: org.apolloOrgId },
            ...(org.domain ? [{ domain: org.domain }] : []),
          ],
        },
      });

      const data = {
        apolloOrgId: org.apolloOrgId,
        domain: org.domain,
        name: org.name,
        linkedinUrl: org.linkedinUrl,
        websiteUrl: org.websiteUrl,
        employeeCount: org.employeeCount,
        employeeRange: org.employeeRange,
        industry: org.industry,
        city: org.city,
        state: org.state,
        country: org.country,
        technologies: JSON.stringify(org.technologies),
        ecommercePlatforms: JSON.stringify(org.ecommercePlatforms),
        searchId: search.id,
      };

      if (existing) {
        await prisma.prospectCompany.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.prospectCompany.create({ data: { ...data, source: "apollo" } });
        created += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      searchId: search.id,
      totalEntries,
      fetched: organizations.length,
      discardedByPlatformFilter,
      created,
      updated,
    });
  } catch (error) {
    const message =
      error instanceof ApolloApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido ao buscar no Apollo.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
