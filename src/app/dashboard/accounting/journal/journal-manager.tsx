'use client';

import { useState } from "react";
import { JournalEntry, TransactionLine, Account } from "@prisma/client";
import { createJournalEntry } from "@/actions/journal";
import { Plus, Trash2, Save } from "lucide-react";
import { parseLocalDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

// Serialized type for client components (Decimal -> number)
type SerializedTransactionLine = Omit<TransactionLine, 'debit' | 'credit'> & {
    debit: number;
    credit: number;
    account: Account;
};

type JournalEntryWithLines = JournalEntry & {
    lines: SerializedTransactionLine[];
};

interface JournalManagerProps {
    initialEntries: JournalEntryWithLines[];
    accounts: Account[];
}

export default function JournalManager({ initialEntries, accounts }: JournalManagerProps) {
    const [entries, setEntries] = useState<JournalEntryWithLines[]>(initialEntries);
    const [isCreating, setIsCreating] = useState(false);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState("");
    const [lines, setLines] = useState([
        { accountId: "", debit: 0, credit: 0, description: "" },
        { accountId: "", debit: 0, credit: 0, description: "" },
    ]);

    const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const addLine = () => {
        setLines([...lines, { accountId: "", debit: 0, credit: 0, description: "" }]);
    };

    const removeLine = (index: number) => {
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isBalanced) {
            alert("El asiento no balancea");
            return;
        }

        const res = await createJournalEntry({
            date: parseLocalDate(date),
            description,
            lines: lines.map(l => ({
                accountId: l.accountId,
                debit: Number(l.debit),
                credit: Number(l.credit),
                description: l.description || undefined,
            })),
        });

        if (res.success && res.data) {
            // In a real app we'd refetch or optimistically update with the full relation data.
            // For now, let's just reload the page to get the full data or simple alert.
            window.location.reload();
        } else {
            alert("Error creating entry: " + res.error);
        }
    };

    return (
        <div className="space-y-6">
            {!isCreating ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Últimos Movimientos</h3>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo Asiento
                        </button>
                    </div>
                    <div className="divide-y divide-gray-200">
                        {entries.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No hay asientos registrados.</div>
                        ) : (
                            entries.map((entry) => (
                                <div key={entry.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between mb-2">
                                        <div className="font-medium text-gray-900">
                                            #{entry.number} - {new Date(entry.date).toLocaleDateString()}
                                        </div>
                                        <div className="text-gray-600 text-sm">{entry.description}</div>
                                    </div>
                                    <div className="bg-gray-50 rounded-md p-2 text-sm border border-gray-200">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="text-xs text-gray-500 text-left">
                                                    <th className="pb-1">Cuenta</th>
                                                    <th className="pb-1 text-right">Debe</th>
                                                    <th className="pb-1 text-right">Haber</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {entry.lines.map((line) => (
                                                    <tr key={line.id}>
                                                        <td className="py-1 text-gray-700">{line.account.name}</td>
                                                        <td className="py-1 text-right font-mono text-gray-900">
                                                            {Number(line.debit) > 0 ? `$${Number(line.debit).toFixed(2)}` : '-'}
                                                        </td>
                                                        <td className="py-1 text-right font-mono text-gray-900">
                                                            {Number(line.credit) > 0 ? `$${Number(line.credit).toFixed(2)}` : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-gray-900">Nuevo Asiento</h3>
                        <button onClick={() => setIsCreating(false)} className="text-sm text-gray-500 hover:text-gray-900">
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="e.g. Pago a proveedores"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Cuenta</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Detalle (Opcional)</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-700 w-32">Debe</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-700 w-32">Haber</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {lines.map((line, index) => (
                                        <tr key={index}>
                                            <td className="p-2">
                                                <select
                                                    required
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={line.accountId}
                                                    onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {accounts.map((a) => (
                                                        <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={line.description}
                                                    onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-right text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={line.debit}
                                                    onChange={(e) => updateLine(index, 'debit', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-right text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={line.credit}
                                                    onChange={(e) => updateLine(index, 'credit', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeLine(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t border-gray-200 font-medium">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-2 text-right text-gray-900">Totales:</td>
                                        <td className={cn("px-4 py-2 text-right text-gray-900", !isBalanced && "text-red-600")}>
                                            ${totalDebit.toFixed(2)}
                                        </td>
                                        <td className={cn("px-4 py-2 text-right text-gray-900", !isBalanced && "text-red-600")}>
                                            ${totalCredit.toFixed(2)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {!isBalanced && (
                            <div className="text-red-600 text-sm text-center font-medium">
                                El asiento no balancea. Diferencia: ${Math.abs(totalDebit - totalCredit).toFixed(2)}
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={addLine}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700"
                            >
                                <Plus className="h-4 w-4" />
                                Agregar Línea
                            </button>
                            <button
                                type="submit"
                                disabled={!isBalanced}
                                className="ml-auto flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="h-4 w-4" />
                                Guardar Asiento
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
