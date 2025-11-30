'use client';

import { useState } from "react";
import { Organization } from "@prisma/client";
import { createOrganization } from "@/actions/organizations";
import { Plus, Building2, MapPin } from "lucide-react";

interface OrganizationManagerProps {
    initialOrganizations: Organization[];
}

export default function OrganizationManager({ initialOrganizations }: OrganizationManagerProps) {
    const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
    const [isCreating, setIsCreating] = useState(false);

    const [newOrg, setNewOrg] = useState({
        name: "",
        cuit: "",
        address: "",
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createOrganization(newOrg);

        if (res.success && res.data) {
            setOrganizations([...organizations, res.data]);
            setIsCreating(false);
            setNewOrg({ name: "", cuit: "", address: "" });
        } else {
            alert("Error creating organization: " + res.error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold text-lg text-gray-900">Mis Empresas</h3>
                        <p className="text-sm text-gray-500">Empresas registradas en tu cuenta.</p>
                    </div>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Nueva Empresa
                    </button>
                </div>

                {isCreating && (
                    <div className="p-6 bg-gray-50 border-b border-gray-200">
                        <form onSubmit={handleCreate} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Empresa</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="e.g. Mi Empresa S.A."
                                    value={newOrg.name}
                                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="e.g. 30-12345678-9"
                                    value={newOrg.cuit}
                                    onChange={(e) => setNewOrg({ ...newOrg, cuit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="e.g. Av. Corrientes 1234"
                                    value={newOrg.address}
                                    onChange={(e) => setNewOrg({ ...newOrg, address: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreating(false)}
                                    className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 text-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                                >
                                    Crear Empresa
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="divide-y divide-gray-200">
                    {organizations.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No tienes empresas registradas.
                        </div>
                    ) : (
                        organizations.map((org) => (
                            <div key={org.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 bg-gray-100 rounded-lg">
                                        <Building2 className="h-5 w-5 text-gray-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">{org.name}</h4>
                                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                            <span className="font-mono">{org.cuit}</span>
                                            {org.address && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {org.address}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* Future: Add actions like Edit, Delete, Switch to this org */}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
