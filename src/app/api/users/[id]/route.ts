import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["ADMIN", "VIEWER"]).optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (id === session!.user.id && (parsed.data.active === false || parsed.data.role === "VIEWER")) {
    return NextResponse.json({ error: "Você não pode remover seu próprio acesso de administrador." }, { status: 400 });
  }

  if (parsed.data.active === false || parsed.data.role === "VIEWER") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === "ADMIN" && adminCount <= 1) {
      return NextResponse.json({ error: "Precisa haver pelo menos um administrador ativo." }, { status: 400 });
    }
  }

  const data: { active?: boolean; role?: "ADMIN" | "VIEWER"; passwordHash?: string } = {};
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.password) data.passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  const { id } = await params;

  if (id === session!.user.id) {
    return NextResponse.json({ error: "Você não pode excluir seu próprio usuário." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (target?.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Precisa haver pelo menos um administrador ativo." }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
