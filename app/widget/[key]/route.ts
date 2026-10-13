import { NextResponse } from "next/server";

import { db } from "@/lib/core/db";
import { parseWidgetKey, resolveRequestOrigin } from "@/lib/domain/widget-key";
import {
  renderDisabledWidgetScript,
  renderWidgetScript,
} from "@/lib/widget/render-script";

/**
 * `GET /widget/<key>.js` — the embeddable chat bubble.
 *
 * This is the one route in the product that any stranger's browser may fetch,
 * and it is fetched from a **third-party page** — the merchant's own website.
 * Two consequences shape everything below: the response must never break the
 * page it lands on, and it must never reveal anything the visitor is not
 * already entitled to see.
 *
 * Authenticated by the widget key alone. There is no Clerk session here by
 * definition — the caller is a shopper on a storefront, not a Driplare user.
 * What that key can do is bounded elsewhere: it resolves one chatbot's display
 * configuration and nothing else, and every route that could *change* anything
 * stays behind Clerk and an ownership check.
 *
 * The key is the integration's `integrationId`; `lib/domain/widget-key.ts`
 * carries the reasoning, including why this is not a rotatable secret.
 */

// The served script depends on the request's host (to build its own API base)
// and on rows that an admin can change at any moment, so there is nothing here
// for the build to pre-render.
export const dynamic = "force-dynamic";

/**
 * `reason` is written into a comment in the served file and into the server log
 * — it names why a widget a merchant installed is producing nothing.
 *
 * Never thrown at the visitor: a shopper has no idea a widget was meant to be
 * there, so a visible error would cost the merchant a customer without telling
 * anyone who could fix it.
 */
function disabledResponse(reason: string) {
  return new NextResponse(renderDisabledWidgetScript(reason), {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Short: a merchant who has just reconnected the channel should not wait
      // for a stale copy, and the response is tiny.
      "Cache-Control": "public, max-age=60, s-maxage=60",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * Reads a merchant-authored line out of the stored config.
 *
 * `config` is written by the merchant's own dashboard, so this is not an
 * untrusted-input defence — `renderWidgetScript()` JSON-escapes everything it
 * embeds. It is a shape guard: a value that is not a string, or is empty, must
 * fall back to the translated default rather than render a blank header, and a
 * cap keeps a paste-accident from bloating every page load on the merchant's
 * site.
 */
function readOptionalText(
  config: Record<string, unknown>,
  key: string,
  maxLength = 160
): string | null {
  const value = config[key];
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key: rawKey } = await params;
  const widgetKey = parseWidgetKey(rawKey);

  if (!widgetKey) {
    // Not a lookup failure worth logging loudly — scanners and typos both land
    // here, and neither is something the merchant can act on.
    return disabledResponse("malformed widget key");
  }

  try {
    const integration = await db.integration.findUnique({
      where: { integrationId: widgetKey },
      select: {
        platform: true,
        connected: true,
        config: true,
        chatbot: {
          select: {
            chatbotId: true,
            name: true,
            avatarColor: true,
            status: true,
          },
        },
      },
    });

    if (!integration) {
      console.warn("[WIDGET_SCRIPT] unknown key", { widgetKey });
      return disabledResponse("unknown widget key");
    }

    // Channel-scoped on purpose: without this, any integration's id — a
    // Facebook page connection, say — would serve a website widget, and the
    // widget's own lifecycle (connect, disconnect, configure) would stop
    // matching the channel the merchant thinks they are managing.
    if (integration.platform !== "website") {
      console.warn("[WIDGET_SCRIPT] key is not a website integration", {
        widgetKey,
        platform: integration.platform,
      });
      return disabledResponse("not a website integration");
    }

    // The merchant's off switch. Disconnecting the Website channel in the
    // dashboard must silence every embed of it at once — that is the whole
    // revoke story, since the widget key itself cannot be rotated.
    if (!integration.connected) {
      return disabledResponse("integration disconnected");
    }

    const bot = integration.chatbot;

    if (!bot || bot.status !== "active") {
      console.warn("[WIDGET_SCRIPT] agent missing or paused", {
        widgetKey,
        status: bot?.status ?? null,
      });
      return disabledResponse("agent not active");
    }

    const origin = resolveRequestOrigin(req.headers) ?? new URL(req.url).origin;
    const config = (integration.config ?? {}) as Record<string, unknown>;

    return new NextResponse(
      renderWidgetScript({
        widgetKey,
        origin,
        agentName: bot.name || "AI Assistant",
        brandColor: bot.avatarColor,
        subtitle: readOptionalText(config, "widgetSubtitle"),
        welcome: readOptionalText(config, "welcomeMessage", 400),
        position: config.widgetPosition === "left" ? "left" : "right",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=60",
          // A widget script is plumbing, not content: it should never be an
          // entry point in a search result for the merchant's domain.
          "X-Robots-Tag": "noindex",
        },
      }
    );
  } catch (error) {
    console.error("[WIDGET_SCRIPT]", error);
    // A database hiccup serves no widget rather than a broken one. The
    // merchant's page keeps working, which is the only outcome that matters
    // from the visitor's side.
    return disabledResponse("internal error");
  }
}
