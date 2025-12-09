'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { InvoiceFlow, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

const AMOUNT_TOLERANCE = 0.01;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    value === null || value === undefined ? 0 : Number(value);

const formatInvoiceLabel = (params: { letter: string; pointOfSale: number; number: number }) =>
    `${params.letter} ${String(params.pointOfSale).padStart(4, '0')}-${String(params.number).padStart(8, '0')}`;

export type SerializedRetentionSetting = {
    id: string;
    organizationId: string;
    name: string;
    code: string | null;
    description: string | null;
    appliesTo: InvoiceFlow | null;
    defaultRate: number | null;
    receivableAccountId: string | null;
    payableAccountId: string | null;
    receivableAccount: { id: string; name: string; code: string } | null;
    payableAccount: { id: string; name: string; code: string } | null;
};

export type SerializedRetention = {
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
    retentionSetting: SerializedRetentionSetting | null;
};

const serializeSetting = (
    setting: Prisma.RetentionSettingGetPayload<{ include: { receivableAccount: true; payableAccount: true } }>,
): SerializedRetentionSetting => ({
    id: setting.id,
    organizationId: setting.organizationId,
    name: setting.name,
    code: setting.code,
    description: setting.description,
    appliesTo: setting.appliesTo,
    defaultRate: setting.defaultRate ? Number(setting.defaultRate) : null,
    receivableAccountId: setting.receivableAccountId,
    payableAccountId: setting.payableAccountId,
    receivableAccount: setting.receivableAccount
        ? {
              id: setting.receivableAccount.id,
              name: setting.receivableAccount.name,
              code: setting.receivableAccount.code,
          }
        : null,
    payableAccount: setting.payableAccount
        ? {
              id: setting.payableAccount.id,
              name: setting.payableAccount.name,
              code: setting.payableAccount.code,
          }
        : null,
});

const serializeRetention = (
    retention: Prisma.RetentionGetPayload<{
        include: {
            journalEntry: true;
            retentionSetting: {
                include: {
                    receivableAccount: true;
                    payableAccount: true;
                };
            };
        };
    }>,
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
    retentionSetting: retention.retentionSetting ? serializeSetting(retention.retentionSetting) : null,
});

export async function getRetentionSettings(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const settings = await db.retentionSetting.findMany({
            where: { organizationId },
            orderBy: { name: 'asc' },
            include: {
                receivableAccount: true,
                payableAccount: true,
            },
        });

        return {
            success: true as const,
            data: settings.map(serializeSetting),
        };
    } catch (error) {
        console.error("Failed to fetch retention settings", error);
        return { success: false as const, error: "No se pudieron obtener las configuraciones de retenciones" };
    }
}

export async function saveRetentionSetting(data: {
    organizationId: string;
    id?: string;
    name: string;
    code?: string | null;
    description?: string | null;
    appliesTo?: InvoiceFlow | null;
    defaultRate?: number | null;
    receivableAccountId?: string | null;
    payableAccountId?: string | null;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const accountIds = [data.receivableAccountId, data.payableAccountId].filter(Boolean) as string[];

        if (accountIds.length) {
            const accounts = await db.account.findMany({
                where: {
                    id: { in: accountIds },
                    organizationId: data.organizationId,
                },
                select: { id: true },
            });

            if (accounts.length !== accountIds.length) {
                return { success: false as const, error: "Alguna de las cuentas seleccionadas no existe." };
            }
        }

        const payload = {
            organizationId: data.organizationId,
            name: data.name,
            code: data.code?.trim() || null,
            description: data.description?.trim() || null,
            appliesTo: data.appliesTo ?? null,
            defaultRate: data.defaultRate ?? 0,
            receivableAccountId: data.receivableAccountId ?? null,
            payableAccountId: data.payableAccountId ?? null,
        };

        const setting = data.id
            ? await db.retentionSetting.update({
                  where: { id: data.id },
                  data: payload,
              })
            : await db.retentionSetting.create({
                  data: payload,
              });

        revalidatePath('/dashboard/settings');

        return { success: true as const, data: serializeSetting(await db.retentionSetting.findUniqueOrThrow({
            where: { id: setting.id },
            include: { receivableAccount: true, payableAccount: true },
        })) };
    } catch (error) {
        console.error("Failed to save retention setting", error);
        return { success: false as const, error: "No se pudo guardar la configuración de retenciones" };
    }
}

export async function recordRetention(data: {
    organizationId: string;
    invoiceId: string;
    retentionSettingId: string;
    baseAmount: number;
    rate?: number; // expressed as percentage (e.g. 3 for 3%)
    amount?: number;
    certificateNumber?: string;
    certificateDate?: Date | string | null;
    notes?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const invoice = await db.invoice.findUnique({
            where: { id: data.invoiceId },
            include: {
                contact: true,
            },
        });

        if (!invoice || invoice.organizationId !== data.organizationId) {
            return { success: false as const, error: "La factura seleccionada no existe." };
        }

        if (!invoice.contactId || !invoice.contact) {
            return { success: false as const, error: "La factura debe tener un contacto asociado." };
        }

        const accountingConfig = await db.accountingConfig.findUnique({
            where: { organizationId: data.organizationId },
        });

        if (!accountingConfig) {
            return {
                success: false as const,
                error: "Debes configurar el plan de cuentas antes de registrar retenciones.",
            };
        }

        const retentionSetting = await db.retentionSetting.findFirst({
            where: {
                id: data.retentionSettingId,
                organizationId: data.organizationId,
            },
        });

        if (!retentionSetting) {
            return {
                success: false as const,
                error: "No se encontró la configuración de retención seleccionada.",
            };
        }

        if (retentionSetting.appliesTo && retentionSetting.appliesTo !== invoice.flow) {
            return {
                success: false as const,
                error: "La configuración de retención no aplica para el tipo de comprobante.",
            };
        }

        const effectiveRate = data.rate ?? (retentionSetting.defaultRate ? Number(retentionSetting.defaultRate) : null);
        const requestedAmount = data.amount ?? (effectiveRate !== null ? (data.baseAmount * effectiveRate) / 100 : null);

        if (requestedAmount === null || requestedAmount <= 0) {
            return { success: false as const, error: "El monto de la retención debe ser mayor a cero." };
        }

        const invoiceRemaining = toNumber(invoice.amountRemaining ?? invoice.totalAmount);

        if (requestedAmount - invoiceRemaining > AMOUNT_TOLERANCE) {
            return { success: false as const, error: "El monto de la retención supera el saldo pendiente." };
        }

        const certificateDate = data.certificateDate
            ? data.certificateDate instanceof Date
                ? data.certificateDate
                : new Date(data.certificateDate)
            : null;

        const journalDescription = `Retención ${retentionSetting.name} factura ${formatInvoiceLabel({
            letter: invoice.letter,
            pointOfSale: invoice.pointOfSale,
            number: invoice.number,
        })}`;

        const debitAccountId = invoice.flow === 'SALE'
            ? retentionSetting.receivableAccountId
            : accountingConfig.payablesAccountId;
        const creditAccountId = invoice.flow === 'SALE'
            ? accountingConfig.receivablesAccountId
            : retentionSetting.payableAccountId;

        if (invoice.flow === 'SALE') {
            if (!retentionSetting.receivableAccountId || !accountingConfig.receivablesAccountId) {
                return {
                    success: false as const,
                    error: "Configura las cuentas de retenciones y de clientes para registrar esta retención.",
                };
            }
        } else {
            if (!retentionSetting.payableAccountId || !accountingConfig.payablesAccountId) {
                return {
                    success: false as const,
                    error: "Configura las cuentas de retenciones y de proveedores para registrar esta retención.",
                };
            }
        }

        const retention = await db.$transaction(async tx => {
            const journalEntry = await tx.journalEntry.create({
                data: {
                    organizationId: data.organizationId,
                    date: certificateDate ?? new Date(),
                    description: journalDescription,
                    lines: {
                        create: [
                            {
                                accountId: debitAccountId!,
                                debit: requestedAmount,
                                credit: 0,
                                description: invoice.flow === 'SALE'
                                    ? 'Crédito por retención'
                                    : 'Aplicación de retención a proveedor',
                            },
                            {
                                accountId: creditAccountId!,
                                debit: 0,
                                credit: requestedAmount,
                                description: invoice.flow === 'SALE'
                                    ? 'Cancelar saldo del cliente'
                                    : 'Obligación por retención',
                            },
                        ],
                    },
                },
            });

            const createdRetention = await tx.retention.create({
                data: {
                    organizationId: data.organizationId,
                    invoiceId: invoice.id,
                    contactId: invoice.contactId,
                    baseAmount: data.baseAmount,
                    rate: data.rate ?? effectiveRate ?? 0,
                    amount: requestedAmount,
                    certificateNumber: data.certificateNumber,
                    certificateDate,
                    notes: data.notes,
                    retentionSettingId: retentionSetting.id,
                    typeName: retentionSetting.name,
                    typeCode: retentionSetting.code,
                    journalEntryId: journalEntry.id,
                },
                include: {
                    journalEntry: true,
                    retentionSetting: {
                        include: {
                            receivableAccount: true,
                            payableAccount: true,
                        },
                    },
                },
            });

            await tx.paymentAllocation.create({
                data: {
                    organizationId: data.organizationId,
                    invoiceId: invoice.id,
                    retentionId: createdRetention.id,
                    amount: requestedAmount,
                    notes: data.notes,
                },
            });

            await tx.invoice.update({
                where: { id: invoice.id },
                data: {
                    amountAllocated: { increment: requestedAmount },
                    amountRemaining: { decrement: requestedAmount },
                },
            });

            return createdRetention;
        });

        revalidatePath('/dashboard/invoices');
        revalidatePath(`/dashboard/contacts/${invoice.contactId}`);

        return { success: true as const, data: serializeRetention(retention) };
    } catch (error) {
        console.error("Failed to record retention", error);
        return { success: false as const, error: "No se pudo registrar la retención" };
    }
}
