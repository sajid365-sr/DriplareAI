"use client";

import { useTranslation } from "react-i18next";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { useTester } from "../../_providers/tester-provider";

/**
 * যে কথোপকথনগুলো Clear করা হয়েছে, সেগুলোর তালিকা।
 *
 * "Clear chat" চাপলে আগে সব চিরতরে চলে যেত — অথচ ব্যবহারকারী সাধারণত নতুন করে
 * শুরু করতে চান, তিনটে ভালো উত্তর হারাতে নয়। এখন কথোপকথনটা ইতিহাসে জমা হয়,
 * আর এখান থেকে এক ক্লিকে ফেরা যায়।
 *
 * কিছু না থাকলে পুরো কার্ডটাই আঁকা হয় না — ফাঁকা অবস্থায় একটা "কিছু নেই"
 * বাক্স কেবল জায়গা নেয়।
 */
export function SessionHistory() {
  const { t } = useTranslation("chatbots");
  const { pastSessions, restoreSession, clearHistory } = useTester();

  if (pastSessions.length === 0) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-muted-foreground shrink-0" />
          <h2 className="text-sm font-bold truncate">{t("chat_test.history.title", "Past conversations")}</h2>
        </div>
        <button
          type="button"
          onClick={clearHistory}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("chat_test.history.clear", "Clear all")}</span>
        </button>
      </div>

      <ul className="space-y-2">
        {pastSessions.map((session) => {
          // তালিকায় চেনার একমাত্র উপায় প্রথম প্রশ্নটা — অন্য কিছুই এখানে নেই।
          const firstQuestion = session.messages.find((m) => m.role === "user")?.content ?? "";
          return (
            <li
              key={session.id}
              className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/30 px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{firstQuestion}</p>
                <p className="text-[11px] text-muted-foreground">
                  {session.startedAt} · {t("chat_test.history.turns", { count: session.messages.length, defaultValue: "{{count}} messages" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => restoreSession(session.id)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border border-primary/30 text-primary hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("chat_test.history.restore", "Reopen")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
