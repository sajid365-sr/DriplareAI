"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { Automation } from "./types";

/**
 * Dry-run panel: type a sample customer message, see which rule wins and why
 * the others did not.
 *
 * The response comes from the same `evaluate()` the runtime calls, and the
 * route writes nothing, so this is a true preview rather than a simulation that
 * can drift from production.
 */

interface TestOutcome {
  automationId: string;
  name: string;
  matched: boolean;
  skipReason?: string;
  detail?: string;
}

interface TestResponse {
  targetMatched: boolean;
  winners: { automationId: string; name: string }[];
  outcomes: TestOutcome[];
  action: string;
  messages: { text?: string; mediaUrl?: string; quickReplies?: { label: string }[] }[];
  muteAi: boolean;
  mutedByRule: boolean;
  continueWithAi: boolean;
  suppressedByHuman: boolean;
  humanOwnsConversation: boolean;
}

const CHANNELS = ["facebook", "instagram", "whatsapp", "web"] as const;

export function TestRunDialog({
  automation,
  open,
  onOpenChange,
}: {
  automation: Automation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("automations");

  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<string>("facebook");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResponse | null>(null);

  // The caller mounts this with `key={automationId}`, so pointing it at another
  // rule remounts it and every field above starts clean. Stale results from a
  // previous rule are the one thing a preview must never show.

  async function run() {
    if (!automation || !message.trim()) return;
    setRunning(true);
    try {
      const response = await fetch(`/api/automations/${automation.automationId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), channel }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? t("test.failed", "Could not run the test."));
        return;
      }
      setResult(data as TestResponse);
    } catch {
      toast.error(t("test.failed", "Could not run the test."));
    } finally {
      setRunning(false);
    }
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setResult(null);
      setMessage("");
    }
  }

  if (!automation) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("test.title", "Test this rule")}</DialogTitle>
          <DialogDescription className="pt-2">
            {t(
              "test.subtitle",
              "Nothing is sent and nothing is saved — this only shows what would happen."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-message">{t("test.messageLabel", "Sample customer message")}</Label>
            <Input
              id="test-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !running) {
                  event.preventDefault();
                  void run();
                }
              }}
              placeholder={t("test.messagePlaceholder", "e.g. দাম কত?")}
              data-testid="test-run-message"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label>{t("test.channelLabel", "Channel")}</Label>
              <Select
                value={channel}
                // `null` means the selection was cleared, which this select has
                // no way to do — ignore it rather than blanking the channel.
                onValueChange={(value) => {
                  if (value) setChannel(value);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={run}
              disabled={running || !message.trim()}
              className="gap-2 border-none bg-brand-gradient text-white hover:opacity-90"
              data-testid="test-run-submit"
            >
              {running ? <Loader2 className="animate-spin" /> : <Play />}
              {running ? t("test.running", "Running…") : t("test.run", "Run test")}
            </Button>
          </div>
        </div>

        {/* ── Result ──────────────────────────────────────────────────────── */}
        {result && (
          <div className="space-y-3 border-t border-border/60 pt-3" data-testid="test-run-result">
            <div
              className={cn(
                "flex items-start gap-2 rounded-xl border p-3",
                result.targetMatched
                  ? "border-success/30 bg-success/10"
                  : "border-border bg-muted/30"
              )}
            >
              {result.targetMatched ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  {result.targetMatched
                    ? t("test.resultReply", "This rule replies")
                    : t("test.resultNoMatch", "This rule does not fire")}
                </p>
                {result.suppressedByHuman && (
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      "test.suppressedByHuman",
                      "A human owns this conversation, so the reply is held back."
                    )}
                  </p>
                )}
                {result.muteAi && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("test.mutedByRule", "This rule mutes the AI.")}
                  </p>
                )}
                {result.continueWithAi && (
                  <p className="text-[11px] text-muted-foreground">
                    {t("test.continueWithAi", "The AI will carry on after this reply.")}
                  </p>
                )}
              </div>
            </div>

            {result.messages.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("test.resultMessages", "What the customer would receive")}
                </p>
                {result.messages.map((out, index) => (
                  <div
                    key={index}
                    className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-2.5 text-xs text-foreground"
                  >
                    {out.text ?? out.mediaUrl}
                    {out.quickReplies && out.quickReplies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {out.quickReplies.map((button, buttonIndex) => (
                          <span
                            key={buttonIndex}
                            className="rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary"
                          >
                            {button.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("test.resultOutcomes", "Per-rule outcome")}
              </p>
              <ul className="space-y-1">
                {result.outcomes.map((outcome) => (
                  <li
                    key={outcome.automationId}
                    className="flex items-start justify-between gap-2 rounded-lg border border-border/50 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate text-xs text-foreground">
                      {outcome.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-right text-[11px]",
                        outcome.matched ? "font-semibold text-success" : "text-muted-foreground"
                      )}
                    >
                      {outcome.matched
                        ? t("outcome.matched", "Matched")
                        : t(`outcome.${outcome.skipReason}`, outcome.skipReason ?? "")}
                      {outcome.detail ? ` — ${outcome.detail}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
