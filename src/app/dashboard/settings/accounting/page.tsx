import { getAccountingConfig } from "@/actions/accounting-config";
import { getAccounts } from "@/actions/accounts";
import { getActiveOrganizationId } from "@/lib/organization";
import AccountingConfigManager from "./accounting-config-manager";

export default async function AccountingConfigPage() {
    const currentOrgId = await getActiveOrganizationId();
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
