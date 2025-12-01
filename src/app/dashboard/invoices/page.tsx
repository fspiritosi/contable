import { getInvoices } from "@/actions/invoices";
import { getContacts } from "@/actions/contacts";
import { getProducts } from "@/actions/products";
import { getActiveOrganizationId } from "@/lib/organization";
import InvoiceManager from "./invoice-manager";

export default async function InvoicesPage() {
    const currentOrgId = await getActiveOrganizationId();
    const { data: invoices } = await getInvoices(currentOrgId);
    const { data: contacts } = await getContacts(currentOrgId);
    const { data: products } = await getProducts(currentOrgId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Facturación</h2>
                    <p className="text-gray-500">Gestiona tus compras y ventas.</p>
                </div>
            </div>

            <InvoiceManager
                initialInvoices={invoices || []}
                contacts={contacts || []}
                products={products || []}
                organizationId={currentOrgId}
            />
        </div>
    );
}
