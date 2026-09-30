"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import Sidebar from "./Sidebar";
import { BrandLogo } from "./BrandLogo";

/**
 * মোবাইলের জন্য মূল ড্যাশবোর্ড নেভিগেশন।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * সমস্যাটা কী ছিল: দুই `Sidebar`-ই `hidden md:flex`, আর `DashboardHeader`-এ
 * কোনো hamburger ছিল না। অর্থাৎ ফোনে Overview, Inbox, Leads, Products, AI
 * Agents, Knowledge Base, Automations, Platforms, Usage, Settings, Billing —
 * কোনোটাতেই যাওয়ার পথ ছিল না। ডেস্কটপে যাওয়া যেত, মোবাইলে যাওয়া যেত না।
 *
 * এজেন্ট-প্রতি ট্যাবের (Playground · Analytics · Settings) জন্য আলাদা
 * `BotTabStrip` আছে — সেটা পেজের ভেতরে বসে, কারণ ওগুলো পেজ-স্তরের ট্যাব।
 * এটা তার চেয়ে এক স্তর উপরে: পুরো অ্যাপের নেভিগেশন।
 *
 * ⚠️ এখানে **নতুন করে কোনো তালিকা লেখা হয়নি**। ভেতরে ঠিক ওই `Sidebar`
 *    কম্পোনেন্টই বসে (`mobile` prop দিয়ে), তাই ডেস্কটপ আর মোবাইল কখনো
 *    আলাদা তালিকা পাবে না। আলাদা তালিকা লিখলে `bot-nav.ts`-এর আগের অবস্থা
 *    ফিরে আসত — দুই জায়গায় দুই নিয়ম।
 *
 * এজেন্ট-পেজে bot sidebar-টা ইচ্ছাকৃতভাবে **আনি না**: ওই কাজটা মোবাইলে
 * `BotTabStrip` করে, আর একই তিনটা ট্যাব দুই জায়গায় দেখানো মানে বিভ্রান্তি।
 */
export function MobileNavDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  // Escape-এ বন্ধ। শুধু খোলা থাকলে লিসেনার বসে, তাই বন্ধ ড্রয়ার কোনো key
  // ইভেন্ট গিলে ফেলে না।
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        // `md:hidden` wrapper-এ, তাই ডেস্কটপ প্রস্থে ড্রয়ার কখনো দেখা যায় না —
        // এমনকি কোনো কারণে state খোলা থেকে গেলেও।
        <div className="md:hidden" data-testid="mobile-nav-drawer">
          {/* Backdrop — ট্যাপ করলেই বন্ধ। */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={t("nav.menu", "Main menu")}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className="fixed inset-y-0 left-0 z-[80] flex w-[280px] max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl"
          >
            {/* Drawer হেডার — ড্রয়ারটা অ্যাপ-হেডার ঢেকে দেয়, তাই লোগোটা
                এখানেও থাকলে অবিচ্ছিন্নতা থাকে। */}
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
              <BrandLogo className="h-7 w-auto" />
              <button
                type="button"
                onClick={onClose}
                aria-label={t("nav.closeMenu", "Close menu")}
                data-testid="mobile-nav-close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* পুরো উচ্চতা নেয়, ভেতরে নিজেই scroll করে — তাই credit কার্ডটা
                নিচে আটকে থাকে, ঠিক ডেস্কটপের মতো।

                `chatbotId` ইচ্ছাকৃতভাবে পাঠানো হয় না: ডেস্কটপের main sidebar-ও
                পায় না (`layout.tsx`), আর দুটো আলাদা হলে Knowledge Base লিংক
                দুই ডিভাইসে দুই রকম হতো। */}
            <div className="min-h-0 flex-1">
              <Sidebar variant="main" mobile />
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
