import { NextResponse } from "next/server";
import { getAndSyncUser } from "@/lib/core/auth";
import {
  scheduleDowngrade,
  cancelScheduledDowngrade,
  getDowngradePreview,
  applyDowngrade,
} from "@/lib/domain/plan-downgrade";
import type { PlanKey } from "@/lib/domain/plan-config";

// Valid plans that a user can downgrade to
const VALID_DOWNGRADE_TARGETS: PlanKey[] = ["starter", "growth", "business"];

// Plan hierarchy for validation (higher index = higher tier)
const PLAN_HIERARCHY: PlanKey[] = ["starter", "growth", "business", "enterprise"];

function isPlanDowngrade(currentPlan: string, targetPlan: string): boolean {
  const currentIdx = PLAN_HIERARCHY.indexOf(currentPlan as PlanKey);
  const targetIdx = PLAN_HIERARCHY.indexOf(targetPlan as PlanKey);
  return targetIdx < currentIdx;
}

// ── GET: Downgrade preview দেখাও ──────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetPlan = searchParams.get("plan") as PlanKey | null;

    if (!targetPlan || !VALID_DOWNGRADE_TARGETS.includes(targetPlan)) {
      return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
    }

    if (!isPlanDowngrade(user.plan, targetPlan)) {
      return NextResponse.json(
        { error: "Target plan must be lower than current plan" },
        { status: 400 }
      );
    }

    const preview = await getDowngradePreview(user.userId, targetPlan);
    if (!preview) {
      return NextResponse.json({ error: "Could not get preview" }, { status: 500 });
    }

    // Also include current scheduled downgrade info
    return NextResponse.json({
      preview,
      scheduledDowngrade: user.scheduledDowngradePlan
        ? {
            plan: user.scheduledDowngradePlan,
            scheduledAt: (user as any).scheduledDowngradeAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[PAYMENT_MANAGE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ── POST: Downgrade schedule বা cancel করো ────────────────────────────────
export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, plan, cancelReason } = body;

    // ── Action: Downgrade schedule করো ──
    if (action === "schedule_downgrade") {
      if (!plan || !VALID_DOWNGRADE_TARGETS.includes(plan)) {
        return NextResponse.json({ error: "Invalid target plan" }, { status: 400 });
      }

      if (!isPlanDowngrade(user.plan, plan)) {
        return NextResponse.json(
          { error: "Target plan must be lower than current plan" },
          { status: 400 }
        );
      }

      // Starter plan is free — no subscription to cancel, apply immediately? 
      // No, still schedule for consistency. But if already on starter, reject.
      if (user.plan === "starter") {
        return NextResponse.json(
          { error: "You are already on the Starter plan" },
          { status: 400 }
        );
      }

      const result = await scheduleDowngrade(user.userId, plan as PlanKey, cancelReason);

      return NextResponse.json({
        success: true,
        message: `Your plan will be changed to ${plan.toUpperCase()} on ${result.scheduledAt.toLocaleDateString()}`,
        scheduledAt: result.scheduledAt,
      });
    }

    // ── Action: Scheduled downgrade বাতিল করো ──
    if (action === "cancel_downgrade") {
      if (!user.scheduledDowngradePlan) {
        return NextResponse.json(
          { error: "No scheduled downgrade found" },
          { status: 400 }
        );
      }

      await cancelScheduledDowngrade(user.userId);

      return NextResponse.json({
        success: true,
        message: "Your scheduled plan change has been cancelled.",
      });
    }

    // ── Action: Scheduled downgrade এখনই কার্যকর করো ──
    if (action === "apply_now") {
      if (!user.scheduledDowngradePlan) {
        return NextResponse.json(
          { error: "No scheduled downgrade found" },
          { status: 400 }
        );
      }

      const targetPlan = user.scheduledDowngradePlan as PlanKey;
      await applyDowngrade(user.userId, targetPlan);

      return NextResponse.json({
        success: true,
        message: "Your plan change has been applied immediately.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[PAYMENT_MANAGE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
