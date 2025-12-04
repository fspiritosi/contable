    'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Invoice, InvoiceItem, InvoiceFlow, InvoiceLetter, Contact } from "@prisma/client";
import { createInvoice, getNextInvoiceSequence } from "@/actions/invoices";
import { SerializedProduct } from "@/actions/products";
import type { SerializedPurchaseOrder } from "@/actions/purchase-orders";
import { Plus, FileText, ArrowUpRight, ArrowDownLeft, Trash2, Paperclip, X, Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import FileUploader from "@/components/file-uploader";
import AttachmentViewer from "@/components/attachment-viewer";

// Serialized types for client components (Decimal -> number)
type SerializedInvoiceItem = Omit<InvoiceItem, 'quantity' | 'unitPrice' | 'vatRate' | 'total'> & {
    quantity: number;
    unitPrice: number;
    vatRate: number;
    total: number;
};

type SerializedAttachment = {
    id: string;
    name: string;
    fileType: string;
    size: number;
    url: string;
    createdAt: string;
};

type SerializedInvoice = Omit<Invoice, 'netAmount' | 'vatAmount' | 'totalAmount'> & {
    netAmount: number;
    vatAmount: number;
    totalAmount: number;
    contact: Contact | null;
    items: SerializedInvoiceItem[];
    attachments?: SerializedAttachment[];
};

interface InvoiceManagerProps {
    initialInvoices: SerializedInvoice[];
    contacts: Contact[];
    products: SerializedProduct[];
    organizationId: string;
    defaultFlow?: InvoiceFlow | "ALL";
    hideFlowFilters?: boolean;
    purchaseOrders?: SerializedPurchaseOrder[];
    initialPurchaseOrderId?: string;
}

export default function InvoiceManager({ initialInvoices, contacts, products, organizationId, defaultFlow = "ALL", hideFlowFilters = false, purchaseOrders = [], initialPurchaseOrderId }: InvoiceManagerProps) {
    const [invoices, setInvoices] = useState<SerializedInvoice[]>(initialInvoices);
    const [isCreating, setIsCreating] = useState(Boolean(initialPurchaseOrderId));
    const initialFilter = useMemo<InvoiceFlow | 'ALL'>(() => defaultFlow, [defaultFlow]);
    const [filter, setFilter] = useState<InvoiceFlow | 'ALL'>(initialFilter);
    const [activeAttachmentInvoiceId, setActiveAttachmentInvoiceId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortKey, setSortKey] = useState<'date' | 'contact' | 'total' | 'number'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const PAGE_SIZE_OPTIONS = [10, 20, 50];
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
    const [page, setPage] = useState(1);

    const enforcedFlow = defaultFlow !== 'ALL' ? defaultFlow : undefined;
    const [newInvoice, setNewInvoice] = useState({
        flow: (enforcedFlow ?? "SALE") as InvoiceFlow,
        letter: "A" as InvoiceLetter,
        pointOfSale: 1,
        number: 0,
        date: new Date().toISOString().split('T')[0],
        dueDate: "",
        contactId: "",
        items: [{ productId: "", description: "", quantity: 1, unitPrice: 0, vatRate: 21 }]
    });
    const [hasManualPointOfSale, setHasManualPointOfSale] = useState(false);
    const [hasManualNumber, setHasManualNumber] = useState(false);
    const [isSequenceLoading, setIsSequenceLoading] = useState(false);
    const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(initialPurchaseOrderId || "");
    const selectedPurchaseOrder = useMemo(() => {
        if (!selectedPurchaseOrderId) return null;
        return purchaseOrders.find(order => order.id === selectedPurchaseOrderId) ?? null;
    }, [purchaseOrders, selectedPurchaseOrderId]);
    const availablePurchaseOrders = useMemo(() => {
        const eligible = purchaseOrders.filter(order => order.remainingAmount > 0.01);
        if (!newInvoice.contactId) return eligible;
        return eligible.filter(order => order.contactId === newInvoice.contactId);
    }, [purchaseOrders, newInvoice.contactId]);

    useEffect(() => {
        if (isCreating) {
            setHasManualNumber(false);
            setHasManualPointOfSale(false);
        }
    }, [isCreating]);

    useEffect(() => {
        if (newInvoice.flow !== 'SALE') {
            setHasManualNumber(false);
            setHasManualPointOfSale(false);
        }
    }, [newInvoice.flow]);

    useEffect(() => {
        if (!isCreating || newInvoice.flow !== 'SALE' || hasManualNumber || isSequenceLoading) {
            return;
        }

        let cancelled = false;
        setIsSequenceLoading(true);
        getNextInvoiceSequence({
            organizationId,
            flow: 'SALE',
            letter: newInvoice.letter,
            pointOfSale: newInvoice.pointOfSale || 1,
        })
            .then(res => {
                if (!cancelled && res?.success && res.data) {
                    setNewInvoice(prev => ({
                        ...prev,
                        pointOfSale: prev.pointOfSale || res.data.pointOfSale,
                        number: res.data.nextNumber,
                    }));
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setIsSequenceLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isCreating, newInvoice.flow, newInvoice.letter, newInvoice.pointOfSale, organizationId, hasManualNumber, isSequenceLoading]);

    useEffect(() => {
        if (enforcedFlow) {
            setFilter(enforcedFlow);
            setNewInvoice(prev => ({ ...prev, flow: enforcedFlow }));
        }
    }, [enforcedFlow]);

    useEffect(() => {
        if (selectedPurchaseOrder && newInvoice.flow !== 'PURCHASE') {
            setNewInvoice(prev => ({ ...prev, flow: 'PURCHASE' }));
        }
        if (selectedPurchaseOrder && enforcedFlow === 'PURCHASE') {
            setFilter('PURCHASE');
        }
        if (selectedPurchaseOrder) {
            setNewInvoice(prev => ({
                ...prev,
                contactId: selectedPurchaseOrder.contactId ?? "",
                items: selectedPurchaseOrder.items.map(item => ({
                    productId: item.productId || "",
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    vatRate: item.vatRate,
                })),
            }));
        }
    }, [selectedPurchaseOrder, enforcedFlow, newInvoice.flow]);

    useEffect(() => {
        if (selectedPurchaseOrderId && newInvoice.flow !== 'PURCHASE') {
            setSelectedPurchaseOrderId("");
        }
    }, [selectedPurchaseOrderId, newInvoice.flow]);

    useEffect(() => {
        if (selectedPurchaseOrder && newInvoice.contactId && selectedPurchaseOrder.contactId !== newInvoice.contactId) {
            setSelectedPurchaseOrderId("");
        }
    }, [selectedPurchaseOrder, newInvoice.contactId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const loadingToast = toast.loading("Guardando factura...");
        const res = await createInvoice({
            ...newInvoice,
            organizationId,
            date: parseLocalDate(newInvoice.date),
            dueDate: newInvoice.dueDate ? parseLocalDate(newInvoice.dueDate) : undefined,
            items: newInvoice.items.map(i => ({
                ...i,
                total: i.quantity * i.unitPrice // This will be recalculated on server but good for UI if we showed it
            })),
            purchaseOrderId: selectedPurchaseOrderId || undefined,
        });

        toast.dismiss(loadingToast);

        if (res.success && res.data) {
            toast.success("Factura creada exitosamente");
            window.location.reload();
        } else {
            toast.error(res.error || "Error al crear la factura");
        }
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...newInvoice.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setNewInvoice({ ...newInvoice, items: newItems });
    };

    const addItem = () => {
        setNewInvoice({ ...newInvoice, items: [...newInvoice.items, { productId: "", description: "", quantity: 1, unitPrice: 0, vatRate: 21 }] });
    };

    const removeItem = (index: number) => {
        setNewInvoice({ ...newInvoice, items: newInvoice.items.filter((_, i) => i !== index) });
    };

    const handleProductSelect = (index: number, productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            const newItems = [...newInvoice.items];
            // Use salePrice for sales, purchasePrice for purchases
            const price = newInvoice.flow === 'SALE' ? Number(product.salePrice) : Number(product.purchasePrice);
            newItems[index] = {
                ...newItems[index],
                productId: product.id,
                description: product.name,
                unitPrice: price,
            };
            setNewInvoice({ ...newInvoice, items: newItems });
        } else if (productId === "") {
            const newItems = [...newInvoice.items];
            newItems[index] = {
                ...newItems[index],
                productId: "",
                description: "",
                unitPrice: 0,
            };
            setNewInvoice({ ...newInvoice, items: newItems });
        }
    };

    const handleSort = (key: typeof sortKey) => {
        setSortDirection(prev => (key === sortKey ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
        setSortKey(key);
    };

    const filteredInvoices = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();

        const flowFiltered = invoices.filter(i => filter === 'ALL' || i.flow === filter);

        const searched = flowFiltered.filter(invoice => {
            if (!query) return true;
            const contactLabel = invoice.contactName || invoice.contact?.name || 'Consumidor Final';
            const formattedNumber = `${invoice.letter} ${String(invoice.pointOfSale).padStart(4, '0')}-${String(invoice.number).padStart(8, '0')}`;
            return (
                contactLabel.toLowerCase().includes(query) ||
                formattedNumber.toLowerCase().includes(query) ||
                (invoice.contact?.cuit?.toLowerCase().includes(query) ?? false)
            );
        });

        const sorted = [...searched].sort((a, b) => {
            let comparison = 0;

            switch (sortKey) {
                case 'contact': {
                    const contactA = (a.contactName || a.contact?.name || '').toLowerCase();
                    const contactB = (b.contactName || b.contact?.name || '').toLowerCase();
                    comparison = contactA.localeCompare(contactB, 'es');
                    break;
                }
                case 'total':
                    comparison = Number(a.totalAmount) - Number(b.totalAmount);
                    break;
                case 'number':
                    comparison = Number(a.number) - Number(b.number);
                    break;
                case 'date':
                default:
                    comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
                    break;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return sorted;
    }, [invoices, filter, searchTerm, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
    const paginatedInvoices = filteredInvoices.slice((page - 1) * pageSize, page * pageSize);

    useEffect(() => {
        setPage(1);
    }, [filter, searchTerm, sortKey, sortDirection, pageSize]);

    const handleExportCsv = () => {
        if (!filteredInvoices.length) {
            toast.info("No hay facturas para exportar");
            return;
        }

        const header = ["Tipo", "Comprobante", "Fecha", "Contacto", "CUIT", "Neto", "IVA", "Total", "Adjuntos"];
        const rows = filteredInvoices.map(inv => [
            inv.flow === 'SALE' ? 'Venta' : 'Compra',
            `${inv.letter} ${String(inv.pointOfSale).padStart(4, '0')}-${String(inv.number).padStart(8, '0')}`,
            new Date(inv.date).toLocaleDateString('es-AR'),
            inv.contactName || inv.contact?.name || 'Consumidor Final',
            inv.contact?.cuit ?? '',
            Number(inv.netAmount).toFixed(2),
            Number(inv.vatAmount).toFixed(2),
            Number(inv.totalAmount).toFixed(2),
            String(inv.attachments?.length || 0),
        ]);

        const csvContent = [header, ...rows]
            .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `facturas-${filter.toLowerCase()}-${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleAttachmentUploaded = (invoiceId: string, attachment: SerializedAttachment) => {
        setInvoices(prev => prev.map(inv => inv.id === invoiceId
            ? { ...inv, attachments: [...(inv.attachments || []), attachment] }
            : inv
        ));
    };

    const activeInvoice = useMemo(
        () => invoices.find(inv => inv.id === activeAttachmentInvoiceId) ?? null,
        [invoices, activeAttachmentInvoiceId]
    );

    // Calculate totals for preview
    const calculateTotal = () => {
        let net = 0;
        let vat = 0;
        newInvoice.items.forEach(item => {
            const lineNet = item.quantity * item.unitPrice;
            const lineVat = lineNet * (item.vatRate / 100);
            net += lineNet;
            vat += lineVat;
        });
        return { net, vat, total: net + vat };
    };

    const { net, vat, total } = calculateTotal();

    return (
        <>
        <div className="space-y-6">
            {!isCreating ? (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                    <div className="p-4 border-b border-gray-200 space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            {!hideFlowFilters ? (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setFilter('ALL')}
                                        className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", filter === 'ALL' ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
                                    >
                                        Todas
                                    </button>
                                    <button
                                        onClick={() => setFilter('SALE')}
                                        className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", filter === 'SALE' ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
                                    >
                                        Ventas
                                    </button>
                                    <button
                                        onClick={() => setFilter('PURCHASE')}
                                        className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", filter === 'PURCHASE' ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
                                    >
                                        Compras
                                    </button>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500">
                                    Mostrando {filter === 'SALE' ? 'Ventas' : filter === 'PURCHASE' ? 'Compras' : 'Todas'}
                                </div>
                            )}
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                                <button
                                    type="button"
                                    onClick={handleExportCsv}
                                    className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                                >
                                    <FileText className="h-4 w-4" /> Exportar CSV
                                </button>
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Buscar por cliente, proveedor o número"
                                        className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    />
                                </div>
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    Nueva Factura
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-xs border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 w-[200px]">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('number')}
                                            className="flex items-center gap-1 font-medium text-gray-600"
                                        >
                                            Comprobante
                                            <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === 'number' ? "text-gray-900" : "text-gray-300")} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('date')}
                                            className="flex items-center gap-1 font-medium text-gray-600"
                                        >
                                            Fecha
                                            <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === 'date' ? "text-gray-900" : "text-gray-300")} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('contact')}
                                            className="flex items-center gap-1 font-medium text-gray-600"
                                        >
                                            Contacto
                                            <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === 'contact' ? "text-gray-900" : "text-gray-300")} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('contact')}
                                            className="flex items-center gap-1 font-medium text-gray-600"
                                        >
                                            CUIT
                                            <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === 'contact' ? "text-gray-900" : "text-gray-300")} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('contact')}
                                            className="flex items-center gap-1 font-medium text-gray-600"
                                        >
                                            Neto
                                            <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === 'contact' ? "text-gray-900" : "text-gray-300")} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('contact')}
                                            className="flex items-center gap-1 font-medium text-gray-600"
                                        >
                                            IVA
                                            <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === 'contact' ? "text-gray-900" : "text-gray-300")} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={() => handleSort('total')}
                                            className="flex items-center gap-1 font-medium text-gray-600 ml-auto"
                                        >
                                            Total
                                            <ArrowUpDown className={cn("h-3.5 w-3.5", sortKey === 'total' ? "text-gray-900" : "text-gray-300")} />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3 text-center">Adjuntos</th>
                                    <th className="px-4 py-3 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-700">
                                {paginatedInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-10 text-gray-500">
                                            No se encontraron facturas con los filtros actuales.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedInvoices.map(invoice => {
                                        const detailHref = invoice.flow === 'SALE'
                                            ? `/dashboard/sales/${invoice.id}`
                                            : `/dashboard/purchases/${invoice.id}`;

                                        return (
                                            <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <Link href={detailHref} className="flex items-center gap-2 text-gray-900 font-semibold">
                                                        {/* {invoice.flow === 'SALE' ? (
                                                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                                                        ) : (
                                                            <ArrowDownLeft className="h-4 w-4 text-red-600" />
                                                        )} */}
                                                        {invoice.letter} {String(invoice.pointOfSale).padStart(4, '0')}-{String(invoice.number).padStart(8, '0')}
                                                    </Link>
                                                    {/* <p className="text-xs text-gray-500 mt-1">
                                                        {invoice.flow === 'SALE' ? 'Venta' : 'Compra'}
                                                    </p> */}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {new Date(invoice.date).toLocaleDateString('es-AR')}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-gray-900">{invoice.contactName || invoice.contact?.name || 'Consumidor Final'}</p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 text-sm">
                                                    {invoice.contact?.cuit || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600">
                                                    ${Number(invoice.netAmount).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600">
                                                    ${Number(invoice.vatAmount).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                                    ${Number(invoice.totalAmount).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveAttachmentInvoiceId(invoice.id)}
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                                                    >
                                                        <Paperclip className="h-4 w-4" />
                                                        {invoice.attachments?.length || 0} archivos
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Link
                                                        href={detailHref}
                                                        className="text-sm font-medium text-gray-900 hover:text-gray-600"
                                                    >
                                                        Ver detalle →
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                        <div className="px-4 py-3 border-t border-gray-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between text-sm text-gray-600">
                            <p>
                                Mostrando
                                <span className="font-medium"> {paginatedInvoices.length} </span>
                                de
                                <span className="font-medium"> {filteredInvoices.length} </span>
                                facturas
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span>Filas por página</span>
                                    <select
                                        value={pageSize}
                                        onChange={e => setPageSize(Number(e.target.value))}
                                        className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    >
                                        {[10, 20, 50, 100].map(option => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                        disabled={page === 1}
                                        className={cn(
                                        "px-3 py-1.5 rounded-md border text-xs font-medium",
                                        page === 1 ? "text-gray-400 border-gray-200 cursor-not-allowed" : "text-gray-700 border-gray-300 hover:bg-gray-50"
                                    )}
                                >
                                    Anterior
                                </button>
                                    <span className="text-xs text-gray-500">
                                        Página {page} de {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={page === totalPages}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md border text-xs font-medium",
                                        page === totalPages ? "text-gray-400 border-gray-200 cursor-not-allowed" : "text-gray-700 border-gray-300 hover:bg-gray-50"
                                    )}
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-gray-900">Nueva Factura</h3>
                        <button onClick={() => setIsCreating(false)} className="text-sm text-gray-500 hover:text-gray-900">
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comprobante</label>
                                <div className="flex gap-2">
                                    <select
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        value={newInvoice.flow}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, flow: e.target.value as InvoiceFlow })}
                                    >
                                        <option value="SALE">Venta</option>
                                        <option value="PURCHASE">Compra</option>
                                    </select>
                                    <select
                                        className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        value={newInvoice.letter}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, letter: e.target.value as InvoiceLetter })}
                                    >
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                        <option value="M">M</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="number"
                                        className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        placeholder="PV"
                                        value={newInvoice.pointOfSale}
                                        onChange={(e) => {
                                            setHasManualPointOfSale(true);
                                            setNewInvoice({ ...newInvoice, pointOfSale: parseInt(e.target.value) || 0 });
                                        }}
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="number"
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        placeholder="Número"
                                        value={newInvoice.number}
                                        onChange={(e) => {
                                            setHasManualNumber(true);
                                            setNewInvoice({ ...newInvoice, number: parseInt(e.target.value) || 0 });
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    {newInvoice.flow === 'SALE'
                                        ? isSequenceLoading
                                            ? 'Obteniendo correlativo…'
                                            : 'Autocompletamos con el último correlativo disponible, podés editarlo.'
                                        : 'Completá el número según el comprobante recibido.'}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={newInvoice.date}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                                />
                            </div>
                        </div>

                        {newInvoice.flow === 'PURCHASE' && (
                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium text-gray-900">Importar Orden de Compra</p>
                                        <p className="text-xs text-gray-500">Podés usar una orden aprobada para completar proveedor e ítems automáticamente.</p>
                                    </div>
                                    {selectedPurchaseOrderId && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedPurchaseOrderId("")}
                                            className="text-xs font-medium text-gray-500 hover:text-gray-900"
                                        >
                                            Limpiar selección
                                        </button>
                                    )}
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                    {availablePurchaseOrders.length === 0 ? (
                                        <p className="text-xs text-gray-500">
                                            {newInvoice.contactId
                                                ? "Este proveedor no tiene órdenes aprobadas con saldo pendiente."
                                                : "No hay órdenes aprobadas con saldo pendiente."}
                                        </p>
                                    ) : (
                                        <>
                                            <select
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                                value={selectedPurchaseOrderId}
                                                onChange={(event) => setSelectedPurchaseOrderId(event.target.value)}
                                            >
                                                <option value="">Sin orden vinculada</option>
                                                {availablePurchaseOrders.map(order => (
                                                    <option key={order.id} value={order.id}>
                                                        #{order.orderNumber} · {order.contact?.name || 'Proveedor'} · Saldo ${order.remainingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </option>
                                                ))}
                                            </select>
                                            {selectedPurchaseOrder && (
                                                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                                                    <p className="font-medium text-gray-900">{selectedPurchaseOrder.items.length} ítems</p>
                                                    <p>Emitida el {new Date(selectedPurchaseOrder.issueDate).toLocaleDateString('es-AR')}</p>
                                                    {selectedPurchaseOrder.expectedDate && (
                                                        <p>Entrega estimada {new Date(selectedPurchaseOrder.expectedDate).toLocaleDateString('es-AR')}</p>
                                                    )}
                                                    <p className="font-semibold text-gray-900">Saldo pendiente ${selectedPurchaseOrder.remainingAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {newInvoice.flow === 'SALE' ? 'Cliente' : 'Proveedor'}
                                </label>
                                <select
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={newInvoice.contactId}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, contactId: e.target.value })}
                                    disabled={Boolean(selectedPurchaseOrderId)}
                                >
                                    <option value="">Seleccionar...</option>
                                    {contacts
                                        .filter(c => newInvoice.flow === 'SALE' ? c.type === 'CUSTOMER' : c.type === 'VENDOR')
                                        .map(c => (
                                            <option key={c.id} value={c.id}>{c.name} ({c.cuit || 'S/C'})</option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento (Opcional)</label>
                                <input
                                    type="date"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={newInvoice.dueDate}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, dueDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700 w-48">Producto</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-700">Descripción</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-700 w-24">Cant.</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-700 w-32">Precio Unit.</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-700 w-24">IVA %</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-700 w-32">Subtotal</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {newInvoice.items.map((item, index) => (
                                        <tr key={index}>
                                            <td className="p-2">
                                                <select
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={item.productId || ""}
                                                    onChange={(e) => handleProductSelect(index, e.target.value)}
                                                >
                                                    <option value="">Libre</option>
                                                    {products.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={item.description}
                                                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    required
                                                    min="0.01"
                                                    step="0.01"
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-right text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    required
                                                    min="0"
                                                    step="0.01"
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-right text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={item.unitPrice}
                                                    onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <select
                                                    className="w-full rounded border-gray-300 text-sm py-1 text-right text-gray-900 focus:ring-gray-900 focus:border-gray-900"
                                                    value={item.vatRate}
                                                    onChange={(e) => updateItem(index, 'vatRate', parseFloat(e.target.value))}
                                                >
                                                    <option value={0}>0%</option>
                                                    <option value={10.5}>10.5%</option>
                                                    <option value={21}>21%</option>
                                                    <option value={27}>27%</option>
                                                </select>
                                            </td>
                                            <td className="p-2 text-right font-mono text-gray-900">
                                                ${(item.quantity * item.unitPrice).toFixed(2)}
                                            </td>
                                            <td className="p-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
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
                                        <td colSpan={5} className="px-4 py-1 text-right text-gray-600">Neto Gravado:</td>
                                        <td className="px-4 py-1 text-right text-gray-900">${net.toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                    <tr>
                                        <td colSpan={5} className="px-4 py-1 text-right text-gray-600">IVA:</td>
                                        <td className="px-4 py-1 text-right text-gray-900">${vat.toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                    <tr className="text-lg font-bold">
                                        <td colSpan={5} className="px-4 py-2 text-right text-gray-900">Total:</td>
                                        <td className="px-4 py-2 text-right text-gray-900">${total.toFixed(2)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={addItem}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 text-gray-700"
                            >
                                <Plus className="h-4 w-4" />
                                Agregar Item
                            </button>
                            <button
                                type="submit"
                                className="ml-auto flex items-center gap-2 px-6 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800"
                            >
                                <FileText className="h-4 w-4" />
                                Guardar Factura
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>

        {activeInvoice && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-gray-500">Archivos adjuntos</p>
                            <p className="text-sm font-medium text-gray-900">
                                {activeInvoice.letter} {String(activeInvoice.pointOfSale).padStart(4, '0')}-{String(activeInvoice.number).padStart(8, '0')}
                            </p>
                        </div>
                        <button onClick={() => setActiveAttachmentInvoiceId(null)} className="text-gray-400 hover:text-gray-900">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <AttachmentViewer attachments={activeInvoice.attachments || []} emptyStateLabel="Aún no hay archivos" />
                        <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">Subir nuevo archivo (PDF o imagen)</p>
                            <FileUploader
                                organizationId={organizationId}
                                entityId={activeInvoice.id}
                                entityType="invoice"
                                existingAttachments={activeInvoice.attachments || []}
                                acceptedFileTypes={["application/pdf", "image/*"]}
                                onUploadComplete={(attachment) => {
                                    handleAttachmentUploaded(activeInvoice.id, attachment);
                                    toast.success("Adjunto subido correctamente");
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
