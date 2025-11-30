'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { PaymentType, PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getPayments(organizationId: string, type?: PaymentType) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const payments = await db.payment.findMany({
            where: {
                organizationId,
                ...(type && { type }),
            },
            include: {
                invoice: {
                    include: {
                        contact: true,
                    },
                },
                journalEntry: {
                    include: {
                        lines: {
                            include: {
                                account: true,
                            },
                        },
                    },
                },
            },
            orderBy: { date: 'desc' },
        });

        // Serialize Decimal fields
        const serializedPayments = payments.map(payment => ({
            ...payment,
            amount: Number(payment.amount),
            invoice: payment.invoice ? {
                ...payment.invoice,
                netAmount: Number(payment.invoice.netAmount),
                vatAmount: Number(payment.invoice.vatAmount),
                totalAmount: Number(payment.invoice.totalAmount),
            } : null,
            journalEntry: payment.journalEntry ? {
                ...payment.journalEntry,
                lines: payment.journalEntry.lines.map((line: any) => ({
                    ...line,
                    debit: Number(line.debit),
                    credit: Number(line.credit),
                })),
            } : null,
        }));

        return { success: true, data: serializedPayments };
    } catch (error) {
        console.error("Failed to fetch payments:", error);
        return { success: false, error: "Failed to fetch payments" };
    }
}

export async function createPayment(data: {
    organizationId: string;
    type: PaymentType;
    method: PaymentMethod;
    amount: number;
    date: Date;
    reference?: string;
    notes?: string;
    invoiceId?: string;
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

        // Validate required accounts for treasury
        const accountId = data.method === 'CASH' ? config.cashAccountId : config.bankAccountId;

        if (!accountId) {
            return {
                success: false,
                error: `Falta configurar la cuenta de ${data.method === 'CASH' ? 'Caja' : 'Banco'}`,
            };
        }

        // Get the payables/receivables account
        const counterAccountId = data.type === 'PAYMENT'
            ? config.payablesAccountId
            : config.receivablesAccountId;

        if (!counterAccountId) {
            return {
                success: false,
                error: `Falta configurar la cuenta de ${data.type === 'PAYMENT' ? 'Cuentas por Pagar' : 'Cuentas por Cobrar'}`,
            };
        }

        // Get invoice info if linked
        let invoiceInfo = "";
        if (data.invoiceId) {
            const invoice = await db.invoice.findUnique({
                where: { id: data.invoiceId },
                include: { contact: true },
            });
            if (invoice) {
                invoiceInfo = ` - ${invoice.flow === 'SALE' ? 'Factura' : 'Compra'} ${invoice.letter} ${String(invoice.pointOfSale).padStart(4, '0')}-${String(invoice.number).padStart(8, '0')}`;
            }
        }

        // Create journal entry for the payment
        const journalDescription = data.type === 'PAYMENT'
            ? `Pago ${data.method === 'CASH' ? 'en Efectivo' : 'Bancario'}${invoiceInfo}`
            : `Cobranza ${data.method === 'CASH' ? 'en Efectivo' : 'Bancaria'}${invoiceInfo}`;

        const journalLines = [];

        if (data.type === 'PAYMENT') {
            // PAYMENT: Debit Payables, Credit Cash/Bank
            journalLines.push({
                accountId: counterAccountId,
                debit: data.amount,
                credit: 0,
                description: 'Pago a proveedor',
            });
            journalLines.push({
                accountId: accountId,
                debit: 0,
                credit: data.amount,
                description: `Salida de ${data.method === 'CASH' ? 'caja' : 'banco'}`,
            });
        } else {
            // COLLECTION: Debit Cash/Bank, Credit Receivables
            journalLines.push({
                accountId: accountId,
                debit: data.amount,
                credit: 0,
                description: `Ingreso a ${data.method === 'CASH' ? 'caja' : 'banco'}`,
            });
            journalLines.push({
                accountId: counterAccountId,
                debit: 0,
                credit: data.amount,
                description: 'Cobranza de cliente',
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

        // Create payment linked to journal entry
        const payment = await db.payment.create({
            data: {
                organizationId: data.organizationId,
                type: data.type,
                method: data.method,
                amount: data.amount,
                date: data.date,
                reference: data.reference,
                notes: data.notes,
                invoiceId: data.invoiceId,
                journalEntryId: journalEntry.id,
            },
            include: {
                invoice: {
                    include: {
                        contact: true,
                    },
                },
                journalEntry: {
                    include: {
                        lines: {
                            include: {
                                account: true,
                            },
                        },
                    },
                },
            },
        });

        revalidatePath("/dashboard/payments");
        revalidatePath("/dashboard/accounting/journal");

        // Serialize Decimal fields
        return {
            success: true,
            data: {
                ...payment,
                amount: Number(payment.amount),
                invoice: payment.invoice ? {
                    ...payment.invoice,
                    netAmount: Number(payment.invoice.netAmount),
                    vatAmount: Number(payment.invoice.vatAmount),
                    totalAmount: Number(payment.invoice.totalAmount),
                } : null,
                journalEntry: {
                    ...payment.journalEntry,
                    lines: payment.journalEntry?.lines.map((line: any) => ({
                        ...line,
                        debit: Number(line.debit),
                        credit: Number(line.credit),
                    })),
                },
            },
        };
    } catch (error) {
        console.error("Failed to create payment:", error);
        return { success: false, error: "Failed to create payment" };
    }
}
