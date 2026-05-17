"use client";

import { useEffect, useState } from "react";
import { AccountOverview } from "./_components/AccountOverview";
import { CurrentPlan } from "./_components/CurrentPlan";
import { ReferralSection } from "./_components/ReferralSection";
import { DangerZone } from "./_components/DangerZone";
import { BusinessSettings } from "./_components/BusinessSettings";

export default function ProfilePage() {
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    fetch("/api/usage").then(r => r.json()).then(setUsage).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 w-full">
      <AccountOverview />
      <BusinessSettings />
      <CurrentPlan usage={usage} />
      {usage?.referralCode && <ReferralSection referralCode={usage.referralCode} />}
      <DangerZone />
    </div>
  );
}
