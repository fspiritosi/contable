import { getGeneralLedger } from "@/actions/ledger";
import LedgerView from "./ledger-view";

export default async function LedgerPage() {
    const { data } = await getGeneralLedger();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Libro Mayor</h2>
                    <p className="text-gray-500">Saldos y movimientos de todas las cuentas contables</p>
                </div>
            </div>

            <LedgerView
                accounts={data?.accounts || []}
                totals={data?.totals || { debit: 0, credit: 0 }}
            />
        </div>
    );
}
