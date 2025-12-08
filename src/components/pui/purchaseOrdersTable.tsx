"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SimpleTable, type SimpleTableHeader } from "./simpleTable";
import { formatCurrency } from "@/lib/utils";
import { TableFilters } from "./tableFilters";

type OrderSortKey = "orderNumber" | "issueDate" | "status" | "total" | "invoicedAmount" | "remainingAmount";
type OrderSortDirection = "asc" | "desc";

type PurchaseOrderRecord = {
    id: string;
    orderNumber: string | number | null;
    issueDate: string | Date | null;
    status: string;
    total: number;
    invoicedAmount: number;
    remainingAmount: number;
};

export type PurchaseOrdersTableProps = {
    orders: PurchaseOrderRecord[];
    emptyMessage?: string;
};

// Assigns weights so statuses can be sorted deterministically in the UI.
const getOrderStatusWeight = (status: string) => {
    switch (status) {
        case "APPROVED":
            return 3;
        case "PENDING":
            return 2;
        case "REJECTED":
            return 1;
        default:
            return 0;
    }
};

// Maps incoming statuses to consistent labels + Tailwind badge styles.
const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    APPROVED: {
        label: "Aprobada",
        className: "bg-green-50 text-green-700 border border-green-100",
    },
    PENDING: {
        label: "Pendiente",
        className: "bg-amber-50 text-amber-700 border border-amber-100",
    },
    REJECTED: {
        label: "Rechazada",
        className: "bg-gray-100 text-gray-700 border border-gray-200",
    },
};

const getStatusMeta = (status: string) =>
    STATUS_LABELS[status] || {
        label: status,
        className: "bg-gray-100 text-gray-700 border border-gray-200",
    };

// Normalizes loose order numbers so filters and sorts behave predictably.
const normalizeOrderNumber = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    return String(value);
};

// Converts multiple date inputs to YYYY-MM-DD for safe comparison against <input type="date" />.
const toISODate = (value: string | Date | null | undefined) => {
    if (!value) return "";
    const date = typeof value === "string" || value instanceof Date ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
};

// Reusable sort indicator used by each column header button.
const renderSortIndicator = (active: boolean, direction: OrderSortDirection) => (
    <span className="text-[10px] text-gray-500">{active ? (direction === "asc" ? "▲" : "▼") : "↕"}</span>
);

export function PurchaseOrdersTable({ orders, emptyMessage = "Sin órdenes de compra asociadas." }: PurchaseOrdersTableProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [sortKey, setSortKey] = useState<OrderSortKey>("issueDate");
    const [sortDirection, setSortDirection] = useState<OrderSortDirection>("desc");
    const [statusFilter, setStatusFilter] = useState<string | "all">("all");

    const filteredOrders = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return [...orders]
            .filter(order => {
                if (!term) return true;
                const orderNumber = normalizeOrderNumber(order.orderNumber).toLowerCase();
                return orderNumber.includes(term);
            })
            .filter(order => {
                if (statusFilter === "all") return true;
                return order.status === statusFilter;
            })
            .filter(order => {
                if (!dateFilter) return true;
                const issueDate = toISODate(order.issueDate);
                if (!issueDate) return false;
                return issueDate === dateFilter;
            })
            .sort((a, b) => {
                let compare = 0;
                switch (sortKey) {
                    case "orderNumber":
                        compare = normalizeOrderNumber(a.orderNumber).localeCompare(
                            normalizeOrderNumber(b.orderNumber),
                            undefined,
                            { numeric: true }
                        );
                        break;
                    case "issueDate":
                        compare = new Date(a.issueDate || "").getTime() - new Date(b.issueDate || "").getTime();
                        break;
                    case "status":
                        compare = getOrderStatusWeight(a.status) - getOrderStatusWeight(b.status);
                        break;
                    case "total":
                        compare = Number(a.total) - Number(b.total);
                        break;
                    case "invoicedAmount":
                        compare = Number(a.invoicedAmount) - Number(b.invoicedAmount);
                        break;
                    case "remainingAmount":
                        compare = Number(a.remainingAmount) - Number(b.remainingAmount);
                        break;
                    default:
                        compare = 0;
                }
                return sortDirection === "asc" ? compare : -compare;
            });
    }, [orders, searchTerm, dateFilter, sortKey, sortDirection, statusFilter]);

    const handleSort = (key: OrderSortKey) => {
        if (sortKey === key) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDirection("asc");
        }
    };

    const headers: SimpleTableHeader[] = [
        {
            key: "orderNumber",
            label: (
                <button type="button" className="flex items-center gap-1" onClick={() => handleSort("orderNumber")}>
                    Orden {renderSortIndicator(sortKey === "orderNumber", sortDirection)}
                </button>
            ),
        },
        {
            key: "issueDate",
            label: (
                <button type="button" className="flex items-center gap-1" onClick={() => handleSort("issueDate")}>
                    Fecha {renderSortIndicator(sortKey === "issueDate", sortDirection)}
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
            key: "invoicedAmount",
            label: (
                <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleSort("invoicedAmount")}>
                    Facturado {renderSortIndicator(sortKey === "invoicedAmount", sortDirection)}
                </button>
            ),
            align: "right",
        },
        {
            key: "remainingAmount",
            label: (
                <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleSort("remainingAmount")}>
                    Saldo {renderSortIndicator(sortKey === "remainingAmount", sortDirection)}
                </button>
            ),
            align: "right",
        },
    ];

    const rows = filteredOrders.map(order => {
        const statusMeta = getStatusMeta(order.status);
        const remainingPositive = Number(order.remainingAmount) > 0;

        return {
            id: order.id,
            cells: [
                <Link
                    key="order"
                    href={`/dashboard/purchases/orders/${order.id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                >
                    #{order.orderNumber}
                </Link>,
                <span key="issue-date" className="text-gray-600">
                    {order.issueDate ? new Date(order.issueDate).toLocaleDateString("es-AR") : "-"}
                </span>,
                <span key="status" className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusMeta.className}`}>
                    {statusMeta.label}
                </span>,
                <span key="total" className="block text-right text-gray-900">
                    {formatCurrency(order.total)}
                </span>,
                <span key="invoiced" className="block text-right text-gray-600">
                    {formatCurrency(order.invoicedAmount)}
                </span>,
                <span
                    key="remaining"
                    className={`block text-right font-medium ${remainingPositive ? "text-amber-600" : "text-green-600"}`}
                >
                    {formatCurrency(order.remainingAmount)}
                </span>,
            ],
        };
    });

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Órdenes de Compra</h3>
                <span className="text-xs text-gray-500">{filteredOrders.length} registros</span>
            </div>
            <TableFilters
                searchPlaceholder="Buscar por número"
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                dateValue={dateFilter}
                onDateChange={setDateFilter}
                statusValue={statusFilter}
                onStatusChange={setStatusFilter}
                statusOptions={[
                    { label: "Todos los estados", value: "all" },
                    { label: "Aprobada", value: "APPROVED" },
                    { label: "Pendiente", value: "PENDING" },
                    { label: "Rechazada", value: "REJECTED" },
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
