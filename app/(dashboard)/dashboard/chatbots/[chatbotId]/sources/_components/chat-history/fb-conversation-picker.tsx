"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Loader2, AlertCircle, Check, ShieldAlert, RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface Conversation {
  id: string;
  snippet?: string;
  message_count?: number;
  updated_time?: string;
  participants?: {
    data?: Array<{ name: string; id: string }>;
  } | Array<{ name: string; id: string }>;
  ingested?: boolean;
  label?: string;
}

interface FbConversationPickerProps {
  chatbotId: string;
  onSuccess: () => void;
}

export function FbConversationPicker({ chatbotId, onSuccess }: FbConversationPickerProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [ingestedIds, setIngestedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDevModeNotice, setIsDevModeNotice] = useState(false);
  const [hasLoadedFresh, setHasLoadedFresh] = useState(false);

  // On mount: load already-ingested conversations only (no Facebook API call)
  const loadIngested = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sources/fb-conversations`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load ingested conversations.");
      }

      setConversations(data.conversations || []);
      setIngestedIds(data.ingestedIds || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIngested();
  }, [chatbotId]);

  // Fetch fresh conversations from Facebook API
  const fetchFreshConversations = async () => {
    setLoading(true);
    setError(null);
    setIsDevModeNotice(false);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sources/fb-conversations?fresh=true`);
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 10 || data.code === 200 || data.code === 190 ||
            String(data.error).includes("permissions") || String(data.error).includes("access")) {
          setIsDevModeNotice(true);
        }
        throw new Error(data.error || "Conversations load failed.");
      }

      setConversations(data.conversations || []);
      setIngestedIds(data.ingestedIds || []);
      setSelectedIds([]);
      setHasLoadedFresh(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Conversations load failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const newChats = conversations.filter((c) => !c.ingested);
    if (selectedIds.length === newChats.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(newChats.map((c) => c.id));
    }
  };

  const handleIngest = async () => {
    if (selectedIds.length === 0) return;
    setIngesting(true);

    const selectedConvs = selectedIds.map((id) => {
      const conv = conversations.find((c) => c.id === id);
      let label = "User";
      if (conv?.participants) {
        const parts = Array.isArray(conv.participants)
          ? conv.participants
          : conv.participants.data || [];
        label = parts.map((p: any) => p.name).filter(Boolean).join(", ") || "User";
      }
      return { id, label };
    });

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/sources/fb-conversations/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversations: selectedConvs }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Ingestion failed.");
      }

      toast.success(
        `${body.conversationsProcessed} conversations • ${body.pairsIngested} Q&A pairs ingested successfully!`
      );
      setSelectedIds([]);
      // Reload ingested list
      await loadIngested();
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ingestion failed.";
      toast.error(msg);
    } finally {
      setIngesting(false);
    }
  };

  const newChats = conversations.filter((c) => !c.ingested);
  const ingestedChats = conversations.filter((c) => c.ingested);

  const getParticipantName = (conv: Conversation) => {
    if (conv.label) return conv.label;
    const parts = Array.isArray(conv.participants)
      ? conv.participants
      : conv.participants?.data || [];
    return parts.map((p: any) => p.name).filter(Boolean).join(", ") || "User";
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#1877F2]/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-[#1877F2]" />
          </div>
          <div>
            <p className="text-sm font-bold">Facebook Smart Chat Picker</p>
            <p className="text-xs text-muted-foreground">
              {hasLoadedFresh
                ? "Select new conversations to train your AI"
                : "Previously uploaded conversations shown below"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchFreshConversations}
          disabled={loading || ingesting}
          className="rounded-xl h-8 gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Load New Chats
        </Button>
      </div>

      {/* Dev Mode Notification banner */}
      {isDevModeNotice && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Facebook app is in Development Mode</p>
            <p className="leading-relaxed">
              Only messages from authorized test users can be fetched until the app review is complete.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">
            {hasLoadedFresh ? "Loading conversations..." : "Loading uploaded conversations..."}
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-destructive/5 border border-destructive/10 text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-xs font-semibold text-destructive">Failed to load</p>
          <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">{error}</p>
          <Button size="sm" variant="outline" onClick={loadIngested} className="rounded-full mt-2">
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && conversations.length === 0 && (
        <div className="p-12 text-center border border-dashed rounded-2xl text-muted-foreground text-xs space-y-3">
          <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p>No conversations found.</p>
          <Button size="sm" variant="outline" onClick={fetchFreshConversations} className="rounded-full">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Load New Chats from Facebook
          </Button>
        </div>
      )}

      {/* List */}
      {!loading && !error && conversations.length > 0 && (
        <div className="space-y-4">
          {/* Already ingested section */}
          {ingestedChats.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Already Uploaded ({ingestedChats.length})
              </p>
              <div className="border border-border/60 rounded-2xl overflow-hidden divide-y divide-border/40">
                {ingestedChats.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-start gap-3 p-4 bg-secondary/10 opacity-75 select-none"
                  >
                    <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold truncate">{getParticipantName(conv)}</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 h-5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 shrink-0"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Already Uploaded
                        </Badge>
                      </div>
                      {conv.snippet && (
                        <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
                          {conv.snippet}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New (not yet ingested) section */}
          {newChats.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  New Conversations ({newChats.length})
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <div
                    className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={handleSelectAll}
                  >
                    <Checkbox
                      checked={selectedIds.length === newChats.length && newChats.length > 0}
                      onCheckedChange={handleSelectAll}
                      className="rounded-md"
                    />
                    <span>Select all</span>
                  </div>
                  <span>{selectedIds.length} selected</span>
                </div>
              </div>

              <div className="border border-border/60 rounded-2xl overflow-hidden divide-y divide-border/40 max-h-72 overflow-y-auto">
                {newChats.map((conv) => {
                  const isSelected = selectedIds.includes(conv.id);
                  const participantName = getParticipantName(conv);

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleToggle(conv.id)}
                      className={`flex items-start gap-3 p-4 hover:bg-secondary/10 transition-colors cursor-pointer select-none ${
                        isSelected ? "bg-primary/5" : ""
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggle(conv.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded-md mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold truncate">{participantName}</p>
                          {conv.message_count && (
                            <span className="text-[10px] bg-secondary/50 border border-border/40 px-2 py-0.5 rounded-full shrink-0 font-medium text-muted-foreground">
                              {conv.message_count} messages
                            </span>
                          )}
                        </div>
                        {conv.snippet && (
                          <p className="text-[11px] text-muted-foreground truncate leading-relaxed">
                            {conv.snippet}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action button */}
              <Button
                onClick={handleIngest}
                disabled={selectedIds.length === 0 || ingesting}
                className="w-full rounded-full bg-gradient-to-r from-primary to-fuchsia-600 hover:from-primary/95 hover:to-fuchsia-600/95 shadow-md shadow-primary/10 h-10 text-sm font-semibold"
              >
                {ingesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Training AI...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Train AI with selected conversations ({selectedIds.length})
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
