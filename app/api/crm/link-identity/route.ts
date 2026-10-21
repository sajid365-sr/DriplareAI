import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@/lib/core/db";
import { getActiveWorkspace } from "@/lib/core/workspace-server";

const linkIdentitySchema = z.object({
  sessionId: z.string().trim().min(1, "sessionId is required"),
  targetSessionId: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  name: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
});

/**
 * Feature #13: Cross-platform Customer Identity Linking
 *
 * GET /api/crm/link-identity?sessionId=...
 * Retrieves the unified customer profile and other linked sessions across platforms.
 *
 * POST /api/crm/link-identity
 * Links multiple sessions (e.g. Facebook + WhatsApp + Web) to a single CustomerProfile.
 */

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId")?.trim();

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId query param is required" }, { status: 400 });
    }

    // 1. Look for an existing profile that already contains this sessionId
    let profile = await db.customerProfile.findFirst({
      where: {
        workspaceId: workspace.id,
        sessions: { has: sessionId },
      },
    });

    // 2. If no profile found by session, check if the session has a phone number extracted
    if (!profile) {
      const currentSession = await db.chatSession.findFirst({
        where: { sessionId },
        select: { guestName: true, aiExtractionData: true },
      });

      const meta = (currentSession?.aiExtractionData ?? {}) as Record<string, unknown>;
      const phone = (meta.phone || meta.customerPhone || meta.mobile) as string | undefined;

      if (phone && phone.trim()) {
        profile = await db.customerProfile.findFirst({
          where: {
            workspaceId: workspace.id,
            phone: phone.trim(),
          },
        });

        // Auto-link this session into the existing profile
        if (profile) {
          profile = await db.customerProfile.update({
            where: { id: profile.id },
            data: {
              sessions: Array.from(new Set([...profile.sessions, sessionId])),
            },
          });
        }
      }
    }

    if (!profile) {
      return NextResponse.json({
        success: true,
        profile: null,
        linkedSessions: [],
      });
    }

    // 3. Fetch details for other linked sessions
    const otherSessionIds = profile.sessions.filter((s) => s !== sessionId);
    const linkedSessionsData = otherSessionIds.length > 0
      ? await db.chatSession.findMany({
          where: { sessionId: { in: otherSessionIds } },
          select: {
            sessionId: true,
            platform: true,
            guestName: true,
            profilePhoto: true,
            updatedAt: true,
          },
        })
      : [];

    const formattedLinkedSessions = await Promise.all(
      linkedSessionsData.map(async (s) => {
        const lastMsg = await db.chatMessage.findFirst({
          where: { sessionId: s.sessionId },
          orderBy: { timestamp: "desc" },
          select: { content: true, timestamp: true },
        });

        return {
          sessionId: s.sessionId,
          platform: s.platform,
          guestName: s.guestName || "Customer",
          profilePhoto: s.profilePhoto,
          lastActive: s.updatedAt.toISOString(),
          lastMessage: lastMsg?.content || "",
          lastMessageTime: lastMsg?.timestamp.toISOString() || s.updatedAt.toISOString(),
        };
      })
    );

    return NextResponse.json({
      success: true,
      profile: {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        sessions: profile.sessions,
        updatedAt: profile.updatedAt.toISOString(),
      },
      linkedSessions: formattedLinkedSessions,
    });
  } catch (error) {
    console.error("[LINK_IDENTITY_GET_ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspace = await getActiveWorkspace(userId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = linkIdentitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, targetSessionId, phone, name, email } = parsed.data;

    // Sessions to unify
    const sessionIdsToLink = [sessionId, targetSessionId].filter((s): s is string => Boolean(s));

    // Find any existing profile by phone or by included sessionIds
    let existingProfile = await db.customerProfile.findFirst({
      where: {
        workspaceId: workspace.id,
        OR: [
          ...(phone ? [{ phone }] : []),
          { sessions: { hasSome: sessionIdsToLink } },
        ],
      },
    });

    if (existingProfile) {
      // Merge sessions
      const mergedSessions = Array.from(
        new Set([...existingProfile.sessions, ...sessionIdsToLink])
      );

      existingProfile = await db.customerProfile.update({
        where: { id: existingProfile.id },
        data: {
          sessions: mergedSessions,
          phone: phone || existingProfile.phone,
          name: name || existingProfile.name,
          email: email || existingProfile.email,
        },
      });
    } else {
      // Create new CustomerProfile
      existingProfile = await db.customerProfile.create({
        data: {
          workspaceId: workspace.id,
          phone: phone || null,
          name: name || null,
          email: email || null,
          sessions: sessionIdsToLink,
        },
      });
    }

    return NextResponse.json({
      success: true,
      profile: existingProfile,
    });
  } catch (error) {
    console.error("[LINK_IDENTITY_POST_ERROR]", error);
    return NextResponse.json({ error: "Failed to link identity" }, { status: 500 });
  }
}

