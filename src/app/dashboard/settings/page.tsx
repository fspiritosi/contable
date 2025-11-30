import { getOrganizations } from "@/actions/organizations";
import OrganizationManager from "./organization-manager";
import Link from "next/link";
import { Settings2, Calendar, Building2 } from "lucide-react";

export default async function SettingsPage() {
    const { data: organizations } = await getOrganizations();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900">Configuración</h2>
                <p className="text-gray-500">Gestiona tu organización y configuraciones del sistema</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/dashboard/settings/organization" className="block group">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <Building2 className="h-5 w-5 text-purple-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                                Mi Organización
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500">
                            Ver detalles, métricas y editar información de la empresa
                        </p>
                    </div>
                </Link>

                <Link href="/dashboard/settings/accounting" className="block group">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Settings2 className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                Configuración Contable
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500">
                            Define las cuentas predeterminadas para ventas, compras y tesorería
                        </p>
                    </div>
                </Link>

                <Link href="/dashboard/settings/fiscal-periods" className="block group">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <Calendar className="h-5 w-5 text-green-600" />
                            </div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                                Períodos Fiscales
                            </h3>
                        </div>
                        <p className="text-sm text-gray-500">
                            Gestiona los ejercicios contables y períodos de operación
                        </p>
                    </div>
                </Link>
            </div>

            <OrganizationManager initialOrganizations={organizations || []} />
        </div>
    );
}
