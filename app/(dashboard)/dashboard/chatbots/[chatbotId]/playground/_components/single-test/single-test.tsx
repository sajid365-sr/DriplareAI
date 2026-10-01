"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, PanelBottom, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/core/utils";
import { ChatPreview } from "../../../_components/chat-preview";
import { useBot } from "../../../_providers/bot-provider";
import { useTester } from "../../../_providers/tester-provider";
import { DockedChat } from "./docked-chat";
import { MessengerBubble } from "./messenger-bubble";
import { SessionHistory } from "./session-history";

/** টেস্টার কোথায় বসবে — পুরো মঞ্চে, নাকি দোকানের কোণার বুদবুদের ভেতরে। */
type Layout = "docked" | "bubble";

const LAYOUTS: Array<{ key: Layout; icon: LucideIcon; labelKey: string; fallback: string }> = [
  { key: "docked", icon: PanelBottom, labelKey: "chat_test.mode.docked", fallback: "Docked" },
  { key: "bubble", icon: MessageSquare, labelKey: "chat_test.mode.bubble", fallback: "Live widget" },
];

/**
 * SingleTest — বটের সাথে কাস্টমারের মতো কথা বলার জায়গা।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * কথোপকথনটা `TesterProvider`-এ থাকে (শেলের স্তরে), এই কম্পোনেন্টে নয়। তাই
 * Docked ↔ Bubble বদলালে `ChatPreview` নতুন করে মাউন্ট হয়, কিন্তু কথাগুলো
 * হারায় না — আর শেলের ভাসমান বুদবুদটাও দেখায় **একই** কথোপকথন।
 */
export function SingleTest() {
  const { t } = useTranslation("chatbots");
  const { bot } = useBot();
  const { messages, input, setInput, sending, sendMessage, reset } = useTester();
  const [layout, setLayout] = useState<Layout>("docked");

  // দুই লেআউটেই একই টেস্টার — কেবল মঞ্চটা আলাদা।
  const preview = (
    <ChatPreview
      bot={bot}
      messages={messages}
      input={input}
      sending={sending}
      onInputChange={setInput}
      onSend={sendMessage}
      onReset={reset}
    />
  );

  const hint =
    layout === "docked"
      ? t("chat_test.mode.dockedHint", "The tester takes the whole page.")
      : t(
          "chat_test.mode.bubbleHint",
          "See it exactly as a customer would — a chat bubble on your storefront."
        );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label={t("chat_test.mode.layoutLabel", "Tester layout")}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1"
        >
          {LAYOUTS.map(({ key, icon: Icon, labelKey, fallback }) => {
            const active = layout === key;

            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLayout(key)}
                data-testid={`tester-layout-${key}`}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-all",
                  active
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t(labelKey, fallback)}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>

      {layout === "docked" ? (
        <DockedChat>{preview}</DockedChat>
      ) : (
        <MessengerBubble>{preview}</MessengerBubble>
      )}

      <SessionHistory />
    </div>
  );
}
