"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/** localStorage key used to remember the merchant's collapse choice. */
const STORAGE_KEY = "driplare:system-prompt-guide-open";

/** Small monospace reference chip, e.g. `E-Commerce → Products`. */
function RefChip({ children }: { children: ReactNode }) {
    return (
        <code className="rounded-md bg-violet-500/10 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-violet-600 dark:text-violet-300">
            {children}
        </code>
    );
}

/**
 * SystemPromptGuide — a collapsible, Bengali-language info card that teaches
 * merchants what to (and what not to) put in their chatbot's system prompt.
 * Styled with Driplare standards: a violet→blue gradient border wrapping a
 * glassmorphic light/dark surface. The expand/collapse choice is persisted in
 * localStorage and animated with Framer Motion height expansion.
 */
export function SystemPromptGuide({ className }: { className?: string }) {
    // Default open so first-time merchants see the guidance; restored from
    // localStorage on mount (client-only, to avoid an SSR hydration mismatch).
    const [open, setOpen] = useState(true);

    useEffect(() => {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved !== null) setOpen(saved === "true");
    }, []);

    const toggle = () => {
        setOpen((prev) => {
            const next = !prev;
            window.localStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    };

    return (
        <div
            className={cn(
                "rounded-2xl bg-gradient-to-r from-violet-500 via-primary to-blue-500 p-px shadow-sm",
                className
            )}
        >
            <div className="rounded-2xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl">
                {/* ─── Header bar ─────────────────────────────────────── */}
                <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-controls="system-prompt-guide-content"
                    className="flex w-full items-start gap-3 p-4 text-left"
                >
                    <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm font-bold leading-snug text-foreground">
                            💡 সিস্টেম প্রম্পট গাইড: কীভাবে আপনার চ্যাটবটকে সঠিক নির্দেশ দেবেন?
                        </p>
                        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-500/15 to-blue-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-500/20 dark:text-violet-300">
                            সহজ গাইডলাইন
                        </span>
                    </div>
                    <motion.span
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="mt-0.5 shrink-0 text-muted-foreground"
                    >
                        <ChevronDown className="h-5 w-5" />
                    </motion.span>
                </button>

                {/* ─── Collapsible content ────────────────────────────── */}
                <AnimatePresence initial={false}>
                    {open && (
                        <motion.div
                            id="system-prompt-guide-content"
                            key="content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                        >
                            <div className="space-y-4 px-4 pb-4 pt-1 text-[13px] leading-relaxed text-foreground/90">
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />

                                {/* Section 1 — What is a system prompt? */}
                                <section className="space-y-1">
                                    <h4 className="text-sm font-bold text-foreground">
                                        🤖 সিস্টেম প্রম্পট কী?
                                    </h4>
                                    <p>
                                        এটি আপনার AI প্রতিনিধির ‘ডিউটি রোস্টার’ বা কাজের দায়িত্ব।
                                        এখানে লিখবেন সে কাস্টমারের সাথে কীভাবে কথা বলবে, কীভাবে সম্ভাষণ
                                        জানাবে এবং অর্ডার বা বুকিং নেওয়ার প্রসেস কী হবে।
                                    </p>
                                </section>

                                {/* Section 2 — What NOT to write */}
                                <section className="space-y-1 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                                    <h4 className="text-sm font-bold text-foreground">
                                        ⛔ এখানে কী লিখবেন না?
                                    </h4>
                                    <p>
                                        আপনার দোকানের ৫০০টি পণ্যের নাম, দাম বা ক্যাটালগ এখানে বিস্তারিত
                                        লেখার কোনো প্রয়োজন নেই! প্রম্পটে পুরো স্টক লিখলে বট স্লো হয়ে
                                        যেতে পারে।
                                    </p>
                                </section>

                                {/* Section 3 — Where product info & files go */}
                                <section className="space-y-2">
                                    <h4 className="text-sm font-bold text-foreground">
                                        📍 পণ্যের তথ্য ও ফাইল কোথায় যুক্ত করবেন?
                                    </h4>
                                    <div className="space-y-2.5">
                                        <p className="flex flex-col gap-0.5">
                                            <span className="font-semibold text-foreground">
                                                🛍️ প্রোডাক্টের নাম, দাম ও স্টক:
                                            </span>
                                            <span>
                                                ড্যাশবোর্ডের <RefChip>E-Commerce → Products</RefChip>{" "}
                                                ট্যাবে যুক্ত করুন। AI এজেন্ট নিজে থেকেই টুল ব্যবহার করে
                                                সেখান থেকে রিয়েল-টাইম তথ্য দেখে উত্তর দেবে।
                                            </span>
                                        </p>
                                        <p className="flex flex-col gap-0.5">
                                            <span className="font-semibold text-foreground">
                                                📚 বিস্তারিত FAQ, ফাইল ও সার্ভিস ক্যাটালগ:
                                            </span>
                                            <span>
                                                সাইডবারের <RefChip>Knowledge Base</RefChip> ট্যাবে ফাইল
                                                আপলোড বা তথ্য যুক্ত করুন।
                                            </span>
                                        </p>
                                    </div>
                                </section>

                                {/* Section 4 — What to keep in the prompt */}
                                <section className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                                    <h4 className="text-sm font-bold text-foreground">
                                        ✅ সিস্টেম প্রম্পটে শুধু এই বিষয়গুলো রাখুন:
                                    </h4>
                                    <ul className="list-none space-y-1.5">
                                        <li>
                                            ১. শপ বা বিজনেসের নাম এবং কথা বলার ধরন
                                            (বিনয়ী/স্মার্ট/সংক্ষিপ্ত)।
                                        </li>
                                        <li>
                                            ২. ডেলিভারি চার্জ, অগ্রিম পেমেন্ট বা অ্যাপয়েন্টমেন্ট বুকিং
                                            নিয়ম।
                                        </li>
                                        <li>
                                            ৩. কাস্টমারের নাম, ফোন নম্বর ও ঠিকানা নিয়ে কীভাবে অর্ডার বা
                                            বুকিং কনফার্ম করবে।
                                        </li>
                                    </ul>
                                </section>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
