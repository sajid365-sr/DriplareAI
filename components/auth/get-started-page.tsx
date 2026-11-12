"use client";

import Link from "next/link";
import { ArrowRight, Building2, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthShell } from "@/components/auth/auth-shell";

export function GetStartedPage() {
  const { t } = useTranslation("auth");

  return (
    <AuthShell showBackLink={false}>
      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t("getStarted.eyebrow")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("getStarted.title")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {t("getStarted.subtitle")}
        </p>
      </div>

      <div className="space-y-3">
        <OptionCard
          href="/sign-up"
          icon={<UserRound className="h-5 w-5" />}
          title={t("getStarted.personalTitle")}
          description={t("getStarted.personalDescription")}
        />
        <OptionCard
          href="/get-started/business"
          icon={<Building2 className="h-5 w-5" />}
          title={t("getStarted.businessTitle")}
          description={t("getStarted.businessDescription")}
        />
      </div>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        {t("getStarted.signInPrompt")}{" "}
        <Link href="/sign-in" className="font-semibold text-primary hover:underline">
          {t("getStarted.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}

function OptionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 sm:p-5"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </Link>
  );
}
