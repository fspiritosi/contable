-- Manual migration applied via prisma db execute
-- Contains retentions models/settings and PaymentAllocation adjustments

-- CreateEnum
CREATE TYPE "RetentionTaxType" AS ENUM ('VAT', 'INCOME_TAX', 'GROSS_INCOME');

-- DropForeignKey
ALTER TABLE "PaymentAllocation" DROP CONSTRAINT IF EXISTS "PaymentAllocation_organizationId_fkey";

-- AlterTable
ALTER TABLE "PaymentAllocation" ADD COLUMN IF NOT EXISTS "retentionId" TEXT;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "paymentId" DROP NOT NULL;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "createdAt" TYPE TIMESTAMP(3);
ALTER TABLE "PaymentAllocation" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PaymentAllocation" ALTER COLUMN "updatedAt" TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetentionSetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taxType" "RetentionTaxType" NOT NULL,
    "receivableAccountId" TEXT,
    "payableAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Retention" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "contactId" TEXT,
    "taxType" "RetentionTaxType" NOT NULL,
    "baseAmount" DECIMAL(65,30) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "certificateNumber" TEXT,
    "certificateDate" TIMESTAMP(3),
    "notes" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RetentionSetting_organizationId_taxType_key" ON "RetentionSetting"("organizationId", "taxType");

-- CreateIndex (was already present in DB, so keep guarded)
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_clerkOrganizationId_key" ON "Organization"("clerkOrganizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentAllocation_retentionId_idx" ON "PaymentAllocation"("retentionId");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT IF NOT EXISTS "PaymentAllocation_retentionId_fkey" FOREIGN KEY ("retentionId") REFERENCES "Retention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionSetting" ADD CONSTRAINT IF NOT EXISTS "RetentionSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionSetting" ADD CONSTRAINT IF NOT EXISTS "RetentionSetting_receivableAccountId_fkey" FOREIGN KEY ("receivableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionSetting" ADD CONSTRAINT IF NOT EXISTS "RetentionSetting_payableAccountId_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retention" ADD CONSTRAINT IF NOT EXISTS "Retention_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retention" ADD CONSTRAINT IF NOT EXISTS "Retention_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retention" ADD CONSTRAINT IF NOT EXISTS "Retention_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Retention" ADD CONSTRAINT IF NOT EXISTS "Retention_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
