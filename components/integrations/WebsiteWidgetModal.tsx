"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Code2, Copy, Globe, MonitorSmartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WebsiteWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedCode: string;
  onCopy: () => void;
}

/**
 * WebsiteWidgetModal — hands the merchant the script tag that puts their agent
 * on any website.
 *
 * Moved here from the retired per-chatbot integrations page, which was the only
 * place this flow existed. Its strings are now translated: it shipped with every
 * label hardcoded in English, which the project does not allow for merchant UI.
 */
export function WebsiteWidgetModal({
  open,
  onOpenChange,
  embedCode,
  onCopy,
}: WebsiteWidgetModalProps) {
  const { t } = useTranslation("integrations");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeTag = (
    <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-semibold">
      &lt;/body&gt;
    </code>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            {t("website_widget.title", "Website Widget")}
          </DialogTitle>
          {/* Split around the tag so it can keep its code styling — the inline
              element sits mid-sentence in both languages. */}
          <DialogDescription>
            {t(
              "website_widget.descBefore",
              "Add your AI chatbot to any website by pasting this embed code before the closing"
            )}
            {closeTag}
            {t("website_widget.descAfter", "tag.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Preview card */}
          <div className="flex items-center gap-4 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-secondary/30 p-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <MonitorSmartphone className="size-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold">
                {t("website_widget.previewTitle", "Chat Widget")}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(
                  "website_widget.previewBody",
                  "A floating chat bubble will appear at the bottom-right corner of your website. Visitors can click it to start a conversation with your AI agent."
                )}
              </p>
            </div>
          </div>

          {/* Embed code */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("website_widget.embedLabel", "Embed Code")}
            </label>
            <div className="relative">
              <div className="absolute left-3 top-3 text-muted-foreground">
                <Code2 className="size-4" />
              </div>
              <textarea
                readOnly
                value={embedCode}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-muted/30 px-9 py-2.5 text-xs font-mono text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={handleCopy}
                className="absolute right-2 top-2 cursor-pointer rounded-lg border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title={t("website_widget.copyTitle", "Copy to clipboard")}
              >
                {copied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("website_widget.stepsTitle", "Installation Steps")}
            </p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <StepNumber>1</StepNumber>
                {t("website_widget.step1", "Copy the embed code above")}
              </li>
              <li className="flex items-start gap-2">
                <StepNumber>2</StepNumber>
                {t(
                  "website_widget.step2",
                  "Open your website's HTML file or CMS header/footer settings"
                )}
              </li>
              <li className="flex items-start gap-2">
                <StepNumber>3</StepNumber>
                <span>
                  {t("website_widget.step3Before", "Paste the code just before the")}
                  {closeTag}
                  {t("website_widget.step3After", "tag")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <StepNumber>4</StepNumber>
                {t(
                  "website_widget.step4",
                  "Save and reload your website — the chat widget will appear!"
                )}
              </li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs sm:text-sm"
          >
            {t("website_widget.btnClose", "Close")}
          </Button>
          <Button onClick={handleCopy} className="rounded-xl text-xs sm:text-sm gap-1.5">
            {copied ? (
              <>
                <Check className="size-4" />
                {t("website_widget.btnCopied", "Copied!")}
              </>
            ) : (
              <>
                <Copy className="size-4" />
                {t("website_widget.btnCopy", "Copy Embed Code")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The numbered bullet shared by every installation step. */
function StepNumber({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
      {children}
    </span>
  );
}
