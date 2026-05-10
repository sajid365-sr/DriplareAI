import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAndSyncUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const notifications = await db.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("[NOTIFICATIONS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, all } = await req.json();

    if (all) {
      await db.notification.updateMany({
        where: { userId: user.userId, read: false },
        data: { read: true },
      });
    } else if (id) {
      await db.notification.update({
        where: { id, userId: user.userId },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTIFICATIONS_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
