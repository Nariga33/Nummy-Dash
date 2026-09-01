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

-- Módulo de Prospecção (migrations 20260901124715_prospecting_module e
-- 20260901131202_prospecting_contacts), no mesmo padrão idempotente acima.

DO $$ BEGIN
    CREATE TYPE "ProspectStatus" AS ENUM ('NOVO', 'CONTATADO', 'QUALIFICADO', 'DESCARTADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ContactPhoneStatus" AS ENUM ('NAO_SOLICITADO', 'PENDENTE', 'DISPONIVEL', 'INDISPONIVEL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ProspectSearch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeRanges" TEXT NOT NULL,
    "technologies" TEXT NOT NULL,
    "locations" TEXT NOT NULL,
    "keywords" TEXT,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProspectSearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProspectCompany" (
    "id" TEXT NOT NULL,
    "apolloOrgId" TEXT,
    "domain" TEXT,
    "name" TEXT NOT NULL,
    "linkedinUrl" TEXT,
    "websiteUrl" TEXT,
    "employeeCount" INTEGER,
    "employeeRange" TEXT,
    "industry" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "technologies" TEXT NOT NULL DEFAULT '[]',
    "ecommercePlatforms" TEXT NOT NULL DEFAULT '[]',
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOVO',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'apollo',
    "searchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectCompany_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProspectContact" (
    "id" TEXT NOT NULL,
    "apolloPersonId" TEXT,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "seniority" TEXT,
    "linkedinUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phoneStatus" "ContactPhoneStatus" NOT NULL DEFAULT 'NAO_SOLICITADO',
    "phoneRequestId" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOVO',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'apollo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectContact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProspectCompany_apolloOrgId_key" ON "ProspectCompany"("apolloOrgId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProspectCompany_domain_key" ON "ProspectCompany"("domain");
CREATE INDEX IF NOT EXISTS "ProspectCompany_status_idx" ON "ProspectCompany"("status");
CREATE INDEX IF NOT EXISTS "ProspectCompany_employeeCount_idx" ON "ProspectCompany"("employeeCount");
CREATE INDEX IF NOT EXISTS "ProspectCompany_createdAt_idx" ON "ProspectCompany"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ProspectContact_apolloPersonId_key" ON "ProspectContact"("apolloPersonId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProspectContact_phoneRequestId_key" ON "ProspectContact"("phoneRequestId");
CREATE INDEX IF NOT EXISTS "ProspectContact_companyId_idx" ON "ProspectContact"("companyId");
CREATE INDEX IF NOT EXISTS "ProspectContact_status_idx" ON "ProspectContact"("status");

DO $$ BEGIN
    ALTER TABLE "ProspectCompany" ADD CONSTRAINT "ProspectCompany_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "ProspectSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ProspectCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
