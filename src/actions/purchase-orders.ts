"use server";

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { InvoiceFlow, InvoiceLetter, PurchaseOrderStatus } from "@prisma/client";

export type SerializedPurchaseOrderItem = {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  total: number;
  invoicedQuantity: number;
  availableQuantity: number;
};

export type SerializedPurchaseOrder = {
  id: string;
  organizationId: string;
  contactId: string;
  contact: {
    id: string;
    name: string;
    cuit: string | null;
  } | null;
  status: PurchaseOrderStatus;
  orderNumber: number;
  issueDate: string;
  expectedDate: string | null;
  notes: string | null;
  subtotal: number;
  vat: number;
  total: number;
  invoicedAmount: number;
  remainingAmount: number;
  items: SerializedPurchaseOrderItem[];
  invoiceIds: string[];
  invoiceId: string | null;
  invoicedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedPurchaseOrderDetail = SerializedPurchaseOrder & {
  linkedInvoices: Array<{
    id: string;
    flow: InvoiceFlow;
    letter: InvoiceLetter;
    pointOfSale: number;
    number: number;
    date: string;
    totalAmount: number;
    contactId: string | null;
    contactName: string | null;
  }>;
};

function serializePurchaseOrder(order: any): SerializedPurchaseOrder {
  return {
    id: order.id,
    organizationId: order.organizationId,
    contactId: order.contactId,
    contact: order.contact ? { id: order.contact.id, name: order.contact.name, cuit: order.contact.cuit } : null,
    status: order.status,
    orderNumber: order.orderNumber,
    issueDate: order.issueDate.toISOString(),
    expectedDate: order.expectedDate ? order.expectedDate.toISOString() : null,
    notes: order.notes,
    subtotal: Number(order.subtotal),
    vat: Number(order.vat),
    total: Number(order.total),
    invoicedAmount: Number(order.invoicedAmount ?? 0),
    remainingAmount: Number(order.total) - Number(order.invoicedAmount ?? 0),
    items: order.items.map((item: any) => {
      const invoicedQuantity = (item.invoiceItems ?? []).reduce(
        (sum: number, invoiceItem: any) => sum + Number(invoiceItem.quantity),
        0,
      );
      const orderedQuantity = Number(item.quantity);
      const availableQuantity = Math.max(0, orderedQuantity - invoicedQuantity);

      return {
        id: item.id,
        productId: item.productId,
        description: item.description,
        quantity: orderedQuantity,
        unitPrice: Number(item.unitPrice),
        vatRate: Number(item.vatRate),
        total: Number(item.total),
        invoicedQuantity,
        availableQuantity,
      };
    }),
    invoiceIds: order.invoices?.map((inv: any) => inv.id) ?? [],
    invoiceId: order.invoices?.[order.invoices.length - 1]?.id ?? null,
    invoicedAt: order.invoicedAt ? order.invoicedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export async function getPurchaseOrderDetail(organizationId: string, orderId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const order = await db.purchaseOrder.findFirst({
      where: { id: orderId, organizationId },
      include: {
        contact: true,
        items: {
          include: {
            invoiceItems: true,
          },
        },
        invoices: {
          include: {
            contact: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });

    if (!order) {
      return { success: false, error: "Orden de compra no encontrada" };
    }

    const base = serializePurchaseOrder(order);
    const linkedInvoices = order.invoices.map(inv => ({
      id: inv.id,
      flow: inv.flow,
      letter: inv.letter,
      pointOfSale: inv.pointOfSale,
      number: inv.number,
      date: inv.date.toISOString(),
      totalAmount: Number(inv.totalAmount),
      contactId: inv.contactId,
      contactName: inv.contact?.name ?? null,
    }));

    const detail: SerializedPurchaseOrderDetail = {
      ...base,
      linkedInvoices,
    };

    return { success: true, data: detail };
  } catch (error) {
    console.error("Failed to fetch purchase order detail:", error);
    return { success: false, error: "Failed to fetch purchase order detail" };
  }
}

export async function getPurchaseOrders(organizationId: string, status?: PurchaseOrderStatus) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const orders = await db.purchaseOrder.findMany({
      where: {
        organizationId,
        ...(status ? { status } : {}),
      },
      include: {
        contact: true,
        items: {
          include: {
            invoiceItems: true,
          },
        },
        invoices: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, data: orders.map(serializePurchaseOrder) };
  } catch (error) {
    console.error("Failed to fetch purchase orders:", error);
    return { success: false, error: "Failed to fetch purchase orders" };
  }
}

export async function createPurchaseOrder(data: {
  organizationId: string;
  contactId: string;
  issueDate: Date;
  expectedDate?: Date;
  notes?: string;
  items: Array<{
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
  }>;
}) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!data.items.length) {
    return { success: false, error: "La orden debe tener al menos un ítem" };
  }

  try {
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vat = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (item.vatRate / 100), 0);
    const total = subtotal + vat;

    const order = await db.purchaseOrder.create({
      data: {
        organizationId: data.organizationId,
        contactId: data.contactId,
        issueDate: data.issueDate,
        expectedDate: data.expectedDate,
        notes: data.notes,
        subtotal,
        vat,
        total,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: {
        contact: true,
        items: {
          include: {
            invoiceItems: true,
          },
        },
        invoices: { select: { id: true } },
      },
    });

    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/purchases/orders");

    return { success: true, data: serializePurchaseOrder(order) };
  } catch (error) {
    console.error("Failed to create purchase order:", error);
    return { success: false, error: "No se pudo crear la orden de compra" };
  }
}

export async function updatePurchaseOrderStatus(params: { orderId: string; status: PurchaseOrderStatus }) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const order = await db.purchaseOrder.update({
      where: { id: params.orderId },
      data: {
        status: params.status,
        approvedAt: params.status === "APPROVED" ? new Date() : null,
        rejectedAt: params.status === "REJECTED" ? new Date() : null,
      },
      include: {
        contact: true,
        items: {
          include: {
            invoiceItems: true,
          },
        },
        invoices: { select: { id: true } },
      },
    });

    revalidatePath("/dashboard/purchases");
    revalidatePath("/dashboard/purchases/orders");

    return { success: true, data: serializePurchaseOrder(order) };
  } catch (error) {
    console.error("Failed to update purchase order status:", error);
    return { success: false, error: "No se pudo actualizar el estado" };
  }
}

export async function getApprovedPurchaseOrders(organizationId: string) {
  return getPurchaseOrders(organizationId, "APPROVED");
}

export async function getInvoiceReadyPurchaseOrders(organizationId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const orders = await db.purchaseOrder.findMany({
      where: {
        organizationId,
        status: "APPROVED",
      },
      include: {
        contact: true,
        items: {
          include: {
            invoiceItems: true,
          },
        },
        invoices: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const eligible = orders
      .map(serializePurchaseOrder)
      .filter(order => order.remainingAmount > 0.01);

    return { success: true, data: eligible };
  } catch (error) {
    console.error("Failed to fetch invoice-ready purchase orders:", error);
    return { success: false, error: "Failed to fetch purchase orders" };
  }
}
