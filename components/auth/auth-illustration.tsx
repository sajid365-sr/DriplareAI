"use client";

import { Bot, Check, MessageCircle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

export function AuthIllustration() {
  const { t } = useTranslation("auth");

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col justify-center lg:max-w-xl">
      <div className="relative aspect-[1.12/1] overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-5 shadow-xl shadow-primary/5 sm:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex h-full items-center justify-center">
          <div className="absolute left-[8%] top-[15%] flex max-w-[72%] items-center gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg sm:left-[12%] sm:p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="space-y-1.5">
              <span className="block h-2 w-24 rounded-full bg-foreground/15" />
              <span className="block h-2 w-16 rounded-full bg-foreground/10" />
            </span>
          </div>

          <div className="relative z-10 flex h-28 w-28 items-center justify-center rounded-[2rem] border border-primary/20 bg-card shadow-2xl shadow-primary/15 sm:h-36 sm:w-36">
            <div className="absolute inset-2 rounded-[1.5rem] bg-gradient-to-br from-primary/15 to-transparent" />
            <Bot className="relative h-12 w-12 text-primary sm:h-16 sm:w-16" strokeWidth={1.4} />
            <Sparkles className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-background p-1.5 text-primary shadow-md" />
          </div>

          <div className="absolute bottom-[13%] right-[4%] flex items-center gap-3 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg sm:right-[10%] sm:p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-4 w-4" />
            </span>
            <span className="space-y-1.5">
              <span className="block h-2 w-20 rounded-full bg-foreground/15" />
              <span className="block h-2 w-14 rounded-full bg-foreground/10" />
            </span>
          </div>

          <div className="absolute right-[13%] top-[44%] h-2 w-2 rounded-full bg-primary/50" />
          <div className="absolute bottom-[29%] left-[12%] h-3 w-3 rounded-full bg-primary/30" />
        </div>
      </div>

      <div className="mt-7 space-y-3 text-center lg:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t("auth.visualEyebrow")}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t("auth.visualTitle")}
        </h2>
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          {t("auth.visualDescription")}
        </p>
      </div>
    </div>
  );
}
