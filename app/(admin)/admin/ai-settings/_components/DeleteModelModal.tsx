"use client";

import { Trans, useTranslation } from "react-i18next";
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
  const { t } = useTranslation("admin");

  return (
    <Dialog open={!!modelToDelete} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle className="text-base font-bold">
            {t("aiSettings.deleteModal.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey="aiSettings.deleteModal.description"
              values={{ name: modelToDelete?.name, id: modelToDelete?.id }}
              components={[
                <span key="name" className="font-semibold text-foreground" />,
                <span key="id" className="font-mono text-muted-foreground" />,
              ]}
            />
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
            {t("aiSettings.deleteModal.cancel")}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl text-xs gap-1.5"
          >
            {deleting ? t("aiSettings.deleteModal.deleting") : t("aiSettings.deleteModal.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
