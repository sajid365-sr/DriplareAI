"use client";

import { useTranslation, Trans } from "react-i18next";

interface PlanLimitsBannerProps {
  usage: any;
  botsCount: number;
}

export function PlanLimitsBanner({ usage, botsCount }: PlanLimitsBannerProps) {
  const { t } = useTranslation("chatbots");

  if (!usage) return null;

  const botsLimit = usage.includedChatbots === Infinity ? t("messages.unlimited", "Unlimited") : usage.includedChatbots;
  const botsPlural = usage.includedChatbots !== 1 ? 's' : '';
  const integrationsLimit = usage.maxIntegrationsPerChatbot === Infinity ? t("messages.unlimited", "Unlimited") : usage.maxIntegrationsPerChatbot;
  const integrationsPlural = usage.maxIntegrationsPerChatbot !== 1 ? 's' : '';

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold text-primary">
          {t("planLimitsTitle", "Plan Limits & Usage")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          <Trans
            t={t}
            i18nKey="planLimitsDesc"
            values={{
              plan: usage.plan,
              botsLimit,
              botsPlural,
              integrationsLimit,
              integrationsPlural,
            }}
            components={[
              <strong key="0" className="font-bold uppercase text-foreground" />,
              <strong key="1" className="font-bold text-foreground" />,
              <strong key="2" className="font-bold text-foreground" />
            ]}
          />
        </p>
      </div>
      <div className="flex items-center gap-4 text-xs font-medium shrink-0">
        <div className="flex flex-col items-center p-2 px-3 bg-background rounded-lg border border-border shadow-sm">
          <span className="text-muted-foreground">{t("chatbots", "Chatbots")}</span>
          <span className="text-foreground font-bold">
            {botsCount} / {usage.includedChatbots === Infinity ? "∞" : usage.includedChatbots}
          </span>
        </div>
      </div>
    </div>
  );
}
