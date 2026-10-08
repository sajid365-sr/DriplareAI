"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface TextTabProps {
  chatbotId: string;
  onSuccess: () => void;
}

export function TextTab({ chatbotId, onSuccess }: TextTabProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const addText = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sources/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Text", content: text }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to add text" }));
        throw new Error(err.error || "Failed to add text");
      }

      setText("");
      toast.success("Text knowledge source added successfully");
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add text";
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
      <Label className="text-xs font-semibold uppercase text-muted-foreground">
        Manual Content
      </Label>
      <Textarea
        rows={10}
        placeholder="Paste your text knowledge here..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="rounded-2xl bg-secondary/10 focus:ring-primary/20"
        data-testid="src-text-input"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{text.length.toLocaleString()} characters</span>
        <Button
          onClick={addText}
          disabled={busy || !text.trim()}
          className="rounded-full"
          data-testid="src-text-add"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Text"}
        </Button>
      </div>
    </motion.div>
  );
}
