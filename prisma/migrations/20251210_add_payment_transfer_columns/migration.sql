-- Add transfer metadata support to payments
-- This migration can be deployed with `npx prisma migrate deploy`

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'TransferDirection'
    ) THEN
        CREATE TYPE "TransferDirection" AS ENUM ('IN', 'OUT');
    END IF;
END $$;

ALTER TABLE "Payment"
    ADD COLUMN IF NOT EXISTS "transferGroupId" TEXT;

ALTER TABLE "Payment"
    ADD COLUMN IF NOT EXISTS "transferDirection" "TransferDirection";
