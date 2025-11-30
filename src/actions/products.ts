'use server';

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { ItemType, ItemScope } from "@prisma/client";
import { getActiveOrganizationId } from "@/lib/organization";

export type SerializedProduct = {
    id: string;
    organizationId: string;
    name: string;
    sku: string | null;
    description: string | null;
    stock: number;
    type: ItemType;
    scope: ItemScope;
    isStockable: boolean;
    purchasePrice: number;
    salePrice: number;
    margin: number;
    salesAccountId: string | null;
    purchasesAccountId: string | null;
    attachments: any[];
    createdAt: Date;
    updatedAt: Date;
};

export async function getProducts(organizationId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const products = await db.product.findMany({
            where: { organizationId },
            orderBy: { name: 'asc' },
            include: {
                attachments: true,
            }
        });

        // Serialize decimals
        const serializedProducts: SerializedProduct[] = products.map(p => ({
            ...p,
            stock: Number(p.stock),
            purchasePrice: Number(p.purchasePrice),
            salePrice: Number(p.salePrice),
            margin: Number(p.margin),
        }));

        return { success: true, data: serializedProducts };
    } catch (error) {
        console.error("Failed to fetch products:", error);
        return { success: false, error: "Failed to fetch products" };
    }
}

export async function createProduct(data: {
    organizationId: string;
    name: string;
    sku?: string;
    description?: string;
    stock: number;
    type: ItemType;
    scope: ItemScope;
    isStockable: boolean;
    purchasePrice: number;
    salePrice: number;
    margin: number;
    salesAccountId?: string;
    purchasesAccountId?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const product = await db.product.create({
            data: {
                organizationId: data.organizationId,
                name: data.name,
                sku: data.sku,
                description: data.description,
                stock: data.stock,
                type: data.type,
                scope: data.scope,
                isStockable: data.isStockable,
                purchasePrice: data.purchasePrice,
                salePrice: data.salePrice,
                margin: data.margin,
                salesAccountId: data.salesAccountId,
                purchasesAccountId: data.purchasesAccountId,
            },
            include: {
                attachments: true,
            }
        });

        revalidatePath("/dashboard/inventory");

        const serializedProduct = {
            ...product,
            stock: Number(product.stock),
            purchasePrice: Number(product.purchasePrice),
            salePrice: Number(product.salePrice),
            margin: Number(product.margin),
        };

        return { success: true, data: serializedProduct };
    } catch (error) {
        console.error("Failed to create product:", error);
        return { success: false, error: "Failed to create product" };
    }
}

export async function updateProduct(id: string, data: {
    name?: string;
    sku?: string;
    description?: string;
    stock?: number;
    type?: ItemType;
    scope?: ItemScope;
    isStockable?: boolean;
    purchasePrice?: number;
    salePrice?: number;
    margin?: number;
    salesAccountId?: string;
    purchasesAccountId?: string;
}) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const updateData: any = { ...data };

        const product = await db.product.update({
            where: { id },
            data: updateData,
            include: {
                attachments: true,
            }
        });

        revalidatePath("/dashboard/inventory");

        const serializedProduct = {
            ...product,
            stock: Number(product.stock),
            purchasePrice: Number(product.purchasePrice),
            salePrice: Number(product.salePrice),
            margin: Number(product.margin),
        };

        return { success: true, data: serializedProduct };
    } catch (error) {
        console.error("Failed to update product:", error);
        return { success: false, error: "Failed to update product" };
    }
}

export async function deleteProduct(id: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        await db.product.delete({
            where: { id },
        });

        revalidatePath("/dashboard/inventory");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete product:", error);
        return { success: false, error: "Failed to delete product" };
    }
}
