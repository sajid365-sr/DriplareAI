"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Clock3, Search, UserPlus, UserRound, UserX } from "lucide-react";

export interface AssignableInboxMember {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface AssignAgentDropdownProps {
  members: AssignableInboxMember[];
  assignedUserId?: string | null;
  assignmentNote?: string | null;
  currentUserId: string | null;
  onAssign: (
    userId: string | null,
    userName?: string,
    assignmentNote?: string,
    aiPauseDurationMinutes?: number | null
  ) => Promise<void>;
}

export function AssignAgentDropdown({ members, assignedUserId, assignmentNote: initialNote, currentUserId, onAssign }: AssignAgentDropdownProps) {
  const { t } = useTranslation("live-inbox");
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(assignedUserId ?? null);
  const [assignmentNote, setAssignmentNote] = useState(initialNote ?? "");
  const [pauseDuration, setPauseDuration] = useState("60");
  const [customMinutes, setCustomMinutes] = useState("120");
  const rootRef = useRef<HTMLDivElement>(null);
  const assignedMember = members.find((member) => member.userId === assignedUserId);
  const selectedMember = members.find((member) => member.userId === selectedUserId);
  const isCustomDurationValid = pauseDuration !== "custom" || (
    Number.isInteger(Number(customMinutes)) && Number(customMinutes) > 0 && Number(customMinutes) <= 43200
  );
  const durationMinutes = pauseDuration === "manual"
    ? null
    : pauseDuration === "custom"
      ? Number(customMinutes)
      : Number(pauseDuration);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return members;
    return members.filter((member) =>
      `${member.name} ${member.email}`.toLocaleLowerCase().includes(query)
    );
  }, [members, search]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const saveAssignment = async () => {
    if (!selectedMember || !isCustomDurationValid) return;
    setIsSaving(true);
    try {
      await onAssign(selectedMember.userId, selectedMember.name, assignmentNote.trim(), durationMinutes);
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const unassign = async () => {
    setIsSaving(true);
    try {
      await onAssign(null);
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isSaving}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`inline-flex max-w-[180px] items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:text-[12px] ${
          assignedMember
            ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
            : "border-border bg-background text-foreground hover:bg-muted"
        }`}
        title={assignedMember?.name ?? t("conversation.assign", "Assign")}
      >
        <UserPlus className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{assignedMember?.name ?? t("conversation.assign", "Assign")}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 top-full z-40 mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
          >
            <div className="border-b border-border/60 p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("assignModal.searchPlaceholder")}
                  className="w-full rounded-lg border border-border/60 bg-muted/40 py-2 pl-9 pr-3 text-[12px] text-foreground outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div role="listbox" aria-label={t("assignModal.title")} className="max-h-64 overflow-y-auto p-2">
              {filteredMembers.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                  {t("assignModal.noMembers", "No team members found.")}
                </p>
              ) : (
                filteredMembers.map((member) => {
                  const isAssigned = member.userId === selectedUserId;
                  const isCurrentUser = member.userId === currentUserId;
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      role="option"
                      aria-selected={isAssigned}
                      disabled={isSaving}
                      onClick={() => setSelectedUserId(member.userId)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-[11px] font-semibold text-primary">
                        {member.name.trim().charAt(0).toUpperCase() || <UserRound className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[12px] font-semibold text-foreground">{member.name}</span>
                          <span className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-semibold ${isCurrentUser ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border bg-muted text-muted-foreground"}`}>
                            {isCurrentUser ? t("assignModal.clientLabel", "YOU · CLIENT") : t("assignModal.teammateLabel", "TEAMMATE")}
                          </span>
                        </span>
                        <span className="block truncate text-[10.5px] text-muted-foreground">{member.email}</span>
                      </span>
                      {isAssigned && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="border-t border-border/60 p-3">
              <label className="mb-1.5 block text-[10.5px] font-semibold text-foreground">
                {t("assignModal.assignmentNoteLabel", "Note for teammate (optional)")}
              </label>
              <textarea
                value={assignmentNote}
                onChange={(event) => setAssignmentNote(event.target.value.slice(0, 2000))}
                rows={2}
                maxLength={2000}
                placeholder={t("assignModal.assignmentNotePlaceholder", "Add context for the teammate...")}
                className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 text-[11.5px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
              />
              <label className="mb-1.5 mt-3 flex items-center gap-1.5 text-[10.5px] font-semibold text-foreground">
                <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                {t("assignModal.aiResumeLabel", "Resume AI after")}
              </label>
              <select
                value={pauseDuration}
                onChange={(event) => setPauseDuration(event.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-2 text-[11.5px] text-foreground outline-none focus:border-primary/40"
              >
                <option value="30">{t("assignModal.in30Minutes", "30 minutes")}</option>
                <option value="60">{t("assignModal.in1Hour", "1 hour")}</option>
                <option value="180">{t("assignModal.in3Hours", "3 hours")}</option>
                <option value="1440">{t("assignModal.in1Day", "1 day")}</option>
                <option value="custom">{t("assignModal.customDuration", "Custom duration")}</option>
                <option value="manual">{t("assignModal.manualResume", "Manually resume")}</option>
              </select>
              {pauseDuration === "custom" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={43200}
                    value={customMinutes}
                    onChange={(event) => setCustomMinutes(event.target.value)}
                    className="w-24 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[11.5px] text-foreground outline-none focus:border-primary/40"
                  />
                  <span className="text-[10.5px] text-muted-foreground">{t("assignModal.minutes", "minutes (up to 30 days)")}</span>
                </div>
              )}
              {selectedMember && (
                <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
                  {pauseDuration === "manual"
                    ? t("assignModal.assignmentSummaryManual", {
                        name: selectedMember.name,
                        defaultValue: `${selectedMember.name} will handle this chat. AI stays paused until you resume it; the chat remains assigned.`,
                      })
                    : t("assignModal.assignmentSummary", {
                        name: selectedMember.name,
                        duration: pauseDuration === "custom"
                          ? `${customMinutes} ${t("assignModal.minuteUnit", "minutes")}`
                          : pauseDuration === "30"
                          ? t("assignModal.duration30Minutes", "30 minutes")
                            : pauseDuration === "60"
                            ? t("assignModal.duration1Hour", "1 hour")
                              : pauseDuration === "180"
                              ? t("assignModal.duration3Hours", "3 hours")
                              : t("assignModal.duration1Day", "1 day"),
                        defaultValue: `${selectedMember.name} will handle this chat. AI will resume in ${durationMinutes} minutes; the chat remains assigned.`,
                      })}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                {assignedMember && (
                  <button
                    type="button"
                    onClick={() => void unassign()}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-left text-[10.5px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    {t("assignModal.unassign")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void saveAssignment()}
                  disabled={isSaving || !selectedMember || !isCustomDurationValid}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {isSaving ? t("assignModal.saving", "Saving...") : selectedMember ? t("assignModal.assignTo", { name: selectedMember.name, defaultValue: `Assign to ${selectedMember.name}` }) : t("assignModal.selectMember", "Select a teammate")}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
