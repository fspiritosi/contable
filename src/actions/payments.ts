'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { PaymentType, PaymentMethod, Prisma, InvoiceFlow } from "@prisma/client";
import { revalidatePath } from "next/cache";

const AMOUNT_TOLERANCE = 0.01;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    value === null || value === undefined ? 0 : Number(value);

const expectedFlowByPaymentType: Record<PaymentType, InvoiceFlow> = {
    PAYMENT: "PURCHASE",
    COLLECTION: "SALE",
};

const paymentDefaultInclude = {
    invoice: {
        include: {
            contact: true,
        },
    },
    treasuryAccount: true,
    journalEntry: {
        include: {
            lines: {
                include: {
                    account: true,
                },
            },
        },
    },
    contact: true,
    allocations: {
        include: {
            invoice: {
                include: {
                    contact: true,
                },
            },
            retention: true,
        },
    },
} satisfies Prisma.PaymentInclude;

const serializeContact = (contact: any) =>
    contact
        ? {
              id: contact.id,
              name: contact.name,
              type: contact.type,
              cuit: contact.cuit ?? null,
              email: contact.email ?? null,
              phone: contact.phone ?? null,
          }
        : null;

const serializePayment = (
    payment: Prisma.PaymentGetPayload<{
        include: typeof paymentDefaultInclude;
    }>,
) => {
    const invoiceContact = payment.invoice?.contact;

    return {
        id: payment.id,
        organizationId: payment.organizationId,
        type: payment.type,
        method: payment.method,
        amount: Number(payment.amount),
        amountAllocated: Number(payment.amountAllocated ?? 0),
        amountRemaining: Number(payment.amountRemaining ?? 0),
        date: payment.date instanceof Date ? payment.date.toISOString() : payment.date,
        reference: payment.reference,
        notes: payment.notes,
        contactId: payment.contactId,
        contact: serializeContact(payment.contact),
        contactName: payment.contact?.name ?? payment.invoice?.contact?.name ?? null,
        invoiceId: payment.invoiceId,
        treasuryAccountId: payment.treasuryAccountId,
        createdAt: payment.createdAt instanceof Date ? payment.createdAt.toISOString() : payment.createdAt,
        updatedAt: payment.updatedAt instanceof Date ? payment.updatedAt.toISOString() : payment.updatedAt,
        invoice: payment.invoice
            ? {
                  id: payment.invoice.id,
                  flow: payment.invoice.flow,
                  letter: payment.invoice.letter,
                  pointOfSale: Number(payment.invoice.pointOfSale),
                  number: Number(payment.invoice.number),
                  netAmount: Number(payment.invoice.netAmount),
                  vatAmount: Number(payment.invoice.vatAmount),
                  totalAmount: Number(payment.invoice.totalAmount),
                  contactName: invoiceContact?.name ?? null,
                  contact: serializeContact(invoiceContact),
              }
            : null,
        treasuryAccount: payment.treasuryAccount
            ? {
                  id: payment.treasuryAccount.id,
                  name: payment.treasuryAccount.name,
                  type: payment.treasuryAccount.type,
              }
            : null,
        journalEntry: payment.journalEntry
            ? {
                  ...payment.journalEntry,
                  date: payment.journalEntry.date instanceof Date ? payment.journalEntry.date.toISOString() : payment.journalEntry.date,
                  createdAt:
                      payment.journalEntry.createdAt instanceof Date
                          ? payment.journalEntry.createdAt.toISOString()
                          : payment.journalEntry.createdAt,
                  updatedAt:
                      payment.journalEntry.updatedAt instanceof Date
                          ? payment.journalEntry.updatedAt.toISOString()
                          : payment.journalEntry.updatedAt,
                  lines: payment.journalEntry.lines.map(line => ({
                      ...line,
                      debit: Number(line.debit),
                      credit: Number(line.credit),
                      account: line.account
                          ? {
                                id: line.account.id,
                                name: line.account.name,
                                code: line.account.code,
                                type: line.account.type,
                            }
                          : null,
                  })),
              }
            : null,
        allocations: payment.allocations
            ? payment.allocations.map(allocation => ({
                  id: allocation.id,
                  invoiceId: allocation.invoiceId,
                  retentionId: allocation.retentionId ?? null,
                  amount: Number(allocation.amount),
                  notes: allocation.notes ?? null,
                  invoice: allocation.invoice
                      ? {
                            id: allocation.invoice.id,
                            flow: allocation.invoice.flow,
                            letter: allocation.invoice.letter,
                            pointOfSale: Number(allocation.invoice.pointOfSale),
                            number: Number(allocation.invoice.number),
                            contactName: allocation.invoice.contact?.name ?? null,
                        }
                      : null,
                  retention: allocation.retention
                      ? {
                            id: allocation.retention.id,
                            typeName: allocation.retention.typeName,
                            typeCode: allocation.retention.typeCode ?? null,
                            amount: Number(allocation.retention.amount),
                        }
                      : null,
              }))
            : [],
    };
};

export async function getPayments(organizationId: string, type?: PaymentType) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const payments = await db.payment.findMany({
            where: {
                organizationId,
                ...(type && { type }),
            },
            include: paymentDefaultInclude,
            orderBy: { date: 'desc' },
        });

        return { success: true, data: payments.map(serializePayment) };
    } catch (error: any) {
        if (error?.code === 'P2022') {
            console.warn("La estructura de la tabla de pagos no coincide con el esquema actual. Retornando lista vacía para evitar fallos.");
            return { success: true, data: [] };
        }
        console.error("Failed to fetch payments:", error);
        return { success: false, error: "Failed to fetch payments" };
    }
}

export async function allocatePayment(data: {
    organizationId: string;
    paymentId: string;
    allocations: Array<{ invoiceId: string; amount: number; notes?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const normalizedAllocations = data.allocations
        .map(allocation => ({
            invoiceId: allocation.invoiceId,
            amount: Number(allocation.amount),
            notes: allocation.notes,
        }))
        .filter(allocation => allocation.amount > 0);

    if (!normalizedAllocations.length) {
        return { success: false, error: "Debes indicar al menos una asignación válida." } as const;
    }

    const payment = await db.payment.findUnique({
        where: { id: data.paymentId },
        include: {
            contact: true,
        },
    });

    if (!payment || payment.organizationId !== data.organizationId) {
        return { success: false, error: "El movimiento de tesorería no existe." } as const;
    }

    const paymentRemaining = toNumber(payment.amountRemaining ?? payment.amount) - toNumber(payment.amountAllocated ?? 0);
    const totalToAllocate = normalizedAllocations.reduce((sum, allocation) => sum + allocation.amount, 0);

    if (totalToAllocate <= 0) {
        return { success: false, error: "El monto total a conciliar debe ser mayor a 0." } as const;
    }

    if (totalToAllocate - paymentRemaining > AMOUNT_TOLERANCE) {
        return { success: false, error: "El monto a asignar supera el saldo disponible del movimiento." } as const;
    }

    if (!payment.contactId) {
        return { success: false, error: "Debes asociar un contacto al movimiento antes de conciliar." } as const;
    }

    const invoiceIds = normalizedAllocations.map(allocation => allocation.invoiceId);
    const invoices = await db.invoice.findMany({
        where: { id: { in: invoiceIds } },
        include: { contact: true },
    });

    if (invoices.length !== invoiceIds.length) {
        return { success: false, error: "Alguna de las facturas seleccionadas no existe." } as const;
    }

    const invoicesById = new Map(invoices.map(invoice => [invoice.id, invoice]));
    const expectedInvoiceFlow = expectedFlowByPaymentType[payment.type];
    const perInvoiceTotals = new Map<string, number>();

    for (const allocation of normalizedAllocations) {
        const invoice = invoicesById.get(allocation.invoiceId);
        if (!invoice || invoice.organizationId !== data.organizationId) {
            return { success: false, error: "Alguna factura pertenece a otra organización." } as const;
        }

        if (invoice.flow !== expectedInvoiceFlow) {
            return { success: false, error: "La factura seleccionada no corresponde al flujo del movimiento." } as const;
        }

        if (!invoice.contactId || invoice.contactId !== payment.contactId) {
            return { success: false, error: "Todas las facturas deben pertenecer al mismo contacto del movimiento." } as const;
        }

        const invoiceRemaining = toNumber(invoice.amountRemaining ?? invoice.totalAmount) - toNumber(invoice.amountAllocated ?? 0);

        if (allocation.amount - invoiceRemaining > AMOUNT_TOLERANCE) {
            return { success: false, error: "El monto asignado supera el saldo pendiente de una factura." } as const;
        }

        perInvoiceTotals.set(allocation.invoiceId, (perInvoiceTotals.get(allocation.invoiceId) ?? 0) + allocation.amount);
    }

    const updatedPayment = await db.$transaction(async tx => {
        await Promise.all(
            normalizedAllocations.map(allocation =>
                tx.paymentAllocation.create({
                    data: {
                        organizationId: data.organizationId,
                        paymentId: data.paymentId,
                        invoiceId: allocation.invoiceId,
                        amount: allocation.amount,
                        notes: allocation.notes,
                    },
                }),
            ),
        );

        await tx.payment.update({
            where: { id: data.paymentId },
            data: {
                amountAllocated: { increment: totalToAllocate },
                amountRemaining: { decrement: totalToAllocate },
            },
        });

        await Promise.all(
            Array.from(perInvoiceTotals.entries()).map(([invoiceId, amount]) =>
                tx.invoice.update({
                    where: { id: invoiceId },
                    data: {
                        amountAllocated: { increment: amount },
                        amountRemaining: { decrement: amount },
                    },
                }),
            ),
        );

        return tx.payment.findUnique({
            where: { id: data.paymentId },
            include: paymentDefaultInclude,
        });
    });

    if (!updatedPayment) {
        return { success: false, error: "No se pudo actualizar el movimiento." } as const;
    }

    if (payment.treasuryAccountId) {
        revalidatePath(`/dashboard/treasury/${payment.treasuryAccountId}`);
    }
    revalidatePath("/dashboard/payments");
    revalidatePath("/dashboard/invoices");

    return {
        success: true,
        data: serializePayment(updatedPayment),
    } as const;
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
    treasuryAccountId: string; // Required: cuenta de tesorería
    contactId?: string;
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

        // Validate treasury account selection
        const treasuryAccount = await db.treasuryAccount.findUnique({
            where: { id: data.treasuryAccountId },
            select: {
                id: true,
                organizationId: true,
                balance: true,
                type: true,
            },
        });

        if (!treasuryAccount || treasuryAccount.organizationId !== data.organizationId) {
            return {
                success: false,
                error: "La cuenta de tesorería seleccionada no es válida.",
            };
        }

        if (treasuryAccount.type !== data.method) {
            return {
                success: false,
                error: "La cuenta de tesorería no coincide con el método seleccionado.",
            };
        }

        const currentBalance = Number(treasuryAccount.balance);

        if (data.type === 'PAYMENT' && currentBalance < data.amount) {
            return {
                success: false,
                error: "Saldo insuficiente en la caja seleccionada.",
            };
        }

        // Validate required accounts for treasury (Plan de Cuentas)
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
        let resolvedContactId = data.contactId;
        type InvoiceWithContact = Prisma.InvoiceGetPayload<{ include: { contact: true } }>;
        let linkedInvoice: InvoiceWithContact | null = null;
        if (data.invoiceId) {
            linkedInvoice = await db.invoice.findUnique({
                where: { id: data.invoiceId },
                include: { contact: true },
            });

            if (!linkedInvoice || linkedInvoice.organizationId !== data.organizationId) {
                return {
                    success: false,
                    error: "La factura vinculada no existe o pertenece a otra organización.",
                } as const;
            }

            const expectedInvoiceFlow = expectedFlowByPaymentType[data.type];
            if (linkedInvoice.flow !== expectedInvoiceFlow) {
                return {
                    success: false,
                    error: "El tipo de movimiento no coincide con el flujo de la factura seleccionada.",
                } as const;
            }

            const invoiceRemaining = Number(linkedInvoice.amountRemaining ?? linkedInvoice.totalAmount) - Number(linkedInvoice.amountAllocated ?? 0);
            if (invoiceRemaining + AMOUNT_TOLERANCE < data.amount) {
                return {
                    success: false,
                    error: "El monto supera el saldo pendiente de la factura.",
                } as const;
            }

            invoiceInfo = ` - ${linkedInvoice.flow === 'SALE' ? 'Factura' : 'Compra'} ${linkedInvoice.letter} ${String(linkedInvoice.pointOfSale).padStart(4, '0')}-${String(linkedInvoice.number).padStart(8, '0')}`;
            resolvedContactId = resolvedContactId ?? linkedInvoice.contactId ?? undefined;
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

        // Update treasury account balance
        const balanceChange = data.type === 'PAYMENT' ? -data.amount : data.amount;
        await db.treasuryAccount.update({
            where: { id: data.treasuryAccountId },
            data: {
                balance: {
                    increment: balanceChange,
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
                contactId: resolvedContactId,
                journalEntryId: journalEntry.id,
                treasuryAccountId: data.treasuryAccountId,
                amountAllocated: linkedInvoice ? data.amount : 0,
                amountRemaining: linkedInvoice ? 0 : data.amount,
            },
            include: paymentDefaultInclude,
        });

        if (linkedInvoice) {
            await db.invoice.update({
                where: { id: linkedInvoice.id },
                data: {
                    amountAllocated: {
                        increment: data.amount,
                    },
                    amountRemaining: {
                        decrement: data.amount,
                    },
                },
            });
        }

        revalidatePath("/dashboard/payments");
        revalidatePath("/dashboard/accounting/journal");

        return {
            success: true,
            data: serializePayment(payment),
        } as const;
    } catch (error) {
        console.error("Failed to create payment:", error);
        return { success: false, error: "Failed to create payment" };
    }
}

export async function getTreasuryAccountMovements(treasuryAccountId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const movements = await db.payment.findMany({
            where: { treasuryAccountId },
            include: paymentDefaultInclude,
            orderBy: { date: 'desc' },
        });

        return { success: true, data: movements.map(serializePayment) };
    } catch (error: any) {
        if (error?.code === 'P2022') {
            console.warn("La estructura de la tabla de pagos no coincide con el esquema actual. Retornando movimientos vacíos.");
            return { success: true, data: [] };
        }
        console.error("Failed to fetch treasury account movements:", error);
        return { success: false, error: "Failed to fetch treasury account movements" };
    }
}

