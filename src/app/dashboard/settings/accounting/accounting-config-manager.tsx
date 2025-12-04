'use client';

import { useState } from "react";
import { updateAccountingConfig } from "@/actions/accounting-config";
import { Settings, Save } from "lucide-react";
import { toast } from "sonner";

type Account = {
    id: string;
    code: string;
    name: string;
    type: string;
};

type AccountingConfig = {
    id: string;
    salesAccountId: string | null;
    salesVatAccountId: string | null;
    receivablesAccountId: string | null;
    purchasesAccountId: string | null;
    purchasesVatAccountId: string | null;
    payablesAccountId: string | null;
    cashAccountId: string | null;
    bankAccountId: string | null;
} | null;

interface AccountingConfigManagerProps {
    config: AccountingConfig;
    accounts: Account[];
    organizationId: string;
}

export default function AccountingConfigManager({ config, accounts, organizationId }: AccountingConfigManagerProps) {
    const [formData, setFormData] = useState({
        salesAccountId: config?.salesAccountId || "",
        salesVatAccountId: config?.salesVatAccountId || "",
        receivablesAccountId: config?.receivablesAccountId || "",
        purchasesAccountId: config?.purchasesAccountId || "",
        purchasesVatAccountId: config?.purchasesVatAccountId || "",
        payablesAccountId: config?.payablesAccountId || "",
        cashAccountId: config?.cashAccountId || "",
        bankAccountId: config?.bankAccountId || "",
    });

    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const loadingToast = toast.loading("Guardando configuración...");

        const res = await updateAccountingConfig({
            organizationId,
            ...formData,
        });

        toast.dismiss(loadingToast);

        if (res.success) {
            toast.success("Configuración guardada exitosamente");
        } else {
            toast.error(res.error || "Error al guardar la configuración");
        }

        setSaving(false);
    };

    const getAccountsByType = (type: string) => {
        return accounts.filter(a => a.type === type);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-gray-100 rounded-lg">
                    <Settings className="h-5 w-5 text-gray-700" />
                </div>
                <div>
                    <h3 className="font-semibold text-lg text-gray-900">Cuentas Predeterminadas</h3>
                    <p className="text-sm text-gray-500">Estas cuentas se usarán automáticamente al generar asientos</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Ventas */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Ventas</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cuenta de Ventas
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.salesAccountId}
                                onChange={(e) => setFormData({ ...formData, salesAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('INCOME').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Crédito: Ingresos por ventas</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                IVA Débito Fiscal
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.salesVatAccountId}
                                onChange={(e) => setFormData({ ...formData, salesVatAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('LIABILITY').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Crédito: IVA a pagar</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cuentas por Cobrar
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.receivablesAccountId}
                                onChange={(e) => setFormData({ ...formData, receivablesAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('ASSET').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Débito: Deudores por ventas</p>
                        </div>
                    </div>
                </div>

                {/* Compras */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Compras</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cuenta de Compras
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.purchasesAccountId}
                                onChange={(e) => setFormData({ ...formData, purchasesAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('EXPENSE').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Débito: Gastos por compras</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                IVA Crédito Fiscal
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.purchasesVatAccountId}
                                onChange={(e) => setFormData({ ...formData, purchasesVatAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('ASSET').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Débito: IVA a favor</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Cuentas por Pagar
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.payablesAccountId}
                                onChange={(e) => setFormData({ ...formData, payablesAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('LIABILITY').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Crédito: Deudas con proveedores</p>
                        </div>
                    </div>
                </div>

                {/* Tesorería */}
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Tesorería</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Caja
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.cashAccountId}
                                onChange={(e) => setFormData({ ...formData, cashAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('ASSET').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Para pagos/cobros en efectivo</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Banco
                            </label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={formData.bankAccountId}
                                onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                            >
                                <option value="">Seleccionar cuenta...</option>
                                {getAccountsByType('ASSET').map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.code} - {acc.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Para transferencias bancarias</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className="h-4 w-4" />
                        {saving ? "Guardando..." : "Guardar Configuración"}
                    </button>
                </div>
            </form>
        </div>
    );
}
