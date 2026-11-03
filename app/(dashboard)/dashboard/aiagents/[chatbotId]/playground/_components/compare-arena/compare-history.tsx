"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, History, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";

import type { CompareSession } from "./types";

interface CompareHistoryProps {
  sessions: CompareSession[];
  activeSessionId: string;
  loadingSessions: boolean;
  loadingMessages: boolean;
  /**
   * ড্রয়ার **খোলার** মুহূর্তে ডাকা হয় — তালিকা টাটকা করার জন্য।
   *
   * ⚠️ তালিকা mount-এ আনা হয় না। কারণ ড্রয়ারটা বন্ধ অবস্থায়ই থাকে বেশিরভাগ
   *    সময়, অর্থাৎ mount-এর fetch প্রায় প্রতিবারই অপচয়। তাছাড়া mount-এর
   *    effect থেকে setState-কারী ফাংশন ডাকলে React বাড়তি রেন্ডার করে
   *    (`react-hooks/set-state-in-effect`), আর এখানে ক্লিকে ডাকা হলে সেটা
   *    স্বাভাবিক event handler — কোনো চক্র নেই।
   */
  onOpen: () => void;
  onRefresh: () => void;
  onView: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

/**
 * CompareHistory — পুরনো তুলনাগুলোর তালিকা, একটা **ভাঁজ করা** ড্রয়ারে।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * আগে এটা পেজের নিচে খোলা একটা টেবিল ছিল, অর্থাৎ ৪ কলামের এরিনা যত জায়গা পেত
 * তার নিচে আরও ~৩০০px স্থায়ীভাবে দখল হয়ে থাকত — অথচ এই তালিকা দিনে একবারও
 * খোলা হয় না। এখন বন্ধ অবস্থায় এক লাইন, আর দরকার হলে খুলে নেওয়া যায়।
 *
 * ⚠️ ভাঁজ করা অবস্থাতেই সংখ্যাটা দেখানো হয় ("৩টা সেশন") — নইলে ব্যবহারকারী
 *    জানতেই পারতেন না ভেতরে কিছু আছে কি না, আর কখনো খুলতেনও না।
 */
export function CompareHistory({
  sessions,
  activeSessionId,
  loadingSessions,
  loadingMessages,
  onOpen,
  onRefresh,
  onView,
  onDelete,
}: CompareHistoryProps) {
  const { t } = useTranslation("chatbots");
  const [open, setOpen] = useState(false);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-border/85 bg-card/45 shadow-sm backdrop-blur-sm"
      data-testid="compare-history-drawer"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) onOpen();
          }}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <History className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-bold">
            {t("compare.history_title", "Past comparisons")}
          </span>
          {sessions.length > 0 && (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {sessions.length}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loadingSessions}
          className="h-8 shrink-0 rounded-lg text-xs font-medium hover:bg-secondary"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loadingSessions && "animate-spin")} />
          <span className="hidden sm:inline">{t("compare.history_refresh", "Refresh")}</span>
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {loadingSessions && sessions.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t("compare.history_loading", "Loading history…")}
                </div>
              ) : sessions.length === 0 ? (
                <p className="py-8 text-center text-sm italic text-muted-foreground">
                  {t("compare.history_empty", "No past comparisons yet.")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {sessions.map((s) => {
                    const isActive = activeSessionId === s.sessionId;

                    return (
                      <li
                        key={s.sessionId}
                        className={cn(
                          "flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5",
                          isActive && "border-primary/30 bg-primary/5"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[11px] text-foreground">
                            {s.sessionId}
                            {isActive && (
                              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-primary">
                                {t("compare.history_active", "Active")}
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(s.timestamp).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingMessages}
                            onClick={() => onView(s.sessionId)}
                            className="h-8 rounded-lg border-primary/20 text-xs font-semibold transition-colors hover:bg-primary/10 hover:text-primary"
                          >
                            {t("compare.history_view", "View")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDelete(s.sessionId)}
                            aria-label={t("compare.history_delete", "Delete session")}
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
