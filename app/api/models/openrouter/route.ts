import { NextResponse } from "next/server";

import { getOpenRouterModelPayload } from "@/lib/ai/openrouter-service";

// ⚠️ এখানে route-level `revalidate` **দেওয়া যাবে না**।
//
// আগে `export const revalidate = 43200` ছিল, অর্থাৎ এই উত্তর ১২ ঘণ্টা
// জমাট বাঁধা থাকত। কিন্তু এর ভেতরে এখন Fast/Smart/Genius-র credit মান
// আছে — admin panel থেকে credit বদলানোর পরেও ১২ ঘণ্টা ধরে ড্যাশবোর্ডে
// পুরনো মান দেখাত, অথচ বিল নতুন মানে কাটত। "কার্ডে এক, কাটে আরেক" —
// ঠিক যে সমস্যাটা আমরা মুছতে চাই।
//
// OpenRouter-এর আসল catalogue কল এখনো `unstable_cache`-এ ১২ ঘণ্টা
// cache হয় (`getCachedOpenRouterModels`) — তাই খরচ বাড়ে না,
// শুধু DB-র credit নিয়মটা প্রতিবার তাজা পড়া হয়।
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getOpenRouterModelPayload();
    // `no-store` — ব্রাউজারও যেন পুরনো credit ধরে না বসে (কারণ উপরের মতোই)।
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
    });
  } catch (error) {
    console.error("[OPENROUTER_MODELS_ROUTE]", error);
    return NextResponse.json({ error: "Failed to load OpenRouter models" }, { status: 500 });
  }
}
