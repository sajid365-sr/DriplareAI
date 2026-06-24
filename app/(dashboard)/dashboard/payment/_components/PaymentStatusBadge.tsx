import { cn } from "@/lib/core/utils";

const STATUS_LABELS: Record<string, string> = {
  complete: "Complete",
  pending: "Pending",
  failed: "Failed",
  cancelled: "Cancelled",
  initiated: "Initiated",
};

const STATUS_STYLES: Record<string, string> = {
  complete: "border-primary/20 bg-primary/10 text-primary",
  pending: "border-border bg-accent text-accent-foreground",
  failed: "border-destructive/20 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted text-muted-foreground",
  initiated: "border-border bg-secondary text-secondary-foreground",
};

interface PaymentStatusBadgeProps {
  status: string;
  label?: string;
}

export function PaymentStatusBadge({ status, label }: PaymentStatusBadgeProps) {
  const normalizedStatus = status || "pending";

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-[10px] font-bold uppercase tracking-wide",
        STATUS_STYLES[normalizedStatus] || "border-border bg-muted text-muted-foreground"
      )}
    >
      {label || STATUS_LABELS[normalizedStatus] || normalizedStatus}
    </span>
  );
}
