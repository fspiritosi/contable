'use server';

import { db } from "@/lib/db";
import { ContactType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getActiveOrganizationId } from "@/lib/organization";

export async function getContacts(organizationId: string, type?: ContactType) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const contacts = await db.contact.findMany({
            where: {
                organizationId,
                ...(type ? { type } : {}),
            },
            orderBy: { name: 'asc' },
        });
        return { success: true, data: contacts };
    } catch (error) {
        console.error("Failed to fetch contacts:", error);
        return { success: false, error: "Failed to fetch contacts" };
    }
}

export async function createContact(data: {
    organizationId: string;
    name: string;
    cuit?: string;
    email?: string;
    address?: string;
    phone?: string;
    type: ContactType;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const contact = await db.contact.create({
            data: {
                organizationId: data.organizationId,
                name: data.name,
                cuit: data.cuit,
                email: data.email,
                address: data.address,
                phone: data.phone,
                type: data.type,
            },
        });

        revalidatePath("/dashboard/contacts");
        revalidatePath("/dashboard/clients");
        revalidatePath("/dashboard/vendors");
        return { success: true, data: contact };
    } catch (error) {
        console.error("Failed to create contact:", error);
        return { success: false, error: "Failed to create contact" };
    }
}

export async function updateContact(id: string, data: {
    name?: string;
    cuit?: string;
    email?: string;
    address?: string;
    phone?: string;
    type?: ContactType;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const contact = await db.contact.update({
            where: { id },
            data,
        });

        revalidatePath("/dashboard/contacts");
        revalidatePath(`/dashboard/contacts/${id}`);
        revalidatePath("/dashboard/clients");
        revalidatePath("/dashboard/vendors");
        return { success: true, data: contact };
    } catch (error) {
        console.error("Failed to update contact:", error);
        return { success: false, error: "Failed to update contact" };
    }
}

export async function deleteContact(id: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        await db.contact.delete({
            where: { id },
        });

        revalidatePath("/dashboard/contacts");
        revalidatePath("/dashboard/clients");
        revalidatePath("/dashboard/vendors");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete contact:", error);
        return { success: false, error: "Failed to delete contact" };
    }
}
