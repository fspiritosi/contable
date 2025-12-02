'use client';

import { useEffect, useMemo, useState } from "react";
import { createPayment } from "@/actions/payments";
import { Plus, DollarSign, TrendingDown, TrendingUp, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { parseLocalDate } from "@/lib/date-utils";

type Payment = {
    id: string;
    type: string;
    method: string;
    amount: number;
    date: Date;
    reference: string | null;
    notes: string | null;
    invoice: any | null;
};

type Invoice = {
    id: string;
    flow: string;
    letter: string;
    pointOfSale: number;
    number: number;
    totalAmount: number;
    contact: any;
};

type TreasuryAccount = {
    id: string;
    name: string;
    type: string;
    balance: number;
};

interface PaymentManagerProps {
    initialPayments: Payment[];
    invoices: Invoice[];
    treasuryAccounts: TreasuryAccount[];
    organizationId: string;
}

export default function PaymentManager({ initialPayments, invoices, treasuryAccounts, organizationId }: PaymentManagerProps) {
    const [payments, setPayments] = useState<Payment[]>(initialPayments);
    const [isCreating, setIsCreating] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'PAYMENT' | 'COLLECTION'>('ALL');

    const [formData, setFormData] = useState({
        type: 'PAYMENT' as 'PAYMENT' | 'COLLECTION',
        method: 'CASH' as 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'OTHER',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        reference: '',
        notes: '',
        invoiceId: '',
        treasuryAccountId: '',
    });

    const availableTreasuryAccounts = useMemo(
        () => treasuryAccounts.filter((account) => account.type === formData.method),
        [treasuryAccounts, formData.method]
    );

    useEffect(() => {
        if (!availableTreasuryAccounts.some((acc) => acc.id === formData.treasuryAccountId)) {
            setFormData((prev) => ({ ...prev, treasuryAccountId: '' }));
        }
    }, [formData.method, formData.treasuryAccountId, availableTreasuryAccounts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const loadingToast = toast.loading(formData.type === 'PAYMENT' ? 'Registrando pago...' : 'Registrando cobranza...');

        const res = await createPayment({
            organizationId,
            type: formData.type,
            method: formData.method,
            amount: formData.amount,
            date: parseLocalDate(formData.date),
            reference: formData.reference || undefined,
            notes: formData.notes || undefined,
            invoiceId: formData.invoiceId || undefined,
            treasuryAccountId: formData.treasuryAccountId,
        });

        toast.dismiss(loadingToast);

        if (res.success && res.data) {
            toast.success(formData.type === 'PAYMENT' ? 'Pago registrado exitosamente' : 'Cobranza registrada exitosamente');
            setPayments([res.data, ...payments]);
            setIsCreating(false);
            setFormData({
                type: 'PAYMENT',
                method: 'CASH',
                amount: 0,
                date: new Date().toISOString().split('T')[0],
                reference: '',
                notes: '',
                invoiceId: '',
                treasuryAccountId: '',
            });
        } else {
            toast.error(res.error || 'Error al registrar el movimiento');
        }
    };

    const filteredPayments = payments.filter(p => {
        if (filter === 'ALL') return true;
        return p.type === filter;
    });

    const availableInvoices = invoices.filter(inv => {
        if (formData.type === 'PAYMENT') return inv.flow === 'PURCHASE';
        return inv.flow === 'SALE';
    });

    const totalPayments = payments.filter(p => p.type === 'PAYMENT').reduce((sum, p) => sum + p.amount, 0);
    const totalCollections = payments.filter(p => p.type === 'COLLECTION').reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total Pagos</p>
                            <p className="text-2xl font-bold text-red-600">${totalPayments.toFixed(2)}</p>
                        </div>
                        <div className="p-3 bg-red-100 rounded-lg">
                            <TrendingDown className="h-6 w-6 text-red-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total Cobranzas</p>
                            <p className="text-2xl font-bold text-green-600">${totalCollections.toFixed(2)}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-green-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Saldo Neto</p>
                            <p className={`text-2xl font-bold ${(totalCollections - totalPayments) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${(totalCollections - totalPayments).toFixed(2)}
                            </p>
                        </div>
                        <div className="p-3 bg-gray-100 rounded-lg">
                            <DollarSign className="h-6 w-6 text-gray-700" />
                            <div>
                                <p className="text-sm text-gray-500">Total Cobranzas</p>
                                <h3 className="text-2xl font-bold text-gray-900">${totalCollections.toFixed(2)}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                {!isCreating ? (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilter('ALL')}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'ALL' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilter('PAYMENT')}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'PAYMENT' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Pagos
                                </button>
                                <button
                                    onClick={() => setFilter('COLLECTION')}
                                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filter === 'COLLECTION' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    Cobranzas
                                </button>
                            </div>
                            <button
                                onClick={() => setIsCreating(true)}
                                className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4" />
                                Nuevo Movimiento
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Tipo</th>
                                        <th className="px-4 py-3">Método</th>
                                        <th className="px-4 py-3">Referencia</th>
                                        <th className="px-4 py-3 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredPayments.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-gray-500">
                                                No se encontraron movimientos.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPayments.map((payment) => (
                                            <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    {new Date(payment.date).toLocaleDateString('es-AR')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${payment.type === 'PAYMENT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {payment.type === 'PAYMENT' ? 'Pago' : 'Cobranza'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {payment.method === 'CASH' && 'Efectivo'}
                                                    {payment.method === 'BANK_TRANSFER' && 'Transferencia'}
                                                    {payment.method === 'CHECK' && 'Cheque'}
                                                    {payment.method === 'CREDIT_CARD' && 'Tarjeta Crédito'}
                                                    {payment.method === 'DEBIT_CARD' && 'Tarjeta Débito'}
                                                    {payment.method === 'OTHER' && 'Otro'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {payment.reference || '-'}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-medium ${payment.type === 'PAYMENT' ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                    ${payment.amount.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                                <h3 className="font-semibold text-lg text-gray-900">Nuevo Movimiento</h3>
                                <button onClick={() => setIsCreating(false)} className="text-gray-500 hover:text-gray-900">
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value as any, invoiceId: '' })}
                                        >
                                            <option value="PAYMENT">Pago (Salida)</option>
                                            <option value="COLLECTION">Cobranza (Entrada)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                            value={formData.method}
                                            onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                                        >
                                            <option value="CASH">Efectivo</option>
                                            <option value="BANK_TRANSFER">Transferencia</option>
                                            <option value="CHECK">Cheque</option>
                                            <option value="CREDIT_CARD">Tarjeta Crédito</option>
                                            <option value="DEBIT_CARD">Tarjeta Débito</option>
                                            <option value="OTHER">Otro</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Caja / Cuenta de Tesorería</label>
                                    <select
                                        required
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        value={formData.treasuryAccountId}
                                        onChange={(e) => setFormData({ ...formData, treasuryAccountId: e.target.value })}
                                    >
                                        <option value="">Seleccionar cuenta...</option>
                                        {availableTreasuryAccounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} ({acc.type === 'CASH' ? 'Caja' : 'Banco'}) - Saldo: ${acc.balance.toFixed(2)}
                                            </option>
                                        ))}
                                    </select>
                                    {availableTreasuryAccounts.length === 0 && (
                                        <p className="text-xs text-red-500 mt-1">
                                            No hay cajas disponibles para el método seleccionado.
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        Selecciona la caja correspondiente al método elegido (por ejemplo, Caja Efectivo, Banco, etc.).
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.01"
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Referencia (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        placeholder="Nº de cheque, transferencia, etc."
                                        value={formData.reference}
                                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Factura Relacionada (Opcional)</label>
                                    <select
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        value={formData.invoiceId}
                                        onChange={(e) => setFormData({ ...formData, invoiceId: e.target.value })}
                                    >
                                        <option value="">Sin factura</option>
                                        {availableInvoices.map(inv => (
                                            <option key={inv.id} value={inv.id}>
                                                {inv.letter} {String(inv.pointOfSale).padStart(4, '0')}-{String(inv.number).padStart(8, '0')} - ${inv.totalAmount.toFixed(2)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas (Opcional)</label>
                                    <textarea
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        rows={3}
                                        placeholder="Detalles adicionales..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    />
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
                                        Registrar {formData.type === 'PAYMENT' ? 'Pago' : 'Cobranza'}
                                    </button>
                                </div>
                            </form>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}

