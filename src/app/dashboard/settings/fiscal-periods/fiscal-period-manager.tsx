'use client';

import { useState } from "react";
import { createFiscalPeriod, setActivePeriod, closeFiscalPeriod } from "@/actions/fiscal-periods";
import { Plus, Calendar, CheckCircle2, Lock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { parseLocalDate } from "@/lib/date-utils";

type FiscalPeriod = {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    isClosed: boolean;
};

interface FiscalPeriodManagerProps {
    initialPeriods: FiscalPeriod[];
    organizationId: string;
}

export default function FiscalPeriodManager({ initialPeriods, organizationId }: FiscalPeriodManagerProps) {
    const [periods, setPeriods] = useState<FiscalPeriod[]>(initialPeriods);
    const [isCreating, setIsCreating] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        startDate: '',
        endDate: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const loadingToast = toast.loading('Creando período fiscal...');

        const res = await createFiscalPeriod({
            organizationId,
            name: formData.name,
            startDate: parseLocalDate(formData.startDate),
            endDate: parseLocalDate(formData.endDate),
        });

        toast.dismiss(loadingToast);

        if (res.success && res.data) {
            toast.success('Período fiscal creado exitosamente');
            setPeriods([res.data, ...periods]);
            setIsCreating(false);
            setFormData({ name: '', startDate: '', endDate: '' });
        } else {
            toast.error(res.error || 'Error al crear el período fiscal');
        }
    };

    const handleActivate = async (periodId: string) => {
        const loadingToast = toast.loading('Activando período...');

        const res = await setActivePeriod(organizationId, periodId);

        toast.dismiss(loadingToast);

        if (res.success && res.data) {
            toast.success('Período activado exitosamente');
            setPeriods(periods.map(p => ({
                ...p,
                isActive: p.id === periodId
            })));
        } else {
            toast.error(res.error || 'Error al activar el período');
        }
    };

    const handleClose = async (periodId: string, periodName: string) => {
        if (!confirm(`¿Estás seguro de cerrar el período "${periodName}"? Esta acción no se puede deshacer y no se podrán registrar más operaciones en este período.`)) {
            return;
        }

        const loadingToast = toast.loading('Cerrando período...');

        const res = await closeFiscalPeriod(periodId);

        toast.dismiss(loadingToast);

        if (res.success && res.data) {
            toast.success('Período cerrado exitosamente');
            setPeriods(periods.map(p =>
                p.id === periodId ? { ...p, isClosed: true, isActive: false } : p
            ));
        } else {
            toast.error(res.error || 'Error al cerrar el período');
        }
    };

    return (
        <div className="space-y-6">
            {!isCreating ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Períodos Registrados</h3>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo Período
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Fecha Inicio</th>
                                    <th className="px-4 py-3">Fecha Fin</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {periods.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500">
                                            No hay períodos fiscales registrados. Crea uno para comenzar.
                                        </td>
                                    </tr>
                                ) : (
                                    periods.map((period) => (
                                        <tr key={period.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-gray-400" />
                                                    <span className="font-medium text-gray-900">{period.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {new Date(period.startDate).toLocaleDateString('es-AR')}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {new Date(period.endDate).toLocaleDateString('es-AR')}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {period.isActive && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Activo
                                                        </span>
                                                    )}
                                                    {period.isClosed && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                            <Lock className="h-3 w-3" />
                                                            Cerrado
                                                        </span>
                                                    )}
                                                    {!period.isActive && !period.isClosed && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                                            <XCircle className="h-3 w-3" />
                                                            Inactivo
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {!period.isActive && !period.isClosed && (
                                                        <button
                                                            onClick={() => handleActivate(period.id)}
                                                            className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors"
                                                        >
                                                            Activar
                                                        </button>
                                                    )}
                                                    {period.isActive && !period.isClosed && (
                                                        <button
                                                            onClick={() => handleClose(period.id, period.name)}
                                                            className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
                                                        >
                                                            Cerrar
                                                        </button>
                                                    )}
                                                    {period.isClosed && (
                                                        <span className="text-xs text-gray-400">Sin acciones</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-gray-900">Nuevo Período Fiscal</h3>
                        <button onClick={() => setIsCreating(false)} className="text-sm text-gray-500 hover:text-gray-900">
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Período</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                placeholder="e.g. Ejercicio 2024"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Inicio</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Fin</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-800">
                                <strong>Nota:</strong> El período se creará como inactivo. Deberás activarlo manualmente para poder registrar operaciones en él.
                            </p>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                            >
                                Crear Período
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
