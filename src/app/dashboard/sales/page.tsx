import { getInvoices } from "@/actions/invoices";
import { getContacts } from "@/actions/contacts";
import { getProducts } from "@/actions/products";
import { getActiveOrganizationId } from "@/lib/organization";
import InvoiceManager from "../invoices/invoice-manager";

export default async function SalesInvoicesPage() {
    const organizationId = await getActiveOrganizationId();
    const [{ data: invoices }, { data: contacts }, { data: products }] = await Promise.all([
        getInvoices(organizationId, "SALE"),
        getContacts(organizationId, "CUSTOMER"),
        getProducts(organizationId),
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Facturas de Venta</h2>
                    <p className="text-gray-500">Registra y gestiona las ventas emitidas a tus clientes.</p>
                </div>
            </div>

            <InvoiceManager
                initialInvoices={invoices || []}
                contacts={contacts || []}
                products={products || []}
                organizationId={organizationId}
                defaultFlow="SALE"
                hideFlowFilters
            />
        </div>
    );
}
