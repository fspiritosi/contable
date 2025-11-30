import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import {
    LayoutDashboard,
    ListTree,
    FileText,
    Receipt,
    Settings,
    Menu,
    Users,
    Package,
    DollarSign
} from "lucide-react";
import { getOrganizations } from "@/actions/organizations";
import { getActiveOrganizationId } from "@/lib/organization";
import OrganizationSwitcher from "@/components/organization-switcher";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: organizations } = await getOrganizations();
    const activeOrgId = await getActiveOrganizationId();

    return (
        <div className="flex min-h-screen w-full bg-white">
            {/* Sidebar */}
            <aside className="hidden border-r border-gray-200 bg-white lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:z-10">
                <div className="flex h-14 items-center border-b border-gray-200 px-6 font-semibold text-gray-900">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <span className="text-lg font-bold tracking-tight">ContableAR</span>
                    </Link>
                </div>
                <div className="flex-1 overflow-auto py-4">
                    <nav className="grid items-start px-4 text-sm font-medium gap-1">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            Dashboard
                        </Link>
                        <Link
                            href="/dashboard/accounting/chart"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <ListTree className="h-4 w-4" />
                            Plan de Cuentas
                        </Link>
                        <Link
                            href="/dashboard/accounting/journal"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <FileText className="h-4 w-4" />
                            Asientos
                        </Link>
                        <Link
                            href="/dashboard/invoices"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <Receipt className="h-4 w-4" />
                            Facturas
                        </Link>
                        <Link
                            href="/dashboard/contacts"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <Users className="h-4 w-4" />
                            Contactos
                        </Link>
                        <Link
                            href="/dashboard/inventory"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <Package className="h-4 w-4" />
                            Inventario
                        </Link>
                        <Link
                            href="/dashboard/payments"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <DollarSign className="h-4 w-4" />
                            Pagos y Cobranzas
                        </Link>
                        <Link
                            href="/dashboard/treasury"
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                        >
                            <DollarSign className="h-4 w-4" />
                            Tesorería
                        </Link>
                    </nav>
                </div>
                <div className="mt-auto p-4 border-t border-gray-200">
                    <Link
                        href="/dashboard/settings"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200"
                    >
                        <Settings className="h-4 w-4" />
                        Configuración
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex flex-col w-full lg:pl-64">
                {/* Top Bar */}
                <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-gray-200 bg-white px-6">
                    <div className="flex-1 flex items-center gap-4">
                        <OrganizationSwitcher
                            organizations={organizations || []}
                            activeOrgId={activeOrgId}
                        />
                    </div>
                    <UserButton afterSignOutUrl="/" />
                </header>
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 bg-white">
                    {children}
                </main>
            </div>
        </div>
    );
}
