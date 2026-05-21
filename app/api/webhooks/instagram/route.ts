import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

import crypto from "crypto";

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    console.warn("[INSTAGRAM_WEBHOOK] META_APP_SECRET or FACEBOOK_APP_SECRET is not configured. Signature verification skipped or failing.");
    return false;
  }
  if (!signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") {
    return false;
  }

  const signature = parts[1];
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");

    if (!verifySignature(rawBody, signatureHeader)) {
      console.warn("[INSTAGRAM_WEBHOOK] Signature verification failed or missing signature header.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const n8nWebhookUrl = process.env.N8N_INSTAGRAM_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.warn("[INSTAGRAM_WEBHOOK] N8N_INSTAGRAM_WEBHOOK_URL is not configured.");
      return NextResponse.json({ received: true, forwarded: false });
    }

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[INSTAGRAM_WEBHOOK_FORWARD]", response.status, await response.text());
      return NextResponse.json({ received: true, forwarded: false }, { status: 202 });
    }

    return NextResponse.json({ received: true, forwarded: true });
  } catch (error) {
    console.error("[INSTAGRAM_WEBHOOK]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
