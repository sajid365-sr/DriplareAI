"use client";

import { RefreshCw, Truck, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderRow } from "./types";
import { StatusBadge } from "./StatusBadge";
import { PaymentBadge } from "./PaymentBadge";

interface OrdersTableProps {
    orders: OrderRow[];
    loading: boolean;
}

// ── Utility helpers (pure, no state) ───────────────────────────────────────────

/** Format an ISO date string into a date + time block. */
function FormatDateTime({ iso }: { iso: string }) {
    const d = new Date(iso);
    return (
        <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-foreground">
                {d.toLocaleDateString("en-GB")}
            </span>
            <span className="text-[10px] text-muted-foreground">
                {d.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "numeric",
                    hour12: true,
                })}
            </span>
        </div>
    );
}

/** Produce a short human-readable summary of the order items. */
function getItemsSummary(items: OrderRow["items"]): string {
    if (!Array.isArray(items) || items.length === 0) return "—";
    const first = items[0];
    const extra = items.length > 1 ? ` +${items.length - 1} more` : "";
    return `${first.name} ×${first.qty}${extra}`;
}

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Renders the orders data table with loading and empty states.
 */
export function OrdersTable({ orders, loading }: OrdersTableProps) {
    return (
        <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50 text-muted-foreground border-b border-border/40 text-[11px] uppercase font-semibold tracking-wide">
                        <tr>
                            <th className="p-4 whitespace-nowrap">Order ID</th>
                            <th className="p-4 whitespace-nowrap">Customer</th>
                            <th className="p-4 whitespace-nowrap">Item Details</th>
                            <th className="p-4 whitespace-nowrap">Amount</th>
                            <th className="p-4 whitespace-nowrap">Courier & Tracking</th>
                            <th className="p-4 whitespace-nowrap">Payment (COD)</th>
                            <th className="p-4 whitespace-nowrap">Status</th>
                            <th className="p-4 whitespace-nowrap">Date & Time</th>
                            <th className="p-4 text-right whitespace-nowrap">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="p-8 text-center text-muted-foreground text-sm"
                                >
                                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                                    Loading orders...
                                </td>
                            </tr>
                        ) : orders.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={9}
                                    className="p-8 text-center text-muted-foreground text-sm"
                                >
                                    No orders found. Create a new order from Live Inbox or
                                    manually.
                                </td>
                            </tr>
                        ) : (
                            orders.map((ord) => (
                                <OrderRow key={ord.id} row={ord} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Single table row ───────────────────────────────────────────────────────────

function OrderRow({ row: ord }: { row: OrderRow }) {
    return (
        <tr className="hover:bg-muted/30 transition-colors">
            {/* ORDER ID */}
            <td className="p-4 font-mono font-bold text-primary text-sm">
                {ord.orderId}
            </td>

            {/* CUSTOMER */}
            <td className="p-4">
                <p className="font-semibold text-foreground text-[12.5px]">
                    {ord.customerName}
                </p>
                {ord.customerPhone && (
                    <p className="text-[11px] text-muted-foreground">
                        {ord.customerPhone}
                    </p>
                )}
                {ord.district && (
                    <p className="text-[10.5px] text-muted-foreground/70">
                        {ord.district}
                    </p>
                )}
            </td>

            {/* ITEM DETAILS */}
            <td className="p-4 text-[12px] text-muted-foreground max-w-[160px]">
                <p className="truncate">{getItemsSummary(ord.items)}</p>
            </td>

            {/* AMOUNT */}
            <td className="p-4">
                <p className="font-bold text-foreground text-[13px]">
                    ৳{Number(ord.totalAmount).toLocaleString()}
                </p>
                <p className="text-[10.5px] text-muted-foreground">
                    {ord.paymentMethod}
                </p>
            </td>

            {/* COURIER & TRACKING */}
            <td className="p-4">
                <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-secondary border border-border w-fit">
                        <Truck className="w-3 h-3 text-muted-foreground" />
                        {ord.courierName ?? "—"}
                    </span>
                    {ord.courierTrackingId && (
                        <span className="font-mono text-[10.5px] text-primary font-semibold">
                            {ord.courierTrackingId}
                        </span>
                    )}
                </div>
            </td>

            {/* PAYMENT STATUS (COD) */}
            <td className="p-4">
                <PaymentBadge
                    method={ord.paymentMethod}
                    paymentStatus={ord.paymentStatus}
                />
            </td>

            {/* STATUS */}
            <td className="p-4">
                <StatusBadge status={ord.status} />
            </td>

            {/* DATE & TIME */}
            <td className="p-4">
                <FormatDateTime iso={ord.createdAt} />
            </td>

            {/* ACTION */}
            <td className="p-4 text-right">
                <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Details
                    <ArrowUpRight className="w-3 h-3" />
                </Button>
            </td>
        </tr>
    );
}
