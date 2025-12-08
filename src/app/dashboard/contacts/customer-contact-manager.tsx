import { getContacts } from "@/actions/contacts";
import { getActiveOrganizationId } from "@/lib/organization";
import ContactManager from "./contact-manager";

export default async function CustomerContactManager() {
    const organizationId = await getActiveOrganizationId();
    const { data } = await getContacts(organizationId, "CUSTOMER");

    return (
        <ContactManager
            initialContacts={data || []}
            organizationId={organizationId}
            defaultType="CUSTOMER"
            hideTypeFilters
        />
    );
}
