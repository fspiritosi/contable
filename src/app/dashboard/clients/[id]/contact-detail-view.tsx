'use client';

import { useState } from 'react';
import Link from "next/link";
import { ArrowLeft, User, Edit2 } from "lucide-react";
import { updateContact } from "@/actions/contacts";
import { toast } from "sonner";
import { ContactType } from "@prisma/client";
import FileUploader from "@/components/file-uploader";
import { InvoicesTable } from "@/components/pui/invoicesTable";
import { PurchaseOrdersTable } from "@/components/pui/purchaseOrdersTable";
import { formatCurrency } from "@/lib/utils";


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



    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/clients"
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
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalInvoiced)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Total {contact.type === 'CUSTOMER' ? 'Cobrado' : 'Pagado'}</p>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Saldo Pendiente</p>
                        <p className={`text-2xl font-bold ${summary.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(summary.balance)}
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

            <div className={`grid gap-6 ${contact.type === 'VENDOR' ? 'lg:grid-cols-2' : ''}`}>
                {contact.type === 'VENDOR' && (

                    <PurchaseOrdersTable orders={purchaseOrders} emptyMessage="Sin órdenes de compra asociadas." />
                )}
                <InvoicesTable invoices={invoices} emptyMessage="Todavía no registraste facturas." />
            </div>
        </div>
    );
}
