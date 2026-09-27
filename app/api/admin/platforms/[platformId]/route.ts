import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { platformUpdateSchema } from "@/lib/domain/admin-schemas";

type RouteContext = { params: Promise<{ platformId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { platformId } = await context.params;
    const body = await req.json();
    const parsed = platformUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const platform = await db.availablePlatform.update({
      where: { platformId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, platform });
  } catch (error) {
    console.error("[ADMIN_PLATFORM_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { platformId } = await context.params;

    await db.availablePlatform.delete({ where: { platformId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_PLATFORM_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
