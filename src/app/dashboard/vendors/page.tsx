import { getContacts } from "@/actions/contacts";
import { getActiveOrganizationId } from "@/lib/organization";
import ContactManager from "../contacts/contact-manager";

export default async function VendorsPage() {
    const organizationId = await getActiveOrganizationId();
    const { data } = await getContacts(organizationId, "VENDOR");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Proveedores</h2>
                    <p className="text-gray-500">Contactos que actúan como proveedores.</p>
                </div>
            </div>

            <ContactManager
                initialContacts={data || []}
                organizationId={organizationId}
                defaultType="VENDOR"
                hideTypeFilters
            />
        </div>
    );
}
