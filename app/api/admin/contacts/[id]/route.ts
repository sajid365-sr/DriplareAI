import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";
import { updateContactStatusSchema } from "@/lib/domain/contact-schema";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateContactStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updated = await db.contactSubmission.update({
      where: { id },
      data: { status: parsed.data.status },
    });

    return NextResponse.json({ success: true, submission: updated });
  } catch (error) {
    console.error("[ADMIN_CONTACT_PATCH]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;

    await db.contactSubmission.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN_CONTACT_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
