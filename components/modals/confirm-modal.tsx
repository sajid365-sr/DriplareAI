"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/hooks/use-confirm";
import { useEffect, useState } from "react";

export const ConfirmModal = () => {
  const { isOpen, title, message, onConfirm, onClose } = useConfirm();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          <Button variant="ghost" onClick={onClose} className="rounded-full">
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm}
            className="rounded-full px-6"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
