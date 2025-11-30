'use client';

import { useState } from 'react';
import { updateOrganization } from '@/actions/organizations';
import { Building2, Edit2, TrendingUp, TrendingDown, Users, Package, FileText, DollarSign, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import FileUploader from '@/components/file-uploader';

type Organization = {
    id: string;
    name: string;
    cuit: string;
    address: string | null;
    attachments?: any[];
};

type Metrics = {
    contacts: number;
    products: number;
    invoices: number;
    totalInvoiced: number;
    sales: { count: number; total: number };
    purchases: { count: number; total: number };
    payments: number;
    totalPayments: number;
    journalEntries: number;
};

export default function OrganizationDetail({
    organization,
    metrics
}: {
    organization: Organization;
    metrics?: Metrics;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: organization.name,
        cuit: organization.cuit,
        address: organization.address || '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const loadingToast = toast.loading('Actualizando organización...');

        const res = await updateOrganization(organization.id, formData);
        toast.dismiss(loadingToast);

        if (res.success) {
            toast.success('Organización actualizada exitosamente');
            setIsEditing(false);
            window.location.reload();
        } else {
            toast.error(res.error || 'Error al actualizar');
        }
    };

    const logoAttachment = organization.attachments?.[0];

    return (
        <div className="space-y-6">
            {/* Organization Info Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-gray-900">Información General</h3>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <Edit2 className="h-4 w-4" />
                            Editar
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                CUIT
                            </label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.cuit}
                                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Dirección
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                placeholder="Opcional"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Logo de la Organización
                            </label>
                            <FileUploader
                                organizationId={organization.id}
                                entityId={organization.id}
                                entityType="organization"
                                existingAttachments={organization.attachments || []}
                                maxFiles={1}
                                acceptedFileTypes={['image/*']}
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setFormData({
                                        name: organization.name,
                                        cuit: organization.cuit,
                                        address: organization.address || '',
                                    });
                                }}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                            >
                                Guardar
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex gap-6">
                        {/* Logo Display */}
                        <div className="flex-shrink-0">
                            <div className="h-24 w-24 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200 overflow-hidden">
                                {logoAttachment ? (
                                    <img src={logoAttachment.url} alt="Logo" className="h-full w-full object-cover" />
                                ) : (
                                    <Building2 className="h-10 w-10 text-gray-400" />
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 flex-1">
                            <div className="flex items-start gap-3">
                                <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-500">Nombre</p>
                                    <p className="font-medium text-gray-900">{organization.name}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                                <div>
                                    <p className="text-sm text-gray-500">CUIT</p>
                                    <p className="font-medium text-gray-900">{organization.cuit}</p>
                                </div>
                            </div>
                            {organization.address && (
                                <div className="flex items-start gap-3">
                                    <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                                    <div>
                                        <p className="text-sm text-gray-500">Dirección</p>
                                        <p className="font-medium text-gray-900">{organization.address}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Metrics Grid */}
            {metrics && (
                <>
                    <h3 className="font-semibold text-lg text-gray-900">Indicadores Clave</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Sales */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Ventas</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        ${metrics.sales.total.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {metrics.sales.count} facturas
                                    </p>
                                </div>
                                <div className="p-3 bg-green-100 rounded-lg">
                                    <TrendingUp className="h-6 w-6 text-green-600" />
                                </div>
                            </div>
                        </div>

                        {/* Purchases */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Compras</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        ${metrics.purchases.total.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {metrics.purchases.count} facturas
                                    </p>
                                </div>
                                <div className="p-3 bg-red-100 rounded-lg">
                                    <TrendingDown className="h-6 w-6 text-red-600" />
                                </div>
                            </div>
                        </div>

                        {/* Contacts */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Contactos</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics.contacts}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Clientes y proveedores
                                    </p>
                                </div>
                                <div className="p-3 bg-blue-100 rounded-lg">
                                    <Users className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>
                        </div>

                        {/* Products */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Productos</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics.products}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        En catálogo
                                    </p>
                                </div>
                                <div className="p-3 bg-purple-100 rounded-lg">
                                    <Package className="h-6 w-6 text-purple-600" />
                                </div>
                            </div>
                        </div>

                        {/* Payments */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Movimientos</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ${metrics.totalPayments.toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {metrics.payments} pagos/cobranzas
                                    </p>
                                </div>
                                <div className="p-3 bg-yellow-100 rounded-lg">
                                    <DollarSign className="h-6 w-6 text-yellow-600" />
                                </div>
                            </div>
                        </div>

                        {/* Journal Entries */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">Asientos</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {metrics.journalEntries}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Registros contables
                                    </p>
                                </div>
                                <div className="p-3 bg-gray-100 rounded-lg">
                                    <BookOpen className="h-6 w-6 text-gray-600" />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
