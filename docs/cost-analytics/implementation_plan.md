# Implementation Plan — Actual OpenRouter Cost Analytics

Admin Panel-এর `Cost Analytics & Unit Economics` tab-এ প্রতিটি Workspace আসলে কত টাকার
OpenRouter API consume করছে — সেটা **actual** ভিত্তিতে দেখানোর পরিকল্পনা।

**অবস্থা:** অনুমোদিত (২০২৬-০৯-২৭) · **পদ্ধতি:** ছোট ছোট ধাপে, প্রতিটি ধাপ আলাদাভাবে যাচাইযোগ্য

---

## 1. বর্তমান সমস্যা (Root Cause Analysis)

### 1.1 `Extract Generation ID` কখনোই কাজ করতে পারে না
[Core-AI-Brain.json](../n8n-JSON/Core-AI-Brain.json) এর `Extract Generation ID` node
`$('AI Agent').item.json` কে deep-search করে `gen-` prefix যুক্ত id খোঁজে। কিন্তু:

- n8n AI Agent node-এর output শুধু `{ output: "..." }` (+ ঐচ্ছিক `intermediateSteps`)।
- `OpenRouter Chat Model` (`@n8n/n8n-nodes-langchain.lmChatOpenRouter`) ভেতরে LangChain-এর
  `ChatOpenAI` ব্যবহার করে, যা raw HTTP response খেয়ে ফেলে শুধু text ফেরত দেয়।
- n8n-এর OpenRouter credential-এ মাত্র দুটি ফিল্ড: `apiKey` ও একটি **hidden** `url`।
  Node-টিতে custom header / extra body property যোগ করার **কোনো অপশন নেই**।

➡️ ফলাফল: `found: false` → `Fetch Exact OpenRouter Usage` খালি `id` নিয়ে কল করে → সবসময় ব্যর্থ।

### 1.2 Prisma schema আর n8n-এর INSERT মিলছে না
`Log Chat & Billing` node `"generationId"` ও `"exactFromOpenRouter"` কলামে INSERT করে,
কিন্তু [billing.prisma](../../prisma/schema/billing.prisma) এ এই কলাম **নেই**।

➡️ `column does not exist` → পুরো multi-statement INSERT ফেল → `ChatMessage` ও
`AIUsageLog` কোনোটাই সেভ হয় না → পরের `Return to Platform`-ও চলে না।

### 1.3 `channel` হার্ডকোড `'web'`
Facebook / WhatsApp / Instagram / Playground — সব লগ `web` হয়ে যাচ্ছে।
`creditsDeducted` = 15 হার্ডকোড, `isFreeMessage` = false হার্ডকোড।

### 1.4 ক্রেডিট কোথাওই কাটা হচ্ছে না
[chat/route.ts](../../app/api/chatbots/%5BchatbotId%5D/chat/route.ts) বলছে
"n8n handles credit deduction" — কিন্তু Core-AI-Brain-এ `creditsBalance` UPDATE বা
`CreditTransaction` INSERT নেই। Next.js দিকের কাটাটাও আগে সরিয়ে ফেলা হয়েছিল।

### 1.5 খরচের হিসাব তিন জায়গায় তিন রকম
| কোথায় | কীভাবে |
|---|---|
| n8n `Format Response` | হার্ডকোড $3/$15 per 1M + token estimate (`length/3.8 + 1350`) |
| `lib/ai/cost-calculator.ts` | DB-র `ai_credit_rules` pricing |
| OpenRouter (আসল) | `usage.cost` — যেটা আমরা কখনো পড়ি না |

### 1.6 ইউনিট ইকোনমিক্স আসলে লসের দিকে
Business প্ল্যান ৳2,499 / 50,000 credits ≈ ৳0.05/credit। Standard reply = 3 credit = ৳0.15 ≈ $0.00125 আয়।
কিন্তু Claude Sonnet 4-এ (1,854 in / 86 out) খরচ ≈ $0.0067 ≈ ৳0.80। Tool-loop + RAG context
ধরলে প্রতি মেসেজে ৳1+। ➡️ exact accounting ছাড়া pricing টেকসই নয়।

---

## 2. যাচাই করা OpenRouter তথ্য

| দাবি | ফলাফল |
|---|---|
| `callback_url` দিয়ে chat completion-এর webhook | ❌ **সম্ভব নয়** — শুধু video generation-এ |
| `GET /api/v1/generation?id=` | ✅ exact cost (`total_cost`) দেয়, **কিন্তু id লাগে** |
| n8n execution data-তে generation id (`gen-...`) | ❌ **নেই** — পূর্ণ execution JSON-এ একটি `gen-` স্ট্রিংও নেই |
| n8n-এর `OpenRouter Chat Model` → `generationInfo` | ⚠️ `prompt: 0, completion: 0` (streaming-এর কারণে LangChain usage ম্যাপ করে না) |
| **n8n node metadata `tracing.llm.tokens`** | ✅✅ **আসল token count পাওয়া যায়** — `{in: 1854, out: 95, total: 1949, estimated: false}` |
| `GET /api/v1/credits` | ✅ `total_credits`, `total_usage` (`$1.816859925`) |
| `GET /api/v1/key` | ✅ `usage_daily` / `usage_monthly` — দিন-ভিত্তিক আসল খরচ |
| `GET /api/v1/activity` | ❌ **403 — Management key লাগে** |
| `GET /api/v1/models` → `pricing.prompt/completion` | ✅ লাইভ per-token দাম |

**🎯 চূড়ান্ত সিদ্ধান্ত (যাচাই করা):**

n8n প্রতিটি AI Agent node-এর run data-তে নিজেই আসল token সেভ করে:

```json
"metadata": { "tracing": {
  "llm.tokens.in": 1854, "llm.tokens.out": 95,
  "llm.tokens.total": 1949, "llm.tokens.estimated": false } }
```

আর OpenRouter-এর charge = token × per-token price। তাই:

```
actual cost = n8n-এর আসল token  ×  /api/v1/models-এর লাইভ দাম
```

**যাচাই:** `1854 in / 86 out` → `$0.00685200`, আর OpenRouter `/key`-এর `usage_daily`
= `$0.006852` — **হুবহু মিলেছে**।

➡️ **generation id ছাড়াই exact cost সম্ভব।** Phase 2A-এর মূল ধারণা বদলে যায় —
`/generation` lookup বাদ, বদলে **n8n execution metadata + live pricing**।


---

## 3. টার্গেট আর্কিটেকচার

```
FB / WA / IG ─┐
              ├─→ Core-AI-Brain → AI Agent → Format Response (শুধু reply)
Web (Next.js) ─┘                          → Log Chat (শুধু ChatMessage)
                                          → POST /api/internal/ai-usage ──┐
                                                                            ▼
                                                                Next.js (single source of truth)
                                                                ├─ Live OpenRouter pricing
                                                                ├─ AIUsageLog
                                                                ├─ CreditTransaction
                                                                └─ creditsBalance
```

**কারণ:** Core-AI-Brain-ই সব চ্যানেলের একমাত্র funnel। Facebook / WhatsApp / Instagram
সরাসরি Meta Graph API-তে রিপ্লাই দেয় — Next.js-কে ছোঁয় না। তাই বিলিং কলটা
Core-AI-Brain থেকেই Next.js-এ যাবে।

---

## 4. ক্রেডিট ডিডাকশন — single source of truth

**সিদ্ধান্ত (ইউজার):** `lib/domain/credit-config.ts`-এ যা আছে সেটাই সব জায়গায়, এবং
`/admin/ai-settings` থেকে adjust করা যাবে।

**ডিজাইন:**

```
effective credit = ai_credit_rules.models[modelId].credits   (admin-editable DB)
                   ?? credit-config.ts tier default          (fallback)
                   × (isTestChat ? testChatMultiplier : 1)
```

- `lib/domain/credit-config.ts` → **fallback defaults + tier map** (runtime override নয়)
- `ai_credit_rules` (DB, `/admin/ai-settings`) → **runtime override** (এখনই per-model
  `credits` ও global `testChatMultiplier` editable)
- নতুন resolver ফাংশন → Next.js + n8n (internal API-র মাধ্যমে) — **সবাই একটাই ফাংশন ব্যবহার করবে**
- n8n-এর হার্ডকোড `15` সম্পূর্ণ বাদ

বর্তমান DB default-এর সাথে `credit-config.ts` মিলে যায়: Economy=1, Standard=3, Premium=5,
`testChatMultiplier`=2 ✅

---

## 5. ধাপভিত্তিক বাস্তবায়ন

### 🔍 Phase 0 — ডায়াগনস্টিক (কোনো কোড পরিবর্তন নয়)
- [ ] 0.1 Neon-এ `billing.AIUsageLog`-এর আসল কলাম লিস্ট যাচাই
- [ ] 0.2 n8n-এ ১টি execution চালিয়ে `OpenRouter Chat Model` node-এর Output JSON দেখা
      (`response_metadata.id` / `tokenUsage` আছে কি না) — **Phase 2A সম্ভব কি না এটাই ঠিক করবে**
- [ ] 0.3 `GET /api/v1/activity` ও `GET /api/v1/credits` যাচাই
- [ ] 0.4 itnut hosting n8n-এ REST API key + `N8N_BASE_URL`

### 🧱 Phase 1 — ভিত্তি
- [ ] **1.1** Credit resolver (`lib/domain/credit-config.ts` + DB override) — সব পথে একটাই মান
- [ ] **1.2** Prisma: `AIUsageLog`-এ `costSource`, `providerCostUsd`, `generationId`,
      `llmCallCount`, `runId @unique` → `prisma db push`
- [ ] **1.3** নতুন `app/api/internal/ai-usage/route.ts` — secret-guarded, idempotent (runId),
      cost + AIUsageLog + CreditTransaction + creditsBalance
- [ ] **1.4** নতুন `lib/ai/model-pricing.ts` — live OpenRouter pricing (`/api/v1/models`),
      `openrouter_pricing` PlatformSetting-এ cache; হার্ডকোড $3/$15 বাদ
- [ ] **1.5** n8n: dead node দুটো ডিলিট, বিলিং INSERT সরিয়ে internal API কল, `channel` ফিক্স,
      credit gate (FB/WA/IG-তে এখন কোনো credit check নেই)
- [ ] **1.6** End-to-end যাচাই

### 📊 Phase 2B — Allocation + Daily Reconciliation
- [ ] **2.1** নতুন `lib/ai/openrouter-activity.ts` + `OpenRouterDailySpend` cache টেবিল
- [ ] **2.2** নতুন `app/api/cron/openrouter-sync/route.ts` (রোজ, `vercel.json` cron)
- [ ] **2.3** Allocation: (date, model) এর actual spend → workspace-এ token-share অনুপাতে ভাগ
- [ ] **2.4** নতুন `components/admin/workspaces/CostReconciliationCard.tsx` —
      Actual vs Allocated vs Logged + Variance %

### 🎯 Phase 2A — Exact Reconciler (**পরিবর্তিত — Phase 0.2-এর ভিত্তিতে**)
> ❌ পুরনো পরিকল্পনা (generation id → `/api/v1/generation?id=`) **বাদ**, কারণ execution
> data-তে কোনো `gen-` id নেই। ✅ নতুন পথ: n8n execution-এর `metadata.tracing` token
> + লাইভ pricing = গণিতগতভাবে exact (যাচাই করা, বিভাগ ২ দেখুন)।

- [ ] **3.1** `lib/ai/n8n-executions.ts` — n8n REST API (`GET /api/v1/executions/{id}?includeData=true`,
      `X-N8N-API-KEY`) দিয়ে execution data পড়া
- [ ] **3.2** `resultData.runData`-র প্রতিটি LangChain node থেকে `metadata.tracing`-এর
      `llm.tokens.in/out` সংগ্রহ (একাধিক LLM call থাকলে যোগ) → `llmCallCount`
- [ ] **3.3** আসল token × `lib/ai/model-pricing.ts`-এর লাইভ price → `costSource='exact'`
- [ ] **3.4** `AIUsageLog`-এ `runId` দিয়ে নিরাপদে UPDATE (idempotent), `costSource` ব্যাজ
- [ ] **3.5** fallback: execution data prune হয়ে গেলে বা tracing না থাকলে
      `costSource='estimated'` → `allocated` মানই থাকবে (কখনো শূন্য নয়)

### 🎨 Phase 3 — Admin UI
- [ ] **4.1** `CostAnalyticsTab` — actual vs estimated আলাদা, per-row cost source badge
- [ ] **4.2** Break-even card (প্রতি মেসেজে আয় vs খরচ, model-ভিত্তিক)
- [ ] **4.3** Channel breakdown ঠিক করা

---

## 6. Verification Plan
1. Playground থেকে ১টি মেসেজ → `AIUsageLog` row + `ChatMessage` সেভ + credit কাটা
2. FB/WA/IG → `channel` সঠিক সেভ
3. OpenRouter Dashboard মোট খরচ ↔ Admin "Actual" (variance < 1%)
4. Idempotency: একই `runId` দুইবার → দ্বিতীয়বার বিল কাটবে না
5. Phase 2A: OpenRouter Generation Logs-এর ১ entry ↔ DB-র ১ row, cost হুবহু মিলবে
6. Regression: FB/WA/IG reply + Order তৈরি অক্ষত

## 7. ঝুঁকি
- ~~Phase 0.2 ব্যর্থ হলে Phase 2A বাদ~~ → **সমাধান হয়েছে:** token পাওয়া যাচ্ছে, তাই exact সম্ভব
- n8n execution data pruning — reconciler সময়মতো চলতে হবে (fallback: `estimated`/`allocated`)
- `lib/ai/model-pricing.ts` fail করলে stale cache-এ fallback (কখনো crash নয়)
- `creditsDeducted` সঠিক মান বসালে **বিদ্যমান মার্চেন্টদের বিল বদলাবে** — আলাদাভাবে নোটিশ
- Shell command মাঝেমধ্যে classifier outage-এ আটকায় → যাচাই ধাপ কখনো "সফল" লেখা হবে না
  যতক্ষণ না সত্যিই চালানো হয়

## 7.1 বাড়তি অনুসন্ধান (Phase 0.2 থেকে)
- **`anthropic/claude-3.5-sonnet` OpenRouter-এ আর নেই** (deprecated) — কিন্তু
  `MODEL_TIER_MAP` ও `DEFAULT_MODELS_CATALOG`-এ এখনো আছে → cleanup দরকার
- **`DEFAULT_MODELS_CATALOG`-এর দাম বাসি:** যেমন `gemini-2.5-flash-lite` = `0.075/0.30`,
  কিন্তু আসল = `0.10/0.40` → প্রতি-কল ledger-এ ভুল। এটাই `model-pricing.ts` লাগানোর
  সবচেয়ে বড় কারণ
- n8n-এর `OpenRouter Chat Model` streaming করে বলে `generationInfo.prompt/completion = 0`
  — তাই `Format Response`-এর token estimate-ও ভুল। `metadata.tracing`-ই একমাত্র নির্ভরযোগ্য সূত্র।

## 8. পরিবর্তিত ফাইল
**নতুন:** `app/api/internal/ai-usage/route.ts` · `app/api/internal/ai-usage/exact/route.ts` ·
`lib/ai/model-pricing.ts` · `lib/ai/openrouter-activity.ts` · `app/api/cron/openrouter-sync/route.ts` ·
`components/admin/workspaces/CostReconciliationCard.tsx` · n8n sub-workflow JSON

**পরিবর্তিত:** `prisma/schema/billing.prisma` · `lib/ai/cost-calculator.ts` ·
`lib/ai/usage-logger.ts` · `lib/domain/credit-config.ts` · `app/api/admin/workspaces/[id]/route.ts` ·
`components/admin/workspaces/CostAnalyticsTab.tsx` · `docs/n8n-JSON/Core-AI-Brain.json` · `vercel.json`
