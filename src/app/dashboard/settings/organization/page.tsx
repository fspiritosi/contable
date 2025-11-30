import { getActiveOrganizationId } from "@/lib/organization";
import { getOrganizations, getOrganizationMetrics } from "@/actions/organizations";
import OrganizationDetail from "./organization-detail";

export default async function OrganizationPage() {
    const activeOrgId = await getActiveOrganizationId();
    const { data: organizations } = await getOrganizations();
    const activeOrg = organizations?.find(org => org.id === activeOrgId);
    const { data: metrics } = await getOrganizationMetrics(activeOrgId);

    if (!activeOrg) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-500">Organización no encontrada</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">
                    Detalles de la Organización
                </h2>
                <p className="text-gray-500">
                    Información y métricas de {activeOrg.name}
                </p>
            </div>

            <OrganizationDetail organization={activeOrg} metrics={metrics} />
        </div>
    );
}
