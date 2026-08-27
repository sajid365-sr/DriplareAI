import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { openRouter } from "@/lib/ai/embeddings";
import { syncProductEmbedding } from "@/lib/ai/qa-training";
import { logAiUsage } from "@/lib/ai/usage-logger";

export type TextExtractedProduct = {
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  stock?: number | null;
  variants: {
    colors?: string[];
    sizes?: string[];
    [key: string]: string[] | undefined;
  } | null;
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId: identifier } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bot = await getOwnedChatbot(userId, identifier);
    if (!bot) {
      return NextResponse.json({ error: "Chatbot not found" }, { status: 404 });
    }
    const chatbotId = bot.chatbotId;

    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    // Optional image URL uploaded via ProductImageUploader before submission
    const imageUrl = typeof body?.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;

    if (!text) {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 }
      );
    }

    // Call AI model to parse text into structured products
    const systemPrompt = `You are an expert e-commerce catalog AI.
Analyze the user's raw input text (which may be in Bengali, English, or Banglish) and extract product details.

Instructions:
- Extract all distinct products mentioned in the text.
- For each product, extract or generate:
  - "name": Product title (e.g. "ইরানী বোরখা")
  - "description": Product description. If the user didn't write a full description, generate a beautiful, customer-attractive description in the same language (max 250 chars).
  - "price": Number (e.g. 2500). If no price is mentioned, set to null.
  - "currency": Currency code (default "BDT").
  - "stock": Number representing available inventory/quantity (default 10 if not mentioned).
  - "variants": {
      "colors": ["কালো", "জলপাই", "বেগুনী"], // list of color options or null
      "sizes": ["Free Size"] // list of size options or null
    }

Return ONLY valid JSON in this exact format (no markdown fences):
{
  "products": [
    {
      "name": "ইরানী বোরখা",
      "description": "উচ্চমানের প্রিমিয়াম ইরানী বোরখা, আরামদায়ক কাপড় ও স্টাইলিশ ডিজাইন।",
      "price": 2500,
      "currency": "BDT",
      "stock": 10,
      "variants": {
        "colors": ["কালো", "জলপাই", "বেগুনী"],
        "sizes": ["Free Size"]
      }
    }
  ]
}`;

    const aiResponse = await openRouter.chat.completions.create({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const rawContent = aiResponse.choices[0]?.message?.content || "";

    const usage = aiResponse.usage;
    const promptTokens = usage?.prompt_tokens ?? Math.ceil((systemPrompt.length + text.length) / 4);
    const completionTokens = usage?.completion_tokens ?? Math.ceil(rawContent.length / 4);

    logAiUsage({
      workspaceId: bot.workspaceId || undefined,
      chatbotId: bot.chatbotId,
      userId,
      channel: "text_ingest",
      modelId: "google/gemini-2.5-flash",
      promptTokens,
      completionTokens,
    }).catch((err) => console.error("[TEXT_INGEST_LOG_USAGE_ERROR]", err));
    let extractedProducts: TextExtractedProduct[] = [];

    try {
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
      }
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.products)) {
        extractedProducts = parsed.products;
      }
    } catch (parseErr) {
      console.error("[TEXT_INGEST_PARSE_ERROR]", parseErr);
    }

    // Fallback if AI didn't return list: create 1 default item from raw text
    if (extractedProducts.length === 0) {
      extractedProducts = [
        {
          name: text.slice(0, 40) + "...",
          description: text.slice(0, 200),
          price: null,
          currency: "BDT",
          stock: 10,
          variants: null,
        },
      ];
    }

    // Save each extracted product to the database
    const savedProducts = [];
    for (const item of extractedProducts) {
      if (!item.name) continue;

      // Clean variants safely
      let cleanedVariants: TextExtractedProduct["variants"] = null;
      if (item.variants && typeof item.variants === "object") {
        const raw = item.variants as Record<string, unknown>;
        const cleaned: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(raw)) {
          if (Array.isArray(val)) {
            cleaned[key] = val.map((v) => String(v).trim()).filter(Boolean);
          }
        }
        cleanedVariants = Object.keys(cleaned).length > 0 ? cleaned : null;
      }

      const stock = typeof item.stock === "number" && item.stock >= 0 ? Math.floor(item.stock) : 10;

      const rawImageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
      const imageUrls = rawImageUrls.filter((u: any) => typeof u === "string" && u.trim()).map((u: string) => u.trim());
      if (imageUrl && !imageUrls.includes(imageUrl)) {
        imageUrls.unshift(imageUrl);
      }
      const primaryImageUrl = imageUrls[0] || imageUrl || null;

      const created = await db.product.create({
        data: {
          chatbotId,
          name: item.name.trim(),
          description: item.description ? item.description.trim() : null,
          price: typeof item.price === "number" && item.price > 0 ? item.price : null,
          currency: item.currency || "BDT",
          stock,
          variants: cleanedVariants ?? undefined,
          sourceType: "text",
          // Attach optional Cloudinary image URLs
          imageUrl: primaryImageUrl,
          imageUrls,
          isActive: true,
        },
      });
      savedProducts.push(created);
      // Per-product embedding (best-effort; persists sourceId + embeddingStatus).
      await syncProductEmbedding(created);
    }

    return NextResponse.json({
      success: true,
      count: savedProducts.length,
      products: savedProducts,
    });
  } catch (error) {
    console.error("[PRODUCTS_TEXT_INGEST_POST]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
