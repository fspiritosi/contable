import { getOrganizations } from "@/actions/organizations";
import { getInvoices } from "@/actions/invoices";
import { getContacts } from "@/actions/contacts";
import { getProducts } from "@/actions/products";
import InvoiceManager from "./invoice-manager";

export default async function InvoicesPage() {
    const { data: organizations } = await getOrganizations();

    if (!organizations || organizations.length === 0) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-semibold mb-2">No tienes organizaciones</h2>
                <p className="text-gray-500 mb-4">Debes crear una organización primero.</p>
            </div>
        );
    }

    const currentOrgId = organizations[0].id;
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
