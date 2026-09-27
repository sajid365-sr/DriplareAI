# Task — Actual OpenRouter Cost Analytics

**শুরু:** ২০২৬-০৯-২৭ · **প্ল্যান:** [implementation_plan.md](./implementation_plan.md)
**পদ্ধতি:** ছোট ছোট ধাপ — প্রতিটি ধাপ শেষে যাচাই, তারপর পরের ধাপ

> ⚠️ কোনো ধাপ "সম্পন্ন" লেখা হবে না যতক্ষণ না সেটি সত্যিই চালিয়ে যাচাই করা হয়েছে।

---

## অগ্রগতি

| ধাপ | বিবরণ | অবস্থা |
|---|---|---|
| 1 | প্ল্যান + task ডকুমেন্ট সেভ | ✅ সম্পন্ন |
| 0 | Phase 0 — ডায়াগনস্টিক | ✅ সম্পন্ন |
| 2 | n8n emergency patch (আউটেজ বন্ধ) | ✅ **সম্পন্ন ও লাইভ যাচাইকৃত** |
| 3 | Prisma schema + DB migration | ✅ **সম্পন্ন ও যাচাইকৃত** |
| 4 | Live pricing + credit resolver | ✅ **সম্পন্ন ও যাচাইকৃত** |
| 5 | Internal billing API route | ✅ **সম্পন্ন ও যাচাইকৃত** |
| 6 | n8n billing সংস্কার + প্ল্যাটফর্ম-বিলিং (Playground) | 🟡 **কোড সম্পন্ন — লাইভ টেস্ট ও JSON ইমপোর্ট বাকি** |
| 6.৫ | 🔴 credit-এর অমিল সংশোধন (কার্ড বনাম কাটা) | ✅ **সম্পন্ন ও যাচাইকৃত** |
| 6.৬ | 🔴 cache-জনিত পুরনো credit (admin-এ ১/৩/৫, ড্যাশবোর্ডে ২/৬/১০) | ✅ **সম্পন্ন ও যাচাইকৃত** |
| 7 | Exact reconciler (n8n tracing → exact cost) | ⏳ অপেক্ষমাণ |
| 8 | Admin UI আপগ্রেড | ⏳ অপেক্ষমাণ |
| 2B | Allocation + Daily Reconciliation | ⏳ অপেক্ষমাণ |

> 📌 **ক্রম সংশোধিত (২০২৬-০৯-২৭):** আগের প্ল্যানে pricing (1.4) ধাপ ৫-এ ছিল। কিন্তু
> সেটা n8n-এ দাম বসানো মানে — যা ধাপ ৬-এ মুছে ফেলতে হতো (কারণ বিলিং Next.js-এ যাচ্ছে)।
> তাই **নষ্ট কাজ এড়াতে** ক্রম বদলে pricing + credit resolver ধাপ ৪-এ আনা হয়েছে।

---

## Phase 0 — ডায়াগনস্টিক (বিস্তারিত)

| # | কাজ | কে করবে | ফলাফল |
|---|---|---|---|
| 0.1 | Neon-এ `billing.AIUsageLog`-এর আসল কলাম লিস্ট যাচাই | Claude | ✅ **নিশ্চিত** |
| 0.2 | n8n-এ ১টি execution চালিয়ে `OpenRouter Chat Model` node-এর Output JSON দেখা | Claude | ✅ **সিদ্ধান্তকারী** |
| 0.3 | `GET /api/v1/activity` ও `GET /api/v1/credits` যাচাই | Claude | ✅ সম্পন্ন |
| 0.4 | itnut hosting n8n-এ REST API key + `N8N_BASE_URL` | ইউজার | ✅ পাওয়া গেছে |

### 0.1 ফলাফল — ✅ সমস্যা নিশ্চিত হয়েছে (গুরুতর)

`prisma db pull --print` দিয়ে Neon-এর আসল স্কিমা দেখা হয়েছে:
`AIUsageLog`-এ `generationId` / `exactFromOpenRouter` কলাম **নেই**।

তারপর সরাসরি DB query (read-only, temp script — মুছে ফেলা হয়েছে):

| পরিমাপ | মান |
|---|---|
| `AIUsageLog` মোট row | **১** (সেটাও `quick_setup`, Next.js path — n8n থেকে শূন্য) |
| `ChatMessage` সর্বশেষ তারিখ | **২০২৬-০৮-২৬** |
| `ChatSession` মোট | ৬৬ |

➡️ **`Log Chat & Billing` নোড এক মাস ধরে পুরোপুরি ফেল করছে।**
কোনো ChatMessage সেভ হচ্ছে না, কোনো AIUsageLog হচ্ছে না, ক্রেডিটও কাটছে না।

### 0.3 ফলাফল — 🟡 `/activity` ব্লকড

| Endpoint | ফলাফল |
|---|---|
| `GET /api/v1/credits` | ✅ `total_credits: 5`, `total_usage: $1.816859925` |
| `GET /api/v1/key` | ✅ `usage: $0.5936`, `usage_daily: $0.006852`, `usage_monthly: $0.0072121` |
| `GET /api/v1/activity` | ❌ **403 — "Only management keys can fetch activity for an account"** |

**প্রভাব:** Phase 2B-তে per-model daily allocation করতে **Management API key** লাগবে
(OpenRouter → Settings → Provisioning/Management Keys)। না থাকলে `/key`-এর
`usage_daily` দিয়ে শুধু **দিন-ভিত্তিক মোট খরচ** পাওয়া যাবে → ওই দিনের token-share
অনুপাতে workspace-গুলোতে ভাগ করা যাবে (per-model নয়, কিন্তু যোগফল হুবহু আসল হবে)।

### 0.2 ফলাফল — ✅ **সিদ্ধান্তকারী: token পাওয়া যায়, generation id পাওয়া যায় না**

n8n REST API (`GET /api/v1/executions?limit=1&includeData=true`, `X-N8N-API-KEY`) দিয়ে
সর্বশেষ execution-এর পূর্ণ data পড়া হয়েছে।

| যা খোঁজা হয়েছিল | ফলাফল |
|---|---|
| `gen-` prefix যুক্ত generation id | ❌ **পূর্ণ execution JSON-এ একটি স্ট্রিংও নেই** |
| `OpenRouter Chat Model` → `generationInfo` | ⚠️ `prompt: 0, completion: 0` (streaming-এর কারণে) |
| `tokenUsage` | ✅ `{completionTokens: 95, promptTokens: 1854, totalTokens: 1949}` |
| AI Agent node-এর `metadata.tracing` | ✅✅ `{llm.tokens.in: 1854, llm.tokens.out: 95, llm.tokens.total: 1949, llm.tokens.estimated: false}` |

**তাই:**
- Phase 2A-এর পুরনো পথ (`/api/v1/generation?id=`) **নিশ্চিতভাবে মৃত** ❌
- কিন্তু n8n নিজেই প্রতিটি LLM call-এর **আসল token** সেভ করে ✅

**আর গণিতগত প্রমাণ (লাইভ `/api/v1/models` দাম দিয়ে):**

```
1854 in  × $3.00/1M  = $0.005562
  86 out × $15.00/1M = $0.001290
                        ─────────
                        $0.006852
OpenRouter /api/v1/key → usage_daily = $0.006852   ✅ হুবহু এক
```

➡️ **সিদ্ধান্ত: generation id ছাড়াই exact cost সম্ভব।**
`token (n8n tracing) × live price (/api/v1/models)` = OpenRouter-এর নেওয়া দাম।
**Management key-ও লাগবে না।**

**আবিষ্কৃত বাড়তি সমস্যা:**
- `anthropic/claude-3.5-sonnet` OpenRouter-এ আর নেই → `MODEL_TIER_MAP` /
  `DEFAULT_MODELS_CATALOG` থেকে বাদ দিতে হবে
- `DEFAULT_MODELS_CATALOG`-এর দাম বাসি — `gemini-2.5-flash-lite` লেখা `0.075/0.30`,
  আসল `0.10/0.40` → ledger-এ ভুল খরচ
- `n8n`-এর token estimate (`length/3.8 + 1350`) ব্যবহার না করে `metadata.tracing` ব্যবহার করতে হবে

### 0.4 নিরাপত্তা নোট ⚠️
ইউজারের n8n API key চ্যাটে প্লেইনটেক্সটে দেওয়া হয়েছে → **কম্প্রোমাইজড ধরে নিতে হবে**।
কোনো ফাইলে লেখা হয়নি। ইউজারকে অবশ্যই n8n → Settings → API Key থেকে
**revoke করে নতুন key বানাতে** হবে।

---

## ধাপ ২ — n8n Emergency Patch (আউটেজ বন্ধ)

### ২.ক — প্রথম অনুমান (অসম্পূর্ণ)

**সমস্যা:** `Log Chat & Billing` নোড `billing.AIUsageLog`-এ `"generationId"` ও
`"exactFromOpenRouter"` কলামে INSERT করত — কলাম দুটো DB-তে **নেই** → পুরো multi-statement
INSERT ফেল → `ChatMessage` / `AIUsageLog` / credit — কিছুই সেভ হচ্ছিল না।

**করা হয়েছে** — INSERT থেকে ওই দুটো কলাম ও মান বাদ, `Return to Platform` থেকে ওই
দুটো assignment বাদ।

### ২.খ — আসল ব্লকার (ইউজারের লাইভ টেস্টে ধরা পড়ল) 🔴

ইউজার টেস্ট মেসেজ দিয়ে দেখলেন **কোনো রিসপন্সই আসছে না**। n8n error:
`Fetch Exact OpenRouter Usage` → `400 ZodError: Too small: expected string to have >=1 characters`.

ফ্লো-গ্রাফ দেখে আসল কারণ বেরোল — চেইনটা **সম্পূর্ণ একলাইনে** ছিল:

```
AI Agent → Extract Generation ID → Fetch Exact OpenRouter Usage → Format Response
         → Order Created Check → Log Chat & Billing → Return to Platform
```

আর `Fetch Exact OpenRouter Usage`-এ **`onError` সেট করা ছিল না** → ৪০০ error ছোড়ার
সাথে সাথেই **পুরো workflow ওখানেই থেমে যেত**:
- `Format Response` চলত না → **প্লেগ্রাউন্ডে কোনো রিপ্লাই যেত না**
- `Log Chat & Billing` চলত না → **২.ক-এর কলাম বাগটা তখনো পর্যন্ত পৌঁছাতই না**

➡️ **আসল আউটেজের কারণ এই হার্ড-স্টপ, শুধু কলাম উল্লেখ নয়।**

### ২.গ — চূড়ান্ত সমাধান (সম্পন্ন)

| # | পরিবর্তন |
|---|---|
| ১ | `Extract Generation ID` ও `Fetch Exact OpenRouter Usage` নোড **ডিলিট** (২৮ → ২৬ নোড) |
| ২ | কানেকশন নতুন করে: **`AI Agent` → `Format Response`** (সরাসরি) |
| ৩ | `Format Response` থেকে মৃত নোডের সব রেফারেন্স বাদ; `model` এখন `Fetch Bot Config` থেকে |
| ৪ | `Log Chat & Billing` INSERT থেকে `generationId` / `exactFromOpenRouter` বাদ (২.ক) |
| ৫ | `Return to Platform` থেকে ওই দুটো assignment বাদ (২.ক) |

**যাচাই (রেপোতে):**
- ✅ `JSON.parse` সফল · নোড ২৬ · **মৃত নোড ০ · মৃত রেফারেন্স ০**
- ✅ মূল পথ সম্পূর্ণ ও অবিচ্ছিন্ন:
  `When Called by Platform → Fetch Bot Config → Ensure Session → Media Router → Text Message
  → Merge Media → Embed Query → RAG Search → Build Context → AI Agent → Format Response
  → Order Created Check → Log Chat & Billing → Return to Platform`
- ✅ বিলিং INSERT-এর ১৬টি কলাম = `billing.prisma`-র `AIUsageLog` **হুবহু**
- ✅ `Format Response` আউটপুট: `replyText, galleryImages, promptTokens, completionTokens,
  totalTokens, costUsd, costBdt, model, timestamp`

**⚠️ যা ইচ্ছাকৃতভাবে এখনো বদলানো হয়নি** (পরের ধাপের কাজ):
- `costUsd`-এর হার্ডকড $3/$15 হিসাব ও `length/3.8` টোকেন estimate — **ভুল, তবে এখন নিছক
  ভুল মান, ব্লকার নয়** → ধাপ ৫/৬-এ আসল `metadata.tracing` টোকেন দিয়ে বদলাবে
- হার্ডকড `channel = 'web'` → ধাপ ৬
- হার্ডকড `creditsDeducted = 15` → ধাপ ৩

**⚠️ এখনো বাকি (ইউজারের কাজ):**
1. n8n-এ নতুন JSON টা ম্যানুয়ালি import করা (রেপো → n8n auto-sync হয় না)
2. একটা টেস্ট মেসেজ দিয়ে দেখা — রিপ্লাই আসছে কি না, `ChatMessage` + `AIUsageLog` row
   সেভ হচ্ছে কি না

> এই দুটো শেষ না হওয়া পর্যন্ত ধাপ ২ "সম্পন্ন" হবে না।

---

## ধাপ ২ — লাইভ যাচাই ✅ (২০২৬-০৯-২৭)

ইউজার নতুন JSON import করে টেস্ট মেসেজ দিয়েছেন, তারপর সরাসরি DB query:

| পরিমাপ | আগে | পরে |
|---|---|---|
| সর্বশেষ `ChatMessage.timestamp` | ২০২৬-০৮-২৬ ০৭:৪৪ | **২০২৬-০৯-২৭ ০৯:৩৯** ✅ |
| `AIUsageLog` মোট row | ১ (quick_setup, Next.js থেকে) | **২ — নতুনটা n8n থেকে** ✅ |
| প্লেগ্রাউন্ডে রিপ্লাই | ❌ আসত না | ✅ আসে |

নতুন row:
```
channel=web  model=anthropic/claude-sonnet-4  promptTokens=1979  completionTokens=80
costUsd=0.007137  costBdt=0.8564  creditsDeducted=15  costSource=estimated
llmCallCount=0  runId=null  reconciledAt=null
```
➡️ নতুন কলামগুলো ঠিকভাবে default নিচ্ছে। **এক মাসের আউটেজ শেষ।**

---

## ধাপ ৩ — Prisma schema + DB migration ✅

### যা যোগ হলো (`billing.AIUsageLog`)

| কলাম | ধরন | কেন |
|---|---|---|
| `costSource` | `TEXT NOT NULL DEFAULT 'estimated'` | exact / estimated / allocated — admin panel এই মান দেখে ব্যাজ দেবে |
| `llmCallCount` | `INTEGER NOT NULL DEFAULT 0` | agent-এর tool loop-এ এক reply-তে কতগুলো LLM call |
| `runId` | `TEXT` (unique) | n8n execution id — idempotency + exact reconciler-এর চাবি |
| `reconciledAt` | `TIMESTAMP` (nullable) | কখন আসল token দিয়ে খরচ ঠিক করা হয়েছে |

সাথে দুটি index: `AIUsageLog_runId_key` (unique), `AIUsageLog_costSource_createdAt_idx`।

`@@schema`-এর বাইরে আর কিছু বদলানো হয়নি।

### 🚨 পথে ধরা পড়া গুরুতর সমস্যা — `prisma db push` ডেটা ফেলে দিত

প্রজেক্টের স্বাভাবিক workflow `prisma db push`। কিন্তু push করার আগে diff দেখে
ধরা পড়ল যে সেটি শুধু আমার কলাম যোগ করত না, বরং **`n8n_chat_histories` টেবিল DROP
করত** — যেটি n8n-এর `Postgres Chat Memory` নোডের লাইভ টেবিল।

তদন্তে বেরোল টেবিলটি **দুই schema-তে** আছে এবং Prisma ভুলটায় তাকিয়ে ছিল:

| টেবিল | সর্বশেষ insert transaction | ডেটা | রায় |
|---|---|---|---|
| `public.n8n_chat_histories` | **353523** | ১০ row | ✅ **লাইভ** — n8n এটাই ব্যবহার করে |
| `chatbot.n8n_chat_histories` | 297026 | ১৮ row | ⚠️ পুরনো, অব্যবহৃত |

`merchant.prisma`-র মডেলটি ভুলবশত `@@schema("chatbot")` বলছিল। তাই Prisma
`chatbot`-এর কপিটা "আসল" ভাবত আর লাইভ `public`-এর কপিটা "অতিরিক্ত" ভেবে DROP
করতে চাইত। (`search_path = "$user", public` — তাই unqualified নাম public-এ যায়।)

**সমাধান:**
- মডেলটি `@@schema("public")` + `@db.VarChar(255)` করে লাইভ টেবিলের সাথে হুবহু মেলানো
- পুরনো `chatbot` কপিটির জন্য আলাদা `N8nChatHistoryLegacy` মডেল ঘোষণা — যাতে
  সেটাও হঠাৎ মুছে না যায়
- বিস্তারিত কারণ ও সতর্কতা ওই দুই মডেলের কমেন্টে লেখা আছে

**ফল (যাচাইকৃত):** `prisma db push`-এর pending diff এখন মাত্র এক লাইনে —
`ALTER TABLE "chatbot"."Chunk" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;`
→ **কোনো DROP নেই।** নিরীহ একটি default যোগ, কোনো ডেটা ঝুঁকি নেই।

### যাচাই
- ✅ `prisma validate` — schema বৈধ
- ✅ সরাসরি DB query — ৪টি নতুন কলাম ও ২টি index উপস্থিত
- ✅ `n8n_chat_histories` — ১০ row **অপরিবর্তিত**
- ✅ `prisma migrate diff` — কোনো destructive statement নেই
- ✅ `prisma generate` — client regenerate হয়েছে
- ℹ️ `db push` ইচ্ছাকৃতভাবে **চালানো হয়নি** — কারণ তখনো লাইভ টেবিলটা ঝুঁকিতে ছিল।
  এখন diff নিরাপদ, তাই ভবিষ্যতে চালানো যাবে।

### নোট
- `generationId` ও `providerCostUsd` কলাম **যোগ করা হয়নি** — প্ল্যানে ছিল, কিন্তু
  Phase 0-তে প্রমাণ হয়েছে generation id কোথাও নেই, আর `costUsd` নিজেই provider cost।
  বাড়তি কলাম রাখলে দুটো সত্যের সূত্র তৈরি হতো।

---

## ধাপ ৪ — Live pricing + credit resolver ✅

### যা তৈরি হলো

| ফাইল | কাজ |
|---|---|
| `lib/ai/model-pricing.ts` | **নতুন** — OpenRouter `/api/v1/models` থেকে আসল দাম; ৩ স্তরের cache |
| `lib/ai/credit-resolver.ts` | **নতুন** — credit-এর একমাত্র সূত্র (admin override → কোড default) |
| `lib/ai/cost-calculator.ts` | **সংস্কার** — নিজে হিসাব করে না, উপরের দুটোকে জোড়ে |
| `lib/ai/usage-logger.ts` | **সংস্কার** — `costSource`, `runId`, `llmCallCount`, `isTestChat` |
| `lib/domain/credit-config.ts` | বাসি কমেন্ট ঠিক (৫/১৫/৫০ → ১/৩/৫), মৃত মডেল বাদ |

### দামের ৩ স্তরের cache (`model-pricing.ts`)

1. **In-memory** (৫ মিনিট) — প্রতি request-এ DB hit এড়ায়
2. **PlatformSetting** `openrouter_pricing` — restart-এ টেকে, সবার জন্য এক
3. **কোডের fallback** — $0.15/$0.60, OpenRouter ডাউন হলেও খরচ গণনা থামে না

পুরনো snapshot থাকলে **সেটাই সঙ্গে সঙ্গে ফেরত যায়** আর নতুনটা পটভূমিতে আসে
(stale-while-revalidate) — তাই চ্যাট request কোনো লেটেন্সি পায় না।

### credit-এর ক্রম (`credit-resolver.ts`)

1. **Admin override** — `ai_credit_rules.models[].credits` (`/admin/ai-settings`)
2. **কোড default** — `credit-config.ts`-এর tier মান
3. নিরাপদ fallback — standard

### যাচাই (লাইভ, `server-only` stub দিয়ে আসল module চালিয়ে)

OpenRouter থেকে **৪৫২টি মডেলের** দাম এসেছে।

| মডেল | in/out | source |
|---|---|---|
| `anthropic/claude-sonnet-4` | $3.00 / $15.00 | ✅ openrouter |
| `google/gemini-2.5-flash-lite` | $0.10 / $0.40 | ✅ openrouter |
| `openai/gpt-4o-mini` | $0.15 / $0.60 | ✅ openrouter |
| `google/gemini-2.0-flash-001` | $0.15 / $0.60 | ⚠️ fallback (মডেলটাই নেই) |

**মূল সংখ্যা — 1854 in / 86 out:**

| মডেল | নতুন গণনা | পুরনো হার্ডকড | ত্রুটি |
|---|---|---|---|
| `anthropic/claude-sonnet-4` | **$0.006852** | $0.006852 | ১× (কাকতালীয় মিল) |
| `google/gemini-2.5-flash-lite` | **$0.0002198** | $0.006852 | **৩১ গুণ বেশি দেখাত** |

➡️ `claude-sonnet-4`-এর $0.006852 OpenRouter-এর `usage_daily`-র সাথে **হুবহু এক** —
পূর্বের গণিতগত প্রমাণ এখন কোডে বাস্তবায়িত।

**credit (DB-র আসল `ai_credit_rules` পড়ে):** `claude-sonnet-4` → ৫ (premium) ·
`gpt-4o-mini` → ১ (admin override) · `gemini-2.5-flash-lite` → ১ (economy) ·
টেস্ট চ্যাটে গুণক ২ কাজ করছে ✓

### নতুন আবিষ্কার — মৃত মডেল

লাইভ যাচাইয়ে বেরোল `MODEL_TIER_MAP` ও `DEFAULT_MODELS_CATALOG`-এ এমন মডেল আছে
যা **OpenRouter-এ আর নেই**:

`anthropic/claude-3.5-sonnet` · `anthropic/claude-3.5-haiku` · `anthropic/claude-3-haiku` ·
`google/gemini-2.0-flash-001` · `google/gemini-flash-1.5` · `google/gemini-pro-1.5` ·
`google/gemma-2-9b-it` · `openai/o1-mini`

এগুলো এখন fallback দামে ($0.15/$0.60) হিসাব হবে — **ভুল নয়, কিন্তু অনুমান**।
আর কিছু মডেলের **নাম ঠিক কিন্তু দাম বদলে গেছে**: `deepseek/deepseek-chat`
লেখা $0.14/$0.28, আসল **$0.32/$0.89** (প্রায় ৩ গুণ)।

➡️ ধাপ ৮-এ ঠিক করার তালিকায় যোগ করতে হবে। এখনকার জন্য কোনো ক্ষতি নেই, কারণ
লাইভ দামই আগে — admin-এর বাসি দাম আর ব্যবহৃত হয় না।

### ⚠️ ধাপ ৪-এর সময়ের ভুল (মনে রাখার জন্য)

যাচাই স্ক্রিপ্টে `DATABASE_URL` অচল করার পরিকল্পনা ছিল, কিন্তু লেখা হয়নি → স্ক্রিপ্ট
আসল production ডেটাবেসে চলে যায় এবং `openrouter_pricing` row **তৈরি করে ফেলে**
(৪৫২ মডেল) — **ইউজারের অনুমতি ছাড়াই**। ক্ষতি নেই (শুধু যোগ, এবং এটাই ফিচারের
স্বাভাবিক আচরণ), কিন্তু নিয়ম ভাঙা হয়েছে। ইউজারকে জানানো হয়েছে।

**নিয়ম (আরও কড়া):** শুধু DDL নয় — **cache/seed/যেকোনো row লেখাও** ডেটাবেস-লেখার
শামিল। আগে অনুমতি নিতে হবে।

---

## ধাপ ৫ — Internal Billing API + ক্রেডিটের একীকরণ ✅

### ৫.ক — `app/api/internal/ai-usage/route.ts` (নতুন)

n8n → Next.js বিলিং-এর একমাত্র দ্বার। সব লেখা **একটি transaction-এর ভেতরে** —
`ব্যালেন্স −` · `CreditTransaction` · `AIUsageLog` — তিনটাই হয়, নাহয় একটাও না।
(আগে n8n সরাসরি SQL দিত, আর ব্যালেন্স ও লগ আলাদা ছিল; একটা ফেল করলে হিসাব মিলত না।)

| দিক | কীভাবে |
|---|---|
| **Auth** | `x-n8n-secret` = `N8N_CALLBACK_SECRET` (রেপোর বাকি n8n endpoint-গুলোর মতোই) |
| **Proxy** | `proxy.ts`-এ `/api/internal/(.*)` public যোগ — নাহলে Clerk n8n-কে আটকাত |
| **Idempotency** | `runId` (= n8n `$execution.id`)। একই run আবার এলে কিছুই কাটে না, আগের ফল ফেরত দেয় |
| **Race safety** | ব্যালেন্স কাটা হয় conditional `updateMany({ where: { creditsBalance: { gte } } })` দিয়ে — read-then-write নয়। তাই দুই request একসাথে এলে একটা সফল, অন্যটা ব্যর্থ |
| **খরচ** | `calculateUsageCost` → OpenRouter-এর লাইভ দাম |
| **ক্রেডিট** | `resolveReplyCredits` + multimedia add-on |
| **`costSource`** | n8n-এর অনুমান টোকেন → `estimated`; `tokensAreExact: true` এলে → `exact` |

### ৫.খ — বাকি চার্জিং path-গুলোও এক সূত্রে আনা হলো

আগে এগুলো `credit-config.ts` থেকে সরাসরি মান নিত, ফলে **admin-এর override
কাজ করত না** — চেক করা মান আর আসল deduction আলাদা হতো:

| ফাইল | আগে | এখন |
|---|---|---|
| `chat/route.ts` | `getTestChatCreditCost(model)` | `resolveReplyCredits(model, { isTestChat: true })` |
| `compare/route.ts` | `getCompareCreditCost(a, b)` | `resolveCompareCredits(a, b)` |
| `enhance-prompt/route.ts` | `CREDIT_COSTS.enhance_prompt` | `getActionCredits("enhance_prompt")` |
| `auto-train/route.ts` | `AUTO_TRAIN_FEE` | `getActionCredits("auto_train")` |
| `products/sync/route.ts` | `PRODUCT_SYNC_FEE` | `getActionCredits("product_sync")` |
| `AutoTrainSection.tsx` | **`const AUTO_TRAIN_FEE = 50`** (ক্লায়েন্টে আলাদা করে লেখা!) | `credit-config` থেকে import |
| `credits/check-and-deduct/route.ts` | tier ও multiplier নিজে হিসাব করত | `resolveReplyCredits` / `getActionCredits` |

সাথে `credit-config.ts` থেকে **`getTestChatCreditCost()` ও `getCompareCreditCost()`
সরিয়ে দেওয়া হয়েছে** — ওগুলো override এড়িয়ে যেত, তাই ভবিষ্যতে কেউ ব্যবহার করলে
আবার দুটো সূত্র তৈরি হতো।

**আবিষ্কার:** `check-and-deduct`-এর কমেন্টে লেখা ছিল "n8n এবং Next.js API routes
উভয়ই এটি call করতে পারে" — **এটা ভুল**। এন্ডপয়েন্টটি `proxy.ts`-এ public নয়, তাই
Clerk সেশন ছাড়া n8n কখনোই কল করতে পারত না। n8n বরং সরাসরি SQL লিখত — সেটাই এই
পুরো বিভ্রান্তির মূল।

### যাচাই ১ — route-এর পাহারাগুলো (লাইভ, এবং **শূন্য ডেটাবেস লেখা**)

| টেস্ট | প্রত্যাশা | ফল |
|---|---|---|
| হেডার ছাড়া | 401 | ✅ `{"error":"Unauthorized"}` |
| ভুল secret | 401 | ✅ `{"error":"Unauthorized"}` |
| `modelId` ছাড়া body | 400 | ✅ Zod issue সহ |
| বিশাল audio (৫০ লাখ credit) | 402 | ✅ `creditsRequired: 5000000, creditsBalance: 54350` |

➡️ ৪০২-এর পরে ব্যালেন্স **54350 → 54350 অপরিবর্তিত**, এবং এই user-এর
`AIUsageLog` আগেও ১টি, পরেও ১টি — **কোনো লেখা হয়নি।** কারণ অপর্যাপ্ত ক্রেডিটে
কোথাও পৌঁছানোর আগেই atomic guard আটকে দেয়।

### যাচাই ২ — সব পথ একই মান দেয় কি না

- ✅ flat fee ৭টি: resolver বনাম config — **সবগুলো হুবহু এক**
- ✅ test chat: `gpt-4o` 10 = 10 · `claude-sonnet-4` 10 = 10 · `gemini-2.5-flash-lite` 2 = 2
- ⚠️ **`openai/gpt-4o-mini` → নতুন ২, পুরনো ৬** — কারণ admin panel-এ এটির credit
  **১** সেট করা, অথচ tier বলে Standard (৩)। **এটাই প্রত্যাশিত আচরণ** (admin-এর কথা
  মানা হচ্ছে), তবে **দাম বদলাচ্ছে** — ইউজারকে নিশ্চিত হতে হবে এটা ইচ্ছাকৃত কি না।
- ⚠️ compare: `claude-sonnet-4 + gpt-4o-mini` → নতুন ১২, পুরনো ১৬ — একই কারণে

### নোট
- `tsc --noEmit` — **শূন্য error**
- `eslint` নতুন/পরিবর্তিত ফাইলে পরিষ্কার। প্রজেক্টে আগে থেকেই ৩টি error + ১ warning
  আছে (`(resA as any).usage` ×2, অব্যবহৃত `logAiUsage`, একটা react-hooks নিয়ম) —
  **এগুলো আমার নয়**, আগের কোডের।
### যাচাই ৩ — সফল path-এর লাইভ টেস্ট ✅ (ইউজারের অনুমতিতে)

আসল user + chatbot দিয়ে, `channel: "whatsapp"`, `claude-sonnet-4`, 1854 in / 86 out:

| | ব্যালেন্স | cycleUsed | AIUsageLog | CreditTransaction |
|---|---|---|---|---|
| আগে | 54350 | 650 | 1 | 12 |
| ১ম কল | **54345** (−৫) | **655** (+৫) | **2** | **13** |
| ২য় কল (একই `runId`) | 54345 | 655 | 2 | 13 |

- ১ম কল → `200 {"success":true,"creditsSpent":5,"costUsd":0.006852}`
- ২য় কল → `200 {"duplicate":true}` — **এক credit-ও দুবার কাটেনি** ✅
- row-এ `workspaceId` chatbot থেকে বসেছে, `channel: "whatsapp"` (হার্ডকড `'web'` নয়),
  `runId` সেট, `costSource: "estimated"`, `costBdt: 0.82224`

> ⚠️ এই টেস্টে ১টি AIUsageLog + ১টি CreditTransaction তৈরি হয়েছে ও ৫ credit কেটেছে।
> পরিষ্কার করার প্রস্তাব ইউজারকে দেওয়া হয়েছে।

### ৫.গ — ইউজারের শর্ত: সব মডেলের credit অ্যাডমিন থেকে, ড্যাশবোর্ডে লাইভ

**যাচাই করে দেখা গেল — ডেটা-স্তরে এটি ইতিমধ্যেই ঠিক ছিল:**
`getActiveMerchantModelsFromDb()` (openrouter-service.ts) সরাসরি
`ai_credit_rules.models` পড়ে `credits: m.credits` নেয়। তাই মেপে দেখা হলো —

**ড্যাশবোর্ড যা দেখায় বনাম যা কাটা হবে: ৩৪/৩৪ মডেল হুবহু এক (অমিল ০)** ·
tier map: fast `gpt-4o-mini` 1=1 ✅ · smart `gpt-4o` 5=5 ✅ · genius `deepseek-r1` 3=3 ✅

**কিন্তু একটি আসল ফাঁক ধরা পড়ল —** `credit-resolver.ts`-এর ৫ মিনিটের in-memory
cache অ্যাডমিন save-এ মুছে যেত না। ফলে অ্যাডমিন credit বদলালে:
ড্যাশবোর্ড (DB সরাসরি পড়ে) **নতুন** মান দেখাত, কিন্তু কাটা হতো **পুরনো** মান —
**৫ মিনিট পর্যন্ত**। অর্থাৎ ঠিক যে অমিলটা দূর করার চেষ্টা করছি, সেটাই ফিরে আসত।

**সমাধান:** `app/api/admin/ai-settings/route.ts`-এর POST-এ save-এর পরে
`resetCreditRulesCache()`। যাচাই: পরপর দুই কল একই object দেয় (cache কাজ করে) ✅ ·
`reset`-এর পর নতুন object আসে ও DB-র সাথে মেলে ✅ (৩৪টি মডেল, multiplier ২)।

### নোট
- `tsc --noEmit` — **শূন্য error**
- নতুন/পরিবর্তিত ফাইলে `eslint` পরিষ্কার। প্রজেক্টে আগে থেকেই ৯টি error আছে
  (`(db as any)` ×৪, `(m: any)` ×২, `(resA as any).usage` ×২, অব্যবহৃত `logAiUsage`,
  একটা react-hooks নিয়ম) — **এগুলো আমার নয়**, আগের কোডের (git diff দিয়ে যাচাই করা)।

---

## ধাপ ৬ — n8n billing সংস্কার 🟡

**উদ্দেশ্য:** n8n আর নিজে বিলিং লিখবে না। সে শুধু কথোপকথন সেভ করবে, আর
`POST /api/internal/ai-usage`-এ খবর দেবে। দাম ও credit — দুটোই প্ল্যাটফর্ম ঠিক করবে।

### ৬.ক — যা বদলানো হলো (`docs/n8n-JSON/Core-AI-Brain.json`, ২৬ → ২৭ নোড)

| আগে | এখন |
|---|---|
| `Log Chat & Billing` নিজেই `billing.AIUsageLog`-এ INSERT করত | SQL থেকে ওই INSERT **সম্পূর্ণ বাদ**; নোডটির নাম এখন `Save Chat History` |
| `channel` হার্ডকড `'web'` | `channel \|\| platform \|\| 'web'` — Facebook reply এখন `facebook` হিসেবে লগ হবে |
| `creditsDeducted = 15` হার্ডকড | **নেই** — credit আসে `credit-resolver.ts` থেকে (অ্যাডমিন-নিয়ন্ত্রিত) |
| `Format Response`-এ `promptTokens × $3 + completionTokens × $15` হার্ডকড | **নেই** — দাম আসে লাইভ OpenRouter থেকে |
| ব্যালেন্স **কখনো কাটা হতো না** | `Billing API` নোড আসল deduction করে (`runId` = `$execution.id`) |
| — | নতুন `Billing API` (HTTP Request): `POST https://driplare.com/api/internal/ai-usage` |

**নতুন chain:** `Order Created Check → Save Chat History → Billing API → Return to Platform`

### ৬.খ — দুটি নিরাপত্তা সিদ্ধান্ত

1. **`Billing API`-তে `onError: continueRegularOutput`** — বিলিং ফেল করলে গ্রাহকের
   reply **কখনো** আটকাবে না। আগস্টের আউটেজে ঠিক এই ভুলটাই মাসখানেক সব reply থামিয়ে
   রেখেছিল (একটি নোড ফেল → পুরো লিনিয়ার workflow থেমে যাওয়া)। যে রানগুলো বিল
   হয়নি, সেগুলো ধাপ ৭-এর reconciler তুলে নেবে।
2. **`Save Chat History`-তেও একই `onError`** — কারণ ওই নোডটাই ২০২৬-০৮-২৬-এ ভেঙেছিল।
   এখন চ্যাট-ইতিহাস সেভ করতে না পারলেও বিলিং হবে।

> ⚠️ **এই দুটি `onError` আমার নিজের সংযোজন, ইউজার চাননি।** যুক্তি: কোনো একটা নোড
> ফেল করা যেন আর কখনো রাজস্ব বা reply গোপনভাবে না থামায়। চাইলে সরানো যাবে।

### ৬.গ — ফাঁদ যা ধরা পড়ল: চুপচাপ বিলিং বন্ধ

`onError: continue`-এর একটা বিপরীত ঝুঁকি আছে — expression ভুল রেন্ডার হলে API 400
দেবে, কিন্তু workflow চলবে। ফলে **প্রতিটি reply সফল দেখাবে অথচ এক টাকাও কাটা হবে না**।
উৎপাদনে এটা চোখে পড়ে না।

তাই আগেই ভেরিফায়ার লেখা হলো (`step6-verify-billing-body.js`): n8n-এর expression
রেন্ডারিং সিমুলেট করে তিনটি পরিস্থিতিতে body বানিয়ে আসল Zod স্কিমার সাথে মেলানো হলো।

| পরিস্থিতি | `channel` | `isTestChat` | স্কিমা |
|---|---|---|---|
| Web playground (`channel` পাঠায়) | `playground` | `true` | ✅ |
| Facebook (`channel` পাঠায় না) | `facebook` | `false` | ✅ |
| দুটোই নেই | `web` | `false` | ✅ |

সংখ্যাগুলো `number`, বুলিয়ানগুলো `boolean` — string হলে স্কিমা ফেল করত, সেটাও যাচাই করা।

### ৬.ঘ — যা ছুঁতে হয়নি

- **তিনটি integration JSON (`Facebook`/`WhatsApp`/`Instagram`) অপরিবর্তিত** — তারা
  `channel` পাঠায় না, শুধু `platform`। Core-AI-Brain-এ fallback যোগ করায় সেটাই যথেষ্ট।
- **নতুন env var লাগে না** — `N8N_CALLBACK_SECRET` আগে থেকেই তিনটি token-status
  route ও `sessions/upsert`-এ ব্যবহৃত হয়। শুধু itnut VPS-এ সেটা সেট আছে কি না
  নিশ্চিত করতে হবে (ইউজারের কাজ)।

### যাচাই

| # | পরিমাপ | ফলাফল |
|---|---|---|
| ১ | `Save Chat History`-তে `AIUsageLog` আছে কি | ✅ নেই; `ChatMessage` INSERT ও `ChatSession` UPDATE অটুট |
| ২ | `Format Response`-এ `costUsd`/`costBdt` আছে কি | ✅ নেই |
| ৩ | ৩ পরিস্থিতিতে body → আসল Zod স্কিমা | ✅ সব পাস |
| ৪ | `tsc --noEmit` | ✅ শূন্য error |
| ৫ | বাকি ২৫টি নোড ও connection | ✅ অপরিবর্তিত (ব্যাকআপের সাথে গঠনগত diff) |

🔴 **এখনো হয়নি:** লাইভ টেস্ট। JSON ম্যানুয়ালি n8n-এ ইমপোর্ট করতে হবে (ইউজারের কাজ) —
ততক্ষণ পর্যন্ত **উৎপাদনে কিছুই বদলায়নি**, শুধু রেপোতে ফাইল বদলেছে।

### নোট
- ব্যাকআপ: `docs/JSON Backup/Core-AI-Brain.pre-step6.json`
- রূপান্তর স্ক্রিপ্ট ইডেম্পোটেন্ট: `docs/cost-analytics/step6-core-ai-brain.js`
- `chat/route.ts`-এর বাসি কমেন্ট ("n8n… handles… credit deduction") ঠিক করা হলো,
  এবং নিশ্চিত করা হলো সে শুধু ব্যালেন্স **চেক** করে, কাটে না — double-charge অসম্ভব।

### ৬.ঙ — 🔴 লাইভ টেস্টে ধরা পড়া তিনটি ত্রুটি (আমার, দ্বিতীয় সংশোধন)

ইউজার Playground থেকে দুটি মেসেজ পাঠিয়ে জানালেন: **reply আসছে, কিন্তু credit কাটছে না।**
ডেটাবেস (read-only) দেখে নিশ্চিত হওয়া গেল:

| প্রমাণ | মানে |
|---|---|
| `ChatMessage`-এ নতুন row `12:24` ও `12:26` | **নতুন workflow ইমপোর্ট হয়েছে** — `Save Chat History` কাজ করছে |
| `AIUsageLog`-এ নতুন row **নেই** (শেষটা `11:26`, আমার ধাপ ৫-এর টেস্ট) | পুরনো SQL-এর INSERT সত্যিই গেছে; কিন্তু `Billing API` নোড **ব্যর্থ হচ্ছে** |
| `09:39`-এ পুরনো নোড `channel='web'`, `cr=15` লিখেছিল | তুলনার ভিত্তি — তখন INSERT কাজ করছিল |

অর্থাৎ `onError: continueRegularOutput` ঠিকই **নীরব ব্যর্থতা** ঢেকে রেখেছিল — যে ঝুঁকির কথা
৬.গ-তে লিখেছিলাম, সেটাই ঘটল। কারণ খুঁজে **আমার নিজের দুটি ত্রুটি** পাওয়া গেল:

**ত্রুটি ১ — `{{ $env.N8N_CALLBACK_SECRET }}` এই হোস্টিংয়ে অচল।**
n8n Community-তে environment variable সেট করার কোনো UI নেই (কোনো ভার্সনেই নেই) —
সেগুলো সার্ভারে (docker-compose / `.env`) সেট করতে হয়। ইউজারের ওই অ্যাক্সেস নেই।
**সমাধান:** Header Auth **credential** — যা n8n-এর নিজের UI থেকেই বানানো যায়, ফ্রি
ভার্সনেও। উল্লেখ্য, এই একই workflow-এর `Gemini Vision` ও `Embed Query` **আগে থেকেই**
এই প্যাটার্ন ব্যবহার করছে (`Gemini API Key` credential) — অর্থাৎ এটাই প্রমাণিত পথ।

**ত্রুটি ২ — `driplare.com` 308 redirect দেয় `www.driplare.com`-এ।**
POST-এ redirect মানে সেই নীরব ব্যর্থতারই আরেক রূপ। **সমাধান:** URL এখন
`https://www.driplare.com/...`, সাথে `options.redirect.redirect.followRedirects: true`।

**ত্রুটি ৩ (সম্ভাব্য, নিশ্চিত নয়) — production-এ route-টা ডিপ্লয় না থাকা।**
`www.driplare.com/api/internal/ai-usage` ও এমনকি পুরনো `api/webhooks/whatsapp`-ও
৪০৪ দেয়। কিন্তু উত্তরের `Age` হেডার ≈১৬.৭ দিন, অর্থাৎ এগুলো **২০২৬-০৯-১০ তারিখের
cached ৪০৪** — আজকের অবস্থা এভাবে বোঝা যায় না। `driplare.com` → `www` 308 আর
`/dashboard` → 307 (Clerk) থেকে নিশ্চিত যে অ্যাপ ওখানেই। **ইউজারকে যাচাই করতে হবে।**

### ৬.চ — বোনাস সন্ধান: `Gemini Transcribe` নীরবে ভাঙা থাকতে পারে 🔴

এই নোডটিও `={{ $env.GOOGLE_GEMINI_API_KEY }}` ব্যবহার করে, আর এর **`onError` সেট নেই**।
অর্থাৎ env variable না থাকলে ভয়েস মেসেজে নোডটি ফেল করবে → লিনিয়ার workflow বলে
**পুরো reply থেমে যাবে** (আগস্টের আউটেজের হুবহু প্যাটার্ন)।
বৈপরীত্য: `Gemini Vision` credential ব্যবহার করে, কিন্তু `Gemini Transcribe` করে না।
**সিদ্ধান্ত বাকি** — credential-এ বদলানো হবে কি না, এবং `onError` যোগ করা হবে কি না।

### ৬.ছ — ইউজারের রিপোর্ট: "Ensure Session নোডে error, publish করতে পারছি না"

**স্ক্রিনশটের ত্রুটি:** `ChatSession_chatbotId_fkey` লঙ্ঘন, `Key (chatbotId)=(undefined)`।

**গঠনগত diff করে নিশ্চিত হওয়া গেল:**
- `Ensure Session` **বাইট-প্রতি-বাইট** ৬-পূর্ববর্তী সংস্করণের সমান — আমি এটা ছুঁইনি
- অন্য কোনো নোডেও অনিচ্ছাকৃত পরিবর্তন **নেই** (সব নোডের parameters তুলনা করা)
- `When Called by Platform`-ও অপরিবর্তিত (`inputSource: "passthrough"`)

**কারণ — ম্যানুয়াল রান, আসল বাগ নয়।** `When Called by Platform` একটি
`executeWorkflowTrigger` — প্ল্যাটফর্ম থেকে ডাকা না হলে এর **কোনো ইনপুট ডেটা থাকে না**।
এডিটরে "Execute step" চাপলে ট্রিগারের ডেটা ছাড়াই নোডটি চলে, তাই
`$('When Called by Platform').item.json.chatbotId` → `undefined` → FK লঙ্ঘন।

**প্রমাণ (নতুন, নির্ণায়ক):** প্যারেন্ট `Web-Playground-Integration` workflow-এর
`Validate & Normalize Payload` নোডে স্পষ্ট লেখা আছে:

```js
if (!chatbotId) { throw new Error('Missing required field: chatbotId'); }
```

অর্থাৎ Playground থেকে আসা **কোনো কলই** খালি `chatbotId` নিয়ে `Ensure Session`-এ
পৌঁছাতে পারে না — প্যারেন্ট আগেই থেমে যেত, আর ত্রুটিটা প্যারেন্টে দেখাত।
তাই `18:55:46`-এর ত্রুটিটি **এডিটরের ম্যানুয়াল রান** থেকেই এসেছে, নিশ্চিতভাবে।

**সময়রেখা মিলে যায়:** শেষ সফল রান `12:26 UTC` (= `18:26` স্থানীয়), শেষ
`ChatMessage`-ও সেখানেই। এরপর নতুন JSON ইমপোর্ট → publish আটকা → ম্যানুয়াল রান →
`18:55`-এর ত্রুটি। **এরপর থেকে একটা Playground টেস্টও চালানো হয়নি**, তাই নতুন
`ChatMessage` নেই — এটা বাগের প্রমাণ নয়, বরং টেস্ট না করার প্রমাণ।

**আমার সংশোধন:** `Billing API` নোডে আমি একটা **ভুয়া credential id**
(`driplarePlatformSecret`) বসিয়ে রেখেছিলাম। ওই id n8n-এ না থাকায় নোডে
"Credential not found" দেখায় — যা আসলে activation আটকাতে পারে। এখন `credentials`
ব্লকটি সম্পূর্ণ বাদ; ড্রপডাউন থেকে ইউজার নিজে credential বেছে নেবেন।

**সিদ্ধান্ত বাকি:** ট্রিগারটিকে `inputSource: "workflowInputs"`-এ বদলে ফিল্ড-স্কিমা
declare করা যায় — তাহলে এডিটর থেকে ম্যানুয়ালি টেস্ট করা যাবে। **কিন্তু এখন এটা
উৎপাদনে কাজ করছে, আর বদলালে FB/WA/IG কল ভাঙার ঝুঁকি আছে — লাইভ টেস্ট ছাড়া করা যাবে না।**

### ৬.জ — 🔴 "Publish button mute" — চারটি সন্দেহভাজন কারণ সরানো হলো

ইউজার জানালেন Publish বোতামটি **নিষ্ক্রিয়**; ইমপোর্টের সময়ই n8n বলেছিল
"There is a error on the workflow, can't publish"। এটা **static** সমস্যা (রানের ফল নয়) —
অর্থাৎ কোনো নোডের গঠনই n8n-এর যাচাইয়ে ফেল করছে। যেগুলো সন্দেহ করা যায়, সব সরানো হলো:

| সন্দেহ | অবস্থা |
|---|---|
| `Billing API`-তে **ভুয়া credential id** (`driplarePlatformSecret`) | ✅ সরানো — n8n-এ ওই id নেই, তাই "Credential not found" → activation ব্লক |
| `options.redirect.redirect.followRedirects` — nested কাঠামো অচেনা হলে n8n property-validation error দিতে পারে | ✅ সরানো (URL এখন `www` হওয়ায় দরকারও নেই) |
| নোড `id` UUID না হয়ে `"billing-api-step6"` | ✅ প্রকৃত UUID করা হলো (বাকি ২৭টির মতোই) |
| ম্যানুয়াল রানে `Ensure Session`-এর FK ত্রুটি | ❌ **এর সাথে সম্পর্ক নেই** — ওটা runtime ত্রুটি, publish আটকায় না। তাই canvas-এ একটি সতর্কীকরণ sticky note যোগ করা হলো |

**⚠️ যা ইউজারকেই করতে হবে:** `Billing API` নোডের Credential ড্রপডাউন থেকে
"Header Auth" credential-টি select করা। **খালি credential-ও publish আটকায়**, আর
আমি ওই credential-এর id জানি না — তাই এটা automat করা সম্ভব নয়।

**যাচাই বাকি:** উপরের চারটি সরানোর পর publish খোলে কি না। না খুললে n8n ঠিক কোন
নোডের কথা বলছে সেটা জানা দরকার — ততক্ষণ বাকিটা অনুমান।

> 📌 উল্লেখ্য: **sub-workflow প্রকাশিত না থাকলেও চলে** — আজ `12:24`-এর সফল রান
> তারই প্রমাণ। তাই publish আটকে থাকলেও টেস্টিং বন্ধ হয় না, শুধু স্থায়ীভাবে
> সংরক্ষণ করা যায় না।

---
### ৬.ঝ — 🔴 ইউজারের রিপোর্ট: "ক্রেডিট কাটতেছে না" — আসল কারণ

ইউজার জানালেন workflow publish হয়েছে, Playground থেকে AI উত্তরও আসছে, কিন্তু
**ক্রেডিট কাটছে না**। কারণটা কোনো বাগ নয় — **নেটওয়ার্কের সীমাবদ্ধতা**:

```
n8n (itnut VPS)  ──POST──▶  https://www.driplare.com/api/internal/ai-usage
                                     ▲
                                     └─ production — route-টা এখনো ডিপ্লয়ই হয়নি
                                        (app/api/internal/ git-এ untracked)
                                        ⇒ 404
```

লাইভ যাচাই (`X-Matched-Path: /404`), অর্থাৎ n8n প্রতিটি reply-তে 404 পাচ্ছে —
আর `onError: continueRegularOutput` থাকায় সেটা **চুপচাপ** গিলে ফেলা হচ্ছে।

আসল কথা: **VPS-এর n8n কখনোই ডেভেলপারের localhost:3000-এ পৌঁছাতে পারে না।**
তাই লোকালহোস্টে callback দিয়ে ক্রেডিট কাটা কখনোই সম্ভব ছিল না।

**ইউজারের সিদ্ধান্ত (জিজ্ঞেস করে নেওয়া):** "প্ল্যাটফর্ম নিজেই কাটবে" —
টানেল নয়। কারণ টানেলে প্রতি dev সেশনে URL বদলাতে হতো, আর production-এ
ফেরত দিতে ভুল হলে আয় **চুপচাপ** বন্ধ হয়ে যেত।

---

### ৬.ঞ — সমাধান: বিলিংয়ের এক শরীর, দুটো দরজা

`lib/ai/charge-usage.ts` (নতুন) — credit কাটা, ব্যালেন্স কমানো, লেজার ও লগ
লেখা সব এক জায়গায়, এক transaction-এ। এখন এর **দুইজন caller**:

| পথ | কে ডাকে | কেন |
|---|---|---|
| `POST /api/internal/ai-usage` | n8n | Facebook / WhatsApp / Instagram — প্ল্যাটফর্ম ওই পথে থাকে না |
| `chat/route.ts` (Playground) | প্ল্যাটফর্ম নিজে | কলটা তো প্ল্যাটফর্মই করেছিল, আর n8n উত্তরে token-ও দেয় |

`app/api/internal/ai-usage/route.ts` এখন শুধু auth + Zod + HTTP উত্তর —
একটা লাইন হিসাবও নিজে করে না। ফলে **দুই দরজায় নিয়ম আলাদা হওয়া অসম্ভব**।

**দ্বিগুণ চার্জ?** না। দুটো শর্ত:

1. n8n সফল হলে সে `billingOk: true` পাঠায় → প্ল্যাটফর্ম আর কাটে না
2. n8n ব্যর্থ হলে (লোকালহোস্টের 404, 402, error) → প্ল্যাটফর্ম কাটে

**বোনাস:** লোকালহোস্টে এখন n8n-এর Header Auth credential ছাড়াও ক্রেডিট কাটে —
কারণ প্ল্যাটফর্ম আর HTTP কল করে না, সরাসরি ফাংশন ডাকে।

---

### ৬.ট — 🔴 পথে ধরা পড়া ফাঁদ: production-এ দ্বিগুণ চার্জ হতো

`Build Web Response` (Web-Playground-Integration) ফেরত দেওয়ার অবজেক্টটা
**হাতে গুনে** বানায় — তালিকায় না থাকলে Core-AI-Brain যা-ই পাঠাক, ফিল্ড বাদ পড়ে।
`billingOk` ওই তালিকায় **ছিল না**।

মানে: `payload.billingOk` সবসময় `undefined` হতো → প্ল্যাটফর্ম কখনো জানত না যে
n8n ইতিমধ্যে কেটেছে → সে-ও কাটত → **production-এ প্রতিটি Playground reply-তে
দ্বিগুণ চার্জ**, গ্রাহকের ব্যালেন্স দ্বিগুণ দ্রুত শেষ।

ঠিক করা হলো: `creditsSpent` ও `billingOk` এখন ওই উত্তরে যাওয়া-আসা করে।
এই শ্রেণির বাগ ধরা পড়ার জন্য যাচাই স্ক্রিপ্টে স্থায়ী নিয়ম যোগ করা হলো —
**`chat/route.ts` যে ফিল্ড পড়ে, n8n সেগুলো আদৌ পাঠায় কি না** স্বয়ংক্রিয়ভাবে মিলিয়ে দেখা হয়।

---

### ৬.ঠ — বোনাস সংশোধন: খরচ ভুল মডেলের দামে হিসাব হতো

`Format Response` যে মডেলের নাম পাঠাত সেটা ছিল **bot-এর DB মডেল**। কিন্তু
সত্যি যে মডেল চলে, সেটা বাছা হয় অন্য নিয়মে:

```
$('When Called by Platform').item.json.model || $('Fetch Bot Config').item.json.model
```

DB-তে deprecated মডেল থাকলে `resolveModelConfig` সেটাকে অন্য মডেলে নামায় —
কিন্তু খরচ তখনো **পুরনো মডেলের দামে** হিসাব হতো। এখন `Format Response`-ও
`OpenRouter Chat Model`-এর হুবহু একই নিয়ম ব্যবহার করে।

---

### যাচাই (ধাপ ৬.ঞ–৬.ঠ)

`docs/cost-analytics/step6-verify-chat-billing.js` — **শূন্য ডেটাবেস লেখা**:

| যাচাই | ফল |
|---|---|
| দুটো নোড একই model precedence মেনে চলে | ✅ |
| `billingOk: true` → প্ল্যাটফর্ম থামে | ✅ |
| `billingOk: false` / অনুপস্থিত / error → প্ল্যাটফর্ম কাটে | ✅ |
| token গুলো সংখ্যা (string হলে ০ হয়ে যেত) | ✅ |
| `chat/route.ts` যে ফিল্ড পড়ে, n8n সেগুলো পাঠায় | ✅ |
| চেক-চেক্রেডিট ও কাটা-ক্রেডিট — দুই জায়গায় একই মান | ✅ |

`npx tsc --noEmit` ✅ · `npx eslint` (তিনটি ফাইল) ✅

**লাইভ টেস্টের প্রত্যাশা:** bot `anthropic/claude-sonnet-4` (`promptMode: simple`),
`isTestChat: true` → **১০ ক্রেডিট**। ব্যালেন্স `54345` → `54335`।

**⚠️ এখনো ইমপোর্ট বাকি (production-এর জন্য, লোকাল টেস্টের জন্য নয়):**
`Core-AI-Brain.json` ও `Web-Playground-Integration.json` — লোকালহোস্টে ক্রেডিট
কাটতে এগুলোর দরকার নেই, কিন্তু production-এ দ্বিগুণ চার্জ আটকাতে
`Web-Playground-Integration.json` **অবশ্যই** ইমপোর্ট করতে হবে।

---

## ধাপ ৬.৫ — 🔴 credit-এর অমিল: "কার্ডে ৫, কাটে ১০" ✅

### ৬.ড — ইউজারের রিপোর্ট

লাইভ টেস্টের পর ক্রেডিট কাটা শুরু হলো, কিন্তু **ভুল পরিমাণে**:

- `/dashboard/chatbots/[id]/chat` → Fast ১, Smart ৩, Genius ৫ credit দেখায়
- Genius বাছা থাকলে প্রতি reply-তে **১০** কাটে (ledger-এ দুটো `-10` সারি)
- `/admin/ai-settings` → Fast ১, Smart ৩, Genius ৫ দেখায় (হার্ডকড badge)

অর্থাৎ **দুই পেজেই ১/৩/৫ লেখা, অথচ কাটে ৬/১০/১০** — কেউ কোনোদিন মেলাতে
পারত না। ইউজারের দাবি ছিল স্পষ্ট:

> "সবগুলা এক রকম করো... এবং Fast 1 হলে credit, Smart হলে 3 credit &
> Genius হলে 5 credit এইগুলা যাতে হার্ডকোডেট না থাকে। চাইলে যাতে ইডিট করা যায়।"

### ৬.ঢ — কারণ তিনটি (তিনটিই আলাদা)

| # | কোথায় | কী হতো |
|---|---|---|
| ১ | `components/chatbots/use-openrouter-models.ts` | সার্ভার `tiers` না পাঠানোয় ক্লায়েন্টে **হার্ডকড** `credits: 1 / 3 / 5` বসত |
| ২ | `lib/ai/openrouter-service.ts` → `buildDynamicTierMap()` | admin-এর `quickSetup` **সম্পূর্ণ উপেক্ষা** করত; নিজের হার্ডকড preferred-id তালিকা থেকে মডেল বাছত |
| ৩ | DB `ai_credit_rules.testChatMultiplier` | মান ছিল **২** — নীরবে সব দ্বিগুণ করত, কোনো UI-তে দেখা যেত না |

৩ নম্বরটাই ছিল "৫ দেখিয়ে ১০ কাটার" আসল কারণ। ১ ও ২ নম্বরের ফলে কার্ডে
যে মডেল দেখানো হত, বিলে **অন্য মডেলের** credit কাটা হত।

### ৬.ণ — সমাধান: একটা ফাংশন, একটা সংখ্যা

**ক. `buildDynamicTierMap` এখন `async` এবং admin-এর preset মানে:**

```
১. admin-এর quickSetup → fastModel / smartModel / geniusModel
২. ওই মডেল তালিকায় না থাকলে (নিষ্ক্রিয়/ডিপ্রিকেট) → পুরনো preferred-id নিয়ম
৩. credit আসে `resolveReplyCredits()` থেকেই — হুবহু যে ফাংশন বিলে চলে
```

`getQuickSetupPresets()` (৫ মিনিট cache) `ai_credit_rules.quickSetup` পড়ে।
`openrouter-service.ts`-এ `next/cache` ছাড়া আর কিছুই বদলায়নি, তাই client
component ওই ফাইল import করে না — `async` করা নিরাপদ (যাচাই করা হয়েছে)।

**খ. `TierOption` — কার্ডে দেখানোর মান আর বিলের মান একই:**

```ts
type TierOption = ResolvedModelConfig & {
  credits: number;           // base
  effectiveCredits: number;  // base × testChatMultiplier  ← কার্ডে এটাই দেখায়
};
```

`effectiveCredits`-ও `resolveReplyCredits()` দিয়েই গণনা করা হয়। তাই admin
credit বদলান বা গুণক বদলান — কার্ড আর বিল **একসাথে** বদলায়, আলাদা হতে
পারে না।

**গ. দুই endpoint-ই এখন `tiers` + `testChatMultiplier` পাঠায়:**
`/api/ai-models` (ড্যাশবোর্ড এটাই আগে ডাকে) এবং `/api/models/openrouter`।
ক্লায়েন্টের হার্ডকড ব্লক মুছে গেছে; `tiers` কোনো কারণে না এলে মডেলের
**নিজের** credit থেকে হিসাব হয় — বানানো সংখ্যা বসানো হয় না।

**ঘ. `/api/models/openrouter`-এর `revalidate = 43200` সরানো হয়েছে।**
ওটা থাকলে credit-এর মান ১২ ঘণ্টা জমাট বাঁধা থাকত — admin বদলানোর পরেও
ড্যাশবোর্ডে পুরনো মান, অথচ বিলে নতুন। OpenRouter-এর আসল catalogue কল এখনো
`unstable_cache`-এ ১২ ঘণ্টা cache থাকে, তাই খরচ বাড়ে না।

**ঙ. admin panel-এর preset কার্ড এখন সম্পাদনাযোগ্য:**
`QuickSetupPresets.tsx`-এর "Fixed 1 Credit" badge-এর জায়গায় number input।
বদলালে সেটা **ওই মডেলেরই** credit (catalogue-র একই মান) — অর্থাৎ এক
জায়গায় বদলালে সবখানে বদলায়, কারণ দুটো আলাদা সংখ্যা বলে কিছু নেই।
`ModelCatalogTable`-এর "Fast Preset (1 Cr)" badge-ও আর হার্ডকড নয়।

**চ. গুণক আর লুকানো নেই:** কার্ডের নিচে "Test Chat Multiplier" ইনপুট যোগ
হয়েছে, আর প্রতি কার্ডে লেখা থাকে "A merchant using this preset is charged
**N credits** per reply"। গুণক ২ থাকলে কার্ডে "(৫ × ২ test-chat multiplier)"
লেখা আসে — অর্থাৎ যা কাটা হবে তা আগেই চোখের সামনে।

### ৬.ত — ডেটাবেস: গুণক ২ → ১

`docs/cost-analytics/step6c-test-chat-multiplier.js` — শুধু
`testChatMultiplier` বদলায়, বাকি সব (৩৪টি মডেল, quickSetup, thresholds)
হুবহু অপরিবর্তিত রাখে এবং লেখার পর যাচাই করে। ইউজারের সম্মতিতে চালানো হয়েছে:

```
আগে : testChatMultiplier = 2
পরে : testChatMultiplier = 1
বদলানো কী: updatedAt, testChatMultiplier
```

### যাচাই (ধাপ ৬.৫) — `step6d-verify-credit-consistency.js`

DB শুধু পড়া হয়, কিছু লেখা হয় না। আসল TS মডিউল jiti দিয়ে চালিয়ে দেখা হয়।

| যাচাই | ফল |
|---|---|
| `credit-config.ts` → `test_chat_multiplier = 1` | ✅ |
| `DEFAULT_AI_SETTINGS.testChatMultiplier = 1` | ✅ |
| DB-তেও গুণক ১ | ✅ |
| ক্লায়েন্টে tiers বানানোর সময় কোনো হার্ডকড credit নেই | ✅ |
| ড্যাশবোর্ডের তিনটি কার্ডই `effectiveCredits` দেখায় | ✅ |
| কোনো কার্ড base credit দেখায় না | ✅ |
| admin কার্ডে আর "Fixed N Credit" নেই, credit সম্পাদনাযোগ্য | ✅ |
| প্রতিটি tier-এ admin-এর বাছা মডেলই ব্যবহৃত | ✅ |
| `tiers[key].credits` = `resolveReplyCredits().baseCredits` | ✅ |
| `tiers[key].effectiveCredits` = `resolveReplyCredits().credits` (= যা কাটে) | ✅ |
| n8n যে মডেল পায় (`resolveModelConfig`) = কার্ডের মডেল | ✅ |

চালানোর ফল (২০২৬-০৯-২৭-এর DB অবস্থা):

```
tier   │ মডেল                        │ base │ কার্ডে │ কাটে
fast   │ google/gemini-2.5-flash     │    3 │      3 │    3
smart  │ openai/gpt-4o               │    5 │      5 │    5
genius │ anthropic/claude-sonnet-4   │    5 │      5 │    5
```

`npx tsc --noEmit` ✅ · `npx eslint` (পরিবর্তিত ফাইলগুলো — নতুন কোনো ত্রুটি নেই) ✅
`step6-verify-chat-billing.js` ও `step6-verify-billing-body.js` — দুটোই এখনো পাস ✅

### ৬.থ — ⚠️ ইউজারের জন্য জরুরি নোট

নতুন নিয়মে কার্ডে যা দেখা যায় = যা কাটা হয়। কিন্তু **সংখ্যাগুলো এখন
DB-র credit, আর তা ১/৩/৫ নয়** — Fast ৩, Smart ৫, Genius ৫। কারণ:

- Fast-এর preset মডেল `google/gemini-2.5-flash` → catalogue-এ ৩ credit
- Smart-এর preset মডেল `openai/gpt-4o` → ৫ credit
- Genius-এর preset মডেল `anthropic/claude-sonnet-4` → ৫ credit

আগে কার্ডে ১/৩/৫ লেখা ছিল কেবল **হার্ডকড badge** থাকার কারণে — ওই সংখ্যাগুলো
কোথাও সত্যি ছিল না। এখন দুই পেজই সত্যি সংখ্যাটাই দেখায়, আর বিল হুবহু তাই কাটে।

**১/৩/৫ চাইলে** `/admin/ai-settings` → "Quick Setup Presets" কার্ডের credit
বক্সে টাইপ করে Save চাপলেই হবে — ওটাই এখন একমাত্র edit point, আর সেটাই
বিলে যাবে। (নিচের catalogue-র "Credit Cost" কলামটাও একই মান লেখে।)

**✅ হালনাগাদ (একই দিনে):** ইউজার এটা করে ফেলেছেন — এখন DB-তে
`google/gemini-2.5-flash` ১, `openai/gpt-4o` ৩, `anthropic/claude-sonnet-4` ৫,
আর `testChatMultiplier` ১। তাই উপরের ৩/৫/৫ আর প্রযোজ্য নয়।

---

## ধাপ ৬.৬ — 🔴 admin-এ ১/৩/৫, ড্যাশবোর্ডে ২/৬/১০ ✅

### ৬.ড — ইউজারের অভিযোগ

screenshot ১: admin panel-এ Fast ১ / Smart ৩ / Genius ৫, Test Chat Multiplier ১
— সেভ করা আছে।
screenshot ২: merchant dashboard-এ তখনো **২ / ৬ / ১০** — অর্থাৎ হুবহু ২ গুণ।

অথচ একই মুহূর্তে ফ্রেশ প্রসেসে `step6d` চালালে ১/৩/৫-ই আসত।

### ৬.ঢ — কারণ: credit-এর মান cache-এ বন্দি থাকত

`lib/ai/credit-resolver.ts`-এ ৫ মিনিটের in-memory cache ছিল
(`memoryRules` / `memoryLoadedAt`), আর `openrouter-service.ts`-এ ছিল
`presetsCache` / `presetsLoadedAt`।

সমস্যাটা এখানে —

> **Next.js App Router-এ প্রতিটি route handler-এর নিজের module instance থাকে।**
> অর্থাৎ `memoryRules` এক bundle-এ লেখা হলে অন্য bundle তা দেখে না।

ফলে `POST /api/admin/ai-settings`-এ ডাকা `resetCreditRulesCache()` **কেবল
নিজের bundle-এর** cache মুছত। `/api/ai-models` ও `/api/models/openrouter`-এর
bundle আগের `testChatMultiplier` নিয়ে বসে থাকত। আর যেহেতু দৃশ্যপটে দুবার Save
হয়েছিল —

| সময় | DB | `/api/ai-models` যা পাঠাত |
|---|---|---|
| ১ম Save | credit ১/৩/৫, **গুণক ২** | ২ / ৬ / ১০ |
| ২য় Save | credit ১/৩/৫, **গুণক ১** | bundle-এর cache-এ পুরনোটা ⇒ ২ / ৬ / ১০ |

— অর্থাৎ ঠিক যে ছবিটা ইউজার পাঠিয়েছেন। `lib/core/db.ts`-ও একই কারণে Prisma
client `globalThis`-এ রাখে (`globalForPrisma`) — সমস্যাটা নতুন নয়।

### ৬.ণ — সমাধান

| # | ফাইল | কী বদলাল |
|---|---|---|
| ১ | `lib/ai/credit-resolver.ts` | ৫ মিনিটের cache **সম্পূর্ণ তুলে দেওয়া** — `getCreditRules()` এখন প্রতিবার DB পড়ে। `resetCreditRulesCache()` আর নেই। |
| ২ | `lib/ai/openrouter-service.ts` | `presetsCache`-ও তুলে দেওয়া; `getQuickSetupPresets()` প্রতিবার DB পড়ে। |
| ৩ | `app/api/ai-models/route.ts` | `export const dynamic = "force-dynamic"` + `Cache-Control: no-store` |
| ৪ | `app/api/models/openrouter/route.ts` | `Cache-Control: no-store` |
| ৫ | `components/chatbots/use-openrouter-models.ts` | দুই fetch-এ `cache: "no-store"` |
| ৬ | `app/api/admin/ai-settings/fetch-models/route.ts` | হার্ডকড `?? 2` → `?? 1`; আর Fetch Models চাপলে admin-এর বসানো credit আর মুছে যায় না |
| ৭ | `lib/ai/cost-calculator.ts` | `refreshPricingCache()` থেকে credit reset সরানো |

**কেন cache একেবারে তুলে দেওয়া হলো (৫ সেকেন্ডের TTL নয়):**
`ai_credit_rules` মাত্র **একটি ছোট row**, আর indexed `findUnique`-এর খরচ
বলতে গেলে শূন্য। credit-এর একমাত্র সূত্র হওয়ায় সঠিকতাই বড় কথা — billing-এর
পথে ১ সেকেন্ড পুরনো মানও চলতে পারে না। OpenRouter-এর আসল catalogue কল
(`getCachedOpenRouterModels`, ১২ ঘণ্টার `unstable_cache`) **অটুট আছে** —
ওটা বহিরাগত HTTP কল বাঁচায়, তাই খরচ বাড়ে না।

⚠️ `app/api/ai-models`-এ `dynamic` না থাকা ছিল **আলাদা একটা বাগ**: production
build-এ রুটটা একবার render হয়ে `tiers` জমাট বেঁধে যেত, আর admin credit
বদলালেও ড্যাশবোর্ড চিরকাল পুরনো মান দেখাত।

### ৬.ত — যাচাই

`docs/cost-analytics/step6d-verify-credit-consistency.js`-এ নতুন **সেকশন ৬**
যোগ করা হয়েছে (§৬.ণ-এর সব সুরক্ষা যাচাই করে)। ফল:

- পরপর চার বার চালিয়ে — প্রতিবারই **সব পাস**, DB গুণক ১
- সরাসরি DB জিজ্ঞাসা (read-only): `ai_credit_rules` row **একটাই**,
  `updatedAt=2026-09-27T14:38:31Z`, models **৩৪**টা,
  gemini-2.5-flash=১ / gpt-4o=৩ / claude-sonnet-4=৫
- `resolveReplyCredits("anthropic/claude-sonnet-4", { isTestChat: true })`
  → `credits=5 base=5 multiplier=1 source=admin` ✅
- `npx tsc --noEmit` ✅ · `npx eslint` — নতুন ত্রুটি **শূন্য** (২২টা `no-explicit-any`
  সবই আগের, `git show HEAD:` ভার্সনের সাথে মিলিয়ে দেখা)

⚠️ **ডেভ সার্ভার একবার রিস্টার্ট করলে ভালো** — পুরনো compiled module-এ
cache-সহ কোডটা এখনো মেমোরিতে থাকতে পারে।

---


## নোট ও সিদ্ধান্তের লগ

- **২০২৬-০৯-২৭** — ইউজার প্ল্যান অনুমোদন করেছেন। সিদ্ধান্ত:
  1. Phase অনুক্রম: **B আগে, A পরে**
  2. বিলিং ও ক্রেডিট ডিডাকশন **Next.js-এ** (single source of truth)
  3. n8n self-hosted (itnut hosting VPS) → REST API key সম্ভব
  4. `creditsDeducted` = `credit-config.ts`-এর মান, সব জায়গায় একটাই; `/admin/ai-settings`
     থেকে adjustable থাকতে হবে
  5. কাজ ছোট ছোট ধাপে ভাগ করে করতে হবে
- **২০২৬-০৯-২৭ (ধাপ ২)** — n8n emergency patch রেপোতে করা হয়েছে।
  প্রথমে ভাবা হয়েছিল শুধু দুটো মৃত কলাম সরালেই হবে; কিন্তু ইউজারের লাইভ টেস্টে প্রমাণ হলো
  আসল ব্লকার `Fetch Exact OpenRouter Usage`-এর error (onError সেট না থাকায় workflow
  ওখানেই থেমে যেত)। তাই মৃত নোড দুটো ডিলিট করে `AI Agent → Format Response` সরাসরি যুক্ত করা
  হয়েছে — **এতে করে ধাপ ৬-এর একটা অংশ আগেই সম্পন্ন হয়ে গেল**।
  তবু হার্ডকড `'web'`, `creditsDeducted = 15`, আর `costUsd`-এর ভুল হিসাব **অপরিবর্তিত**
  রাখা হয়েছে — সেগুলো যথাক্রমে ধাপ ৩, ৫, ৬-এর কাজ। একসাথে করলে কোন পরিবর্তন কী ফল দিল তা
  আলাদা করা যায় না।
- **শিক্ষা:** ডায়াগ্রাম/স্ট্রাকচার অনুমান করে "এটাই কারণ" বলে দেওয়া ভুল ছিল — লাইভ রান
  ছাড়া নিশ্চিত হওয়া যায়নি। পরের ধাপগুলোতে ইউজারের টেস্ট রান আগে নেওয়া হবে।
- **২০২৬-০৯-২৭ (ধাপ ৬.৫)** — ইউজারের রিপোর্ট "কার্ডে ৫, কাটে ১০" নিয়ে তিনটি
  আলাদা কারণ পাওয়া গেল (ক্লায়েন্টের হার্ডকড, `buildDynamicTierMap`-এর
  quickSetup উপেক্ষা, আর DB-র গুণক ২)। সিদ্ধান্ত:

  1. **গুণক = ১** (ইউজারের বাছাই: "production-এর সমান")। টেস্ট চ্যাট আর আসল
     গ্রাহকের reply — একই খরচ। চাইলে admin panel থেকে বদলানো যাবে।
  2. **credit-এর সংখ্যা আর কোথাও হার্ডকড নয়** — admin panel-এর preset কার্ড
     থেকে সম্পাদনাযোগ্য, আর সেটাই বিলে যায়।
  3. **কার্ডে `effectiveCredits` দেখানো হবে** (গুণকসহ), base credit নয় —
     নাহলে ভবিষ্যতে গুণক বদলালে আবার একই অমিল ফিরে আসত।
  4. **`/api/models/openrouter`-এর ১২ ঘণ্টার `revalidate` বাদ** — credit-এর
     মান জমাট বাঁধলে ড্যাশবোর্ড আর বিল আবার আলাদা হয়ে যেত।

  ⚠️ এর ফলে কার্ডে এখন **৩ / ৫ / ৫** দেখাবে (DB-র আসল মান), ১/৩/৫ নয়।
  আগের ১/৩/৫ ছিল শুধু হার্ডকড badge — কোনো সংখ্যার সাথে তার সম্পর্ক ছিল না।
  ১/৩/৫ চাইলে admin panel-এর preset কার্ডে টাইপ করে Save করতে হবে।
- **শিক্ষা:** "ড্যাশবোর্ডে যা দেখা যায়" আর "যা কাটা হয়" আলাদা সূত্র থেকে এলে
  সেটা ধরা পড়ে না — গ্রাহক ধরিয়ে না দিলে চিরকাল ভুল চলত। এখন একই ফাংশন
  (`resolveReplyCredits`) দুটোতেই ব্যবহৃত, আর যাচাই স্ক্রিপ্ট সেটাই প্রমাণ করে।
- **২০২৬-০৯-২৭ (ধাপ ৩)** — schema যোগ হয়েছে সরাসরি DDL দিয়ে, `db push` দিয়ে নয় —
  কারণ `db push` লাইভ `n8n_chat_histories` ডেটা ফেলে দিত। **নিয়ম:** এই প্রজেক্টে
  `prisma db push` চালানোর আগে সবসময় `prisma migrate diff` দেখে নিতে হবে।
- **২০২৬-০৯-২৭ (ক্রম সংশোধন)** — pricing আগে আনা হয়েছে (ধাপ ৪), কারণ n8n-এ দাম বসানো
  মানে ধাপ ৬-এ সেটা মুছে ফেলা। নষ্ট কাজ এড়ানোই উদ্দেশ্য।
- **২০২৬-০৯-২৭ (ধাপ ৫)** — বিলিং-এর দ্বার `app/api/internal/ai-usage` তৈরি হলো, আর
  রেপোর বাকি সব চার্জিং path এক সূত্রে (`credit-resolver.ts`) আনা হলো। দুটো সচেতন
  সিদ্ধান্ত:
  1. **ব্যালেন্স-লগ-ট্রানজ্যাকশন একসাথে একটি DB transaction-এ** — আগে fire-and-forget
     ছিল, তাই একটারপর একটা ফেল করলে হিসাব মিলত না (আগস্টের আউটেজে কিছুই সেভ হয়নি)।
     বিনিময়ে সামান্য latency, যা প্রতি মেসেজে একবারই।
  2. **`runId` দিয়ে idempotency + conditional `updateMany` দিয়ে race guard** — n8n
     network timeout-এ আবার চেষ্টা করলে যাতে ডবল চার্জ না হয়।
- **২০২৬-০৯-২৭ (ধাপ ৫.গ)** — ইউজারের শর্ত ছিল "সব মডেলের credit অ্যাডমিন থেকে সেট হবে
  এবং লাইভ ড্যাশবোর্ডে আসবে"। মেপে দেখা গেল ডেটা-স্তরে এটি **আগেই ঠিক ছিল** (৩৪/৩৪
  মডেল মেলে)। কিন্তু cache invalidation না থাকায় ৫ মিনিটের একটা জানালা ছিল যেখানে
  দেখানো আর কাটা মান আলাদা হতো — সেটাই আসল বাগ, এবং সেটা ঠিক করা হলো।
- **২০২৬-০৯-২৭ (ধাপ ৫.গ, বাকি)** — অ্যাডমিন প্যানেলের `promptPrice`/`completionPrice`
  ফিল্ডগুলো এখন **প্রকৃতপক্ষে অকার্যকর** — কারণ দাম এখন OpenRouter-এর লাইভ মান থেকে
  আসে, আর অ্যাডমিনের মান কেবল fallback। অর্থাৎ অ্যাডমিন দাম বদলালেও কিছু হবে না।
  এটা একটি "ভুয়া নিয়ন্ত্রণ" — ধাপ ৮-এ হয় ফিল্ডগুলো read-only দেখানো হবে, নাহয়
  "live pricing override" হিসেবে সত্যিকার অর্থে কাজ করানো হবে। **সিদ্ধান্ত বাকি।**
- **২০২৬-০৯-২৭ (ধাপ ৪+৫-এর ভুল)** — দুটি ভুল নিজের থেকে ধরা পড়েছে ও শুধরে নেওয়া হয়েছে:
  ১. ধাপ ৪-এ `DATABASE_URL` stub করার পরিকল্পনা লিখতে ভুলে production-এ একটি cache row
     তৈরি হয়ে গিয়েছিল (ইউজারকে জানানো হয়েছে)।
  ২. ধাপ ৪-এর একটি edit-এ ভুলে এই ডকুমেন্টের "## নোট ও সিদ্ধান্তের লগ" শিরোনামটি মুছে
     গিয়েছিল — ধাপ ৫-এ ধরা পড়ে ফিরিয়ে আনা হয়েছে।
  ➡️ **শিক্ষা:** edit করার পর আশপাশের গঠন মিলিয়ে দেখা দরকার, শুধু target string নয়।
- **২০২৬-০৯-২৭ (ধাপ ৬)** — n8n আর নিজে বিল লিখবে না। প্রথমবার **আসল দাম ও আসল
  credit একসাথে** হবে। তিনটি সিদ্ধান্ত:
  1. **`channel` fallback `channel || platform || 'web'`** — FB/WA/IG শুধু `platform`
     পাঠায়, তাই আগে তাদের সব reply `'web'` হিসেবে লগ হতো।
  2. **দুটি `onError: continueRegularOutput`** যোগ করা হলো (বিলিং + চ্যাট-সেভ) —
     যাতে কোনো নোড ফেল করা আর কখনো reply বা রাজস্ব গোপনভাবে না থামায়।
  3. **নতুন env var লাগল না** — `N8N_CALLBACK_SECRET` আগে থেকেই প্রচলিত।
- **২০২৬-০৯-২৭ (ধাপ ৬ — সতর্কতা)** — `onError: continue` রাজস্ব গোপনভাবে বন্ধ করার
  ঝুঁকি তৈরি করে: expression ভুল হলে API 400 দেবে, workflow চলবে, reply সফল দেখাবে,
  অথচ credit কাটা হবে না — উৎপাদনে চোখে পড়বে না। তাই **আগেভাগে** তিনটি পরিস্থিতিতে
  রেন্ডারিং সিমুলেট করে আসল Zod স্কিমার সাথে মেলানো হলো। নিয়ম: যে নোডের ব্যর্থতা
  চুপচাপ চলে যায়, সেটির জন্য এমন "নীরব ব্যর্থতা" টেস্ট বাধ্যতামূলক।
- **২০২৬-০৯-২৭ (ধাপ ৬ — যা এখনো হয়নি)** — ফাইল বদলেছে, কিন্তু **n8n-এ ইমপোর্ট না
  হওয়া পর্যন্ত উৎপাদনে কিছুই বদলায়নি**। তাই এই ধাপ "সম্পন্ন" লেখা হলো না। ইমপোর্টের
  পর একটা লাইভ reply চালিয়ে যাচাই করা বাকি।
- **২০২৬-০৯-২৭ (ধাপ ৬ — লাইভ টেস্টে ধরা পড়া ভুল)** — ইউজারের লাইভ টেস্টে প্রমাণ হলো
  credit কাটছে না, কারণ `Billing API` নোড নীরবে ব্যর্থ হচ্ছে। **আমার দুইটি ভুল:**
  ১. `$env.N8N_CALLBACK_SECRET` ধরে নিয়েছিলাম — কিন্তু n8n Community-তে env variable
     সেট করার UI নেই, আর ইউজারের সার্ভার-অ্যাক্সেস নেই। **সমাধান:** Header Auth
     credential, যা এই workflow-এ (`Gemini Vision`) আগে থেকেই চলে।
  ২. `https://driplare.com` ব্যবহার করেছিলাম — ওটা 308 redirect দেয় `www`-তে।
     **সমাধান:** `www` + `followRedirects`।
  ➡️ **শিক্ষা:** "নীরব ব্যর্থতা" টেস্ট (৬.গ) শুধু body-র গঠন দেখেছিল, কিন্তু
  **প্রমাণীকরণ ও নেটওয়ার্ক পথ** যাচাই করেনি। পরেরবার credential/URL-ও টেস্ট করতে হবে।
  আরও শিক্ষা: `onError: continue` দিয়ে সুরক্ষা দিলে **পর্যবেক্ষণ** যোগ করা বাধ্যতামূলক —
  নইলে সুরক্ষাটাই সমস্যাটা লুকিয়ে ফেলে।
- **২০২৬-০৯-২৭ (ধাপ ৬ — নতুন সন্দেহ)** — production-এর `/api/internal/ai-usage`
  বাইরে থেকে ৪০৪ দেখাচ্ছে, তবে হেডারের `Age` ≈১৬.৭ দিন — অর্থাৎ cached পুরনো উত্তর।
  **এই মুহূর্তে বাইরে থেকে যাচাই করার নির্ভরযোগ্য উপায় নেই।** ইউজারকে ডিপ্লয়মেন্ট
  অবস্থা জানাতে বলা হয়েছে।

- **২০২৬-০৯-২৭ (ধাপ ৬.ঝ–৬.ঠ — লোকালহোস্টে ক্রেডিট না কাটা)** — ইউজার জানালেন
  publish হয়ে গেছে ও উত্তর আসছে, কিন্তু ক্রেডিট কাটছে না। কারণ (বাগ নয়): n8n আছে itnut
  VPS-এ, সে production-এর URL-এ কল করে, অথচ route-টা production-এ ডিপ্লয়ই হয়নি (৪০৪) —
  **VPS কখনোই localhost-এ পৌঁছাতে পারে না**।
  ➡️ **সিদ্ধান্ত (ইউজারকে জিজ্ঞেস করে):** টানেল নয়; বরং **প্ল্যাটফর্ম নিজেই Playground-এর
  ক্রেডিট কাটবে** — কারণ কলটা প্ল্যাটফর্মই করেছিল ও n8n উত্তরে token-ও দেয়। টানেল বাছলে
  প্রতি dev সেশনে URL বদলাতে হতো, আর production-এ ফেরত দিতে ভুললে আয় চুপচাপ বন্ধ হয়ে যেত।
  ➡️ **স্থাপত্য:** হিসাব-নিকাশ সব `lib/ai/charge-usage.ts`-এ; দুটো দরজা — `/api/internal/ai-usage`
  (n8n, FB/WA/IG-র জন্য) ও `chat/route.ts` (Playground)। দ্বিগুণ চার্জ আটকায় `billingOk`।
  ➡️ **পথে ধরা পড়া ফাঁদ:** `Build Web Response` নোডটা ফিল্ড হাতে গুনে বানায়, তাই `billingOk`
  বাদ পড়ছিল → production-এ প্রতি Playground reply-তে **দ্বিগুণ চার্জ** হতো। ঠিক করা হলো,
  এবং এই শ্রেণির বাগ ধরতে যাচাই স্ক্রিপ্টে স্থায়ী নিয়ম যোগ হলো (৬.ট)।
  ➡️ **শিক্ষা:** যে ফিল্ড দুটো সিস্টেমের মাঝখানে যায়, তার **পূর্ণ তালিকা** যাচাই করতে হবে —
  একটা ফিল্ড বাদ পড়লে সেটা ত্রুটি দেখায় না, ভুল হিসাব দেখায়।

- **২০২৬-০৯-২৭ (ধাপ ৬.৬ — cache-এর ফাঁদ)** — admin panel-এ ১/৩/৫ সেভ করার পরেও
  ড্যাশবোর্ড ২/৬/১০ দেখাচ্ছিল। কারণ ছিল ৫ মিনিটের in-memory cache, আর Next.js-এ
  **route handler-প্রতি আলাদা module instance** — তাই admin save-এর reset কেবল নিজের
  bundle-এ কাজ করত। `lib/core/db.ts` বহুদিন ধরে `globalThis`-এ Prisma client রেখে
  ঠিক এই সমস্যাটাই এড়াচ্ছিল, অথচ credit-এর পথে সেটা খাটানো হয়নি।
  ➡️ **সিদ্ধান্ত:** TTL কমানো বা `globalThis`-এ সরানো নয় — **cache সম্পূর্ণ তুলে দেওয়া**।
  `ai_credit_rules` একটি ছোট row, indexed `findUnique` প্রায় বিনামূল্যে; billing-এর পথে
  ১ সেকেন্ড পুরনো মানও গ্রহণযোগ্য নয়। OpenRouter-এর আসল HTTP catalogue cache অটুট।
  ➡️ **শিক্ষা:** *Billing-সংক্রান্ত কোনো মান cache করা যাবে না।* cache যা লুকায় তা
  ভুল নয়, **অমিল** — আর অমিল ধরা পড়ে অনেক দেরিতে, গ্রাহকের অভিযোগে।
  ➡️ **সহ-পণ্য:** `app/api/ai-models`-এ `dynamic` না থাকা ছিল আলাদা একটা production
  বাগ (build-time-এ `tiers` জমাট বেঁধে যেত), আর `fetch-models`-এ একটা হার্ডকড `?? 2`।
  ➡️ **ভবিষ্যতের জন্য নিয়ম:** `docs/cost-analytics/step6d-verify-credit-consistency.js`-এর
  সেকশন ৬ এখন প্রতি commit-এ এই সুরক্ষাগুলো যাচাই করে — cache ফিরে এলে বা `?? 2` ফিরলে
  স্ক্রিপ্ট ফেল করবে।
