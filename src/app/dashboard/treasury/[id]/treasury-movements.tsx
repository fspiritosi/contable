'use client';

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatInvoiceNumber } from "@/lib/utils";
import { InvoiceLetter } from "@prisma/client";
import { createTreasuryMovement } from "@/actions/treasury";
import { toast } from "sonner";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  CHECK: "Cheque",
  CREDIT_CARD: "Tarjeta Crédito",
  DEBIT_CARD: "Tarjeta Débito",
  OTHER: "Otro",
};

export type TreasuryMovement = {
  id: string;
  date: string;
  type: "PAYMENT" | "COLLECTION";
  method: string;
  reference?: string | null;
  amount: number;
  runningBalance: number;
  invoice: {
    id: string;
    flow: "SALE" | "PURCHASE";
    letter: InvoiceLetter;
    pointOfSale: number;
    number: number;
    contactName?: string | null;
  } | null;
};

export type TreasuryAccountInfo = {
  currency: string;
  bankName?: string | null;
  number?: string | null;
  cbu?: string | null;
  alias?: string | null;
  accountCode?: string | null;
  type: string;
};

interface TreasuryMovementsSectionProps {
  movements: TreasuryMovement[];
  accountInfo: TreasuryAccountInfo;
  hasMovements: boolean;
  accountType: string;
  chartOfAccounts: {
    id: string;
    code: string;
    name: string;
    type: string;
  }[];
  treasuryAccountId: string;
}

export default function TreasuryMovementsSection({
  movements,
  accountInfo,
  hasMovements,
  accountType,
  chartOfAccounts,
  treasuryAccountId,
}: TreasuryMovementsSectionProps) {
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [movementForm, setMovementForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    accountId: "",
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const selectedMovement = useMemo(
    () => movements.find(movement => movement.id === selectedMovementId) ?? null,
    [movements, selectedMovementId],
  );

  const detailRows = useMemo(() => {
    if (!selectedMovement) return [];

    return [
      {
        label: "Fecha",
        value: new Date(selectedMovement.date).toLocaleString("es-AR", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      {
        label: "Tipo",
        value: selectedMovement.type === "PAYMENT" ? "Pago" : "Cobranza",
      },
      {
        label: "Método",
        value: METHOD_LABELS[selectedMovement.method] ?? selectedMovement.method,
      },
      {
        label: "Referencia",
        value: selectedMovement.reference || "—",
      },
      {
        label: "Factura",
        value: selectedMovement.invoice ? (
          <Link
            href={`/dashboard/${selectedMovement.invoice.flow === "SALE" ? "sales" : "purchases"}/${selectedMovement.invoice.id}`}
            className="text-blue-600 hover:text-blue-800"
          >
            {formatInvoiceNumber(
              selectedMovement.invoice.letter,
              selectedMovement.invoice.pointOfSale,
              selectedMovement.invoice.number,
            )}
          </Link>
        ) : (
          "—"
        ),
      },
      {
        label: "Dueño",
        value: selectedMovement.invoice?.contactName ?? "—",
      },
      {
        label: "Monto",
        value: (
          <span className={selectedMovement.type === "PAYMENT" ? "text-red-600" : "text-green-600"}>
            {formatCurrency(selectedMovement.amount)}
          </span>
        ),
      },
      {
        label: "Saldo luego del movimiento",
        value: formatCurrency(selectedMovement.runningBalance),
      },
    ];
  }, [selectedMovement]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!movementForm.accountId) {
      toast.error("Selecciona la cuenta contable");
      return;
    }
    const numericAmount = Number(movementForm.amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }

    startTransition(async () => {
      const res = await createTreasuryMovement({
        treasuryAccountId,
        accountId: movementForm.accountId,
        date: movementForm.date,
        description: movementForm.description || undefined,
        amount: numericAmount,
      });

      if (res.success) {
        toast.success("Movimiento registrado");
        setMovementForm({
          date: new Date().toISOString().split("T")[0],
          description: "",
          amount: "",
          accountId: "",
        });
        setIsCreating(false);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo registrar el movimiento");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Movimientos</h2>
          <button
            type="button"
            onClick={() => setIsCreating(prev => !prev)}
            className="text-sm font-medium text-white bg-gray-900 px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            {isCreating ? "Cerrar" : "Nuevo Movimiento"}
          </button>
        </div>

        {isCreating && (
          <div className="border border-gray-200 rounded-lg p-4 mb-6 bg-gray-50">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  required
                  value={movementForm.date}
                  onChange={event => setMovementForm({ ...movementForm, date: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cuenta contable</label>
                <select
                  required
                  value={movementForm.accountId}
                  onChange={event => setMovementForm({ ...movementForm, accountId: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {chartOfAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Monto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={movementForm.amount}
                  onChange={event => setMovementForm({ ...movementForm, amount: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                <input
                  type="text"
                  value={movementForm.description}
                  onChange={event => setMovementForm({ ...movementForm, description: event.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Detalle del movimiento"
                />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-500 disabled:opacity-60"
                >
                  {isPending ? "Registrando..." : "Registrar Movimiento"}
                </button>
              </div>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              Las cuentas de tipo Pasivo, Patrimonio o Ingreso incrementan la tesorería. Las de Activo o Gasto la disminuyen.
            </p>
          </div>
        )}

        {!hasMovements ? (
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
                  <th className="px-4 py-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.map(movement => {
                  const isSelected = movement.id === selectedMovementId;
                  return (
                    <tr
                      key={movement.id}
                      className={`text-gray-700 cursor-pointer transition-colors ${
                        isSelected ? "bg-gray-100" : "hover:bg-gray-50"
                      }`}
                      onClick={() => setSelectedMovementId(movement.id)}
                    >
                      <td className="px-4 py-3">
                        {new Date(movement.date).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            movement.type === "PAYMENT" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                          }`}
                        >
                          {movement.type === "PAYMENT" ? "Pago" : "Cobranza"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {METHOD_LABELS[movement.method] ?? movement.method}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {movement.reference || "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          movement.type === "PAYMENT" ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {formatCurrency(movement.amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(movement.runningBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Información</h2>
        {selectedMovement ? (
          <div className="space-y-2 text-sm text-gray-700">
            {detailRows.map(row => (
              <div key={row.label} className="flex justify-between gap-2">
                <span className="text-gray-500">{row.label}</span>
                <span className="text-right">{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Selecciona un movimiento para ver el detalle.
          </p>
        )}

        <div className="border-t border-dashed border-gray-200 pt-4 space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Moneda</span>
            <span>{accountInfo.currency}</span>
          </div>
          {accountInfo.bankName && (
            <div className="flex justify-between">
              <span>Banco</span>
              <span>{accountInfo.bankName}</span>
            </div>
          )}
          {accountInfo.number && (
            <div className="flex justify-between">
              <span>Número</span>
              <span>{accountInfo.number}</span>
            </div>
          )}
          {accountInfo.cbu && (
            <div className="flex justify-between">
              <span>CBU / CVU</span>
              <span className="font-mono text-xs">{accountInfo.cbu}</span>
            </div>
          )}
          {accountInfo.alias && (
            <div className="flex justify-between">
              <span>Alias</span>
              <span>{accountInfo.alias}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>{accountType === "CASH" ? "Caja" : "Cuenta bancaria"}</span>
            <span className="font-medium text-gray-900">{accountInfo.accountCode || "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
