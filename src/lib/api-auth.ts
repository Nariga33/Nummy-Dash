import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, response: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  return { session, response: null };
}

export async function requireAdmin() {
  const { session, response } = await requireSession();
  if (response) return { session: null, response };
  if (session!.user.role !== "ADMIN") {
    return { session: null, response: NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 }) };
  }
  return { session, response: null };
}
