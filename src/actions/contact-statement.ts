'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

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

        // Get all invoices for this contact
        const invoices = await db.invoice.findMany({
            where: { contactId },
            include: {
                items: true,
                payments: true,
            },
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

        // Get all payments for this contact's invoices
        const payments = await db.payment.findMany({
            where: {
                invoiceId: {
                    in: invoices.map(inv => inv.id),
                },
            },
            include: {
                invoice: true,
            },
            orderBy: { date: 'desc' },
        });

        // Calculate totals and balances
        let totalInvoiced = 0;
        let totalPaid = 0;

        const serializedInvoices = invoices.map(inv => {
            const invoiceTotal = Number(inv.totalAmount);
            totalInvoiced += invoiceTotal;

            // Calculate how much has been paid for this invoice
            const invoicePayments = payments.filter(p => p.invoiceId === inv.id);
            const paidAmount = invoicePayments.reduce((sum, p) => sum + Number(p.amount), 0);
            const remaining = invoiceTotal - paidAmount;
            const isPaid = Math.abs(remaining) < 0.01;
            const isPartial = !isPaid && paidAmount > 0.01;

            return {
                id: inv.id,
                date: inv.date,
                flow: inv.flow,
                letter: inv.letter,
                pointOfSale: inv.pointOfSale,
                number: inv.number,
                netAmount: Number(inv.netAmount),
                vatAmount: Number(inv.vatAmount),
                totalAmount: invoiceTotal,
                paidAmount: paidAmount,
                balance: remaining,
                isPaid,
                paymentStatus: isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'PENDING',
            };
        });

        const serializedPayments = payments.map(p => ({
            id: p.id,
            date: p.date,
            type: p.type,
            method: p.method,
            amount: Number(p.amount),
            reference: p.reference,
            notes: p.notes,
            invoiceId: p.invoiceId,
            invoice: p.invoice ? {
                letter: p.invoice.letter,
                pointOfSale: p.invoice.pointOfSale,
                number: p.invoice.number,
            } : null,
        }));

        totalPaid = serializedPayments.reduce((sum, p) => sum + p.amount, 0);

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
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const serializedPurchaseOrders = purchaseOrders.map(po => {
            const total = Number(po.total);
            const invoiced = Number(po.invoicedAmount ?? 0);
            return {
                id: po.id,
                orderNumber: po.orderNumber,
                status: po.status,
                issueDate: po.issueDate,
                expectedDate: po.expectedDate,
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
