"use client";

import { Settings2, RotateCcw, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

interface CompareHeaderProps {
  botName?: string;
  chatbotId: string;
  onReset: () => void;
  /** এখন কতটা মডেল পাশাপাশি চলছে (২–৪) — লেখাটা এর উপর নির্ভর করে */
  modelCount: number;
}

export const CompareHeader = ({ botName, chatbotId, onReset, modelCount }: CompareHeaderProps) => {
  const { t } = useTranslation("chatbots");
  const router = useRouter();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("compare.title", "Model Comparison")}
          </h1>
          {botName && (
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
              {botName}
            </span>
          )}
          {/* ⚠️ "Pro" ট্যাগটা এখানে থাকা দরকার — নইলে Starter-এর merchant
              এই পেজে ঢুকে শুধু blur দেখতেন আর বুঝতেন না এটা plan-এর সীমা, bug নয়।
              (আসল তালা `LockedOverlay`-এ, ওখানে upgrade-এর রাস্তাও আছে।) */}
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Crown className="h-3 w-3" />
            {t("compare.pro_badge", "Pro")}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("compare.subtitle", {
            count: modelCount,
            defaultValue:
              "One message, {{count}} models — each answering with your chatbot's own prompt and knowledge base.",
          })}
        </p>
      </div>
      <div className="flex items-center gap-3 w-full md:w-auto">
        <Button
          variant="outline"
          onClick={onReset}
          className="border-primary/20 hover:bg-primary/5 rounded-xl font-medium flex items-center gap-1.5 h-10 w-full md:w-auto"
        >
          <RotateCcw className="w-4 h-4" />
          {t("compare.reset", "Reset Chat")}
        </Button>
        {/* ⚠️ গন্তব্য `/setup`, `/playground` নয় — যে মডেলগুলো এখানে তুলনা করা
            হচ্ছে সেগুলো বদলানোর জায়গা Setup-এ। আগে এই বোতামটা টেস্টারের পেজে
            পাঠাত, যা নতুন গঠনে অর্থহীন। */}
        <Button
          onClick={() => router.push(`/dashboard/chatbots/${chatbotId}/setup`)}
          className="bg-brand-gradient hover:opacity-90 text-white rounded-xl shadow-md transition-all duration-300 hover:scale-[1.02] font-medium flex items-center gap-1.5 h-10 w-full md:w-auto shrink-0 border-none"
          data-testid="configure-models"
        >
          <Settings2 className="w-4 h-4" />
          {t("compare.configure", "Configure Models")}
        </Button>
      </div>
    </div>
  );
};
