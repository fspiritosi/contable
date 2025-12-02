'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";

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
                        users: true,
                    }
                }
            },
        });

        return { success: true, data: user?.organizations || [] };
    } catch (error) {
        console.error("Failed to fetch organizations:", error);
        return { success: false, error: "Failed to fetch organizations", data: [] };
    }
}

export async function inviteUserToOrganization(params: {
    organizationId: string;
    email: string;
    role?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    console.log("[inviteUserToOrganization] CLERK_SECRET_KEY", process.env.CLERK_SECRET_KEY);

    const organization = await db.organization.findUnique({
        where: { id: params.organizationId },
        select: { clerkOrganizationId: true, name: true },
    });

    if (!organization?.clerkOrganizationId) {
        return {
            success: false,
            error: "La organización no está vinculada con Clerk. Configurá el clerkOrganizationId antes de invitar usuarios.",
        };
    }

    const clerk = await clerkClient();

    console.log("[inviteUserToOrganization] Attempt", {
        clerkOrganizationId: organization.clerkOrganizationId,
        localOrganizationId: params.organizationId,
        organizationName: organization.name,
        inviterUserId: userId,
        email: params.email,
        role: params.role || "basic_member",
    });

    try {
        await clerk.organizations.createOrganizationInvitation({
            organizationId: organization.clerkOrganizationId,
            inviterUserId: userId,
            emailAddress: params.email,
            role: params.role || "basic_member",
        });
    } catch (error) {
        const clerkError =
            typeof error === "object" && error !== null && "errors" in error
                ? (error as { errors?: Array<{ message?: string; code?: string; long_message?: string }> }).errors
                : undefined;

        console.error("[inviteUserToOrganization] Clerk invitation failed", {
            clerkOrganizationId: organization.clerkOrganizationId,
            inviterUserId: userId,
            email: params.email,
            rawError: error,
            clerkError,
        });

        return {
            success: false,
            error: "No se pudo crear la invitación en Clerk. Verificá que el ID de la organización y el usuario invitador existan.",
        };
    }

    return { success: true };
}

export async function listOrganizationInvitations(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const user = await db.user.findUnique({
            where: { clerkId: userId },
            include: { organizations: { select: { id: true } } },
        });

        if (!user?.organizations.some(org => org.id === organizationId)) {
            return { success: false, error: "Unauthorized", data: [] };
        }

        const organization = await db.organization.findUnique({
            where: { id: organizationId },
            select: { clerkOrganizationId: true },
        });

        if (!organization?.clerkOrganizationId) {
            return { success: false, error: "La organización no está vinculada con Clerk", data: [] };
        }

        const clerk = await clerkClient();
        const invitations = await clerk.organizations.getOrganizationInvitationList({
            organizationId: organization.clerkOrganizationId,
        });

        const pending = invitations.data?.map((invite): {
            id: string;
            emailAddress: string;
            role: string;
            status: string;
            createdAt: string;
            expiresAt: string | null;
        } => ({
            id: invite.id,
            emailAddress: invite.emailAddress,
            role: invite.role,
            status: invite.status ?? "pending",
            createdAt: new Date(invite.createdAt).toISOString(),
            expiresAt: invite.expiresAt ? new Date(invite.expiresAt).toISOString() : null,
        })) || [];

        return { success: true, data: pending };
    } catch (error) {
        console.error("Failed to list invitations:", error);
        return { success: false, error: "No se pudieron obtener las invitaciones", data: [] };
    }
}

export async function syncUserOrganizationMembership(params: {
    clerkOrganizationId: string;
    clerkUserId: string;
}) {
    const organization = await db.organization.findFirst({
        where: { clerkOrganizationId: params.clerkOrganizationId },
    });

    if (!organization) {
        console.warn("Organization not found for Clerk organization", params.clerkOrganizationId);
        return { success: false, error: "Organization not found" };
    }

    let user = await db.user.findUnique({ where: { clerkId: params.clerkUserId } });

    if (!user) {
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(params.clerkUserId);
        const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;

        if (!primaryEmail) {
            throw new Error("Clerk user missing email address");
        }

        user = await db.user.create({
            data: {
                clerkId: params.clerkUserId,
                email: primaryEmail,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
            },
        });
    }

    await db.organization.update({
        where: { id: organization.id },
        data: {
            users: {
                connect: { id: user.id },
            },
        },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return { success: true };
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

        revalidatePath("/dashboard");
        revalidatePath("/dashboard/settings");
        return { success: true, data: organization };
    } catch (error) {
        console.error("Failed to create organization:", error);

        let message = "No se pudo crear la organización";
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            message = "Ya existe una organización registrada con ese CUIT";
        }

        return { success: false, error: message };
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
