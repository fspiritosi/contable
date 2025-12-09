-- Add tracking columns to invoices and payments
ALTER TABLE "Invoice"
    ADD COLUMN IF NOT EXISTS "amountAllocated" DECIMAL(65,30) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "amountRemaining" DECIMAL(65,30) NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
    ADD COLUMN IF NOT EXISTS "amountAllocated" DECIMAL(65,30) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "amountRemaining" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Create payment allocation table
CREATE TABLE IF NOT EXISTS "PaymentAllocation" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PaymentAllocation_paymentId_idx" ON "PaymentAllocation" ("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation" ("invoiceId");
