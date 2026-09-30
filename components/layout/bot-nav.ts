import type { LucideIcon } from "lucide-react";
import { BarChart3, MessageSquare, Settings, SlidersHorizontal } from "lucide-react";

/**
 * একটা এজেন্টের নিজের নেভিগেশন — একবার লেখা, দুই জায়গায় আঁকা।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * আগে এই তালিকাটা কেবল `Sidebar.tsx`-এর ভেতরে ছিল। মোবাইলে এজেন্ট-পেজের
 * ডেস্কটপ সাইডবার `hidden md:flex`, আর হেডারে কোনো হ্যামবার্গার নেই — তাই
 * ফোনে এজেন্টের Analytics বা Settings-এ যাওয়ার কোনো পথই ছিল না। মোবাইলের
 * জন্য একটা স্ট্রিপ যোগ করা মানে এই তালিকার **দ্বিতীয় কপি** — আর দুই কপি
 * মানে একদিন একটা জায়গায় আইটেম যোগ হবে, অন্যটায় হবে না, আর কেউ ধরতে পারবে না।
 * তাই তালিকা এখানে, একটাই।
 *
 * ⚠️ ক্রমটাই গুরুত্বের ক্রম: Setup প্রথমে, কারণ এজেন্ট বানানোর পর merchant
 *    এখানেই নামে — মডেল, prompt, wizard, checklist সব এখানে। তারপর Playground,
 *    যেখানে পরখ করা হয়। Settings শেষে।
 *
 * ⚠️ Compare এখানে নেই। মডেল মেলানো আর মডেল বাছাই একই কাজের দুই ধাপ, তাই পেজটা
 *    এখন Playground-এর ভেতরে (`/playground/compare`) — আলাদা গন্তব্য নয়।
 *
 * নিচের প্রতিটি `to` **অবশ্যই** একটা বাস্তব রুট হতে হবে: `TAB_LABEL_KEYS`
 * (dashboardHeader) আর এই তালিকা আলাদা জায়গায় রাখা, তাই ভুল হলেও কোনো
 * compile error আসবে না — শুধু ৪০৪।
 */
export interface BotNavItem {
  to: string;
  icon: LucideIcon;
  /** `common` namespace-এর key। */
  labelKey: string;
  /** অনুবাদ না থাকলে যা দেখানো হবে। */
  fallback: string;
  tid: string;
}

export function botNavItems(chatbotId: string): BotNavItem[] {
  return [
    {
      to: `/dashboard/chatbots/${chatbotId}/setup`,
      icon: SlidersHorizontal,
      labelKey: "bot.setup",
      fallback: "Setup",
      tid: "bot-nav-setup",
    },
    {
      to: `/dashboard/chatbots/${chatbotId}/playground`,
      icon: MessageSquare,
      labelKey: "bot.chat",
      fallback: "Playground",
      tid: "bot-nav-chat",
    },
    {
      to: `/dashboard/chatbots/${chatbotId}/analytics`,
      icon: BarChart3,
      labelKey: "bot.analytics",
      fallback: "Overview & Analytics",
      tid: "bot-nav-analytics",
    },
    {
      to: `/dashboard/chatbots/${chatbotId}/settings`,
      icon: Settings,
      labelKey: "bot.settings",
      fallback: "Settings",
      tid: "bot-nav-settings",
    },
  ];
}
