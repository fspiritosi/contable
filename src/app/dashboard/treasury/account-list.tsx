'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    createTreasuryAccount,
    updateTreasuryAccount,
    deleteTreasuryAccount,
    transferTreasuryFunds,
} from "@/actions/treasury";
import { Plus, Wallet, Building2, Trash2, Edit2, X } from "lucide-react";
import { PaymentMethod, Account } from "@prisma/client";
import { toast } from "sonner";

type SerializedTreasuryAccount = {
    id: string;
    organizationId: string;
    name: string;
    type: PaymentMethod;
    currency: string;
    bankName: string | null;
    cbu: string | null;
    alias: string | null;
    number: string | null;
    accountId: string;
    balance: number;
    account: Account;
    createdAt: Date;
    updatedAt: Date;
};

interface AccountListProps {
    initialAccounts: SerializedTreasuryAccount[];
    organizationId: string;
    chartOfAccounts: Account[];
}

export default function AccountList({ initialAccounts, organizationId, chartOfAccounts }: AccountListProps) {
    const router = useRouter();
    const [accounts, setAccounts] = useState<SerializedTreasuryAccount[]>(initialAccounts);
    const [isCreating, setIsCreating] = useState(false);
    const [editingAccount, setEditingAccount] = useState<SerializedTreasuryAccount | null>(null);
    const [isTransferring, setIsTransferring] = useState(false);
    const [transferForm, setTransferForm] = useState({
        fromAccountId: "",
        toAccountId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        note: "",
    });

    const [formData, setFormData] = useState<{
        name: string;
        type: PaymentMethod;
        currency: string;
        bankName: string;
        cbu: string;
        alias: string;
        number: string;
        accountId: string;
        initialBalance: number;
    }>({
        name: "",
        type: PaymentMethod.CASH,
        currency: "ARS",
        bankName: "",
        cbu: "",
        alias: "",
        number: "",
        accountId: "",
        initialBalance: 0,
    });

    const resetForm = () => {
        setFormData({
            name: "",
            type: PaymentMethod.CASH,
            currency: "ARS",
            bankName: "",
            cbu: "",
            alias: "",
            number: "",
            accountId: "",
            initialBalance: 0,
        });
    };

    const selectedFromAccount = transferForm.fromAccountId
        ? accounts.find(account => account.id === transferForm.fromAccountId) ?? null
        : null;

    const destinationAccounts = selectedFromAccount
        ? accounts.filter(
              account => account.id !== selectedFromAccount.id && account.currency === selectedFromAccount.currency,
          )
        : accounts.filter(account => account.id !== transferForm.fromAccountId);

    const handleTransferChange = (field: keyof typeof transferForm, value: string) => {
        setTransferForm(prev => {
            if (field === "fromAccountId") {
                return {
                    ...prev,
                    [field]: value,
                    toAccountId: prev.toAccountId === value ? "" : prev.toAccountId,
                };
            }
            return { ...prev, [field]: value };
        });
    };

    const handleTransferSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) return;

        const parsedAmount = Number(transferForm.amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error("Ingresa un monto válido");
            return;
        }

        setIsTransferring(true);
        const toastId = toast.loading("Registrando transferencia...");
        try {
            const res = await transferTreasuryFunds({
                fromAccountId: transferForm.fromAccountId,
                toAccountId: transferForm.toAccountId,
                amount: parsedAmount,
                date: transferForm.date,
                note: transferForm.note,
            });

            if (!res.success) {
                toast.error(res.error ?? "No se pudo registrar la transferencia");
                return;
            }

            toast.success("Transferencia registrada");
            setTransferForm({
                fromAccountId: "",
                toAccountId: "",
                amount: "",
                date: new Date().toISOString().split("T")[0],
                note: "",
            });
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error inesperado");
        } finally {
            toast.dismiss(toastId);
            setIsTransferring(false);
        }
    };

    const handleEditClick = (account: SerializedTreasuryAccount) => {
        setEditingAccount(account);
        setFormData({
            name: account.name,
            type: account.type,
            currency: account.currency,
            bankName: account.bankName || "",
            cbu: account.cbu || "",
            alias: account.alias || "",
            number: account.number || "",
            accountId: account.accountId,
            initialBalance: account.balance, // Note: Balance usually shouldn't be editable directly after creation except via adjustments, but for simplicity here
        });
        setIsCreating(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading(editingAccount ? "Actualizando..." : "Creando...");

        try {
            const dataToSubmit = {
                ...formData,
                organizationId,
            };

            let res;
            if (editingAccount) {
                res = await updateTreasuryAccount(editingAccount.id, dataToSubmit);
            } else {
                res = await createTreasuryAccount(dataToSubmit);
            }

            if (res.success && res.data) {
                // We need to merge the full account object for display since the action returns the treasury account
                // but we need the related Account object for the UI list.
                // For simplicity, we'll reload the page or just update what we can.
                // Ideally we should return the included relation from the server action.
                // Let's assume we refresh or we find the account in chartOfAccounts
                const linkedAccount = chartOfAccounts.find(a => a.id === res.data.accountId);
                const fullData = { ...res.data, account: linkedAccount!, balance: Number(res.data.balance) };

                if (editingAccount) {
                    setAccounts(accounts.map(a => a.id === editingAccount.id ? fullData : a));
                } else {
                    setAccounts([...accounts, fullData]);
                }

                setIsCreating(false);
                setEditingAccount(null);
                resetForm();
                toast.success(editingAccount ? "Cuenta actualizada" : "Cuenta creada");
            } else {
                toast.error("Error: " + res.error);
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error inesperado");
        } finally {
            toast.dismiss(toastId);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar esta cuenta?")) return;
        const toastId = toast.loading("Eliminando...");
        const res = await deleteTreasuryAccount(id);
        toast.dismiss(toastId);

        if (res.success) {
            setAccounts(accounts.filter(a => a.id !== id));
            toast.success("Eliminado correctamente");
        } else {
            toast.error("Error al eliminar");
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Transferir fondos entre cuentas</h3>
                        <p className="text-sm text-gray-500">
                            Mové efectivo entre tus cajas o cuentas bancarias manteniendo la trazabilidad contable.
                        </p>
                    </div>
                </div>
                <form onSubmit={handleTransferSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta origen</label>
                        <select
                            required
                            value={transferForm.fromAccountId}
                            onChange={e => handleTransferChange("fromAccountId", e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        >
                            <option value="">Seleccioná una cuenta...</option>
                            {accounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.name} · {account.currency} · Saldo ${account.balance.toLocaleString()}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta destino</label>
                        <select
                            required
                            value={transferForm.toAccountId}
                            onChange={e => handleTransferChange("toAccountId", e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            disabled={!selectedFromAccount}
                        >
                            <option value="">
                                {selectedFromAccount ? "Seleccioná una cuenta..." : "Elegí primero la cuenta origen"}
                            </option>
                            {destinationAccounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.name} · {account.currency} · Saldo ${account.balance.toLocaleString()}
                                </option>
                            ))}
                        </select>
                        {selectedFromAccount && (
                            <p className="text-xs text-gray-500 mt-1">
                                Solo se muestran cuentas en {selectedFromAccount.currency}.
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={transferForm.amount}
                            onChange={e => handleTransferChange("amount", e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            placeholder="0,00"
                        />
                        {selectedFromAccount && (
                            <p className="text-xs text-gray-500 mt-1">
                                Saldo disponible: ${selectedFromAccount.balance.toLocaleString()}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                        <input
                            type="date"
                            required
                            value={transferForm.date}
                            onChange={e => handleTransferChange("date", e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                    </div>
                    <div className="md:col-span-2 lg:col-span-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
                        <textarea
                            value={transferForm.note}
                            onChange={e => handleTransferChange("note", e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            placeholder="Motivo o referencia de la transferencia"
                        />
                    </div>
                    <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={
                                isTransferring ||
                                !transferForm.fromAccountId ||
                                !transferForm.toAccountId ||
                                !transferForm.amount
                            }
                            className="inline-flex items-center px-4 py-2 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
                        >
                            {isTransferring ? "Registrando..." : "Registrar transferencia"}
                        </button>
                    </div>
                </form>
            </div>

            {!isCreating ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Add New Card */}
                    <button
                        onClick={() => { resetForm(); setIsCreating(true); }}
                        className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-xl hover:border-gray-900 hover:bg-gray-50 transition-all group"
                    >
                        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-white mb-3 transition-colors">
                            <Plus className="h-6 w-6 text-gray-400 group-hover:text-gray-900" />
                        </div>
                        <span className="font-medium text-gray-900">Nueva Cuenta</span>
                    </button>

                    {/* Account Cards */}
                    {accounts.map((account) => (
                        <div key={account.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    {account.type === 'CASH' ? (
                                        <Wallet className="h-6 w-6 text-gray-700" />
                                    ) : (
                                        <Building2 className="h-6 w-6 text-gray-700" />
                                    )}
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditClick(account)} className="p-1 text-gray-400 hover:text-blue-600">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDelete(account.id)} className="p-1 text-gray-400 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            <h3 className="font-semibold text-gray-900 text-lg mb-1">{account.name}</h3>
                            <p className="text-sm text-gray-500 mb-4">{account.currency} - {account.type === 'CASH' ? 'Efectivo' : 'Banco'}</p>

                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Saldo Actual</span>
                                    <span className={`font-medium ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        ${account.balance.toLocaleString()}
                                    </span>
                                </div>
                                {account.cbu && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">CBU</span>
                                        <span className="font-mono text-xs text-gray-700">{account.cbu}</span>
                                    </div>
                                )}
                                <div className="pt-3 border-t border-gray-100 mt-3">
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>Cuenta Contable</span>
                                        <span>{account.account?.code}</span>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/dashboard/treasury/${account.id}`)}
                                        className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
                                    >
                                        Ver movimientos
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-gray-900">
                            {editingAccount ? "Editar Cuenta" : "Nueva Cuenta de Tesorería"}
                        </h3>
                        <button
                            onClick={() => { setIsCreating(false); setEditingAccount(null); }}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Cuenta</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full text-gray-700 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    placeholder="e.g. Caja Principal, Banco Galicia CC"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <select
                                    className="w-full rounded-md text-gray-700 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as PaymentMethod })}
                                >
                                    <option value={PaymentMethod.CASH}>Efectivo (Caja)</option>
                                    <option value={PaymentMethod.BANK_TRANSFER}>Banco / Transferencia</option>
                                    <option value={PaymentMethod.CHECK}>Cheques</option>
                                    <option value={PaymentMethod.CREDIT_CARD}>Tarjeta de Crédito</option>
                                    <option value={PaymentMethod.OTHER}>Otro</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
                                <select
                                    className="w-full rounded-md text-gray-700 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={formData.currency}
                                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                >
                                    <option value="ARS">Pesos Argentinos (ARS)</option>
                                    <option value="USD">Dólares (USD)</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Contable Asociada</label>
                                <select
                                    required
                                    className="w-full rounded-md text-gray-700 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={formData.accountId}
                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                >
                                    <option value="">Seleccionar cuenta...</option>
                                    {chartOfAccounts.filter(a => a.type === 'ASSET' || a.type === 'LIABILITY').map(account => (
                                        <option key={account.id} value={account.id}>
                                            {account.code} - {account.name}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Selecciona la cuenta del Plan de Cuentas que representará los movimientos de esta caja/banco.
                                </p>
                            </div>

                            {!editingAccount && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Inicial</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full text-gray-700 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        value={formData.initialBalance}
                                        onChange={(e) => setFormData({ ...formData, initialBalance: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            )}
                        </div>

                        {formData.type !== PaymentMethod.CASH && (
                            <div className="space-y-4 pt-4 border-t border-gray-200">
                                <h4 className="font-medium text-gray-900">Datos Bancarios (Opcional)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                                        <input
                                            type="text"
                                            className="w-full text-gray-700 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            placeholder="e.g. Banco Galicia"
                                            value={formData.bankName}
                                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta</label>
                                        <input
                                            type="text"
                                            className="w-full text-gray-700  rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={formData.number}
                                            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">CBU / CVU</label>
                                        <input
                                            type="text"
                                            className="w-full text-gray-700 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={formData.cbu}
                                            onChange={(e) => setFormData({ ...formData, cbu: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Alias</label>
                                        <input
                                            type="text"
                                            className="w-full text-gray-700 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={formData.alias}
                                            onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={() => { setIsCreating(false); setEditingAccount(null); }}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                            >
                                {editingAccount ? "Actualizar" : "Guardar Cuenta"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
