import { formatDate, formatCurrency } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { SimpleTable } from "./simpleTable";

type OverdueInvoice = {
    id: string;
    invoiceNumber: string;
    contactName: string;
    dueDate: string | null;
    balance: number;
    totalAmount: number;
    paidAmount: number;
    daysOverdue: number;
};

export function OverdueTable({ invoices }: { invoices: OverdueInvoice[] }) {
    if (!invoices.length) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 flex items-center gap-3 text-sm text-gray-500">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Sin facturas vencidas pendientes.
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-gray-200 bg-white overflow-x-auto">
            <SimpleTable
                headers={[
                    { label: 'Comprobante' },
                    { label: 'Cliente' },
                    { label: 'Vencimiento' },
                    { label: 'Saldo' },
                    { label: 'Días atraso' }
                ]}
                rows={invoices.map(invoice => ({
                    cells: [
                        invoice.invoiceNumber,
                        invoice.contactName,
                        invoice.dueDate ? formatDate(invoice.dueDate) : '-',
                        formatCurrency(invoice.balance),
                        invoice.daysOverdue.toString()
                    ] as React.ReactNode[]
                }))}
                emptyMessage="Sin facturas vencidas pendientes."
            />
        </div>
    );
}
