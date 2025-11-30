'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getOrganizations() {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            include: {
                organizations: {
                    include: {
                        attachments: true,
                    }
                }
            },
        });

        return { success: true, data: user?.organizations || [] };
    } catch (error) {
        console.error("Failed to fetch organizations:", error);
        return { success: false, error: "Failed to fetch organizations" };
    }
}

export async function createOrganization(data: {
    name: string;
    cuit: string;
    address?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Ensure user exists in DB (sync with Clerk if needed, though usually done via webhook or middleware)
        // For this MVP, we assume user record exists or we find it by clerkId.
        let user = await db.user.findUnique({ where: { clerkId: userId } });

        if (!user) {
            // Create user on the fly if not exists (simple sync)
            const clerkUser = await (await import("@clerk/nextjs/server")).currentUser();
            if (clerkUser) {
                user = await db.user.create({
                    data: {
                        clerkId: userId,
                        email: clerkUser.emailAddresses[0].emailAddress,
                        firstName: clerkUser.firstName,
                        lastName: clerkUser.lastName,
                    }
                });
            } else {
                throw new Error("User not found");
            }
        }

        const organization = await db.organization.create({
            data: {
                name: data.name,
                cuit: data.cuit,
                address: data.address,
                users: {
                    connect: { id: user.id },
                },
            },
        });

        revalidatePath("/dashboard/settings");
        return { success: true, data: organization };
    } catch (error) {
        console.error("Failed to create organization:", error);
        return { success: false, error: "Failed to create organization" };
    }
}

export async function updateOrganization(id: string, data: {
    name?: string;
    cuit?: string;
    address?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Verify user has access to this organization
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            include: { organizations: true },
        });

        if (!user?.organizations.some(org => org.id === id)) {
            return { success: false, error: "Unauthorized" };
        }

        const organization = await db.organization.update({
            where: { id },
            data,
        });

        revalidatePath('/dashboard/settings');
        revalidatePath('/dashboard/settings/organization');

        return { success: true, data: organization };
    } catch (error) {
        console.error("Failed to update organization:", error);
        return { success: false, error: "Failed to update organization" };
    }
}

export async function getOrganizationMetrics(organizationId: string) {
    try {
        // Get counts and totals
        const [
            contactsCount,
            productsCount,
            invoicesData,
            paymentsData,
            journalEntriesCount
        ] = await Promise.all([
            db.contact.count({ where: { organizationId } }),
            db.product.count({ where: { organizationId } }),
            db.invoice.aggregate({
                where: { organizationId },
                _count: true,
                _sum: { totalAmount: true },
            }),
            db.payment.aggregate({
                where: { organizationId },
                _count: true,
                _sum: { amount: true },
            }),
            db.journalEntry.count({ where: { organizationId } }),
        ]);

        // Calculate sales and purchases
        const salesTotal = await db.invoice.aggregate({
            where: { organizationId, flow: 'SALE' },
            _sum: { totalAmount: true },
            _count: true,
        });

        const purchasesTotal = await db.invoice.aggregate({
            where: { organizationId, flow: 'PURCHASE' },
            _sum: { totalAmount: true },
            _count: true,
        });

        return {
            success: true,
            data: {
                contacts: contactsCount,
                products: productsCount,
                invoices: invoicesData._count,
                totalInvoiced: Number(invoicesData._sum.totalAmount || 0),
                sales: {
                    count: salesTotal._count,
                    total: Number(salesTotal._sum.totalAmount || 0),
                },
                purchases: {
                    count: purchasesTotal._count,
                    total: Number(purchasesTotal._sum.totalAmount || 0),
                },
                payments: paymentsData._count,
                totalPayments: Number(paymentsData._sum.amount || 0),
                journalEntries: journalEntriesCount,
            }
        };
    } catch (error) {
        console.error("Failed to get organization metrics:", error);
        return { success: false, error: "Failed to get metrics" };
    }
}
