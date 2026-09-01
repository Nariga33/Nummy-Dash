import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import type { Prisma, ProspectStatus } from "@prisma/client";

const VALID_STATUSES = ["NOVO", "CONTATADO", "QUALIFICADO", "DESCARTADO"];

/** Lista decisores encontrados, opcionalmente filtrados por empresa/status. */
export async function GET(request: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const status = searchParams.get("status");

  const where: Prisma.ProspectContactWhereInput = {};
  if (companyId) where.companyId = companyId;
  if (status && VALID_STATUSES.includes(status)) where.status = status as ProspectStatus;

  const contacts = await prisma.prospectContact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { company: { select: { name: true, domain: true } } },
    take: 300,
  });

  return NextResponse.json({ contacts });
}
