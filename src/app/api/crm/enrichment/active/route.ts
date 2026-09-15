import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getActiveJob } from "@/lib/enrichment-queue";

/** Devolve o job de enriquecimento ativo (ou o último concluído). */
export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const job = await getActiveJob();
  return NextResponse.json({ job });
}
