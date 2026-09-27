"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DeleteProductModalProps = {
  isOpen: boolean;
  productName: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteProductModal({
  isOpen,
  productName,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteProductModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={isDeleting ? undefined : onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-2xl space-y-5"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Warning Icon Badge */}
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-xs">
              <AlertTriangle className="h-7 w-7" />
            </div>
          </div>

          {/* Content */}
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-foreground">Delete Product</h3>
            <p className="text-sm text-muted-foreground leading-relaxed px-2">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">“{productName}”</span>?
              This action cannot be undone.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-xl border-border/60 text-xs font-semibold h-10"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl text-xs font-semibold h-10 gap-2 shadow-xs"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Product
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
