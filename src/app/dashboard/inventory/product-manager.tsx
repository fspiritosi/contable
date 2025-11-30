'use client';

import { useState, useEffect } from "react";
import { createProduct, updateProduct, deleteProduct, type SerializedProduct } from "@/actions/products";
import { Plus, Package, Trash2, Search, Edit2, X, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { ItemType, ItemScope, Account } from "@prisma/client";
import FileUploader from "@/components/file-uploader";
import { toast } from "sonner";

interface ProductManagerProps {
    initialProducts: SerializedProduct[];
    organizationId: string;
    accounts: Account[];
}

export default function ProductManager({ initialProducts, organizationId, accounts }: ProductManagerProps) {
    const [products, setProducts] = useState<SerializedProduct[]>(initialProducts);
    const [isCreating, setIsCreating] = useState(false);
    const [editingProduct, setEditingProduct] = useState<SerializedProduct | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const [formData, setFormData] = useState({
        name: "",
        sku: "",
        description: "",
        stock: 0,
        type: ItemType.PRODUCT,
        scope: ItemScope.BOTH,
        isStockable: true,
        purchasePrice: 0,
        salePrice: 0,
        margin: 0,
        salesAccountId: "",
        purchasesAccountId: "",
    });

    // Reset form when creating or editing
    useEffect(() => {
        if (editingProduct) {
            setFormData({
                name: editingProduct.name,
                sku: editingProduct.sku || "",
                description: editingProduct.description || "",
                stock: editingProduct.stock,
                type: editingProduct.type,
                scope: editingProduct.scope,
                isStockable: editingProduct.isStockable,
                purchasePrice: editingProduct.purchasePrice,
                salePrice: editingProduct.salePrice,
                margin: editingProduct.margin,
                salesAccountId: editingProduct.salesAccountId || "",
                purchasesAccountId: editingProduct.purchasesAccountId || "",
            });
        } else {
            setFormData({
                name: "",
                sku: "",
                description: "",
                stock: 0,
                type: ItemType.PRODUCT,
                scope: ItemScope.BOTH,
                isStockable: true,
                purchasePrice: 0,
                salePrice: 0,
                margin: 0,
                salesAccountId: "",
                purchasesAccountId: "",
            });
        }
    }, [editingProduct, isCreating]);

    // Pricing Calculator Logic
    const handlePriceChange = (field: 'purchasePrice' | 'salePrice' | 'margin', value: number) => {
        let newData = { ...formData, [field]: value };

        if (field === 'purchasePrice') {
            // Update Sale Price based on Margin
            if (newData.margin) {
                newData.salePrice = value * (1 + newData.margin / 100);
            } else if (newData.salePrice) {
                // Or update margin if sale price exists? Let's stick to Margin priority
                newData.margin = ((newData.salePrice - value) / value) * 100;
            }
        } else if (field === 'margin') {
            // Update Sale Price based on Purchase Price
            if (newData.purchasePrice) {
                newData.salePrice = newData.purchasePrice * (1 + value / 100);
            }
        } else if (field === 'salePrice') {
            // Update Margin based on Purchase Price
            if (newData.purchasePrice && newData.purchasePrice > 0) {
                newData.margin = ((value - newData.purchasePrice) / newData.purchasePrice) * 100;
            }
        }

        setFormData(newData);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading(editingProduct ? "Actualizando..." : "Creando...");

        try {
            const dataToSubmit = {
                ...formData,
                organizationId,
                salesAccountId: formData.salesAccountId || undefined,
                purchasesAccountId: formData.purchasesAccountId || undefined,
            };

            let res;
            if (editingProduct) {
                res = await updateProduct(editingProduct.id, dataToSubmit);
            } else {
                res = await createProduct(dataToSubmit);
            }

            if (res.success && res.data) {
                if (editingProduct) {
                    setProducts(products.map(p => p.id === editingProduct.id ? res.data : p));
                } else {
                    setProducts([...products, res.data]);
                }
                setIsCreating(false);
                setEditingProduct(null);
                toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
            } else {
                toast.error("Error: " + res.error);
            }
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error inesperado");
        } finally {
            toast.dismiss(toastId);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este item?")) return;
        const toastId = toast.loading("Eliminando...");
        const res = await deleteProduct(id);
        toast.dismiss(toastId);

        if (res.success) {
            setProducts(products.filter(p => p.id !== id));
            toast.success("Eliminado correctamente");
        } else {
            toast.error("Error al eliminar");
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const isEditing = isCreating || !!editingProduct;

    return (
        <div className="space-y-6">
            {!isEditing ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Buscar items..."
                                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors whitespace-nowrap"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo Item
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3">Nombre</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">SKU</th>
                                    <th className="px-4 py-3 text-right">Precio Venta</th>
                                    <th className="px-4 py-3 text-right">Stock</th>
                                    <th className="px-4 py-3 w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-gray-500">
                                            No se encontraron items.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {product.attachments && product.attachments.length > 0 ? (
                                                        // Placeholder for image, ideally use a real image component
                                                        <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                                                            <ImageIcon className="h-4 w-4 text-gray-400" />
                                                        </div>
                                                    ) : (
                                                        <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                                                            <Package className="h-4 w-4 text-gray-400" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-medium text-gray-900">{product.name}</div>
                                                        {product.description && <div className="text-xs text-gray-500 truncate max-w-[200px]">{product.description}</div>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${product.type === 'SERVICE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {product.type === 'SERVICE' ? 'Servicio' : 'Producto'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-gray-600">{product.sku || '-'}</td>
                                            <td className="px-4 py-3 text-right font-medium text-gray-900">${Number(product.salePrice).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right">
                                                {product.type === 'PRODUCT' && product.isStockable ? (
                                                    <span className={Number(product.stock) <= 0 ? "text-red-600 font-medium" : "text-gray-900"}>
                                                        {Number(product.stock)}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setEditingProduct(product)}
                                                        className="p-1 text-gray-400 hover:text-blue-600"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="p-1 text-gray-400 hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-lg text-gray-900">
                            {editingProduct ? "Editar Item" : "Nuevo Item"}
                        </h3>
                        <button
                            onClick={() => { setIsCreating(false); setEditingProduct(null); }}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Form */}
                        <div className="lg:col-span-2 space-y-6">
                            <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                                        <input
                                            type="text"
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={formData.sku}
                                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value as ItemType })}
                                        >
                                            <option value={ItemType.PRODUCT}>Producto</option>
                                            <option value={ItemType.SERVICE}>Servicio</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Configuration */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Alcance</label>
                                        <select
                                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={formData.scope}
                                            onChange={(e) => setFormData({ ...formData, scope: e.target.value as ItemScope })}
                                        >
                                            <option value={ItemScope.BOTH}>Compra y Venta</option>
                                            <option value={ItemScope.SALE}>Solo Venta</option>
                                            <option value={ItemScope.PURCHASE}>Solo Compra</option>
                                        </select>
                                    </div>

                                    {formData.type === ItemType.PRODUCT && (
                                        <div className="flex items-center h-full pt-6">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                                                    checked={formData.isStockable}
                                                    onChange={(e) => setFormData({ ...formData, isStockable: e.target.checked })}
                                                />
                                                <span className="text-sm font-medium text-gray-700">Controlar Stock</span>
                                            </label>
                                        </div>
                                    )}

                                    {formData.type === ItemType.PRODUCT && formData.isStockable && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Stock Inicial</label>
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                value={formData.stock}
                                                onChange={(e) => setFormData({ ...formData, stock: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Pricing */}
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900 border-b pb-2">Precios</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {(formData.scope === ItemScope.BOTH || formData.scope === ItemScope.PURCHASE) && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Compra</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                        value={formData.purchasePrice}
                                                        onChange={(e) => handlePriceChange('purchasePrice', parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {(formData.scope === ItemScope.BOTH) && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Margen (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                    value={formData.margin}
                                                    onChange={(e) => handlePriceChange('margin', parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        )}

                                        {(formData.scope === ItemScope.BOTH || formData.scope === ItemScope.SALE) && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta</label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                        value={formData.salePrice}
                                                        onChange={(e) => handlePriceChange('salePrice', parseFloat(e.target.value) || 0)}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Accounting */}
                                <div className="space-y-4">
                                    <h4 className="font-medium text-gray-900 border-b pb-2">Contabilidad</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {(formData.scope === ItemScope.BOTH || formData.scope === ItemScope.SALE) && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta de Ventas</label>
                                                <select
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                    value={formData.salesAccountId}
                                                    onChange={(e) => setFormData({ ...formData, salesAccountId: e.target.value })}
                                                >
                                                    <option value="">Usar configuración global</option>
                                                    {accounts.filter(a => a.type === 'INCOME').map(account => (
                                                        <option key={account.id} value={account.id}>
                                                            {account.code} - {account.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {(formData.scope === ItemScope.BOTH || formData.scope === ItemScope.PURCHASE) && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta de Compras</label>
                                                <select
                                                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                    value={formData.purchasesAccountId}
                                                    onChange={(e) => setFormData({ ...formData, purchasesAccountId: e.target.value })}
                                                >
                                                    <option value="">Usar configuración global</option>
                                                    {accounts.filter(a => a.type === 'EXPENSE' || a.type === 'ASSET').map(account => (
                                                        <option key={account.id} value={account.id}>
                                                            {account.code} - {account.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                                    <textarea
                                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </form>
                        </div>

                        {/* Sidebar (Images) */}
                        <div className="space-y-6">
                            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                                <h4 className="font-medium text-gray-900 mb-4">Imágenes</h4>
                                {editingProduct ? (
                                    <FileUploader
                                        organizationId={organizationId}
                                        entityId={editingProduct.id}
                                        entityType="product"
                                        existingAttachments={editingProduct.attachments}
                                        maxFiles={5}
                                        acceptedFileTypes={['image/*']}
                                    />
                                ) : (
                                    <div className="text-sm text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                        Guarda el producto primero para subir imágenes.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => { setIsCreating(false); setEditingProduct(null); }}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 text-gray-700"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="product-form"
                            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                        >
                            {editingProduct ? "Actualizar" : "Guardar"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
