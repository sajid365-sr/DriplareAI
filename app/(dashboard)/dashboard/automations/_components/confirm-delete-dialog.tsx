"use client";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Delete confirmation, shared by rules, templates and broadcasts.
 *
 * Deliberately local rather than reusing `components/modals/confirm-modal.tsx`:
 * that shared modal hard-codes "Cancel" and "Confirm" in English, which would
 * put untranslated buttons in front of a Bangla merchant on the most
 * irreversible actions in this tab.
 *
 * The copy is passed in rather than derived from a `kind` prop because the
 * consequence differs every time — deleting a rule keeps its history, deleting a
 * broadcast erases a delivery record — and a switch statement over nouns would
 * make each of those sentences harder to find than writing it at the call site.
 */
export function ConfirmDeleteDialog({
  open,
  title,
  body,
  busy,
  testId,
  confirmLabel,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  busy: boolean;
  testId: string;
  confirmLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation("automations");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="pt-2">{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-full"
          >
            {t("builder.cancel", "Cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full px-6"
            data-testid={testId}
          >
            {confirmLabel ?? t("menu.delete", "Delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
