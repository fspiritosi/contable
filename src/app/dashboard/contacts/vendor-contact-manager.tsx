import { getContacts } from "@/actions/contacts";
import { getActiveOrganizationId } from "@/lib/organization";
import ContactManager from "./contact-manager";

export default async function VendorContactManager() {
    const organizationId = await getActiveOrganizationId();
    const { data } = await getContacts(organizationId, "VENDOR");

    return (
        <ContactManager
            initialContacts={data || []}
            organizationId={organizationId}
            defaultType="VENDOR"
            hideTypeFilters
        />
    );
}
