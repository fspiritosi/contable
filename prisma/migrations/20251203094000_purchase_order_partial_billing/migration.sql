-- Drop unique index so multiple invoices can reference the same purchase order
DROP INDEX IF EXISTS "Invoice_purchaseOrderId_key";

-- Add invoicedAmount tracking column
ALTER TABLE "PurchaseOrder"
ADD COLUMN "invoicedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
