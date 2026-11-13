"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface TextTabProps {
  chatbotId?: string;
  workspaceId?: string;
  onSuccess: () => void;
}

export function TextTab({ chatbotId, workspaceId, onSuccess }: TextTabProps) {
  const { t } = useTranslation("knowledge-base");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const addText = async () => {
    if (!title.trim() || !text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(workspaceId ? `/api/workspaces/${workspaceId}/sources` : `/api/chatbots/${chatbotId}/sources/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title.trim(), content: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add text" }));
        throw new Error(err.error || "Failed to add text");
      }

      setTitle("");
      setText("");
      toast.success(t("contentTraining.textSaved", "Text knowledge source added successfully"));
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("contentTraining.textSaveError", "Failed to add text");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="src-text-title" className="text-xs font-semibold uppercase text-muted-foreground">
          {t("contentTraining.textTitle", "Text title")}
        </Label>
        <Input
          id="src-text-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("contentTraining.textTitlePlaceholder", "e.g. Delivery policy")}
          maxLength={160}
          className="h-11 rounded-xl bg-secondary/10"
          data-testid="src-text-title"
          required
        />
      </div>
      <Label htmlFor="src-text-input" className="text-xs font-semibold uppercase text-muted-foreground">
        {t("contentTraining.manualContent", "Manual content")}
      </Label>
      <Textarea
        id="src-text-input"
        rows={10}
        placeholder={t("contentTraining.textPlaceholder", "Paste your text knowledge here...")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="rounded-2xl bg-secondary/10 focus:ring-primary/20"
        data-testid="src-text-input"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {text.length.toLocaleString()} {t("contentTraining.characters", "characters")}
        </span>
        <Button
          onClick={addText}
          disabled={busy || !title.trim() || !text.trim()}
          className="rounded-full"
          data-testid="src-text-add"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("contentTraining.addText", "Add text")}
        </Button>
      </div>
    </motion.div>
  );
}
