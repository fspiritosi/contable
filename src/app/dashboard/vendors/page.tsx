import VendorContactManager from "../contacts/vendor-contact-manager";

export default async function VendorsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Proveedores</h2>
                    <p className="text-gray-500">Contactos que actúan como proveedores.</p>
                </div>
            </div>

            <VendorContactManager />
        </div>
    );
}
