import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

export async function GET(request: Request) {
  const { response } = await requireSession();
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const contacts = await prisma.contact.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { companyName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { phone2: { contains: q } },
          ],
        }
      : undefined,
    include: { _count: { select: { opportunities: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ contacts });
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
