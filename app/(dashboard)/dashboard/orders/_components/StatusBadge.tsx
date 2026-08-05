/**
 * Displays the order status as a colored badge.
 */
export function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        Processing: "bg-amber-500/15 text-amber-500 border-amber-500/30",
        Shipped: "bg-blue-500/15 text-blue-500 border-blue-500/30",
        Delivered: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
        Returned: "bg-red-500/15 text-red-500 border-red-500/30",
    };

    return (
        <span
            className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border ${colors[status] ?? "bg-muted text-muted-foreground border-border"
                }`}
        >
            {status}
        </span>
    );
}
