import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { z } from "zod";

// ─── Helper: parse pagination params ──────────────────────────────────────────
function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ─── GET /api/admin/billing ────────────────────────────────────────────────────
// Query params:
//   ?type=overview          → aggregate stat cards
//   ?type=payments          → paginated PaymentTransaction list
//   ?type=credits           → paginated CreditTransaction list (+ optional &actionType=)
//   ?type=ai_usage          → paginated AIUsageLog list
export async function GET(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "overview";

    // ── Overview metrics ────────────────────────────────────────────────────
    if (type === "overview") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [
        totalRevenueAgg,
        mrrAgg,
        totalCreditsAgg,
        activePaidSubs,
        recentPayments,
      ] = await Promise.all([
        // Total revenue (all completed payments)
        db.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: { paymentStatus: "completed" },
        }),
        // MRR: last 30 days completed payments
        db.paymentTransaction.aggregate({
          _sum: { amount: true },
          where: {
            paymentStatus: "completed",
            createdAt: { gte: thirtyDaysAgo },
          },
        }),
        // Total credits issued (sum of all admin_topup + plan credits in CreditTransaction is NOT credits issued;
        // instead sum absolute credits_spent across all transactions for "credits distributed" metric)
        db.creditTransaction.aggregate({
          _sum: { credits_spent: true },
        }),
        // Active paid subscriptions (users NOT on starter plan)
        db.user.count({
          where: { plan: { not: "starter" } },
        }),
        // Recent 5 payments for quick preview
        db.paymentTransaction.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          where: { paymentStatus: "completed" },
          select: {
            id: true,
            amount: true,
            currency: true,
            gateway: true,
            paymentStatus: true,
            createdAt: true,
            user: { select: { name: true, email: true } },
          },
        }),
      ]);

      return NextResponse.json({
        totalRevenue: totalRevenueAgg._sum.amount ?? 0,
        mrr: mrrAgg._sum.amount ?? 0,
        totalCreditsDistributed: totalCreditsAgg._sum.credits_spent ?? 0,
        activePaidSubscriptions: activePaidSubs,
        recentPayments,
      });
    }

    // ── Payment transactions (paginated) ────────────────────────────────────
    if (type === "payments") {
      const { page, limit, skip } = parsePagination(url);
      const status = url.searchParams.get("status") ?? "";

      const where = status ? { paymentStatus: status } : {};

      const [transactions, total] = await Promise.all([
        db.paymentTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            sessionId: true,
            amount: true,
            currency: true,
            gateway: true,
            paymentStatus: true,
            status: true,
            packageId: true,
            createdAt: true,
            completedAt: true,
            user: {
              select: { name: true, email: true, picture: true, userId: true },
            },
          },
        }),
        db.paymentTransaction.count({ where }),
      ]);

      return NextResponse.json({
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // ── Credit transactions (paginated, filterable by action type) ──────────
    if (type === "credits") {
      const { page, limit, skip } = parsePagination(url);
      const actionType = url.searchParams.get("actionType") ?? "";

      const where = actionType ? { action_type: actionType } : {};

      const [credits, total] = await Promise.all([
        db.creditTransaction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            action_type: true,
            model_tier: true,
            credits_spent: true,
            chatbotId: true,
            metadata: true,
            createdAt: true,
            user: {
              select: { name: true, email: true, picture: true, userId: true },
            },
          },
        }),
        db.creditTransaction.count({ where }),
      ]);

      return NextResponse.json({
        credits,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // ── AI Usage logs (paginated) ───────────────────────────────────────────
    if (type === "ai_usage") {
      const { page, limit, skip } = parsePagination(url);

      const [logs, total] = await Promise.all([
        db.aIUsageLog.findMany({
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true,
            chatbotId: true,
            sessionId: true,
            channel: true,
            model: true,
            modelId: true,
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
            costBdt: true,
            creditsDeducted: true,
            isFreeMessage: true,
            createdAt: true,
            user: {
              select: { name: true, email: true, picture: true, userId: true },
            },
          },
        }),
        db.aIUsageLog.count(),
      ]);

      return NextResponse.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  } catch (error) {
    console.error("[ADMIN_BILLING_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

// ─── POST /api/admin/billing ───────────────────────────────────────────────────
// Manual credit top-up for a specific user
const TopUpSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  amount: z.number().int().positive("amount must be a positive integer"),
  reason: z.string().min(10, "reason must be at least 10 characters"),
});

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const parsed = TopUpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, amount, reason } = parsed.data;

    // Verify user exists
    const user = await db.user.findUnique({
      where: { userId },
      select: { userId: true, name: true, email: true, creditsBalance: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Atomically: increment user balance + log CreditTransaction
    const [updatedUser] = await db.$transaction([
      db.user.update({
        where: { userId },
        data: {
          creditsBalance:   { increment: amount },
          includedCredits:  { increment: amount },
        },
        select: { creditsBalance: true },
      }),
      db.creditTransaction.create({
        data: {
          userId,
          action_type:   "admin_topup",
          credits_spent: -amount, // negative = credits added
          metadata: {
            reason,
            adminId:  authResult.userId,
            adminEmail: authResult.user.email,
            topupAmount: amount,
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      newBalance: updatedUser.creditsBalance,
      user: { name: user.name, email: user.email },
      amountAdded: amount,
    });
  } catch (error) {
    console.error("[ADMIN_BILLING_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
