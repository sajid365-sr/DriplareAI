import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { platformCreateSchema } from "@/lib/domain/admin-schemas";

export async function GET() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const platforms = await db.availablePlatform.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json({
      platforms,
      stats: {
        total: platforms.length,
        active: platforms.filter((p) => p.isActive).length,
        comingSoon: platforms.filter((p) => p.isComingSoon).length,
      },
    });
  } catch (error) {
    console.error("[ADMIN_PLATFORMS_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const parsed = platformCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.availablePlatform.findUnique({
      where: { platformId: parsed.data.platformId },
    });

    if (existing) {
      return NextResponse.json({ error: "Platform ID already exists" }, { status: 409 });
    }

    const platform = await db.availablePlatform.create({ data: parsed.data });

    return NextResponse.json({ success: true, platform }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN_PLATFORMS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
