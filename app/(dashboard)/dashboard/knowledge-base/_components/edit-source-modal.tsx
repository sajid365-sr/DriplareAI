"use client";

import { useState, useCallback, useMemo } from "react";
import { FileText, Pencil, Save, X, Loader2, MessageSquare, Check } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SourceItem = {
  sourceId: string;
  type: "file" | "text" | "website";
  name: string;
  charCount: number;
  content?: string;
};

interface EditSourceModalProps {
  source: SourceItem | null;
  editValue: string;
  editUrl: string;
  busy: boolean;
  onEditValueChange: (v: string) => void;
  onEditUrlChange: (v: string) => void;
  onSave: () => void;
  onDelete: (sourceId: string) => void;
  onClose: () => void;
}

// ─── Chat History Parser ──────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "customer" | "owner";
  text: string;
  conversationIdx: number;
};

function parseChatContent(text: string): ChatMessage[] | null {
  const messages: ChatMessage[] = [];
  let found = false;

  // Handles both multi-line (\n separated) and flattened (normalized by replace(/\s+/g, ' ')) formats
  const regex = /\[Conversation (\d+)\]\s*Customer:\s*(.*?)\s*Owner:\s*(.*?)(?=\s*\[Conversation|\s*$)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    found = true;
    const convIdx = parseInt(match[1]);
    messages.push(
      { id: `c-${convIdx}-${messages.length}`, role: "customer", text: match[2].trim(), conversationIdx: convIdx },
      { id: `o-${convIdx}-${messages.length}`, role: "owner", text: match[3].trim(), conversationIdx: convIdx },
    );
  }

  return found ? messages : null;
}

function reconstructChatContent(messages: ChatMessage[]): string {
  const grouped = new Map<number, ChatMessage[]>();
  for (const msg of messages) {
    if (!grouped.has(msg.conversationIdx)) grouped.set(msg.conversationIdx, []);
    grouped.get(msg.conversationIdx)!.push(msg);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([idx, msgs]) => {
      const customer = msgs.find((m) => m.role === "customer")?.text || "";
      const owner = msgs.find((m) => m.role === "owner")?.text || "";
      return `[Conversation ${idx}]\nCustomer: ${customer}\nOwner: ${owner}`;
    })
    .join("\n\n");
}

// ─── Chat Bubble Component ────────────────────────────────────────────────────

function ChatBubble({
  msg,
  isEditing,
  editText,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
}: {
  msg: ChatMessage;
  isEditing: boolean;
  editText: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}) {
  const isCustomer = msg.role === "customer";

  return (
    <div className={cn("flex", isCustomer ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
          isCustomer
            ? "bg-muted text-foreground rounded-bl-sm"
            : "bg-primary text-primary-foreground rounded-br-sm"
        )}
      >
        {isEditing ? (
          <div className="space-y-2 min-w-[250px] sm:min-w-[300px]">
            <textarea
              value={editText}
              onChange={(e) => onEditChange(e.target.value)}
              className={cn(
                "w-full bg-transparent resize-y outline-none text-sm leading-relaxed min-h-[80px] max-h-[200px]",
                isCustomer ? "text-foreground" : "text-primary-foreground placeholder:text-primary-foreground/60"
              )}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSaveEdit(); }
                if (e.key === "Escape") onCancelEdit();
              }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCancelEdit}
                className="text-xs px-3 py-1.5 rounded-md bg-black/10 hover:bg-black/20 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={onSaveEdit}
                className="text-xs px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors font-medium flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={onStartEdit}
            className="cursor-pointer hover:opacity-80 transition-opacity min-w-[40px]"
          >
            {msg.text || <span className="italic opacity-60">empty</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EditSourceModal({
  source,
  editValue,
  editUrl,
  busy,
  onEditValueChange,
  onEditUrlChange,
  onSave,
  onDelete,
  onClose,
}: EditSourceModalProps) {
  const chatMessages = useMemo(() => parseChatContent(editValue), [editValue]);
  const isChatFormat = chatMessages !== null;

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const handleStartEdit = useCallback((msg: ChatMessage) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.text);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingMsgId || !chatMessages) return;
    const updated = chatMessages.map((m) =>
      m.id === editingMsgId ? { ...m, text: editingText } : m
    );
    onEditValueChange(reconstructChatContent(updated));
    setEditingMsgId(null);
    setEditingText("");
  }, [editingMsgId, editingText, chatMessages, onEditValueChange]);

  const handleCancelEdit = useCallback(() => {
    setEditingMsgId(null);
    setEditingText("");
  }, []);

  // Group messages by conversation for display
  const conversations = useMemo(() => {
    if (!chatMessages) return [];
    const grouped = new Map<number, ChatMessage[]>();
    for (const msg of chatMessages) {
      if (!grouped.has(msg.conversationIdx)) grouped.set(msg.conversationIdx, []);
      grouped.get(msg.conversationIdx)!.push(msg);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a - b);
  }, [chatMessages]);

  return (
    <AnimatePresence>
      {source && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b border-border flex items-center justify-between bg-secondary/10">
              <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                {isChatFormat ? "Chat History" : "Edit Source"}
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {source.type === "file" ? (
                <div className="text-center py-6 sm:py-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="font-medium text-foreground">
                    File sources cannot be edited directly.
                  </div>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    To update a PDF or Word document, please delete this source and upload a new
                    version.
                  </p>
                </div>
              ) : (
                <>
                  {source.type === "website" && (
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">
                        Website URL (Changing this will re-crawl)
                      </Label>
                      <Input
                        value={editUrl}
                        onChange={(e) => onEditUrlChange(e.target.value)}
                        className="rounded-xl bg-secondary/10"
                      />
                    </div>
                  )}

                  {source.type === "text" && isChatFormat ? (
                    <div className="space-y-6">
                      {conversations.map(([convIdx, msgs]) => (
                        <div key={convIdx} className="space-y-2">
                          {/* Conversation separator */}
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Conversation {convIdx}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                          </div>

                          {/* Messages */}
                          <div className="space-y-2">
                            {msgs.map((msg) => (
                              <ChatBubble
                                key={msg.id}
                                msg={msg}
                                isEditing={editingMsgId === msg.id}
                                editText={editingMsgId === msg.id ? editingText : ""}
                                onStartEdit={() => handleStartEdit(msg)}
                                onEditChange={setEditingText}
                                onSaveEdit={handleSaveEdit}
                                onCancelEdit={handleCancelEdit}
                              />
                            ))}
                          </div>
                        </div>
                      ))}

                      {/* Click hint */}
                      <p className="text-center text-[11px] text-muted-foreground/60">
                        Click any message to edit it
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase text-muted-foreground">
                        {source.type === "website" ? "Manual Content Override" : "Text Content"}
                      </Label>
                      <Textarea
                        rows={16}
                        value={editValue}
                        onChange={(e) => onEditValueChange(e.target.value)}
                        className="rounded-xl bg-secondary/10 font-sans leading-relaxed max-h-[400px]"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-secondary/5 flex flex-wrap justify-end gap-2 sm:gap-3">
              <Button variant="ghost" onClick={onClose} className="rounded-full text-xs sm:text-sm">
                Cancel
              </Button>

              {source.type !== "file" && (
                <Button onClick={onSave} disabled={busy} className="rounded-full px-6 text-xs sm:text-sm">
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}

              {source.type === "file" && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    onDelete(source.sourceId);
                    onClose();
                  }}
                  className="rounded-full px-6 text-xs sm:text-sm"
                >
                  Delete &amp; Upload New
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
