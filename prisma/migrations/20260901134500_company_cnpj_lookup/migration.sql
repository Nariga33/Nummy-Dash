-- AlterTable
ALTER TABLE "ProspectCompany" ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "cnpjLookedUpAt" TIMESTAMP(3),
ADD COLUMN     "cnpjPartners" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "cnpjStatus" TEXT,
ADD COLUMN     "cnpjStatusDate" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ProspectCompany_cnpj_key" ON "ProspectCompany"("cnpj");
