

import { formatCurrency, formatPercent } from "@/lib/utils";

type MixEntry = { letter: string; amount: number; percentage: number };

export function SalesMixWidget({ data }: { data: MixEntry[] }) {
    if (!data.length) {
        return <p className="text-sm text-gray-500">Aún no hay facturación con composición registrada.</p>;
    }
    return (
        <div className="space-y-4">
            {data.map(entry => (
                <div key={entry.letter} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700">Factura {entry.letter}</span>
                        <span className="text-gray-500">{formatPercent(entry.percentage)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                        <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${entry.percentage * 100}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-500">{formatCurrency(entry.amount)}</p>
                </div>
            ))}
        </div>
    );
}