import { getActiveOrganizationId } from "@/lib/organization";
import { getAccounts } from "@/actions/accounts";
import { getRetentionSettings } from "@/actions/retentions";
import RetentionSettingsManager from "./retention-settings-manager";

export default async function RetentionSettingsPage() {
    const organizationId = await getActiveOrganizationId();
    const [{ data: accounts }, settingsRes] = await Promise.all([
        getAccounts(),
        getRetentionSettings(organizationId),
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Configuración de Retenciones</h2>
                    <p className="text-gray-500">Definí los tipos de retención, tasas y cuentas contables asociadas.</p>
                </div>
            </div>

            <RetentionSettingsManager
                initialSettings={settingsRes.success && settingsRes.data ? settingsRes.data : []}
                accounts={accounts || []}
                organizationId={organizationId}
            />
        </div>
    );
}
