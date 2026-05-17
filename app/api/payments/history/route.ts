import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transactions = await db.paymentTransaction.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("[PAYMENTS_HISTORY_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
export async function DELETE(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    // Verify ownership before delete
    const tx = await db.paymentTransaction.findUnique({
      where: { id, userId: user.userId }
    });

    if (!tx) return NextResponse.json({ error: "Transaction not found or unauthorized" }, { status: 404 });

    await db.paymentTransaction.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PAYMENTS_HISTORY_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
