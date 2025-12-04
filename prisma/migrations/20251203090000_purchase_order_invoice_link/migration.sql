-- AlterTable
ALTER TABLE "Invoice"
ADD COLUMN "purchaseOrderId" TEXT;

ALTER TABLE "PurchaseOrder"
ADD COLUMN "invoicedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_purchaseOrderId_key" ON "Invoice"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
