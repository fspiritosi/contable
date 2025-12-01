import { getFiscalPeriods } from "@/actions/fiscal-periods";
import { getActiveOrganizationId } from "@/lib/organization";
import FiscalPeriodManager from "./fiscal-period-manager";

export default async function FiscalPeriodsPage() {
    const currentOrgId = await getActiveOrganizationId();
    const { data: periods } = await getFiscalPeriods(currentOrgId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Períodos Fiscales</h2>
                    <p className="text-gray-500">Gestiona los ejercicios contables de tu organización</p>
                </div>
            </div>

            <FiscalPeriodManager
                initialPeriods={periods || []}
                organizationId={currentOrgId}
            />
        </div>
    );
}
