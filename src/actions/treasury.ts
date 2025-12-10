'use server';

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { AccountType, ContactType, PaymentMethod, PaymentType, Prisma } from "@prisma/client";
import { getActiveOrganizationId } from "@/lib/organization";
import { deleteFile } from "@/lib/storage";
import { randomUUID } from "crypto";

const AMOUNT_TOLERANCE = 0.01;

type TransferMetadata = {
    kind: "transfer";
    groupId: string;
    direction: "OUT" | "IN";
    note?: string | null;
};

const encodeTransferMetadata = (groupId: string, direction: "OUT" | "IN", note?: string | null) =>
    JSON.stringify({
        kind: "transfer",
        groupId,
        direction,
        note: note ?? null,
    });

const parseTransferMetadata = (value?: string | null): TransferMetadata | null => {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        if (parsed?.kind === "transfer" && typeof parsed.groupId === "string") {
            return {
                kind: "transfer",
                groupId: parsed.groupId,
                direction: parsed.direction === "IN" ? "IN" : "OUT",
                note: parsed.note ?? null,
            };
        }
        return null;
    } catch (error) {
        return null;
    }
};

const paymentRelations = {
    allocations: true,
    attachments: true,
    journalEntry: true,
    treasuryAccount: true,
} as const;

type PaymentWithTransferMeta = Prisma.PaymentGetPayload<{
    include: typeof paymentRelations;
}> & {
    transferGroupId?: string | null;
};

export async function getTreasuryAccounts(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const accounts = await db.treasuryAccount.findMany({
            where: { organizationId },
            include: {
                account: true,
            },
            orderBy: { name: 'asc' },
        });

        const serializedAccounts = accounts.map(a => ({
            ...a,
            balance: Number(a.balance),
        }));

        return { success: true, data: serializedAccounts };
    } catch (error) {
        console.error("Failed to fetch treasury accounts:", error);
        return { success: false, error: "Failed to fetch treasury accounts" };
    }
}

export async function deleteTreasuryMovement(paymentId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const organizationId = await getActiveOrganizationId();

        const result = await db.$transaction(async tx => {
            const paymentRecord = await tx.payment.findUnique({
                where: { id: paymentId },
                include: {
                    allocations: true,
                    attachments: true,
                    journalEntry: true,
                    treasuryAccount: true,
                },
            });

            if (!paymentRecord || paymentRecord.organizationId !== organizationId) {
                return { success: false as const, error: "Movimiento no encontrado" };
            }

            const payment = paymentRecord as PaymentWithTransferMeta;

            const paymentsToDelete: PaymentWithTransferMeta[] = payment.transferGroupId
                ? ((await tx.payment.findMany({
                      where: {
                          transferGroupId: payment.transferGroupId,
                      } as Prisma.PaymentWhereInput,
                      include: paymentRelations,
                  })) as PaymentWithTransferMeta[])
                : [payment];

            if (
                !paymentsToDelete.length ||
                paymentsToDelete.some(mov => mov.organizationId !== organizationId)
            ) {
                return { success: false as const, error: "Movimiento no válido para eliminar" };
            }

            for (const mov of paymentsToDelete) {
                const allocatedAmount = Number(mov.amountAllocated ?? 0);
                if (allocatedAmount > AMOUNT_TOLERANCE || mov.allocations.length) {
                    return {
                        success: false as const,
                        error: "No se puede eliminar un movimiento conciliado o con retenciones",
                    };
                }
            }

            const impactedTreasuryAccounts = new Set<string>();

            for (const mov of paymentsToDelete) {
                if (mov.attachments.length) {
                    await Promise.all(
                        mov.attachments.map(async attachment => {
                            if (attachment.key) {
                                try {
                                    await deleteFile(attachment.key);
                                } catch (fileError) {
                                    console.error("Failed to delete attachment file:", fileError);
                                }
                            }
                        }),
                    );
                    await tx.attachment.deleteMany({ where: { paymentId: mov.id } });
                }

                if (mov.journalEntryId) {
                    await tx.journalEntry.delete({ where: { id: mov.journalEntryId } });
                }

                if (mov.treasuryAccountId) {
                    const revertChange = mov.type === "PAYMENT" ? Number(mov.amount) : -Number(mov.amount);
                    await tx.treasuryAccount.update({
                        where: { id: mov.treasuryAccountId },
                        data: {
                            balance: {
                                increment: revertChange,
                            },
                        },
                    });
                    impactedTreasuryAccounts.add(mov.treasuryAccountId);
                }

                await tx.payment.delete({ where: { id: mov.id } });
            }

            return {
                success: true as const,
                impactedAccounts: Array.from(impactedTreasuryAccounts),
            };
        });

        if (!result.success) {
            return result;
        }

        for (const accountId of result.impactedAccounts) {
            revalidatePath(`/dashboard/treasury/${accountId}`);
        }
        revalidatePath("/dashboard/payments");

        return { success: true as const };
    } catch (error) {
        console.error("Failed to delete treasury movement:", error);
        return { success: false as const, error: "No se pudo eliminar el movimiento" };
    }
}

export async function createTreasuryMovement(data: {
    treasuryAccountId: string;
    accountId: string;
    date: string;
    description?: string;
    amount: number;
    contactId?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const organizationId = await getActiveOrganizationId();
        const parsedAmount = Number(data.amount);
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return { success: false, error: "El monto debe ser mayor a 0" };
        }

        const parsedDate = data.date ? new Date(data.date) : new Date();

        const [treasuryAccount, selectedAccount, contact] = await Promise.all([
            db.treasuryAccount.findUnique({
                where: { id: data.treasuryAccountId },
                include: { account: true },
            }),
            db.account.findUnique({ where: { id: data.accountId } }),
            data.contactId ? db.contact.findUnique({ where: { id: data.contactId } }) : Promise.resolve(null),
        ]);

        if (!treasuryAccount || treasuryAccount.organizationId !== organizationId) {
            return { success: false, error: "Cuenta de tesorería inválida" };
        }

        if (!selectedAccount || selectedAccount.organizationId !== organizationId) {
            return { success: false, error: "Cuenta contable inválida" };
        }

        const increasesTreasury = selectedAccount.type === AccountType.LIABILITY
            || selectedAccount.type === AccountType.EQUITY
            || selectedAccount.type === AccountType.INCOME;

        const movementType: PaymentType = increasesTreasury ? 'COLLECTION' : 'PAYMENT';
        const balanceChange = increasesTreasury ? parsedAmount : -parsedAmount;

        if (contact) {
            if (contact.organizationId !== organizationId) {
                return { success: false, error: "Contacto inválido" };
            }
            const expectedType = movementType === 'COLLECTION' ? ContactType.CUSTOMER : ContactType.VENDOR;
            if (contact.type !== expectedType) {
                return {
                    success: false,
                    error: movementType === 'COLLECTION'
                        ? "Solo podés asociar clientes a cobranzas manuales"
                        : "Solo podés asociar proveedores a pagos manuales",
                };
            }
        }

        const journalEntry = await db.journalEntry.create({
            data: {
                organizationId,
                date: parsedDate,
                description: data.description || 'Movimiento manual de tesorería',
                lines: {
                    create: [
                        {
                            accountId: selectedAccount.id,
                            debit: increasesTreasury ? 0 : parsedAmount,
                            credit: increasesTreasury ? parsedAmount : 0,
                            description: data.description,
                        },
                        {
                            accountId: treasuryAccount.accountId,
                            debit: increasesTreasury ? parsedAmount : 0,
                            credit: increasesTreasury ? 0 : parsedAmount,
                            description: data.description,
                        },
                    ],
                },
            },
        });

        await db.treasuryAccount.update({
            where: { id: treasuryAccount.id },
            data: {
                balance: {
                    increment: balanceChange,
                },
            },
        });

        await db.payment.create({
            data: {
                organizationId,
                type: movementType,
                method: treasuryAccount.type,
                amount: parsedAmount,
                date: parsedDate,
                reference: data.description,
                notes: data.description,
                treasuryAccountId: treasuryAccount.id,
                journalEntryId: journalEntry.id,
                contactId: contact?.id,
            },
        });

        revalidatePath(`/dashboard/treasury/${treasuryAccount.id}`);
        revalidatePath("/dashboard/payments");

        return { success: true };
    } catch (error) {
        console.error("Failed to create treasury movement:", error);
        return { success: false, error: "No se pudo registrar el movimiento" };
    }
}

export async function getTreasuryAccountDetail(id: string, organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const account = await db.treasuryAccount.findFirst({
            where: { id, organizationId },
            include: {
                organization: true,
                account: true,
            },
        });

        if (!account) {
            return { success: false, error: "Cuenta no encontrada" };
        }

        return {
            success: true,
            data: {
                ...account,
                balance: Number(account.balance),
            },
        };
    } catch (error) {
        console.error("Failed to fetch treasury account detail:", error);
        return { success: false, error: "Failed to fetch treasury account detail" };
    }
}

export async function createTreasuryAccount(data: {
    organizationId: string;
    name: string;
    type: PaymentMethod;
    currency: string;
    bankName?: string;
    cbu?: string;
    alias?: string;
    number?: string;
    accountId: string;
    initialBalance?: number;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const treasuryAccount = await db.treasuryAccount.create({
            data: {
                organizationId: data.organizationId,
                name: data.name,
                type: data.type,
                currency: data.currency,
                bankName: data.bankName,
                cbu: data.cbu,
                alias: data.alias,
                number: data.number,
                accountId: data.accountId,
                balance: data.initialBalance || 0,
            },
        });

        revalidatePath("/dashboard/treasury");

        const serialized = {
            ...treasuryAccount,
            balance: Number(treasuryAccount.balance),
        };

        return { success: true, data: serialized };
    } catch (error) {
        console.error("Failed to create treasury account:", error);
        return { success: false, error: "Failed to create treasury account" };
    }
}

export async function updateTreasuryAccount(id: string, data: {
    name?: string;
    type?: PaymentMethod;
    currency?: string;
    bankName?: string;
    cbu?: string;
    alias?: string;
    number?: string;
    accountId?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const treasuryAccount = await db.treasuryAccount.update({
            where: { id },
            data,
        });

        revalidatePath("/dashboard/treasury");

        const serialized = {
            ...treasuryAccount,
            balance: Number(treasuryAccount.balance),
        };

        return { success: true, data: serialized };
    } catch (error) {
        console.error("Failed to update treasury account:", error);
        return { success: false, error: "Failed to update treasury account" };
    }
}

export async function deleteTreasuryAccount(id: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        await db.treasuryAccount.delete({
            where: { id },
        });

        revalidatePath("/dashboard/treasury");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete treasury account:", error);
        return { success: false, error: "Failed to delete treasury account" };
    }
}
