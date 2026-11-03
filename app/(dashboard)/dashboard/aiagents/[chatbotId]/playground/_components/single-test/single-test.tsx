"use client";

import { useTranslation } from "react-i18next";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useActiveChatbotId, useLiveWidgetStore } from "@/hooks/use-live-widget";
import { ChatPreview } from "../../../_components/chat-preview";
import { PHONE_ASPECT, PhoneFrame } from "../../../_components/phone-frame";
import { useBot } from "../../../_providers/bot-provider";
import { useTester } from "../../../_providers/tester-provider";
import { SessionHistory } from "./session-history";

/**
 * SingleTest — where you talk to the bot the way a customer would.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The conversation lives in `TesterProvider` (at the shell level), not in this
 * component. So going from the Playground to Setup and opening the bubble there — or
 * from Products — shows the same messages.
 *
 * ⚠️ There used to be two pill tabs here: **Docked** and **Live widget**. Both were
 *    really about "where does the tester get drawn" — a layout preference that never
 *    answered the merchant's actual question. Their real question is different: *"will
 *    this widget stay within reach on the rest of my dashboard?"* — and that is this
 *    one toggle.
 *
 *    Docked and the bubble preview no longer exist as separate things: the widget
 *    looks the same everywhere now (Messenger's shape), and it always stays inline
 *    here — with the toggle on, this very widget is what floats in the corner of the
 *    other pages.
 */
export function SingleTest() {
  const { t } = useTranslation("chatbots");
  const { bot } = useBot();
  const { messages, input, setInput, sending, sendMessage, reset } = useTester();

  const chatbotId = useActiveChatbotId();
  const floating = useLiveWidgetStore((s) =>
    chatbotId ? s.floating[chatbotId] === true : false
  );
  const setFloating = useLiveWidgetStore((s) => s.setFloating);

  return (
    <div className="space-y-5">
      {/* ─── Floating widget toggle ─────────────────────────────── */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-border bg-muted/30 px-4 py-3">
        <Switch
          id="live-widget-floating"
          checked={floating}
          disabled={!chatbotId}
          onCheckedChange={(value) => chatbotId && setFloating(chatbotId, value)}
          data-testid="live-widget-toggle"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor="live-widget-floating"
            className="cursor-pointer text-sm font-semibold text-foreground"
          >
            {t("chat_test.widget.floating", "Floating widget on every page")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              "chat_test.widget.floatingHint",
              "On — this widget also floats in the corner of your other dashboard pages. Off — it stays here in the Playground."
            )}
          </p>
        </div>
      </div>

      {/* ─── Widget ─────────────────────────────────────────────── */}
      {/* The widget is drawn inside a phone, at a phone's proportions.

          ⚠️ An aspect ratio rather than a height in `dvh`. The earlier height was
             `100dvh - 20rem` — "whatever is left after the page's own chrome" —
             which made the widget's shape a side effect of this page's padding. On a
             laptop that worked out to a squat box; on a short window, shorter still.
             The merchant is previewing what their customer sees on a handset, and a
             handset does not change shape with the browser window. The page scrolls
             instead, which is the honest trade.

          ⚠️ `max-w-[400px]` is not arbitrary: it is Messenger's own chat-window
             width, and it matches the floating corner panel, so the merchant tests
             here and then meets the same widget at the same width elsewhere. (A wide
             chat is worse anyway: the question ends at one edge and the answer starts
             at the other, and the eye has to jump across.) */}
      <div className={cn("mx-auto w-full max-w-[400px]", PHONE_ASPECT)}>
        <PhoneFrame className="h-full">
          <ChatPreview
            bot={bot}
            messages={messages}
            input={input}
            sending={sending}
            onInputChange={setInput}
            onSend={sendMessage}
            onReset={reset}
          />
        </PhoneFrame>
      </div>

      <SessionHistory />
    </div>
  );
}
