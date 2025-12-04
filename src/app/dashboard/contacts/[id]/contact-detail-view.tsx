'use client';

import { useMemo, useState } from 'react';
import Link from "next/link";
import { ArrowLeft, User, FileText, DollarSign, Edit2 } from "lucide-react";
import { updateContact } from "@/actions/contacts";
import { toast } from "sonner";
import { ContactType } from "@prisma/client";
import FileUploader from "@/components/file-uploader";

type OrderSortKey = 'orderNumber' | 'issueDate' | 'status' | 'total' | 'invoicedAmount' | 'remainingAmount';
type InvoiceSortKey = 'number' | 'date' | 'status' | 'total' | 'balance';

export default function ContactDetailView({ data }: { data: any }) {
    const { contact, summary, purchaseOrders = [], invoices = [] } = data;
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        name: contact.name,
        cuit: contact.cuit || '',
        email: contact.email || '',
        phone: contact.phone || '',
        address: contact.address || '',
        type: contact.type as ContactType,
    });

    const [orderSearchTerm, setOrderSearchTerm] = useState('');
    const [orderDateFilter, setOrderDateFilter] = useState('');
    const [orderSortKey, setOrderSortKey] = useState<OrderSortKey>('issueDate');
    const [orderSortDirection, setOrderSortDirection] = useState<'asc' | 'desc'>('desc');

    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
    const [invoiceDateFilter, setInvoiceDateFilter] = useState('');
    const [invoiceSortKey, setInvoiceSortKey] = useState<InvoiceSortKey>('date');
    const [invoiceSortDirection, setInvoiceSortDirection] = useState<'asc' | 'desc'>('desc');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const loadingToast = toast.loading('Actualizando contacto...');

        const res = await updateContact(contact.id, formData);
        toast.dismiss(loadingToast);

        if (res.success) {
            toast.success('Contacto actualizado exitosamente');
            setIsEditing(false);
            window.location.reload();
        } else {
            toast.error(res.error || 'Error al actualizar');
        }
    };

    const getOrderStatusWeight = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return 3;
            case 'PENDING':
                return 2;
            case 'REJECTED':
                return 1;
            default:
                return 0;
        }
    };

    const formatInvoiceNumber = (invoice: any) => `${invoice.letter} ${String(invoice.pointOfSale).padStart(4, '0')}-${String(invoice.number).padStart(8, '0')}`;

const toISODate = (value: string | Date | null | undefined) => {
    if (!value) return '';
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const normalizeOrderNumber = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return String(value);
};

    const filteredOrders = useMemo(() => {
        const term = orderSearchTerm.trim().toLowerCase();
        const sorted = [...purchaseOrders]
            .filter(order => {
                if (!term) return true;
                const orderNumber = normalizeOrderNumber(order.orderNumber).toLowerCase();
                return orderNumber.includes(term);
            })
            .filter(order => {
                if (!orderDateFilter) return true;
                const issueDate = toISODate(order.issueDate);
                if (!issueDate) return false;
                return issueDate === orderDateFilter;
            })
            .sort((a, b) => {
                let compare = 0;
                switch (orderSortKey) {
                    case 'orderNumber':
                        compare = normalizeOrderNumber(a.orderNumber).localeCompare(normalizeOrderNumber(b.orderNumber), undefined, { numeric: true });
                        break;
                    case 'issueDate':
                        compare = new Date(a.issueDate || '').getTime() - new Date(b.issueDate || '').getTime();
                        break;
                    case 'status':
                        compare = getOrderStatusWeight(a.status) - getOrderStatusWeight(b.status);
                        break;
                    case 'total':
                        compare = Number(a.total) - Number(b.total);
                        break;
                    case 'invoicedAmount':
                        compare = Number(a.invoicedAmount) - Number(b.invoicedAmount);
                        break;
                    case 'remainingAmount':
                        compare = Number(a.remainingAmount) - Number(b.remainingAmount);
                        break;
                    default:
                        compare = 0;
                }
                return orderSortDirection === 'asc' ? compare : -compare;
            });
        return sorted;
    }, [purchaseOrders, orderSearchTerm, orderDateFilter, orderSortKey, orderSortDirection]);

    const filteredInvoices = useMemo(() => {
        const term = invoiceSearchTerm.trim().toLowerCase();
        const sorted = [...invoices]
            .filter(invoice => {
                if (!term) return true;
                return formatInvoiceNumber(invoice).toLowerCase().includes(term);
            })
            .filter(invoice => {
                if (!invoiceDateFilter) return true;
                const invoiceDate = toISODate(invoice.date);
                if (!invoiceDate) return false;
                return invoiceDate === invoiceDateFilter;
            })
            .sort((a, b) => {
                let compare = 0;
                switch (invoiceSortKey) {
                    case 'number':
                        compare = formatInvoiceNumber(a).localeCompare(formatInvoiceNumber(b), undefined, { numeric: true });
                        break;
                    case 'date':
                        compare = new Date(a.date).getTime() - new Date(b.date).getTime();
                        break;
                    case 'status':
                        compare = Number(a.isPaid) - Number(b.isPaid);
                        break;
                    case 'total':
                        compare = Number(a.totalAmount) - Number(b.totalAmount);
                        break;
                    case 'balance':
                        compare = Number(a.balance) - Number(b.balance);
                        break;
                    default:
                        compare = 0;
                }
                return invoiceSortDirection === 'asc' ? compare : -compare;
            });
        return sorted;
    }, [invoices, invoiceSearchTerm, invoiceDateFilter, invoiceSortKey, invoiceSortDirection]);

    const renderSortIndicator = (active: boolean, direction: 'asc' | 'desc') => (
        <span className="text-[10px] text-gray-500">
            {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
    );

    const handleOrderSort = (key: OrderSortKey) => {
        if (orderSortKey === key) {
            setOrderSortDirection(orderSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setOrderSortKey(key);
            setOrderSortDirection('asc');
        }
    };

    const handleInvoiceSort = (key: InvoiceSortKey) => {
        if (invoiceSortKey === key) {
            setInvoiceSortDirection(invoiceSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setInvoiceSortKey(key);
            setInvoiceSortDirection('asc');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/contacts"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">{contact.name}</h2>
                    <p className="text-gray-500">Estado de cuenta</p>
                </div>
            </div>

            {/* Contact Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                            <User className="h-5 w-5 text-gray-700" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Tipo</p>
                            <p className="font-semibold text-gray-900">
                                {contact.type === 'CUSTOMER' ? 'Cliente' : 'Proveedor'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Total Facturado</p>
                        <p className="text-2xl font-bold text-gray-900">${summary.totalInvoiced.toFixed(2)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Total {contact.type === 'CUSTOMER' ? 'Cobrado' : 'Pagado'}</p>
                        <p className="text-2xl font-bold text-green-600">${summary.totalPaid.toFixed(2)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Saldo Pendiente</p>
                        <p className={`text-2xl font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ${summary.balance.toFixed(2)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Contact Details - Editable */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Información del Contacto</h3>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <Edit2 className="h-4 w-4" />
                            Editar
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as ContactType })}
                                >
                                    <option value="CUSTOMER">Cliente</option>
                                    <option value="VENDOR">Proveedor</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CUIT</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.cuit}
                                    onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                                <input
                                    type="tel"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Logo/Avatar</label>
                            <FileUploader
                                organizationId={contact.organizationId}
                                entityId={contact.id}
                                entityType="contact"
                                existingAttachments={contact.attachments || []}
                                maxFiles={1}
                                acceptedFileTypes={['image/*']}
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditing(false);
                                    setFormData({
                                        name: contact.name,
                                        cuit: contact.cuit || '',
                                        email: contact.email || '',
                                        phone: contact.phone || '',
                                        address: contact.address || '',
                                        type: contact.type,
                                    });
                                }}
                                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                            >
                                Guardar
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                            <p className="text-gray-500">CUIT</p>
                            <p className="font-medium text-gray-900">{contact.cuit || '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Email</p>
                            <p className="font-medium text-gray-900">{contact.email || '-'}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Teléfono</p>
                            <p className="font-medium text-gray-900">{contact.phone || '-'}</p>
                        </div>
                        {contact.address && (
                            <div className="md:col-span-3">
                                <p className="text-gray-500">Dirección</p>
                                <p className="font-medium text-gray-900">{contact.address}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {contact.type === 'VENDOR' && (
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">Órdenes de Compra</h3>
                            <span className="text-xs text-gray-500">{filteredOrders.length} registros</span>
                        </div>
                        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-3">
                            <input
                                type="text"
                                placeholder="Buscar por número"
                                value={orderSearchTerm}
                                onChange={(e) => setOrderSearchTerm(e.target.value)}
                                className="flex-1 min-w-[160px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                            />
                            <input
                                type="date"
                                value={orderDateFilter}
                                onChange={(e) => setOrderDateFilter(e.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                            />
                            {(orderSearchTerm || orderDateFilter) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOrderSearchTerm('');
                                        setOrderDateFilter('');
                                    }}
                                    className="text-sm text-gray-600 hover:text-gray-900"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3">
                                            <button type="button" className="flex items-center gap-1" onClick={() => handleOrderSort('orderNumber')}>
                                                Orden {renderSortIndicator(orderSortKey === 'orderNumber', orderSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">
                                            <button type="button" className="flex items-center gap-1" onClick={() => handleOrderSort('issueDate')}>
                                                Fecha {renderSortIndicator(orderSortKey === 'issueDate', orderSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">
                                            <button type="button" className="flex items-center gap-1" onClick={() => handleOrderSort('status')}>
                                                Estado {renderSortIndicator(orderSortKey === 'status', orderSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleOrderSort('total')}>
                                                Total {renderSortIndicator(orderSortKey === 'total', orderSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleOrderSort('invoicedAmount')}>
                                                Facturado {renderSortIndicator(orderSortKey === 'invoicedAmount', orderSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleOrderSort('remainingAmount')}>
                                                Saldo {renderSortIndicator(orderSortKey === 'remainingAmount', orderSortDirection)}
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-6 text-center text-gray-500">Sin órdenes de compra asociadas.</td>
                                        </tr>
                                    ) : (
                                        filteredOrders.map((order: any) => (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-xs text-gray-900">#{order.orderNumber}</td>
                                                <td className="px-4 py-3 text-gray-600">{new Date(order.issueDate).toLocaleDateString('es-AR')}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${order.status === 'APPROVED'
                                                        ? 'bg-green-50 text-green-700 border border-green-100'
                                                        : order.status === 'PENDING'
                                                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                    }`}>
                                                        {order.status === 'APPROVED'
                                                            ? 'Aprobada'
                                                            : order.status === 'PENDING'
                                                                ? 'Pendiente'
                                                                : order.status === 'REJECTED'
                                                                    ? 'Rechazada'
                                                                    : order.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-900">${order.total.toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right text-gray-600">${order.invoicedAmount.toFixed(2)}</td>
                                                <td className={`px-4 py-3 text-right font-medium ${order.remainingAmount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                                    ${order.remainingAmount.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow_hidden">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <h3 className="font-semibold text-gray-900">Facturas</h3>
                            <span className="text-xs text-gray-500">{filteredInvoices.length} comprobantes</span>
                        </div>
                        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-3">
                            <input
                                type="text"
                                placeholder="Buscar por número"
                                value={invoiceSearchTerm}
                                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                                className="flex-1 min-w-[160px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                            />
                            <input
                                type="date"
                                value={invoiceDateFilter}
                                onChange={(e) => setInvoiceDateFilter(e.target.value)}
                                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                            />
                            {(invoiceSearchTerm || invoiceDateFilter) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInvoiceSearchTerm('');
                                        setInvoiceDateFilter('');
                                    }}
                                    className="text-sm text-gray-600 hover:text-gray-900"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3">
                                            <button type="button" className="flex items-center gap-1" onClick={() => handleInvoiceSort('number')}>
                                                Comprobante {renderSortIndicator(invoiceSortKey === 'number', invoiceSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">
                                            <button type="button" className="flex items-center gap-1" onClick={() => handleInvoiceSort('date')}>
                                                Fecha {renderSortIndicator(invoiceSortKey === 'date', invoiceSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3">
                                            <button type="button" className="flex items-center gap-1" onClick={() => handleInvoiceSort('status')}>
                                                Estado {renderSortIndicator(invoiceSortKey === 'status', invoiceSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleInvoiceSort('total')}>
                                                Total {renderSortIndicator(invoiceSortKey === 'total', invoiceSortDirection)}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            <button type="button" className="flex items-center gap-1 ml-auto" onClick={() => handleInvoiceSort('balance')}>
                                                Saldo {renderSortIndicator(invoiceSortKey === 'balance', invoiceSortDirection)}
                                            </button>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-6 text-center text-gray-500">Todavía no registraste facturas.</td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((invoice: any) => (
                                            <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-xs text-gray-900">{formatInvoiceNumber(invoice)}</td>
                                                <td className="px-4 py-3 text-gray-600">{new Date(invoice.date).toLocaleDateString('es-AR')}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${invoice.isPaid ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                                        {invoice.isPaid ? 'Pagada' : 'Pendiente'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-900">${invoice.totalAmount.toFixed(2)}</td>
                                                <td className={`px-4 py-3 text-right font-medium ${invoice.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                    ${invoice.balance.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
