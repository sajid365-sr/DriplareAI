"use client";

import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatbotsHeaderProps {
  isLimitReached: boolean;
  limit: number;
  /** Opens the create dialog. Creation is a decision the list page owns. */
  onCreate: () => void;
}

export function ChatbotsHeader({ isLimitReached, limit, onCreate }: ChatbotsHeaderProps) {
  const { t } = useTranslation("chatbots");

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold tracking-tight" data-testid="ai-agents-title">
        {t("title", "AI Agents")}
      </h1>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            onClick={(e) => {
              if (isLimitReached) {
                e.preventDefault();
                return;
              }
              onCreate();
            }}
            className={`inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 px-4 py-2 rounded-full ${isLimitReached ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' : 'bg-foreground text-background hover:bg-foreground/90'}`}
            data-testid="new-chatbot-btn"
            aria-disabled={isLimitReached}
          >
            <Plus className="w-4 h-4 mr-1.5" /> {t("newChatbot", "New Chatbot")}
          </TooltipTrigger>
          {isLimitReached && (
            <TooltipContent side="top" align="end" className="bg-destructive/10 text-destructive border-destructive/20 shadow-md text-xs font-medium max-w-[250px] p-2.5 rounded-lg leading-relaxed">
              <p>{t("limitReachedTooltip", { defaultValue: "You have reached your limit of {{limit}} chatbot{{plural}}.", limit, plural: limit !== 1 ? 's' : '' })}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
