import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import {currencyFormatter, percentFormatter, numberFormatter } from "@/lib/const";
import { InvoiceLetter } from "@prisma/client";


export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatCurrency(value: number) {
    return currencyFormatter.format(value || 0);
}

export function formatPercent(value: number) {
    if (!isFinite(value)) return "0%";
    return percentFormatter.format(value);
}

export function formatNumber(value: number) {
    return numberFormatter.format(value || 0);
}

export function formatDate(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function formatInvoiceNumber(letter: InvoiceLetter, pointOfSale: number, number: number) {
    return `${letter} ${String(pointOfSale).padStart(4, '0')}-${String(number).padStart(8, '0')}`;
}