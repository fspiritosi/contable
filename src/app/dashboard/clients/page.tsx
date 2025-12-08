import CustomerContactManager from "../contacts/customer-contact-manager";

export default async function ClientsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Clientes</h2>
                    <p className="text-gray-500">Contactos que actúan como clientes.</p>
                </div>
            </div>

            <CustomerContactManager />
        </div>
    );
}
