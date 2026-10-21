"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, UserX, Search, X, Shield, User, Loader2 } from "lucide-react";

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  picture?: string | null;
  role: string;
}

interface AssignAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatbotId: string | null;
  currentAssignedUserId?: string | null;
  onAssign: (userId: string | null, userName?: string) => Promise<void>;
}

export const AssignAgentModal = ({
  isOpen,
  onClose,
  chatbotId,
  currentAssignedUserId,
  onAssign,
}: AssignAgentModalProps) => {
  const { t } = useTranslation("live-inbox");
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !chatbotId) return;
    setLoading(true);
    fetch(`/api/chatbots/${chatbotId}/members`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members ?? []);
      })
      .catch((err) => console.error("[MEMBERS_FETCH]", err))
      .finally(() => setLoading(false));
  }, [isOpen, chatbotId]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  if (!isOpen) return null;

  const handleSelectMember = async (member: WorkspaceMember) => {
    try {
      setSubmittingId(member.userId);
      await onAssign(member.userId, member.name);
      onClose();
    } finally {
      setSubmittingId(null);
    }
  };

  const handleUnassign = async () => {
    try {
      setSubmittingId("unassign");
      await onAssign(null);
      onClose();
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-foreground">
                  {t("assignModal.title")}
                </h3>
                <p className="text-[11.5px] text-muted-foreground">
                  {t("assignModal.description")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={!!submittingId}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="p-4 border-b border-border/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("assignModal.searchPlaceholder")}
                className="w-full pl-8 pr-3 py-1.5 bg-muted/40 border border-border/60 rounded-xl text-[12px] text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Member list */}
          <div className="p-4 max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-[12px] gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Loading members...</span>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-[12px]">
                No team members found.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = currentAssignedUserId === member.userId;
                const isSubmitting = submittingId === member.userId;
                return (
                  <div
                    key={member.userId}
                    onClick={() => !submittingId && handleSelectMember(member)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary/50 bg-primary/10 shadow-xs"
                        : "border-border/50 hover:border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {member.picture ? (
                        <img
                          src={member.picture}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover border border-border/60"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/15 text-primary font-bold text-[12px] flex items-center justify-center">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-foreground truncate flex items-center gap-1.5">
                          {member.name}
                          {member.role === "Owner" && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              {t("assignModal.ownerBadge")}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {member.email}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 ml-2">
                      {isSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : isSelected ? (
                        <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          Assigned
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          {t("assignModal.assignBtn")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Unassign option */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/20">
            {currentAssignedUserId ? (
              <button
                type="button"
                onClick={handleUnassign}
                disabled={!!submittingId}
                className="text-[11.5px] font-semibold text-destructive hover:underline flex items-center gap-1"
              >
                <UserX className="w-3.5 h-3.5" />
                {t("assignModal.unassign")}
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={!!submittingId}
              className="px-3.5 py-1.5 rounded-lg border border-border/60 text-[12px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              {t("assignModal.closeBtn")}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

