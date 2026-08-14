"use client";

import { type ReactNode } from "react";
import { BookOpen, Sparkles, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Small monospace reference chip, e.g. `E-Commerce → Products`. */
function RefChip({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-primary/15 dark:bg-primary/25 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-primary border border-primary/20">
      {children}
    </code>
  );
}

/**
 * SystemPromptGuideContent — Bengali-language guidance body explaining best practices
 * for writing chatbot system prompts in Driplare AI.
 * Styled with high contrast and full dark mode compatibility.
 */
export function SystemPromptGuideContent({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5 text-foreground leading-relaxed text-sm", className)}>
      {/* Section 1 — What is a system prompt? */}
      <section className="space-y-1.5 p-4 rounded-xl bg-muted/40 border border-border">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          🤖 সিস্টেম প্রম্পট কী?
        </h4>
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          এটি আপনার AI প্রতিনিধির ‘ডিউটি রোস্টার’ বা কাজের দায়িত্ব।
          এখানে লিখবেন সে কাস্টমারের সাথে কীভাবে কথা বলবে, কীভাবে সম্ভাষণ
          জানাবে এবং অর্ডার বা বুকিং নেওয়ার প্রসেস কী হবে।
        </p>
      </section>

      {/* Section 2 — What NOT to write */}
      <section className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-4">
        <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          ⛔ এখানে কী লিখবেন না?
        </h4>
        <p className="text-muted-foreground dark:text-foreground/90 text-[13px] leading-relaxed">
          আপনার দোকানের ৫০০টি পণ্যের নাম, দাম বা ক্যাটালগ এখানে বিস্তারিত
          লেখার কোনো প্রয়োজন নেই! প্রম্পটে পুরো স্টক লিখলে বট স্লো হয়ে যেতে পারে।
        </p>
      </section>

      {/* Section 3 — Where product info & files go */}
      <section className="space-y-2.5 p-4 rounded-xl bg-muted/40 border border-border">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-sky-500" />
          📍 পণ্যের তথ্য ও ফাইল কোথায় যুক্ত করবেন?
        </h4>
        <div className="space-y-3 text-[13px]">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              🛍️ প্রোডাক্টের নাম, দাম ও স্টক:
            </span>
            <p className="text-muted-foreground">
              ড্যাশবোর্ডের <RefChip>E-Commerce → Products</RefChip>{" "}
              ট্যাবে যুক্ত করুন। AI এজেন্ট নিজে থেকেই টুল ব্যবহার করে
              সেখান থেকে রিয়েল-টাইম তথ্য দেখে উত্তর দেবে।
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              📚 বিস্তারিত FAQ, ফাইল ও সার্ভিস ক্যাটালগ:
            </span>
            <p className="text-muted-foreground">
              সাইডবারের <RefChip>Knowledge Base</RefChip> ট্যাবে ফাইল
              আপলোড বা তথ্য যুক্ত করুন।
            </p>
          </div>
        </div>
      </section>

      {/* Section 4 — What to keep in the prompt */}
      <section className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-4">
        <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ✅ সিস্টেম প্রম্পটে শুধু এই বিষয়গুলো রাখুন:
        </h4>
        <ul className="space-y-2 text-[13px] text-muted-foreground dark:text-foreground/90">
          <li className="flex items-start gap-2">
            <span className="font-bold text-emerald-500">১.</span>
            <span>শপ বা বিজনেসের নাম এবং কথা বলার ধরন (বিনয়ী/স্মার্ট/সংক্ষিপ্ত)।</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-emerald-500">২.</span>
            <span>ডেলিভারি চার্জ, অগ্রিম পেমেন্ট বা অ্যাপয়েন্টমেন্ট বুকিং নিয়ম।</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-emerald-500">৩.</span>
            <span>কাস্টমারের নাম, ফোন নম্বর ও ঠিকানা নিয়ে কীভাবে অর্ডার বা বুকিং কনফার্ম করবে।</span>
          </li>
        </ul>
      </section>
    </div>
  );
}

/**
 * SystemPromptGuideSheet — Shadcn Right Sheet Drawer component.
 * Opens a side drawer with complete guidelines when the merchant clicks the guide button.
 */
export function SystemPromptGuide({ isBn = true }: { isBn?: boolean }) {
  return (
    <Sheet side="right">
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/20 hover:border-violet-500/50 transition-all cursor-pointer"
            data-testid="system-prompt-guide-btn"
          >
            <BookOpen className="w-3.5 h-3.5 text-violet-500" />
            {isBn ? "📖 প্রম্পট গাইডলাইন" : "📖 Prompt Guidelines"}
          </Button>
        }
      />

      <SheetContent className="sm:max-w-md w-full p-6 space-y-6 overflow-y-auto" side="right">
        <SheetHeader className="space-y-1 text-left border-b border-border pb-4">
          <SheetTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <BookOpen className="w-5 h-5 text-violet-500" />
            {isBn ? "সিস্টেম প্রম্পট নির্দেশিকা" : "System Prompt Guidelines"}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {isBn
              ? "চ্যাটবটকে সঠিক নির্দেশনা দেওয়ার সহজ গাইডলাইন।"
              : "Best practices for writing instructions for your AI agent."}
          </SheetDescription>
        </SheetHeader>

        <SystemPromptGuideContent />
      </SheetContent>
    </Sheet>
  );
}
