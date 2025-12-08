import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SimpleTableHeader = {
    /**
     * Optional stable key for React when labels are ReactNode instances.
     */
    key?: string | number;
    /**
     * Header label. Supports rich content (buttons, badges, etc.).
     */
    label: ReactNode;
    align?: "left" | "center" | "right";
    className?: string;
};

type SimpleTableRow = {
    id?: string | number;
    cells: ReactNode[];
};

export type SimpleTableProps = {
    headers: SimpleTableHeader[];
    rows: SimpleTableRow[];
    emptyMessage?: string;
    hasWrapper?: boolean;
    wrapperClassName?: string;
    tableClassName?: string;
    showHeadersWhenEmpty?: boolean;
};

// Helper to map alignment tokens to Tailwind classes.
const getAlignClass = (align?: SimpleTableHeader["align"]) => {
    switch (align) {
        case "center":
            return "text-center";
        case "right":
            return "text-right";
        default:
            return "text-left";
    }
};

export function SimpleTable({
    headers,
    rows,
    emptyMessage = "Sin datos disponibles",
    hasWrapper = true,
    wrapperClassName,
    tableClassName,
    showHeadersWhenEmpty = false,
}: SimpleTableProps) {
    const defaultWrapperClass = "rounded-2xl border border-gray-200 bg-white overflow-x-auto";
    const shouldRenderTable = rows.length > 0 || showHeadersWhenEmpty;

    if (!shouldRenderTable) {
        const EmptyState = (
            <div className={cn("rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500", wrapperClassName)}>
                {emptyMessage}
            </div>
        );

        if (!hasWrapper) {
            return <div className={cn("text-sm text-gray-500", wrapperClassName)}>{emptyMessage}</div>;
        }

        return EmptyState;
    }

    const table = (
        <table className={cn("min-w-full divide-y divide-gray-200 text-sm", tableClassName)}>
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
                <tr>
                    {headers.map((header, index) => (
                        <th
                            key={header.key ?? `header-${index}`}
                            className={cn("px-6 py-3", getAlignClass(header.align), header.className)}
                        >
                            {header.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
                {rows.length ? (
                    rows.map((row, rowIndex) => (
                        <tr key={row.id ?? rowIndex}>
                            {row.cells.map((cell, cellIndex) => (
                                <td
                                    key={cellIndex}
                                    className={cn("px-6 py-4 text-gray-600", getAlignClass(headers[cellIndex]?.align))}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={Math.max(headers.length, 1)} className="px-6 py-6 text-center text-gray-500">
                            {emptyMessage}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    );

    if (!hasWrapper) {
        return table;
    }

    return <div className={cn(defaultWrapperClass, wrapperClassName)}>{table}</div>;
}
