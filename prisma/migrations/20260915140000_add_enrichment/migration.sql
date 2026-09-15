-- CreateEnum
CREATE TYPE "EcommerceStatus" AS ENUM ('NAO_VERIF', 'SIM', 'NAO', 'DUVIDA');

-- CreateEnum
CREATE TYPE "Qualification" AS ENUM ('QUALIFICADO', 'NAO_QUALIFICADO');

-- CreateEnum
CREATE TYPE "EnrichmentJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "EnrichmentJob" (
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

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "website" TEXT,
ADD COLUMN     "ecommerceStatus" "EcommerceStatus" NOT NULL DEFAULT 'NAO_VERIF',
ADD COLUMN     "ecommerceEvidence" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "qualification" "Qualification",
ADD COLUMN     "enrichmentQueued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enrichmentJobId" TEXT,
ADD COLUMN     "enrichedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EnrichmentJob_status_idx" ON "EnrichmentJob"("status");

-- CreateIndex
CREATE INDEX "Contact_ecommerceStatus_idx" ON "Contact"("ecommerceStatus");

-- CreateIndex
CREATE INDEX "Contact_enrichmentQueued_idx" ON "Contact"("enrichmentQueued");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_enrichmentJobId_fkey" FOREIGN KEY ("enrichmentJobId") REFERENCES "EnrichmentJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
