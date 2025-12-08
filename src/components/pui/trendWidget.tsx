import { formatCurrency } from "@/lib/utils";

type TrendPoint = {
    bucket: string;
    label: string;
    sales?: number;
    purchases?: number;
    collections?: number;
    payments?: number;
    net?: number;
};

type TrendWidgetProps = {
    title: string;
    subtitle: string;
    data: TrendPoint[];
    series: { key: keyof TrendPoint; label: string; color: string; background: string }[];
};

export function TrendWidget({ title, subtitle, data, series }: TrendWidgetProps) {
    if (!data.length) {
        return (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-500">Sin datos para el período seleccionado.</p>
            </div>
        );
    }

    const maxValue = Math.max(
        1,
        ...data.flatMap(point => series.map(serie => Number(point[serie.key] || 0))),
    );

    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">{subtitle}</p>
            </div>
            <div className="space-y-5">
                {data.map(point => (
                    <div key={point.bucket} className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{point.label}</span>
                            <span>
                                {series
                                    .map(serie => `${serie.label}: ${formatCurrency(Number(point[serie.key] || 0))}`)
                                    .join(" · ")}
                            </span>
                        </div>
                        {series.map(serie => (
                            <div key={serie.key.toString()} className={`${serie.background} h-2 rounded-full overflow-hidden`}>
                                <div
                                    className={`${serie.color} h-full rounded-full transition-all`}
                                    style={{ width: `${(Number(point[serie.key] || 0) / maxValue) * 100}%` }}
                                />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}