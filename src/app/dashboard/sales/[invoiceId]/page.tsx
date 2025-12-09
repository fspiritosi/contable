import { notFound } from "next/navigation";
import { getInvoiceDetail } from "@/actions/invoices";
import { getTreasuryAccounts } from "@/actions/treasury";
import { getRetentionSettings } from "@/actions/retentions";
import { getActiveOrganizationId } from "@/lib/organization";
import InvoiceDetailView from "../../invoices/invoice-detail-view";

export default async function SalesInvoiceDetailPage({
    params,
}: {
    params: Promise<{ invoiceId: string }>;
}) {
    const { invoiceId } = await params;
    const organizationId = await getActiveOrganizationId();

    const [invoiceRes, treasuryRes, retentionSettingsRes] = await Promise.all([
        getInvoiceDetail(organizationId, invoiceId),
        getTreasuryAccounts(organizationId),
        getRetentionSettings(organizationId),
    ]);

    if (!invoiceRes.success || !invoiceRes.data) {
        notFound();
    }

    const invoice = invoiceRes.data;

    if (invoice.flow !== "SALE") {
        notFound();
    }

    const treasuryAccounts = treasuryRes.success && treasuryRes.data ? treasuryRes.data : [];
    const retentionSettings = retentionSettingsRes.success && retentionSettingsRes.data ? retentionSettingsRes.data : [];

    return (
        <InvoiceDetailView
            invoice={invoice}
            organizationId={organizationId}
            treasuryAccounts={treasuryAccounts}
            backHref="/dashboard/sales"
            retentionSettings={retentionSettings}
        />
    );
}
