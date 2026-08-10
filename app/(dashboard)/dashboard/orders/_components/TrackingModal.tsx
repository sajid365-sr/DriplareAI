"use client";

import { motion } from "framer-motion";
import { Truck, Copy, CheckCircle2, Clock, MapPin, Package, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OrderRow } from "./types";
import { StatusBadge } from "./StatusBadge";

interface TrackingModalProps {
  order: OrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrackingModal({ order, open, onOpenChange }: TrackingModalProps) {
  if (!order) return null;

  const copyTracking = () => {
    if (order.courierTrackingId) {
      navigator.clipboard.writeText(order.courierTrackingId);
      toast.success("Tracking ID copied to clipboard!");
    }
  };

  // Determine active tracking steps
  const steps = [
    { label: "Order Placed", date: order.createdAt, done: true },
    {
      label: "Dispatched to Courier",
      date: order.updatedAt,
      done: ["Dispatched", "Shipped", "In Transit", "Delivered", "Returned"].includes(order.status),
    },
    {
      label: "In Transit",
      done: ["Shipped", "In Transit", "Delivered"].includes(order.status),
    },
    {
      label: order.status === "Returned" ? "Returned to Merchant" : "Delivered to Customer",
      done: ["Delivered", "Returned"].includes(order.status),
      isFinal: true,
      error: order.status === "Returned",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 space-y-4 rounded-2xl bg-card border border-border">
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Truck className="w-5 h-5" />
            </span>
            Courier Tracking Details
          </DialogTitle>
          <DialogDescription className="text-xs">
            Real-time status feed for Order <span className="font-mono font-bold text-primary">#{order.orderId}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Courier & Tracking Header Banner */}
        <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-muted-foreground font-semibold">Courier Provider</p>
            <p className="text-xs font-bold text-foreground flex items-center gap-1.5 mt-0.5">
              <Truck className="w-3.5 h-3.5 text-primary" />
              {order.courierName || "Standard Express"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-muted-foreground font-semibold">Tracking Code</p>
            <button
              onClick={copyTracking}
              className="text-xs font-mono font-bold text-primary flex items-center gap-1 hover:underline mt-0.5"
            >
              {order.courierTrackingId || "Not Dispatched"}
              {order.courierTrackingId && <Copy className="w-3 h-3 ml-0.5 opacity-70" />}
            </button>
          </div>
        </div>

        {/* Timeline Status */}
        <div className="py-2 space-y-4">
          <p className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
            Shipment Timeline
          </p>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
            {steps.map((step, idx) => (
              <div key={idx} className="relative flex items-start justify-between text-xs">
                {/* Node Dot */}
                <div
                  className={`absolute -left-[23px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border ${
                    step.error
                      ? "bg-destructive text-destructive-foreground border-destructive"
                      : step.done
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted border-border text-muted-foreground"
                  }`}
                >
                  {step.error ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : step.done ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : (
                    <Clock className="w-3 h-3" />
                  )}
                </div>

                <div>
                  <p className={`font-semibold ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </p>
                  {step.done && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {idx === 0
                        ? new Date(order.createdAt).toLocaleString()
                        : "Updated via courier sync"}
                    </p>
                  )}
                </div>

                {idx === steps.length - 1 && (
                  <StatusBadge status={order.status} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Customer Address Info Summary */}
        <div className="pt-2 border-t border-border/50 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              Customer: <strong className="text-foreground">{order.customerName}</strong>
            </span>
            <span className="font-bold text-foreground">৳{order.totalAmount}</span>
          </div>

          {order.deliveryAddress && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
              {order.deliveryAddress} ({order.district || "Dhaka"})
            </p>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
