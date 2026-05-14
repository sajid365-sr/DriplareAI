import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integrations = await db.integration.findMany({
      where: { chatbotId },
    });

    // Fetch available platforms from DB
    const availablePlatforms = await db.availablePlatform.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    const result = availablePlatforms.map(p => {
      const dbInt = integrations.find(i => i.platform === p.platformId);
      return {
        platform: p.platformId,
        name: p.name,
        description: p.description,
        color: p.color,
        coming_soon: p.isComingSoon,
        connected: dbInt?.connected || false,
        status: dbInt?.status || "active",
        lastError: dbInt?.lastError || null,
        config: dbInt?.config || {},
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[INTEGRATIONS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
