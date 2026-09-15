import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const PAGE_SIZES = [10, 50, 100];

export async function GET(request: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSizeRaw = Number(searchParams.get("pageSize")) || 50;
  const pageSize = PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : 50;

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { companyName: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { phone2: { contains: q } },
        ],
      }
    : undefined;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { _count: { select: { opportunities: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({
    contacts,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  });
}

const createSchema = z.object({
  companyName: z.string().min(1, "Informe o nome da empresa."),
  name: z.string().min(1, "Informe o nome do lead."),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 400 });
  }

  const email = parsed.data.email?.trim().toLowerCase() || undefined;
  if (email) {
    const existing = await prisma.contact.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Já existe um contato com este e-mail." }, { status: 409 });
    }
  }

  const contact = await prisma.contact.create({
    data: {
      companyName: parsed.data.companyName.trim(),
      name: parsed.data.name.trim(),
      email,
      phone: parsed.data.phone?.trim() || undefined,
      phone2: parsed.data.phone2?.trim() || undefined,
      notes: parsed.data.notes?.trim() || undefined,
    },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
