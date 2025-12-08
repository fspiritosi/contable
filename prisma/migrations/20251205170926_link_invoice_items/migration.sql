/*
  Warnings:

  - A unique constraint covering the columns `[clerkOrganizationId]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Invoice_organizationId_flow_letter_pointOfSale_number_key";

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "purchaseOrderItemId" TEXT;



-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
