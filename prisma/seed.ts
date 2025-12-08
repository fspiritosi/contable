import "dotenv/config";
import { fakerES as faker } from "@faker-js/faker";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
    AccountType,
    ContactType,
    InvoiceFlow,
    InvoiceLetter,
    ItemScope,
    ItemType,
    PaymentMethod,
    PaymentType,
    Prisma,
    PrismaClient,
    PurchaseOrderStatus,
} from "@prisma/client";

faker.seed(42);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL no está definido. Configuralo antes de correr el seed.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
    log: ["error"],
});

const SEED_CONFIG = {
    contactsPerOrg: 90,
    productsPerOrg: 75,
    purchaseOrdersPerOrg: 55,
    salesInvoicesPerOrg: 140,
    purchaseInvoicesPerOrg: 90,
    attachmentsPerOrg: 60,
};

type AccountTemplate = {
    code: string;
    name: string;
    type: AccountType;
    parentCode?: string;
};

const accountTemplates: AccountTemplate[] = [
    { code: "1.1.00", name: "Activo Corriente", type: AccountType.ASSET },
    { code: "1.1.01", name: "Caja", type: AccountType.ASSET, parentCode: "1.1.00" },
    { code: "1.1.02", name: "Banco Nación - CTA CTE", type: AccountType.ASSET, parentCode: "1.1.00" },
    { code: "1.1.03", name: "Clientes", type: AccountType.ASSET, parentCode: "1.1.00" },
    { code: "1.2.00", name: "Créditos Fiscales", type: AccountType.ASSET },
    { code: "1.2.01", name: "IVA Crédito Fiscal", type: AccountType.ASSET, parentCode: "1.2.00" },
    { code: "2.1.00", name: "Pasivo Corriente", type: AccountType.LIABILITY },
    { code: "2.1.01", name: "Proveedores", type: AccountType.LIABILITY, parentCode: "2.1.00" },
    { code: "2.1.02", name: "IVA Débito Fiscal", type: AccountType.LIABILITY, parentCode: "2.1.00" },
    { code: "3.1.01", name: "Capital Social", type: AccountType.EQUITY },
    { code: "4.1.01", name: "Ventas", type: AccountType.INCOME },
    { code: "5.1.01", name: "Costo de Mercaderías Vendidas", type: AccountType.EXPENSE },
    { code: "5.1.02", name: "Compras", type: AccountType.EXPENSE },
];

const orgDefinitions = [
    { name: "Andes Exportaciones S.A.", city: "Mendoza" },
    { name: "Pampa Retail SRL", city: "La Plata" },
    { name: "Costa Digital SAS", city: "Mar del Plata" },
];

const shouldReset = process.argv.includes("--reset") || process.env.SEED_RESET === "true";

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2));
const randomVatRate = () => faker.helpers.arrayElement([0.105, 0.21, 0.27]);

const addDays = (date: Date, days: number) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
};

const generateCuit = () => {
    const prefix = faker.number.int({ min: 20, max: 35 }).toString().padStart(2, "0");
    const middle = faker.string.numeric({ length: 8 });
    const suffix = faker.number.int({ min: 0, max: 9 }).toString();
    return `${prefix}-${middle}-${suffix}`;
};

const resetDatabase = async () => {
    await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE
            "Attachment",
            "Payment",
            "InvoiceItem",
            "Invoice",
            "PurchaseOrderItem",
            "PurchaseOrder",
            "Product",
            "Contact",
            "TreasuryAccount",
            "AccountingConfig",
            "FiscalPeriod",
            "TransactionLine",
            "JournalEntry",
            "Account",
            "Organization",
            "User",
            "_OrganizationToUser"
        RESTART IDENTITY CASCADE;
    `);
};

const seedUsers = async () => {
    const userPayloads = [
        { firstName: "Valentina", lastName: "Gómez", email: "valentina.gomez@example.com" },
        { firstName: "Julián", lastName: "Pereyra", email: "julian.pereyra@example.com" },
        { firstName: "Carla", lastName: "Rossi", email: "carla.rossi@example.com" },
        { firstName: "Tomás", lastName: "Acosta", email: "tomas.acosta@example.com" },
    ];

    return Promise.all(
        userPayloads.map((payload) =>
            prisma.user.create({
                data: {
                    clerkId: faker.string.ulid(),
                    email: payload.email,
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                },
            }),
        ),
    );
};

const createAccountsForOrg = async (organizationId: string) => {
    const accountIds = new Map<string, string>();

    for (const template of accountTemplates) {
        const parentId = template.parentCode ? accountIds.get(template.parentCode) : undefined;

        const account = await prisma.account.create({
            data: {
                organizationId,
                code: template.code,
                name: template.name,
                type: template.type,
                parentId,
            },
        });

        accountIds.set(template.code, account.id);
    }

    return accountIds;
};

const createContacts = async (organizationId: string, count: number) => {
    const contacts = [];

    for (let index = 0; index < count; index += 1) {
        const type = index % 2 === 0 ? ContactType.CUSTOMER : ContactType.VENDOR;
        const contact = await prisma.contact.create({
            data: {
                organizationId,
                name: faker.person.fullName(),
                email: faker.internet.email().toLowerCase(),
                phone: faker.phone.number({ style: "national" }),
                address: faker.location.streetAddress({ useFullAddress: true }),
                cuit: generateCuit(),
                type,
            },
        });

        contacts.push(contact);
    }

    return contacts;
};

const createProducts = async (organizationId: string, accountIds: Map<string, string>, count: number) => {
    const products = [];

    for (let index = 0; index < count; index += 1) {
        const scope = faker.helpers.arrayElement([ItemScope.SALE, ItemScope.PURCHASE, ItemScope.BOTH]);
        const type = faker.helpers.arrayElement([ItemType.PRODUCT, ItemType.SERVICE]);
        const purchasePrice = faker.number.float({ min: 1_500, max: 90_000, multipleOf: 0.01 });
        const margin = faker.number.float({ min: 0.1, max: 0.45, multipleOf: 0.01 });
        const salePrice = purchasePrice * (1 + margin);

        const product = await prisma.product.create({
            data: {
                organizationId,
                name: faker.commerce.productName(),
                sku: `SKU-${organizationId.slice(0, 4)}-${index + 1}`,
                description: faker.commerce.productDescription(),
                type,
                scope,
                isStockable: type === ItemType.PRODUCT,
                purchasePrice: decimal(purchasePrice),
                salePrice: decimal(salePrice),
                margin: decimal(margin * 100),
                stock: decimal(faker.number.float({ min: 5, max: 250, multipleOf: 0.01 })),
                salesAccountId: accountIds.get("4.1.01"),
                purchasesAccountId: accountIds.get("5.1.02"),
            },
        });

        products.push(product);
    }

    return products;
};

const createPurchaseOrders = async (
    organizationId: string,
    vendors: { id: string; name: string }[],
    products: { id: string; name: string }[],
    count: number,
) => {
    const purchaseOrders = [];

    for (let index = 0; index < count; index += 1) {
        const contact = faker.helpers.arrayElement(vendors);
        const issueDate = faker.date.past({ years: 1 });
        const expectedDate = addDays(issueDate, faker.number.int({ min: 7, max: 45 }));
        const status = faker.helpers.arrayElement([
            PurchaseOrderStatus.DRAFT,
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.REJECTED,
        ]);

        let subtotal = 0;
        let vat = 0;

        const items = Array.from({ length: faker.number.int({ min: 2, max: 6 }) }).map(() => {
            const product = faker.helpers.arrayElement(products);
            const quantity = faker.number.float({ min: 5, max: 80, multipleOf: 0.01 });
            const unitPrice = faker.number.float({ min: 2_000, max: 120_000, multipleOf: 0.01 });
            const vatRate = randomVatRate();
            const lineNet = quantity * unitPrice;
            subtotal += lineNet;
            vat += lineNet * vatRate;

            return {
                productId: product.id,
                description: product.name,
                quantity: decimal(quantity),
                unitPrice: decimal(unitPrice),
                vatRate: decimal(vatRate * 100),
                total: decimal(lineNet * (1 + vatRate)),
            };
        });

        const purchaseOrder = await prisma.purchaseOrder.create({
            data: {
                organizationId,
                contactId: contact.id,
                status,
                issueDate,
                expectedDate,
                notes: faker.lorem.sentence(),
                subtotal: decimal(subtotal),
                vat: decimal(vat),
                total: decimal(subtotal + vat),
                approvedAt: status === PurchaseOrderStatus.APPROVED ? issueDate : undefined,
                rejectedAt: status === PurchaseOrderStatus.REJECTED ? issueDate : undefined,
                items: {
                    create: items,
                },
            },
            include: { items: true },
        });

        purchaseOrders.push(purchaseOrder);
    }

    return purchaseOrders;
};

const createJournalEntry = (
    organizationId: string,
    date: Date,
    description: string,
    lines: { accountId: string; debit?: number; credit?: number; detail?: string }[],
) =>
    prisma.journalEntry.create({
        data: {
            organizationId,
            date,
            description,
            lines: {
                create: lines.map((line) => ({
                    accountId: line.accountId,
                    debit: decimal(line.debit ?? 0),
                    credit: decimal(line.credit ?? 0),
                    description: line.detail,
                })),
            },
        },
    });

const createInvoices = async (
    organizationId: string,
    params: {
        contacts: { id: string; name: string; cuit: string | null; address: string | null }[];
        products: { id: string; name: string }[];
        accountIds: Map<string, string>;
        purchaseOrders?: {
            id: string;
            total: Prisma.Decimal;
            contactId: string;
        }[];
        count: number;
        flow: InvoiceFlow;
    },
) => {
    const invoices = [];
    const isSale = params.flow === InvoiceFlow.SALE;

    for (let index = 0; index < params.count; index += 1) {
        const contact = faker.helpers.arrayElement(params.contacts);
        const date = faker.date.recent({ days: 420 });
        const pointOfSale = faker.number.int({ min: 1, max: 5 });
        const number = index + 1;
        const letter = faker.helpers.arrayElement([InvoiceLetter.A, InvoiceLetter.B, InvoiceLetter.C]);

        let net = 0;
        let vat = 0;

        const items = Array.from({ length: faker.number.int({ min: 1, max: 5 }) }).map(() => {
            const product = faker.helpers.arrayElement(params.products);
            const quantity = faker.number.float({ min: 1, max: 30, multipleOf: 0.01 });
            const unitPrice = isSale
                ? faker.number.float({ min: 8_000, max: 180_000, multipleOf: 0.01 })
                : faker.number.float({ min: 6_000, max: 140_000, multipleOf: 0.01 });
            const vatRate = randomVatRate();
            const lineNet = quantity * unitPrice;
            net += lineNet;
            vat += lineNet * vatRate;

            return {
                productId: product.id,
                description: product.name,
                quantity: decimal(quantity),
                unitPrice: decimal(unitPrice),
                vatRate: decimal(vatRate * 100),
                total: decimal(lineNet * (1 + vatRate)),
            };
        });

        const total = net + vat;

        const journalEntry = await createJournalEntry(organizationId, date, `Factura ${letter}-${pointOfSale}-${number}`, [
            isSale
                ? { accountId: params.accountIds.get("1.1.03")!, debit: total }
                : { accountId: params.accountIds.get("5.1.02")!, debit: net },
            isSale
                ? { accountId: params.accountIds.get("4.1.01")!, credit: net }
                : { accountId: params.accountIds.get("2.1.01")!, credit: total },
            isSale
                ? { accountId: params.accountIds.get("2.1.02")!, credit: vat }
                : { accountId: params.accountIds.get("1.2.01")!, debit: vat },
        ]);

        const purchaseOrderLink =
            !isSale && params.purchaseOrders && params.purchaseOrders.length > 0 && faker.datatype.boolean({ probability: 0.45 })
                ? params.purchaseOrders.pop()
                : undefined;

        const invoice = await prisma.invoice.create({
            data: {
                organizationId,
                flow: params.flow,
                letter,
                pointOfSale,
                number,
                date,
                dueDate: addDays(date, faker.number.int({ min: 10, max: 60 })),
                contactId: contact.id,
                contactName: contact.name,
                contactCuit: contact.cuit,
                contactAddress: contact.address,
                netAmount: decimal(net),
                vatAmount: decimal(vat),
                totalAmount: decimal(total),
                journalEntryId: journalEntry.id,
                purchaseOrderId: purchaseOrderLink?.id,
                items: {
                    create: items,
                },
            },
            include: { items: true },
        });

        if (purchaseOrderLink) {
            await prisma.purchaseOrder.update({
                where: { id: purchaseOrderLink.id },
                data: {
                    invoicedAt: date,
                    invoicedAmount: decimal(total),
                    status: PurchaseOrderStatus.APPROVED,
                },
            });
        }

        invoices.push(invoice);
    }

    return invoices;
};

const createPaymentsForInvoices = async (
    organizationId: string,
    invoices: { id: string; totalAmount: Prisma.Decimal; flow: InvoiceFlow; date: Date }[],
    accountIds: Map<string, string>,
    treasuryAccounts: { id: string; type: PaymentMethod; accountId: string }[],
) => {
    let paymentsCreated = 0;

    for (const invoice of invoices) {
        const shouldPay = faker.datatype.boolean({ probability: 0.65 });
        if (!shouldPay) continue;

        const treasury = faker.helpers.arrayElement(treasuryAccounts);
        const amountNumber = Number(invoice.totalAmount);
        const fractional = faker.datatype.boolean({ probability: 0.3 })
            ? amountNumber * faker.number.float({ min: 0.4, max: 0.9, multipleOf: 0.01 })
            : amountNumber;
        const paymentDate = addDays(invoice.date, faker.number.int({ min: 1, max: 45 }));

        const journalEntry = await createJournalEntry(organizationId, paymentDate, `Pago factura ${invoice.id.slice(0, 8)}`, [
            invoice.flow === InvoiceFlow.SALE
                ? { accountId: treasury.accountId, debit: fractional }
                : { accountId: accountIds.get("2.1.01")!, debit: fractional },
            invoice.flow === InvoiceFlow.SALE
                ? { accountId: accountIds.get("1.1.03")!, credit: fractional }
                : { accountId: treasury.accountId, credit: fractional },
        ]);

        await prisma.payment.create({
            data: {
                organizationId,
                type: invoice.flow === InvoiceFlow.SALE ? PaymentType.COLLECTION : PaymentType.PAYMENT,
                method: treasury.type,
                amount: decimal(fractional),
                date: paymentDate,
                notes: invoice.flow === InvoiceFlow.SALE ? "Cobranza automática" : "Pago a proveedor",
                invoiceId: invoice.id,
                treasuryAccountId: treasury.id,
                journalEntryId: journalEntry.id,
            },
        });

        paymentsCreated += 1;
    }

    return paymentsCreated;
};

const createAttachments = async (
    organizationId: string,
    invoices: { id: string }[],
    products: { id: string }[],
    contacts: { id: string }[],
    count: number,
) => {
    for (let index = 0; index < count; index += 1) {
        const targetType = faker.helpers.arrayElement(["invoice", "product", "contact"] as const);
        const attachmentData: { invoiceId?: string; productId?: string; contactId?: string } = {};

        if (targetType === "invoice" && invoices.length > 0) {
            attachmentData.invoiceId = faker.helpers.arrayElement(invoices).id;
        } else if (targetType === "product" && products.length > 0) {
            attachmentData.productId = faker.helpers.arrayElement(products).id;
        } else if (contacts.length > 0) {
            attachmentData.contactId = faker.helpers.arrayElement(contacts).id;
        }

        await prisma.attachment.create({
            data: {
                organizationId,
                url: faker.image.urlLoremFlickr({ category: "business" }),
                key: faker.string.uuid(),
                name: faker.system.fileName(),
                fileType: "application/pdf",
                size: faker.number.int({ min: 80_000, max: 2_000_000 }),
                ...attachmentData,
            },
        });
    }
};

const seedOrganization = async (
    definition: (typeof orgDefinitions)[number],
    users: { id: string }[],
    seedIndex: number,
) => {
    const organizationUsers = faker.helpers.arrayElements(users, { min: 2, max: users.length });

    const organization = await prisma.organization.create({
        data: {
            name: definition.name,
            cuit: generateCuit(),
            address: `${faker.location.streetAddress()}, ${definition.city}`,
            clerkOrganizationId: faker.string.uuid(),
            users: {
                connect: organizationUsers.map((user) => ({ id: user.id })),
            },
        },
    });

    const accountIds = await createAccountsForOrg(organization.id);

    await prisma.accountingConfig.create({
        data: {
            organizationId: organization.id,
            salesAccountId: accountIds.get("4.1.01"),
            salesVatAccountId: accountIds.get("2.1.02"),
            receivablesAccountId: accountIds.get("1.1.03"),
            purchasesAccountId: accountIds.get("5.1.02"),
            purchasesVatAccountId: accountIds.get("1.2.01"),
            payablesAccountId: accountIds.get("2.1.01"),
            cashAccountId: accountIds.get("1.1.01"),
            bankAccountId: accountIds.get("1.1.02"),
        },
    });

    await prisma.treasuryAccount.createMany({
        data: [
            {
                organizationId: organization.id,
                name: "Caja Principal",
                type: PaymentMethod.CASH,
                currency: "ARS",
                accountId: accountIds.get("1.1.01")!,
                balance: decimal(250_000),
            },
            {
                organizationId: organization.id,
                name: "Banco Nación",
                type: PaymentMethod.BANK_TRANSFER,
                currency: "ARS",
                bankName: "Banco Nación",
                number: faker.finance.accountNumber(),
                cbu: faker.finance.accountNumber(22),
                alias: faker.word.words({ count: 2 }).replace(/\s/g, "."),
                accountId: accountIds.get("1.1.02")!,
                balance: decimal(1_200_000),
            },
        ],
    });

    await prisma.fiscalPeriod.createMany({
        data: [2023, 2024, 2025].map((year) => ({
            organizationId: organization.id,
            name: `Ejercicio ${year}`,
            startDate: new Date(year, 0, 1),
            endDate: new Date(year, 11, 31),
            isActive: year === 2024,
            isClosed: year < 2024,
        })),
    });

    const contacts = await createContacts(organization.id, SEED_CONFIG.contactsPerOrg);
    const customers = contacts.filter((contact) => contact.type === ContactType.CUSTOMER);
    const vendors = contacts.filter((contact) => contact.type === ContactType.VENDOR);

    const products = await createProducts(organization.id, accountIds, SEED_CONFIG.productsPerOrg);

    const purchaseOrders = await createPurchaseOrders(
        organization.id,
        vendors,
        products,
        SEED_CONFIG.purchaseOrdersPerOrg,
    );

    const salesInvoices = await createInvoices(organization.id, {
        contacts: customers,
        products,
        accountIds,
        count: SEED_CONFIG.salesInvoicesPerOrg,
        flow: InvoiceFlow.SALE,
    });

    const purchaseInvoices = await createInvoices(organization.id, {
        contacts: vendors,
        products,
        accountIds,
        purchaseOrders: [...purchaseOrders],
        count: SEED_CONFIG.purchaseInvoicesPerOrg,
        flow: InvoiceFlow.PURCHASE,
    });

    const treasuryAccounts = await prisma.treasuryAccount.findMany({ where: { organizationId: organization.id } });

    const paymentsCount = await createPaymentsForInvoices(
        organization.id,
        [...salesInvoices, ...purchaseInvoices],
        accountIds,
        treasuryAccounts,
    );

    await createAttachments(
        organization.id,
        [...salesInvoices, ...purchaseInvoices],
        products,
        contacts,
        SEED_CONFIG.attachmentsPerOrg,
    );

    return {
        organization: organization.name,
        contacts: contacts.length,
        products: products.length,
        purchaseOrders: purchaseOrders.length,
        invoices: salesInvoices.length + purchaseInvoices.length,
        payments: paymentsCount,
    };
};

const main = async () => {
    if (shouldReset) {
        console.log("🧹 Limpiando base de datos...");
        await resetDatabase();
    } else {
        console.log("⚠️ Seed incremental: no se eliminarán datos existentes (usa --reset o SEED_RESET=true para limpiar).");
    }

    console.log("👤 Creando usuarios base...");
    const users = await seedUsers();

    const summaries = [];

    for (let index = 0; index < orgDefinitions.length; index += 1) {
        console.log(`🏢 Sembrando organización ${index + 1}/${orgDefinitions.length}...`);
        const summary = await seedOrganization(orgDefinitions[index], users, index + 1);
        summaries.push(summary);
    }

    console.table(summaries);
    console.log("✅ Seed completado con éxito");
};

main()
    .catch((error) => {
        console.error("❌ Error al ejecutar el seed", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
