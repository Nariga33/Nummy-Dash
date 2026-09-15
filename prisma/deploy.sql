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
    "cnpj" TEXT,
    "cnpjStatus" TEXT,
    "cnpjStatusDate" TIMESTAMP(3),
    "cnpjPartners" TEXT NOT NULL DEFAULT '[]',
    "cnpjLookedUpAt" TIMESTAMP(3),
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOVO',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'apollo',
    "searchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectCompany_pkey" PRIMARY KEY ("id")
);

-- Colunas de CNPJ podem não existir ainda se a tabela ProspectCompany já foi
-- criada por um deploy anterior (CREATE TABLE IF NOT EXISTS acima não altera
-- tabela existente) — adiciona de forma idempotente.
ALTER TABLE "ProspectCompany" ADD COLUMN IF NOT EXISTS "cnpj" TEXT;
ALTER TABLE "ProspectCompany" ADD COLUMN IF NOT EXISTS "cnpjStatus" TEXT;
ALTER TABLE "ProspectCompany" ADD COLUMN IF NOT EXISTS "cnpjStatusDate" TIMESTAMP(3);
ALTER TABLE "ProspectCompany" ADD COLUMN IF NOT EXISTS "cnpjPartners" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProspectCompany" ADD COLUMN IF NOT EXISTS "cnpjLookedUpAt" TIMESTAMP(3);

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
CREATE UNIQUE INDEX IF NOT EXISTS "ProspectCompany_cnpj_key" ON "ProspectCompany"("cnpj");
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

CREATE INDEX IF NOT EXISTS "PipelineStage_order_idx" ON "PipelineStage"("order");
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_email_key" ON "Contact"("email");
CREATE INDEX IF NOT EXISTS "Contact_companyName_idx" ON "Contact"("companyName");
CREATE INDEX IF NOT EXISTS "Opportunity_stageId_idx" ON "Opportunity"("stageId");
CREATE INDEX IF NOT EXISTS "Opportunity_contactId_idx" ON "Opportunity"("contactId");
CREATE INDEX IF NOT EXISTS "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");

-- Enriquecimento de leads com IA (migration 20260915140000_add_enrichment),
-- no mesmo padrão idempotente acima.

DO $$ BEGIN
    CREATE TYPE "EcommerceStatus" AS ENUM ('NAO_VERIF', 'SIM', 'NAO', 'DUVIDA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "Qualification" AS ENUM ('QUALIFICADO', 'NAO_QUALIFICADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EnrichmentJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "EnrichmentJob" (
    "id" TEXT NOT NULL,
    "status" "EnrichmentJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- Colunas de enriquecimento podem não existir ainda se a tabela Contact já
-- foi criada por um deploy anterior — adiciona de forma idempotente.
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "ecommerceStatus" "EcommerceStatus" NOT NULL DEFAULT 'NAO_VERIF';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "ecommerceEvidence" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "role" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "sector" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "qualification" "Qualification";
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "enrichmentQueued" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "enrichmentJobId" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "enrichedAt" TIMESTAMP(3);

DO $$ BEGIN
    ALTER TABLE "Contact" ADD CONSTRAINT "Contact_enrichmentJobId_fkey" FOREIGN KEY ("enrichmentJobId") REFERENCES "EnrichmentJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "EnrichmentJob_status_idx" ON "EnrichmentJob"("status");
CREATE INDEX IF NOT EXISTS "Contact_ecommerceStatus_idx" ON "Contact"("ecommerceStatus");
CREATE INDEX IF NOT EXISTS "Contact_enrichmentQueued_idx" ON "Contact"("enrichmentQueued");
