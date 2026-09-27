/**
 * Displays the payment method and paid/pending status.
 */
export function PaymentBadge({
    method,
    paymentStatus,
}: {
    method: string;
    paymentStatus: string;
}) {
    const isPaid = paymentStatus === "paid";

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold text-foreground">{method}</span>
            <span
                className={`text-[10px] font-bold ${isPaid ? "text-emerald-500" : "text-amber-500"}`}
            >
                {isPaid ? "✓ Paid" : "Pending"}
            </span>
        </div>
    );
}
