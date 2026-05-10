import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 1: Delete all user data from DB.
    // All related records (Chatbot, ChatMessage, Source, Chunk, Integration,
    // ChatSession, AIUsageLog, PaymentTransaction, Referral) will be cascade deleted.
    await db.user.delete({
      where: { userId },
    });

    // Step 2: Delete the user from Clerk
    const client = await clerkClient();
    await client.users.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE_ACCOUNT]", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
