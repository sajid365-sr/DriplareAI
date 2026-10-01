"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { botNavItems } from "./bot-nav";

/**
 * এজেন্ট-পেজের নেভিগেশন — শুধু মোবাইলে।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `Sidebar` (variant="bot") হলো `hidden md:flex`, আর হেডারে কোনো হ্যামবার্গার
 * নেই। ফলে ৭৬৮px-এর নিচে একটা এজেন্ট-পেজে ঢুকলে Analytics, Playground বা
 * Settings-এ যাওয়ার **একটাও** উপায় ছিল না — শুধু `/dashboard/chatbots`-এ
 * ফিরে গিয়ে সারির ⋯ মেনু থেকে আবার ঢোকা, প্রতিবার।
 *
 * আইটেমের তালিকা `bot-nav.ts`-এ, সাইডবারের সাথে একই — দুটো আলাদা কপি রাখলে
 * একদিন একটা জায়গায় নতুন ট্যাব যোগ হবে আর অন্যটায় হবে না, চোখে পড়বে শুধু
 * ফোনে।
 *
 * ডেস্কটপে dropdown-এর বদলে **scrollable pill row** বেছেছি: আইটেম চারটা, আর
 * ৩৭৫px-এ চারটাই একসাথে না-ও ধরতে পারে — তাই সারিটা `overflow-x-auto`, আর
 * প্রতিটি পিল `shrink-0` (নইলে টেক্সট ভেঙে দুই লাইন হয়ে যেত)। dropdown-এ
 * একটা ট্যাপে খোলা, আরেকটায় বাছাই — এখানে একটাই। এর visual language রিপোতে
 * আগেই আছে (`KBTabs`), তাই নতুন কিছু শেখাতে হচ্ছে না।
 */
export function BotTabStrip({ chatbotId }: { chatbotId: string }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const items = botNavItems(chatbotId);

  return (
    <nav
      aria-label={t("bot.navLabel", "Agent navigation")}
      data-testid="bot-tab-strip"
      className="no-scrollbar mb-4 flex gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1.5 md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        // startsWith, not ===, because `/playground` may grow sub-pages later
        // (Compare used to be one). A sub-page must keep Playground lit, not
        // leave the strip with nothing active.
        const active = !!pathname?.startsWith(item.to);

        return (
          <Link
            key={item.to}
            href={item.to}
            data-testid={item.tid}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all ${
              active
                ? "bg-card text-primary shadow-xs ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} />
            {t(item.labelKey, item.fallback)}
          </Link>
        );
      })}
    </nav>
  );
}
