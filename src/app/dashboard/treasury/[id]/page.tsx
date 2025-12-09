import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveOrganizationId } from "@/lib/organization";
import { getTreasuryAccountDetail } from "@/actions/treasury";
import { getTreasuryAccountMovements } from "@/actions/payments";
import { getAccounts } from "@/actions/accounts";
import { formatCurrency } from "@/lib/utils";
import TreasuryMovementsSection from "./treasury-movements";

export default async function TreasuryAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentOrgId = await getActiveOrganizationId();
  const [accountRes, movementsRes, accountsRes] = await Promise.all([
    getTreasuryAccountDetail(id, currentOrgId),
    getTreasuryAccountMovements(id),
    getAccounts(),
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
      />
    </div>
  );
}
