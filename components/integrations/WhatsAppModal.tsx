"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Settings2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type WhatsAppForm = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
};

interface WhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  embeddedAvailable: boolean;
  form: WhatsAppForm;
  onFormChange: (form: WhatsAppForm) => void;
  onEmbeddedConnect: () => void;
  onManualConnect: () => void;
}

export const WhatsAppModal = ({
  open,
  onOpenChange,
  loading,
  embeddedAvailable,
  form,
  onFormChange,
  onEmbeddedConnect,
  onManualConnect,
}: WhatsAppModalProps) => {
  const { t } = useTranslation("chatbots");
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("whatsapp_modal.title")}</DialogTitle>
          <DialogDescription>{t("whatsapp_modal.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-foreground">{t("whatsapp_modal.embeddedTitle")}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("whatsapp_modal.embeddedDescription")}
                </p>
              </div>
            </div>
            {!embeddedAvailable ? (
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs text-muted-foreground">
                {t("whatsapp_modal.embeddedUnavailable")}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={onEmbeddedConnect}
            disabled={loading || !embeddedAvailable}
            className="w-full rounded-xl"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
            {t("whatsapp_modal.continueWithMeta")}
          </Button>

          <div className="border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between rounded-xl text-muted-foreground"
              onClick={() => setShowAdvanced((value) => !value)}
            >
              <span className="inline-flex items-center gap-2">
                <Settings2 className="size-4" />
                {t("whatsapp_modal.advancedSetup")}
              </span>
              <span className="text-xs">{showAdvanced ? t("whatsapp_modal.hide") : t("whatsapp_modal.show")}</span>
            </Button>
          </div>

          {showAdvanced ? (
            <div className="space-y-4 rounded-xl border border-border bg-background p-4">
              <p className="text-xs leading-relaxed text-muted-foreground">{t("whatsapp_modal.advancedDescription")}</p>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{t("whatsapp_modal.accessToken")}</label>
                <input
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="EAAG..."
                  value={form.accessToken}
                  onChange={(event) => onFormChange({ ...form, accessToken: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{t("whatsapp_modal.phoneNumberId")}</label>
                <input
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="1092..."
                  value={form.phoneNumberId}
                  onChange={(event) => onFormChange({ ...form, phoneNumberId: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">{t("whatsapp_modal.wabaId")}</label>
                <input
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="1029..."
                  value={form.wabaId}
                  onChange={(event) => onFormChange({ ...form, wabaId: event.target.value })}
                />
              </div>

              <Button type="button" onClick={onManualConnect} disabled={loading} className="w-full rounded-xl">
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("whatsapp_modal.verifyAndConnect")}
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t("whatsapp_modal.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
