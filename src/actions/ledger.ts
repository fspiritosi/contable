'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { getActiveOrganizationId } from "@/lib/organization";
import { AccountType } from "@prisma/client";

export type LedgerAccount = {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    parentId: string | null;
    debit: number;
    credit: number;
    balance: number;
};

export async function getGeneralLedger() {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const organizationId = await getActiveOrganizationId();

        // Get all accounts with their transaction lines
        const accounts = await db.account.findMany({
            where: { organizationId },
            include: {
                transactionLines: {
                    select: {
                        debit: true,
                        credit: true,
                    },
                },
            },
            orderBy: { code: 'asc' },
        });

        // Calculate balances for each account
        const ledgerAccounts: LedgerAccount[] = accounts.map(account => {
            // Sum all debits and credits
            const totalDebit = account.transactionLines.reduce(
                (sum, line) => sum + Number(line.debit),
                0
            );
            const totalCredit = account.transactionLines.reduce(
                (sum, line) => sum + Number(line.credit),
                0
            );

            // Calculate balance based on account type
            // For ASSET and EXPENSE: Debit increases, Credit decreases
            // For LIABILITY, EQUITY, and INCOME: Credit increases, Debit decreases
            let balance = 0;
            if (account.type === 'ASSET' || account.type === 'EXPENSE') {
                balance = totalDebit - totalCredit;
            } else {
                balance = totalCredit - totalDebit;
            }

            return {
                id: account.id,
                code: account.code,
                name: account.name,
                type: account.type,
                parentId: account.parentId,
                debit: totalDebit,
                credit: totalCredit,
                balance: balance,
            };
        });

        // Calculate totals
        const totals = {
            debit: ledgerAccounts.reduce((sum, acc) => sum + acc.debit, 0),
            credit: ledgerAccounts.reduce((sum, acc) => sum + acc.credit, 0),
        };

        return {
            success: true,
            data: {
                accounts: ledgerAccounts,
                totals,
            },
        };
    } catch (error) {
        console.error("Failed to fetch general ledger:", error);
        return { success: false, error: "Failed to fetch general ledger" };
    }
}
