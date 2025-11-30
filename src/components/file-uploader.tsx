'use client';

import { useState, useRef } from "react";
import { Upload, X, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getUploadUrl, saveAttachment, deleteAttachment } from "@/actions/storage";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
    organizationId: string;
    entityId?: string;
    entityType: 'invoice' | 'payment' | 'contact' | 'product' | 'organization';
    existingAttachments?: any[];
    onUploadComplete?: (attachment: any) => void;
    onDeleteComplete?: (attachmentId: string) => void;
    maxFiles?: number;
    acceptedFileTypes?: string[];
}

export default function FileUploader({
    organizationId,
    entityId,
    entityType,
    existingAttachments = [],
    onUploadComplete,
    onDeleteComplete,
    maxFiles = 5,
    acceptedFileTypes = ['image/*', 'application/pdf']
}: FileUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [attachments, setAttachments] = useState(existingAttachments);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (attachments.length >= maxFiles) {
            toast.error(`Máximo ${maxFiles} archivos permitidos`);
            return;
        }

        setIsUploading(true);
        const loadingToast = toast.loading("Subiendo archivo...");

        try {
            // 1. Get Presigned URL
            const { success, url, key, error } = await getUploadUrl(file.name, file.type);

            if (!success || !url || !key) {
                throw new Error(error || "Error al obtener URL de subida");
            }

            // 2. Upload to R2
            const uploadRes = await fetch(url, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type,
                },
            });

            if (!uploadRes.ok) {
                throw new Error("Error al subir archivo a R2");
            }

            // 3. Save metadata to DB
            const entityIdField = entityType === 'organization' ? undefined : entityId;
            const saveData: any = {
                organizationId,
                key: key,
                name: file.name,
                fileType: file.type,
                size: file.size,
            };

            // Only set the specific entity ID if it's not an organization
            if (entityType !== 'organization' && entityIdField) {
                saveData[`${entityType}Id`] = entityIdField;
            }

            const saveRes = await saveAttachment(saveData);

            if (!saveRes.success || !saveRes.data) {
                throw new Error(saveRes.error || "Error al guardar metadatos");
            }

            setAttachments([...attachments, saveRes.data]);
            onUploadComplete?.(saveRes.data);
            toast.success("Archivo subido exitosamente");

        } catch (error) {
            console.error(error);
            toast.error("Error al subir el archivo");
        } finally {
            toast.dismiss(loadingToast);
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleDelete = async (attachmentId: string) => {
        if (!confirm("¿Eliminar este archivo?")) return;

        const loadingToast = toast.loading("Eliminando...");

        try {
            const res = await deleteAttachment(attachmentId);

            if (res.success) {
                setAttachments(attachments.filter(a => a.id !== attachmentId));
                onDeleteComplete?.(attachmentId);
                toast.success("Archivo eliminado");
            } else {
                throw new Error(res.error);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar archivo");
        } finally {
            toast.dismiss(loadingToast);
        }
    };

    return (
        <div className="space-y-3">
            {/* Upload Button */}
            {attachments.length < maxFiles && (
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={acceptedFileTypes.join(',')}
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg transition-colors",
                            isUploading
                                ? "border-gray-300 bg-gray-50 cursor-not-allowed"
                                : "border-gray-300 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
                        )}
                    >
                        <Upload className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-600">
                            {isUploading ? "Subiendo..." : "Seleccionar archivo"}
                        </span>
                    </button>
                </div>
            )}

            {/* Attachments List */}
            {attachments.length > 0 && (
                <div className="space-y-2">
                    {attachments.map((attachment) => (
                        <div
                            key={attachment.id}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 group"
                        >
                            {attachment.fileType?.startsWith('image/') ? (
                                <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    <img
                                        src={attachment.url}
                                        alt={attachment.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                            ) : (
                                <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                                    <FileText className="h-5 w-5 text-gray-500" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                    {attachment.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {(attachment.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDelete(attachment.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
