import { getContacts } from "@/actions/contacts";
import { getActiveOrganizationId } from "@/lib/organization";
import ContactManager from "./contact-manager";

export default async function ContactsPage() {
    const currentOrgId = await getActiveOrganizationId();
    const { data: contacts } = await getContacts(currentOrgId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Clientes y Proveedores</h2>
                    <p className="text-gray-500">Gestiona tu agenda de contactos.</p>
                </div>
            </div>

            <ContactManager
                initialContacts={contacts || []}
                organizationId={currentOrgId}
            />
        </div>
    );
}
