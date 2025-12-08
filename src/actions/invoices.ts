'use server';

import { db } from "@/lib/db";
import { InvoiceFlow, InvoiceLetter, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

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
    attachments: SerializedAttachment[];
    paidAmount: number;
    balance: number;
    paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
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
                payments: true,
            },
            orderBy: { date: 'desc' },
        });

        // Convert Decimal to number for client components
        const serializedInvoices = invoices.map(inv => {
            const totalAmount = Number(inv.totalAmount);
            const paidAmount = inv.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            const balance = totalAmount - paidAmount;
            const isPaid = Math.abs(balance) < 0.01;
            const isPartial = !isPaid && paidAmount > 0.01;
            const paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'PENDING';

            return {
                ...inv,
                netAmount: Number(inv.netAmount),
                vatAmount: Number(inv.vatAmount),
                totalAmount,
                paidAmount,
                balance,
                paymentStatus,
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
                payments: {
                    include: {
                        treasuryAccount: true,
                    },
                    orderBy: { date: 'desc' },
                },
                attachments: true,
                purchaseOrder: true,
            },
        });

        if (!invoice) {
            return { success: false, error: "Factura no encontrada" };
        }

        const totalAmount = Number(invoice.totalAmount);
        const paidAmount = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const balance = totalAmount - paidAmount;
        const isPaid = Math.abs(balance) < 0.01;
        const isPartial = !isPaid && paidAmount > 0.01;

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
