import { getAccounts, createAccount } from "@/actions/accounts";
import { AccountType } from "@prisma/client";
import { Plus, FolderTree } from "lucide-react";

// Simple client component for the form would be better, but for speed I'll do a server component with a client wrapper if needed.
// Actually, let's make the whole page a server component and use a client component for the list/form.

import AccountManager from "./account-manager";

export default async function ChartOfAccountsPage() {
    const { data: accounts } = await getAccounts();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Plan de Cuentas</h2>
                    <p className="text-gray-500">Gestiona la estructura contable de tu empresa.</p>
                </div>
            </div>

            <AccountManager initialAccounts={accounts || []} />
        </div>
    );
}
