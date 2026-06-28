"use client";

import { useTranslation } from "react-i18next";
import { ReferralStats } from "./ReferralStats";
import { ReferralHistory } from "./ReferralHistory";
import { AffiliateBanner } from "./AffiliateBanner";
import { ReferralSection } from "../../_components/ReferralSection";

interface ReferralEntry {
  id: string;
  name: string;
  email: string;
  date: string;
  status: "Joined" | "Subscribed";
  reward: number;
}

interface ReferralDashboardViewProps {
  referralCode: string;
  stats: {
    totalReferrals: number;
    subscribers: number;
    totalPoints: number;
    monthlyProgress: number;
  };
  history: ReferralEntry[];
}

export function ReferralDashboardView({
  referralCode,
  stats,
  history,
}: ReferralDashboardViewProps) {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-xl font-bold mb-1">
          {t("referrals.title", "Referrals & Rewards")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("referrals.subtitle", "Share REMOVED AI with your friends and earn bonus credits.")}
        </p>
      </div>

      <ReferralStats stats={stats} />

      <div className="grid grid-cols-1 gap-8">
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
          <h3 className="font-bold text-lg mb-4">
            {t("referrals.linkTitle", "Your Referral Link")}
          </h3>
          <ReferralSection referralCode={referralCode} />
        </div>

        <AffiliateBanner />

        <ReferralHistory history={history} />
      </div>
    </div>
  );
}
