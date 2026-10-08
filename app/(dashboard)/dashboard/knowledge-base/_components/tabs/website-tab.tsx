"use client";

import { useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface WebsiteTabProps {
  chatbotId: string;
  onSuccess: () => void;
}

export function WebsiteTab({ chatbotId, onSuccess }: WebsiteTabProps) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const addUrl = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sources/website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to fetch website" }));
        throw new Error(err.error || "Failed to fetch website");
      }

      setUrl("");
      toast.success("Website content fetched and added successfully");
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch website";
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
        Website URL
      </Label>
      <div className="relative">
        <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="https://example.com/docs"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addUrl()}
          className="h-11 rounded-xl bg-secondary/10 pl-10"
          data-testid="src-url-input"
        />
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 text-xs text-primary/80 leading-relaxed">
        We&apos;ll crawl the provided URL, extract the text content, and clean it automatically
        for training your AI agent.
      </div>

      <Button
        onClick={addUrl}
        disabled={busy || !url.trim()}
        className="rounded-full"
        data-testid="src-url-add"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crawl & Add"}
      </Button>
    </motion.div>
  );
}
