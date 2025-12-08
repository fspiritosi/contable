import { formatCurrency } from "@/lib/utils";

type RankListProps = {
    title: string;
    items: { name: string; total: number }[];
    accent: string;
    emptyMessage: string;
};

export function RankList({ title, items, accent, emptyMessage }: RankListProps) {
    if (!items.length) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    const maxValue = Math.max(...items.map(item => item.total), 1);

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <div className="space-y-4">
                {items.map(item => (
                    <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-700">{item.name}</span>
                            <span className="text-gray-500">{formatCurrency(item.total)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100">
                            <div
                                className={`h-full rounded-full ${accent}`}
                                style={{ width: `${(item.total / maxValue) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}