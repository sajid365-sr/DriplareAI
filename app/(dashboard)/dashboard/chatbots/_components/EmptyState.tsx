"use client";

import { useTranslation } from "react-i18next";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  /** Opens the create dialog. */
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  const { t } = useTranslation("chatbots");

  return (
    <div className="p-12 text-center" data-testid="empty-state">
      <Bot className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
      <p className="text-muted-foreground mb-4">
        {t("empty.message", "No chatbots yet — create your first one")}
      </p>
      <Button onClick={onCreate} className="rounded-full" data-testid="empty-create-btn">
        <Plus className="w-4 h-4 mr-1" /> {t("newChatbot", "New Chatbot")}
      </Button>
    </div>
  );
}
