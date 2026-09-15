import { prisma } from "@/lib/prisma";
import { enrichCompany, EnrichmentError, type EnrichmentVerdict } from "@/lib/enrichment";
import type { EnrichmentJobStatus } from "@prisma/client";

/**
 * Fila de enriquecimento: um job ativo por vez (PENDING/RUNNING). Processa
 * em lotes pequenos porque cada chamada de IA com busca na web pode levar
 * alguns segundos — chamado repetidamente por três caminhos que convergem
 * aqui: a tela de Prospecção (polling enquanto aberta), o cron da Vercel, e
 * o endpoint /api/crm/enrichment/process que os dois chamam.
 */
const BATCH_SIZE = 4;

export type SerializedJob = {
  id: string;
  status: EnrichmentJobStatus;
  totalCount: number;
  processedCount: number;
  foundCount: number;
  errorCount: number;
};

function serializeJob(job: {
  id: string;
  status: EnrichmentJobStatus;
  totalCount: number;
  processedCount: number;
  foundCount: number;
  errorCount: number;
}): SerializedJob {
  return {
    id: job.id,
    status: job.status,
    totalCount: job.totalCount,
    processedCount: job.processedCount,
    foundCount: job.foundCount,
    errorCount: job.errorCount,
  };
}

/** Job ativo (PENDING/RUNNING), ou o último concluído se nenhum estiver ativo. */
export async function getActiveJob(): Promise<SerializedJob | null> {
  const active = await prisma.enrichmentJob.findFirst({
    where: { status: { in: ["PENDING", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
  });
  if (active) return serializeJob(active);

  const lastDone = await prisma.enrichmentJob.findFirst({
    where: { status: "DONE" },
    orderBy: { finishedAt: "desc" },
  });
  return lastDone ? serializeJob(lastDone) : null;
}

/**
 * Coloca contatos na fila. Reaproveita o job ativo se houver um rodando,
 * em vez de criar um segundo job em paralelo (processNextBatch assume um
 * job ativo por vez).
 */
export async function enqueueContacts(
  contactIds: string[],
  createdById?: string
): Promise<{ job: SerializedJob | null; queued: number }> {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds }, enrichmentQueued: false },
    select: { id: true },
  });
  const idsToQueue = contacts.map((c) => c.id);

  if (idsToQueue.length === 0) {
    return { job: await getActiveJob(), queued: 0 };
  }

  let job = await prisma.enrichmentJob.findFirst({
    where: { status: { in: ["PENDING", "RUNNING"] } },
  });

  if (job) {
    job = await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: { totalCount: { increment: idsToQueue.length } },
    });
  } else {
    job = await prisma.enrichmentJob.create({
      data: { status: "PENDING", totalCount: idsToQueue.length, createdById },
    });
  }

  await prisma.contact.updateMany({
    where: { id: { in: idsToQueue } },
    data: { enrichmentQueued: true, enrichmentJobId: job.id },
  });

  return { job: serializeJob(job), queued: idsToQueue.length };
}

async function enrichOneContact(contact: {
  companyName: string;
  website: string | null;
}): Promise<EnrichmentVerdict & { failed: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ecommerceStatus: "DUVIDA",
      website: null,
      evidence: "ANTHROPIC_API_KEY não configurada — configure em Environment Variables na Vercel.",
      role: null,
      sector: null,
      failed: true,
    };
  }

  try {
    const verdict = await enrichCompany({
      apiKey,
      companyName: contact.companyName,
      existingWebsite: contact.website,
    });
    return { ...verdict, failed: false };
  } catch (error) {
    const message = error instanceof EnrichmentError ? error.message : "Erro desconhecido.";
    return {
      ecommerceStatus: "DUVIDA",
      website: null,
      evidence: `Erro ao enriquecer: ${message}`,
      role: null,
      sector: null,
      failed: true,
    };
  }
}

/**
 * Processa um lote do job ativo. Uma falha em um contato (ex: sem chave da
 * Anthropic) marca ele como DUVIDA com o erro registrado e segue pro
 * próximo — nunca trava a fila inteira.
 */
export async function processNextBatch(): Promise<{
  status: "IDLE" | "RUNNING" | "DONE";
  processedThisRun: number;
}> {
  const job = await prisma.enrichmentJob.findFirst({
    where: { status: { in: ["PENDING", "RUNNING"] } },
  });
  if (!job) return { status: "IDLE", processedThisRun: 0 };

  if (job.status === "PENDING") {
    await prisma.enrichmentJob.update({ where: { id: job.id }, data: { status: "RUNNING" } });
  }

  const batch = await prisma.contact.findMany({
    where: { enrichmentJobId: job.id, enrichmentQueued: true },
    take: BATCH_SIZE,
  });

  if (batch.length === 0) {
    await prisma.enrichmentJob.update({
      where: { id: job.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
    return { status: "DONE", processedThisRun: 0 };
  }

  let found = 0;
  let errors = 0;

  await Promise.all(
    batch.map(async (contact) => {
      const verdict = await enrichOneContact({ companyName: contact.companyName, website: contact.website });
      if (verdict.failed) errors += 1;
      if (verdict.ecommerceStatus === "SIM") found += 1;

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          website: verdict.website ?? contact.website,
          ecommerceStatus: verdict.ecommerceStatus,
          ecommerceEvidence: verdict.evidence,
          role: verdict.role ?? contact.role,
          sector: verdict.sector ?? contact.sector,
          enrichmentQueued: false,
          enrichedAt: new Date(),
        },
      });
    })
  );

  const remaining = await prisma.contact.count({
    where: { enrichmentJobId: job.id, enrichmentQueued: true },
  });

  await prisma.enrichmentJob.update({
    where: { id: job.id },
    data: {
      processedCount: { increment: batch.length },
      foundCount: { increment: found },
      errorCount: { increment: errors },
      ...(remaining === 0 ? { status: "DONE" as const, finishedAt: new Date() } : {}),
    },
  });

  return { status: remaining === 0 ? "DONE" : "RUNNING", processedThisRun: batch.length };
}
