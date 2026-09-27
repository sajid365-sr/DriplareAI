import "server-only";

import { openRouter } from "@/lib/ai/embeddings";
import { logAiUsage } from "@/lib/ai/usage-logger";
import type { FBPost } from "@/lib/services/facebook";

/**
 * Product Auto-Sync — AI-powered product extraction from Facebook Page posts.
 * Reads post text + image context → extracts structured product data.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtractedProduct = {
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  variants: {
    colors?: string[];
    sizes?: string[];
    [key: string]: string[] | undefined;
  } | null;
  imageUrl: string | null;
  sourcePostId: string;
  postUrl: string | null;
};

type PostInput = {
  id: string;
  text: string;       // message + story combined
  imageUrl?: string;
  postUrl?: string;
};

export type ProductExtractMeta = {
  chatbotId?: string;
  userId?: string;
  workspaceId?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_POSTS_PER_BATCH = 15;
const MAX_TEXT_PER_POST = 800;  // chars — keep prompt manageable
const MODEL = "google/gemini-2.5-flash";

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Takes raw FB posts and returns AI-extracted product drafts.
 * Filters out non-product posts automatically.
 * Never throws — returns empty array on failure.
 */
export async function extractProductsFromPosts(
  posts: FBPost[],
  meta?: ProductExtractMeta
): Promise<ExtractedProduct[]> {
  if (posts.length === 0) return [];

  // Prepare post inputs
  const inputs: PostInput[] = posts
    .map((post) => ({
      id: post.id,
      text: buildPostText(post),
      imageUrl: post.full_picture ?? undefined,
      postUrl: post.permalink_url ?? undefined,
    }))
    .filter((p) => p.text.length > 10); // Skip empty/very short posts

  if (inputs.length === 0) return [];

  // Process in batches to avoid token limits
  const batches = chunkArray(inputs, MAX_POSTS_PER_BATCH);
  const allProducts: ExtractedProduct[] = [];

  for (const batch of batches) {
    try {
      const products = await extractBatch(batch, meta);
      allProducts.push(...products);
    } catch (err) {
      console.error("[PRODUCT_EXTRACT_BATCH_ERROR]", err);
    }
  }

  return allProducts;
}

// ─── Batch Processing ─────────────────────────────────────────────────────────

async function extractBatch(
  posts: PostInput[],
  meta?: ProductExtractMeta
): Promise<ExtractedProduct[]> {
  // Build a structured corpus for the AI
  const corpus = posts
    .map((p, i) => {
      const lines = [`[POST_${i + 1}] ID: ${p.id}`];
      if (p.text) lines.push(`Text: ${p.text.slice(0, MAX_TEXT_PER_POST)}`);
      if (p.imageUrl) lines.push(`Image: ${p.imageUrl}`);
      if (p.postUrl) lines.push(`URL: ${p.postUrl}`);
      return lines.join("\n");
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a product catalog AI for a social commerce platform. 
Analyze the following Facebook Page posts and extract product information.

Rules:
- Only extract posts that are clearly selling a product (clothing, accessories, food, electronics, etc.)
- Skip posts that are general updates, announcements, or have no product to sell
- For each product post, extract: name, description, price, currency, color variants, size variants
- If price is in BDT/Taka/৳, set currency to "BDT"
- If price is not mentioned, set price to null
- Sizes like S/M/L/XL, 38/40/42, Free Size are valid sizes
- Colors can be in Bengali or English — keep them as found in the text
- If a post has multiple products (e.g. a collection), create separate entries

Return ONLY valid JSON in this exact structure (no markdown):
{
  "products": [
    {
      "sourcePostId": "POST_ID_from_corpus",
      "name": "Product name",
      "description": "Short product description (max 200 chars)",
      "price": 2200,
      "currency": "BDT",
      "variants": {
        "colors": ["White", "Black"],
        "sizes": ["S", "M", "L", "XL"]
      },
      "imageUrl": "image url from corpus or null",
      "postUrl": "post url from corpus or null"
    }
  ]
}

If no product posts are found, return: {"products": []}`;

  try {
    const response = await openRouter.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: corpus },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content || "";

    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens ?? Math.ceil((systemPrompt.length + corpus.length) / 4);
    const completionTokens = usage?.completion_tokens ?? Math.ceil(raw.length / 4);

    if (meta?.chatbotId || meta?.userId || meta?.workspaceId) {
      logAiUsage({
        workspaceId: meta.workspaceId,
        chatbotId: meta.chatbotId,
        userId: meta.userId,
        channel: "product_sync",
        modelId: MODEL,
        promptTokens,
        completionTokens,
      }).catch((err) => console.error("[PRODUCT_SYNC_LOG_USAGE_ERROR]", err));
    }

    return parseAndCleanProducts(raw, posts);
  } catch (err) {
    console.error("[PRODUCT_EXTRACT_AI_ERROR]", err);
    return [];
  }
}

// ─── Parsing & Validation ─────────────────────────────────────────────────────

function parseAndCleanProducts(
  raw: string,
  posts: PostInput[]
): ExtractedProduct[] {
  try {
    let cleaned = raw.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }

    const parsed = JSON.parse(cleaned) as { products?: unknown[] };
    if (!Array.isArray(parsed?.products)) return [];

    // Build a lookup map for quick post data access
    const postMap = new Map(posts.map((p) => [p.id, p]));

    return (parsed.products as Record<string, unknown>[])
      .filter((p) => typeof p?.name === "string" && p.name.trim().length > 0)
      .slice(0, 30) // cap at 30 products per sync
      .map((p) => {
        const sourcePostId = String(p.sourcePostId ?? "");
        const postData = postMap.get(sourcePostId);

        // Parse variants safely
        let variants: ExtractedProduct["variants"] = null;
        if (p.variants && typeof p.variants === "object") {
          const raw = p.variants as Record<string, unknown>;
          const cleaned: Record<string, string[]> = {};
          for (const [key, val] of Object.entries(raw)) {
            if (Array.isArray(val) && val.every((v) => typeof v === "string")) {
              cleaned[key] = val.map((v) => String(v).trim()).filter(Boolean);
            }
          }
          variants = Object.keys(cleaned).length > 0 ? cleaned : null;
        }

        return {
          name: String(p.name).trim().slice(0, 200),
          description: p.description ? String(p.description).trim().slice(0, 500) : null,
          price: typeof p.price === "number" && p.price > 0 ? p.price : null,
          currency: typeof p.currency === "string" ? p.currency : "BDT",
          variants,
          imageUrl: postData?.imageUrl ?? (typeof p.imageUrl === "string" ? p.imageUrl : null),
          sourcePostId,
          postUrl: postData?.postUrl ?? (typeof p.postUrl === "string" ? p.postUrl : null),
        } satisfies ExtractedProduct;
      });
  } catch (err) {
    console.error("[PRODUCT_EXTRACT_PARSE_ERROR]", err);
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Combines post message and story into a single text for the AI. */
function buildPostText(post: FBPost): string {
  const parts: string[] = [];
  if (post.message) parts.push(post.message.trim());
  if (post.story && !post.message) parts.push(post.story.trim());
  return parts.join(" ").trim();
}

/** Splits an array into chunks of a given size. */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
