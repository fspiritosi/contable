import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import {
    LayoutDashboard,
    FileText,
    Receipt,
    Settings,
    Package,
    DollarSign,
    BookOpen,
    ChevronDown,
} from "lucide-react";
import { getOrganizations } from "@/actions/organizations";
import { getActiveOrganizationId } from "@/lib/organization";
import OrganizationSwitcher from "@/components/organization-switcher";
import CreateFirstOrganization from "@/components/create-first-organization";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: organizations } = await getOrganizations();

    if (!organizations || organizations.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="max-w-md w-full">
                    <CreateFirstOrganization />
                </div>
            </div>
        );
    }

type NavLinkProps = {
    href: string;
    icon?: ReactNode;
    children: ReactNode;
    className?: string;
};

function NavLink({ href, icon, children, className }: NavLinkProps) {
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-gray-700 transition-all hover:text-gray-950 hover:bg-gray-100 border border-transparent hover:border-gray-200",
                className,
            )}
        >
            {icon}
            {children}
        </Link>
    );
}

type NavSubLinkProps = {
    href: string;
    children: ReactNode;
};

function NavSubLink({ href, children }: NavSubLinkProps) {
    return (
        <Link
            href={href}
            className="ml-6 flex items-center rounded-md px-3 py-1.5 text-sm text-gray-600 transition-all hover:text-gray-900 hover:bg-gray-100"
        >
            {children}
        </Link>
    );
}

type AccordionProps = {
    label: string;
    icon?: ReactNode;
    children: ReactNode;
};

function Accordion({ label, icon, children }: AccordionProps) {
    return (
        <details className="group" open>
            <summary className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-gray-700 transition hover:bg-gray-50">
                <span className="flex items-center gap-3">
                    {icon}
                    <span className="font-medium">{label}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
            </summary>
            <div className="mt-1 space-y-1">
                {children}
            </div>
        </details>
    );
}

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
                    <nav className="space-y-1 px-4 text-sm font-medium">
                        <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</NavLink>

                        <Accordion label="Contabilidad" icon={<BookOpen className="h-4 w-4" />}>
                            <NavSubLink href="/dashboard/accounting/chart">Plan de Cuentas</NavSubLink>
                            <NavSubLink href="/dashboard/accounting/ledger">Libro Mayor</NavSubLink>
                            <NavSubLink href="/dashboard/accounting/journal">Libro Diario</NavSubLink>
                        </Accordion>

                        <Accordion label="Ventas" icon={<Receipt className="h-4 w-4" />}>
                            <NavSubLink href="/dashboard/sales">Facturas de Venta</NavSubLink>
                            <NavSubLink href="/dashboard/clients">Clientes</NavSubLink>
                        </Accordion>

                        <Accordion label="Compras" icon={<Receipt className="h-4 w-4" />}>
                            <NavSubLink href="/dashboard/purchases">Facturas de Compra</NavSubLink>
                            <NavSubLink href="/dashboard/purchases/orders">Órdenes de Compra</NavSubLink>
                            <NavSubLink href="/dashboard/vendors">Proveedores</NavSubLink>
                        </Accordion>

                        <NavLink href="/dashboard/inventory" icon={<Package className="h-4 w-4" />}>Inventario</NavLink>

                        <Accordion label="Tesorería" icon={<DollarSign className="h-4 w-4" />}>
                            <NavSubLink href="/dashboard/payments">Pagos y Cobranzas</NavSubLink>
                            <NavSubLink href="/dashboard/treasury">Cajas y Bancos</NavSubLink>
                        </Accordion>
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
