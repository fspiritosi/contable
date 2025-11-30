import { getOrganizations } from "@/actions/organizations";
import { getPayments } from "@/actions/payments";
import { getInvoices } from "@/actions/invoices";
import PaymentManager from "./payment-manager";

export default async function PaymentsPage() {
    const { data: organizations } = await getOrganizations();

    if (!organizations || organizations.length === 0) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-500">No hay organizaciones configuradas.</p>
            </div>
        );
    }

    const currentOrgId = organizations[0].id;
    const { data: payments } = await getPayments(currentOrgId);
    const { data: invoices } = await getInvoices(currentOrgId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Pagos y Cobranzas</h2>
                    <p className="text-gray-500">Gestiona pagos a proveedores y cobranzas de clientes</p>
                </div>
            </div>

            <PaymentManager
                initialPayments={payments || []}
                invoices={invoices || []}
                organizationId={currentOrgId}
            />
        </div>
    );
}
