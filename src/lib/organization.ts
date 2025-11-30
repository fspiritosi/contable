import { cookies } from 'next/headers';
import { db } from './db';
import { auth } from '@clerk/nextjs/server';

const ACTIVE_ORG_COOKIE = 'active-organization-id';

export async function getActiveOrganizationId(): Promise<string> {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get user with organizations
    const user = await db.user.findUnique({
        where: { clerkId: userId },
        include: { organizations: true },
    });

    if (!user || user.organizations.length === 0) {
        // Create default org if none exists
        if (user) {
            const newOrg = await db.organization.create({
                data: {
                    name: "Mi Empresa S.A.",
                    cuit: "30-00000000-0",
                    users: { connect: { id: user.id } }
                }
            });
            return newOrg.id;
        }
        throw new Error("No organization found");
    }

    // Try to get from cookie
    const cookieStore = await cookies();
    const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

    // Validate that user has access to this org
    if (activeOrgId && user.organizations.some(org => org.id === activeOrgId)) {
        return activeOrgId;
    }

    // Default to first organization
    return user.organizations[0].id;
}

export async function setActiveOrganization(organizationId: string) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
    });
}
