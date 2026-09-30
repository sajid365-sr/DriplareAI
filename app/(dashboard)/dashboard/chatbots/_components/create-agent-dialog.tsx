"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bot, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The quality tier a freshly created agent starts on.
 *
 * Deliberately the cheapest tier. A brand-new user has not described their
 * business yet, so picking a heavier model for them would be a guess that
 * quietly spends their credits. They raise it in the playground's AI Model
 * tab, where the credit cost of each tier sits next to the choice — which is
 * also why this dialog never asks for a model.
 */
const DEFAULT_CREATE_TIER = "fast";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Agents already created, and the plan's cap. Used for the quota hint. */
  used?: number;
  /** `null` / `undefined` means the plan has no cap (Enterprise). */
  limit?: number | null;
}

/**
 * CreateAgentDialog — the only entry point into the chatbot creation flow.
 *
 * It asks for one thing: the name. Everything else (model, prompt, knowledge,
 * channels) belongs to the workspace it drops the user into, so no decision is
 * ever made twice. Nothing is written to the database until the user confirms,
 * which matters most on the Starter plan where the single agent slot would
 * otherwise be consumed by an abandoned attempt.
 */
export function CreateAgentDialog({
  open,
  onOpenChange,
  used = 0,
  limit,
}: CreateAgentDialogProps) {
  const { t } = useTranslation("chatbots");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLimit = typeof limit === "number" && Number.isFinite(limit);
  const limitReached = hasLimit && used >= limit;

  // Clearing on close (rather than in an effect watching `open`) keeps the
  // reset tied to the user's own action and avoids a cascading render pass.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setError(null);
    }
    onOpenChange(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();

    if (!trimmed) {
      setError(t("create_dialog.name_required", "Please enter a name."));
      inputRef.current?.focus();
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          // Storing the tier key (not a concrete model id) keeps Simple mode
          // canonical: the playground then highlights the exact card that was
          // chosen, and admin can repoint the tier without touching this bot.
          promptMode: "simple",
          model: DEFAULT_CREATE_TIER,
          provider: "openrouter",
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // A 403 here is the plan limit, not a bug — show it in place so the
        // user can act on it (upgrade) instead of hunting a toast.
        const message =
          data?.error ||
          t("create_dialog.error_generic", "Failed to create the agent. Please try again.");
        setError(message);
        return;
      }

      // The toast carries the very next action, because the step that actually
      // makes the agent useful — teaching it about the business — now happens
      // somewhere else. Without this the merchant lands on a settings page with
      // no reason to know the Knowledge Base exists.
      toast.success(
        t("create_dialog.success", { name: trimmed, defaultValue: `"${trimmed}" created` }),
        {
          description: t(
            "create_dialog.success_hint",
            "Next: train it on your business in the Knowledge Base."
          ),
          duration: 8000,
          action: {
            label: t("create_dialog.train_now", "Train now"),
            onClick: () => router.push(`/dashboard/knowledge-base?botId=${data.chatbotId}`),
          },
        }
      );
      handleOpenChange(false);
      router.push(`/dashboard/chatbots/${data.chatbotId}/chat`);
    } catch {
      setError(
        t("create_dialog.error_generic", "Failed to create the agent. Please try again.")
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-white">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-base font-semibold">
                {t("create_dialog.title", "Create New AI Agent")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t(
                  "create_dialog.description",
                  "Give it a name to get started. You'll set up its model, prompt and knowledge next."
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name" className="text-sm font-semibold">
              {t("create_dialog.name_label", "Name")}
            </Label>
            <Input
              id="agent-name"
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("create_dialog.name_placeholder", "e.g. Trendirect Support")}
              className="h-11 rounded-xl"
              autoFocus
              disabled={creating || limitReached}
              aria-invalid={Boolean(error)}
              data-testid="create-agent-name"
            />
            {error ? (
              <p className="text-xs font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {hasLimit
                  ? t("create_dialog.quota", {
                      used,
                      limit,
                      defaultValue: "{{used}} of {{limit}} agents used",
                    })
                  : t("create_dialog.quota_unlimited", {
                      used,
                      defaultValue: "{{used}} agents created · Unlimited",
                    })}
              </p>
            )}
          </div>

          {limitReached && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive">
              {t("create_dialog.limit_reached", "You've reached your plan's agent limit.")}
            </div>
          )}

          {/* Plain flex row rather than `DialogFooter` — that component bakes in
              negative margins and a bordered strip, which fights the card look. */}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={creating}
            >
              {t("create_dialog.btn_cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={creating || limitReached || !name.trim()}
              className="bg-brand-gradient text-white shadow-md shadow-primary/20 hover:opacity-90"
              data-testid="create-agent-submit"
            >
              {creating && <Loader2 className="size-4 animate-spin" />}
              {creating
                ? t("create_dialog.btn_creating", "Creating…")
                : t("create_dialog.btn_create", "Create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
