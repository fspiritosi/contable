'use client';

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatInvoiceNumber } from "@/lib/utils";
import { InvoiceLetter } from "@prisma/client";

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
}

export default function TreasuryMovementsSection({
  movements,
  accountInfo,
  hasMovements,
  accountType,
}: TreasuryMovementsSectionProps) {
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Movimientos</h2>
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
