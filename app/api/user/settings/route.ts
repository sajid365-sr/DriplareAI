import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { getAndSyncUser } from "@/lib/core/auth";

export async function GET() {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await db.user.findUnique({
      where: { userId: user.userId },
      select: {
        dataRetention: true,
        lastDataExportAt: true,
        supportCostPerHour: true,
      }
    });

    return NextResponse.json(userData);
  } catch (error) {
    console.error("[USER_SETTINGS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { dataRetention, supportCostPerHour } = body;

    if (!dataRetention) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updatedUser = await db.user.update({
      where: { userId: user.userId },
      data: {
        ...(dataRetention && { dataRetention: String(dataRetention) }),
        ...(supportCostPerHour !== undefined && { supportCostPerHour: parseFloat(supportCostPerHour) }),
      },
    });

    return NextResponse.json({
      success: true,
      dataRetention: updatedUser.dataRetention,
    });
  } catch (error) {
    console.error("[USER_SETTINGS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
