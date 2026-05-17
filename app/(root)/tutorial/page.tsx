"use client";

import { useTranslation } from "react-i18next";
import Link from "next/link";
import { ArrowLeft, BookOpen, Video, MessageCircleQuestion, Code2, Zap } from "lucide-react";

const sections = [
  { icon: Zap, title: "Quick start", body: "Sign in with Google → Create a chatbot → Drop a PDF → Chat. You're live in 5 minutes." },
  { icon: BookOpen, title: "Training data", body: "Use Files (PDF, DOCX, TXT), Website URLs, raw Text or Q&A pairs. Mix and match — the agent will learn from all sources." },
  { icon: MessageCircleQuestion, title: "Configuring the agent", body: "Pick model (GPT-5.2, Claude Sonnet 4.5, Gemini 3 Flash), tune temperature & max tokens, write a system prompt for tone and persona." },
  { icon: Video, title: "Connecting channels", body: "Open the Integrations tab on any chatbot. Click Connect on Facebook / WhatsApp / Instagram / Telegram / Slack / Custom API or embed the website widget." },
  { icon: Code2, title: "Custom API", body: "POST /api/chatbots/{id}/chat with { message } and we return { reply }. Use API keys from Settings to build any integration." },
];

export default function TutorialPage() {
  const { t } = useTranslation(["tutorial", "common"]);
  return (
    <div className="bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground" data-testid="back-home-tut">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mt-8">{t("tutorial.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("tutorial.subtitle")}</p>
        <div className="mt-12 space-y-6">
          {sections.map((s, i) => (
            <div key={s.title} className="flex gap-5 p-6 rounded-2xl border border-border bg-card" data-testid={`tutorial-${i}`}>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
