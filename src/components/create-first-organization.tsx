'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrganization } from "@/actions/organizations";
import { toast } from "sonner";

export default function CreateFirstOrganization() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    cuit: "",
    address: "",
  });
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const inputClasses =
    "w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600";

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);

    if (!formData.name.trim() || !formData.cuit.trim()) {
      toast.error("Completa el nombre y el CUIT");
      return;
    }

    startTransition(async () => {
      const res = await createOrganization({
        name: formData.name.trim(),
        cuit: formData.cuit.trim(),
        address: formData.address.trim() || undefined,
      });

      if (res.success) {
        toast.success("Organización creada exitosamente");
        router.refresh();
        router.push("/dashboard");
      } else {
        const message = res.error || "No se pudo crear la organización";
        setServerError(message);
        toast.error(message);
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mx-auto">
          <span className="font-semibold text-lg">1</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Bienvenido a ContableAR</h1>
        <p className="text-gray-600 text-sm">
          Crea tu primera organización para comenzar a registrar comprobantes, pagos y reportes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Nombre de la organización</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className={inputClasses}
            placeholder="Ej: Estudio Contable SRL"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">CUIT</label>
          <input
            type="text"
            value={formData.cuit}
            onChange={(e) => setFormData((prev) => ({ ...prev, cuit: e.target.value }))}
            className={inputClasses}
            placeholder="30-00000000-0"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Dirección (opcional)</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            className={inputClasses}
            placeholder="Calle 123, CABA"
          />
        </div>
        {serverError && (
          <p className="text-sm text-red-600 text-center">{serverError}</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full inline-flex justify-center items-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isPending ? "Creando..." : "Crear organización"}
        </button>
      </form>
    </div>
  );
}
