import { NextResponse } from "next/server";
import { processNextBatch } from "@/lib/enrichment-queue";

// Dá margem pro plano Pro da Vercel (Hobby ignora/limita isso sozinho).
export const maxDuration = 60;

/**
 * Drena a fila de enriquecimento em segundo plano, mesmo com a aba de
 * Prospecção fechada. A Vercel injeta o header Authorization: Bearer
 * <CRON_SECRET> automaticamente quando CRON_SECRET está definido nas
 * variáveis de ambiente do projeto — sem CRON_SECRET configurado, o
 * endpoint fica aberto (ok pra teste, não recomendado em produção).
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  let totalProcessed = 0;
  let lastStatus: "IDLE" | "RUNNING" | "DONE" = "IDLE";

  while (Date.now() - startedAt < 50_000) {
    const result = await processNextBatch();
    lastStatus = result.status;
    totalProcessed += result.processedThisRun;
    if (result.status !== "RUNNING") break;
  }

  return NextResponse.json({ ok: true, status: lastStatus, processed: totalProcessed });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
