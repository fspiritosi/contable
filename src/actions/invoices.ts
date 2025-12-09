'use server';

import { db } from "@/lib/db";
import { InvoiceFlow, InvoiceLetter, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

const AMOUNT_TOLERANCE = 0.01;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    value === null || value === undefined ? 0 : Number(value);

type SerializedInvoiceItem = {
    id: string;
    productId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    total: number;
};

type SerializedPayment = {
    id: string;
    type: string;
    method: string;
    amount: number;
    date: string;
    reference: string | null;
    notes: string | null;
    treasuryAccount: {
        id: string;
        name: string;
        type: string;
    } | null;
};

type SerializedRetention = {
    id: string;
    organizationId: string;
    invoiceId: string;
    contactId: string | null;
    retentionSettingId: string;
    typeName: string;
    typeCode: string | null;
    baseAmount: number;
    rate: number;
    amount: number;
    certificateNumber: string | null;
    certificateDate: string | null;
    notes: string | null;
    journalEntryId: string | null;
    createdAt: string;
    updatedAt: string;
    retentionSetting: {
        id: string;
        name: string;
        code: string | null;
        appliesTo: InvoiceFlow | null;
        defaultRate: number | null;
    } | null;
};

const serializeRetention = (
    retention: Prisma.RetentionGetPayload<{ include: { retentionSetting: true } }>,
): SerializedRetention => ({
    id: retention.id,
    organizationId: retention.organizationId,
    invoiceId: retention.invoiceId,
    contactId: retention.contactId,
    retentionSettingId: retention.retentionSettingId,
    typeName: retention.typeName,
    typeCode: retention.typeCode ?? null,
    baseAmount: Number(retention.baseAmount),
    rate: Number(retention.rate),
    amount: Number(retention.amount),
    certificateNumber: retention.certificateNumber ?? null,
    certificateDate: retention.certificateDate ? retention.certificateDate.toISOString() : null,
    notes: retention.notes ?? null,
    journalEntryId: retention.journalEntryId ?? null,
    createdAt: retention.createdAt.toISOString(),
    updatedAt: retention.updatedAt.toISOString(),
    retentionSetting: retention.retentionSetting
        ? {
              id: retention.retentionSetting.id,
              name: retention.retentionSetting.name,
              code: retention.retentionSetting.code ?? null,
              appliesTo: retention.retentionSetting.appliesTo,
              defaultRate: retention.retentionSetting.defaultRate
                  ? Number(retention.retentionSetting.defaultRate)
                  : null,
          }
        : null,
});

type SerializedAllocation = {
    id: string;
    paymentId: string | null;
    amount: number;
    notes: string | null;
    payment: {
        id: string;
        type: string;
        method: string;
        amount: number;
        date: string;
        reference: string | null;
        notes: string | null;
        treasuryAccount: {
            id: string;
            name: string;
            type: string;
        } | null;
    } | null;
};

type SerializedAttachment = {
    id: string;
    name: string;
    fileType: string;
    size: number;
    url: string;
    createdAt: string;
};

export type SerializedInvoiceDetail = {
    id: string;
    flow: InvoiceFlow;
    letter: InvoiceLetter;
    pointOfSale: number;
    number: number;
    date: string;
    dueDate: string | null;
    contactId: string | null;
    contact: {
        id: string;
        name: string;
        cuit: string | null;
        email: string | null;
    } | null;
    netAmount: number;
    vatAmount: number;
    totalAmount: number;
    items: SerializedInvoiceItem[];
    payments: SerializedPayment[];
    allocations: SerializedAllocation[];
    retentions: SerializedRetention[];
    retentionTotal: number;
    attachments: SerializedAttachment[];
    paidAmount: number;
    balance: number;
    paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
    amountAllocated: number;
    amountRemaining: number;
    purchaseOrderId: string | null;
    purchaseOrderNumber: number | null;
    purchaseOrderRemaining: number | null;
    createdAt: string;
    updatedAt: string;
};

export async function getInvoices(organizationId: string, flow?: InvoiceFlow) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const invoices = await db.invoice.findMany({
            where: {
                organizationId,
                ...(flow ? { flow } : {}),
            },
            include: {
                contact: true,
                items: true,
                attachments: true,
                retentions: {
                    include: {
                        retentionSetting: true,
                    },
                },
            },
            orderBy: { date: 'desc' },
        });

        const serializedInvoices = invoices.map(inv => {
            const totalAmount = Number(inv.totalAmount);
            const paidAmount = toNumber(inv.amountAllocated);
            const balance = Math.max(toNumber(inv.amountRemaining ?? totalAmount - paidAmount), 0);
            const isPaid = balance <= AMOUNT_TOLERANCE;
            const isPartial = !isPaid && paidAmount > AMOUNT_TOLERANCE;
            const paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'PENDING';
            const retentionTotal = inv.retentions.reduce((sum, ret) => sum + Number(ret.amount), 0);

            return {
                ...inv,
                netAmount: Number(inv.netAmount),
                vatAmount: Number(inv.vatAmount),
                totalAmount,
                paidAmount,
                balance,
                amountAllocated: paidAmount,
                amountRemaining: balance,
                paymentStatus,
                retentions: inv.retentions.map(serializeRetention),
                retentionTotal,
                items: inv.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    vatRate: Number(item.vatRate),
                    total: Number(item.total),
                })),
                attachments: inv.attachments.map(file => ({
                    ...file,
                    createdAt: file.createdAt.toISOString(),
                })),
            };
        });

        return { success: true, data: serializedInvoices };
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return { success: false, error: "Failed to fetch invoices" };
    }
}

export async function getInvoiceDetail(organizationId: string, invoiceId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const invoice = await db.invoice.findFirst({
            where: { id: invoiceId, organizationId },
            include: {
                contact: true,
                items: true,
                retentions: {
                    include: {
                        retentionSetting: true,
                    },
                },
                payments: {
                    include: {
                        treasuryAccount: true,
                    },
                    orderBy: { date: 'desc' },
                },
                allocations: {
                    include: {
                        payment: {
                            include: {
                                treasuryAccount: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                attachments: true,
                purchaseOrder: true,
            },
        });

        if (!invoice) {
            return { success: false, error: "Factura no encontrada" };
        }

        const totalAmount = Number(invoice.totalAmount);
        const paidAmount = toNumber(invoice.amountAllocated);
        const balance = Math.max(toNumber(invoice.amountRemaining ?? totalAmount - paidAmount), 0);
        const isPaid = balance <= AMOUNT_TOLERANCE;
        const isPartial = !isPaid && paidAmount > AMOUNT_TOLERANCE;
        const retentionTotal = invoice.retentions.reduce((sum, ret) => sum + Number(ret.amount), 0);

        const serialized: SerializedInvoiceDetail = {
            id: invoice.id,
            flow: invoice.flow,
            letter: invoice.letter,
            pointOfSale: invoice.pointOfSale,
            number: invoice.number,
            date: invoice.date.toISOString(),
            dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
            contactId: invoice.contactId,
            contact: invoice.contact
                ? {
                      id: invoice.contact.id,
                      name: invoice.contact.name,
                      cuit: invoice.contact.cuit,
                      email: invoice.contact.email,
                  }
                : null,
            netAmount: Number(invoice.netAmount),
            vatAmount: Number(invoice.vatAmount),
            totalAmount,
            items: invoice.items.map(item => ({
                id: item.id,
                productId: item.productId,
                description: item.description,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                vatRate: Number(item.vatRate),
                total: Number(item.total),
            })),
            payments: invoice.payments.map(payment => ({
                id: payment.id,
                type: payment.type,
                method: payment.method,
                amount: Number(payment.amount),
                date: payment.date.toISOString(),
                reference: payment.reference,
                notes: payment.notes,
                treasuryAccount: payment.treasuryAccount
                    ? {
                          id: payment.treasuryAccount.id,
                          name: payment.treasuryAccount.name,
                          type: payment.treasuryAccount.type,
                      }
                    : null,
            })),
            allocations: invoice.allocations.map(allocation => ({
                id: allocation.id,
                paymentId: allocation.paymentId,
                amount: Number(allocation.amount),
                notes: allocation.notes ?? null,
                payment: allocation.payment
                    ? {
                          id: allocation.payment.id,
                          type: allocation.payment.type,
                          method: allocation.payment.method,
                          amount: Number(allocation.payment.amount),
                          date:
                              allocation.payment.date instanceof Date
                                  ? allocation.payment.date.toISOString()
                                  : allocation.payment.date,
                          reference: allocation.payment.reference,
                          notes: allocation.payment.notes,
                          treasuryAccount: allocation.payment.treasuryAccount
                              ? {
                                    id: allocation.payment.treasuryAccount.id,
                                    name: allocation.payment.treasuryAccount.name,
                                    type: allocation.payment.treasuryAccount.type,
                                }
                              : null,
                      }
                    : null,
            })),
            retentions: invoice.retentions.map(serializeRetention),
            retentionTotal,
            attachments: invoice.attachments.map(file => ({
                id: file.id,
                name: file.name,
                fileType: file.fileType,
                size: file.size,
                url: file.url,
                createdAt: file.createdAt.toISOString(),
            })),
            paidAmount,
            balance,
            amountAllocated: paidAmount,
            amountRemaining: balance,
            paymentStatus: isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'PENDING',
            purchaseOrderId: invoice.purchaseOrderId,
            purchaseOrderNumber: invoice.purchaseOrder?.orderNumber ?? null,
            purchaseOrderRemaining:
                invoice.purchaseOrder && invoice.purchaseOrder.invoicedAmount !== undefined
                    ? Number(invoice.purchaseOrder.total) - Number(invoice.purchaseOrder.invoicedAmount ?? 0)
                    : null,
            createdAt: invoice.createdAt.toISOString(),
            updatedAt: invoice.updatedAt.toISOString(),
        };

        return { success: true, data: serialized };
    } catch (error) {
        console.error("Failed to fetch invoice detail:", error);
        return { success: false, error: "Failed to fetch invoice detail" };
    }
}

export async function getNextInvoiceSequence(params: {
    organizationId: string;
    flow: InvoiceFlow;
    letter: InvoiceLetter;
    pointOfSale?: number;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const pointOfSale = params.pointOfSale ?? 1;

    const lastInvoice = await db.invoice.findFirst({
        where: {
            organizationId: params.organizationId,
            flow: params.flow,
            letter: params.letter,
            pointOfSale,
        },
        orderBy: { number: "desc" },
        select: { number: true },
    });

    const nextNumber = (lastInvoice?.number ?? 0) + 1;

    return {
        success: true,
        data: {
            pointOfSale,
            nextNumber,
        },
    };
}


export async function createInvoice(data: {
    organizationId: string;
    flow: InvoiceFlow;
    letter: InvoiceLetter;
    pointOfSale: number;
    number: number;
    date: Date;
    dueDate?: Date;
    contactId?: string;
    items: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        vatRate: number;
        total: number;
        purchaseOrderItemId?: string;
    }[];
    purchaseOrderId?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        type InvoiceItemInput = {
            productId?: string;
            description: string;
            quantity: number;
            unitPrice: number;
            vatRate: number;
            purchaseOrderItemId?: string;
        };

        let sourceItems: InvoiceItemInput[] = data.items.map(item => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            purchaseOrderItemId: item.purchaseOrderItemId,
        }));
        let effectiveContactId = data.contactId;
        let linkedPurchaseOrderId: string | null = null;
        let purchaseOrderSnapshot: {
            total: number;
            invoicedAmount: number;
            remainingAmount: number;
        } | null = null;

        if (data.purchaseOrderId) {
            const purchaseOrder = await db.purchaseOrder.findUnique({
                where: { id: data.purchaseOrderId },
                include: {
                    items: {
                        include: {
                            invoiceItems: true,
                        },
                    },
                    contact: true,
                },
            });

            if (!purchaseOrder || purchaseOrder.organizationId !== data.organizationId) {
                return {
                    success: false,
                    error: "La orden de compra seleccionada no es válida",
                };
            }

            if (purchaseOrder.status !== "APPROVED") {
                return {
                    success: false,
                    error: "La orden de compra debe estar aprobada para generar la factura",
                };
            }

            const remainingAmount = Number(purchaseOrder.total) - Number(purchaseOrder.invoicedAmount ?? 0);
            purchaseOrderSnapshot = {
                total: Number(purchaseOrder.total),
                invoicedAmount: Number(purchaseOrder.invoicedAmount ?? 0),
                remainingAmount,
            };

            linkedPurchaseOrderId = purchaseOrder.id;
            effectiveContactId = purchaseOrder.contactId;

            const poItemsById = new Map(purchaseOrder.items.map(item => [item.id, item]));
            const usedQuantities: Record<string, number> = {};

            for (const item of sourceItems) {
                if (!item.purchaseOrderItemId) {
                    return {
                        success: false,
                        error: "No podés agregar ítems nuevos cuando facturás una orden de compra.",
                    };
                }

                const poItem = poItemsById.get(item.purchaseOrderItemId);
                if (!poItem) {
                    return {
                        success: false,
                        error: "Uno de los ítems no pertenece a la orden de compra seleccionada.",
                    };
                }

                if (item.quantity <= 0) {
                    return {
                        success: false,
                        error: `La cantidad del ítem "${poItem.description}" debe ser mayor a cero.`,
                    };
                }

                const alreadyInvoicedQuantity = (poItem.invoiceItems ?? []).reduce(
                    (sum: number, invoiceItem: any) => sum + Number(invoiceItem.quantity),
                    0,
                );
                const availableQuantity = Math.max(0, Number(poItem.quantity) - alreadyInvoicedQuantity);

                const nextUsage = (usedQuantities[item.purchaseOrderItemId] || 0) + item.quantity;
                if (nextUsage - availableQuantity > 1e-6) {
                    return {
                        success: false,
                        error: `La cantidad del ítem "${poItem.description}" supera la disponible en la orden (${availableQuantity}).`,
                    };
                }

                usedQuantities[item.purchaseOrderItemId] = nextUsage;
            }
        }

        if (!sourceItems.length) {
            return {
                success: false,
                error: "La factura debe incluir al menos un ítem",
            };
        }

        if (data.flow === 'PURCHASE' && !effectiveContactId) {
            return {
                success: false,
                error: "Las facturas de compra deben tener un proveedor asignado",
            };
        }

        const duplicateWhere: Prisma.InvoiceWhereInput = {
            organizationId: data.organizationId,
            letter: data.letter,
            pointOfSale: data.pointOfSale,
            number: data.number,
            flow: data.flow,
        };

        if (data.flow === 'PURCHASE') {
            duplicateWhere.contactId = effectiveContactId;
        }

        const duplicate = await db.invoice.findFirst({
            where: duplicateWhere,
            select: { id: true },
        });

        if (duplicate) {
            const errorMessage = data.flow === 'SALE'
                ? 'Ya existe una factura de venta con esa letra y número'
                : 'Ya existe una factura de compra para este proveedor con esa letra y número';
            return {
                success: false,
                error: errorMessage,
            };
        }

        // Get accounting configuration
        const config = await db.accountingConfig.findUnique({
            where: { organizationId: data.organizationId },
        });

        if (!config) {
            return {
                success: false,
                error: "No hay configuración contable. Por favor configura las cuentas en Configuración > Configuración Contable",
            };
        }

        // Validate required accounts based on flow
        if (data.flow === 'SALE') {
            if (!config.salesAccountId || !config.salesVatAccountId || !config.receivablesAccountId) {
                return {
                    success: false,
                    error: "Faltan cuentas de ventas configuradas. Verifica la configuración contable.",
                };
            }
        } else {
            if (!config.purchasesAccountId || !config.purchasesVatAccountId || !config.payablesAccountId) {
                return {
                    success: false,
                    error: "Faltan cuentas de compras configuradas. Verifica la configuración contable.",
                };
            }
        }

        // Calculate totals and prepare item data
        let netAmount = 0;
        let vatAmount = 0;

        const itemsToCreate = [];
        const accountAggregates: Record<string, number> = {}; // AccountId -> Amount

        for (const item of sourceItems) {
            const lineNet = item.quantity * item.unitPrice;
            const lineVat = lineNet * (item.vatRate / 100);

            netAmount += lineNet;
            vatAmount += lineVat;

            itemsToCreate.push({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                vatRate: item.vatRate,
                total: lineNet,
                productId: item.productId,
            });

            // Determine account for this item
            let itemAccountId = data.flow === 'SALE' ? config.salesAccountId : config.purchasesAccountId;

            if (item.productId) {
                const product = await db.product.findUnique({ where: { id: item.productId } });
                if (product) {
                    // Update stock
                    const stockChange = data.flow === 'SALE' ? -item.quantity : item.quantity;
                    if (product.isStockable) {
                        await db.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: stockChange } }
                        });
                    }

                    // Check for specific account
                    if (data.flow === 'SALE' && product.salesAccountId) {
                        itemAccountId = product.salesAccountId;
                    } else if (data.flow === 'PURCHASE' && product.purchasesAccountId) {
                        itemAccountId = product.purchasesAccountId;
                    }
                }
            }

            if (!itemAccountId) {
                // Should not happen if validation passed, but just in case
                throw new Error("No se pudo determinar la cuenta contable para el item: " + item.description);
            }

            // Aggregate amount for this account
            accountAggregates[itemAccountId] = (accountAggregates[itemAccountId] || 0) + lineNet;
        }

        const totalAmount = netAmount + vatAmount;

        if (purchaseOrderSnapshot && totalAmount - purchaseOrderSnapshot.remainingAmount > 0.01) {
            return {
                success: false,
                error: "El total de la factura supera el saldo pendiente de la orden de compra.",
            };
        }

        // Get contact info for snapshot
        let contactSnapshot: {
            contactName?: string;
            contactCuit?: string | null;
            contactAddress?: string | null;
        } = {};

        if (effectiveContactId) {
            const contact = await db.contact.findUnique({ where: { id: effectiveContactId } });
            if (contact) {
                contactSnapshot = {
                    contactName: contact.name,
                    contactCuit: contact.cuit,
                    contactAddress: contact.address,
                };
            }
        }

        // Create journal entry for the invoice
        const journalDescription = data.flow === 'SALE'
            ? `Factura de Venta ${data.letter} ${String(data.pointOfSale).padStart(4, '0')}-${String(data.number).padStart(8, '0')}`
            : `Factura de Compra ${data.letter} ${String(data.pointOfSale).padStart(4, '0')}-${String(data.number).padStart(8, '0')}`;

        const journalLines = [];

        if (data.flow === 'SALE') {
            // SALE: Debit Receivables, Credit Sales (multiple) and VAT
            journalLines.push({
                accountId: config.receivablesAccountId!,
                debit: totalAmount,
                credit: 0,
                description: `Venta a ${contactSnapshot.contactName || 'Cliente'}`,
            });

            // Add lines for each sales account
            for (const [accountId, amount] of Object.entries(accountAggregates)) {
                journalLines.push({
                    accountId: accountId,
                    debit: 0,
                    credit: amount,
                    description: 'Ingresos por ventas',
                });
            }

            if (vatAmount > 0) {
                journalLines.push({
                    accountId: config.salesVatAccountId!,
                    debit: 0,
                    credit: vatAmount,
                    description: 'IVA Débito Fiscal',
                });
            }
        } else {
            // PURCHASE: Debit Purchases (multiple) and VAT, Credit Payables

            // Add lines for each purchase account
            for (const [accountId, amount] of Object.entries(accountAggregates)) {
                journalLines.push({
                    accountId: accountId,
                    debit: amount,
                    credit: 0,
                    description: 'Compras',
                });
            }

            if (vatAmount > 0) {
                journalLines.push({
                    accountId: config.purchasesVatAccountId!,
                    debit: vatAmount,
                    credit: 0,
                    description: 'IVA Crédito Fiscal',
                });
            }
            journalLines.push({
                accountId: config.payablesAccountId!,
                debit: 0,
                credit: totalAmount,
                description: `Compra a ${contactSnapshot.contactName || 'Proveedor'}`,
            });
        }

        const journalEntry = await db.journalEntry.create({
            data: {
                organizationId: data.organizationId,
                date: data.date,
                description: journalDescription,
                lines: {
                    create: journalLines,
                },
            },
            include: {
                lines: {
                    include: {
                        account: true,
                    },
                },
            },
        });

        // Create invoice linked to journal entry
        const invoice = await db.invoice.create({
            data: {
                organizationId: data.organizationId,
                flow: data.flow,
                letter: data.letter,
                pointOfSale: data.pointOfSale,
                number: data.number,
                date: data.date,
                dueDate: data.dueDate,
                contactId: effectiveContactId,
                ...contactSnapshot,
                netAmount,
                vatAmount,
                totalAmount,
                journalEntryId: journalEntry.id,
                purchaseOrderId: linkedPurchaseOrderId ?? undefined,
                items: {
                    create: itemsToCreate,
                },
            },
            include: {
                contact: true,
                items: true,
                journalEntry: {
                    include: {
                        lines: true,
                    }
                },
            },
        });

        revalidatePath("/dashboard/invoices");
        revalidatePath("/dashboard/sales");
        revalidatePath("/dashboard/purchases");
        revalidatePath("/dashboard/purchases/orders");
        revalidatePath("/dashboard/accounting/journal");

        if (linkedPurchaseOrderId) {
            await db.purchaseOrder.update({
                where: { id: linkedPurchaseOrderId },
                data: {
                    invoicedAmount: {
                        increment: totalAmount,
                    },
                    invoicedAt: new Date(),
                },
            });
        }

        // Convert Decimal to number for client components
        return {
            success: true,
            data: {
                ...invoice,
                netAmount: Number(invoice.netAmount),
                vatAmount: Number(invoice.vatAmount),
                totalAmount: Number(invoice.totalAmount),
                items: invoice.items.map(item => ({
                    ...item,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    vatRate: Number(item.vatRate),
                    total: Number(item.total),
                })),
                journalEntry: invoice.journalEntry ? {
                    ...invoice.journalEntry,
                    lines: invoice.journalEntry.lines.map((line: any) => ({
                        ...line,
                        debit: Number(line.debit),
                        credit: Number(line.credit),
                    })),
                } : null,
            }
        };
    } catch (error) {
        console.error("Failed to create invoice:", error);
        return { success: false, error: "Failed to create invoice" };
    }
}

type InvoiceInput = {
    organizationId: string;
    flow: InvoiceFlow;
    letter: InvoiceLetter;
    pointOfSale: number;
    number: number;
    date: Date;
    dueDate?: Date;
    contactId?: string;
    items: {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        vatRate: number;
        total: number;
        purchaseOrderItemId?: string;
    }[];
    purchaseOrderId?: string;
};

async function validateAndPrepareInvoiceData(
    tx: Prisma.TransactionClient,
    data: InvoiceInput,
    invoiceIdToIgnore?: string,
) {
    type InvoiceItemInput = {
        productId?: string;
        description: string;
        quantity: number;
        unitPrice: number;
        vatRate: number;
        purchaseOrderItemId?: string;
    };

    let sourceItems: InvoiceItemInput[] = data.items.map(item => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        vatRate: item.vatRate,
        purchaseOrderItemId: item.purchaseOrderItemId,
    }));
    let effectiveContactId = data.contactId;
    let linkedPurchaseOrderId: string | null = null;
    let purchaseOrderSnapshot: {
        total: number;
        invoicedAmount: number;
        remainingAmount: number;
    } | null = null;

    if (data.purchaseOrderId) {
        const purchaseOrder = await tx.purchaseOrder.findUnique({
            where: { id: data.purchaseOrderId },
            include: {
                items: {
                    include: {
                        invoiceItems: true,
                    },
                },
                contact: true,
            },
        });

        if (!purchaseOrder || purchaseOrder.organizationId !== data.organizationId) {
            return {
                success: false as const,
                error: "La orden de compra seleccionada no es válida",
            };
        }

        if (purchaseOrder.status !== "APPROVED") {
            return {
                success: false as const,
                error: "La orden de compra debe estar aprobada para generar la factura",
            };
        }

        const remainingAmount = Number(purchaseOrder.total) - Number(purchaseOrder.invoicedAmount ?? 0);
        purchaseOrderSnapshot = {
            total: Number(purchaseOrder.total),
            invoicedAmount: Number(purchaseOrder.invoicedAmount ?? 0),
            remainingAmount,
        };

        linkedPurchaseOrderId = purchaseOrder.id;
        effectiveContactId = purchaseOrder.contactId;

        const poItemsById = new Map(purchaseOrder.items.map(item => [item.id, item]));
        const usedQuantities: Record<string, number> = {};

        for (const item of sourceItems) {
            if (!item.purchaseOrderItemId) {
                return {
                    success: false as const,
                    error: "No podés agregar ítems nuevos cuando facturás una orden de compra.",
                };
            }

            const poItem = poItemsById.get(item.purchaseOrderItemId);
            if (!poItem) {
                return {
                    success: false as const,
                    error: "Uno de los ítems no pertenece a la orden de compra seleccionada.",
                };
            }

            if (item.quantity <= 0) {
                return {
                    success: false as const,
                    error: `La cantidad del ítem "${poItem.description}" debe ser mayor a cero.`,
                };
            }

            const alreadyInvoicedQuantity = (poItem.invoiceItems ?? []).reduce(
                (sum: number, invoiceItem: any) => sum + Number(invoiceItem.quantity),
                0,
            );
            const availableQuantity = Math.max(0, Number(poItem.quantity) - alreadyInvoicedQuantity);

            const nextUsage = (usedQuantities[item.purchaseOrderItemId] || 0) + item.quantity;
            if (nextUsage - availableQuantity > 1e-6) {
                return {
                    success: false as const,
                    error: `La cantidad del ítem "${poItem.description}" supera la disponible en la orden (${availableQuantity}).`,
                };
            }

            usedQuantities[item.purchaseOrderItemId] = nextUsage;
        }
    }

    if (!sourceItems.length) {
        return {
            success: false as const,
            error: "La factura debe incluir al menos un ítem",
        };
    }

    if (data.flow === 'PURCHASE' && !effectiveContactId) {
        return {
            success: false as const,
            error: "Las facturas de compra deben tener un proveedor asignado",
        };
    }

    const duplicateWhere: Prisma.InvoiceWhereInput = {
        organizationId: data.organizationId,
        letter: data.letter,
        pointOfSale: data.pointOfSale,
        number: data.number,
        flow: data.flow,
    };

    if (data.flow === 'PURCHASE') {
        duplicateWhere.contactId = effectiveContactId;
    }

    if (invoiceIdToIgnore) {
        duplicateWhere.NOT = { id: invoiceIdToIgnore };
    }

    const duplicate = await tx.invoice.findFirst({
        where: duplicateWhere,
        select: { id: true },
    });

    if (duplicate) {
        const errorMessage = data.flow === 'SALE'
            ? 'Ya existe una factura de venta con esa letra y número'
            : 'Ya existe una factura de compra para este proveedor con esa letra y número';
        return {
            success: false as const,
            error: errorMessage,
        };
    }

    const config = await tx.accountingConfig.findUnique({
        where: { organizationId: data.organizationId },
    });

    if (!config) {
        return {
            success: false as const,
            error: "No hay configuración contable. Por favor configura las cuentas en Configuración > Configuración Contable",
        };
    }

    if (data.flow === 'SALE') {
        if (!config.salesAccountId || !config.salesVatAccountId || !config.receivablesAccountId) {
            return {
                success: false as const,
                error: "Faltan cuentas de ventas configuradas. Verifica la configuración contable.",
            };
        }
    } else {
        if (!config.purchasesAccountId || !config.purchasesVatAccountId || !config.payablesAccountId) {
            return {
                success: false as const,
                error: "Faltan cuentas de compras configuradas. Verifica la configuración contable.",
            };
        }
    }

    let netAmount = 0;
    let vatAmount = 0;
    const itemsToCreate: any[] = [];
    const accountAggregates: Record<string, number> = {};

    for (const item of sourceItems) {
        const lineNet = item.quantity * item.unitPrice;
        const lineVat = lineNet * (item.vatRate / 100);

        netAmount += lineNet;
        vatAmount += lineVat;

        itemsToCreate.push({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            vatRate: item.vatRate,
            total: lineNet,
            productId: item.productId,
        });

        let itemAccountId = data.flow === 'SALE' ? config.salesAccountId : config.purchasesAccountId;

        if (item.productId) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });
            if (product) {
                const stockChange = data.flow === 'SALE' ? -item.quantity : item.quantity;
                if (product.isStockable) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: stockChange } },
                    });
                }

                if (data.flow === 'SALE' && product.salesAccountId) {
                    itemAccountId = product.salesAccountId;
                } else if (data.flow === 'PURCHASE' && product.purchasesAccountId) {
                    itemAccountId = product.purchasesAccountId;
                }
            }
        }

        if (!itemAccountId) {
            throw new Error("No se pudo determinar la cuenta contable para el item: " + item.description);
        }

        accountAggregates[itemAccountId] = (accountAggregates[itemAccountId] || 0) + lineNet;
    }

    const totalAmount = netAmount + vatAmount;

    if (purchaseOrderSnapshot && totalAmount - purchaseOrderSnapshot.remainingAmount > 0.01) {
        return {
            success: false as const,
            error: "El total de la factura supera el saldo pendiente de la orden de compra.",
        };
    }

    let contactSnapshot: {
        contactName?: string;
        contactCuit?: string | null;
        contactAddress?: string | null;
    } = {};

    if (effectiveContactId) {
        const contact = await tx.contact.findUnique({ where: { id: effectiveContactId } });
        if (contact) {
            contactSnapshot = {
                contactName: contact.name,
                contactCuit: contact.cuit,
                contactAddress: contact.address,
            };
        }
    }

    const journalDescription = data.flow === 'SALE'
        ? `Factura de Venta ${data.letter} ${String(data.pointOfSale).padStart(4, '0')}-${String(data.number).padStart(8, '0')}`
        : `Factura de Compra ${data.letter} ${String(data.pointOfSale).padStart(4, '0')}-${String(data.number).padStart(8, '0')}`;

    const journalLines: any[] = [];

    if (data.flow === 'SALE') {
        journalLines.push({
            accountId: config.receivablesAccountId!,
            debit: totalAmount,
            credit: 0,
            description: `Venta a ${contactSnapshot.contactName || 'Cliente'}`,
        });

        for (const [accountId, amount] of Object.entries(accountAggregates)) {
            journalLines.push({
                accountId,
                debit: 0,
                credit: amount,
                description: 'Ingresos por ventas',
            });
        }

        if (vatAmount > 0) {
            journalLines.push({
                accountId: config.salesVatAccountId!,
                debit: 0,
                credit: vatAmount,
                description: 'IVA Débito Fiscal',
            });
        }
    } else {
        for (const [accountId, amount] of Object.entries(accountAggregates)) {
            journalLines.push({
                accountId,
                debit: amount,
                credit: 0,
                description: 'Compras',
            });
        }

        if (vatAmount > 0) {
            journalLines.push({
                accountId: config.purchasesVatAccountId!,
                debit: vatAmount,
                credit: 0,
                description: 'IVA Crédito Fiscal',
            });
        }

        journalLines.push({
            accountId: config.payablesAccountId!,
            debit: 0,
            credit: totalAmount,
            description: `Compra a ${contactSnapshot.contactName || 'Proveedor'}`,
        });
    }

    return {
        success: true as const,
        data: {
            effectiveContactId,
            linkedPurchaseOrderId,
            netAmount,
            vatAmount,
            totalAmount,
            itemsToCreate,
            contactSnapshot,
            journalDescription,
            journalLines,
        },
    };
}

export async function updateInvoice(invoiceId: string, data: InvoiceInput) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const result = await db.$transaction(async (tx) => {
            const existing = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                    payments: true,
                    purchaseOrder: true,
                    journalEntry: true,
                    attachments: true,
                },
            });

            if (!existing || existing.organizationId !== data.organizationId) {
                return { success: false as const, error: "Factura no encontrada" };
            }

            if (existing.payments.length > 0) {
                return { success: false as const, error: "No se puede editar una factura con pagos registrados" };
            }

            for (const item of existing.items) {
                if (item.productId && item.product?.isStockable) {
                    const originalDelta = existing.flow === 'SALE' ? -Number(item.quantity) : Number(item.quantity);
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: -originalDelta } },
                    });
                }
            }

            if (existing.purchaseOrderId) {
                await tx.purchaseOrder.update({
                    where: { id: existing.purchaseOrderId },
                    data: {
                        invoicedAmount: {
                            decrement: Number(existing.totalAmount),
                        },
                    },
                });
            }

            if (existing.journalEntryId) {
                await tx.journalEntry.delete({ where: { id: existing.journalEntryId } });
            }

            const prepared = await validateAndPrepareInvoiceData(tx, data, invoiceId);
            if (!prepared.success) {
                return prepared;
            }

            const {
                effectiveContactId,
                linkedPurchaseOrderId,
                netAmount,
                vatAmount,
                totalAmount,
                itemsToCreate,
                contactSnapshot,
                journalDescription,
                journalLines,
            } = prepared.data;

            const journalEntry = await tx.journalEntry.create({
                data: {
                    organizationId: data.organizationId,
                    date: data.date,
                    description: journalDescription,
                    lines: {
                        create: journalLines,
                    },
                },
                include: {
                    lines: true,
                },
            });

            const updatedInvoice = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    flow: data.flow,
                    letter: data.letter,
                    pointOfSale: data.pointOfSale,
                    number: data.number,
                    date: data.date,
                    dueDate: data.dueDate,
                    contactId: effectiveContactId,
                    ...contactSnapshot,
                    netAmount,
                    vatAmount,
                    totalAmount,
                    journalEntryId: journalEntry.id,
                    purchaseOrderId: linkedPurchaseOrderId ?? undefined,
                    items: {
                        deleteMany: {},
                        create: itemsToCreate,
                    },
                },
                include: {
                    contact: true,
                    items: true,
                    payments: true,
                },
            });

            if (linkedPurchaseOrderId) {
                await tx.purchaseOrder.update({
                    where: { id: linkedPurchaseOrderId },
                    data: {
                        invoicedAmount: {
                            increment: totalAmount,
                        },
                        invoicedAt: new Date(),
                    },
                });
            }

            return {
                success: true as const,
                data: {
                    ...updatedInvoice,
                    netAmount: Number(updatedInvoice.netAmount),
                    vatAmount: Number(updatedInvoice.vatAmount),
                    totalAmount: Number(updatedInvoice.totalAmount),
                    items: updatedInvoice.items.map(item => ({
                        ...item,
                        quantity: Number(item.quantity),
                        unitPrice: Number(item.unitPrice),
                        vatRate: Number(item.vatRate),
                        total: Number(item.total),
                    })),
                },
            };
        });

        if (result.success) {
            revalidatePath("/dashboard/invoices");
            revalidatePath("/dashboard/sales");
            revalidatePath("/dashboard/purchases");
            revalidatePath("/dashboard/purchases/orders");
            revalidatePath("/dashboard/accounting/journal");
        }

        return result;
    } catch (error) {
        console.error("Failed to update invoice:", error);
        return { success: false, error: "Failed to update invoice" };
    }
}

export async function deleteInvoice(invoiceId: string, organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const result = await db.$transaction(async (tx) => {
            const invoice = await tx.invoice.findUnique({
                where: { id: invoiceId },
                include: {
                    items: {
                        include: {
                            product: true,
                        },
                    },
                    payments: true,
                    attachments: true,
                },
            });

            if (!invoice || invoice.organizationId !== organizationId) {
                return { success: false as const, error: "Factura no encontrada" };
            }

            if (invoice.payments.length > 0) {
                return { success: false as const, error: "No se puede eliminar una factura con pagos registrados" };
            }

            for (const item of invoice.items) {
                if (item.productId && item.product?.isStockable) {
                    const originalDelta = invoice.flow === 'SALE' ? -Number(item.quantity) : Number(item.quantity);
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: -originalDelta } },
                    });
                }
            }

            if (invoice.purchaseOrderId) {
                await tx.purchaseOrder.update({
                    where: { id: invoice.purchaseOrderId },
                    data: {
                        invoicedAmount: {
                            decrement: Number(invoice.totalAmount),
                        },
                    },
                });
            }

            if (invoice.attachments.length) {
                await tx.attachment.deleteMany({ where: { invoiceId } });
            }

            if (invoice.journalEntryId) {
                await tx.journalEntry.delete({ where: { id: invoice.journalEntryId } });
            }

            await tx.invoice.delete({ where: { id: invoiceId } });

            return { success: true as const };
        });

        if (result.success) {
            revalidatePath("/dashboard/invoices");
            revalidatePath("/dashboard/sales");
            revalidatePath("/dashboard/purchases");
            revalidatePath("/dashboard/purchases/orders");
            revalidatePath("/dashboard/accounting/journal");
        }

        return result;
    } catch (error) {
        console.error("Failed to delete invoice:", error);
        return { success: false, error: "Failed to delete invoice" };
    }
}
