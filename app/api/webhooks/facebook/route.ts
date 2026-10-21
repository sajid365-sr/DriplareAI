import { NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/core/meta-signature";
import { bufferOrDispatchMessage } from "@/lib/ai/message-batcher";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken =
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");

    if (!verifyMetaSignature(rawBody, signatureHeader)) {
      console.warn("[FACEBOOK_WEBHOOK] Signature verification failed or missing signature header.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const n8nWebhookUrl =
      process.env.N8N_FACEBOOK_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.error("[FACEBOOK_WEBHOOK] N8N_FACEBOOK_WEBHOOK_URL or N8N_WEBHOOK_URL is not configured.");
      return NextResponse.json({ error: "Channel not configured" }, { status: 503 });
    }

    const result = await bufferOrDispatchMessage({
      provider: "facebook",
      payload,
      webhookUrl: n8nWebhookUrl,
      logPrefix: "[FACEBOOK_WEBHOOK]",
    });

    return NextResponse.json(
      { received: true, batched: result.batched, count: result.batchSize },
      { status: 200 }
    );
  } catch (error) {
    console.error("[FACEBOOK_WEBHOOK]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

