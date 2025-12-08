import { getDashboardMetrics } from "@/actions/reports";
import { getActiveOrganizationId } from "@/lib/organization";
import {
    Activity,
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    CreditCard,
    DollarSign,
    PieChart,
    TrendingDown,
    TrendingUp,
    Users,
    Wallet,
} from "lucide-react";
import { MONTHS } from "@/lib/const";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { StatCard } from "@/components/pui/statCard";
import { TrendWidget } from "@/components/pui/trendWidget";
import { SalesMixWidget } from "@/components/pui/salesMixWidget";
import { RankList } from "@/components/pui/rankingList";
import { OverdueTable } from "@/components/pui/overdueTable";


type DashboardPageProps = {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};





export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const now = new Date();
    const resolvedSearchParams = searchParams ? await searchParams : undefined;
    const getParam = (key: string) => {
        const value = resolvedSearchParams?.[key];
        if (Array.isArray(value)) return value[0];
        return value;
    };

    const monthParam = getParam("month");
    const yearParam = getParam("year");
    const rangeParam = getParam("range");
    const selectedMonth = monthParam ? Number(monthParam) : now.getMonth() + 1;
    const selectedYear = yearParam ? Number(yearParam) : now.getFullYear();
    const rangeMode = rangeParam === "12m" ? "12m" : "6m";
    const trailingMonths = rangeMode === "12m" ? 12 : 6;

    const organizationId = await getActiveOrganizationId();
    const metricsResult = await getDashboardMetrics(organizationId, {
        month: selectedMonth,
        year: selectedYear,
        trailingMonths,
    });

    if (!metricsResult.success || !metricsResult.data) {
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-bold text-gray-900">Panel General</h1>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
                    No pudimos cargar los indicadores. Vuelve a intentarlo en unos minutos.
                </div>
            </div>
        );
    }

    const metrics = metricsResult.data;
    const income = metrics.sales || 0;
    const expenses = metrics.purchases || 0;
    const vatBalance = metrics.vatBalance || 0;
    const vatLabel = vatBalance >= 0 ? "IVA a Pagar" : "IVA a Favor";
    const operatingResult = income - expenses;
    const collections = metrics.collections || 0;
    const payments = metrics.payments || 0;
    const cashDelta = collections - payments;
    const cashTone = cashDelta >= 0 ? "success" : "danger";

    const years = Array.from({ length: 6 }, (_, index) => now.getFullYear() - index);
    const headerLabel = `${MONTHS[Math.max(0, selectedMonth - 1)]} ${selectedYear}`;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Panel General</h1>
                    <p className="text-sm text-gray-500">Resumen financiero de {headerLabel}</p>
                </div>
                <form className="flex flex-wrap items-center gap-3" method="get">
                    <div className="flex flex-col text-xs text-gray-500">
                        <label className="font-medium">Mes</label>
                        <select
                            name="month"
                            defaultValue={String(selectedMonth)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        >
                            {MONTHS.map((label, index) => (
                                <option key={label} value={index + 1}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col text-xs text-gray-500">
                        <label className="font-medium">Año</label>
                        <select
                            name="year"
                            defaultValue={String(selectedYear)}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        >
                            {years.map(year => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col text-xs text-gray-500">
                        <label className="font-medium">Rango gráficas</label>
                        <select
                            name="range"
                            defaultValue={rangeMode}
                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        >
                            <option value="6m">Últimos 6 meses</option>
                            <option value="12m">Últimos 12 meses</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                    >
                        Aplicar
                    </button>
                </form>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Total Ingresos"
                    helper="Facturación del período"
                    value={formatCurrency(income)}
                    icon={<DollarSign className="h-5 w-5" />}
                />
                <StatCard
                    title="Gastos"
                    helper="Compras del período"
                    value={formatCurrency(expenses)}
                    icon={<CreditCard className="h-5 w-5" />}
                />
                <StatCard
                    title={vatLabel}
                    helper={`IVA Ventas ${formatCurrency(metrics.vatSales || 0)} · IVA Compras ${formatCurrency(metrics.vatPurchases || 0)}`}
                    value={formatCurrency(Math.abs(vatBalance))}
                    tone={vatBalance >= 0 ? "danger" : "success"}
                    icon={<Activity className="h-5 w-5" />}
                />
                <StatCard
                    title="Clientes Activos"
                    helper="Clientes registrados"
                    value={formatNumber(metrics.activeClients || 0)}
                    icon={<Users className="h-5 w-5" />}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <StatCard
                    title="Resultado Operativo"
                    helper="Ingresos - Gastos"
                    value={formatCurrency(operatingResult)}
                    tone={operatingResult >= 0 ? "success" : "danger"}
                    icon={operatingResult >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    footer={
                        <span className="text-xs">
                            Ingresos {formatCurrency(income)} · Gastos {formatCurrency(expenses)}
                        </span>
                    }
                />
                <StatCard
                    title="Cobranzas"
                    helper={`Pagos ${formatCurrency(payments)}`}
                    value={formatCurrency(collections)}
                    tone={cashTone}
                    icon={<Wallet className="h-5 w-5" />}
                    footer={<span>Neto: {formatCurrency(cashDelta)}</span>}
                />
                <StatCard
                    title="Caja y Bancos"
                    helper="Saldo consolidado de tesorería"
                    value={formatCurrency(metrics.treasuryBalance || 0)}
                    icon={<BarChart3 className="h-5 w-5" />}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <TrendWidget
                    title="Ventas vs Compras"
                    subtitle={`Evolución últimos ${trailingMonths} meses`}
                    data={metrics.salesTrend}
                    series={[
                        { key: "sales", label: "Ventas", color: "bg-emerald-500", background: "bg-emerald-100" },
                        { key: "purchases", label: "Compras", color: "bg-rose-500", background: "bg-rose-100" },
                    ]}
                />
                <TrendWidget
                    title="Cobranzas vs Pagos"
                    subtitle={`Evolución últimos ${trailingMonths} meses`}
                    data={metrics.cashFlowTrend}
                    series={[
                        { key: "collections", label: "Cobranzas", color: "bg-indigo-500", background: "bg-indigo-100" },
                        { key: "payments", label: "Pagos", color: "bg-amber-500", background: "bg-amber-100" },
                    ]}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Mix por letra</h3>
                            <p className="text-sm text-gray-500">Composición de ventas</p>
                        </div>
                        <PieChart className="h-5 w-5 text-gray-400" />
                    </div>
                    <SalesMixWidget data={metrics.salesMix} />
                </div>
                <RankList
                    title="Top Clientes"
                    items={(metrics.topCustomers || []).map(item => ({ name: item.name, total: item.total }))}
                    accent="bg-emerald-500"
                    emptyMessage="Todavía no hay clientes con facturación en este período."
                />
                <RankList
                    title="Top Proveedores"
                    items={(metrics.topVendors || []).map(item => ({ name: item.name, total: item.total }))}
                    accent="bg-indigo-500"
                    emptyMessage="Todavía no hay compras registradas."
                />
            </div>

            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Alertas de cobranza</h3>
                        <p className="text-sm text-gray-500">Facturas vencidas y saldo pendiente</p>
                    </div>
                </div>
                <OverdueTable invoices={metrics.overdueInvoices || []} />
            </div>
        </div>
    );
}

