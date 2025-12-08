"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Contact, PurchaseOrderStatus } from "@prisma/client";
import type { SerializedProduct } from "@/actions/products";
import type { SerializedPurchaseOrder } from "@/actions/purchase-orders";
import { createPurchaseOrder, updatePurchaseOrderStatus } from "@/actions/purchase-orders";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/date-utils";

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Borrador",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

interface PurchaseOrderManagerProps {
  organizationId: string;
  initialOrders: SerializedPurchaseOrder[];
  contacts: Contact[];
  products: SerializedProduct[];
}

export default function PurchaseOrderManager({ organizationId, initialOrders, contacts, products }: PurchaseOrderManagerProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<PurchaseOrderStatus | "ALL">("ALL");
  const [isPending, startTransition] = useTransition();
  const [orderNumberQuery, setOrderNumberQuery] = useState("");
  const [contactQuery, setContactQuery] = useState("");

  const [formState, setFormState] = useState({
    contactId: contacts[0]?.id ?? "",
    issueDate: new Date().toISOString().split("T")[0],
    expectedDate: "",
    notes: "",
    items: [
      {
        productId: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        vatRate: 21,
      },
    ],
  });

  const filteredOrders = useMemo(() => {
    const normalizedOrderTerm = orderNumberQuery.trim().toLowerCase();
    const normalizedContactTerm = contactQuery.trim().toLowerCase();

    return orders.filter(order => {
      const matchesStatus = filter === "ALL" || order.status === filter;
      if (!matchesStatus) return false;

      const matchesOrderNumber = normalizedOrderTerm
        ? String(order.orderNumber).toLowerCase().includes(normalizedOrderTerm)
        : true;

      const matchesContact = normalizedContactTerm
        ? (order.contact?.name || "").toLowerCase().includes(normalizedContactTerm)
        : true;

      return matchesOrderNumber && matchesContact;
    });
  }, [orders, filter, orderNumberQuery, contactQuery]);

  const subtotal = formState.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const vat = formState.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100), 0);
  const total = subtotal + vat;

  const handleProductChange = (index: number, productId: string) => {
    const nextItems = [...formState.items];
    const product = products.find(p => p.id === productId);
    nextItems[index] = {
      ...nextItems[index],
      productId,
      description: product ? product.name : "",
      unitPrice: product ? Number(product.purchasePrice) : 0,
    };
    setFormState({ ...formState, items: nextItems });
  };

  const updateItem = (index: number, field: keyof (typeof formState.items)[0], value: string | number) => {
    const nextItems = [...formState.items];
    nextItems[index] = {
      ...nextItems[index],
      [field]: typeof value === "string" ? (field === "description" ? value : Number(value)) : value,
    };
    setFormState({ ...formState, items: nextItems });
  };

  const addItem = () => {
    setFormState(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: "", description: "", quantity: 1, unitPrice: 0, vatRate: 21 },
      ],
    }));
  };

  const removeItem = (index: number) => {
    if (formState.items.length === 1) return;
    setFormState(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.contactId) {
      toast.error("Seleccioná un proveedor");
      return;
    }

    if (formState.items.some(item => !item.description || item.quantity <= 0)) {
      toast.error("Completá todos los ítems con cantidades válidas");
      return;
    }

    startTransition(async () => {
      const loading = toast.loading("Creando orden de compra...");
      const res = await createPurchaseOrder({
        organizationId,
        contactId: formState.contactId,
        issueDate: parseLocalDate(formState.issueDate),
        expectedDate: formState.expectedDate ? parseLocalDate(formState.expectedDate) : undefined,
        notes: formState.notes || undefined,
        items: formState.items.map(item => ({
          productId: item.productId || undefined,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          vatRate: item.vatRate,
        })),
      });
      toast.dismiss(loading);

      if (res.success && res.data) {
        toast.success("Orden creada correctamente");
        setOrders(prev => [res.data!, ...prev]);
        setIsCreating(false);
        setFormState({
          contactId: contacts[0]?.id ?? "",
          issueDate: new Date().toISOString().split("T")[0],
          expectedDate: "",
          notes: "",
          items: [{ productId: "", description: "", quantity: 1, unitPrice: 0, vatRate: 21 }],
        });
      } else {
        toast.error(res.error || "No se pudo crear la orden");
      }
    });
  };

  const handleStatusChange = (orderId: string, status: PurchaseOrderStatus) => {
    startTransition(async () => {
      const loading = toast.loading(status === "APPROVED" ? "Aprobando orden..." : "Rechazando orden...");
      const res = await updatePurchaseOrderStatus({ orderId, status });
      toast.dismiss(loading);
      if (res.success && res.data) {
        setOrders(prev => prev.map(order => (order.id === orderId ? res.data! : order)));
        toast.success(status === "APPROVED" ? "Orden aprobada" : "Orden rechazada");
      } else {
        toast.error(res.error || "No se pudo actualizar la orden");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("ALL")}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              filter === "ALL" ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900",
            )}
          >
            Todas
          </button>
          {(["DRAFT", "APPROVED", "REJECTED"] as PurchaseOrderStatus[]).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-colors",
                filter === status ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900",
              )}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Buscar por proveedor"
            value={contactQuery}
            onChange={event => setContactQuery(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
          />
          <input
            type="text"
            placeholder="Buscar por N° de orden"
            value={orderNumberQuery}
            onChange={event => setOrderNumberQuery(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
          />
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nueva Orden
          </button>
        </div>
      </div>

      {!isCreating ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No hay órdenes registradas para este estado.</div>
            ) : (
              filteredOrders.map(order => (
                <div key={order.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Orden #{order.orderNumber}</p>
                    <p className="text-gray-900 font-semibold">{order.contact?.name || "Proveedor"}</p>
                    <p className="text-sm text-gray-500">
                      Emitida el {new Date(order.issueDate).toLocaleDateString("es-AR")}
                      {order.expectedDate && ` • Entrega estimada ${new Date(order.expectedDate).toLocaleDateString("es-AR")}`}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={cn("px-2 py-0.5 text-xs rounded-full border", STATUS_COLORS[order.status])}>
                        {STATUS_LABELS[order.status]} · Saldo ${order.remainingAmount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                        Total ${order.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </span>
                      {order.invoiceId && (
                        <Link
                          href={`/dashboard/purchases#invoice-${order.invoiceId}`}
                          className="px-2 py-0.5 text-xs rounded-full border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        >
                          Ver factura
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === "APPROVED" && (
                      <Link
                        href={`/dashboard/purchases?purchaseOrderId=${order.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                      >
                        Cargar factura
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/purchases/orders/${order.id}`}
                      className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      Ver detalle
                    </Link>
                    {order.status === "DRAFT" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(order.id, "APPROVED")}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-green-50 text-green-700 border border-green-100 hover:bg-green-100"
                          disabled={isPending}
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Aprobar
                        </button>
                        <button
                          onClick={() => handleStatusChange(order.id, "REJECTED")}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-red-50 text-red-700 border border-red-100 hover:bg-red-100"
                          disabled={isPending}
                        >
                          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          Rechazar
                        </button>
                      </>
                    )}
                    {order.status !== "DRAFT" && (
                      <span className="text-sm text-gray-500">
                        Estado actualizado el {new Date(order.updatedAt).toLocaleDateString("es-AR")}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">Nueva Orden de Compra</h3>
              <p className="text-sm text-gray-500">Definí el proveedor, fechas e ítems de la solicitud.</p>
            </div>
            <button
              onClick={() => setIsCreating(false)}
              className="text-sm text-gray-500 hover:text-gray-900"
              disabled={isPending}
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                  value={formState.contactId}
                  onChange={event => setFormState({ ...formState, contactId: event.target.value })}
                  required
                >
                  <option value="">Seleccionar proveedor...</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de emisión</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    value={formState.issueDate}
                    onChange={event => setFormState({ ...formState, issueDate: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada</label>
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                    value={formState.expectedDate}
                    onChange={event => setFormState({ ...formState, expectedDate: event.target.value })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm.focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                rows={3}
                value={formState.notes}
                onChange={event => setFormState({ ...formState, notes: event.target.value })}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Ítems</h4>
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                  <Plus className="h-4 w-4" />
                  Agregar ítem
                </button>
              </div>

              <div className="space-y-3">
                {formState.items.map((item, index) => (
                  <div key={`po-item-${index}`} className="grid grid-cols-1 md:grid-cols-6 gap-3 border.border-gray-200 rounded-lg p-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Producto</label>
                      <select
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2.focus:ring-gray-900 text-gray-900"
                        value={item.productId}
                        onChange={event => handleProductChange(index, event.target.value)}
                      >
                        <option value="">Manual</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        value={item.description}
                        onChange={event => updateItem(index, "description", event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm.focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        value={item.quantity}
                        onChange={event => updateItem(index, "quantity", parseFloat(event.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Precio Unit.</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none.focus:ring-2 focus:ring-gray-900 text-gray-900"
                        value={item.unitPrice}
                        onChange={event => updateItem(index, "unitPrice", parseFloat(event.target.value))}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">IVA %</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                        value={item.vatRate}
                        onChange={event => updateItem(index, "vatRate", parseFloat(event.target.value))}
                        required
                      />
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                      {formState.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4 flex flex-wrap gap-6">
              <div>
                <p className="text-sm text-gray-500">Subtotal</p>
                <p className="text-lg font-semibold text-gray-900">${subtotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">IVA</p>
                <p className="text-lg font-semibold text-gray-900">${vat.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-lg font-semibold text-gray-900">${total.toFixed(2)}</p>
              </div>
              <div className="ml-auto flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50"
                  disabled={isPending}
                >
                  {isPending ? "Guardando..." : "Guardar Borrador"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
