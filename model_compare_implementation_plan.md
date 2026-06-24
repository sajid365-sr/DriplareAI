# ইমপ্লিমেন্টেশন প্ল্যান: মডেল কম্পারিজন (Model Comparison) ফিচার

এই ফিচারের মাধ্যমে ব্যবহারকারী তার চ্যাটবটের জন্য দুটি ভিন্ন AI মডেল সিলেক্ট করে একই সাথে তাদের রেসপন্স তুলনা করতে পারবেন। উভয় মডেলই চ্যাটবটের সেট করা সিস্টেম প্রম্পট (System Prompt) এবং আপলোড করা সোর্স ডেটা (RAG) ব্যবহার করে উত্তর প্রদান করবে।

## স্থাপত্য সিদ্ধান্ত (Architectural Decision)

আমরা এই ফিচারটি **সরাসরি Next.js ব্যাকএন্ডে (কোডিং এর মাধ্যমে)** ইমপ্লিমেন্ট করার প্রস্তাব করছি। 

**কেন n8n এর পরিবর্তে Next.js ব্যবহার করব?**
১. **প্যারালাল এক্সিকিউশন (Speed):** Next.js থেকে সরাসরি `Promise.all` ব্যবহার করে দুটি এআই মডেলকে একসাথে কল করা যাবে। এর ফলে রেসপন্স পেতে অর্ধেক সময় লাগবে।
২. **Gemini Embedding (001) Integration:** যেহেতু ডেটাবেসে আপনার আপলোড করা ফাইলগুলোর এমবেডিং n8n-এ Gemini Embedding (`google/gemini-embedding-001`) মডেল দিয়ে সেভ করা হয়েছে, তাই আমরা এই এপিআই-তে কুয়েরির এমবেডিং তৈরি করতেও `google/gemini-embedding-001` ব্যবহার করব। এতে ডাইমেনশন মিসম্যাচ হবে না এবং সঠিক রিট্রিভাল হবে।
৩. **কোটা ম্যানেজমেন্ট:** ব্যবহারকারীর মেসেজ লিমিট খুব সহজেই লোকাল ডেটাবেসে আপডেট করা যাবে (২টি মেসেজ রিডাকশন)।
৪. **n8n ওভারহেড কমানো:** মডেল কম্পারিজনের জন্য কোনো চ্যাট হিস্ট্রি সেভ বা সোশ্যাল মিডিয়া ইন্টিগ্রেশনের প্রয়োজন নেই। তাই n8n ছাড়াই এটি দ্রুত ও নিরাপদে করা সম্ভব।

---

## প্রস্তাবিত পরিবর্তনসমূহ

### ১. এমবেডিং মডিউল আপডেট

`lib/ai/embeddings.ts` ফাইলে একটি নতুন ফাংশন `getGeminiEmbeddings` যোগ করা হয়েছে, যা OpenRouter-এর মাধ্যমে `google/gemini-embedding-001` মডেল কল করবে।

### ২. ব্যাকএন্ড এপিআই রাউট তৈরি/আপডেট

`app/api/chatbots/[chatbotId]/compare/route.ts` ফাইলটি আপডেট করা হবে। এটি ব্যবহারকারীর কুয়েরি নিয়ে নিচের কাজগুলো করবে:
1. চ্যাটবটের মালিকানা যাচাই করবে।
2. ব্যবহারকারীর মেসেজ কোটা চেক করবে (কম্পারিজনে ২টি মেসেজ কোটা ব্যবহৃত হবে)।
3. `getGeminiEmbeddings` ফাংশন দিয়ে ইনপুট করা মেসেজটির জন্য এমবেডিং তৈরি করে প্রাসঙ্গিক সোর্স ডেটা (RAG Context) রিট্রিভ করবে।
4. চ্যাটবটের সিস্টেম প্রম্পট এবং রিট্রিভ করা কনটেক্সট মিলিয়ে মূল প্রম্পট সাজাবে।
5. OpenRouter-এর মাধ্যমে সিলেক্ট করা দুটি মডেলকে প্যারালালে কল করবে।
6. ব্যবহারকারীর কোটা থেকে ২টি মেসেজ ডিডাক্ট করবে।
7. দুটি মডেলের রেসপন্স একসাথে রিটার্ন করবে।

#### [MODIFY] [route.ts](file:///c:/Users/User/Projects/DriplareAI/app/api/chatbots/[chatbotId]/compare/route.ts)
```typescript
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/core/db";
import { getOwnedChatbot } from "@/lib/domain/chatbot-access";
import { getPlan, type PlanKey } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import { getGeminiEmbeddings } from "@/lib/ai/embeddings";
import { getContext } from "@/lib/ai/rag";
import { openRouter } from "@/lib/ai/embeddings";
import { getOpenRouterModel } from "@/lib/ai/chat-models";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatbotId } = await params;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, providerA, modelA, providerB, modelB } = body;

    if (!message || !modelA || !providerA || !modelB || !providerB) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ১. চ্যাটবটের মালিকানা যাচাই
    const bot = await getOwnedChatbot(userId, chatbotId);
    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    // ২. কোটা ও লিমিট চেক
    const user = await db.user.findUnique({ where: { userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const region = (user.region || "bd") as Region;
    const planConfig = getPlan(region, user.plan as PlanKey);

    if (user.plan === "starter" && user.messagesUsedThisCycle + 2 > planConfig.includedMessages) {
      return NextResponse.json({ 
        error: "Quota exhausted. Please upgrade.",
        code: "QUOTA_EXHAUSTED"
      }, { status: 402 });
    }

    // ৩. সোর্স কনটেক্সট (RAG Context) রিট্রিভ করা (Gemini Embedding ব্যবহার করে)
    let context = "";
    try {
      const embeddings = await getGeminiEmbeddings(message);
      if (embeddings && embeddings.length > 0) {
        context = await getContext(chatbotId, embeddings[0]);
      }
    } catch (err) {
      console.error("[COMPARE_RAG_ERROR]", err);
    }

    // ৪. সিস্টেম প্রম্পট ও কনটেক্সট সমন্বয়
    const systemPrompt = bot.systemPrompt || "You are a helpful assistant.";
    const fullSystemPrompt = `${systemPrompt}

Below is some context retrieved from the database to help you answer the user's question. Use it to formulate your answer if relevant:
-----
${context}
-----`;

    // ৫. দুটি মডেলে প্যারালাল কল পাঠানো
    const modelIdA = getOpenRouterModel(providerA, modelA);
    const modelIdB = getOpenRouterModel(providerB, modelB);

    const [resA, resB] = await Promise.all([
      openRouter.chat.completions.create({
        model: modelIdA,
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: message }
        ],
        temperature: bot.temperature,
        max_tokens: bot.maxTokens,
      }).catch(err => {
        console.error(`Error querying model A (${modelIdA}):`, err);
        return { choices: [{ message: { content: `Error: Failed to fetch response from ${modelA}.` } }] };
      }),
      openRouter.chat.completions.create({
        model: modelIdB,
        messages: [
          { role: "system", content: fullSystemPrompt },
          { role: "user", content: message }
        ],
        temperature: bot.temperature,
        max_tokens: bot.maxTokens,
      }).catch(err => {
        console.error(`Error querying model B (${modelIdB}):`, err);
        return { choices: [{ message: { content: `Error: Failed to fetch response from ${modelB}.` } }] };
      })
    ]);

    // ৬. কোটা আপডেট (২টি মেসেজ ব্যবহার করা হয়েছে)
    await db.user.update({
      where: { userId },
      data: {
        messagesUsedThisCycle: { increment: 2 }
      }
    });

    return NextResponse.json({
      a: resA.choices[0]?.message?.content || "",
      b: resB.choices[0]?.message?.content || "",
    });

  } catch (error) {
    console.error("[COMPARE_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
```

---

## ভেরিফিকেশন প্ল্যান (Verification Plan)

### ম্যানুয়াল ভেরিফিকেশন
১. ডেটাবেস থেকে ইউজারের মেসেজ কোটা দেখে নেওয়া হবে।
২. লোকাল হোস্ট থেকে `/dashboard/chatbots/[chatbotId]/compare` পেজে যাওয়া হবে।
৩. দুটি আলাদা মডেল (যেমন: `Gemini 2.5 Flash Lite` এবং `Llama 3.3 70B`) সিলেক্ট করা হবে।
৪. আপনার আপলোড করা সোর্স ফাইলের সাথে সম্পর্কিত একটি প্রশ্ন লিখে "Compare" বাটনে ক্লিক করা হবে।
৫. দেখা হবে যে দুটি কলামেই সংশ্লিষ্ট মডেলের কাছ থেকে সঠিক উত্তর (RAG সোর্স ব্যবহার করে) পাওয়া যাচ্ছে কি না।
৬. ডেটাবেসে চেক করে দেখা হবে যে ইউজারের মেসেজ কোটা ২ পয়েন্ট কমেছে কি না।
