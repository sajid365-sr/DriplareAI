import { NextResponse } from "next/server";
import { z } from "zod";
import { getAndSyncUser } from "@/lib/core/auth";
import { createFeedbackUploadSignature } from "@/lib/core/cloudinary";
import { feedbackAttachmentKindSchema } from "@/lib/domain/feedback-schema";

/**
 * POST /api/feedback/upload-signature
 * ─────────────────────────────────────────────────────────────────────────────
 * Hands the browser a short-lived Cloudinary signature so it can upload an
 * attachment straight to Cloudinary.
 *
 * The file itself never reaches this route — see `createFeedbackUploadSignature`
 * for why (Vercel's 4.5 MB request-body limit would reject a screen recording
 * long before our code ran).
 */

const bodySchema = z.object({ kind: feedbackAttachmentKindSchema });

export async function POST(req: Request) {
  try {
    const user = await getAndSyncUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Unsupported attachment kind" }, { status: 400 });
    }

    const signature = createFeedbackUploadSignature({
      userId: user.userId,
      kind: parsed.data.kind,
    });

    return NextResponse.json(signature);
  } catch (error) {
    console.error("[FEEDBACK_UPLOAD_SIGNATURE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
