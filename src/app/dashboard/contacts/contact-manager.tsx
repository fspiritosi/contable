'use client';

import { useState } from "react";
import { Contact, ContactType } from "@prisma/client";
import { createContact, deleteContact } from "@/actions/contacts";
import { Plus, User, Building2, Phone, Mail, MapPin, Trash2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ContactManagerProps {
    initialContacts: Contact[];
    organizationId: string;
}

export default function ContactManager({ initialContacts, organizationId }: ContactManagerProps) {
    const [contacts, setContacts] = useState<Contact[]>(initialContacts);
    const [isCreating, setIsCreating] = useState(false);
    const [filter, setFilter] = useState<ContactType | 'ALL'>('ALL');

    const [newContact, setNewContact] = useState({
        name: "",
        cuit: "",
        email: "",
        address: "",
        phone: "",
        type: "CUSTOMER" as ContactType,
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createContact({ ...newContact, organizationId });

        if (res.success && res.data) {
            setContacts([...contacts, res.data]);
            setIsCreating(false);
            setNewContact({
                name: "",
                cuit: "",
                email: "",
                address: "",
                phone: "",
                type: "CUSTOMER",
            });
        } else {
            alert("Error creating contact: " + res.error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este contacto?")) return;
        const res = await deleteContact(id);
        if (res.success) {
            setContacts(contacts.filter(c => c.id !== id));
        } else {
            alert("Error deleting contact");
        }
    }

    const filteredContacts = contacts.filter(c => filter === 'ALL' || c.type === filter);

    return (
        <div className="space-y-6">
            {!isCreating ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('ALL')}
                                className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", filter === 'ALL' ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
                            >
                                Todos
                            </button>
                            <button
                                onClick={() => setFilter('CUSTOMER')}
                                className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", filter === 'CUSTOMER' ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
                            >
                                Clientes
                            </button>
                            <button
                                onClick={() => setFilter('VENDOR')}
                                className={cn("px-3 py-1.5 text-sm rounded-md transition-colors", filter === 'VENDOR' ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900")}
                            >
                                Proveedores
                            </button>
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo Contacto
                        </button>
                    </div>

                    <div className="divide-y divide-gray-200">
                        {filteredContacts.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No hay contactos registrados en esta categoría.
                            </div>
                        ) : (
                            filteredContacts.map((contact) => (
                                <div key={contact.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-start gap-3">
                                        <div className={cn("p-2 rounded-lg", contact.type === 'CUSTOMER' ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600")}>
                                            {contact.type === 'CUSTOMER' ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Link href={`/dashboard/contacts/${contact.id}`} className="hover:underline">
                                                    <h4 className="font-medium text-gray-900">{contact.name}</h4>
                                                </Link>
                                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", contact.type === 'CUSTOMER' ? "bg-blue-50 border-blue-100 text-blue-600" : "bg-orange-50 border-orange-100 text-orange-600")}>
                                                    {contact.type === 'CUSTOMER' ? 'Cliente' : 'Proveedor'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                                                {contact.cuit && <span className="font-mono text-xs bg-gray-100 px-1 rounded">{contact.cuit}</span>}
                                                {contact.email && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="h-3 w-3" />
                                                        {contact.email}
                                                    </span>
                                                )}
                                                {contact.phone && (
                                                    <span className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3" />
                                                        {contact.phone}
                                                    </span>
                                                )}
                                                {contact.address && (
                                                    <span className="flex items-center gap-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {contact.address}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(contact.id)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-600 transition-all"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-gray-900">Nuevo Contacto</h3>
                        <button onClick={() => setIsCreating(false)} className="text-sm text-gray-500 hover:text-gray-900">
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                <select
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={newContact.type}
                                    onChange={(e) => setNewContact({ ...newContact, type: e.target.value as ContactType })}
                                >
                                    <option value="CUSTOMER">Cliente</option>
                                    <option value="VENDOR">Proveedor</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre / Razón Social</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="e.g. Juan Perez"
                                    value={newContact.name}
                                    onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CUIT (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="e.g. 20-12345678-9"
                                    value={newContact.cuit}
                                    onChange={(e) => setNewContact({ ...newContact, cuit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Opcional)</label>
                                <input
                                    type="email"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="email@ejemplo.com"
                                    value={newContact.email}
                                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="+54 9 11 ..."
                                    value={newContact.phone}
                                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    placeholder="Calle 123"
                                    value={newContact.address}
                                    onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
                                />
                            </div>
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
                                Guardar Contacto
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
