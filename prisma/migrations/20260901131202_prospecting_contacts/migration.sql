-- CreateEnum
CREATE TYPE "ContactPhoneStatus" AS ENUM ('NAO_SOLICITADO', 'PENDENTE', 'DISPONIVEL', 'INDISPONIVEL');

-- CreateTable
CREATE TABLE "ProspectContact" (
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

-- CreateIndex
CREATE UNIQUE INDEX "ProspectContact_apolloPersonId_key" ON "ProspectContact"("apolloPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectContact_phoneRequestId_key" ON "ProspectContact"("phoneRequestId");

-- CreateIndex
CREATE INDEX "ProspectContact_companyId_idx" ON "ProspectContact"("companyId");

-- CreateIndex
CREATE INDEX "ProspectContact_status_idx" ON "ProspectContact"("status");

-- AddForeignKey
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "ProspectCompany"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
