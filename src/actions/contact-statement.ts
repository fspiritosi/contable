'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";

const AMOUNT_TOLERANCE = 0.01;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    value === null || value === undefined ? 0 : Number(value);

const toISOString = (value: Date | string | null | undefined) =>
    value instanceof Date ? value.toISOString() : value ?? null;

const ensureTimestamp = (value: string | null | undefined) => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
};

export async function getContactStatement(contactId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Get contact info
        const contact = await db.contact.findUnique({
            where: { id: contactId },
            include: {
                attachments: true,
            },
        });

        if (!contact) {
            return { success: false, error: "Contact not found" };
        }

        const invoices = await db.invoice.findMany({
            where: { contactId },
            orderBy: { date: 'desc' },
        });

        // Get purchase orders if this contact is a vendor
        const purchaseOrders = contact.type === 'VENDOR'
            ? await db.purchaseOrder.findMany({
                  where: { contactId },
                  include: {
                      invoices: true,
                  },
                  orderBy: { issueDate: 'desc' },
              })
            : [];

        const payments = await db.payment.findMany({
            where: {
                organizationId: contact.organizationId,
                OR: [
                    { contactId },
                    { invoice: { contactId } },
                    { allocations: { some: { invoice: { contactId } } } },
                ],
            },
            include: {
                invoice: {
                    select: {
                        id: true,
                        letter: true,
                        pointOfSale: true,
                        number: true,
                        contactId: true,
                    },
                },
                allocations: {
                    include: {
                        invoice: {
                            select: {
                                id: true,
                                letter: true,
                                pointOfSale: true,
                                number: true,
                                contactId: true,
                            },
                        },
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

            return {
                id: inv.id,
                date: toISOString(inv.date),
                flow: inv.flow,
                letter: inv.letter,
                pointOfSale: Number(inv.pointOfSale),
                number: Number(inv.number),
                netAmount: Number(inv.netAmount),
                vatAmount: Number(inv.vatAmount),
                totalAmount,
                paidAmount,
                balance,
                isPaid,
                paymentStatus: isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'PENDING',
            };
        });

        const paymentEntries = payments.flatMap(payment => {
            const base = {
                type: payment.type,
                method: payment.method,
                date: toISOString(payment.date),
                reference: payment.reference,
                notes: payment.notes,
            };

            const entries: Array<{
                id: string;
                amount: number;
                invoiceId: string | null;
                invoice: { letter: string; pointOfSale: number; number: number } | null;
            } & typeof base> = [];

            if (payment.invoice && payment.invoice.contactId === contactId) {
                entries.push({
                    ...base,
                    id: `${payment.id}:invoice`,
                    amount: Number(payment.amount),
                    invoiceId: payment.invoice.id,
                    invoice: {
                        letter: payment.invoice.letter,
                        pointOfSale: Number(payment.invoice.pointOfSale),
                        number: Number(payment.invoice.number),
                    },
                });
            }

            payment.allocations
                .filter(allocation => allocation.invoice?.contactId === contactId)
                .forEach(allocation => {
                    if (!allocation.invoice) return;
                    entries.push({
                        ...base,
                        id: `${payment.id}:allocation:${allocation.id}`,
                        amount: Number(allocation.amount),
                        invoiceId: allocation.invoice.id,
                        invoice: {
                            letter: allocation.invoice.letter,
                            pointOfSale: Number(allocation.invoice.pointOfSale),
                            number: Number(allocation.invoice.number),
                        },
                    });
                });

            if (!entries.length && payment.contactId === contactId) {
                entries.push({
                    ...base,
                    id: `${payment.id}:contact`,
                    amount: Number(payment.amount),
                    invoiceId: null,
                    invoice: null,
                });
            }

            return entries;
        });

        const serializedPayments = paymentEntries.map(entry => ({
            id: entry.id,
            date: entry.date,
            type: entry.type,
            method: entry.method,
            amount: entry.amount,
            reference: entry.reference,
            notes: entry.notes,
            invoiceId: entry.invoiceId,
            invoice: entry.invoice,
        }));

        const totalInvoiced = serializedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
        const totalPaid = serializedInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

        // Create combined timeline
        const timeline = [
            ...serializedInvoices.map(inv => ({
                ...inv,
                itemType: 'invoice' as const,
            })),
            ...serializedPayments.map(pay => ({
                ...pay,
                itemType: 'payment' as const,
            })),
        ].sort((a, b) => ensureTimestamp(b.date) - ensureTimestamp(a.date));

        const serializedPurchaseOrders = purchaseOrders.map(po => {
            const total = Number(po.total);
            const invoiced = Number(po.invoicedAmount ?? 0);
            return {
                id: po.id,
                orderNumber: po.orderNumber,
                status: po.status,
                issueDate: toISOString(po.issueDate),
                expectedDate: toISOString(po.expectedDate),
                total,
                invoicedAmount: invoiced,
                remainingAmount: total - invoiced,
                invoicesCount: po.invoices.length,
            };
        });

        const balance = totalInvoiced - totalPaid;

        return {
            success: true,
            data: {
                contact,
                timeline,
                invoices: serializedInvoices,
                purchaseOrders: serializedPurchaseOrders,
                summary: {
                    totalInvoiced,
                    totalPaid,
                    balance,
                },
            },
        };
    } catch (error) {
        console.error("Failed to fetch contact statement:", error);
        return { success: false, error: "Failed to fetch contact statement" };
    }
}
