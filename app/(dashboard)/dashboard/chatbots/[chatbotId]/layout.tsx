"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BotProvider } from "./_providers/bot-provider";
import { TesterProvider } from "./_providers/tester-provider";
import { TesterBubble } from "./_components/tester-bubble";

/**
 * এজেন্ট-সেকশনের শেল।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * এখানে থাকার কারণটা Next.js App Router-এর একটা আচরণ: **layout প্যারেন্ট
 * সেগমেন্টে বসে, তাই ভাই-বোন রুটে যাওয়া-আসায় সেটা unmount হয় না** — কেবল
 * `page`-টা বদলায়। এজেন্টের সব ট্যাব (Setup, Playground, Analytics, Settings)
 * একই `[chatbotId]` সেগমেন্টের সন্তান, তাই প্রতিটা ট্যাব বদল এখন শুধু ভেতরের
 * কনটেন্ট বদল — বাইরের কিছু নয়।
 *
 * আগে প্রতিটা পেজ নিজে `GET /api/chatbots/[id]` করত, আর প্রতিবারই মাঝখানে
 * লোডিং স্ক্রিন দেখাত — অথচ বদলাচ্ছিল শুধু ট্যাব, ডেটা একই ছিল। এখন ফেচটা
 * এখানে একবার, আর ট্যাব বদলালে ডেটাও টেকে।
 *
 * দুটো provider, কারণ এই দুটোর জীবনকাল এক নয়:
 *   • `BotProvider`   — এজেন্ট কী (নাম, মডেল, prompt), আর সেভ-করা হয়েছে কি না
 *   • `TesterProvider` — এই সেশনে কী নিয়ে কথা হয়েছে
 * একসাথে থাকলে prompt-এর একটা অক্ষর টাইপ করলেই চ্যাট লিস্ট re-render হত।
 *
 * টেস্টার নিজে এখানে বসে — `TesterBubble` আকারে, `/playground` ছাড়া সব পেজে।
 * Playground-এ টেস্টারটাই পুরো পেজ, তাই ওখানে বাবলটা বাড়তি (আর নিজের সাথে
 * নিজেরই সংঘর্ষ)। বাকি সব জায়গায় বাবলটাই একমাত্র প্রবেশপথ — আর যেহেতু
 * কথোপকথনটা provider-এ থাকে, Analytics-এ একটা প্রশ্ন করে Setup-এ ফিরে এলেও
 * উত্তরটা ওখানেই থাকে।
 */
export default function ChatbotLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showBubble = !pathname?.includes("/playground");

  return (
    <BotProvider>
      <TesterProvider>
        {children}
        {showBubble && <TesterBubble />}
      </TesterProvider>
    </BotProvider>
  );
}
