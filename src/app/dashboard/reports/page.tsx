import { getDashboardMetrics } from "@/actions/reports";
import { getActiveOrganizationId } from "@/lib/organization";
import { BarChart3, TrendingUp, TrendingDown } from "lucide-react";

export default async function ReportsPage() {
    const currentOrgId = await getActiveOrganizationId();
    const { data: metrics } = await getDashboardMetrics(currentOrgId);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Informes</h2>
                    <p className="text-gray-500">Resumen de actividad y métricas clave.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-500">Ventas Totales</h3>
                        <div className="p-2 bg-green-100 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        ${metrics?.sales.toLocaleString()}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-500">Compras Totales</h3>
                        <div className="p-2 bg-red-100 rounded-lg">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        ${metrics?.purchases.toLocaleString()}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium text-gray-500">Resultado Operativo</h3>
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                    <div className={`text-2xl font-bold ${(metrics?.sales || 0) - (metrics?.purchases || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${((metrics?.sales || 0) - (metrics?.purchases || 0)).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Placeholder for more detailed reports */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
                <p className="text-gray-500">Más informes detallados próximamente...</p>
            </div>
        </div>
    );
}
