import { ReactNode } from "react";

const toneStyles = {
    default: {
        icon: "bg-gray-100 text-gray-700",
        value: "text-gray-900",
    },
    success: {
        icon: "bg-emerald-100 text-emerald-600",
        value: "text-emerald-600",
    },
    danger: {
        icon: "bg-rose-100 text-rose-600",
        value: "text-rose-600",
    },
    warning: {
        icon: "bg-amber-100 text-amber-600",
        value: "text-amber-600",
    },
} as const;


type StatCardProps = {
    title: string;
    value: string;
    helper?: string;
    icon: ReactNode;
    tone?: keyof typeof toneStyles;
    footer?: ReactNode;
};

export function StatCard({ title, value, helper, icon, tone = "default", footer }: StatCardProps) {
    const styles = toneStyles[tone];
    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500">{title}</p>
                    {helper && <p className="text-xs text-gray-400">{helper}</p>}
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${styles.icon}`}>
                    {icon}
                </div>
            </div>
            <div className={`text-3xl font-semibold ${styles.value}`}>{value}</div>
            {footer && <div className="text-xs text-gray-500">{footer}</div>}
        </div>
    );
}