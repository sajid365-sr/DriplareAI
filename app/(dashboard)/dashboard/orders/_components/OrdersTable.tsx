"use client";

import { RefreshCw, Truck, MoreVertical, Edit2, Navigation, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OrderRow } from "./types";
import { StatusBadge } from "./StatusBadge";
import { PaymentBadge } from "./PaymentBadge";

interface OrdersTableProps {
  orders: OrderRow[];
  loading: boolean;
  selectedOrderIds: string[];
  onSelectOrder: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onEdit: (order: OrderRow) => void;
  onTrack: (order: OrderRow) => void;
  onDelete: (order: OrderRow) => void;
}

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

export function OrdersTable({
  orders,
  loading,
  selectedOrderIds,
  onSelectOrder,
  onSelectAll,
  onEdit,
  onTrack,
  onDelete,
}: OrdersTableProps) {
  const isAllSelected =
    orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o.id));

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b border-border/40 text-[11px] uppercase font-semibold tracking-wide">
            <tr>
              <th className="p-4 w-10 text-center">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={(checked) => onSelectAll(!!checked)}
                  aria-label="Select all orders"
                />
              </th>
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
                  colSpan={10}
                  className="p-8 text-center text-muted-foreground text-sm"
                >
                  <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />
                  Loading orders...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="p-8 text-center text-muted-foreground text-sm"
                >
                  No orders found. Create a new order manually or wait for incoming orders from chat.
                </td>
              </tr>
            ) : (
              orders.map((ord) => {
                const isSelected = selectedOrderIds.includes(ord.id);
                return (
                  <tr
                    key={ord.id}
                    className={`transition-colors ${
                      isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                    }`}
                  >
                    {/* CHECKBOX */}
                    <td className="p-4 text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          onSelectOrder(ord.id, !!checked)
                        }
                        aria-label={`Select order ${ord.orderId}`}
                      />
                    </td>

                    {/* ORDER ID */}
                    <td className="p-4 font-mono font-bold text-primary text-xs">
                      {ord.orderId}
                    </td>

                    {/* CUSTOMER */}
                    <td className="p-4">
                      <p className="font-semibold text-foreground text-[12.5px]">
                        {ord.customerName}
                      </p>
                      {ord.customerPhone && (
                        <p className="text-[11px] text-muted-foreground font-mono">
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
                      <p className="truncate" title={getItemsSummary(ord.items)}>
                        {getItemsSummary(ord.items)}
                      </p>
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

                    {/* ACTIONS DROPDOWN */}
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem
                            onClick={() => onEdit(ord)}
                            className="gap-2 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            Edit Order
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => onTrack(ord)}
                            className="gap-2 cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5 text-primary" />
                            Track Courier
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => onDelete(ord)}
                            className="gap-2 text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
