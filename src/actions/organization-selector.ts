'use server';

import { setActiveOrganization } from "@/lib/organization";
import { revalidatePath } from "next/cache";

export async function switchOrganization(organizationId: string) {
    try {
        await setActiveOrganization(organizationId);

        // Revalidate all dashboard pages
        revalidatePath('/dashboard', 'layout');

        return { success: true };
    } catch (error) {
        console.error("Failed to switch organization:", error);
        return { success: false, error: "Failed to switch organization" };
    }
}
