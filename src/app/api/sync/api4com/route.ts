import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { getIntegrationConfig, markSyncResult, PROVIDERS } from "@/lib/integrations/settings";
import { Api4comApiError, fetchAllCalls, type Api4comConfig } from "@/lib/integrations/api4com";

/** Dispara a sincronização manual de chamadas com a API4COM (admin only). */
export async function POST(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const config = await getIntegrationConfig<Api4comConfig>(PROVIDERS.API4COM);
  if (!config?.apiKey) {
    return NextResponse.json(
      { error: "Configure a chave da API4COM em Integrações antes de sincronizar." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const daysBack = Number(body?.daysBack ?? 7);
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - daysBack * 24 * 60 * 60 * 1000);

  try {
    const calls = await fetchAllCalls({ config, startDate, endDate });

    const existingIds = new Set(
      (
        await prisma.callRecord.findMany({
          where: { externalId: { in: calls.map((c) => c.externalId) } },
          select: { externalId: true },
        })
      ).map((c) => c.externalId)
    );

    let created = 0;
    let updated = 0;
    for (const call of calls) {
      await prisma.callRecord.upsert({
        where: { externalId: call.externalId },
        create: {
          externalId: call.externalId,
          direction: call.direction,
          status: call.status,
          agentName: call.agentName,
          fromNumber: call.fromNumber,
          toNumber: call.toNumber,
          durationSec: call.durationSec,
          startedAt: call.startedAt,
          isDemo: false,
          raw: JSON.stringify(call.raw),
        },
        update: {
          status: call.status,
          durationSec: call.durationSec,
          agentName: call.agentName,
        },
      });
      if (existingIds.has(call.externalId)) updated += 1;
      else created += 1;
    }

    await markSyncResult(PROVIDERS.API4COM, "ok");

    return NextResponse.json({ ok: true, fetched: calls.length, created, updated });
  } catch (error) {
    const message =
      error instanceof Api4comApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido ao sincronizar com a API4COM.";
    await markSyncResult(PROVIDERS.API4COM, "error", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
