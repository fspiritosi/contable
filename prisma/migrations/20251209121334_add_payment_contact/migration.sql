-- Add contact reference to payments without affecting existing data
ALTER TABLE "Payment"
    ADD COLUMN IF NOT EXISTS "contactId" TEXT;

ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_contactId_fkey"
        FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
