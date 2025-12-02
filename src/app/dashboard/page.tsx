import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CreditCard, Activity, Users } from "lucide-react";

// Placeholder component for Card since we haven't installed shadcn/ui yet
// I will create a simple version here or assume I need to install it.
// For now, I'll inline the styles to avoid dependency issues if shadcn is not fully set up.
// Actually, I'll just use standard Tailwind for the cards to be safe.

export default function DashboardPage() {

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="tracking-tight text-sm font-semibold text-gray-700">Total Ingresos</h3>
                    <DollarSign className="h-4 w-4 text-gray-700" />
                </div>
                <div className="text-2xl font-bold text-gray-900">$45,231.89</div>
                <p className="text-xs text-gray-600 font-medium">+20.1% mes anterior</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="tracking-tight text-sm font-semibold text-gray-700">Gastos</h3>
                    <CreditCard className="h-4 w-4 text-gray-700" />
                </div>
                <div className="text-2xl font-bold text-gray-900">$12,345.00</div>
                <p className="text-xs text-gray-600 font-medium">+4.5% mes anterior</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="tracking-tight text-sm font-semibold text-gray-700">IVA a Pagar</h3>
                    <Activity className="h-4 w-4 text-gray-700" />
                </div>
                <div className="text-2xl font-bold text-gray-900">$5,678.00</div>
                <p className="text-xs text-gray-600 font-medium">+12% mes anterior</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm p-6">
                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <h3 className="tracking-tight text-sm font-semibold text-gray-700">Clientes Activos</h3>
                    <Users className="h-4 w-4 text-gray-700" />
                </div>
                <div className="text-2xl font-bold text-gray-900">573</div>
                <p className="text-xs text-gray-600 font-medium">+201 desde el mes pasado</p>
            </div>
        </div>
    );
}
