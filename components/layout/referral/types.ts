export interface ReferralData {
  referralCode: string | null;
  totalReferrals: number;
  totalEarned: number;
  referrals: Array<{
    id: string;
    name: string;
    email: string;
    joinedAt: string;
    status: "signed_up" | "subscribed";
    rewardEarned: number;
  }>;
}
