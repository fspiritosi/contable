'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { AccountType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getActiveOrganizationId } from "@/lib/organization";

export async function getAccounts() {
    try {
        const organizationId = await getActiveOrganizationId();
        const accounts = await db.account.findMany({
            where: { organizationId },
            orderBy: { code: 'asc' },
        });
        return { success: true, data: accounts };
    } catch (error) {
        console.error("Failed to fetch accounts:", error);
        return { success: false, error: "Failed to fetch accounts" };
    }
}

export async function createAccount(data: {
    code: string;
    name: string;
    type: AccountType;
    parentId?: string;
}) {
    try {
        const organizationId = await getActiveOrganizationId();

        const account = await db.account.create({
            data: {
                ...data,
                organizationId,
            },
        });

        revalidatePath("/dashboard/accounting/chart");
        return { success: true, data: account };
    } catch (error) {
        console.error("Failed to create account:", error);
        return { success: false, error: "Failed to create account" };
    }
}

export async function isAccountInUse(accountId: string) {
    try {
        // Check TransactionLines
        const transactionCount = await db.transactionLine.count({
            where: { accountId }
        });

        if (transactionCount > 0) {
            return { success: true, inUse: true, reason: "La cuenta tiene movimientos registrados" };
        }

        // Check AccountingConfig (all 8 possible references)
        const configCount = await db.accountingConfig.count({
            where: {
                OR: [
                    { salesAccountId: accountId },
                    { salesVatAccountId: accountId },
                    { receivablesAccountId: accountId },
                    { purchasesAccountId: accountId },
                    { purchasesVatAccountId: accountId },
                    { payablesAccountId: accountId },
                    { cashAccountId: accountId },
                    { bankAccountId: accountId },
                ]
            }
        });

        if (configCount > 0) {
            return { success: true, inUse: true, reason: "La cuenta está configurada en la configuración contable" };
        }

        return { success: true, inUse: false };
    } catch (error) {
        console.error("Failed to check account usage:", error);
        return { success: false, error: "Failed to check account usage" };
    }
}

// Helper function to check if an account has transactions
async function checkAccountInUse(accountId: string): Promise<boolean> {
    const transactionCount = await db.transactionLine.count({
        where: { accountId }
    });
    return transactionCount > 0;
}

export async function updateAccount(id: string, data: {
    code?: string;
    name?: string;
    type?: AccountType;
    parentId?: string | null;
}) {
    try {
        const organizationId = await getActiveOrganizationId();

        // Check if account is in use (has transactions)
        const isInUse = await checkAccountInUse(id);
        if (isInUse) {
            return { success: false, error: "Cannot modify account that has transactions" };
        }

        // Prepare update data
        const updateData: any = {};
        if (data.code !== undefined) updateData.code = data.code;
        if (data.name !== undefined) updateData.name = data.name;
        if (data.type !== undefined) updateData.type = data.type;
        if (data.parentId !== undefined) {
            updateData.parentId = data.parentId || null;
        }

        const account = await db.account.update({
            where: { id },
            data: updateData,
        });

        revalidatePath("/dashboard/accounting/chart");
        return { success: true, data: account };
    } catch (error) {
        console.error("Failed to update account:", error);
        return { success: false, error: "Failed to update account" };
    }
}

export async function deleteAccount(id: string) {
    try {
        // Validate not in use
        const usageCheck = await isAccountInUse(id);
        if (!usageCheck.success) {
            return { success: false, error: usageCheck.error };
        }

        if (usageCheck.inUse) {
            return { success: false, error: usageCheck.reason || "No se puede eliminar una cuenta en uso" };
        }

        // Check if has children
        const childrenCount = await db.account.count({
            where: { parentId: id }
        });

        if (childrenCount > 0) {
            return { success: false, error: "No se puede eliminar una cuenta con subcuentas" };
        }

        await db.account.delete({ where: { id } });

        revalidatePath("/dashboard/accounting/chart");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete account:", error);
        return { success: false, error: "Failed to delete account" };
    }
}
