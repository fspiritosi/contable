import { getJournalEntries } from "@/actions/journal";
import { getAccounts } from "@/actions/accounts";
import JournalManager from "./journal-manager";

export default async function JournalPage() {
    const { data: entries } = await getJournalEntries();
    const { data: accounts } = await getAccounts();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Libro Diario</h2>
                    <p className="text-gray-500">Registra y visualiza los asientos contables.</p>
                </div>
            </div>

            <JournalManager
                initialEntries={entries || []}
                accounts={accounts || []}
            />
        </div>
    );
}
