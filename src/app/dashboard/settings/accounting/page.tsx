import { getOrganizations } from "@/actions/organizations";
import { getAccountingConfig } from "@/actions/accounting-config";
import { getAccounts } from "@/actions/accounts";
import AccountingConfigManager from "./accounting-config-manager";

export default async function AccountingConfigPage() {
    const { data: organizations } = await getOrganizations();

    if (!organizations || organizations.length === 0) {
        return (
            <div className="p-8 text-center">
                <p className="text-gray-500">No hay organizaciones configuradas.</p>
            </div>
        );
    }

    const currentOrgId = organizations[0].id;
    const { data: config } = await getAccountingConfig(currentOrgId);
    const { data: accounts } = await getAccounts();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Configuración Contable</h2>
                    <p className="text-gray-500">Define las cuentas contables para operaciones automáticas</p>
                </div>
            </div>

            <AccountingConfigManager
                config={config || null}
                accounts={accounts || []}
                organizationId={currentOrgId}
            />
        </div>
    );
}
