-- Backfill allocation tracking columns for existing records

-- Payments already linked directly to invoices should be fully allocated
UPDATE "Payment"
SET "amountAllocated" = "amount",
    "amountRemaining" = 0
WHERE "invoiceId" IS NOT NULL;

-- Payments without invoice links default to full remaining balance when unset
UPDATE "Payment"
SET "amountRemaining" = "amount"
WHERE "invoiceId" IS NULL
  AND ("amountRemaining" IS NULL OR "amountRemaining" = 0);

-- Compute allocated totals per invoice from existing direct payments
WITH paid AS (
    SELECT "invoiceId", COALESCE(SUM("amount"), 0) AS total_paid
    FROM "Payment"
    WHERE "invoiceId" IS NOT NULL
    GROUP BY "invoiceId"
)
UPDATE "Invoice" AS i
SET "amountAllocated" = paid.total_paid,
    "amountRemaining" = i."totalAmount" - paid.total_paid
FROM paid
WHERE i."id" = paid."invoiceId";

-- For invoices without direct payments, ensure remaining equals total amount
UPDATE "Invoice"
SET "amountRemaining" = "totalAmount"
WHERE ("amountAllocated" IS NULL OR "amountAllocated" = 0)
  AND ("amountRemaining" IS NULL OR "amountRemaining" = 0);
