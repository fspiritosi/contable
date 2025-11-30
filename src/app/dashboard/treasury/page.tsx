import { getTreasuryAccounts } from "@/actions/treasury";
import { getAccounts } from "@/actions/accounts";
import { getActiveOrganizationId } from "@/lib/organization";
import AccountList from "./account-list";

export default async function TreasuryPage() {
    const currentOrgId = await getActiveOrganizationId();
    const { data: treasuryAccounts } = await getTreasuryAccounts(currentOrgId);
    const { data: accounts } = await getAccounts();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Tesorería</h2>
                    <p className="text-gray-500">Gestiona tus cajas y cuentas bancarias.</p>
                </div>
            </div>

            <AccountList
                initialAccounts={treasuryAccounts || []}
                organizationId={currentOrgId}
                chartOfAccounts={accounts || []}
            />
        </div>
    );
}
