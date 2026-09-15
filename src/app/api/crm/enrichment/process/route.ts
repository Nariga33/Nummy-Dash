import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { processNextBatch } from "@/lib/enrichment-queue";

/**
 * Processa um lote do job de enriquecimento ativo. Chamado pela tela de
 * Prospecção (polling a cada ~4s enquanto há job ativo) e reaproveitado
 * pelo cron — ver /api/cron/enrichment.
 */
export async function POST() {
  const { response } = await requireSession();
  if (response) return response;

  const result = await processNextBatch();
  return NextResponse.json(result);
}
