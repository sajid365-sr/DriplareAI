"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type OpenRouterModelConfig } from "@/components/admin/ai-settings/ModelConfigSheet";

interface DeleteModelModalProps {
  modelToDelete: OpenRouterModelConfig | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

export function DeleteModelModal({
  modelToDelete,
  onClose,
  onConfirm,
  deleting,
}: DeleteModelModalProps) {
  return (
    <Dialog open={!!modelToDelete} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold">Delete AI Model</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{modelToDelete?.name}</span> (
            <span className="font-mono text-muted-foreground">{modelToDelete?.id}</span>)?
            This will remove it from the catalog and database settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl text-xs gap-1.5"
          >
            {deleting ? "Deleting…" : "Delete Model"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
