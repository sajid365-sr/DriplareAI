"use client";

import type { ReactNode } from "react";
import { BotProvider } from "./_providers/bot-provider";
import { TesterProvider } from "./_providers/tester-provider";

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
 * টেস্টার এখানে ইচ্ছাকৃতভাবে **আঁকা হয় না** — শেল শুধু ডেটা ধরে রাখে, কে
 * কোথায় আঁকবে সেটা পেজের সিদ্ধান্ত (Setup-এ ফ্লোটিং বাবল, Playground-এ পুরো
 * পেজ)। এই আলাদা রাখাটাই দুই জায়গায় একই কথোপকথন দেখানো সম্ভব করে।
 */
export default function ChatbotLayout({ children }: { children: ReactNode }) {
  return (
    <BotProvider>
      <TesterProvider>{children}</TesterProvider>
    </BotProvider>
  );
}
