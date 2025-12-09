'use client';

import { useMemo, useState } from "react";
import { Save, ShieldCheck, PencilLine, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { InvoiceFlow } from "@prisma/client";

import { saveRetentionSetting } from "@/actions/retentions";
import type { SerializedRetentionSetting } from "@/actions/retentions";

const FLOW_LABELS: Record<InvoiceFlow, string> = {
    SALE: "Ventas",
    PURCHASE: "Compras",
};

const flowOptions: { value: InvoiceFlow | ''; label: string }[] = [
    { value: '', label: "Ambos (ventas y compras)" },
    { value: InvoiceFlow.SALE, label: FLOW_LABELS.SALE },
    { value: InvoiceFlow.PURCHASE, label: FLOW_LABELS.PURCHASE },
];

const defaultFormState = {
    id: undefined as string | undefined,
    name: "",
    code: "",
    description: "",
    appliesTo: "" as InvoiceFlow | '',
    defaultRate: "",
    receivableAccountId: "",
    payableAccountId: "",
};

type AccountOption = {
    id: string;
    code: string | null;
    name: string;
    type: string;
};

type RetentionSettingsManagerProps = {
    initialSettings: SerializedRetentionSetting[];
    accounts: AccountOption[];
    organizationId: string;
};

export default function RetentionSettingsManager({ initialSettings, accounts, organizationId }: RetentionSettingsManagerProps) {
    const [settings, setSettings] = useState<SerializedRetentionSetting[]>(initialSettings);
    const [form, setForm] = useState(defaultFormState);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const sortedSettings = useMemo(
        () => [...settings].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [settings],
    );

    const receivableAccounts = useMemo(() => accounts.filter(account => account.type === 'ASSET'), [accounts]);
    const payableAccounts = useMemo(() => accounts.filter(account => account.type === 'LIABILITY'), [accounts]);

    const handleEdit = (setting: SerializedRetentionSetting) => {
        setEditingId(setting.id);
        setForm({
            id: setting.id,
            name: setting.name,
            code: setting.code ?? "",
            description: setting.description ?? "",
            appliesTo: setting.appliesTo ?? "",
            defaultRate: setting.defaultRate?.toString() ?? "",
            receivableAccountId: setting.receivableAccountId ?? "",
            payableAccountId: setting.payableAccountId ?? "",
        });
    };

    const resetForm = () => {
        setForm(defaultFormState);
        setEditingId(null);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!form.name.trim()) {
            toast.error("Ingresá un nombre para la retención");
            return;
        }

        const parsedRate = form.defaultRate === "" ? null : Number(form.defaultRate);
        if (parsedRate !== null && Number.isNaN(parsedRate)) {
            toast.error("La tasa predeterminada debe ser un número válido");
            return;
        }

        setIsSaving(true);
        const savingToast = toast.loading(editingId ? "Actualizando retención..." : "Creando retención...");

        const response = await saveRetentionSetting({
            organizationId,
            id: form.id,
            name: form.name.trim(),
            code: form.code?.trim() || null,
            description: form.description?.trim() || null,
            appliesTo: form.appliesTo || null,
            defaultRate: parsedRate,
            receivableAccountId: form.receivableAccountId || null,
            payableAccountId: form.payableAccountId || null,
        });

        toast.dismiss(savingToast);
        setIsSaving(false);

        if (!response.success || !response.data) {
            toast.error(response.error || "No se pudo guardar la retención");
            return;
        }

        toast.success(editingId ? "Retención actualizada" : "Retención creada");

        setSettings(prev => {
            const existingIndex = prev.findIndex(item => item.id === response.data.id);
            if (existingIndex === -1) {
                return [...prev, response.data];
            }
            const updated = [...prev];
            updated[existingIndex] = response.data;
            return updated;
        });

        resetForm();
    };

    const renderAccountOption = (account: AccountOption) => (
        <option key={account.id} value={account.id}>
            {account.code ? `${account.code} · ${account.name}` : account.name}
        </option>
    );

    return (
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                        <ShieldCheck className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Tipos de retención configurados</h3>
                        <p className="text-sm text-gray-500">Definí nombres, códigos y cuentas contables para cada retención.</p>
                    </div>
                </div>

                {sortedSettings.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Todavía no configuraste retenciones.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sortedSettings.map(setting => (
                            <div key={setting.id} className="px-6 py-5 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                            {setting.name}
                                            {setting.code && (
                                                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                                    {setting.code}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {setting.appliesTo ? `Aplica a ${FLOW_LABELS[setting.appliesTo]}` : "Aplica a ventas y compras"}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleEdit(setting)}
                                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                    >
                                        <PencilLine className="h-3.5 w-3.5" /> Editar
                                    </button>
                                </div>
                                {(setting.description || setting.defaultRate !== null) && (
                                    <div className="text-xs text-gray-600 space-y-1">
                                        {setting.description && <p>{setting.description}</p>}
                                        {typeof setting.defaultRate === 'number' && (
                                            <p>Tasa sugerida: {setting.defaultRate.toFixed(2)}%</p>
                                        )}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-500">
                                    <div className="border border-gray-100 rounded-lg p-3">
                                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Cuenta para ventas</p>
                                        <p className="text-gray-800 font-medium">
                                            {setting.receivableAccount
                                                ? `${setting.receivableAccount.code ?? '—'} · ${setting.receivableAccount.name}`
                                                : "Sin configurar"}
                                        </p>
                                    </div>
                                    <div className="border border-gray-100 rounded-lg p-3">
                                        <p className="text-[11px] uppercase tracking-wide text-gray-400">Cuenta para compras</p>
                                        <p className="text-gray-800 font-medium">
                                            {setting.payableAccount
                                                ? `${setting.payableAccount.code ?? '—'} · ${setting.payableAccount.name}`
                                                : "Sin configurar"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">
                            {editingId ? "Editar retención" : "Nueva retención"}
                        </h3>
                        <p className="text-xs text-gray-500">Completá los datos principales y guardá para poder usarla.</p>
                    </div>
                    {editingId ? (
                        <button
                            type="button"
                            onClick={resetForm}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                            <RotateCcw className="h-3.5 w-3.5" /> Nuevo
                        </button>
                    ) : (
                        <div className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    )}
                </div>

                <form className="p-6 space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={event => setForm({ ...form, name: event.target.value })}
                            placeholder="Retención de IVA"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                            <input
                                type="text"
                                value={form.code}
                                onChange={event => setForm({ ...form, code: event.target.value })}
                                placeholder="IVA"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tasa sugerida (%)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.defaultRate}
                                onChange={event => setForm({ ...form, defaultRate: event.target.value })}
                                placeholder="3.00"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea
                            rows={2}
                            value={form.description}
                            onChange={event => setForm({ ...form, description: event.target.value })}
                            placeholder="Notas internas sobre cuándo aplicar esta retención"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Aplica a</label>
                        <select
                            value={form.appliesTo}
                            onChange={event => setForm({ ...form, appliesTo: event.target.value as InvoiceFlow | '' })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        >
                            {flowOptions.map(option => (
                                <option key={option.value || 'all'} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta para ventas</label>
                            <select
                                value={form.receivableAccountId}
                                onChange={event => setForm({ ...form, receivableAccountId: event.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            >
                                <option value="">Seleccioná una cuenta</option>
                                {receivableAccounts.map(renderAccountOption)}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Cuenta a debitar cuando registrás una retención de venta.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta para compras</label>
                            <select
                                value={form.payableAccountId}
                                onChange={event => setForm({ ...form, payableAccountId: event.target.value })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                            >
                                <option value="">Seleccioná una cuenta</option>
                                {payableAccounts.map(renderAccountOption)}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Cuenta a acreditar cuando registrás una retención de compra.</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSaving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear retención'}
                    </button>
                </form>
            </div>
        </div>
    );
}
