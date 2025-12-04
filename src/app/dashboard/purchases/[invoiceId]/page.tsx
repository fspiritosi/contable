import { notFound } from "next/navigation";
import { getInvoiceDetail } from "@/actions/invoices";
import { getTreasuryAccounts } from "@/actions/treasury";
import { getActiveOrganizationId } from "@/lib/organization";
import InvoiceDetailView from "../../invoices/invoice-detail-view";

export default async function PurchaseInvoiceDetailPage({
    params,
}: {
    params: Promise<{ invoiceId: string }>;
}) {
    const { invoiceId } = await params;
    const organizationId = await getActiveOrganizationId();

    const [invoiceRes, treasuryRes] = await Promise.all([
        getInvoiceDetail(organizationId, invoiceId),
        getTreasuryAccounts(organizationId),
    ]);

    if (!invoiceRes.success || !invoiceRes.data) {
        notFound();
    }

    const invoice = invoiceRes.data;

    if (invoice.flow !== "PURCHASE") {
        notFound();
    }

    const treasuryAccounts = treasuryRes.success && treasuryRes.data ? treasuryRes.data : [];

    return (
        <InvoiceDetailView
            invoice={invoice}
            organizationId={organizationId}
            treasuryAccounts={treasuryAccounts}
            backHref="/dashboard/purchases"
        />
    );
}
