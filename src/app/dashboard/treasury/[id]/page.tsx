import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveOrganizationId } from "@/lib/organization";
import { getTreasuryAccountDetail } from "@/actions/treasury";
import { getTreasuryAccountMovements } from "@/actions/payments";
import { getAccounts } from "@/actions/accounts";
import { getContacts } from "@/actions/contacts";
import { getInvoices } from "@/actions/invoices";
import { formatCurrency } from "@/lib/utils";
import TreasuryMovementsSection from "./treasury-movements";

export default async function TreasuryAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentOrgId = await getActiveOrganizationId();
  const [accountRes, movementsRes, accountsRes, contactsRes, invoicesRes] = await Promise.all([
    getTreasuryAccountDetail(id, currentOrgId),
    getTreasuryAccountMovements(id),
    getAccounts(),
    getContacts(currentOrgId),
    getInvoices(currentOrgId),
  ]);

  if (!accountRes.success || !accountRes.data) {
    notFound();
  }

  const account = accountRes.data;
  const movements = movementsRes.success && movementsRes.data ? movementsRes.data : [];
  const chartOfAccounts = (accountsRes.success && accountsRes.data ? accountsRes.data : []).map((acc: any) => ({
    id: acc.id,
    code: acc.code,
    name: acc.name,
    type: acc.type,
  }));
  const contacts = (contactsRes.success && contactsRes.data ? contactsRes.data : []).map((contact: any) => ({
    id: contact.id,
    name: contact.name,
    type: contact.type,
  }));

  /**
   * Normalize server data to be client-safe. Ensures dates and decimals are serializable.
   */
  const serializedMovements = movements.map((movement: any) => ({
    id: movement.id,
    date: movement.date instanceof Date ? movement.date.toISOString() : movement.date,
    type: movement.type,
    method: movement.method,
    reference: movement.reference,
    amount: Number(movement.amount),
    amountAllocated: Number(movement.amountAllocated ?? 0),
    amountRemaining: Number(movement.amountRemaining ?? Math.max(Number(movement.amount) - Number(movement.amountAllocated ?? 0), 0)),
    allocations: (movement.allocations || []).map((allocation: any) => ({
      id: allocation.id,
      invoiceId: allocation.invoiceId,
      amount: Number(allocation.amount),
      invoice: allocation.invoice
        ? {
            id: allocation.invoice.id,
            letter: allocation.invoice.letter,
            pointOfSale: Number(allocation.invoice.pointOfSale),
            number: Number(allocation.invoice.number),
            contactName: allocation.invoice.contact?.name ?? null,
          }
        : null,
    })),
    invoice: movement.invoice
      ? {
          id: movement.invoice.id,
          flow: movement.invoice.flow,
          letter: movement.invoice.letter,
          pointOfSale: Number(movement.invoice.pointOfSale),
          number: Number(movement.invoice.number),
          contactName: movement.invoice.contact?.name ?? null,
        }
      : null,
    contact: movement.contact
      ? {
          id: movement.contact.id,
          name: movement.contact.name,
          type: movement.contact.type,
        }
      : null,
    contactId: movement.contactId || movement.contact?.id || movement.invoice?.contact?.id || null,
    contactName: movement.contactName ?? movement.contact?.name ?? movement.invoice?.contactName ?? null,
  }));

  let runningBalance = Number(account.balance);
  const movementsWithBalance = serializedMovements.map((movement) => {
    const currentBalance = runningBalance;
    const delta = movement.type === "PAYMENT" ? -movement.amount : movement.amount;
    runningBalance = runningBalance - delta;
    return { ...movement, runningBalance: currentBalance };
  });

  const accountInfo = {
    currency: account.currency,
    bankName: account.bankName ?? null,
    number: account.number ?? null,
    cbu: account.cbu ?? null,
    alias: account.alias ?? null,
    accountCode: account.account?.code ?? null,
    type: account.type,
  };

  const reconcilableInvoices = (invoicesRes.success && invoicesRes.data ? invoicesRes.data : []).map((invoice: any) => ({
    id: invoice.id,
    flow: invoice.flow,
    letter: invoice.letter,
    pointOfSale: Number(invoice.pointOfSale),
    number: Number(invoice.number),
    date: typeof invoice.date === "string" ? invoice.date : invoice.date?.toISOString() ?? null,
    dueDate: invoice.dueDate,
    totalAmount: Number(invoice.totalAmount),
    amountAllocated: Number(invoice.amountAllocated ?? invoice.paidAmount ?? 0),
    amountRemaining: Number(invoice.amountRemaining ?? invoice.balance ?? Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount ?? 0), 0)),
    paymentStatus: invoice.paymentStatus,
    contactId: invoice.contactId ?? null,
    contactName: invoice.contact?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/dashboard/treasury" className="hover:underline">
              Tesorería
            </Link>
            <span>/</span>
            <span>Detalle de Caja</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 mt-2">
            {account.name}
          </h1>
          <p className="text-gray-500">
            {account.type === "CASH" ? "Caja" : "Cuenta Bancaria"} · {account.currency}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Saldo actual</p>
          <p
            className={`text-3xl font-semibold ${account.balance >= 0 ? "text-green-600" : "text-red-600"}`}
          >
            {formatCurrency(Number(account.balance))}
          </p>
        </div>
      </div>

      <TreasuryMovementsSection
        movements={movementsWithBalance}
        accountInfo={accountInfo}
        hasMovements={movementsWithBalance.length > 0}
        accountType={account.type}
        chartOfAccounts={chartOfAccounts}
        treasuryAccountId={account.id}
        contacts={contacts}
        invoices={reconcilableInvoices}
        organizationId={currentOrgId}
      />
    </div>
  );
}
