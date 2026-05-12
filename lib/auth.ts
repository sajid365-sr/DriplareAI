import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "./db";
import { randomBytes } from "crypto";

function generateReferralCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F9B2C1"
}

export async function getAndSyncUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const existingByUserId = await db.user.findUnique({ where: { userId } });
  
  if (existingByUserId) {
    // Backfill referral code if missing (for existing users)
    if (!existingByUserId.referralCode) {
      return await db.user.update({
        where: { userId },
        data: { referralCode: generateReferralCode() },
      });
    }
    return existingByUserId;
  }

  const existingByEmail = await db.user.findUnique({ where: { email } });

  if (existingByEmail) {
    const updated = await db.user.update({
      where: { email },
      data: {
        userId,
        referralCode: existingByEmail.referralCode ?? generateReferralCode(),
      },
    });
    return updated;
  }

  // Create new user with auto-generated referral code
  return await db.user.create({
    data: {
      userId,
      email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "User",
      picture: user.imageUrl,
      referralCode: generateReferralCode(),
    },
  });
}

/**
 * Track a referral when a new user signs up via a referral link.
 * Call this once after the user is created with their referral code.
 */
export async function trackReferral(newUserId: string, referralCode: string) {
  try {
    const referrer = await db.user.findUnique({ where: { referralCode } });
    if (!referrer || referrer.userId === newUserId) return;

    // Avoid duplicate referrals
    const existing = await db.referral.findFirst({
      where: { referredUserId: newUserId },
    });
    if (existing) return;

    await db.referral.create({
      data: {
        referrerId: referrer.userId,
        referredUserId: newUserId,
        referralCode,
        rewardPoints: 0, // reward given on first subscription, not signup
      },
    });
  } catch (e) {
    console.error("[trackReferral]", e);
  }
}

/**
 * Award referrer +500 messages when referred user subscribes.
 * Call this from finalizePayment.
 */
export async function awardReferralReward(subscribedUserId: string) {
  try {
    const referral = await db.referral.findFirst({
      where: { referredUserId: subscribedUserId, rewardPoints: 0 },
    });
    if (!referral) return;

    // Check monthly limit (Max 5 rewards per month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyCount = await db.referral.count({
      where: {
        referrerId: referral.referrerId,
        rewardPoints: { gt: 0 },
        updatedAt: { gte: startOfMonth },
      },
    });

    if (monthlyCount >= 5) {
      console.log(`[awardReferralReward] Limit reached for referrer ${referral.referrerId}`);
      return;
    }

    // Award 500 messages to referrer
    await db.user.update({
      where: { userId: referral.referrerId },
      data: { includedMessages: { increment: 500 } },
    });

    // Mark reward as given
    await db.referral.update({
      where: { id: referral.id },
      data: { rewardPoints: 500 },
    });
  } catch (e) {
    console.error("[awardReferralReward]", e);
  }
}
