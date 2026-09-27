/**
 * Displays the order status as a colored badge.
 */
export function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        Processing: "bg-warning/15 text-warning border-warning/30",
        Shipped: "bg-info/15 text-info border-info/30",
        Delivered: "bg-success/15 text-success border-success/30",
        Returned: "bg-destructive/15 text-destructive border-destructive/30",
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
