import { NextResponse } from "next/server";
import { db } from "@/lib/core/db";
import { requireAdminApi } from "@/lib/core/admin-auth";

/**
 * Admin system health.
 *
 * Reporting rule for this endpoint: **only measured facts leave here.**
 *
 * An earlier version filled the gaps with plausible-looking numbers — a fixed
 * "99.98%" uptime, hardcoded "1 min ago" activity stamps, per-channel latencies
 * derived from the database latency, and a set of invented log lines shown when
 * the notifications table was empty. Worse, a failed n8n fetch was reported as
 * "online", which hid the exact failure this endpoint exists to surface. An
 * admin panel that lies is worse than no panel, because it is trusted.
 *
 * Anything we cannot actually measure is either omitted or reported as unknown.
 */

// ── Channel definitions ───────────────────────────────────────────────────────
// `platforms` maps the values stored on ChatSession.platform onto a channel, so
// the activity reported below is real rather than asserted. Facebook writes both
// `facebook` and `messenger` depending on the flow that created the session, so
// both are folded into one channel.
const CHANNELS = [
  {
    id: "fb_messenger",
    channel: "Facebook Messenger Hook",
    provider: "Meta Graph API",
    endpoint: "/api/webhooks/n8n-facebook",
    platforms: ["facebook", "messenger"],
  },
  {
    id: "whatsapp_cloud",
    channel: "WhatsApp Cloud API Hook",
    provider: "Meta WhatsApp Business",
    endpoint: "/api/webhooks/whatsapp",
    platforms: ["whatsapp"],
  },
  {
    id: "instagram_dm",
    channel: "Instagram DM Hook",
    provider: "Meta Instagram",
    endpoint: "/api/webhooks/instagram",
    platforms: ["instagram"],
  },
  {
    id: "web_widget",
    channel: "Web Chat Widget Hook",
    provider: "Driplare AI Edge",
    endpoint: "/api/chatbots/[chatbotId]/chat",
    platforms: ["web"],
  },
] as const;

// A quiet channel is not a broken channel. These thresholds only decide which
// word we use for "when did this channel last actually do something".
const ACTIVE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const IDLE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

type ChannelStatus = "active" | "idle" | "inactive";

function statusFromLastActivity(lastActivityAt: Date | null): ChannelStatus {
  if (!lastActivityAt) return "inactive";

  const age = Date.now() - lastActivityAt.getTime();
  if (age <= ACTIVE_WINDOW_MS) return "active";
  if (age <= IDLE_WINDOW_MS) return "idle";
  return "inactive";
}

/** Resolve the n8n instance origin to probe. Never throws. */
function resolveN8nOrigin(): string | null {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim();
  const host = process.env.N8N_HOST?.trim();

  const candidate = host || webhookUrl;
  if (!candidate) return null;

  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

/**
 * Report the webhook path shape. A `/webhook-test/` path only accepts requests
 * while an n8n editor session is listening, so in production the channel would
 * fail silently — worth surfacing here, where an operator will see it.
 */
function describeWebhookPath(): { webhookUrl: string | null; isTestPath: boolean } {
  const webhookUrl = process.env.N8N_WEBHOOK_URL?.trim() || null;
  return {
    webhookUrl,
    isTestPath: webhookUrl ? webhookUrl.includes("/webhook-test/") : false,
  };
}

function describeDatabaseProvider(): string {
  // Hardcoding this made the panel wrong the moment the database moved.
  return (process.env.DATABASE_URL || "").includes("neon.tech")
    ? "Neon PostgreSQL"
    : "PostgreSQL";
}

export async function GET() {
  try {
    const authResult = await requireAdminApi();
    if (authResult instanceof NextResponse) return authResult;

    // ── 1. Measure database latency ──
    const dbStart = performance.now();
    let dbStatus: "online" | "offline" = "online";
    let dbLatencyMs = 0;

    try {
      await db.$queryRaw`SELECT 1`;
      dbLatencyMs = Math.round(performance.now() - dbStart);
    } catch (err) {
      console.error("[HEALTH_CHECK_DB_ERROR]", err);
      dbStatus = "offline";
      dbLatencyMs = -1;
    }

    // ── 2. Measure n8n reachability ──
    const n8nOrigin = resolveN8nOrigin();
    let n8nStatus: "online" | "degraded" | "offline" | "unknown" = "unknown";
    let n8nLatencyMs = -1;

    if (n8nOrigin) {
      const n8nStart = performance.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(n8nOrigin, {
          method: "GET",
          signal: controller.signal,
          headers: { "User-Agent": "DriplareAI-HealthCheck/1.0" },
          cache: "no-store",
        });
        clearTimeout(timeoutId);

        n8nLatencyMs = Math.round(performance.now() - n8nStart);
        // Any HTTP answer proves the instance is up. A 5xx means it answered but
        // is unhealthy. A network failure means we genuinely could not reach it —
        // and that must be reported as offline, not smoothed over.
        n8nStatus = res.status >= 500 ? "degraded" : "online";
      } catch (err) {
        console.error("[HEALTH_CHECK_N8N_ERROR]", err);
        n8nLatencyMs = -1;
        n8nStatus = "offline";
      }
    }

    // ── 3. Channel activity, measured from real sessions ──
    // Only the last activity timestamp is knowable per channel — webhook latency
    // is not, because these channels are push-based and we never see the inbound
    // request leg. So we report activity and say nothing about latency.
    const lastActivityByPlatform = new Map<string, Date>();

    try {
      const grouped = await db.chatSession.groupBy({
        by: ["platform"],
        _max: { updatedAt: true },
      });

      for (const row of grouped) {
        if (row._max.updatedAt) {
          lastActivityByPlatform.set(row.platform, row._max.updatedAt);
        }
      }
    } catch (err) {
      // A failed activity query must not take the whole panel down; the channels
      // simply report as inactive rather than pretending to be healthy.
      console.error("[HEALTH_CHECK_CHANNEL_ACTIVITY_ERROR]", err);
    }

    const channels = CHANNELS.map((channel) => {
      const timestamps = channel.platforms
        .map((platform) => lastActivityByPlatform.get(platform))
        .filter((value): value is Date => Boolean(value));

      const lastActivityAt =
        timestamps.length > 0
          ? new Date(Math.max(...timestamps.map((value) => value.getTime())))
          : null;

      return {
        id: channel.id,
        channel: channel.channel,
        provider: channel.provider,
        endpoint: channel.endpoint,
        status: statusFromLastActivity(lastActivityAt),
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
      };
    });

    const active24h = channels.filter((channel) => channel.status !== "inactive").length;

    // ── 4. System events ──
    // Real notifications only. There used to be a fallback that fabricated three
    // log lines when this table was empty — including "All message routing
    // workflows active and synchronized", which was never checked. An empty list
    // is the honest answer.
    let errorLogs: Array<{
      id: string;
      level: "ERROR" | "WARN" | "INFO";
      service: string;
      message: string;
      affectedTarget: string;
      timestamp: string;
    }> = [];

    try {
      const notifications = await db.notification.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      });

      errorLogs = notifications.map((n) => ({
        id: n.id,
        level: n.type === "payment" ? "WARN" : "INFO",
        service: "Notification Engine",
        message: `${n.title}: ${n.message}`,
        affectedTarget: `User: ${n.userId.slice(0, 10)}…`,
        timestamp: n.createdAt.toISOString(),
      }));
    } catch (err) {
      console.error("[HEALTH_CHECK_LOG_QUERY_ERROR]", err);
    }

    const { webhookUrl, isTestPath } = describeWebhookPath();

    return NextResponse.json({
      n8n: {
        status: n8nStatus,
        latencyMs: n8nLatencyMs,
        url: n8nOrigin,
        webhookUrl,
        // Surfaced so an operator can see at a glance that this deployment would
        // go dark in production — see docs/Architecture-Update/05.
        isTestWebhookPath: isTestPath,
      },
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        provider: describeDatabaseProvider(),
      },
      channels: {
        active24h,
        total: channels.length,
      },
      webhooks: channels,
      errorLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ADMIN_SYSTEM_HEALTH_ERROR]", error);
    return NextResponse.json(
      {
        error: "Internal Error",
        n8n: {
          status: "offline",
          latencyMs: -1,
          url: null,
          webhookUrl: null,
          isTestWebhookPath: false,
        },
        database: { status: "offline", latencyMs: -1, provider: "Unknown" },
        channels: { active24h: 0, total: CHANNELS.length },
        webhooks: [],
        errorLogs: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
