import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { getIntegrationConfig, PROVIDERS } from "@/lib/integrations/settings";
import type { ApolloConfig } from "@/lib/integrations/settings";
import { ApolloApiError, normalizePerson, searchPeoplePage } from "@/lib/integrations/apollo";

const bodySchema = z.object({
  companyId: z.string().min(1),
  titles: z.array(z.string()).default([]),
  keywords: z.string().optional(),
});

/** Busca decisores (por cargo e/ou nome) de uma empresa já prospectada. */
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
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { companyId, titles, keywords } = parsed.data;
  if (titles.length === 0 && !keywords) {
    return NextResponse.json({ error: "Informe um cargo ou um nome pra buscar." }, { status: 400 });
  }

  const company = await prisma.prospectCompany.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }
  if (!company.apolloOrgId) {
    return NextResponse.json(
      { error: "Essa empresa não tem ID do Apollo (foi adicionada manualmente) — não dá pra buscar decisores." },
      { status: 400 }
    );
  }

  try {
    const { items } = await searchPeoplePage({
      config,
      organizationApolloIds: [company.apolloOrgId],
      titles,
      keywords,
      perPage: 25,
    });

    let created = 0;
    let updated = 0;
    for (const raw of items) {
      const person = normalizePerson(raw);
      if (!person) continue;

      const data = {
        companyId: company.id,
        name: person.name,
        title: person.title,
        seniority: person.seniority,
        linkedinUrl: person.linkedinUrl,
        email: person.email,
      };

      const existing = await prisma.prospectContact.findUnique({ where: { apolloPersonId: person.apolloPersonId } });
      if (existing) {
        await prisma.prospectContact.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.prospectContact.create({ data: { ...data, apolloPersonId: person.apolloPersonId } });
        created += 1;
      }
    }

    return NextResponse.json({ ok: true, fetched: items.length, created, updated });
  } catch (error) {
    const message =
      error instanceof ApolloApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido ao buscar pessoas no Apollo.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
