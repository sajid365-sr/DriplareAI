"use client";

import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

interface CompareHeaderProps {
  botName?: string;
  chatbotId: string;
  onReset: () => void;
}

export const CompareHeader = ({ botName, chatbotId, onReset }: CompareHeaderProps) => {
  const { t } = useTranslation("chatbots");
  const router = useRouter();

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("compare.title", "Model Comparison")}
          </h1>
          {botName && (
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
              {botName}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Test and compare two different AI models using your chatbot&apos;s prompt and knowledge base.
        </p>
      </div>
      <div className="flex items-center gap-3 w-full md:w-auto">
        <Button
          variant="outline"
          onClick={onReset}
          className="border-primary/20 hover:bg-primary/5 rounded-xl font-medium flex items-center gap-1.5 h-10 w-full md:w-auto"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Chat
        </Button>
        <Button
          onClick={() => router.push(`/dashboard/chatbots/${chatbotId}/chat`)}
          className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white rounded-xl shadow-md transition-all duration-300 hover:scale-[1.02] font-medium flex items-center gap-1.5 h-10 w-full md:w-auto shrink-0"
          data-testid="configure-models"
        >
          <Settings2 className="w-4 h-4" />
          {t("compare.configure", "Configure Models")}
        </Button>
      </div>
    </div>
  );
};
