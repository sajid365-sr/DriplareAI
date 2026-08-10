import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

// GET /api/settings/couriers
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    const config = await db.courierConfig.findUnique({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      config: config || {
        steadfastEnabled: false,
        steadfastApiKey: "",
        steadfastSecretKey: "",
        pathaoEnabled: false,
        pathaoClientId: "",
        pathaoClientSecret: "",
        pathaoUsername: "",
        pathaoPassword: "",
        pathaoStoreId: "",
        redxEnabled: false,
        redxApiToken: "",
      },
    });
  } catch (error: any) {
    console.error("[COURIER_SETTINGS_GET]", error);
    return NextResponse.json(
      { error: "Failed to load courier settings" },
      { status: 500 }
    );
  }
}

// POST /api/settings/couriers
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    const body = await req.json();

    const {
      steadfastEnabled = false,
      steadfastApiKey = "",
      steadfastSecretKey = "",
      pathaoEnabled = false,
      pathaoClientId = "",
      pathaoClientSecret = "",
      pathaoUsername = "",
      pathaoPassword = "",
      pathaoStoreId = "",
      redxEnabled = false,
      redxApiToken = "",
    } = body;

    const updatedConfig = await db.courierConfig.upsert({
      where: { userId },
      create: {
        userId,
        workspaceId: workspace.workspaceId,
        steadfastEnabled: Boolean(steadfastEnabled),
        steadfastApiKey: steadfastApiKey ? String(steadfastApiKey).trim() : null,
        steadfastSecretKey: steadfastSecretKey ? String(steadfastSecretKey).trim() : null,
        pathaoEnabled: Boolean(pathaoEnabled),
        pathaoClientId: pathaoClientId ? String(pathaoClientId).trim() : null,
        pathaoClientSecret: pathaoClientSecret ? String(pathaoClientSecret).trim() : null,
        pathaoUsername: pathaoUsername ? String(pathaoUsername).trim() : null,
        pathaoPassword: pathaoPassword ? String(pathaoPassword).trim() : null,
        pathaoStoreId: pathaoStoreId ? String(pathaoStoreId).trim() : null,
        redxEnabled: Boolean(redxEnabled),
        redxApiToken: redxApiToken ? String(redxApiToken).trim() : null,
      },
      update: {
        workspaceId: workspace.workspaceId,
        steadfastEnabled: Boolean(steadfastEnabled),
        steadfastApiKey: steadfastApiKey ? String(steadfastApiKey).trim() : null,
        steadfastSecretKey: steadfastSecretKey ? String(steadfastSecretKey).trim() : null,
        pathaoEnabled: Boolean(pathaoEnabled),
        pathaoClientId: pathaoClientId ? String(pathaoClientId).trim() : null,
        pathaoClientSecret: pathaoClientSecret ? String(pathaoClientSecret).trim() : null,
        pathaoUsername: pathaoUsername ? String(pathaoUsername).trim() : null,
        pathaoPassword: pathaoPassword ? String(pathaoPassword).trim() : null,
        pathaoStoreId: pathaoStoreId ? String(pathaoStoreId).trim() : null,
        redxEnabled: Boolean(redxEnabled),
        redxApiToken: redxApiToken ? String(redxApiToken).trim() : null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Courier API credentials saved successfully!",
      config: updatedConfig,
    });
  } catch (error: any) {
    console.error("[COURIER_SETTINGS_POST]", error);
    return NextResponse.json(
      { error: error.message || "Failed to save courier settings" },
      { status: 500 }
    );
  }
}
