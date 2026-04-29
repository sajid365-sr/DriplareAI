import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;
    const body = await req.json();
    const { message, providerA, modelA, providerB, modelB } = body;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mocked comparison logic
    // In a real app, you would call both models via OpenRouter or your LLM gateway
    
    return NextResponse.json({
      a: `Response from ${modelA} (${providerA}): This is a simulated response for "${message}".`,
      b: `Response from ${modelB} (${providerB}): Here is another perspective for "${message}".`,
    });
  } catch (error) {
    console.error("[COMPARE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
