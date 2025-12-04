import { getActiveOrganizationId } from "@/lib/organization";
import { getPurchaseOrders, type SerializedPurchaseOrder } from "@/actions/purchase-orders";
import { getContacts } from "@/actions/contacts";
import { getProducts, type SerializedProduct } from "@/actions/products";
import PurchaseOrderManager from "./purchase-order-manager";
import type { Contact } from "@prisma/client";

export default async function PurchaseOrdersPage() {
  const organizationId = await getActiveOrganizationId();
  const [{ data: orders }, { data: contacts }, { data: products }] = await Promise.all([
    getPurchaseOrders(organizationId),
    getContacts(organizationId, "VENDOR"),
    getProducts(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Órdenes de Compra</h2>
          <p className="text-gray-500">Gestioná las solicitudes de compra y su ciclo de aprobación.</p>
        </div>
      </div>

      <PurchaseOrderManager
        organizationId={organizationId}
        initialOrders={(orders || []) as SerializedPurchaseOrder[]}
        contacts={(contacts || []) as Contact[]}
        products={products || []}
      />
    </div>
  );
}
