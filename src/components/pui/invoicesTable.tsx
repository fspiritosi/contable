"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SimpleTable, type SimpleTableHeader } from "./simpleTable";
import { formatCurrency } from "@/lib/utils";
import { TableFilters } from "./tableFilters";

// Local enum-like helpers for sorting and state management.
type InvoiceSortKey = "number" | "date" | "status" | "total" | "balance";
type InvoiceSortDirection = "asc" | "desc";

type InvoicePaymentStatus = "PAID" | "PARTIAL" | "PENDING";

type InvoiceRecord = {
    id: string;
    flow: string;
    letter: string;
    pointOfSale: number;
    number: number;
    date: string | Date;
    paymentStatus?: string | null;
    totalAmount: number;
    balance: number;
};

export type InvoicesTableProps = {
    invoices: InvoiceRecord[];
    emptyMessage?: string;
};

// Visual metadata per payment status used to render Tailwind utility badges.
const PAYMENT_STATUS_STYLES: Record<InvoicePaymentStatus, { label: string; className: string }> = {
    PAID: {
        label: "Pagada",
        className: "bg-green-50 text-green-700 border border-green-100",
    },
    PARTIAL: {
        label: "Pago parcial",
        className: "bg-sky-50 text-sky-700 border border-sky-100",
    },
    PENDING: {
        label: "Pendiente",
        className: "bg-amber-50 text-amber-700 border border-amber-100",
    },
};

// Weight map that allows sorting statuses in a deterministic order.
const STATUS_WEIGHT: Record<InvoicePaymentStatus, number> = {
    PENDING: 0,
    PARTIAL: 1,
    PAID: 2,
};

// Normalizes API/DB payment status values to the enum used in this UI.
const resolvePaymentStatus = (value: any): InvoicePaymentStatus => {
    if (value === "PAID" || value === "PARTIAL") {
        return value;
    }
    return "PENDING";
};

// Pads numbers to match AFIP-like invoice numbering convention.
const formatInvoiceNumber = (invoice: InvoiceRecord) =>
    `${invoice.letter} ${String(invoice.pointOfSale).padStart(4, "0")}-${String(invoice.number).padStart(8, "0")}`;

// Determines the URL to the invoice details depending on the flow (ventas vs compras).
const getInvoiceDetailHref = (invoice: InvoiceRecord) =>
    invoice.flow === "SALE" ? `/dashboard/sales/${invoice.id}` : `/dashboard/purchases/${invoice.id}`;

// Shared sorting indicator for column headers.
const renderSortIndicator = (active: boolean, direction: InvoiceSortDirection) => (
    <span className="text-[10px] text-gray-500">{active ? (direction === "asc" ? "▲" : "▼") : "↕"}</span>
);

export function InvoicesTable({ invoices, emptyMessage = "Todavía no registraste facturas." }: InvoicesTableProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [sortKey, setSortKey] = useState<InvoiceSortKey>("date");
    const [sortDirection, setSortDirection] = useState<InvoiceSortDirection>("desc");
    const [statusFilter, setStatusFilter] = useState<InvoicePaymentStatus | "all">("all");

    const filteredInvoices = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return [...invoices]
            .filter(invoice => {
                if (!term) return true;
                return formatInvoiceNumber(invoice).toLowerCase().includes(term);
            })
            .filter(invoice => {
                if (statusFilter === "all") return true;
                return resolvePaymentStatus(invoice.paymentStatus) === statusFilter;
            })
            .filter(invoice => {
                if (!dateFilter) return true;
                const invoiceDate = new Date(invoice.date);
                if (Number.isNaN(invoiceDate.getTime())) return false;
                return invoiceDate.toISOString().slice(0, 10) === dateFilter;
            })
            .sort((a, b) => {
                let compare = 0;
                switch (sortKey) {
                    case "number":
                        compare = formatInvoiceNumber(a).localeCompare(formatInvoiceNumber(b), undefined, { numeric: true });
                        break;
                    case "date":
                        compare = new Date(a.date).getTime() - new Date(b.date).getTime();
                        break;
                    case "status":
                        compare =
                            STATUS_WEIGHT[resolvePaymentStatus(a.paymentStatus)] -
                            STATUS_WEIGHT[resolvePaymentStatus(b.paymentStatus)];
                        break;
                    case "total":
                        compare = Number(a.totalAmount) - Number(b.totalAmount);
                        break;
                    case "balance":
                        compare = Number(a.balance) - Number(b.balance);
                        break;
                    default:
                        compare = 0;
                }
                return sortDirection === "asc" ? compare : -compare;
            });
    }, [invoices, searchTerm, dateFilter, sortKey, sortDirection, statusFilter]);

    const handleSort = (key: InvoiceSortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const headers: SimpleTableHeader[] = [
        {
            key: "number",
            label: (
                <button type="button" className="flex items-center gap-1" onClick={() => handleSort("number")}>
                    Comprobante {renderSortIndicator(sortKey === "number", sortDirection)}
                </button>
            ),
        },
        {
            key: "date",
            label: (
                <button type="button" className="flex items-center gap-1" onClick={() => handleSort("date")}>
                    Fecha {renderSortIndicator(sortKey === "date", sortDirection)}
                </button>
            ),
        },
        {
            key: "status",
            label: (
                <button type="button" className="flex items-center gap-1" onClick={() => handleSort("status")}>
                    Estado {renderSortIndicator(sortKey === "status", sortDirection)}
                </button>
            ),
        },
        {
            key: "total",
            label: (
                <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleSort("total")}>
                    Total {renderSortIndicator(sortKey === "total", sortDirection)}
                </button>
            ),
            align: "right",
        },
        {
            key: "balance",
            label: (
                <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleSort("balance")}>
                    Saldo {renderSortIndicator(sortKey === "balance", sortDirection)}
                </button>
            ),
            align: "right",
        },
    ];

    const rows = filteredInvoices.map(invoice => {
        const paymentStatus = resolvePaymentStatus(invoice.paymentStatus);
        return {
            id: invoice.id,
            cells: [
                <Link key="invoice-link" href={getInvoiceDetailHref(invoice)} className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs">
                    {formatInvoiceNumber(invoice)}
                </Link>,
                <span key="date" className="text-gray-600">
                    {new Date(invoice.date).toLocaleDateString("es-AR")}
                </span>,
                <span
                    key="status"
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${PAYMENT_STATUS_STYLES[paymentStatus].className}`}
                >
                    {PAYMENT_STATUS_STYLES[paymentStatus].label}
                </span>,
                <span key="total" className="block text-right text-gray-900">
                    {formatCurrency(invoice.totalAmount)}
                </span>,
                <span
                    key="balance"
                    className={`block text-right font-medium ${invoice.balance > 0 ? "text-red-600" : "text-green-600"}`}
                >
                    {formatCurrency(invoice.balance)}
                </span>,
            ],
        };
    });

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Facturas</h3>
                <span className="text-xs text-gray-500">{filteredInvoices.length} comprobantes</span>
            </div>
            <TableFilters
                searchPlaceholder="Buscar por número"
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                dateValue={dateFilter}
                onDateChange={setDateFilter}
                statusValue={statusFilter}
                onStatusChange={value => setStatusFilter(value as InvoicePaymentStatus | "all")}
                statusOptions={[
                    { label: "Todos los estados", value: "all" },
                    { label: "Pendiente", value: "PENDING" },
                    { label: "Pago parcial", value: "PARTIAL" },
                    { label: "Pagada", value: "PAID" },
                ]}
                hasActiveFilters={Boolean(searchTerm || dateFilter || statusFilter !== "all")}
                onClear={() => {
                    setSearchTerm("");
                    setDateFilter("");
                    setStatusFilter("all");
                }}
            />
            <div className="overflow-x-auto">
                <SimpleTable
                    headers={headers}
                    rows={rows}
                    hasWrapper={false}
                    showHeadersWhenEmpty
                    emptyMessage={emptyMessage}
                />
            </div>
        </div>
    );
}
