"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, ShoppingBag, Star, X } from "lucide-react";

/** mock দোকানের তিনটা পণ্য — নাম অনূদিত, দাম ইচ্ছাকৃতভাবে ইংরেজি ফরম্যাটে */
const PRODUCTS = [
  { nameKey: "chat_test.bubble.product1", fallback: "Everyday Tote Bag", price: "৳ 1,290" },
  { nameKey: "chat_test.bubble.product2", fallback: "Cotton Panjabi", price: "৳ 2,450" },
  { nameKey: "chat_test.bubble.product3", fallback: "Leather Wallet", price: "৳ 990" },
];

/**
 * MessengerBubble — টেস্টার একটা সাজানো দোকানের সাইটের উপর, ঠিক যেভাবে
 * আসল কাস্টমার দেখে।
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Docked মোডে টেস্টারটা ড্যাশবোর্ডের ভেতরে থাকে — অর্থাৎ আপনি যা দেখেন, কাস্টমার
 * যা দেখে, তার থেকে আলাদা কিছু। এখানে একটা **ভুয়া দোকান** আঁকা হয়, তার উপর
 * কোণার বুদবুদ, আর সেটাই ওয়েবসাইটে বসানো widget-এর আসল চেহারা। ব্যবসায়ীর
 * বুঝতে সুবিধা হয়: "আমার সাইটে এটা কেমন দেখাবে।"
 *
 * ⚠️ এখানে কোনো আসল সাইট এমবেড করা হয় না (`iframe` নয়): বাইরের সাইট লোড হতে
 *    সময় নিত, CSP-তে আটকে যেত, আর আমাদের ড্যাশবোর্ডের থিমের সঙ্গে মিশত না।
 *    এটা একটা আঁকা ছবি — তাই সাথে সাথে আসে, দুই থিমেই মানায়, আর কোনো
 *    third-party কে আমাদের পেজের ভেতরে ডাকে না।
 *
 * ⚠️ বুদবুদের রঙ WhatsApp-এর ব্র্যান্ড সবুজ, টোকেন নয়। এটা ইচ্ছাকৃত ব্যতিক্রম,
 *    আর ড্যাশবোর্ডে এর আগেই আছে (`FloatingBubbles`-এর সাপোর্ট বাবল) — কারণ
 *    এখানে রঙটা আমাদের থিমের অংশ নয়, **অন্য একটা ব্র্যান্ডের** পরিচয়, যা
 *    ব্যবহারকারী চিনতে পারেন। এটাই সেই জায়গা যেখানে থিম-টোকেন ব্যবহার করলে
 *    ছবিটা মিথ্যা হয়ে যেত।
 */
export function MessengerBubble({ children }: { children: ReactNode }) {
  const { t } = useTranslation("chatbots");
  const [open, setOpen] = useState(true);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-background shadow-xl">
      {/* ─── Browser chrome ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-2.5">
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-destructive/60" />
          <span className="h-3 w-3 rounded-full bg-warning/70" />
          <span className="h-3 w-3 rounded-full bg-success/60" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-full border border-border bg-background px-3 py-1 text-[11px] text-muted-foreground">
          {t("chat_test.bubble.siteUrl", "https://your-store.example")}
        </div>
      </div>

      {/* ─── Mock storefront ────────────────────────────────────── */}
      {/* উচ্চতা স্থির, আর ভেতরে স্ক্রল — নইলে দোকানের কনটেন্টের লম্বা-খাটো
          অনুযায়ী বাবলের অবস্থান বদলে যেত। */}
      <div className="relative h-[560px] max-h-[70vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <span className="inline-flex items-center gap-2 text-sm font-bold tracking-tight">
            <ShoppingBag className="h-4 w-4 text-primary" />
            {t("chat_test.bubble.brand", "Your Store")}
          </span>
          <nav className="hidden items-center gap-5 text-xs font-medium text-muted-foreground sm:flex">
            <span>{t("chat_test.bubble.navShop", "Shop")}</span>
            <span>{t("chat_test.bubble.navNew", "New in")}</span>
            <span>{t("chat_test.bubble.navSupport", "Support")}</span>
          </nav>
        </div>

        <div className="bg-brand-gradient px-5 py-10 text-center text-white sm:py-14">
          <h3 className="text-lg font-bold sm:text-2xl">
            {t("chat_test.bubble.heroTitle", "Everything you need, delivered")}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-xs text-white/85 sm:text-sm">
            {t("chat_test.bubble.heroBody", "Cash on delivery across Bangladesh, 7 days a week.")}
          </p>
          <span className="mt-4 inline-flex items-center rounded-full bg-white/95 px-5 py-2 text-xs font-bold text-primary shadow-sm">
            {t("chat_test.bubble.heroCta", "Start shopping")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:gap-4">
          {PRODUCTS.map(({ nameKey, fallback, price }) => (
            <div
              key={nameKey}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xs"
            >
              <div className="flex h-24 items-center justify-center bg-secondary/60 sm:h-28">
                <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div className="space-y-1.5 p-3">
                <p className="truncate text-xs font-semibold">{t(nameKey, fallback)}</p>
                <p className="text-[11px] font-bold text-primary">{price}</p>
                <span className="flex items-center gap-0.5 text-[10px] text-warning">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} className="h-2.5 w-2.5 fill-current" />
                  ))}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-5 py-6 text-center text-[11px] text-muted-foreground">
          {t("chat_test.bubble.footer", "Questions? The chat bubble knows your products, prices and delivery rules.")}
        </div>
      </div>

      {/* ─── Chat widget ──────────────────────────────────────────── */}
      {/* ⚠️ উইজেটটা স্ক্রল-কনটেইনারের **বাইরে**, ফ্রেমের উপরে বসানো। ভেতরে
          রাখলে দোকান স্ক্রল করার সঙ্গে উইজেটও সরে যেত — অথচ আসল widget নড়ে
          না, পাতাটাই ওর পেছনে চলে। এই একটা জিনিসই "এটা সত্যিই আমার সাইটে
          কেমন দেখাবে" কথাটা বিশ্বাসযোগ্য করে। */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute bottom-24 right-4 z-20 h-[440px] max-h-[calc(100%-8rem)] w-[min(360px,calc(100%-2rem))] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl sm:right-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={
          open
            ? t("chat_test.bubble.closeWidget", "Close the chat widget")
            : t("chat_test.bubble.openWidget", "Open the chat widget")
        }
        data-testid="messenger-launcher"
        className="absolute bottom-5 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform hover:scale-105 active:scale-95 sm:right-5"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
