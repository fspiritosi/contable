'use server';

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { PaymentMethod } from "@prisma/client";
import { getActiveOrganizationId } from "@/lib/organization";

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
