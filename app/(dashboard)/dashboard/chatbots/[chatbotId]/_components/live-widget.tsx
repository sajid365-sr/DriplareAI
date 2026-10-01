"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Zap } from "lucide-react";

import { ChatPreview } from "./chat-preview";
import { PHONE_ASPECT_FLOATING, PhoneFrame } from "./phone-frame";
import { useBot, type BotRecord } from "../_providers/bot-provider";
import { useTester } from "../_providers/tester-provider";
import { useActiveChatbotId, useFloatingWidgetEnabled } from "@/hooks/use-live-widget";
import { cn } from "@/lib/utils";

/**
 * The live chat widget floating in the corner — on every dashboard page except the Playground.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ This lives in `app/(dashboard)/layout.tsx`, not in a page. The conversation
 *    belongs to `TesterProvider`, which is part of the shell; so asking a question on
 *    Products and coming back to the Playground still shows the answer — the two
 *    places never become two separate sessions.
 *
 * ⚠️ This bubble used to exist only inside the agent section (`TesterBubble`) and
 *    showed up on every tab except `/playground`. It is now a **choice**: with the
 *    Playground toggle on, the bubble floats across the whole dashboard; with it off,
 *    the widget stays on the Playground alone. That decision lives in
 *    `useFloatingWidgetEnabled()`, so "may this float here at all" is answered in one
 *    place rather than re-derived at each call site.
 *
 * ⚠️ The launcher is now the only thing in this corner, and it is Messenger-shaped: a
 *    white bolt on a blue-violet gradient circle, and a chevron while open. It used to
 *    carry a "⚡ Test me!" teaser above it and to share the corner with the WhatsApp +
 *    support pair — three controls stacked in one spot, each stepping around the
 *    others. Both removed on the user's call; the bolt keeps its `title`, so the
 *    affordance is still named for anyone who hovers. The colour is not our theme's —
 *    it is Messenger's identity, and the reasoning is in the token notes in
 *    `globals.css`.
 */
export function LiveWidget() {
  const { t } = useTranslation("chatbots");
  const enabled = useFloatingWidgetEnabled();
  const chatbotId = useActiveChatbotId();
  const { bot } = useBot();
  const { messages, input, setInput, sending, sendMessage, reset } = useTester();

  const [open, setOpen] = useState(false);

  /**
   * Outside the agent section `useBot()` comes back empty (there is no
   * `BotProvider` there), so the name and avatar come from this one-off fetch.
   * Inside, the fetch never happens — the provider already has the data.
   *
   * ⚠️ The answer carries **the id of the agent it belongs to**. Switching agents
   *    would otherwise show the previous agent's name in the header until the new
   *    fetch lands — open A's widget on the Playground and the header says "B". Only a
   *    matching id is used, so that gap shows an empty name instead of a wrong one.
   */
  const [fetched, setFetched] = useState<{ id: string; bot: BotRecord } | null>(null);

  /** The agent whose fetch failed (deleted, or another business) — its bubble is not drawn. */
  const [goneId, setGoneId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !chatbotId || bot) return;

    let cancelled = false;
    fetch(`/api/chatbots/${chatbotId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: BotRecord) => {
        if (!cancelled) setFetched({ id: chatbotId, bot: data });
      })
      .catch(() => {
        // ⚠️ `gone` is an id, not a boolean: a single 404 would otherwise leave a
        //    permanent mark, and a good agent opened later would never get its bubble.
        if (!cancelled) setGoneId(chatbotId);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, chatbotId, bot]);

  if (!enabled || !chatbotId) return null;
  if (goneId === chatbotId && !bot) return null;

  const activeBot = bot ?? (fetched?.id === chatbotId ? fetched.bot : null);

  return (
    <>
      {/* The launcher. It used to be a column (`flex flex-col gap-2.5`) because the
          teaser sat above it — with the teaser gone there is nothing to stack, so the
          button carries its own position. */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        data-testid="live-widget-launcher"
        className="bg-messenger-gradient fixed right-6 bottom-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full text-white shadow-2xl shadow-messenger-bubble/30"
        title={
          open
            ? t("chat_test.widget.close", "Close Live Chat Simulator")
            : t("chat_test.widget.open", "Open Live Chat Simulator")
        }
      >
        {open ? (
          <ChevronDown className="h-6 w-6" />
        ) : (
          <Zap className="h-6 w-6 fill-current" strokeWidth={0} />
        )}
      </motion.button>

      {/* The panel is the same phone as the Playground's, not a second design.
          `PhoneFrame` draws the body, the bezel and the status bar in both places.

          ⚠️ Narrower and taller than the Playground's stage (`380px` against `400px`,
             a 9:19 ratio against 9:16). This one is a companion floating **over** a
             page the merchant is working on, so every pixel it takes is a pixel of
             their work hidden. The Playground's stage has nothing to hide — it *is*
             the page — so it gets the roomier, more natural handset.

          ⚠️ `max-h` is what keeps a phone-shaped panel on screen: a 9:19 handset at
             this width is ~800px tall, which on a short window would reach above the
             top of the viewport and put its own header out of reach. Clamped, the
             phone goes a little stubbier — visible beats perfectly proportioned. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed right-4 bottom-24 z-50 w-[calc(100vw-2rem)] sm:right-6 sm:w-[380px]"
          >
            <PhoneFrame
              className={cn("max-h-[calc(100dvh-7rem)] w-full", PHONE_ASPECT_FLOATING)}
            >
              <ChatPreview
                bot={activeBot}
                messages={messages}
                input={input}
                sending={sending}
                onInputChange={setInput}
                onSend={sendMessage}
                onReset={reset}
                onClose={() => setOpen(false)}
              />
            </PhoneFrame>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
