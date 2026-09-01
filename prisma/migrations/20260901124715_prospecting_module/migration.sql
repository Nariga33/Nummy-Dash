-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NOVO', 'CONTATADO', 'QUALIFICADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "ProspectSearch" (
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

-- CreateTable
CREATE TABLE "ProspectCompany" (
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

-- CreateIndex
CREATE UNIQUE INDEX "ProspectCompany_apolloOrgId_key" ON "ProspectCompany"("apolloOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectCompany_domain_key" ON "ProspectCompany"("domain");

-- CreateIndex
CREATE INDEX "ProspectCompany_status_idx" ON "ProspectCompany"("status");

-- CreateIndex
CREATE INDEX "ProspectCompany_employeeCount_idx" ON "ProspectCompany"("employeeCount");

-- CreateIndex
CREATE INDEX "ProspectCompany_createdAt_idx" ON "ProspectCompany"("createdAt");

-- AddForeignKey
ALTER TABLE "ProspectCompany" ADD CONSTRAINT "ProspectCompany_searchId_fkey" FOREIGN KEY ("searchId") REFERENCES "ProspectSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
