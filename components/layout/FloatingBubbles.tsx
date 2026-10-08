"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
import { useFloatingWidgetEnabled } from "@/hooks/use-live-widget";

export default function FloatingBubbles() {
  const pathname = usePathname();
  // ⚠️ These bubbles are now **landing page only**. The dashboard drew them too, and
  //    there they had to step aside for the test widget's launcher and its "⚡ Test me!"
  //    teaser — three controls fighting over one corner. The dashboard dropped them on
  //    the user's call; on this marketing page a WhatsApp link is a conversion element,
  //    so they stay. The offset is still derived from the widget rather than hardcoded,
  //    because the two can be mounted from the same shell and a fixed 96px would put
  //    them back on top of each other.
  const widgetVisible = useFloatingWidgetEnabled();

  // Hide floating support widgets on Playground & Live Inbox pages
  // to avoid overlapping input controls or floating toolbars.
  //
  // ⚠️ `/playground` — the tester's page. The old `/chat` would never match again
  //    anyway: it is only a redirect stub now, where nobody ever stays.
  if (pathname?.includes("/playground") || pathname?.includes("/inbox")) {
    return null;
  }

  return (
    <div
      className={`fixed right-6 z-50 flex flex-col gap-3 ${widgetVisible ? "bottom-32" : "bottom-6"}`}
      data-testid="floating-bubbles"
    >
      <motion.a
        href="https://wa.me/8801"
        target="_blank"
        rel="noreferrer"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-full bg-[#25D366] text-white shadow-lg flex items-center justify-center"
        data-testid="float-whatsapp"
      >
        <Phone className="w-5 h-5" />
      </motion.a>
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center animate-pulse-ring"
        data-testid="float-chat"
      >
        <MessageCircle className="w-5 h-5" />
      </motion.button>
    </div>
  );
}
