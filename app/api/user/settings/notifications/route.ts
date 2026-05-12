import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAndSyncUser } from "@/lib/auth";

const DEFAULT_SETTINGS = {
  usage_alerts_email: true,
  usage_alerts_app: true,
  billing_email: true,
  billing_app: true,
  security_email: true,
  security_app: true,
  product_email: true,
  product_app: true,
};

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await db.user.findUnique({
      where: { userId: user.userId },
      select: { notificationSettings: true },
    });

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const settings = {
      ...DEFAULT_SETTINGS,
      ...(userData.notificationSettings as any),
    };

    return NextResponse.json(settings);
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

    const body = await req.json();
    
    // Get current settings to merge
    const userData = await db.user.findUnique({
      where: { userId: user.userId },
      select: { notificationSettings: true },
    });

    const currentSettings = (userData?.notificationSettings as any) || DEFAULT_SETTINGS;
    const newSettings = { ...currentSettings, ...body };

    await db.user.update({
      where: { userId: user.userId },
      data: {
        notificationSettings: newSettings,
      },
    });

    return NextResponse.json(newSettings);
  } catch (error) {
    console.error("[NOTIFICATIONS_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
