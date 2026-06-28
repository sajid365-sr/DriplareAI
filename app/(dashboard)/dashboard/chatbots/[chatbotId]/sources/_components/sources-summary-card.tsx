"use client";

import { FileText, Globe, Type, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

type SourceItem = {
  sourceId: string;
  type: "file" | "text" | "website";
  name: string;
  charCount: number;
};

interface SourcesSummaryCardProps {
  items: SourceItem[];
}

const CHAR_LIMIT = 1_000_000;

export function SourcesSummaryCard({ items }: SourcesSummaryCardProps) {
  const totalChars = items.reduce((sum, item) => sum + (item.charCount || 0), 0);
  const fillPercent = Math.min((totalChars / CHAR_LIMIT) * 100, 100);

  const fileCount = items.filter((i) => i.type === "file").length;
  const websiteCount = items.filter((i) => i.type === "website").length;
  const textCount = items.filter((i) => i.type === "text").length;

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6 p-3 sm:p-4 bg-card rounded-2xl border border-border/60 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="hidden sm:inline">Sources Summary</span>
      </div>

      <div className="h-6 w-px bg-border/50 hidden sm:block" />

      <div className="flex items-center gap-4 sm:gap-6 text-sm flex-wrap">
        <span className="text-muted-foreground">
          Total: <strong className="text-foreground">{items.length}</strong>
        </span>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-muted-foreground">
            <FileText className="w-3.5 h-3.5" /> {fileCount}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Globe className="w-3.5 h-3.5" /> {websiteCount}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Type className="w-3.5 h-3.5" /> {textCount}
          </span>
        </div>

        <div className="h-5 w-px bg-border/50" />

        <div className="flex items-center gap-2 min-w-[180px]">
          <span className="text-xs text-muted-foreground shrink-0">
            {totalChars.toLocaleString()} / {CHAR_LIMIT.toLocaleString()} chars
          </span>
          <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden min-w-[60px]">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-fuchsia-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${fillPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
