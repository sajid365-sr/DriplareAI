import { Metadata } from "next";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";
import { ReferralDashboardView } from "./_components/ReferralDashboardView";

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
    name: r.referredUser.name || "User",
    email: r.referredUser.email || "",
    date: r.createdAt.toLocaleDateString(),
    status: (r.rewardPoints > 0 ? "Subscribed" : "Joined") as any,
    reward: r.rewardPoints
  }));

  return (
    <ReferralDashboardView
      referralCode={user.referralCode || ""}
      stats={{
        totalReferrals,
        subscribers,
        totalPoints,
        monthlyProgress
      }}
      history={history}
    />
  );
}
