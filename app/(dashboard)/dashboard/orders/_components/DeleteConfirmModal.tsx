"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { OrderRow } from "./types";

interface DeleteConfirmModalProps {
  order: OrderRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteConfirmModal({
  order,
  open,
  onOpenChange,
  onDeleted,
}: DeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  if (!order) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Order #${order.orderId} deleted successfully.`);
        onDeleted();
        onOpenChange(false);
      } else {
        toast.error(data.error || "Failed to delete order");
      }
    } catch {
      toast.error("An error occurred while deleting order");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 space-y-4 rounded-2xl bg-card border border-border">
        <DialogHeader>
          <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Delete Order #{order.orderId}?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete order for{" "}
            <strong className="text-foreground">{order.customerName}</strong>? This action cannot be undone and will remove all associated shipment tracking logs.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-4 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-bold gap-1.5"
          >
            {deleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              "Confirm Delete"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
