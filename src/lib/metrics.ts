import { prisma } from "@/lib/prisma";

export type DayPoint = { date: string; calls: number; whatsapp: number };

export type MetricsSummary = {
  range: { from: string; to: string };
  calls: {
    total: number;
    answered: number;
    noAnswer: number;
    avgDurationSec: number;
    byStatus: { status: string; count: number }[];
  };
  whatsapp: {
    total: number;
    sent: number;
    received: number;
  };
  daily: DayPoint[];
  isDemoData: boolean;
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const ANSWERED_STATUSES = new Set(["ANSWERED", "COMPLETED", "SUCCESS"]);

export async function getMetricsSummary(from: Date, to: Date): Promise<MetricsSummary> {
  const [calls, whatsapp] = await Promise.all([
    prisma.callRecord.findMany({
      where: { startedAt: { gte: from, lte: to } },
      select: { status: true, durationSec: true, startedAt: true, isDemo: true },
    }),
    prisma.whatsAppMessage.findMany({
      where: { sentAt: { gte: from, lte: to } },
      select: { direction: true, sentAt: true, isDemo: true },
    }),
  ]);

  const statusCounts = new Map<string, number>();
  let answered = 0;
  let totalDuration = 0;
  const dayMap = new Map<string, { calls: number; whatsapp: number }>();

  for (const call of calls) {
    statusCounts.set(call.status, (statusCounts.get(call.status) ?? 0) + 1);
    if (ANSWERED_STATUSES.has(call.status)) answered += 1;
    totalDuration += call.durationSec;

    const key = dayKey(call.startedAt);
    const entry = dayMap.get(key) ?? { calls: 0, whatsapp: 0 };
    entry.calls += 1;
    dayMap.set(key, entry);
  }

  let sent = 0;
  let received = 0;
  for (const msg of whatsapp) {
    if (msg.direction === "SENT") sent += 1;
    else received += 1;

    const key = dayKey(msg.sentAt);
    const entry = dayMap.get(key) ?? { calls: 0, whatsapp: 0 };
    entry.whatsapp += 1;
    dayMap.set(key, entry);
  }

  const daily: DayPoint[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = dayKey(cursor);
    const entry = dayMap.get(key) ?? { calls: 0, whatsapp: 0 };
    daily.push({ date: key, calls: entry.calls, whatsapp: entry.whatsapp });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const isDemoData = calls.some((c) => c.isDemo) || whatsapp.some((m) => m.isDemo);

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    calls: {
      total: calls.length,
      answered,
      noAnswer: calls.length - answered,
      avgDurationSec: calls.length > 0 ? Math.round(totalDuration / calls.length) : 0,
      byStatus: Array.from(statusCounts.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    },
    whatsapp: {
      total: whatsapp.length,
      sent,
      received,
    },
    daily,
    isDemoData,
  };
}
