'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { getActiveOrganizationId } from "@/lib/organization";

export async function getDashboardMetrics(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Basic metrics for now
        const totalSales = await db.invoice.aggregate({
            where: { organizationId, flow: 'SALE' },
            _sum: { totalAmount: true },
        });

        const totalPurchases = await db.invoice.aggregate({
            where: { organizationId, flow: 'PURCHASE' },
            _sum: { totalAmount: true },
        });

        const totalReceivables = await db.invoice.aggregate({
            where: { organizationId, flow: 'SALE' }, // Simplified: Total Sales - Payments logic needed for real receivables
            _sum: { totalAmount: true },
        });

        // This is very basic. Real reporting needs date filtering and more complex queries.
        // For this iteration, we return totals.

        return {
            success: true,
            data: {
                sales: Number(totalSales._sum.totalAmount || 0),
                purchases: Number(totalPurchases._sum.totalAmount || 0),
            }
        };
    } catch (error) {
        console.error("Failed to fetch metrics:", error);
        return { success: false, error: "Failed to fetch metrics" };
    }
}
