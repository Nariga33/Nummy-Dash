import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

const schema = z.object({
  date: z.string().min(1),
  count: z.number().int().min(1).max(10000),
  direction: z.enum(["SENT", "RECEIVED"]).default("SENT"),
});

/**
 * Lançamento manual de volume de mensagens WhatsApp para um dia, usado
 * enquanto nenhuma API de WhatsApp está conectada via webhook (ex: dado
 * tirado de um relatório do CRM/plataforma usada pela operação).
 */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { date, count, direction } = parsed.data;
  const baseDate = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(baseDate.getTime())) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const rows = Array.from({ length: count }, () => ({
    direction,
    status: "MANUAL",
    sentAt: baseDate,
    isDemo: false,
  }));

  await prisma.whatsAppMessage.createMany({ data: rows });

  return NextResponse.json({ ok: true, created: count });
}
