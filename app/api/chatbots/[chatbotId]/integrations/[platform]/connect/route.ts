import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { toPublicIntegration } from "@/lib/domain/integration-config";
import { canAddIntegration } from "@/lib/domain/usage-limit";

/**
 * The one connect route every platform without an OAuth flow of its own goes
 * through — the Website widget, Telegram, Slack, a custom API.
 *
 * It is also the only connect route the **platform slug arrives from the URL**,
 * which is why the two gates below are not optional:
 *
 *   1. Ownership — the path carries only a `chatbotId`, so without this any
 *      signed-in user could write an integration config, tokens included, onto
 *      another merchant's chatbot.
 *   2. Entitlement — until ১৫.৩ this route skipped `canAddIntegration`, which
 *      the seven dedicated routes (facebook / instagram / whatsapp / …) all
 *      call. That left a plan gate on every channel **except** the one that
 *      accepts an arbitrary slug, i.e. exactly the door that did not need to be
 *      picked: a free-tier merchant could POST `whatsapp` and be connected.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string; platform: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId, platform } = await params;
    const body = await req.json();
    const { config } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Normalised once, then used for both the gate and the write. Storing the
    // raw URL segment would let `FACEBOOK` pass an already-satisfied check and
    // still create a second row — one that dodges the `chatbotId_platform`
    // unique key and therefore the per-chatbot limit.
    const slug = String(platform ?? "").trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "platform is required" }, { status: 400 });
    }

    // Ownership must run before the limit check: canAddIntegration counts
    // integrations on the URL's chatbotId, which is not scoped to this user.
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }

    const check = await canAddIntegration(userId, slug, chatbotId);
    if (!check.allowed) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }

    const integration = await db.integration.upsert({
      where: {
        chatbotId_platform: {
          chatbotId,
          platform: slug,
        },
      },
      update: {
        connected: true,
        config,
      },
      create: {
        chatbotId,
        platform: slug,
        connected: true,
        config,
      },
    });

    // The upsert wrote `config` from the request body, so an unsanitised
    // response would hand the caller back the very tokens it just submitted.
    return NextResponse.json(toPublicIntegration(integration));
  } catch (error) {
    console.error("[INTEGRATION_CONNECT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
