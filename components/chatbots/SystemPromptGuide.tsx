"use client";

import { useState, type ReactNode } from "react";
import {
  BookOpen,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShoppingBag,
  Plane,
  HeartPulse,
  GraduationCap,
  Sparkle,
} from "lucide-react";
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

type GuideTab = "ecommerce" | "travel" | "healthcare" | "education" | "custom";

const INDUSTRY_TIPS: Record<
  GuideTab,
  {
    icon: any;
    title: string;
    promptDo: string[];
    kbUpload: string[];
  }
> = {
  ecommerce: {
    icon: ShoppingBag,
    title: "ই-কমার্স / অনলাইন শপ",
    promptDo: [
      "দোকানের নাম ও সম্ভাষণের ধরন (বন্ধুত্বপূর্ণ / বিনয়ী)",
      "ডেলিভারি চার্জ (ঢাকার ভেতরে ৮০ টাকা, বাইরে ১৫০ টাকা)",
      "অগ্রিম পেমেন্ট নীতি (যেমন: ডেলিভারি চার্জ অগ্রিম প্রযোজ্য)",
      "অর্ডারের স্লট-ফিলিং (পণ্য, সাইজ/কালার, নাম, ফোন, পূর্ণ ঠিকানা)",
    ],
    kbUpload: [
      "পণ্য ক্যাটালগ ও মূল্য তালিকা (E-Commerce → Products এ যোগ করুন)",
      "রিটার্ন ও এক্সচেঞ্জ পলিসি ডকুমেন্ট",
      "সাইজ চার্ট ও কাপড়ের স্পেসিফিকেশন",
    ],
  },
  travel: {
    icon: Plane,
    title: "ট্যুর ও ট্রাভেল",
    promptDo: [
      "এজেন্সির নাম ও ট্যুরের ধরন (দেশীয়/আন্তর্জাতিক)",
      "বুকিং অগ্রিম নীতি (যেমন: ৩০% অগ্রিম বাধ্যতামূলক)",
      "বাতিলকরণ নীতি (৭ দিন আগে বাতিল করলে ৫০% ফেরত)",
      "ভ্রমণকারীর নাম, সংখ্যা, ভ্রমণের তারিখ ও ফোন নম্বর সংগ্রহ",
    ],
    kbUpload: [
      "ট্যুর প্যাকেজ শিডিউল ও ডে-ওয়াইজ আইটিনেরারি (PDF/Word)",
      "হোটেল ক্যাটাগরি ও অন্তর্ভুক্ত সুবিধাসমূহ",
      "ভিসা প্রসেসিং ডকুমেন্টস রিকোয়ারমেন্টস",
    ],
  },
  healthcare: {
    icon: HeartPulse,
    title: "স্বাস্থ্যসেবা ও ক্লিনিক",
    promptDo: [
      "জরুরি সতর্কতা: AI ডাক্তার নয়, ওষুধ সাজেস্ট বা প্রেসক্রিপশন দেবে না",
      "জরুরি অবস্থায় সরাসরি হাসপাতালে যাওয়ার পরামর্শ",
      "রোগীর নাম, বয়স, সমস্যা, পছন্দের তারিখ ও ফোন নিয়ে অ্যাপয়েন্টমেন্ট নেওয়া",
    ],
    kbUpload: [
      "ডাক্তারদের তালিকা, ডিগ্রি ও চেম্বারের সময়সূচী",
      "ডায়াগনস্টিক টেস্টের ফি তালিকা ও রিপোর্ট ডেলিভারি সময়",
      "ক্লিনিক ও অ্যাম্বুলেন্স যোগাযোগের জরুরি নম্বর",
    ],
  },
  education: {
    icon: GraduationCap,
    title: "শিক্ষা ও কোচিং সেন্টার",
    promptDo: [
      "প্রতিষ্ঠানের নাম ও অফারকৃত কোর্সের সংক্ষিপ্ত উদ্দেশ্য",
      "ক্লাস মাধ্যম স্পষ্ট করা (অনলাইন জুম/অফলাইন ব্রাঞ্চ)",
      "শিক্ষার্থীর নাম, শিক্ষাগত যোগ্যতা, পছন্দের ব্যাচ ও ফোন সংগ্রহ",
    ],
    kbUpload: [
      "কোর্স সিলেবাস ও কারিকুলাম পিডিএফ",
      "ভর্তি ফি, মাসিক ফি ও স্কলারশিপ পলিসি",
      "ক্লাস রুটিন ও ইন্সট্রাক্টর প্রোফাইল",
    ],
  },
  custom: {
    icon: Sparkle,
    title: "কাস্টম ব্যবসা / অন্যান্য",
    promptDo: [
      "ব্যবসার পরিচয় ও মূল লক্ষ্য (লিড সংগ্রহ / পরামর্শ / বুকিং)",
      "AI সমাধান করতে না পারলে মানুষের যোগাযোগের নম্বর বা ইমেইল",
      "কাস্টমারের প্রয়োজন ও ফোন নম্বর নিয়ে ডাটা সেভ করা",
    ],
    kbUpload: [
      "কোম্পানি প্রোফাইল ও সার্ভিস বিবরণী ফাইল",
      "সাধারণ প্রশ্ন ও উত্তর (FAQ)",
      "মূল্য তালিকা ও চুক্তি শর্তাবলী",
    ],
  },
};

export function SystemPromptGuideContent({ className }: { className?: string }) {
  const [activeTab, setActiveTab] = useState<GuideTab>("ecommerce");
  const currentIndustry = INDUSTRY_TIPS[activeTab];
  const IconComponent = currentIndustry.icon;

  return (
    <div className={cn("space-y-5 text-foreground leading-relaxed text-sm", className)}>
      {/* Section 1 — What is a system prompt? */}
      <section className="space-y-1.5 p-4 rounded-xl bg-muted/40 border border-border">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          🤖 সিস্টেম প্রম্পট কী?
        </h4>
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          এটি আপনার AI প্রতিনিধির ‘ডিউটি রুলস’ বা কাজের মূল আচরণবিধি।
          এখানে লিখবেন সে কীভাবে কাস্টমারের সাথে কথা বলবে, সম্ভাষণ জানাবে এবং
          কী নিয়ম মেনে অর্ডার, লিড বা বুকিং সংগ্রহ করবে।
        </p>
      </section>

      {/* Section 2 — Industry Selector */}
      <div className="space-y-2">
        <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          আপনার ব্যবসার ধরন অনুযায়ী নিয়মাবলী দেখুন:
        </h5>
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          {(Object.keys(INDUSTRY_TIPS) as GuideTab[]).map((tabKey) => {
            const item = INDUSTRY_TIPS[tabKey];
            const TabIcon = item.icon;
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{item.title.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3 — Industry Specific Guide */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 space-y-3">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-primary" />
          {currentIndustry.title} — নির্দেশিকা
        </h4>

        <div className="space-y-2">
          <span className="text-xs font-bold text-success flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> প্রম্পটে যা লিখবেন:
          </span>
          <ul className="space-y-1 text-[12px] text-muted-foreground pl-5 list-disc">
            {currentIndustry.promptDo.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 pt-2 border-t border-border/50">
          <span className="text-xs font-bold text-info flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" /> নলেজ বেসে যা আপলোড করবেন:
          </span>
          <ul className="space-y-1 text-[12px] text-muted-foreground pl-5 list-disc">
            {currentIndustry.kbUpload.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Section 4 — What NOT to write */}
      <section className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-4">
        <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          ⛔ প্রম্পটে কী লিখবেন না?
        </h4>
        <p className="text-muted-foreground dark:text-foreground/90 text-[12px] leading-relaxed">
          আপনার ৫০০টি পণ্যের বিস্তারিত ক্যাটালগ, বড় খাবারের মেনু বা ডাক্তারদের পুরো বায়োডাটা
          এখানে লিখবেন না! সেগুলো <RefChip>Knowledge Base</RefChip> ট্যাবে ফাইল বা পিডিএফ আকারে আপলোড করুন।
        </p>
      </section>
    </div>
  );
}

export function SystemPromptGuide({ isBn = true }: { isBn?: boolean }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-semibold bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:border-primary/50 transition-all cursor-pointer"
            data-testid="system-prompt-guide-btn"
          >
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            {isBn ? "📖 প্রম্পট গাইডলাইন" : "📖 Prompt Guidelines"}
          </Button>
        }
      />

      <SheetContent className="sm:max-w-md w-full p-6 space-y-6 overflow-y-auto" side="right">
        <SheetHeader className="space-y-1 text-left border-b border-border pb-4">
          <SheetTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <BookOpen className="w-5 h-5 text-primary" />
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
