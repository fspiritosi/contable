'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

export async function getProductMovements(productId: string) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        // Get product info
        const product = await db.product.findUnique({
            where: { id: productId },
        });

        if (!product) {
            return { success: false, error: "Product not found" };
        }

        // Get all invoice items for this product
        const invoiceItems = await db.invoiceItem.findMany({
            where: { productId },
            include: {
                invoice: {
                    include: {
                        contact: true,
                    },
                },
            },
            orderBy: {
                invoice: {
                    date: 'asc',
                },
            },
        });

        // Calculate running stock balance
        let runningStock = 0;
        const movements = invoiceItems.map(item => {
            const quantity = Number(item.quantity);
            const movement = item.invoice.flow === 'SALE' ? -quantity : quantity;
            runningStock += movement;

            return {
                id: item.id,
                date: item.invoice.date,
                type: item.invoice.flow,
                quantity: quantity,
                movement: movement,
                runningStock: runningStock,
                invoice: {
                    id: item.invoice.id,
                    flow: item.invoice.flow,
                    letter: item.invoice.letter,
                    pointOfSale: item.invoice.pointOfSale,
                    number: item.invoice.number,
                    contact: item.invoice.contact,
                },
                unitPrice: Number(item.unitPrice),
            };
        });

        return {
            success: true,
            data: {
                product: {
                    ...product,
                    stock: Number(product.stock),
                    purchasePrice: Number(product.purchasePrice),
                    salePrice: Number(product.salePrice),
                    margin: Number(product.margin),
                },
                movements,
            },
        };
    } catch (error) {
        console.error("Failed to fetch product movements:", error);
        return { success: false, error: "Failed to fetch product movements" };
    }
}
