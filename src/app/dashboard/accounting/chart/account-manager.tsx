'use client';

import { useState } from "react";
import { Account, AccountType } from "@prisma/client";
import { createAccount, updateAccount, deleteAccount } from "@/actions/accounts";
import { Plus, ChevronRight, ChevronDown, Folder, FileText, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AccountManagerProps {
    initialAccounts: Account[];
}

export default function AccountManager({ initialAccounts }: AccountManagerProps) {
    const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
    const [isCreating, setIsCreating] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [creatingChildFor, setCreatingChildFor] = useState<string | null>(null);

    // Form state
    const [newAccount, setNewAccount] = useState({
        code: "",
        name: "",
        type: "ASSET" as AccountType,
        parentId: "",
    });

    const [editForm, setEditForm] = useState({
        code: "",
        name: "",
        type: "ASSET" as AccountType,
        parentId: "" as string | undefined,
    });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const loadingToast = toast.loading("Creando cuenta...");

        const res = await createAccount({
            code: newAccount.code,
            name: newAccount.name,
            type: newAccount.type,
            parentId: newAccount.parentId || undefined,
        });

        toast.dismiss(loadingToast);

        if (res.success && res.data) {
            toast.success("Cuenta creada exitosamente");
            setAccounts([...accounts, res.data]);
            setIsCreating(false);
            setNewAccount({ code: "", name: "", type: "ASSET", parentId: "" });
        } else {
            toast.error(res.error || "Error al crear la cuenta");
        }
    };

    const handleCreateChild = (parentAccount: Account) => {
        setCreatingChildFor(parentAccount.id);
        setNewAccount({
            code: "",
            name: "",
            type: parentAccount.type, // Inherit parent type
            parentId: parentAccount.id,
        });
        setIsCreating(true);
        setEditingAccount(null);
    };

    const handleEdit = (account: Account) => {
        setEditingAccount(account);
        setEditForm({
            code: account.code,
            name: account.name,
            type: account.type,
            parentId: account.parentId || undefined,
        });
        setIsCreating(false);
        setCreatingChildFor(null);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount) return;

        const loadingToast = toast.loading("Actualizando cuenta...");

        const res = await updateAccount(editingAccount.id, {
            code: editForm.code,
            name: editForm.name,
            type: editForm.type,
            parentId: editForm.parentId,
        });

        toast.dismiss(loadingToast);

        if (res.success && res.data) {
            toast.success("Cuenta actualizada exitosamente");
            setAccounts(accounts.map(a => a.id === editingAccount.id ? res.data! : a));
            setEditingAccount(null);
        } else {
            toast.error(res.error || "Error al actualizar la cuenta");
        }
    };

    const handleDelete = async (account: Account) => {
        if (!confirm(`¿Estás seguro de eliminar la cuenta "${account.name}"?`)) return;

        const loadingToast = toast.loading("Eliminando cuenta...");

        const res = await deleteAccount(account.id);

        toast.dismiss(loadingToast);

        if (res.success) {
            toast.success("Cuenta eliminada exitosamente");
            setAccounts(accounts.filter(a => a.id !== account.id));
        } else {
            toast.error(res.error || "Error al eliminar la cuenta");
        }
    };

    // Build tree structure
    type AccountNode = Account & { children: AccountNode[] };

    const buildTree = (accs: Account[], parentId: string | null = null): AccountNode[] => {
        return accs
            .filter((a) => a.parentId === parentId)
            .map((a) => ({
                ...a,
                children: buildTree(accs, a.id),
            }));
    };

    const tree = buildTree(accounts);

    return (
        <div className="grid gap-6 md:grid-cols-3">
            {/* Account Tree */}
            <div className="md:col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg text-gray-900">Estructura</h3>
                    <button
                        onClick={() => {
                            setIsCreating(true);
                            setEditingAccount(null);
                        }}
                        className="flex items-center gap-2 text-sm bg-gray-900 text-white px-3 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Nueva Cuenta
                    </button>
                </div>

                <div className="space-y-1">
                    {tree.length === 0 ? (
                        <div className="text-center py-10 text-gray-500">
                            No hay cuentas registradas. Comienza creando una.
                        </div>
                    ) : (
                        tree.map((node) => (
                            <AccountNode
                                key={node.id}
                                node={node}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onCreateChild={handleCreateChild}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Create/Edit Form (Sidebar) */}
            {(isCreating || editingAccount) && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm h-fit">
                    <h3 className="font-semibold text-lg mb-2 text-gray-900">
                        {editingAccount ? "Editar Cuenta" : creatingChildFor ? "Nueva Cuenta Hija" : "Nueva Cuenta"}
                    </h3>
                    {creatingChildFor && (
                        <p className="text-sm text-gray-600 mb-4">
                            Padre: <span className="font-medium">{accounts.find(a => a.id === creatingChildFor)?.code} - {accounts.find(a => a.id === creatingChildFor)?.name}</span>
                        </p>
                    )}
                    <form onSubmit={editingAccount ? handleUpdate : handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                placeholder="e.g. 1.1.01"
                                value={editingAccount ? editForm.code : newAccount.code}
                                onChange={(e) => editingAccount
                                    ? setEditForm({ ...editForm, code: e.target.value })
                                    : setNewAccount({ ...newAccount, code: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                            <input
                                type="text"
                                required
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                placeholder="e.g. Caja"
                                value={editingAccount ? editForm.name : newAccount.name}
                                onChange={(e) => editingAccount
                                    ? setEditForm({ ...editForm, name: e.target.value })
                                    : setNewAccount({ ...newAccount, name: e.target.value })
                                }
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={editingAccount ? editForm.type : newAccount.type}
                                onChange={(e) => editingAccount
                                    ? setEditForm({ ...editForm, type: e.target.value as AccountType })
                                    : setNewAccount({ ...newAccount, type: e.target.value as AccountType })
                                }
                            >
                                <option value="ASSET">Activo</option>
                                <option value="LIABILITY">Pasivo</option>
                                <option value="EQUITY">Patrimonio Neto</option>
                                <option value="INCOME">Ingresos</option>
                                <option value="EXPENSE">Egresos</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Padre (Opcional)</label>
                            <select
                                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
                                value={editingAccount ? (editForm.parentId || "") : newAccount.parentId}
                                onChange={(e) => editingAccount
                                    ? setEditForm({ ...editForm, parentId: e.target.value || undefined })
                                    : setNewAccount({ ...newAccount, parentId: e.target.value })
                                }
                            >
                                <option value="">Ninguna (Raíz)</option>
                                {accounts
                                    .filter(a => !editingAccount || a.id !== editingAccount.id) // Can't be its own parent
                                    .map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.code} - {a.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCreating(false);
                                    setEditingAccount(null);
                                    setCreatingChildFor(null);
                                }}
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-3 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
                            >
                                {editingAccount ? "Actualizar" : "Guardar"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function AccountNode({ node, onEdit, onDelete, onCreateChild }: {
    node: any;
    onEdit: (account: Account) => void;
    onDelete: (account: Account) => void;
    onCreateChild: (account: Account) => void;
}) {
    const [isOpen, setIsOpen] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="pl-4">
            <div
                className={cn(
                    "flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-100 transition-colors group",
                    !hasChildren && "pl-8"
                )}
            >
                <div
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => hasChildren && setIsOpen(!isOpen)}
                >
                    {hasChildren && (
                        <span className="text-gray-500">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                    )}
                    <span className={cn("text-gray-500", hasChildren ? "text-gray-900" : "text-gray-400")}>
                        {hasChildren ? <Folder className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <span className="font-mono text-sm text-gray-600 min-w-[60px]">{node.code}</span>
                    <span className="text-sm font-medium text-gray-900">{node.name}</span>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        {node.type}
                    </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onCreateChild(node);
                        }}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Agregar cuenta hija"
                    >
                        <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(node);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Editar cuenta"
                    >
                        <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(node);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Eliminar cuenta"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
            {hasChildren && isOpen && (
                <div className="border-l border-gray-200 ml-3">
                    {node.children.map((child: any) => (
                        <AccountNode
                            key={child.id}
                            node={child}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onCreateChild={onCreateChild}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
