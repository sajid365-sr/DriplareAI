# Driplare — Architecture Review

> **তারিখ:** ২০২৬-১০-১২
> **সূত্র:** সম্পূর্ণ কোডবেস অডিট + market research
> **প্রশ্ন:** বর্তমান hybrid (Next.js + n8n) structure কি ঠিক? এক OpenRouter key যথেষ্ট? per-platform workflow টিকবে? সব Next.js-এ নেওয়া উচিত?

---

## সংক্ষেপে রায়

**Hybrid structure (Next.js + n8n) সঠিক সিদ্ধান্ত — এটি বদলানো উচিত নয়।** মার্কেটে এটাই dominant pattern: **backend = policy engine, n8n = execution engine**।

যে সমস্যাগুলো অনুভব করা যাচ্ছে, তার মূল কারণ n8n নয়। কারণ তিনটি:

1. **Geography mismatch** — তিনটি component তিনটি ভিন্ন region-এ
2. **Production-breaking DB bug** — `lib/core/db.ts:43-44`
3. **Critical path-এ অপ্রয়োজনীয় cross-continent hop** — Automation Gate ও Billing API

---

## ১. Latency: বাস্তব সংখ্যা

### বর্তমান deployment topology

| Component | Location | Vercel-এর সাথে distance |
|---|---|---|
| Vercel (default `iad1`) | US-East (Washington DC) | — |
| Neon Postgres | **Singapore** (`ap-southeast-1`) | ~230ms RTT |
| n8n | itnut VPS, **Bangladesh** | ~230ms RTT to Vercel |

> যাচাই: `DATABASE_URL` → `ep-holy-tooth-aob1swj1-pooler.c-2.ap-southeast-1.aws.neon.tech`
> `vercel.json`-এ `regions` key নেই → Vercel default `iad1` (US-East)

### Core-AI-Brain serial chain

`docs/n8n-JSON/Core-AI-Brain.json`-এর graph থেকে extracted:

```
Fetch Bot Config → Ensure Session → Automation Gate(→Vercel) → Media Router
  → [image: Download Image → Gemini Vision | audio: Download → Gemini Transcribe]
  → Embed Query(→OpenRouter) → RAG Search → Build Context
  → AI Agent(→OpenRouter, +N tool rounds) → Format Response
  → Order Created Check → Save Chat History → Billing API(→Vercel)
  → Return to Platform → Meta Graph API (send reply)
```

**একটি সাধারণ text reply-তে ১১টি serial hop**, যার মধ্যে:

- **~৬টি Postgres round trip** — BD → Singapore ≈ 50-70ms each
- **২টি cross-continent HTTPS** to Vercel `iad1` — BD → US-East ≈ 230ms each
  - `Automation Gate` — 10s timeout নিয়ে **AI শুরুর আগেই blocking**
  - `Billing API` — reply handoff-এর আগে blocking
- **২-৪টি LLM call** — embedding + agent + প্রতিটি tool round আলাদা roundtrip

### বাস্তব latency estimate

| Scenario | Estimate |
|---|---|
| সাধারণ text প্রশ্ন | **৩-৬ সেকেন্ড** |
| Order confirm / product lookup | **৬-১২ সেকেন্ড** |
| Image message | **+১-২ সেকেন্ড** |

### যে বিষয়টি ভালো করা হয়েছে

n8n workflow-তে **`Respond 200 to Meta` early** (AI chain-এর আগে) করা আছে — এটি সঠিক pattern। ফলে Meta retry করবে না, duplicate event আসবে না।

তবে মনে রাখতে হবে: **Meta-র 200 আর customer-এর reply এক জিনিস নয়।** Customer ততক্ষণ অপেক্ষা করছে।

### সবচেয়ে বড় win

সব component একই region-এ আনলে latency **৪০-৬০% কমবে**। Vercel-এ `regions: ["sin1"]` সেট করলেই Vercel → Neon Singapore-এর ২৩০ms → **~৫ms**।

---

## ২. একটি OpenRouter key — যথেষ্ট?

### গুরুত্বপূর্ণ তথ্য

OpenRouter-এর rate limit **per-account**, per-key নয়। **একাধিক key বানালে limit বাড়বে না।**

### প্রকৃত limit (official docs)

| Tier | Limit |
|---|---|
| Paid models | কোনো fixed RPM নেই। **Dynamic RPS = balance ($1 ≈ 1 RPS)**, hard cap **500 RPS** |
| Free models | ২০ RPM · দিনে ৫০ request (<$10 credits) বা ১০০০ request ($10+ একবার কিনলে) |

### উপসংহার

- **এখন:** ১টি key টিকবে। ১০ RPS-এ এখনো অনেক দূরে।
- **তবে দুটি প্রকৃত ঝুঁকি আছে:**

#### (ক) Single point of failure

Key expire / rotate / balance ফুরালে — chat, embeddings, prompt enhance, product extract, auto-train **সব একসাথে বন্ধ**। কোনো fallback নেই, retry নেই (`lib/ai/embeddings.ts` ছাড়া — শুধু সেখানে ৩টি retry আছে)।

#### (খ) Abuse → সরাসরি আর্থিক ক্ষতি

- `app/api/webhooks/whatsapp/route.ts:16-33` — **কোনো signature verification নেই** (Instagram-এ আছে, WhatsApp-এ নেই)। যে কেউ fake payload POST করে n8n-এ LLM call trigger করতে পারবে — **আপনার key-তে, আপনার bill-এ**।
- `app/api/chatbots/[chatbotId]/integrations/[platform]/connect/route.ts:15-19` — auth comment করা। যে কেউ যেকোনো chatbot-এর `config` (token সহ) overwrite করতে পারে।

### সুপারিশ

- ১টি key রাখুন, তবে **নিজের একটি thin AI gateway** বানান (Next.js-এই হবে): rate limit + model fallback + per-workspace quota enforcement + structured logging।
  - `lib/ai/charge-usage.ts` ও `AIUsageLog` ইতিমধ্যে ভালো foundation — শুধু **enforcement** যোগ করতে হবে (এখন tracking আছে, blocking নেই)।
- n8n-এর OpenRouter node credential আলাদা (n8n-owned) — এটি ঠিক আছে, তবে balance alert সেট করুন।
- **BYOK পরে** — enterprise plan-এর জন্য, এখন নয়।

---

## ৩. Per-platform আলাদা workflow — সমস্যা?

**এটি সবচেয়ে ভালো design decision।**

### কেন সঠিক

- প্রতিটি platform-এর payload shape, auth, media handling, reply API সম্পূর্ণ ভিন্ন — আলাদা রাখা correct
- প্রতিটিই **lightweight adapter** — webhook verify → normalize → DB lookup → `executeWorkflow` → send reply
- **আসল AI logic এক জায়গায়:** Core-AI-Brain — এটি "single funnel" pattern, industry standard
- নতুন platform (Telegram, TikTok DM) যোগ করতে শুধু একটি adapter লিখতে হবে, brain ছুঁতে হবে না
- **এটাই n8n-এর মূল সুবিধা**, এবং এটি সঠিকভাবে ব্যবহৃত হচ্ছে

### একটিমাত্র সতর্কতা

৪টি platform workflow (FB/IG/WA/Web) প্রায় হুবহু কপি (FB/IG/WA তিনটিই 666 লাইন)। একটি bug fix করতে ৩ জায়গায় করতে হয়।

এটি "অতিরিক্ত workflow"-এর সমস্যা নয় — **"copy-paste divergence"-এর সমস্যা**। ভবিষ্যতে shared sub-workflow (session upsert, Meta send, error handling) বের করে ফেললে maintenance সহজ হবে।

---

## ৪. সব Next.js-এ নিয়ে আসা উচিত?

**না।** এটি latency কমাবে না, বরং বাড়াবে।

| বিষয় | n8n | Next.js |
|---|---|---|
| নতুন platform যোগ | ঘণ্টায় | দিনে |
| Visual debug / retry | ✅ built-in | নিজে বানাতে হবে |
| Long-running job | ✅ | ❌ Vercel timeout |
| Version control / test | ❌ (ugly JSON diff) | ✅ |
| Credential rotation UI | ✅ | নিজে বানাতে হবে |
| Cost per execution | fixed VPS | per-invocation |

সব Next.js-এ নিলে **Vercel-এ queue + worker + Redis + retry + dead-letter + credential manager** — সব নিজে বানাতে হবে। n8n যে কাজটি free-তে দিচ্ছে, সেটি re-implement করা হবে। Latency কমবে না, কারণ bottleneck **network hop ও serial chain** — ভাষা নয়।

### Industry consensus

n8n "edges"-এ (webhooks, triggers, integrations, routing) · custom code "core"-এ (agent loop, RAG, durable state)।

বর্তমান setup প্রায় এখানেই আছে — শুধু Automation Gate ও Billing API-কে critical path থেকে সরাতে হবে।

---

## ৫. Target Architecture (Hostinger + Coolify)

```
                    ┌─ Hostinger VPS (Singapore / India region) ─┐
Meta/WA/IG ──►      │  Coolify                                    │
Web Widget ──►      │   ├─ n8n main + 2-3 workers (queue mode)    │
                    │   ├─ Redis (BullMQ broker)                  │
Vercel (Next.js) ──►│   ├─ PostgreSQL + pgvector (একই VPS)        │
   sin1 region      │   └─ (later) Firecrawl, monitoring          │
                    └─────────────────────────────────────────────┘
```

### মূল পরিবর্তন

#### ১. Postgres VPS-এ সরানো

Neon-এর বদলে একই VPS-এ। n8n ও DB এক machine-এ → ~৫০ms × ৬ hop = **~৩০০ms সাশ্রয় প্রতি reply-তে**।

`lib/core/db.ts` ইতিমধ্যে `isNeon` branch দিয়ে traditional Postgres support করে (`PrismaPg`)। Migration সহজ।

#### ২. n8n queue mode চালু

```
EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=redis
```

Webhook main instance আলাদা, worker pool আলাদা → একটি slow AI execution বাকিদের block করবে না।

```bash
docker compose up -d --scale n8n-worker=3
```

**এটাই "যেকোনো সময় scale করা" চাওয়ার আসল উত্তর।**

> ⚠️ **সতর্কতা:**
> - `N8N_ENCRYPTION_KEY` সব instance-এ **একই** হতে হবে, নইলে credential decrypt হবে না
> - Queue mode-এ binary data filesystem-এ রাখা যাবে না — S3 বা DB লাগবে
> - PostgreSQL বাধ্যতামূলক (SQLite不支持)
> - Worker concurrency ≥ 5 রাখুন, নইলে DB connection pool শেষ হয়ে যাবে

#### ৩. Vercel region `sin1`

`vercel.json`-এ `"regions": ["sin1"]`। এক লাইনের পরিবর্তন, বিশাল পার্থক্য।

#### ৪. Automation Gate ও Billing API critical path থেকে সরানো

দুটিই BD → US-East ২৩০ms নিচ্ছে এবং reply আটকে রাখছে।
- Gate → n8n-এর ভেতরে আনুন বা cache করুন
- Billing → fire-and-forget করুন (বর্তমানে `onError: continueRegularOutput` আছে — কিন্তু সেটি error handle করে, latency কমায় না)

---

## ৬. Latency-র চেয়েও জরুরি — আগে এগুলো ঠিক করতে হবে

### 🔴 ১. প্রতি query-তে নতুন PrismaClient

`lib/core/db.ts:43-44` — production-এ `createPrismaClient()` **প্রতিবার** কল হয়। মানে প্রতি DB access-এ নতুন Neon WebSocket / নতুন `pg.Pool`।

- Connection pool নষ্ট হয়
- Neon-এ WebSocket handshake যোগ হয়
- Hostinger Postgres-এ **connection limit ফুরিয়ে crash করবে**

→ বিস্তারিত ও অবস্থা: [`task.md` → TASK-01](./task.md)

### 🔴 ২. Integration route-গুলোতে ownership check নেই (Cross-Tenant IDOR)

> **⚠️ সংশোধনী (২০২৬-১০-১২):** এই বিভাগের প্রথম সংস্করণে লেখা ছিল "যে কেউ (unauthenticated) overwrite করতে পারে"। **সেটি ভুল ছিল।** `proxy.ts:44-46`-এর Clerk middleware `/api/chatbots/**` সুরক্ষিত করে, তাই unauthenticated request আটকে যায়।
>
> আসল সমস্যা **Cross-Tenant IDOR**: যেকোনো **signed-in** ব্যবহারকারী অন্য merchant-এর `chatbotId` URL-এ বসিয়ে request পাঠালে সেটি সফল হয়। Severity একই থাকে — multi-tenant SaaS-এ এটি সবচেয়ে সাধারণ ও ভয়ংকর authorization class।

`Integration` মডেলে নিজস্ব `userId`/`workspaceId` নেই; ownership আসে শুধু `chatbotId → Chatbot.userId` দিয়ে (`merchant.prisma:134-149`)। কিন্তু ৭টি mutation route শুধু "কেউ signed-in কি না" যাচাই করত, "এই chatbot তার কি না" যাচাই করত **না**:

| Route | সমস্যা | প্রভাব |
|---|---|---|
| `integrations/[platform]/connect` | auth comment করা | যেকোনো chatbot-এ **token inject** |
| `integrations/[platform]/route.ts` | শুধু `!userId` | `connected` flag পাল্টানো |
| `integrations/[platform]/disconnect` | শুধু `!userId` | config **মুছে ফেলা** |
| `integrations/facebook/connect` | `canAddIntegration` ownership যাচাই করে না | page token অন্য chatbot-এ |
| `integrations/n8n_facebook/connect` | শুধু `!userId` | page token অন্য chatbot-এ |
| `integrations/n8n_source/connect` | শুধু `!userId` | `ingestUrl` অন্য chatbot-এ |
| `integrations/whatsapp/disconnect` | শুধু `!userId` | WhatsApp config মুছে ফেলা |

**সমাধান:** সবগুলোতে canonical `getOwnedChatbot(userId, chatbotId)` ([chatbot-access.ts:3](lib/domain/chatbot-access.ts#L3)) gate যোগ করা হয়েছে।

→ বিস্তারিত: [`task.md` → TASK-02](./task.md)

**বাকি (read-side disclosure):** `analytics/route.ts` ও `sessions/[sessionId]/sse/route.ts` — একই ফাঁক, তবে read-only। আলাদা ধাপে (#2b)।

### 🔴 ৩. WhatsApp webhook-এ signature verification নেই

`app/api/webhooks/whatsapp/route.ts:16-33` — direct financial risk (উপরে ব্যাখ্যা করা হয়েছে)।

### 🟠 ৪. `Integration.config`-এ সব token plaintext

`prisma/schema/merchant.prisma:134-149` — `config Json`-এ `pageToken`, `accessToken`, `instagramAccessToken` সোজা বসানো।

DB leak = সব merchant-এর page hijack। অন্তত field-level encryption (AES-GCM) প্রয়োজন।

### 🟠 ৫. Facebook webhook route নেই

`proxy.ts:18-25` ও `app/api/admin/system/health/route.ts:65` `/api/webhooks/facebook` reference করে, কিন্তু ফাইল নেই — FB Meta→n8n direct যাচ্ছে।

স্বাভাবিক, তবে code-এ inconsistent। ঠিক করুন বা comment করুন।

> **⚠️ সংশোধনী (২০২৬-১০-১২) — যাচাইকৃত:** এই অনুচ্ছেদের endpoint নামটি **পুরনো**। কোড মিলিয়ে দেখা গেছে প্রকৃত অবস্থা ভিন্ন:
>
> | কোথায় | প্রকৃত অবস্থা |
> |---|---|
> | `proxy.ts:19` | `'/api/webhooks/n8n-facebook(.*)'`, comment: *"n8n Facebook relay (Meta sends here)"* — কিন্তু `app/api/webhooks/n8n-facebook/`-এ **`route.ts` নেই** (শুধু `token-status/route.ts`) |
> | `proxy.ts:18` | `'/api/webhooks/meta(.*)'` — **route নেই, কোডে আর কোথাও reference-ও নেই**। সম্পূর্ণ orphan |
> | `app/api/admin/system/health/route.ts:30` | FB চ্যানেলের endpoint হিসেবে `/api/webhooks/n8n-facebook` দেখায় — অস্তিত্বহীন |
>
> অর্থাৎ সমস্যাটি কেবল "consistency" নয়: `isPublicRoute`-এ থাকা প্রতিটি pattern Clerk সুরক্ষা **বন্ধ** করে, তাই ভবিষ্যতে কেউ ওই নামে route বানালে সেটি নীরবে unauthenticated হয়ে যাবে। সমাধান: [`task.md` → TASK-20](./task.md) (Meta Dashboard-এ FB-এর আসল Callback URL কী, তা ইউজার যাচাই করবেন — তারপর route বানানো, নয়তো dead pattern মোছা)।

### 🟠 ৬. `.env`-এ `/webhook-test/` path

FB/WA/IG/ingest সব `/webhook-test/...`-এ point করা — শুধু n8n editor খোলা থাকলে কাজ করে।

Production-এ `/webhook/` হতে হবে। Live-এ গেলে platformগুলো চুপচাপ বন্ধ হয়ে যাবে।

> **⚠️ সংশোধনী (২০২৬-১০-১২):** `/webhook-test/` **লোকাল ডেভেলপমেন্টে ভুল নয়** — `.env` git-ignored এবং প্রোডাকশনের মান থাকে Vercel-এ। তাই সমাধান `.env` বদলানো নয়; বরং (ক) committed `.env.example` template যা production path দেখায়, এবং (খ) `instrumentation.ts`-এ **boot-time audit** যা প্রোডাকশনে test path পেলে `console.error` দেয়। বিস্তারিত: [`task.md` → TASK-05](./task.md)

### 🟡 ৭. Widget route নেই

`hooks/integrations/useWebsiteIntegration.ts:26` `/widget/{chatbotId}.js` embed করে, কিন্তু route/file নেই। মানে website channel এখন কাজ করে না।

### 🟡 ৮. Validation layer নেই

`Create Order` tool সরাসরি `$fromAI()` মান INSERT করে। AI ভুল name/phone/address দিলে ভুল order যাবে।

Schema validation + confirmation step যোগ করতে হবে।

---

## ৭. Priority Roadmap

### Phase 1 — এখনই (correctness, ১-২ দিন)

- [x] db.ts caching fix → [`task.md` → TASK-01](./task.md) ✅ **সম্পন্ন**
- [x] Integration route IDOR (৭টি write route) → [`task.md` → TASK-02](./task.md) ✅ **সম্পন্ন**
- [x] Read route IDOR (analytics, sse) → [`task.md` → TASK-03](./task.md) ✅ **সম্পন্ন**
- [x] WhatsApp signature verification → [`task.md` → TASK-04](./task.md) ✅ **সম্পন্ন**
- [x] n8n webhook path audit + `.env.example` → [`task.md` → TASK-05](./task.md) ✅ **সম্পন্ন**

> **📌 বাকি সব কাজের একক তালিকা:** [`task.md`](./task.md) — উপরের roadmap-টি মূল বিশ্লেষণের; কাজের প্রকৃত ক্রম ও প্রতিটি টাস্কের পূর্ণ বিবরণ `task.md`-এ (Phase 1–6 + স্থগিত VPS)।

### Phase 2 — Hostinger migration

- [ ] VPS + Coolify
- [ ] Postgres ওখানে সরানো (একই region)
- [ ] n8n queue mode + Redis + 3 workers
- [ ] Vercel `sin1`

### Phase 3 — Resilience

- [ ] Token encryption at rest
- [ ] AI gateway: rate limit + fallback + quota enforcement
- [ ] Automation Gate / Billing critical path থেকে সরানো
- [ ] Sub-workflow দিয়ে platform adapter-এর duplication কমানো
- [ ] Payment/idempotency: webhook dedupe on `message.id`

### Phase 4 — Scale

- [ ] BYOK for enterprise
- [ ] Model routing per plan tier
- [ ] Observability (execution metrics, cost per workspace)

---

## ৮. শেষ কথা

Intuition সঠিক জায়গায় — **latency অনুভব করা যাচ্ছে**, কিন্তু কারণ n8n নয়। কারণগুলো:

1. একই pipeline-এ **১১টি serial hop**
2. **তিন মহাদেশে** ছড়ানো infrastructure
3. একটি **DB bug** যা প্রতি query-তে নতুন connection তৈরি করছে

**n8n রাখুন।** বরং এটিকে আরও ভালোভাবে ব্যবহার করুন (queue mode + workers)।

Hostinger-এ যাওয়ার সময় **সব এক region-এ** আনুন — এটাই সবচেয়ে বড় single win।

---

## সূত্র (Sources)

- [OpenRouter — API Credit & Rate Limits](https://openrouter.ai/docs/api_reference/limits)
- [OpenRouter Rate Limits: RPM, Credits, and 429 Fixes (2026)](https://about.fast.io/resources/openrouter-rate-limit/)
- [n8n Docs — Queue mode](https://docs.n8n.io/deploy/host-n8n/configure-n8n/basic-configuration/use-environment-variables/queue-mode)
- [n8n Docs — Enable queue mode / multi-main](https://docs.n8n.io/deploy/~/revisions/bjFzSAAj7Gmv3JnESj1g/host-n8n/configure-n8n/scaling/enable-queue-mode)
- [Can n8n Replace Your Backend for AI Workflows? — DEV](https://dev.to/hosseinhezami/can-n8n-replace-your-backend-for-ai-workflows-3h64)
- [n8n AI Agents vs Custom Frameworks — Cipher Projects](https://www.cipherprojects.com/blog/posts/n8n-agents-vs-custom-agent-frameworks/)
- [Guide to WhatsApp Webhooks — Hookdeck](https://hookdeck.com/webhooks/platforms/guide-to-whatsapp-webhooks-features-and-best-practices)
- [Building a Resilient WhatsApp Cloud API Webhook Handler — DEV](https://dev.to/lucas_ventavele/building-a-resilient-whatsapp-cloud-api-webhook-handler-in-nodejs-14lj)
- [Cole Medin — Hybrid No-Code + Code Architecture](https://github.com/coleam00/cole-medin-knowledge-base/blob/main/concepts/hybrid-no-code-and-code.md)
