'use client';

import Link from "next/link";
import { ArrowLeft, FileText, ClipboardList, CalendarDays, ShoppingCart } from "lucide-react";
import type { SerializedPurchaseOrderDetail } from "@/actions/purchase-orders";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const formatCurrency = (value: number) =>
  value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getInvoiceHref = (invoice: SerializedPurchaseOrderDetail["linkedInvoices"][number]) =>
  invoice.flow === "SALE" ? `/dashboard/sales/${invoice.id}` : `/dashboard/purchases/${invoice.id}`;

interface PurchaseOrderDetailViewProps {
  order: SerializedPurchaseOrderDetail;
}

export default function PurchaseOrderDetailView({ order }: PurchaseOrderDetailViewProps) {
  const contactLink = order.contactId ? `/dashboard/contacts/${order.contactId}` : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/purchases/orders"
          className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-sm text-gray-500">Orden #{order.orderNumber}</p>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            {contactLink ? (
              <Link href={contactLink} className="text-blue-600 hover:text-blue-800">
                {order.contact?.name || "Proveedor"}
              </Link>
            ) : (
              order.contact?.name || "Proveedor"
            )}
            <span className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              STATUS_COLORS[order.status]
            )}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </h1>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Saldo</span>
            <FileText className="h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">${formatCurrency(order.remainingAmount)}</p>
          <p className="text-xs text-gray-500">Facturado: ${formatCurrency(order.invoicedAmount)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Total</span>
            <ShoppingCart className="h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-gray-900">${formatCurrency(order.total)}</p>
          <p className="text-xs text-gray-500">Subtotal ${formatCurrency(order.subtotal)} · IVA ${formatCurrency(order.vat)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Fechas</span>
            <CalendarDays className="h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            {new Date(order.issueDate).toLocaleDateString("es-AR")}
          </p>
          {order.expectedDate ? (
            <p className="text-xs text-gray-500">Entrega estimada {new Date(order.expectedDate).toLocaleDateString("es-AR")}</p>
          ) : (
            <p className="text-xs text-gray-500">Sin fecha estimada</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-sm font-semibold text-gray-900">Información</h2>
          <dl className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <dt className="text-gray-500">Proveedor</dt>
              <dd className="font-medium text-gray-900">
                {contactLink ? (
                  <Link href={contactLink} className="text-blue-600 hover:text-blue-800">
                    {order.contact?.name || "Proveedor"}
                  </Link>
                ) : (
                  order.contact?.name || "Proveedor"
                )}
              </dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <dt className="text-gray-500">CUIT</dt>
              <dd className="font-medium text-gray-900">{order.contact?.cuit || "-"}</dd>
            </div>
            <div className="flex justify-between border-b border-gray-100 pb-3">
              <dt className="text-gray-500">Notas</dt>
              <dd className="max-w-[60%] text-right text-gray-900">
                {order.notes ? order.notes : <span className="text-gray-400">Sin notas</span>}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Última actualización</dt>
              <dd className="font-medium text-gray-900">{new Date(order.updatedAt).toLocaleDateString("es-AR")}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Facturas vinculadas</h2>
            {order.linkedInvoices.length > 0 && (
              <span className="text-xs text-gray-500">{order.linkedInvoices.length} registros</span>
            )}
          </div>
          {order.linkedInvoices.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no vinculaste facturas a esta orden.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Comprobante</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {order.linkedInvoices.map(invoice => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-blue-600">
                        <Link href={getInvoiceHref(invoice)} className="hover:text-blue-800 hover:underline">
                          {invoice.letter} {String(invoice.pointOfSale).padStart(4, "0")}-{String(invoice.number).padStart(8, "0")}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{new Date(invoice.date).toLocaleDateString("es-AR")}</td>
                      <td className="px-4 py-3">
                        {invoice.contactId ? (
                          <Link href={`/dashboard/contacts/${invoice.contactId}`} className="text-blue-600 hover:text-blue-800">
                            {invoice.contactName || "-"}
                          </Link>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ${formatCurrency(invoice.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Ítems de la orden
          </h2>
          <span className="text-xs text-gray-500">{order.items.length} registros</span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Precio Unit.</th>
                <th className="px-4 py-3 text-right">IVA %</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.productId || "Manual"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-700">${formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.vatRate}%</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">${formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
