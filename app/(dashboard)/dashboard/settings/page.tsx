"use client";

import { useEffect, useState } from "react";
import { AccountOverview } from "@/components/settings/AccountOverview";
import { CurrentPlan } from "@/components/settings/CurrentPlan";
import { ReferralSection } from "@/components/settings/ReferralSection";
import { DangerZone } from "@/components/settings/DangerZone";

export default function ProfilePage() {
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 w-full">
      <AccountOverview />
      <CurrentPlan usage={usage} />
      {usage?.referralCode && <ReferralSection referralCode={usage.referralCode} />}
      <DangerZone />
    </div>
  );
}
