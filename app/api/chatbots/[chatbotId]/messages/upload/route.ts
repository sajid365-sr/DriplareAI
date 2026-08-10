import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { uploadInboxMedia } from "@/lib/core/cloudinary";

/**
 * POST /api/chatbots/[chatbotId]/messages/upload
 *
 * Accepts a multipart/form-data request with a file field named "file".
 * Validates the file type (image or audio), uploads to Cloudinary,
 * and returns the public URL + resolved mediaType.
 *
 * Allowed image types : image/jpeg, image/png, image/webp
 * Allowed audio types : audio/mpeg (mp3), audio/wav, audio/mp4 (m4a), audio/x-m4a, audio/ogg
 * Max file size       : 10 MB
 *
 * Response: { url: string, mediaType: 'image' | 'audio' }
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

    // Resolve workspaceId for multi-tenant folder isolation
    const workspaceId = bot.workspaceId ?? bot.chatbotId;

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size (max 10 MB)
    const MAX_SIZE_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Resolve mediaType from MIME type
    const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
    const ALLOWED_AUDIO_TYPES = [
      "audio/mpeg",
      "audio/wav",
      "audio/mp4",
      "audio/x-m4a",
      "audio/m4a",
      "audio/ogg",
      "audio/webm",
    ];

    let resolvedMediaType: "image" | "audio" | null = null;

    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      resolvedMediaType = "image";
    } else if (ALLOWED_AUDIO_TYPES.includes(file.type)) {
      resolvedMediaType = "audio";
    }

    if (!resolvedMediaType) {
      return NextResponse.json(
        {
          error: `Invalid file type "${file.type}". Allowed: JPEG, PNG, WEBP (images) or MP3, WAV, M4A (audio).`,
        },
        { status: 400 }
      );
    }

    // Convert Blob to Buffer for Cloudinary upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary inbox folder
    const result = await uploadInboxMedia(buffer, workspaceId, resolvedMediaType);

    return NextResponse.json({
      url: result.url,
      mediaType: resolvedMediaType,
    });
  } catch (error: any) {
    console.error("[INBOX_MEDIA_UPLOAD]", error);
    return NextResponse.json(
      { error: error?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
