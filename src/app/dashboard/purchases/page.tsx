import { getInvoices } from "@/actions/invoices";
import { getContacts } from "@/actions/contacts";
import { getProducts } from "@/actions/products";
import { getInvoiceReadyPurchaseOrders } from "@/actions/purchase-orders";
import { getActiveOrganizationId } from "@/lib/organization";
import InvoiceManager from "../invoices/invoice-manager";

type PurchaseInvoicesPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchaseInvoicesPage({ searchParams }: PurchaseInvoicesPageProps) {
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const purchaseOrderParam = resolvedSearchParams?.purchaseOrderId;
    const initialPurchaseOrderId = typeof purchaseOrderParam === "string" ? purchaseOrderParam : undefined;
    const organizationId = await getActiveOrganizationId();
    const [
        { data: invoices },
        { data: contacts },
        { data: products },
        { data: purchaseOrders },
    ] = await Promise.all([
        getInvoices(organizationId, "PURCHASE"),
        getContacts(organizationId, "VENDOR"),
        getProducts(organizationId),
        getInvoiceReadyPurchaseOrders(organizationId),
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Facturas de Compra</h2>
                    <p className="text-gray-500">Registra y controla las facturas recibidas de tus proveedores.</p>
                </div>
            </div>

            <InvoiceManager
                initialInvoices={invoices || []}
                contacts={contacts || []}
                products={products || []}
                organizationId={organizationId}
                defaultFlow="PURCHASE"
                hideFlowFilters
                purchaseOrders={purchaseOrders || []}
                initialPurchaseOrderId={initialPurchaseOrderId}
            />
        </div>
    );
}
