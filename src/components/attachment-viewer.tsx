'use client';

import { Download, FileText, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type AttachmentItem = {
    id: string;
    name: string;
    fileType: string;
    size: number;
    url: string;
    createdAt?: string;
};

interface AttachmentViewerProps {
    attachments: AttachmentItem[];
    emptyStateLabel?: string;
    className?: string;
    compact?: boolean;
}

export default function AttachmentViewer({ attachments, emptyStateLabel = "No hay archivos adjuntos", className, compact = false }: AttachmentViewerProps) {
    if (!attachments.length) {
        return (
            <div className={cn("text-center text-sm text-gray-500", className)}>
                {emptyStateLabel}
            </div>
        );
    }

    return (
        <div className={cn("space-y-3", className)}>
            {attachments.map(file => {
                const isImage = file.fileType?.startsWith("image/");
                const sizeInKb = (file.size / 1024).toFixed(1);
                return (
                    <div
                        key={file.id}
                        className={cn(
                            "flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3",
                            compact && "px-3 py-2"
                        )}
                    >
                        <div className="flex-shrink-0">
                            {isImage ? (
                                <div className="h-12 w-12 overflow-hidden rounded-lg bg-white shadow-sm">
                                    <img src={file.url} alt={file.name} className="h-full w-full object-cover" />
                                </div>
                            ) : (
                                <div className="h-12 w-12 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                    <FileText className="h-5 w-5 text-gray-500" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                                {file.fileType || 'Archivo'} · {sizeInKb} KB
                                {file.createdAt && ` · ${new Date(file.createdAt).toLocaleDateString('es-AR')}`}
                            </p>
                        </div>
                        <Link
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
                        >
                            <Download className="h-4 w-4" /> Ver
                        </Link>
                    </div>
                );
            })}
        </div>
    );
}
