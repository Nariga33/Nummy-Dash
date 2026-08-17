-- Versão idempotente da migração inicial, usada só no build de produção
-- (scripts/build.sh) via `prisma db execute`. Diferente de `migrate deploy`,
-- `db execute` não usa advisory lock — necessário porque a conexão pooled
-- do Neon não sustenta esse lock (erro P1002). Seguro rodar em todo deploy:
-- cada comando é IF NOT EXISTS / no-op se já existir.

DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Integration" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" TEXT NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CallRecord" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "agentName" TEXT,
    "fromNumber" TEXT,
    "toNumber" TEXT,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "direction" TEXT NOT NULL,
    "status" TEXT,
    "agentName" TEXT,
    "contact" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "raw" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Integration_provider_key" ON "Integration"("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "CallRecord_externalId_key" ON "CallRecord"("externalId");
CREATE INDEX IF NOT EXISTS "CallRecord_startedAt_idx" ON "CallRecord"("startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_externalId_key" ON "WhatsAppMessage"("externalId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_sentAt_idx" ON "WhatsAppMessage"("sentAt");
