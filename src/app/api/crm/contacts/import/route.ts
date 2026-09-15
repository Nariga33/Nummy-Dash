import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-auth";
import { enqueueContacts } from "@/lib/enrichment-queue";

const rowSchema = z.object({
  companyName: z.string().trim().min(1),
  name: z.string().trim().min(1),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  phone2: z.string().trim().optional(),
  website: z.string().trim().optional(),
});

const importSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "Nenhuma linha para importar."),
  autoEnrich: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { session, response } = await requireSession();
  if (response) return response;

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Arquivo inválido." }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const contactIds: string[] = [];

  for (const raw of parsed.data.rows) {
    const row = rowSchema.safeParse({
      companyName: raw.companyName,
      name: raw.name,
      email: raw.email,
      phone: raw.phone,
      phone2: raw.phone2,
      website: raw.website,
    });
    if (!row.success) {
      skipped++;
      continue;
    }

    const email = row.data.email?.toLowerCase() || undefined;
    const data = {
      companyName: row.data.companyName,
      name: row.data.name,
      email,
      phone: row.data.phone || undefined,
      phone2: row.data.phone2 || undefined,
      website: row.data.website || undefined,
    };

    if (email) {
      const existing = await prisma.contact.findUnique({ where: { email } });
      if (existing) {
        const contact = await prisma.contact.update({ where: { id: existing.id }, data });
        contactIds.push(contact.id);
        updated++;
        continue;
      }
    }

    const contact = await prisma.contact.create({ data });
    contactIds.push(contact.id);
    created++;
  }

  let enqueued = 0;
  if (parsed.data.autoEnrich && contactIds.length > 0) {
    const result = await enqueueContacts(contactIds, session!.user.id);
    enqueued = result.queued;
  }

  return NextResponse.json({ created, updated, skipped, enqueued });
}
