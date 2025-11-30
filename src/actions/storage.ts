'use server';

import { getPresignedUploadUrl, deleteFile, getPublicUrl } from "@/lib/storage";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getUploadUrl(filename: string, contentType: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Generate a unique key
        const timestamp = Date.now();
        const key = `${userId}/${timestamp}-${filename}`;

        const url = await getPresignedUploadUrl(key, contentType);

        return { success: true, url, key };
    } catch (error) {
        console.error("Failed to get upload URL:", error);
        return { success: false, error: "Failed to get upload URL" };
    }
}

export async function saveAttachment(data: {
    organizationId: string;
    url: string;
    name: string;
    fileType: string;
    size: number;
    key: string;
    // Optional relations
    invoiceId?: string;
    paymentId?: string;
    contactId?: string;
    productId?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const publicUrl = getPublicUrl(data.key);

        const attachment = await db.attachment.create({
            data: {
                organizationId: data.organizationId,
                url: publicUrl, // Use generated public URL
                key: data.key,
                name: data.name,
                fileType: data.fileType,
                size: data.size,
                invoiceId: data.invoiceId,
                paymentId: data.paymentId,
                contactId: data.contactId,
                productId: data.productId,
            },
        });

        return { success: true, data: attachment };
    } catch (error) {
        console.error("Failed to save attachment:", error);
        return { success: false, error: "Failed to save attachment" };
    }
}

export async function deleteAttachment(id: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const attachment = await db.attachment.findUnique({
            where: { id },
        });

        if (!attachment) {
            return { success: false, error: "Attachment not found" };
        }

        // Delete from R2
        if (attachment.key) {
            await deleteFile(attachment.key);
        }

        // Delete from DB
        await db.attachment.delete({
            where: { id },
        });

        return { success: true };
    } catch (error) {
        console.error("Failed to delete attachment:", error);
        return { success: false, error: "Failed to delete attachment" };
    }
}
