import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 1: Clean up CRM data scoped to this user's workspaces.
    // CRM Contact records are workspace-scoped (NOT user-scoped), so they
    // do NOT cascade from a User delete — we must handle them explicitly.
    // CrmActivity, CrmTask, Deal, DealStageHistory, ContactIdentity,
    // ContactTagAssignment all cascade from Contact (onDelete: Cascade),
    // so deleting Contacts is enough.
    const workspaces = await db.workspace.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const workspaceIds = workspaces.map((w) => w.workspaceId);

    if (workspaceIds.length > 0) {
      await db.contact.deleteMany({
        where: { workspaceId: { in: workspaceIds } },
      });
    }

    // Step 2: Delete all user data from DB.
    // All related records (Chatbot, ChatMessage, Source, Chunk, Integration,
    // ChatSession, AIUsageLog, PaymentTransaction, Referral, CustomerProfile)
    // will be cascade deleted via the User → Workspace → Chatbot chain.
    await db.user.delete({
      where: { userId },
    });

    // Step 3: Delete the user from Clerk
    const client = await clerkClient();
    await client.users.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE_ACCOUNT]", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
