import { Metadata } from "next";
import { db } from "@/lib/db";
import { getAndSyncUser } from "@/lib/auth";
import { ReferralStats } from "@/components/settings/referrals/ReferralStats";
import { ReferralHistory } from "@/components/settings/referrals/ReferralHistory";
import { AffiliateBanner } from "@/components/settings/referrals/AffiliateBanner";
import { ReferralSection } from "@/components/settings/ReferralSection";

export const metadata: Metadata = {
  title: "Referrals & Rewards | Driplare AI",
  description: "Track your referrals, rewards, and upcoming affiliate earnings.",
};

export default async function ReferralsPage() {
  const user = await getAndSyncUser();

  if (!user) return null;

  // Fetch referrals for this user
  const referrals = await db.referral.findMany({
    where: { referrerId: user.userId },
    include: {
      referredUser: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate stats
  const totalReferrals = referrals.length;
  const subscribers = referrals.filter(r => r.rewardPoints > 0).length;
  const totalPoints = referrals.reduce((acc, curr) => acc + curr.rewardPoints, 0);

  // Calculate monthly progress (Max 5)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  const monthlyProgress = referrals.filter(r => 
    r.rewardPoints > 0 && r.updatedAt >= startOfMonth
  ).length;

  const history = referrals.map(r => ({
    id: r.id,
    name: r.referredUser.name,
    email: r.referredUser.email,
    date: r.createdAt.toLocaleDateString(),
    status: (r.rewardPoints > 0 ? "Subscribed" : "Joined") as any,
    reward: r.rewardPoints
  }));

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h2 className="text-xl font-bold mb-1">Referrals & Rewards</h2>
        <p className="text-sm text-muted-foreground">Share Driplare AI with your friends and earn bonus messages.</p>
      </div>

      <ReferralStats 
        stats={{
          totalReferrals,
          subscribers,
          totalPoints,
          monthlyProgress
        }} 
      />

      <div className="grid grid-cols-1 gap-8">
        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
          <h3 className="font-bold text-lg mb-4">Your Referral Link</h3>
          <ReferralSection referralCode={user.referralCode || ""} />
        </div>

        <AffiliateBanner />

        <ReferralHistory history={history} />
      </div>
    </div>
  );
}
