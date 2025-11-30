'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getActiveOrganizationId } from "@/lib/organization";

export async function getFiscalPeriods(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const periods = await db.fiscalPeriod.findMany({
            where: { organizationId },
            orderBy: { startDate: 'desc' },
        });

        return { success: true, data: periods };
    } catch (error) {
        console.error("Failed to fetch fiscal periods:", error);
        return { success: false, error: "Failed to fetch fiscal periods" };
    }
}

export async function createFiscalPeriod(data: {
    organizationId: string;
    name: string;
    startDate: Date;
    endDate: Date;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Validate dates
        if (data.startDate >= data.endDate) {
            return { success: false, error: "La fecha de inicio debe ser anterior a la fecha de fin" };
        }

        // Check for overlapping periods
        const overlapping = await db.fiscalPeriod.findFirst({
            where: {
                organizationId: data.organizationId,
                OR: [
                    {
                        AND: [
                            { startDate: { lte: data.startDate } },
                            { endDate: { gte: data.startDate } },
                        ]
                    },
                    {
                        AND: [
                            { startDate: { lte: data.endDate } },
                            { endDate: { gte: data.endDate } },
                        ]
                    },
                    {
                        AND: [
                            { startDate: { gte: data.startDate } },
                            { endDate: { lte: data.endDate } },
                        ]
                    }
                ]
            }
        });

        if (overlapping) {
            return {
                success: false,
                error: `El período se superpone con "${overlapping.name}"`
            };
        }

        const period = await db.fiscalPeriod.create({
            data: {
                ...data,
                isActive: false,
                isClosed: false,
            },
        });

        revalidatePath("/dashboard/settings/fiscal-periods");
        return { success: true, data: period };
    } catch (error) {
        console.error("Failed to create fiscal period:", error);
        return { success: false, error: "Failed to create fiscal period" };
    }
}

export async function setActivePeriod(organizationId: string, periodId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Deactivate all periods for this organization
        await db.fiscalPeriod.updateMany({
            where: { organizationId },
            data: { isActive: false },
        });

        // Activate the selected period
        const period = await db.fiscalPeriod.update({
            where: { id: periodId },
            data: { isActive: true },
        });

        revalidatePath("/dashboard/settings/fiscal-periods");
        revalidatePath("/dashboard/accounting/journal");
        return { success: true, data: period };
    } catch (error) {
        console.error("Failed to set active period:", error);
        return { success: false, error: "Failed to set active period" };
    }
}

export async function closeFiscalPeriod(periodId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const period = await db.fiscalPeriod.update({
            where: { id: periodId },
            data: {
                isClosed: true,
                isActive: false, // Closed periods can't be active
            },
        });

        revalidatePath("/dashboard/settings/fiscal-periods");
        return { success: true, data: period };
    } catch (error) {
        console.error("Failed to close fiscal period:", error);
        return { success: false, error: "Failed to close fiscal period" };
    }
}

export async function getActiveFiscalPeriod(organizationId: string) {
    try {
        const period = await db.fiscalPeriod.findFirst({
            where: {
                organizationId,
                isActive: true,
            },
        });

        return { success: true, data: period };
    } catch (error) {
        console.error("Failed to get active fiscal period:", error);
        return { success: false, error: "Failed to get active fiscal period" };
    }
}
