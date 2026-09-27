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

interface BulkDeleteConfirmModalProps {
  selectedCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDelete: () => Promise<void>;
}

export function BulkDeleteConfirmModal({
  selectedCount,
  open,
  onOpenChange,
  onConfirmDelete,
}: BulkDeleteConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirmDelete();
      onOpenChange(false);
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
            Delete {selectedCount} Selected {selectedCount === 1 ? "Order" : "Orders"}?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to delete <strong className="text-foreground">{selectedCount}</strong> selected order(s)? This action will permanently remove all associated logs and tracking history from your database and cannot be undone.
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
            onClick={handleConfirm}
            disabled={deleting}
            className="text-xs font-bold gap-1.5"
          >
            {deleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Deleting Orders...
              </>
            ) : (
              `Delete ${selectedCount} Orders`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
