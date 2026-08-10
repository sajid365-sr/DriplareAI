import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

const createNoteSchema = z.object({
  sessionId: z.string().min(1),
  noteText: z.string().trim().min(1).max(2000),
});

type StaffNote = {
  id: string;
  text: string;
  authorName: string;
  createdAt: string;
};

type SessionMetadata = Prisma.JsonObject & {
  internalNotes?: Prisma.JsonValue;
  staffNotes?: Prisma.JsonValue;
};

function getMetadata(value: Prisma.JsonValue | null): SessionMetadata {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as SessionMetadata)
    : {};
}

function getExistingNotes(metadata: SessionMetadata): StaffNote[] {
  const raw = Array.isArray(metadata.internalNotes)
    ? metadata.internalNotes
    : Array.isArray(metadata.staffNotes)
      ? metadata.staffNotes
      : [];

  return raw.filter((item): item is StaffNote => {
    return Boolean(
      item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        "text" in item &&
        typeof (item as StaffNote).text === "string"
    );
  });
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = createNoteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { sessionId, noteText } = parsed.data;
    const workspace = await getActiveWorkspace(userId);

    const session = await db.chatSession.findFirst({
      where: {
        sessionId,
        chatbot: {
          userId,
          workspaceId: workspace.workspaceId,
        },
      },
      select: {
        id: true,
        aiExtractionData: true,
      },
    });

    if (!session) {
      return NextResponse.json({ error: "CRM session not found" }, { status: 404 });
    }

    const user = await db.user.findUnique({
      where: { userId },
      select: { name: true, email: true },
    });

    const metadata = getMetadata(session.aiExtractionData);
    const note: StaffNote = {
      id: `note_${Date.now()}`,
      text: noteText,
      authorName: user?.name || user?.email || "Staff",
      createdAt: new Date().toISOString(),
    };
    const internalNotes = [...getExistingNotes(metadata), note];
    const nextMetadata = {
      ...metadata,
      internalNotes,
    } as Prisma.InputJsonObject;

    await db.chatSession.update({
      where: { id: session.id },
      data: {
        aiExtractionData: nextMetadata,
      },
    });

    return NextResponse.json({ success: true, note, notes: internalNotes });
  } catch (error) {
    console.error("[CRM_NOTES_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
