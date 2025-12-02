'use client';

import { useState } from "react";
import { AccountType } from "@prisma/client";
import { LedgerAccount } from "@/actions/ledger";
import { Search, TrendingUp, TrendingDown } from "lucide-react";

interface LedgerViewProps {
    accounts: LedgerAccount[];
    totals: {
        debit: number;
        credit: number;
    };
}

const accountTypeLabels: Record<AccountType, string> = {
    ASSET: "Activo",
    LIABILITY: "Pasivo",
    EQUITY: "Patrimonio",
    INCOME: "Ingresos",
    EXPENSE: "Gastos",
};

export default function LedgerView({ accounts, totals }: LedgerViewProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState<AccountType | "ALL">("ALL");

    // Filter accounts
    const filteredAccounts = accounts.filter(account => {
        const matchesSearch =
            account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.code.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesType = filterType === "ALL" || account.type === filterType;

        return matchesSearch && matchesType;
    });

    // Calculate filtered totals
    const filteredTotals = {
        debit: filteredAccounts.reduce((sum, acc) => sum + acc.debit, 0),
        credit: filteredAccounts.reduce((sum, acc) => sum + acc.credit, 0),
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por código o nombre..."
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as AccountType | "ALL")}
                        >
                            <option value="ALL">Todos los tipos</option>
                            <option value="ASSET">Activos</option>
                            <option value="LIABILITY">Pasivos</option>
                            <option value="EQUITY">Patrimonio</option>
                            <option value="INCOME">Ingresos</option>
                            <option value="EXPENSE">Gastos</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-green-700" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Debe</p>
                            <p className="text-2xl font-bold text-gray-900">
                                ${totals.debit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <TrendingDown className="h-5 w-5 text-red-700" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Total Haber</p>
                            <p className="text-2xl font-bold text-gray-900">
                                ${totals.credit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Diferencia</p>
                        <p className={`text-2xl font-bold ${Math.abs(totals.debit - totals.credit) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.abs(totals.debit - totals.credit).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {Math.abs(totals.debit - totals.credit) < 0.01 && (
                            <p className="text-xs text-green-600 mt-1">✓ Balanceado</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Accounts Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Código</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Cuenta</th>
                                <th className="px-4 py-3 text-left font-medium text-gray-700">Tipo</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Debe</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Haber</th>
                                <th className="px-4 py-3 text-right font-medium text-gray-700">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredAccounts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        No se encontraron cuentas
                                    </td>
                                </tr>
                            ) : (
                                filteredAccounts.map((account) => (
                                    <tr key={account.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-gray-600">{account.code}</td>
                                        <td className="px-4 py-3 text-gray-900 font-medium">{account.name}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                                {accountTypeLabels[account.type]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            {account.debit > 0 ? `$${account.debit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            {account.credit > 0 ? `$${account.credit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-semibold ${account.balance > 0 ? 'text-green-600' :
                                                account.balance < 0 ? 'text-red-600' :
                                                    'text-gray-600'
                                            }`}>
                                            ${Math.abs(account.balance).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {filteredAccounts.length > 0 && (
                            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                <tr className="font-semibold">
                                    <td colSpan={3} className="px-4 py-3 text-gray-900">TOTALES</td>
                                    <td className="px-4 py-3 text-right text-gray-900">
                                        ${filteredTotals.debit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900">
                                        ${filteredTotals.credit.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-900">-</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}
