import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const AGENTS = ["Ana Souza", "Bruno Lima", "Carla Nunes", "Diego Alves"];
const CALL_STATUSES = [
  { status: "ANSWERED", weight: 6 },
  { status: "NO_ANSWER", weight: 3 },
  { status: "BUSY", weight: 1 },
  { status: "FAILED", weight: 1 },
];

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    if (r < item.weight) return item;
    r -= item.weight;
  }
  return items[items.length - 1];
}

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@empresa.com").toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuário admin já existe: ${email}`);
    return;
  }

  const password = process.env.ADMIN_PASSWORD ?? "TrocarSenha123!";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME ?? "Administrador",
      email,
      passwordHash,
      role: "ADMIN",
      active: true,
    },
  });

  console.log(`Usuário admin criado: ${email} (senha definida via ADMIN_PASSWORD no .env)`);
}

async function seedDemoData() {
  const existingCalls = await prisma.callRecord.count();
  if (existingCalls > 0) {
    console.log("Já existem dados de chamadas, pulando seed de demonstração.");
    return;
  }

  const now = Date.now();
  const days = 30;

  const calls = [];
  const messages = [];

  for (let d = 0; d < days; d++) {
    const dayStart = now - d * 24 * 60 * 60 * 1000;
    const callsToday = 15 + Math.floor(Math.random() * 25);
    for (let i = 0; i < callsToday; i++) {
      const { status } = weightedPick(CALL_STATUSES);
      const startedAt = new Date(dayStart - Math.floor(Math.random() * 8 * 60 * 60 * 1000));
      calls.push({
        externalId: `demo-call-${d}-${i}`,
        direction: "OUTBOUND",
        status,
        agentName: AGENTS[Math.floor(Math.random() * AGENTS.length)],
        fromNumber: "+55 11 4000-0000",
        toNumber: `+55 11 9${Math.floor(10000000 + Math.random() * 89999999)}`,
        durationSec: status === "ANSWERED" ? 30 + Math.floor(Math.random() * 240) : 0,
        startedAt,
        isDemo: true,
      });
    }

    const messagesToday = 20 + Math.floor(Math.random() * 40);
    for (let i = 0; i < messagesToday; i++) {
      const sentAt = new Date(dayStart - Math.floor(Math.random() * 8 * 60 * 60 * 1000));
      messages.push({
        externalId: `demo-wa-${d}-${i}`,
        direction: Math.random() < 0.7 ? "SENT" : "RECEIVED",
        status: "DELIVERED",
        agentName: AGENTS[Math.floor(Math.random() * AGENTS.length)],
        contact: `+55 11 9${Math.floor(10000000 + Math.random() * 89999999)}`,
        sentAt,
        isDemo: true,
      });
    }
  }

  await prisma.callRecord.createMany({ data: calls });
  await prisma.whatsAppMessage.createMany({ data: messages });
  console.log(`Seed de demonstração criado: ${calls.length} ligações, ${messages.length} mensagens.`);
}

async function main() {
  await seedAdmin();
  await seedDemoData();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
