'use client';

import { useState } from "react";
import { Invoice, InvoiceFlow, InvoiceLetter, Contact, Product } from "@prisma/client";
import { createInvoice } from "@/actions/invoices";
import { Plus, FileText, ArrowUpRight, ArrowDownLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";

interface InvoiceManagerProps {
    initialInvoices: (Invoice & { contact: Contact | null, items: any[] })[];
    contacts: Contact[];
    products: Product[];
    organizationId: string;
}

export default function InvoiceManager({ initialInvoices, contacts, products, organizationId }: InvoiceManagerProps) {
    const [invoices, setInvoices] = useState(initialInvoices);
    const [isCreating, setIsCreating] = useState(false);
    const [filter, setFilter] = useState<InvoiceFlow | 'ALL'>('ALL');

    const [newInvoice, setNewInvoice] = useState({
        flow: "SALE" as InvoiceFlow,
        letter: "A" as InvoiceLetter,
        pointOfSale: 1,
        number: 0,
        date: new Date().toISOString().split('T')[0],
        dueDate: "",
        contactId: "",
        items: [{ productId: "", description: "", quantity: 1, unitPrice: 0, vatRate: 21 }]
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createInvoice({
            ...newInvoice,
            organizationId,
            date: parseLocalDate(newInvoice.date),
            dueDate: newInvoice.dueDate ? parseLocalDate(newInvoice.dueDate) : undefined,
            items: newInvoice.items.map(i => ({
                ...i,
                total: i.quantity * i.unitPrice // This will be recalculated on server but good for UI if we showed it
            }))
        });

        if (res.success && res.data) {
            // Refresh or add to list. For simplicity, we might need to reload or fetch again to get relations, 
            // but let's just add what we have and maybe missing relations will be null until refresh.
            // Actually, server action returns the created invoice but without relations unless we include them.
            // A full refresh is safer or we manually construct the object.
            // Let's just reload page for simplicity in this MVP or try to append.
            window.location.reload();
        } else {
            alert("Error creating invoice: " + res.error);
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

    const filteredInvoices = invoices.filter(i => filter === 'ALL' || i.flow === filter);

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
        <div className="space-y-6">
            {!isCreating ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex gap-2">
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
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva Factura
                        </button>
                    </div>

                    <div className="divide-y divide-gray-200">
                        {filteredInvoices.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                No hay facturas registradas en esta categoría.
                            </div>
                        ) : (
                            filteredInvoices.map((invoice) => (
                                <div key={invoice.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between group">
                                    <div className="flex items-start gap-3">
                                        <div className={cn("p-2 rounded-lg", invoice.flow === 'SALE' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                                            {invoice.flow === 'SALE' ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 text-lg">
                                                    {invoice.letter} {String(invoice.pointOfSale).padStart(4, '0')}-{String(invoice.number).padStart(8, '0')}
                                                </span>
                                                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border", invoice.flow === 'SALE' ? "bg-green-50 border-green-100 text-green-600" : "bg-red-50 border-red-100 text-red-600")}>
                                                    {invoice.flow === 'SALE' ? 'Venta' : 'Compra'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col text-sm text-gray-500 mt-1">
                                                <span>{new Date(invoice.date).toLocaleDateString()}</span>
                                                <span className="font-medium text-gray-700">{invoice.contactName || invoice.contact?.name || 'Consumidor Final'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-gray-900 text-lg">
                                            ${Number(invoice.totalAmount).toFixed(2)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Neto: ${Number(invoice.netAmount).toFixed(2)} | IVA: ${Number(invoice.vatAmount).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
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
                                        onChange={(e) => setNewInvoice({ ...newInvoice, pointOfSale: parseInt(e.target.value) })}
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="number"
                                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                        placeholder="Número"
                                        value={newInvoice.number}
                                        onChange={(e) => setNewInvoice({ ...newInvoice, number: parseInt(e.target.value) })}
                                    />
                                </div>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {newInvoice.flow === 'SALE' ? 'Cliente' : 'Proveedor'}
                                </label>
                                <select
                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                    value={newInvoice.contactId}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, contactId: e.target.value })}
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
    );
}
