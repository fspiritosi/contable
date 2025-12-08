"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FilterOption = {
    label: string;
    value: string;
};

export type TableFiltersProps = {
    searchPlaceholder?: string;
    searchValue: string;
    onSearchChange: (value: string) => void;
    dateValue: string;
    onDateChange: (value: string) => void;
    statusValue?: string;
    onStatusChange?: (value: string) => void;
    statusOptions?: FilterOption[];
    hasActiveFilters: boolean;
    onClear: () => void;
    className?: string;
    children?: ReactNode;
};

export function TableFilters({
    searchPlaceholder = "Buscar",
    searchValue,
    onSearchChange,
    dateValue,
    onDateChange,
    statusValue,
    onStatusChange,
    statusOptions = [],
    hasActiveFilters,
    onClear,
    className,
    children,
}: TableFiltersProps) {
    const showStatusSelect = statusOptions.length > 0 && statusValue !== undefined && onStatusChange;

    return (
        <div className={cn("px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-3", className)}>
            <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={event => onSearchChange(event.target.value)}
                className="flex-1 min-w-[160px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
            <input
                type="date"
                value={dateValue}
                onChange={event => onDateChange(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-gray-900"
            />
            {showStatusSelect && (
                <select
                    value={statusValue}
                    onChange={event => onStatusChange(event.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                    {statusOptions.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            )}
            {children}
            {hasActiveFilters && (
                <button
                    type="button"
                    onClick={onClear}
                    className="text-sm text-gray-600 hover:text-gray-900"
                >
                    Limpiar filtros
                </button>
            )}
        </div>
    );
}
