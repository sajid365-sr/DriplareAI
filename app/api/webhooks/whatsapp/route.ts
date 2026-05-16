import { NextResponse } from "next/server";

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
    const payload = await req.json();
    const n8nWebhookUrl = process.env.N8N_WHATSAPP_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      console.warn("[WHATSAPP_WEBHOOK] N8N_WHATSAPP_WEBHOOK_URL is not configured.");
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
      console.error("[WHATSAPP_WEBHOOK_FORWARD]", response.status, await response.text());
      return NextResponse.json({ received: true, forwarded: false }, { status: 202 });
    }

    return NextResponse.json({ received: true, forwarded: true });
  } catch (error) {
    console.error("[WHATSAPP_WEBHOOK]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
