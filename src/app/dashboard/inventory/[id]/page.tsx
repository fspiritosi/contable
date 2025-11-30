import { getProductMovements } from "@/actions/product-movements";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Package } from "lucide-react";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { data, success, error } = await getProductMovements(id);

    if (!success || !data) {
        notFound();
    }

    const { product, movements } = data;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/inventory"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </Link>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">{product.name}</h2>
                    <p className="text-gray-500">Historial de movimientos de inventario</p>
                </div>
            </div>

            {/* Product Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                            <Package className="h-5 w-5 text-gray-700" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">SKU</p>
                            <p className="font-semibold text-gray-900">{product.sku || '-'}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Precio de Venta</p>
                        <p className="text-2xl font-bold text-gray-900">${product.price.toFixed(2)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Stock Actual</p>
                        <p className={`text-2xl font-bold ${product.stock <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {product.stock}
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div>
                        <p className="text-sm text-gray-500">Total Movimientos</p>
                        <p className="text-2xl font-bold text-gray-900">{movements.length}</p>
                    </div>
                </div>
            </div>

            {/* Movements Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Historial de Movimientos</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3">Comprobante</th>
                                <th className="px-4 py-3">Contacto</th>
                                <th className="px-4 py-3 text-right">Cantidad</th>
                                <th className="px-4 py-3 text-right">Precio Unit.</th>
                                <th className="px-4 py-3 text-right">Stock Resultante</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {movements.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-gray-500">
                                        No hay movimientos registrados para este producto.
                                    </td>
                                </tr>
                            ) : (
                                movements.map((movement) => (
                                    <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(movement.date).toLocaleDateString('es-AR')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${movement.type === 'SALE' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                {movement.type === 'SALE' ? (
                                                    <>
                                                        <TrendingDown className="h-3 w-3" />
                                                        Salida
                                                    </>
                                                ) : (
                                                    <>
                                                        <TrendingUp className="h-3 w-3" />
                                                        Entrada
                                                    </>
                                                )}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/dashboard/invoices`}
                                                className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                                            >
                                                {movement.invoice.letter} {String(movement.invoice.pointOfSale).padStart(4, '0')}-{String(movement.invoice.number).padStart(8, '0')}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {movement.invoice.contact?.name || '-'}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-medium ${movement.movement > 0 ? 'text-green-600' : 'text-red-600'
                                            }`}>
                                            {movement.movement > 0 ? '+' : ''}{movement.quantity}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-600">
                                            ${movement.unitPrice.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                            {movement.runningStock}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {product.description && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Descripción</h3>
                    <p className="text-gray-600">{product.description}</p>
                </div>
            )}
        </div>
    );
}
