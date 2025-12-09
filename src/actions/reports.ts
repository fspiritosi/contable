'use server';

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { InvoiceLetter, PaymentType, Prisma } from "@prisma/client";

const MONTH_LABELS = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
];

type DashboardFilter = {
    month: number;
    year: number;
    trailingMonths?: number;
};

type TrendPoint = {
    bucket: string;
    label: string;
    sales: number;
    purchases: number;
};

type CashFlowPoint = {
    bucket: string;
    label: string;
    collections: number;
    payments: number;
    net: number;
};

type MixEntry = {
    letter: InvoiceLetter;
    amount: number;
    percentage: number;
};

type TopContactEntry = {
    contactId: string;
    name: string;
    total: number;
};

type OverdueInvoiceEntry = {
    id: string;
    contactId: string | null;
    contactName: string;
    invoiceNumber: string;
    dueDate: string | null;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    daysOverdue: number;
};

function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthSequence(endYear: number, endMonthIndex: number, length: number) {
    return Array.from({ length }, (_, idx) => {
        const date = new Date(endYear, endMonthIndex - (length - 1) + idx, 1);
        return {
            key: monthKey(date),
            label: `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
        };
    });
}

const AMOUNT_TOLERANCE = 0.01;

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
    value === null || value === undefined ? 0 : Number(value);

function formatInvoiceNumber(letter: InvoiceLetter, pointOfSale: number, number: number) {
    return `${letter} ${String(pointOfSale).padStart(4, '0')}-${String(number).padStart(8, '0')}`;
}

export async function getDashboardMetrics(organizationId: string, filter?: DashboardFilter) {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    try {
        const now = new Date();
        const month = filter?.month ?? now.getMonth() + 1;
        const year = filter?.year ?? now.getFullYear();
        const monthIndex = month - 1;
        const trailingMonths = filter?.trailingMonths ?? 6;

        const periodStart = new Date(year, monthIndex, 1);
        const periodEnd = new Date(year, monthIndex + 1, 1);
        const trendStart = new Date(year, monthIndex - (trailingMonths - 1), 1);
        const monthSequence = buildMonthSequence(year, monthIndex, trailingMonths);

        const totalSales = await db.invoice.aggregate({
            where: {
                organizationId,
                flow: 'SALE',
                date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { totalAmount: true, netAmount: true, vatAmount: true },
        });

        const totalPurchases = await db.invoice.aggregate({
            where: {
                organizationId,
                flow: 'PURCHASE',
                date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { totalAmount: true, netAmount: true, vatAmount: true },
        });

        const activeClients = await db.contact.count({
            where: {
                organizationId,
                type: 'CUSTOMER',
            },
        });

        const collectionsSum = await db.payment.aggregate({
            where: {
                organizationId,
                type: PaymentType.COLLECTION,
                date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { amount: true },
        });

        const paymentsSum = await db.payment.aggregate({
            where: {
                organizationId,
                type: PaymentType.PAYMENT,
                date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { amount: true },
        });

        const treasuryBalanceAggregate = await db.treasuryAccount.aggregate({
            where: { organizationId },
            _sum: { balance: true },
        });

        const invoicesForTrend = await db.invoice.findMany({
            where: {
                organizationId,
                date: { gte: trendStart, lt: periodEnd },
            },
            select: {
                date: true,
                totalAmount: true,
                flow: true,
            },
        });

        const paymentsForTrend = await db.payment.findMany({
            where: {
                organizationId,
                date: { gte: trendStart, lt: periodEnd },
            },
            select: {
                date: true,
                amount: true,
                type: true,
            },
        });

        const salesMixRaw = await db.invoice.groupBy({
            by: ['letter'],
            where: {
                organizationId,
                flow: 'SALE',
                date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { totalAmount: true },
        });

        const topCustomersRaw = await db.invoice.groupBy({
            by: ['contactId'],
            where: {
                organizationId,
                flow: 'SALE',
                contactId: { not: null },
                date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { totalAmount: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 3,
        });

        const topVendorsRaw = await db.invoice.groupBy({
            by: ['contactId'],
            where: {
                organizationId,
                flow: 'PURCHASE',
                contactId: { not: null },
                date: { gte: periodStart, lt: periodEnd },
            },
            _sum: { totalAmount: true },
            orderBy: { _sum: { totalAmount: 'desc' } },
            take: 3,
        });

        const contactIds = Array.from(new Set([
            ...topCustomersRaw.map(item => item.contactId).filter(Boolean),
            ...topVendorsRaw.map(item => item.contactId).filter(Boolean),
        ] as string[]));

        const contacts = contactIds.length
            ? await db.contact.findMany({
                  where: { id: { in: contactIds } },
                  select: { id: true, name: true },
              })
            : [];

        const contactNameMap = contacts.reduce<Record<string, string>>((acc, contact) => {
            acc[contact.id] = contact.name;
            return acc;
        }, {});

        const overdueInvoicesRaw = await db.invoice.findMany({
            where: {
                organizationId,
                flow: 'SALE',
                dueDate: { lt: new Date() },
            },
            include: {
                contact: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { dueDate: 'asc' },
        });

        const overdueInvoices: OverdueInvoiceEntry[] = overdueInvoicesRaw
            .map(invoice => {
                const totalAmount = Number(invoice.totalAmount);
                const paidAmount = toNumber(invoice.amountAllocated);
                const balance = Math.max(toNumber(invoice.amountRemaining ?? totalAmount - paidAmount), 0);
                if (balance <= AMOUNT_TOLERANCE) return null;

                const dueDate = invoice.dueDate ? invoice.dueDate.toISOString() : null;
                const daysOverdue = invoice.dueDate
                    ? Math.floor((Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
                    : 0;

                return {
                    id: invoice.id,
                    contactId: invoice.contactId || null,
                    contactName: invoice.contact?.name || 'Cliente',
                    invoiceNumber: formatInvoiceNumber(invoice.letter, invoice.pointOfSale, invoice.number),
                    dueDate,
                    totalAmount,
                    paidAmount,
                    balance,
                    daysOverdue,
                };
            })
            .filter(Boolean)
            .sort((a, b) => b!.balance - a!.balance)
            .slice(0, 5) as OverdueInvoiceEntry[];

        const salesTrendMap = new Map<string, { sales: number; purchases: number }>();
        monthSequence.forEach(({ key }) => {
            salesTrendMap.set(key, { sales: 0, purchases: 0 });
        });

        invoicesForTrend.forEach(invoice => {
            const key = monthKey(invoice.date);
            if (!salesTrendMap.has(key)) return;
            const bucket = salesTrendMap.get(key)!;
            if (invoice.flow === 'SALE') {
                bucket.sales += Number(invoice.totalAmount);
            } else {
                bucket.purchases += Number(invoice.totalAmount);
            }
        });

        const trend: TrendPoint[] = monthSequence.map(({ key, label }) => {
            const bucket = salesTrendMap.get(key) ?? { sales: 0, purchases: 0 };
            return { bucket: key, label, ...bucket };
        });

        const cashTrendMap = new Map<string, { collections: number; payments: number }>();
        monthSequence.forEach(({ key }) => {
            cashTrendMap.set(key, { collections: 0, payments: 0 });
        });

        paymentsForTrend.forEach(payment => {
            const key = monthKey(payment.date);
            if (!cashTrendMap.has(key)) return;
            const bucket = cashTrendMap.get(key)!;
            if (payment.type === PaymentType.COLLECTION) {
                bucket.collections += Number(payment.amount);
            } else if (payment.type === PaymentType.PAYMENT) {
                bucket.payments += Number(payment.amount);
            }
        });

        const cashFlowTrend: CashFlowPoint[] = monthSequence.map(({ key, label }) => {
            const bucket = cashTrendMap.get(key) ?? { collections: 0, payments: 0 };
            return {
                bucket: key,
                label,
                collections: bucket.collections,
                payments: bucket.payments,
                net: bucket.collections - bucket.payments,
            };
        });

        const totalSalesMix = salesMixRaw.reduce((sum, entry) => sum + Number(entry._sum.totalAmount || 0), 0);
        const salesMix: MixEntry[] = salesMixRaw.map(entry => {
            const amount = Number(entry._sum.totalAmount || 0);
            return {
                letter: entry.letter,
                amount,
                percentage: totalSalesMix > 0 ? amount / totalSalesMix : 0,
            };
        });

        const topCustomers: TopContactEntry[] = topCustomersRaw.map(entry => ({
            contactId: entry.contactId!,
            name: contactNameMap[entry.contactId!] || 'Cliente',
            total: Number(entry._sum.totalAmount || 0),
        }));

        const topVendors: TopContactEntry[] = topVendorsRaw.map(entry => ({
            contactId: entry.contactId!,
            name: contactNameMap[entry.contactId!] || 'Proveedor',
            total: Number(entry._sum.totalAmount || 0),
        }));

        const salesTotal = Number(totalSales._sum.totalAmount || 0);
        const purchasesTotal = Number(totalPurchases._sum.totalAmount || 0);
        const salesVat = Number(totalSales._sum.vatAmount || 0);
        const purchasesVat = Number(totalPurchases._sum.vatAmount || 0);
        const salesNet = Number(totalSales._sum.netAmount || 0);
        const purchasesNet = Number(totalPurchases._sum.netAmount || 0);
        const collectionsTotal = Number(collectionsSum._sum.amount || 0);
        const paymentsTotal = Number(paymentsSum._sum.amount || 0);
        const treasuryBalance = Number(treasuryBalanceAggregate._sum.balance || 0);

        return {
            success: true,
            data: {
                sales: salesTotal,
                purchases: purchasesTotal,
                salesNet,
                purchasesNet,
                vatSales: salesVat,
                vatPurchases: purchasesVat,
                vatBalance: salesVat - purchasesVat,
                period: { month, year },
                activeClients,
                collections: collectionsTotal,
                payments: paymentsTotal,
                treasuryBalance,
                salesTrend: trend,
                cashFlowTrend,
                salesMix,
                topCustomers,
                topVendors,
                overdueInvoices,
            }
        };
    } catch (error) {
        console.error("Failed to fetch metrics:", error);
        return { success: false, error: "Failed to fetch metrics" };
    }
}
