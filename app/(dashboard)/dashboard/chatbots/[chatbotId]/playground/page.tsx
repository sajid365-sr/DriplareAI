"use client";

import { useState } from "react";

import { PlaygroundHeader, type PlaygroundMode } from "./_components/playground-header";
import { SingleTest } from "./_components/single-test/single-test";
import { CompareArena } from "./_components/compare-arena/compare-arena";

/**
 * Playground — বট পরখ করার একটাই ডেস্ক, দুই ধরনের কাজ।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * | মোড | কী হয় |
 * |---|---|
 * | **Live Agent Test** | কাস্টমারের মতো কথা বলা — হয় পুরো মঞ্চে, নয় দোকানের কোণার বুদবুদের ভেতরে |
 * | **Compare Arena** | এক প্রশ্ন, ২–৪টা মডেল, পাশাপাশি উত্তর (Pro) |
 *
 * ⚠️ দুই মোড একই পেজে, রাউট আলাদা নয়। আগে Compare ছিল `/playground/compare` —
 *    অর্থাৎ মোড বদলাতে গেলে রাউট বদলাত, আর সাথে সাথে হারাত বাছা মডেল, চলতি
 *    কথোপকথন আর স্ক্রল। এখন দুটোই একই পাতায়, তাই ওই ঝামেলা নেই।
 *
 * ⚠️ Compare Arena **প্রথমবার খোলার পর DOM-এ থেকে যায়** (কেবল `hidden` হয়),
 *    যাতে ফিরে এলে এরিনা আগের অবস্থায় থাকে। কিন্তু আগে না খুললে মাউন্টও করা
 *    হয় না — নইলে শুধু বটের সাথে কথা বলতে আসা ব্যবহারকারীর জন্যও মডেল-তালিকা
 *    আর সেশন-তালিকার GET দুটো অকারণে চলে যেত।
 */
export default function PlaygroundPage() {
  const [mode, setMode] = useState<PlaygroundMode>("single");
  const [arenaVisited, setArenaVisited] = useState(false);

  const handleModeChange = (next: PlaygroundMode) => {
    if (next === "compare") setArenaVisited(true);
    setMode(next);
  };

  return (
    <div className="space-y-6 pb-24">
      <PlaygroundHeader mode={mode} onModeChange={handleModeChange} />

      {/* দুটো প্যানেলই একসাথে থাকে; না-দেখানোটা কেবল লুকানো। মোড-বদলের
          নড়াচড়াটা হেডারের পিলটাই দেখায় (`layoutId`), তাই এখানে আলাদা
          transition নেই — নইলে একই মুহূর্তে দুইটা অ্যানিমেশন লড়ত। */}
      <div className={mode === "single" ? undefined : "hidden"}>
        <SingleTest />
      </div>

      {arenaVisited && (
        <div className={mode === "compare" ? undefined : "hidden"}>
          <CompareArena />
        </div>
      )}
    </div>
  );
}
