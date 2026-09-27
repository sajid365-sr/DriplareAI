import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { uploadProductImage } from "@/lib/core/cloudinary";

/**
 * POST /api/chatbots/[chatbotId]/products/upload-image
 *
 * Accepts a multipart/form-data request with a file field named "file".
 * Authenticates the user, resolves the workspace for folder isolation,
 * and uploads the image to Cloudinary.
 *
 * Response: { url: string, publicId: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    // Resolve workspaceId for the folder hierarchy.
    // Falls back to chatbotId if workspace is not yet set (legacy support).
    const workspaceId = bot.workspaceId ?? bot.chatbotId;

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPG, PNG, WEBP, GIF" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // Convert Blob to Buffer for Cloudinary upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const result = await uploadProductImage(buffer, workspaceId);

    return NextResponse.json({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error("[PRODUCT_IMAGE_UPLOAD]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
