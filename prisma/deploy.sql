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

CREATE TABLE IF NOT EXISTS "PipelineStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#f5b400',
    "order" INTEGER NOT NULL,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Contact" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Opportunity" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "notes" TEXT,
    "expectedCloseAt" TIMESTAMP(3),
    "contactId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Integration_provider_key" ON "Integration"("provider");
CREATE UNIQUE INDEX IF NOT EXISTS "CallRecord_externalId_key" ON "CallRecord"("externalId");
CREATE INDEX IF NOT EXISTS "CallRecord_startedAt_idx" ON "CallRecord"("startedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_externalId_key" ON "WhatsAppMessage"("externalId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_sentAt_idx" ON "WhatsAppMessage"("sentAt");
CREATE INDEX IF NOT EXISTS "PipelineStage_order_idx" ON "PipelineStage"("order");
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_email_key" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "Contact_companyName_idx" ON "Contact"("companyName");
CREATE INDEX IF NOT EXISTS "Opportunity_stageId_idx" ON "Opportunity"("stageId");
CREATE INDEX IF NOT EXISTS "Opportunity_contactId_idx" ON "Opportunity"("contactId");
CREATE INDEX IF NOT EXISTS "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");
