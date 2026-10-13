import { NextResponse } from "next/server";
import { verifyMetaSignature } from "@/lib/core/meta-signature";
import { dedupeAndForward } from "@/lib/core/webhook-idempotency";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    // Read the raw body: Meta signs the bytes it sent, so parsing and
    // re-serialising would break the signature comparison.
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256");

    if (!verifyMetaSignature(rawBody, signatureHeader)) {
      console.warn("[WHATSAPP_WEBHOOK] Signature verification failed or missing signature header.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const n8nWebhookUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      // Answered 503 rather than 200 on purpose. A 200 tells Meta "handled, do
      // not retry" — so an unconfigured channel would eat every incoming message
      // without a trace. A 5xx keeps the message retryable and makes the
      // misconfiguration impossible to miss in the logs.
      console.error("[WHATSAPP_WEBHOOK] N8N_WHATSAPP_WEBHOOK_URL is not configured.");
      return NextResponse.json({ error: "Channel not configured" }, { status: 503 });
    }

    const result = await dedupeAndForward({
      provider: "whatsapp",
      payload,
      webhookUrl: n8nWebhookUrl,
      logPrefix: "[WHATSAPP_WEBHOOK]",
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("[WHATSAPP_WEBHOOK]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
