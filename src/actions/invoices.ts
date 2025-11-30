'use server';

import { db } from "@/lib/db";
import { InvoiceFlow, InvoiceLetter } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";

export async function getInvoices(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const invoices = await db.invoice.findMany({
            where: { organizationId },
            include: {
                contact: true,
                items: true,
            },
            orderBy: { date: 'desc' },
        });

        // Convert Decimal to number for client components
        const serializedInvoices = invoices.map(inv => ({
            ...inv,
            netAmount: Number(inv.netAmount),
            vatAmount: Number(inv.vatAmount),
            totalAmount: Number(inv.totalAmount),
            items: inv.items.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                vatRate: Number(item.vatRate),
                total: Number(item.total),
            })),
        }));

        return { success: true, data: serializedInvoices };
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return { success: false, error: "Failed to fetch invoices" };
    }
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
    }[];
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
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

        for (const item of data.items) {
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

        // Get contact info for snapshot
        let contactSnapshot: {
            contactName?: string;
            contactCuit?: string | null;
            contactAddress?: string | null;
        } = {};

        if (data.contactId) {
            const contact = await db.contact.findUnique({ where: { id: data.contactId } });
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
                contactId: data.contactId,
                ...contactSnapshot,
                netAmount,
                vatAmount,
                totalAmount,
                journalEntryId: journalEntry.id,
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
        revalidatePath("/dashboard/accounting/journal");

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
