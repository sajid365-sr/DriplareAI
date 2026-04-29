"use client";

import { usePathname, useParams } from "next/navigation";
import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import FloatingBubbles from "./FloatingBubbles";
import { useTranslation } from "react-i18next";
import { Bot } from "lucide-react";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  
  const chatbotId = params?.chatbotId as string | undefined;
  const isBotPage = !!chatbotId;

  const breadcrumb = isBotPage ? (
    <span className="flex items-center gap-2">
      <Bot className="w-4 h-4" /> {t("common.aiAgents", "AI Agents")}
      <span className="opacity-50">›</span>
      <span className="text-foreground font-medium capitalize">{pathname?.split("/").pop()}</span>
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <Bot className="w-4 h-4" /> {t("common.aiAgents", "AI Agents")}
    </span>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header breadcrumb={breadcrumb} />
      <div className="flex">
        {isBotPage ? (
          <Sidebar variant="bot" chatbotId={chatbotId} collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
        ) : (
          <Sidebar variant="main" collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
        )}
        <main className="flex-1 min-h-[calc(100vh-64px)] p-4 md:p-8 max-w-[1400px]">
          {children}
        </main>
      </div>
      <FloatingBubbles />
    </div>
  );
}
