'use server';

import { db } from "@/lib/db";
import { getActiveOrganizationId } from "@/lib/organization";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getAccountingConfig(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const config = await db.accountingConfig.findUnique({
            where: { organizationId },
            include: {
                salesAccount: true,
                salesVatAccount: true,
                receivablesAccount: true,
                purchasesAccount: true,
                purchasesVatAccount: true,
                payablesAccount: true,
                cashAccount: true,
                bankAccount: true,
            },
        });

        return { success: true, data: config };
    } catch (error) {
        console.error("Failed to fetch accounting config:", error);
        return { success: false, error: "Failed to fetch accounting config" };
    }
}

export async function updateAccountingConfig(data: {
    organizationId: string;
    salesAccountId?: string;
    salesVatAccountId?: string;
    receivablesAccountId?: string;
    purchasesAccountId?: string;
    purchasesVatAccountId?: string;
    payablesAccountId?: string;
    cashAccountId?: string;
    bankAccountId?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const config = await db.accountingConfig.upsert({
            where: { organizationId: data.organizationId },
            update: {
                salesAccountId: data.salesAccountId,
                salesVatAccountId: data.salesVatAccountId,
                receivablesAccountId: data.receivablesAccountId,
                purchasesAccountId: data.purchasesAccountId,
                purchasesVatAccountId: data.purchasesVatAccountId,
                payablesAccountId: data.payablesAccountId,
                cashAccountId: data.cashAccountId,
                bankAccountId: data.bankAccountId,
            },
            create: {
                organizationId: data.organizationId,
                salesAccountId: data.salesAccountId,
                salesVatAccountId: data.salesVatAccountId,
                receivablesAccountId: data.receivablesAccountId,
                purchasesAccountId: data.purchasesAccountId,
                purchasesVatAccountId: data.purchasesVatAccountId,
                payablesAccountId: data.payablesAccountId,
                cashAccountId: data.cashAccountId,
                bankAccountId: data.bankAccountId,
            },
            include: {
                salesAccount: true,
                salesVatAccount: true,
                receivablesAccount: true,
                purchasesAccount: true,
                purchasesVatAccount: true,
                payablesAccount: true,
                cashAccount: true,
                bankAccount: true,
            },
        });

        revalidatePath("/dashboard/settings/accounting");
        return { success: true, data: config };
    } catch (error) {
        console.error("Failed to update accounting config:", error);
        return { success: false, error: "Failed to update accounting config" };
    }
}
