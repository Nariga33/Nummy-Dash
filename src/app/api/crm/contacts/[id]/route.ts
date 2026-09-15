import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";

const patchSchema = z.object({
  companyName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const data: Record<string, string | null> = {};
  if (parsed.data.companyName !== undefined) data.companyName = parsed.data.companyName.trim();
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.email !== undefined) data.email = parsed.data.email.trim().toLowerCase() || null;
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone.trim() || null;
  if (parsed.data.phone2 !== undefined) data.phone2 = parsed.data.phone2.trim() || null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes.trim() || null;

  if (data.email) {
    const existing = await prisma.contact.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "Já existe um contato com este e-mail." }, { status: 409 });
    }
  }

  const contact = await prisma.contact.update({ where: { id }, data });
  return NextResponse.json({ contact });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireSession();
  if (response) return response;
  const { id } = await params;

  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
