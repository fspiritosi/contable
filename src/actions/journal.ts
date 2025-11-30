'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getActiveOrganizationId } from "@/lib/organization";

export async function getJournalEntries() {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const organizationId = await getActiveOrganizationId();
        const entries = await db.journalEntry.findMany({
            where: { organizationId },
            include: {
                lines: {
                    include: {
                        account: true,
                    },
                },
            },
            orderBy: { date: 'desc' },
        });

        // Convert Decimal to number for client components
        const serializedEntries = entries.map(entry => ({
            ...entry,
            lines: entry.lines.map(line => ({
                ...line,
                debit: Number(line.debit),
                credit: Number(line.credit),
            })),
        }));

        return { success: true, data: serializedEntries };
    } catch (error) {
        console.error("Failed to fetch journal entries:", error);
        return { success: false, error: "Failed to fetch journal entries" };
    }
}

export async function createJournalEntry(data: {
    date: Date;
    description: string;
    lines: {
        accountId: string;
        debit: number;
        credit: number;
        description?: string;
    }[];
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const organizationId = await getActiveOrganizationId();

        // Validate balance
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return { success: false, error: "El asiento no balancea (Debe != Haber)" };
        }

        const entry = await db.journalEntry.create({
            data: {
                date: data.date,
                description: data.description,
                organizationId,
                lines: {
                    create: data.lines.map(line => ({
                        accountId: line.accountId,
                        debit: line.debit,
                        credit: line.credit,
                        description: line.description,
                    })),
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

        revalidatePath("/dashboard/accounting/journal");

        // Convert Decimal to number for client components
        return {
            success: true,
            data: {
                ...entry,
                lines: entry.lines.map(line => ({
                    ...line,
                    debit: Number(line.debit),
                    credit: Number(line.credit),
                })),
            }
        };
    } catch (error) {
        console.error("Failed to create journal entry:", error);
        return { success: false, error: "Failed to create journal entry" };
    }
}
