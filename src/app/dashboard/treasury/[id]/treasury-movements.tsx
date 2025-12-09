'use client';

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency, formatInvoiceNumber } from "@/lib/utils";
import { ContactType, InvoiceLetter, InvoiceFlow, RetentionTaxType } from "@prisma/client";
import { createTreasuryMovement } from "@/actions/treasury";
import { allocatePayment } from "@/actions/payments";
import { recordRetention } from "@/actions/retentions";
import { toast } from "sonner";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  CHECK: "Cheque",
  CREDIT_CARD: "Tarjeta Crédito",
  DEBIT_CARD: "Tarjeta Débito",
  OTHER: "Otro",
};

const AMOUNT_TOLERANCE = 0.01;

const expectedFlowByMovement: Record<"PAYMENT" | "COLLECTION", InvoiceFlow> = {
  PAYMENT: "PURCHASE",
  COLLECTION: "SALE",
};

const RETENTION_TAX_LABELS: Record<RetentionTaxType, string> = {
  VAT: "IVA",
  INCOME_TAX: "Ganancias",
  GROSS_INCOME: "Ingresos Brutos",
};

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return Number(value);
};

export type TreasuryMovement = {
  id: string;
  date: string;
  type: "PAYMENT" | "COLLECTION";
  method: string;
  reference?: string | null;
  amount: number;
  runningBalance: number;
  amountAllocated?: number;
  amountRemaining?: number;
  allocations?: Array<{
    id: string;
    invoiceId: string;
    amount: number;
    invoice: {
      id: string;
      letter: InvoiceLetter;
      pointOfSale: number;
      number: number;
      contactName?: string | null;
    } | null;
  }>;
  invoice: {
    id: string;
    flow: "SALE" | "PURCHASE";
    letter: InvoiceLetter;
    pointOfSale: number;
    number: number;
    contactName?: string | null;
  } | null;
  contact: {
    id: string;
    name: string;
    type: ContactType;
  } | null;
  contactId?: string | null;
  contactName?: string | null;
};

export type ReconciliationInvoice = {
  id: string;
  flow: InvoiceFlow;
  letter: InvoiceLetter;
  pointOfSale: number;
  number: number;
  date: string | null;
  dueDate: string | null;
  totalAmount: number;
  amountAllocated: number;
  amountRemaining: number;
  paymentStatus: string;
  contactId: string | null;
  contactName: string | null;
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
  contacts: {
    id: string;
    name: string;
    type: ContactType;
  }[];
  invoices: ReconciliationInvoice[];
  organizationId: string;
}

export default function TreasuryMovementsSection({
  movements,
  accountInfo,
  hasMovements,
  accountType,
  chartOfAccounts,
  treasuryAccountId,
  contacts,
  invoices,
  organizationId,
}: TreasuryMovementsSectionProps) {
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [movementForm, setMovementForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    accountId: "",
    contactId: "",
  });
  const [isReconciling, setIsReconciling] = useState(false);
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);
  const [retentionInvoiceId, setRetentionInvoiceId] = useState<string>("");
  const [isSavingRetention, setIsSavingRetention] = useState(false);
  const [retentionForm, setRetentionForm] = useState({
    taxType: RetentionTaxType.VAT as RetentionTaxType,
    baseAmount: 0,
    rate: 1,
    amount: 0,
    certificateNumber: "",
    certificateDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const router = useRouter();

  const selectedMovement = useMemo(
    () => movements.find(movement => movement.id === selectedMovementId) ?? null,
    [movements, selectedMovementId],
  );

  const movementRemaining = selectedMovement
    ? toNumber(selectedMovement.amountRemaining ?? selectedMovement.amount ?? 0)
    : 0;
  const formattedMovementRemaining = formatCurrency(movementRemaining);

  const candidateInvoices = useMemo(() => {
    if (!selectedMovement?.contactId) return [];
    const targetFlow = expectedFlowByMovement[selectedMovement.type];
    return invoices
      .filter(invoice => invoice.contactId === selectedMovement.contactId && invoice.flow === targetFlow)
      .filter(invoice => invoice.amountRemaining > AMOUNT_TOLERANCE)
      .sort((a, b) => {
        const aDate = a.dueDate ?? a.date ?? "";
        const bDate = b.dueDate ?? b.date ?? "";
        return aDate.localeCompare(bDate);
      });
  }, [invoices, selectedMovement]);

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return candidateInvoices;
    const term = invoiceSearch.trim().toLowerCase();
    return candidateInvoices.filter(invoice =>
      formatInvoiceNumber(invoice.letter, invoice.pointOfSale, invoice.number).toLowerCase().includes(term) ||
      (invoice.contactName ?? "").toLowerCase().includes(term),
    );
  }, [candidateInvoices, invoiceSearch]);

  const allocationList = useMemo(() => {
    return Object.entries(allocationInputs)
      .map(([invoiceId, rawAmount]) => ({ invoiceId, amount: toNumber(rawAmount) }))
      .filter(entry => entry.amount > 0);
  }, [allocationInputs]);

  const totalAllocated = allocationList.reduce((sum, entry) => sum + entry.amount, 0);
  const remainingAfterAllocation = movementRemaining - totalAllocated;

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
        label: "Contacto",
        value: selectedMovement.contact?.name
          ?? selectedMovement.invoice?.contactName
          ?? selectedMovement.contactName
          ?? "—",
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
      selectedMovement.amountAllocated !== undefined && selectedMovement.amountRemaining !== undefined
        ? {
            label: "Saldo pendiente del movimiento",
            value: formatCurrency(selectedMovement.amountRemaining),
          }
        : null,
    ].filter(Boolean) as { label: string; value: React.ReactNode }[];
  }, [selectedMovement]);

  const selectedAccount = useMemo(() => chartOfAccounts.find(account => account.id === movementForm.accountId) ?? null, [chartOfAccounts, movementForm.accountId]);

  const expectedContactType: ContactType | null = useMemo(() => {
    if (!selectedAccount) return null;
    const increasesTreasury = ["LIABILITY", "EQUITY", "INCOME"].includes(selectedAccount.type);
    return increasesTreasury ? ContactType.CUSTOMER : ContactType.VENDOR;
  }, [selectedAccount]);

  const filteredContacts = useMemo(() => {
    if (!expectedContactType) return [];
    return contacts.filter(contact => contact.type === expectedContactType);
  }, [contacts, expectedContactType]);

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
        contactId: movementForm.contactId || undefined,
      });

      if (res.success) {
        toast.success("Movimiento registrado");
        setMovementForm({
          date: new Date().toISOString().split("T")[0],
          description: "",
          amount: "",
          accountId: "",
          contactId: "",
        });
        setIsCreating(false);
        router.refresh();
      } else {
        toast.error(res.error || "No se pudo registrar el movimiento");
      }
    });
  };

  const openReconciliation = () => {
    if (!selectedMovement) return;
    setAllocationInputs({});
    setInvoiceSearch("");
    setIsReconciling(true);
  };

  const closeReconciliation = () => {
    setIsReconciling(false);
    setAllocationInputs({});
  };

  const handleAllocationChange = (invoiceId: string, value: string) => {
    setAllocationInputs(prev => ({ ...prev, [invoiceId]: value }));
  };

  const canReconcile = Boolean(
    selectedMovement &&
    selectedMovement.contactId &&
    movementRemaining > AMOUNT_TOLERANCE &&
    candidateInvoices.length,
  );

  const handleReconciliationSubmit = () => {
    if (!selectedMovement) return;
    if (!allocationList.length || totalAllocated <= AMOUNT_TOLERANCE) {
      toast.error("Ingresá al menos un monto a conciliar");
      return;
    }
    if (totalAllocated - movementRemaining > AMOUNT_TOLERANCE) {
      toast.error(`El monto supera el saldo disponible (${formattedMovementRemaining})`);
      return;
    }

    for (const allocation of allocationList) {
      const invoice = candidateInvoices.find(inv => inv.id === allocation.invoiceId);
      if (!invoice) {
        toast.error("Una de las facturas ya no está disponible");
        return;
      }
      if (allocation.amount - invoice.amountRemaining > AMOUNT_TOLERANCE) {
        toast.error("El monto supera el saldo pendiente de la factura seleccionada");
        return;
      }
    }

    startTransition(async () => {
      const res = await allocatePayment({
        organizationId,
        paymentId: selectedMovement.id,
        allocations: allocationList.map(entry => ({
          invoiceId: entry.invoiceId,
          amount: entry.amount,
        })),
      });

      if (!res.success) {
        toast.error(res.error ?? "No se pudo conciliar el movimiento");
        return;
      }

      toast.success("Movimiento conciliado correctamente");
      closeReconciliation();
      router.refresh();
    });
  };

  const retentionEligibleInvoices = useMemo(() => {
    return invoices.filter(invoice => invoice.amountRemaining > AMOUNT_TOLERANCE);
  }, [invoices]);

  const selectedRetentionInvoice = retentionEligibleInvoices.find(inv => inv.id === retentionInvoiceId) ?? null;

  const openRetentionModal = () => {
    if (!retentionEligibleInvoices.length) {
      toast.error("No hay facturas con saldo disponible para registrar retenciones.");
      return;
    }
    const defaultInvoice = retentionEligibleInvoices[0];
    setRetentionInvoiceId(defaultInvoice.id);
    setRetentionForm(prev => ({
      ...prev,
      baseAmount: defaultInvoice.totalAmount,
      amount: defaultInvoice.amountRemaining,
    }));
    setIsRetentionModalOpen(true);
  };

  const closeRetentionModal = () => {
    setIsRetentionModalOpen(false);
    setIsSavingRetention(false);
  };

  const handleRetentionInvoiceChange = (invoiceId: string) => {
    setRetentionInvoiceId(invoiceId);
    const invoice = retentionEligibleInvoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setRetentionForm(prev => ({
        ...prev,
        baseAmount: invoice.totalAmount,
        amount: invoice.amountRemaining,
      }));
    }
  };

  const handleRetentionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRetentionInvoice) {
      toast.error("Seleccioná una factura");
      return;
    }
    if (retentionForm.amount <= 0) {
      toast.error("El monto de la retención debe ser mayor a 0");
      return;
    }
    if (retentionForm.amount - selectedRetentionInvoice.amountRemaining > AMOUNT_TOLERANCE) {
      toast.error("El monto supera el saldo pendiente de la factura");
      return;
    }

    setIsSavingRetention(true);
    const res = await recordRetention({
      organizationId,
      invoiceId: selectedRetentionInvoice.id,
      taxType: retentionForm.taxType,
      baseAmount: retentionForm.baseAmount,
      rate: retentionForm.rate,
      amount: retentionForm.amount,
      certificateNumber: retentionForm.certificateNumber || undefined,
      certificateDate: retentionForm.certificateDate ? new Date(retentionForm.certificateDate) : undefined,
      notes: retentionForm.notes || undefined,
    });

    setIsSavingRetention(false);

    if (!res.success) {
      toast.error(res.error || "No se pudo registrar la retención");
      return;
    }

    toast.success("Retención registrada correctamente");
    closeRetentionModal();
    router.refresh();
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
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {expectedContactType === ContactType.CUSTOMER ? "Cliente" : expectedContactType === ContactType.VENDOR ? "Proveedor" : "Contacto (opcional)"}
                </label>
                <select
                  value={movementForm.contactId}
                  onChange={event => setMovementForm({ ...movementForm, contactId: event.target.value })}
                  disabled={!expectedContactType}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-100"
                >
                  <option value="">
                    {!expectedContactType
                      ? "Selecciona una cuenta contable"
                      : filteredContacts.length
                        ? "Sin contacto"
                        : expectedContactType === ContactType.CUSTOMER
                          ? "No hay clientes disponibles"
                          : "No hay proveedores disponibles"}
                  </option>
                  {filteredContacts.map(contact => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {expectedContactType
                    ? expectedContactType === ContactType.CUSTOMER
                      ? "Solo se muestran clientes (cobranzas)."
                      : "Solo se muestran proveedores (pagos)."
                    : "Seleccioná primero la cuenta contable para saber si corresponde cliente o proveedor."}
                </p>
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
                <span className="text-gray-900 text-right">{row.value}</span>
              </div>
            ))}
            <div className="mt-4">
              <button
                type="button"
                onClick={openReconciliation}
                disabled={!canReconcile}
                className="w-full text-sm font-medium rounded-md px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {canReconcile ? "Conciliar movimiento" : "Conciliación no disponible"}
              </button>
              {!selectedMovement.contactId && (
                <p className="text-xs text-gray-500 mt-2">
                  Necesitás asociar un contacto al movimiento para poder conciliarlo.
                </p>
              )}
              {movementRemaining <= AMOUNT_TOLERANCE && (
                <p className="text-xs text-gray-500 mt-2">Este movimiento ya no tiene saldo pendiente.</p>
              )}
              {selectedMovement.contactId && !candidateInvoices.length && movementRemaining > AMOUNT_TOLERANCE && (
                <p className="text-xs text-gray-500 mt-2">
                  No hay facturas pendientes para este contacto.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Seleccioná un movimiento para ver los detalles.</p>
        )}

        <div className="border-t border-dashed border-gray-200 pt-4">
          <button
            type="button"
            onClick={openRetentionModal}
            className="w-full text-sm font-medium rounded-md px-3 py-2 bg-gray-900 text-white hover:bg-gray-800"
          >
            Registrar retención manual
          </button>
          <p className="text-xs text-gray-500 mt-2">
            Usa esta opción cuando una factura se cancela con retenciones que no ingresan a tesorería.
          </p>
        </div>

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

      {isReconciling && selectedMovement && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-500">Conciliar movimiento</p>
                <h3 className="text-lg font-semibold text-gray-900">
                  {formatCurrency(selectedMovement.amount)} · Saldo disponible {formattedMovementRemaining}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedMovement.type === "PAYMENT" ? "Pago a proveedor" : "Cobranza de cliente"} · {selectedMovement.contactName || "Sin contacto"}
                </p>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-900"
                onClick={closeReconciliation}
                disabled={isPending}
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <input
                type="text"
                value={invoiceSearch}
                onChange={event => setInvoiceSearch(event.target.value)}
                placeholder="Buscar factura por número o contacto"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <div className="text-sm text-gray-600">
                Facturas disponibles: {candidateInvoices.length}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredInvoices.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Comprobante</th>
                      <th className="text-left px-4 py-3">Contacto</th>
                      <th className="text-left px-4 py-3">Saldo</th>
                      <th className="text-left px-4 py-3 w-40">Monto a asignar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInvoices.map((invoice: ReconciliationInvoice) => {
                      const invoiceNumber = formatInvoiceNumber(invoice.letter, invoice.pointOfSale, invoice.number);
                      const inputValue = allocationInputs[invoice.id] ?? "";
                      return (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs text-gray-900">{invoiceNumber}</div>
                            <div className="text-xs text-gray-500">
                              Pendiente: {formatCurrency(invoice.amountRemaining)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{invoice.contactName ?? "-"}</td>
                          <td className="px-4 py-3 text-gray-600">{invoice.paymentStatus === "PAID" ? "Pagada" : formatCurrency(invoice.amountRemaining)}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                              value={inputValue}
                              onChange={event => handleAllocationChange(invoice.id, event.target.value)}
                              placeholder="0.00"
                              max={invoice.amountRemaining}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  No hay facturas que coincidan con la búsqueda.
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Total a conciliar</span>
                <span className="text-lg font-semibold text-gray-900">{formatCurrency(totalAllocated)}</span>
              </div>
              <div className={`text-xs ${remainingAfterAllocation >= -AMOUNT_TOLERANCE ? "text-gray-500" : "text-red-600"}`}>
                Saldo restante luego de conciliar: {formatCurrency(Math.max(remainingAfterAllocation, 0))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  onClick={closeReconciliation}
                  disabled={isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-500 disabled:opacity-60"
                  onClick={handleReconciliationSubmit}
                  disabled={isPending || !allocationList.length}
                >
                  {isPending ? "Conciliando..." : "Confirmar conciliación"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRetentionModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-gray-500">Registrar retención</p>
                <h3 className="text-lg font-semibold text-gray-900">Ajustar saldo de factura</h3>
              </div>
              <button
                type="button"
                className="text-gray-500 hover:text-gray-900"
                onClick={closeRetentionModal}
                disabled={isSavingRetention}
              >
                ×
              </button>
            </div>

            <form className="p-6 space-y-4" onSubmit={handleRetentionSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Factura</label>
                <select
                  required
                  value={retentionInvoiceId}
                  onChange={event => handleRetentionInvoiceChange(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">Seleccioná una factura</option>
                  {retentionEligibleInvoices.map(invoice => (
                    <option key={invoice.id} value={invoice.id}>
                      {formatInvoiceNumber(invoice.letter, invoice.pointOfSale, invoice.number)} · Saldo {formatCurrency(invoice.amountRemaining)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Impuesto</label>
                  <select
                    value={retentionForm.taxType}
                    onChange={event => setRetentionForm(prev => ({ ...prev, taxType: event.target.value as RetentionTaxType }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    {Object.entries(RETENTION_TAX_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del certificado</label>
                  <input
                    type="date"
                    value={retentionForm.certificateDate}
                    onChange={event => setRetentionForm(prev => ({ ...prev, certificateDate: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base imponible</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={retentionForm.baseAmount}
                    onChange={event => {
                      const base = Number(event.target.value) || 0;
                      setRetentionForm(prev => ({
                        ...prev,
                        baseAmount: base,
                        amount: Number(((base * prev.rate) / 100).toFixed(2)),
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tasa (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={retentionForm.rate}
                    onChange={event => {
                      const rate = Number(event.target.value) || 0;
                      setRetentionForm(prev => ({
                        ...prev,
                        rate,
                        amount: Number(((prev.baseAmount * rate) / 100).toFixed(2)),
                      }));
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={retentionForm.amount}
                    onChange={event => setRetentionForm(prev => ({ ...prev, amount: Number(event.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  {selectedRetentionInvoice && (
                    <p className="text-xs text-gray-500 mt-1">
                      Saldo disponible: {formatCurrency(selectedRetentionInvoice.amountRemaining)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de certificado</label>
                  <input
                    type="text"
                    value={retentionForm.certificateNumber}
                    onChange={event => setRetentionForm(prev => ({ ...prev, certificateNumber: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Ej: 001-00001234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                  <input
                    type="text"
                    value={retentionForm.notes}
                    onChange={event => setRetentionForm(prev => ({ ...prev, notes: event.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="Información adicional"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeRetentionModal}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={isSavingRetention}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60"
                  disabled={isSavingRetention}
                >
                  {isSavingRetention ? "Guardando..." : "Guardar retención"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
