"use client";

import { FileText, Globe, Type, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

type SourceItem = {
  sourceId: string;
  type: "file" | "text" | "website";
  name: string;
  charCount: number;
  content?: string;
};

interface KnowledgeBaseListProps {
  items: SourceItem[];
  onEdit: (source: SourceItem) => void;
  onDelete: (sourceId: string) => void;
}

const TYPE_ICON: Record<SourceItem["type"], React.ReactNode> = {
  file: <FileText className="w-4 h-4" />,
  website: <Globe className="w-4 h-4" />,
  text: <Type className="w-4 h-4" />,
};

export function KnowledgeBaseList({ items, onEdit, onDelete }: KnowledgeBaseListProps) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
        Knowledge Base
      </div>

      {items.length === 0 && (
        <div className="p-10 text-center text-muted-foreground text-sm">
          No sources yet. Add your first knowledge source above.
        </div>
      )}

      <AnimatePresence initial={false}>
        {items.map((source, index) => (
          <motion.div
            key={source.sourceId}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ delay: index * 0.04 }}
            className="px-6 py-4 flex items-center justify-between border-b border-border last:border-0 hover:bg-secondary/20 transition-colors"
            data-testid={`source-${source.sourceId}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {TYPE_ICON[source.type]}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate max-w-md">{source.name}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {source.charCount?.toLocaleString() || 0} chars · {source.type}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-4">
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-primary"
                onClick={() => onEdit(source)}
                data-testid={`edit-src-${source.sourceId}`}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(source.sourceId)}
                data-testid={`del-src-${source.sourceId}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
