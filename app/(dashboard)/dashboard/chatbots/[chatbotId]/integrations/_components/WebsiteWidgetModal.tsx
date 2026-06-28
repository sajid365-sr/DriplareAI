"use client";

import { Check, Copy, Globe, Code2, MonitorSmartphone } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface WebsiteWidgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedCode: string;
  connecting: boolean;
  onCopy: () => void;
  onRefresh: () => void;
}

export function WebsiteWidgetModal({
  open,
  onOpenChange,
  embedCode,
  connecting,
  onCopy,
  onRefresh,
}: WebsiteWidgetModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Website Widget
          </DialogTitle>
          <DialogDescription>
            Add your AI chatbot to any website by pasting this embed code before the closing
            <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs font-semibold">&lt;/body&gt;</code>
            tag.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Preview card */}
          <div className="flex items-center gap-4 rounded-xl border border-border bg-gradient-to-br from-primary/5 to-secondary/30 p-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <MonitorSmartphone className="size-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold">Chat Widget</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A floating chat bubble will appear at the bottom-right corner of your website.
                Visitors can click it to start a conversation with your AI agent.
              </p>
            </div>
          </div>

          {/* Embed code */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Embed Code
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
                className="absolute right-2 top-2 rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Installation Steps
            </p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                Copy the embed code above
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                Open your website&apos;s HTML file or CMS header/footer settings
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                Paste the code just before the <code className="rounded bg-muted px-1 py-0.5 font-semibold">&lt;/body&gt;</code> tag
              </li>
              <li className="flex items-start gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">4</span>
                Save and reload your website — the chat widget will appear!
              </li>
            </ol>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl text-xs sm:text-sm">
            Close
          </Button>
          <Button onClick={handleCopy} className="rounded-xl text-xs sm:text-sm gap-1.5">
            {copied ? (
              <><Check className="size-4" /> Copied!</>
            ) : (
              <><Copy className="size-4" /> Copy Embed Code</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
