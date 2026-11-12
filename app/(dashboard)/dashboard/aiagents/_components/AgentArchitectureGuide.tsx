"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Users,
  Target,
  Cable,
  Copy,
  Calendar,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export function AgentArchitectureGuide() {
  const { t, i18n } = useTranslation("chatbots");
  const isBn = i18n.language === "bn";
  const [isOpen, setIsOpen] = useState(true);

  const guideCards = [
    {
      icon: Users,
      badge: isBn ? "কাজের বণ্টন" : "Specialization",
      title: isBn
        ? "১. বিজনেসে একাধিক AI Agent কেন?"
        : "1. Why Multiple AI Agents?",
      description: isBn
        ? "একই বিজনেসের বিভিন্ন চ্যানেল ও কাজের জন্য আলাদা স্পেশালাইজড কর্মী নিয়োগের মতো। যেমন: ইনবক্সে অর্ডার নেওয়ার জন্য একজন Sales Agent এবং ডেলিভারি ও অভিযোগ দেখার জন্য একজন Support Agent।"
        : "Like deploying specialized team members: run one Sales Agent to convert leads and book orders in Messenger, and another Support Agent to resolve delivery inquiries and customer tickets on WhatsApp.",
    },
    {
      icon: Target,
      badge: isBn ? "পার্সোনা ও টোন" : "Persona & Role",
      title: isBn
        ? "২. AI Persona ও Role কী?"
        : "2. What is an AI Persona?",
      description: isBn
        ? "এজেন্টের সুনির্দিষ্ট দায়িত্ব ও কথা বলার ধরণ। যেমন: সেলস এজেন্টের টোন ফ্রেন্ডলি ও কনভার্সন-ফোকাসড হবে, আর ক্লিনিক এজেন্টের টোন ফর্মাল ও শিডিউল-অ্যাসিস্ট্যান্ট হিসেবে কাজ করবে।"
        : "The agent's dedicated identity, tone, and directives. A Sales Persona speaks with enthusiasm and clarity, while a Clinic Persona operates with formal care and precision schedule booking.",
    },
    {
      icon: Cable,
      badge: isBn ? "কনফ্লিক্ট-মুক্ত" : "1-to-1 Binding",
      title: isBn
        ? "৩. প্ল্যাটফর্ম ভিত্তিক চ্যানেল বাইন্ডিং"
        : "3. 1-to-1 Channel Binding",
      description: isBn
        ? "প্রতিটি ফেসবুক পেজ বা হোয়াটসঅ্যাপ নম্বরে এক সময়ে একটি মাত্র এজেন্ট লাইভ থাকে। ফলে একাধিক বটের মেসেজ কনফ্লিক্ট বা ডাবল উত্তরের কোনো ঝুঁকি থাকে না।"
        : "Each Facebook Page or WhatsApp number connects to exactly one active agent at a time. Zero message conflicts, zero accidental double-replies, and seamless merchant control.",
    },
    {
      icon: Calendar,
      badge: isBn ? "স্পেশাল সিজন" : "Campaign & Clone",
      title: isBn
        ? "৪. ঈদ ও বিশেষ অফারের স্পেশাল এজেন্ট"
        : "4. Holiday Campaigns & 1-Click Duplicate",
      description: isBn
        ? "ঈদ বা বিশেষ অফারে নতুন অফার-রুলস দিয়ে আলাদা ক্যাম্পেইন এজেন্ট তৈরি করে পেজে কানেক্ট করুন। টিপ: নতুন করে শুরু না করে (•••) মেনু থেকে 'Duplicate' বাটনে ক্লিক করে সেকেন্ডেই মূল বটের কপি তৈরি করে নিতে পারেন!"
        : "Run dedicated seasonal agents for Eid, Black Friday, or Flash Sales. Pro tip: Don't start from scratch — click 'Duplicate' from the (•••) action menu to clone your main agent in 1 second, then adjust its campaign rules!",
    },
  ];

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] via-background to-secondary/[0.06] overflow-hidden transition-all shadow-sm">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Lightbulb className="size-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{isBn ? "মাল্টি-এজেন্ট ব্যবসায়িক কৌশল ও ব্যবহার নির্দেশিকা" : "Multi-Agent Strategy & Merchant Guide"}</span>
              <span className="hidden sm:inline-flex text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {isBn ? "প্রো টিপস" : "Pro Guide"}
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {isBn
                ? "কীভাবে একাধিক AI Agent আপনার ব্যবসার সেলস ও কাস্টমার কেয়ার স্বয়ংক্রিয় করবে"
                : "Learn how multiple specialized agents automate both sales and support seamlessly"}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen((prev) => !prev)}
          className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-full cursor-pointer shrink-0"
        >
          <span className="hidden sm:inline mr-1 text-[11px] font-medium">
            {isOpen ? (isBn ? "সংকুচিত করুন" : "Collapse") : (isBn ? "বিস্তারিত দেখুন" : "Learn More")}
          </span>
          {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
      </div>

      {/* Expandable Content Grid */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 p-4 sm:p-5">
              {guideCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <div
                    key={idx}
                    className="flex flex-col justify-between p-4 rounded-xl border border-border/70 bg-card/80 hover:bg-card hover:border-primary/40 transition-all space-y-3 group"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                          <Icon className="size-4" />
                        </div>
                        <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/40">
                          {card.badge}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                        {card.title}
                      </h4>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

