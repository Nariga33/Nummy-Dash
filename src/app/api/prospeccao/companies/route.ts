import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import type { Prisma, ProspectStatus } from "@prisma/client";

const VALID_STATUSES = ["NOVO", "CONTATADO", "QUALIFICADO", "DESCARTADO"];

/** Lista empresas prospectadas, com filtro opcional por status e faixa de porte. */
export async function GET(request: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const size = searchParams.get("size"); // "micro" (<=20) | "small" (21-100) | "large" (>100)
  const platform = searchParams.get("platform");

  const where: Prisma.ProspectCompanyWhereInput = {};
  if (status && VALID_STATUSES.includes(status)) where.status = status as ProspectStatus;
  if (size === "micro") where.employeeCount = { lte: 20 };
  else if (size === "small") where.employeeCount = { gt: 20, lte: 100 };
  else if (size === "large") where.employeeCount = { gt: 100 };
  if (platform) where.ecommercePlatforms = { contains: platform };

  const companies = await prisma.prospectCompany.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json({
    companies: companies.map((c) => ({
      ...c,
      technologies: JSON.parse(c.technologies) as string[],
      ecommercePlatforms: JSON.parse(c.ecommercePlatforms) as string[],
    })),
  });
}
