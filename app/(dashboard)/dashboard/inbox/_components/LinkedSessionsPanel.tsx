"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Link2,
  Plus,
  Loader2,
  Phone,
  X,
  MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface LinkedSessionItem {
  sessionId: string;
  platform: string;
  guestName: string;
  profilePhoto?: string | null;
  lastActive: string;
  lastMessage: string;
  lastMessageTime: string;
}

interface CustomerProfileData {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  sessions: string[];
}

interface LinkedSessionsPanelProps {
  currentSessionId: string;
  currentPlatform: string;
  onSelectSession?: (sessionId: string) => void;
}

const getPlatformBadge = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "facebook":
    case "messenger":
      return {
        label: "Messenger",
        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
    case "whatsapp":
      return {
        label: "WhatsApp",
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    case "instagram":
      return {
        label: "Instagram",
        color: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
      };
    default:
      return {
        label: "Web Chat",
        color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      };
  }
};

export function LinkedSessionsPanel({
  currentSessionId,
  currentPlatform,
  onSelectSession,
}: LinkedSessionsPanelProps) {
  const { t } = useTranslation("live-inbox");

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [linkedSessions, setLinkedSessions] = useState<LinkedSessionItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetPhone, setTargetPhone] = useState("");
  const [targetSessionId, setTargetSessionId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    if (!currentSessionId) return;

    fetch(`/api/crm/link-identity?sessionId=${encodeURIComponent(currentSessionId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setProfile(data.profile || null);
          setLinkedSessions(data.linkedSessions || []);
        }
      })
      .catch((err) => {
        console.warn("[FETCH_IDENTITY_ERROR]", err);
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [currentSessionId, refreshTrigger]);

  const handleLinkIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPhone.trim() && !targetSessionId.trim()) {
      toast.error(t("identity.phoneLabel", "Enter a phone or session ID to link"));
      return;
    }

    setIsLinking(true);
    try {
      const res = await fetch("/api/crm/link-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSessionId,
          targetSessionId: targetSessionId.trim() || undefined,
          phone: targetPhone.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link identity");

      toast.success(t("identity.linkSuccess", "Customer identity linked across platforms"));
      setIsModalOpen(false);
      setTargetPhone("");
      setTargetSessionId("");
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error linking identity";
      toast.error(msg);
    } finally {
      setIsLinking(false);
    }
  };

  const currentBadge = getPlatformBadge(currentPlatform);

  return (
    <div className="space-y-3 p-3">
      {/* Current Platform Indicator */}
      <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-2.5">
        <div className="flex items-center gap-2">
          <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-bold ${currentBadge.color}`}>
            {currentBadge.label}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">{t("identity.activeHere", "Current Channel")}</span>
        </div>

        {profile?.phone && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-foreground">
            <Phone className="h-3 w-3 text-muted-foreground" />
            {profile.phone}
          </span>
        )}
      </div>

      {/* Linked Platforms List */}
      {loading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          <span>Loading linked channels...</span>
        </div>
      ) : linkedSessions.length > 0 ? (
        <div className="space-y-2">
          {linkedSessions.map((item) => {
            const badge = getPlatformBadge(item.platform);
            return (
              <div
                key={item.sessionId}
                className="group flex flex-col gap-1.5 rounded-xl border border-border/60 bg-card p-2.5 transition-all hover:border-violet-500/50 hover:bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate max-w-[120px]">
                      {item.guestName}
                    </span>
                  </div>

                  {onSelectSession && (
                    <button
                      type="button"
                      onClick={() => onSelectSession(item.sessionId)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Switch</span>
                    </button>
                  )}
                </div>

                {item.lastMessage && (
                  <p className="line-clamp-1 text-[11px] text-muted-foreground italic">
                    &ldquo;{item.lastMessage}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/70 p-3 text-center">
          <p className="text-[11px] text-muted-foreground">
            {t("identity.noLinkedSessions", "No other platforms linked yet")}
          </p>
        </div>
      )}

      {/* Action Button: Link another channel */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/50 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-violet-500/50 hover:bg-muted/40"
      >
        <Plus className="h-3.5 w-3.5 text-violet-500" />
        <span>{t("identity.linkSessionBtn", "+ Link Channel")}</span>
      </button>

      {/* Manual Link Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <h3 className="text-sm font-bold text-foreground">
                    {t("identity.linkModalTitle", "Link Customer Identity")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleLinkIdentity} className="space-y-3 text-xs">
                <div>
                  <label className="mb-1 block font-semibold text-foreground">
                    {t("identity.phoneLabel", "Customer Phone Number")}
                  </label>
                  <input
                    type="tel"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                  />
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    Link with WhatsApp or order by customer phone
                  </span>
                </div>

                <div className="text-center font-bold text-[10px] text-muted-foreground">
                  — OR —
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-foreground">
                    {t("identity.sessionIdLabel", "Target Session ID")}
                  </label>
                  <input
                    type="text"
                    value={targetSessionId}
                    onChange={(e) => setTargetSessionId(e.target.value)}
                    placeholder="e.g. wa_88017... or fb_12345..."
                    className="w-full rounded-xl border border-border/80 bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-500/30 font-mono text-[11px]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLinking}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
                  >
                    {isLinking && <Loader2 className="h-3 w-3 animate-spin" />}
                    <span>Link Identity</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

