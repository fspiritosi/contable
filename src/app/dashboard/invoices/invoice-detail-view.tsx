'use client';

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SerializedInvoiceDetail } from "@/actions/invoices";
import { createPayment } from "@/actions/payments";
import { recordRetention, type SerializedRetentionSetting } from "@/actions/retentions";
import FileUploader from "@/components/file-uploader";
import AttachmentViewer from "@/components/attachment-viewer";
import { parseLocalDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import {
    ArrowLeft,
    ArrowRightLeft,
    Calendar,
    FileText,
    Package,
    ReceiptText,
    Shield,
    Wallet,
} from "lucide-react";

const paymentMethodLabels: Record<PaymentMethod, string> = {
    CASH: "Efectivo",
    BANK_TRANSFER: "Transferencia",
    CHECK: "Cheque",
    CREDIT_CARD: "Tarjeta de Crédito",
    DEBIT_CARD: "Tarjeta de Débito",
    OTHER: "Otro",
};

const EMPTY_RETENTION_SETTINGS: SerializedRetentionSetting[] = [];

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: string | null) {
    if (!value) return "–";
    return new Date(value).toLocaleDateString("es-AR");
}

type TreasuryAccountSummary = {
    id: string;
    name: string;
    type: PaymentMethod;
    balance: number;
    currency?: string | null;
};

type InvoiceDetailViewProps = {
    invoice: SerializedInvoiceDetail;
    organizationId: string;
    treasuryAccounts: TreasuryAccountSummary[];
    backHref: string;
    retentionSettings?: SerializedRetentionSetting[];
};

export default function InvoiceDetailView({ invoice, organizationId, treasuryAccounts, backHref, retentionSettings }: InvoiceDetailViewProps) {
    const paymentType = invoice.flow === "SALE" ? "COLLECTION" : "PAYMENT";
    const paymentLabel = paymentType === "COLLECTION" ? "Cobranza" : "Pago";

    const retentionSettingsList = retentionSettings ?? EMPTY_RETENTION_SETTINGS;

    const [payments, setPayments] = useState(invoice.payments);
    const [retentions, setRetentions] = useState(invoice.retentions);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        method: PaymentMethod.CASH as PaymentMethod,
        treasuryAccountId: "",
        amount: 0,
        date: new Date().toISOString().split("T")[0],
        reference: "",
        notes: "",
    });
    const [isAddingRetention, setIsAddingRetention] = useState(false);
    const [isSubmittingRetention, setIsSubmittingRetention] = useState(false);

    const applicableRetentionSettings = useMemo(
        () =>
            retentionSettingsList.filter(setting =>
                setting.appliesTo ? setting.appliesTo === invoice.flow : true,
            ),
        [retentionSettingsList, invoice.flow],
    );

    const [retentionForm, setRetentionForm] = useState({
        retentionSettingId: applicableRetentionSettings[0]?.id || "",
        baseAmount: invoice.totalAmount,
        rate: applicableRetentionSettings[0]?.defaultRate ?? 0,
        amount:
            applicableRetentionSettings[0]?.defaultRate
                ? Number(((invoice.totalAmount * (applicableRetentionSettings[0].defaultRate ?? 0)) / 100).toFixed(2))
                : 0,
        certificateNumber: "",
        certificateDate: new Date().toISOString().split("T")[0],
        notes: "",
    });

    useEffect(() => {
        if (applicableRetentionSettings.length === 0) {
            return;
        }

        setRetentionForm(prev => {
            const nextSettingId = applicableRetentionSettings[0]?.id || "";
            if (prev.retentionSettingId && applicableRetentionSettings.some(s => s.id === prev.retentionSettingId)) {
                return prev;
            }

            const fallbackRate = applicableRetentionSettings[0]?.defaultRate ?? 0;
            return {
                ...prev,
                retentionSettingId: nextSettingId,
                rate: fallbackRate ?? 0,
                amount: fallbackRate
                    ? Number(((prev.baseAmount * fallbackRate) / 100).toFixed(2))
                    : 0,
            };
        });
    }, [applicableRetentionSettings]);

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            amount: Math.max(invoice.totalAmount - relevantPaymentsTotal(payments, paymentType), 0),
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoice.id]);

    const availableAccounts = useMemo(
        () => treasuryAccounts.filter(acc => acc.type === formData.method),
        [treasuryAccounts, formData.method]
    );

    useEffect(() => {
        if (availableAccounts.length === 0) {
            setFormData(prev => ({ ...prev, treasuryAccountId: "" }));
            return;
        }
        const exists = availableAccounts.some(acc => acc.id === formData.treasuryAccountId);
        if (!exists) {
            setFormData(prev => ({ ...prev, treasuryAccountId: availableAccounts[0].id }));
        }
    }, [availableAccounts, formData.treasuryAccountId]);

    const relevantPayments = payments.filter(p => p.type === paymentType);
    const paidAmount = relevantPaymentsTotal(payments, paymentType);
    const retentionTotal = useMemo(() => retentions.reduce((sum, retention) => sum + retention.amount, 0), [retentions]);
    const remainingAmount = Math.max(invoice.totalAmount - paidAmount - retentionTotal, 0);

    useEffect(() => {
        setFormData(prev => ({ ...prev, amount: remainingAmount }));
    }, [remainingAmount]);

    const hasRetentionSettings = applicableRetentionSettings.length > 0;
    const canAddRetention = remainingAmount > 0 && hasRetentionSettings;
    const selectedRetentionSetting = applicableRetentionSettings.find(setting => setting.id === retentionForm.retentionSettingId) ?? null;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formData.treasuryAccountId) {
            toast.error("Seleccioná una cuenta de tesorería");
            return;
        }
        if (formData.amount <= 0) {
            toast.error("El monto debe ser mayor a 0");
            return;
        }
        setIsSubmitting(true);
        const loading = toast.loading(`Registrando ${paymentLabel.toLowerCase()}...`);
        const res = await createPayment({
            organizationId,
            type: paymentType,
            method: formData.method,
            amount: formData.amount,
            date: parseLocalDate(formData.date),
            reference: formData.reference || undefined,
            notes: formData.notes || undefined,
            invoiceId: invoice.id,
            treasuryAccountId: formData.treasuryAccountId,
        });
        toast.dismiss(loading);
        setIsSubmitting(false);

        if (!res.success || !res.data) {
            toast.error(res.error || "No se pudo registrar el movimiento");
            return;
        }

        toast.success(`${paymentLabel} registrado correctamente`);

        const normalized = {
            id: res.data.id,
            type: res.data.type,
            method: res.data.method,
            amount: Number(res.data.amount),
            date: new Date(res.data.date).toISOString(),
            reference: res.data.reference ?? null,
            notes: res.data.notes ?? null,
            treasuryAccount: res.data.treasuryAccount
                ? {
                      id: res.data.treasuryAccount.id,
                      name: res.data.treasuryAccount.name,
                      type: res.data.treasuryAccount.type,
                  }
                : null,
        } satisfies SerializedInvoiceDetail["payments"][number];

        setPayments(prev => [normalized, ...prev]);
        setFormData(prev => ({
            ...prev,
            amount: Math.max(remainingAmount - normalized.amount, 0),
            reference: "",
            notes: "",
        }));
    };

    const handleRetentionSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (retentionForm.amount <= 0) {
            toast.error("El monto de la retención debe ser mayor a 0");
            return;
        }
        if (retentionForm.amount - remainingAmount > 0.01) {
            toast.error("El monto supera el saldo pendiente de la factura");
            return;
        }

        setIsSubmittingRetention(true);
        const loading = toast.loading("Registrando retención...");
        if (!retentionForm.retentionSettingId) {
            toast.error("Seleccioná un tipo de retención");
            return;
        }

        const res = await recordRetention({
            organizationId,
            invoiceId: invoice.id,
            retentionSettingId: retentionForm.retentionSettingId,
            baseAmount: retentionForm.baseAmount,
            rate: retentionForm.rate,
            amount: retentionForm.amount,
            certificateNumber: retentionForm.certificateNumber || undefined,
            certificateDate: retentionForm.certificateDate ? parseLocalDate(retentionForm.certificateDate) : undefined,
            notes: retentionForm.notes || undefined,
        });
        toast.dismiss(loading);
        setIsSubmittingRetention(false);

        if (!res.success || !res.data) {
            toast.error(res.error || "No se pudo registrar la retención");
            return;
        }

        toast.success("Retención registrada correctamente");
        setRetentions(prev => [
            {
                ...res.data,
                amount: Number(res.data.amount),
                baseAmount: Number(res.data.baseAmount),
                rate: Number(res.data.rate),
            },
            ...prev,
        ]);
        setRetentionForm(prev => ({
            ...prev,
            baseAmount: Math.max(remainingAmount - retentionForm.amount, 0),
            amount: Math.max(remainingAmount - retentionForm.amount, 0),
            certificateNumber: "",
            notes: "",
        }));
        setIsAddingRetention(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Link href={backHref} className="inline-flex items-center gap-1 hover:text-gray-900">
                    <ArrowLeft className="h-4 w-4" /> Volver
                </Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Detalle de factura</span>
            </div>

            <header className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-wide text-gray-500">{invoice.flow === "SALE" ? "Factura de Venta" : "Factura de Compra"}</p>
                        <h1 className="text-2xl font-semibold text-gray-900">
                            {invoice.letter} {String(invoice.pointOfSale).padStart(4, "0")}-{String(invoice.number).padStart(8, "0")}
                        </h1>
                        <p className="text-gray-500">Emitida el {formatDate(invoice.date)}</p>
                        {retentionTotal > 0 && (
                            <p className="text-gray-500 text-sm">Retenciones aplicadas: {formatCurrency(retentionTotal)}</p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="text-3xl font-bold text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                        <p className={cn("text-sm font-medium", remainingAmount > 0 ? "text-orange-600" : "text-green-600")}>
                            Restante: {formatCurrency(remainingAmount)}
                        </p>
                    </div>
                </div>

                {invoice.purchaseOrderId && (
                    <div className="flex flex-wrap gap-2 items-center text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                        <ReceiptText className="h-4 w-4 text-gray-500" />
                        <span>Origen: Orden de compra #{invoice.purchaseOrderNumber}</span>
                        {typeof invoice.purchaseOrderRemaining === "number" && (
                            <span className="text-gray-500">
                                Saldo OC: {formatCurrency(Math.max(invoice.purchaseOrderRemaining, 0))}
                            </span>
                        )}
                    </div>
                )}

                {invoice.contact && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <p className="text-sm text-gray-500 mb-1">{invoice.flow === "SALE" ? "Cliente" : "Proveedor"}</p>
                        <p className="text-lg font-medium text-gray-900">{invoice.contact.name}</p>
                        <div className="text-sm text-gray-600 flex flex-wrap gap-4 mt-1">
                            {invoice.contact.cuit && <span>CUIT: {invoice.contact.cuit}</span>}
                            {invoice.contact.email && <span>{invoice.contact.email}</span>}
                        </div>
                    </div>
                )}
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                            <Package className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold text-gray-900">Conceptos</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-500 uppercase tracking-wide text-xs">
                                    <tr>
                                        <th className="text-left px-6 py-3 font-medium">Descripción</th>
                                        <th className="text-right px-4 py-3 font-medium">Cantidad</th>
                                        <th className="text-right px-4 py-3 font-medium">Precio</th>
                                        <th className="text-right px-4 py-3 font-medium">IVA</th>
                                        <th className="text-right px-6 py-3 font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-gray-700">
                                    {invoice.items.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-3">
                                                <p className="font-medium text-gray-900">{item.description}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right">{item.quantity}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                                            <td className="px-4 py-3 text-right">{item.vatRate}%</td>
                                            <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                                <p className="text-gray-500">Neto</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(invoice.netAmount)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">IVA</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(invoice.vatAmount)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Total</p>
                                <p className="font-semibold text-gray-900">{formatCurrency(invoice.totalAmount)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                            <ArrowRightLeft className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold text-gray-900">Pagos / Cobranzas</h2>
                        </div>
                        {payments.length === 0 ? (
                            <div className="px-6 py-8 text-center text-gray-500">
                                No hay movimientos registrados todavía.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {payments.map(payment => (
                                    <div key={payment.id} className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{payment.type === "PAYMENT" ? "Pago" : "Cobranza"} · {paymentMethodLabels[payment.method as PaymentMethod] || payment.method}</p>
                                            <p className="text-xs text-gray-500">{formatDate(payment.date)} · {payment.reference || "Sin referencia"}</p>
                                            {payment.treasuryAccount && (
                                                <p className="text-xs text-gray-500">Cuenta: {payment.treasuryAccount.name}</p>
                                            )}
                                        </div>
                                        <p className={cn("text-lg font-semibold", payment.type === "PAYMENT" ? "text-red-600" : "text-green-600")}>{formatCurrency(payment.amount)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-gray-500" />
                                <h2 className="text-base font-semibold text-gray-900">Retenciones</h2>
                            </div>
                            <p className="text-sm text-gray-500">Total aplicado: {formatCurrency(retentionTotal)}</p>
                        </div>
                        {retentions.length === 0 ? (
                            <div className="px-6 py-8 text-center text-gray-500">Aún no registraste retenciones.</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {retentions.map(retention => (
                                    <div key={retention.id} className="px-6 py-4 flex flex-col gap-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {retention.typeName} · {formatCurrency(retention.amount)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Certificado: {retention.certificateNumber || "Sin número"}
                                            </p>
                                        </div>
                                        <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                                            <span>Base: {formatCurrency(retention.baseAmount)}</span>
                                            <span>Tasa: {Number(retention.rate).toFixed(2)}%</span>
                                            <span>Fecha: {formatDate(retention.certificateDate)}</span>
                                        </div>
                                        {retention.notes && (
                                            <p className="text-xs text-gray-500">Notas: {retention.notes}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setIsAddingRetention(prev => !prev)}
                                disabled={!canAddRetention}
                                className={cn(
                                    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium",
                                    canAddRetention
                                        ? "bg-gray-900 text-white hover:bg-gray-800"
                                        : "bg-gray-100 text-gray-400 cursor-not-allowed",
                                )}
                            >
                                {isAddingRetention ? "Cerrar" : "Registrar retención"}
                            </button>
                            {!hasRetentionSettings && (
                                <p className="text-xs text-red-500 self-center">
                                    Configurá tipos de retención en Settings para poder registrarlas.
                                </p>
                            )}
                            {!canAddRetention && hasRetentionSettings && (
                                <p className="text-xs text-red-500 self-center">La factura ya no tiene saldo pendiente.</p>
                            )}
                        </div>
                        {isAddingRetention && (
                            <form className="px-6 pb-6 space-y-4 border-t border-gray-100" onSubmit={handleRetentionSubmit}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de retención</label>
                                        <select
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={retentionForm.retentionSettingId}
                                            onChange={event => {
                                                const nextSetting = applicableRetentionSettings.find(setting => setting.id === event.target.value) ?? null;
                                                setRetentionForm(prev => ({
                                                    ...prev,
                                                    retentionSettingId: event.target.value,
                                                    rate: nextSetting?.defaultRate ?? 0,
                                                    amount: nextSetting?.defaultRate
                                                        ? Number(((prev.baseAmount * (nextSetting.defaultRate ?? 0)) / 100).toFixed(2))
                                                        : prev.amount,
                                                }));
                                            }}
                                        >
                                            {applicableRetentionSettings.map(setting => (
                                                <option key={setting.id} value={setting.id}>
                                                    {setting.name}
                                                    {setting.code ? ` · ${setting.code}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                        {!hasRetentionSettings && (
                                            <p className="text-xs text-red-500 mt-1">
                                                No hay retenciones configuradas para este tipo de comprobante.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha del certificado</label>
                                        <input
                                            type="date"
                                            value={retentionForm.certificateDate}
                                            onChange={e =>
                                                setRetentionForm(prev => ({
                                                    ...prev,
                                                    certificateDate: e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Base imponible</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            value={retentionForm.baseAmount}
                                            onChange={e => {
                                                const base = Number(e.target.value) || 0;
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
                                            step="0.01"
                                            min={0}
                                            value={retentionForm.rate}
                                            onChange={e => {
                                                const rate = Number(e.target.value) || 0;
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
                                            step="0.01"
                                            min={0}
                                            value={retentionForm.amount}
                                            onChange={e => {
                                                const amount = Number(e.target.value) || 0;
                                                setRetentionForm(prev => ({ ...prev, amount }));
                                            }}
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Saldo disponible: {formatCurrency(remainingAmount)}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Número de certificado</label>
                                        <input
                                            type="text"
                                            value={retentionForm.certificateNumber}
                                            onChange={e =>
                                                setRetentionForm(prev => ({
                                                    ...prev,
                                                    certificateNumber: e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            placeholder="Ej: 001-00001234"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                        <input
                                            type="text"
                                            value={retentionForm.notes}
                                            onChange={e =>
                                                setRetentionForm(prev => ({
                                                    ...prev,
                                                    notes: e.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            placeholder="Información adicional"
                                        />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <button
                                        type="submit"
                                        disabled={isSubmittingRetention}
                                        className={cn(
                                            "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
                                            isSubmittingRetention ? "bg-gray-200 text-gray-500" : "bg-gray-900 text-white hover:bg-gray-800",
                                        )}
                                    >
                                        {isSubmittingRetention ? "Guardando..." : "Guardar retención"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                            <Wallet className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold text-gray-900">Registrar {paymentLabel}</h2>
                        </div>
                        <form className="p-6 space-y-4" onSubmit={handleSubmit}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                                <select
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={formData.method}
                                    onChange={e => setFormData(prev => ({ ...prev, method: e.target.value as PaymentMethod }))}
                                >
                                    {Object.entries(paymentMethodLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Caja / Cuenta</label>
                                <select
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={formData.treasuryAccountId}
                                    onChange={e => setFormData(prev => ({ ...prev, treasuryAccountId: e.target.value }))}
                                >
                                    {availableAccounts.length === 0 && <option value="">No hay cuentas disponibles</option>}
                                    {availableAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} · Saldo {formatCurrency(acc.balance)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                                <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                />
                                <p className="text-xs text-gray-500 mt-1">Monto pendiente: {formatCurrency(remainingAmount)}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia</label>
                                <input
                                    type="text"
                                    value={formData.reference}
                                    onChange={e => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                                    placeholder="# de comprobante, transferencia, etc."
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    placeholder="Información adicional"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting || remainingAmount <= 0}
                                className={cn(
                                    "w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                                    remainingAmount <= 0
                                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                        : "bg-gray-900 text-white hover:bg-gray-800",
                                )}
                            >
                                <FileText className="h-4 w-4" /> Registrar {paymentLabel}
                            </button>
                            {remainingAmount <= 0 && (
                                <p className="text-xs text-green-600 text-center">La factura está completamente cancelada.</p>
                            )}
                        </form>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                            <FileText className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold text-gray-900">Adjuntos</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <AttachmentViewer attachments={invoice.attachments} />
                            <div className="pt-2 border-t border-gray-100">
                                <p className="text-xs text-gray-500 mb-2">Subir nuevo archivo</p>
                                <FileUploader
                                    organizationId={organizationId}
                                    entityId={invoice.id}
                                    entityType="invoice"
                                    existingAttachments={invoice.attachments}
                                    acceptedFileTypes={["application/pdf", "image/*"]}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                            <Calendar className="h-5 w-5 text-gray-500" />
                            <h2 className="text-base font-semibold text-gray-900">Fechas</h2>
                        </div>
                        <dl className="p-6 text-sm text-gray-600 space-y-3">
                            <div className="flex justify-between">
                                <dt>Fecha de emisión</dt>
                                <dd className="font-medium text-gray-900">{formatDate(invoice.date)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt>Fecha de vencimiento</dt>
                                <dd className="font-medium text-gray-900">{formatDate(invoice.dueDate)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt>Creada</dt>
                                <dd className="font-medium text-gray-900">{formatDate(invoice.createdAt)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt>Actualizada</dt>
                                <dd className="font-medium text-gray-900">{formatDate(invoice.updatedAt)}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </section>
        </div>
    );
}

function relevantPaymentsTotal(payments: SerializedInvoiceDetail["payments"], paymentType: string) {
    return payments
        .filter(payment => payment.type === paymentType)
        .reduce((sum, payment) => sum + payment.amount, 0);
}
