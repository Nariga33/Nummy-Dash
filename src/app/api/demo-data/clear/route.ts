import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

/** Apaga os dados de demonstração (isDemo=true), deixando só dados reais. */
export async function POST() {
  const { response } = await requireAdmin();
  if (response) return response;

  const [calls, messages] = await Promise.all([
    prisma.callRecord.deleteMany({ where: { isDemo: true } }),
    prisma.whatsAppMessage.deleteMany({ where: { isDemo: true } }),
  ]);

  return NextResponse.json({ ok: true, deletedCalls: calls.count, deletedMessages: messages.count });
}
