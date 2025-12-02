import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveOrganizationId } from "@/lib/organization";
import { getTreasuryAccountDetail } from "@/actions/treasury";
import { getTreasuryAccountMovements } from "@/actions/payments";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function TreasuryAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentOrgId = await getActiveOrganizationId();
  const [accountRes, movementsRes] = await Promise.all([
    getTreasuryAccountDetail(id, currentOrgId),
    getTreasuryAccountMovements(id),
  ]);

  if (!accountRes.success || !accountRes.data) {
    notFound();
  }

  const account = accountRes.data;
  const movements = movementsRes.success && movementsRes.data ? movementsRes.data : [];

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Movimientos</h2>
          {movements.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no hay movimientos registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Método</th>
                    <th className="px-4 py-3">Referencia</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((movement: any) => (
                    <tr key={movement.id} className="text-gray-700">
                      <td className="px-4 py-3">
                        {new Date(movement.date).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${movement.type === "PAYMENT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
                        >
                          {movement.type === "PAYMENT" ? "Pago" : "Cobranza"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {movement.method === "CASH" && "Efectivo"}
                        {movement.method === "BANK_TRANSFER" && "Transferencia"}
                        {movement.method === "CHECK" && "Cheque"}
                        {movement.method === "CREDIT_CARD" && "Tarjeta Crédito"}
                        {movement.method === "DEBIT_CARD" && "Tarjeta Débito"}
                        {movement.method === "OTHER" && "Otro"}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {movement.reference || "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${movement.type === "PAYMENT" ? "text-red-600" : "text-green-600"}`}
                      >
                        {formatCurrency(Number(movement.amount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Información</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Moneda</span>
              <span>{account.currency}</span>
            </div>
            {account.bankName && (
              <div className="flex justify-between">
                <span>Banco</span>
                <span>{account.bankName}</span>
              </div>
            )}
            {account.number && (
              <div className="flex justify-between">
                <span>Número</span>
                <span>{account.number}</span>
              </div>
            )}
            {account.cbu && (
              <div className="flex justify-between">
                <span>CBU / CVU</span>
                <span className="font-mono text-xs">{account.cbu}</span>
              </div>
            )}
            {account.alias && (
              <div className="flex justify-between">
                <span>Alias</span>
                <span>{account.alias}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Cuenta Contable</span>
              <span className="text-gray-900 font-medium">{account.account?.code}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
