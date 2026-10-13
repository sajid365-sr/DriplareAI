# Architecture-Update — Master Task List

> **সূত্র:** [`architecture-analysis.md`](./architecture-analysis.md)
> **শেষ হালনাগাদ:** ২০২৬-১০-১৩ — TASK-07 ✅ · TASK-08 ✅ · TASK-09 ✅ সম্পন্ন · **TASK-10 Part A ✅ ও Part B ✅** (AI Gateway + n8n-side quota pre-flight) · **TASK-11 ✅** (Gate+Billing এক হপ কম, Vercel `sin1`) · **TASK-12 ✅** (Website Widget — এখন সত্যিই কাজ করে) · TASK-24 ও TASK-25 যোগ (workspace budget + revenue leak) · **পরের: TASK-13** · scheduler = VPS-এর crontab ([`cron-demo.md`](../cron-demo.md))
> **উদ্দেশ্য:** এই ফাইলটিই একমাত্র টাস্ক-তালিকা। কাজের সময় যে আলাদা plan ফাইলগুলো (০১–০৬) তৈরি হয়েছিল, সেগুলো মুছে ফেলা হয়েছে — প্রতিটি টাস্কের প্রয়োজনীয় তথ্য এখন এখানেই আছে, যাতে একজন AI **একা** কাজ করতে পারে।

---

## ০. AI-এর জন্য নির্দেশ (কীভাবে কাজ করবে)

**একবারে একটি টাস্ক।** TASK নম্বর ধরে এগোবে। একটি টাস্ক শেষ + যাচাই না হওয়া পর্যন্ত পরেরটি শুরু করবে না।

প্রতিটি টাস্কের ৫টি অংশ:

| চিহ্ন | মানে |
|---|---|
| 🎯 **কী** | ঠিক কী করতে হবে |
| ❓ **কেন** | না করলে কী ক্ষতি হবে |
| 📁 **ফাইল** | কোন ফাইল/ফোল্ডারে হাত দিতে হবে |
| 🔧 **করণীয়** | ধাপে ধাপে কাজ |
| ✅ **গ্রহণযোগ্যতা** | কোন অবস্থায় "শেষ" বলবে |

### প্রতিটি টাস্কের পরে বাধ্যতামূলক

```bash
npx tsc --noEmit     # ০ error
npm run build        # exit 0
```

### কখনো ভাঙবে না — এমন নিয়ম

1. 🚫 **DB-তে যেকোনো লেখার আগে ইউজারের অনুমতি নিতে হবে।** শুধু DDL নয় — seed row, cache row, `upsert`, "নির্দোষ" `insert` — সবকিছুর জন্য। অনুমতি ছাড়া DB-তে একটিও row লেখা যাবে না।
2. 🚫 **`prisma db push` চালাবে না।** Schema বদলানোর আগে সর্বদা:
   ```bash
   npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script
   ```
   কারণ live ডাটাবেসে `n8n_chat_histories` টেবিল আছে — `db push` সেটি **মুছে ফেলবে** (n8n-এর পুরো চ্যাট মেমোরি)। উপরের diff-এর output ইউজারকে দেখিয়ে অনুমতি নিতে হবে, তারপর আলাদা SQL চালাতে হবে।
3. 🚫 **Hardcoded রঙ নয়** (`bg-blue-500` ❌) — `app/globals.css`-এর CSS variable (`--primary`, `--secondary`, `--accent`, `--success`, `--warning`, `--destructive`, `--muted`) ✅
4. 🌐 **সব লেখা i18n-এ** — `public/locales/{en,bn}/<namespace>.json`। একটি TS ফাইলে translation রাখা যাবে না।
5. 🇧🇩 ইউজারের সাথে **বাংলায়** কথা বলবে। কোড কমেন্ট **ইংরেজিতে**। বাংলা অনুবাদে technical শব্দ (AI Agent, Webhook, Dashboard, Facebook, WhatsApp, n8n, Token) **ইংরেজিতেই** থাকবে।
6. 🌓 **Dark ও Light — দুই theme-এই** যাচাই করবে।
7. 📱 সব UI **responsive** (Mobile / Tablet / PC / বড় monitor)।
8. 👤 **ইউজার নিজে deploy করবেন** — এই repo-তে শুধু লোকাল কোড বদলাবে। কোনো কিছু প্রোডাকশনে পাঠাবে না।
9. 📝 n8n workflow বদলাতে হলে: JSON ফাইল বদলে **ইউজার নিজে n8n-এ import করবেন** — AI শুধু JSON তৈরি/আপডেট করবে এবং ইউজারকে বলবে কোন workflow import করতে হবে।

---

## ১. এক নজরে অবস্থা

| Phase | মোট | ✅ সম্পন্ন | 🔄 চলছে | ⬜ বাকি |
|---|---|---|---|---|
| ১ — Correctness | ৫ | **৫** | ০ | ০ |
| ২ — Monitoring ও Webhook নির্ভুলতা | ৪ | **২** | ০ | ২ |
| ৩ — Merchant ডেটা সুরক্ষা | ৩ | **২** | ০ | ১ |
| ৪ — খরচ ও Resiliency | ৫ | **২** | ০ | ৩ |
| ৫ — প্রোডাক্ট সম্পূর্ণতা | ১ | **১** | ০ | ০ |
| ৬ — Scale | ৩ | ০ | ০ | ৩ |
| 🅿️ স্থগিত — VPS | ৪ | ০ | ০ | ৪ |
| **মোট** | **২৫** | **১২** | **০** | **১৩** |

> **👉 পরের টাস্ক: TASK-13 — Observability** *(Phase 6-এর তালিকায় নিচে; Phase 1–5-এর সব সিরিয়াল টাস্ক এখন সম্পন্ন)* *(TASK-11 ও TASK-12 দুটোই সম্পন্ন — তবে TASK-11-এর n8n import ও "before/after" timing, আর TASK-12-এর একবার হাতে ব্রাউজার পরীক্ষা ইউজারের হাতে বাকি; দুটোর ধাপ নিজ নিজ সেকশনে আছে)* *(Phase 2-এ এখনো [`TASK-20`](#task-20--webhook-entry-point-ও-dead-reference-পরিষ্কার) ও [`TASK-22`](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) বাকি, তবে ডকুমেন্টের নিয়ম অনুযায়ী টাস্ক নম্বর ধরে এগোনো হয়)*
>
> **⚠️ TASK-07 চলাকালীন একটি প্রোডাকশন ব্লকার পাওয়া গেছে — [`TASK-22`](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) দেখুন।** বিদ্যমান ৩টি cron সম্ভবত কখনো চলে **নাই**।

**ক্রম কেন এমন:** মানুষের ডেটা ও আপনার টাকা রক্ষা করা আগে, ফিচার পরে। VPS **migration** (নিচে 🅿️ — টাস্ক ১৬–১৯: app/DB সরানো, region বদলানো) এখনো **স্থগিত**, কারণ সেগুলো এই repo-র বাইরের সিদ্ধান্ত।

> 🗓️ **হালনাগাদ (২০২৬-১০-১৩):** প্রোডাকশন **Hostinger VPS**-এ ডেপ্লয় হবে — অর্থাৎ VPS "ভবিষ্যতে" নয়, **এটাই গন্তব্য**। তবে migration টাস্কগুলো এখনো ছোঁয়া হয়নি। যেটি এই নথিতে **এখনই** প্রভাব ফেলে: scheduled কাজ আর Vercel Cron-এ চলবে না, চলবে **VPS-এর crontab**-এ — কোড [`scripts/cron/`](../../scripts/cron/), নির্দেশ [`cron-demo.md`](../cron-demo.md) §৪। এর ফলে `run-automations`-এর `*/10` frequency সমস্যা **সমাধান হয়ে গেছে** (TASK-22-এর item 5), কিন্তু Clerk-এর ব্লকার **একই আছে** — [TASK-22](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) এখনো অপরিহার্য।

---

## Phase 1 — Correctness ✅ সম্পূর্ণ

> সবগুলো লোকাল কোডে শেষ ও যাচাইকৃত। বিস্তারিত আর দরকার নেই — যা হয়েছে তার সারসংক্ষেপ:

| # | কাজ | Priority | অবস্থা |
|---|---|---|---|
| ০১ | **Prisma client caching fix** — `lib/core/db.ts`-এ production-এ প্রতি query-তে নতুন `PrismaClient` তৈরি হচ্ছিল। Connection pool শেষ হয়ে Hostinger Postgres-এ crash করত। Global singleton-এ আনা হয়েছে। | 🔴 | ✅ **সম্পন্ন** |
| ০২ | **Integration write IDOR (৭টি route)** — ownership check ছাড়া যেকোনো signed-in ব্যবহারকারী অন্য merchant-এর chatbot-এ token inject / config মুছতে পারত। canonical `getOwnedChatbot(userId, identifier)` gate (`lib/domain/chatbot-access.ts`) সবগুলোতে বসানো হয়েছে। Unauthorized-এ **404** (403 নয়) — যাতে অস্তিত্ব ফাঁস না হয়। | 🔴 | ✅ **সম্পন্ন** |
| ০৩ | **Read route IDOR** — `analytics/route.ts`, `sessions/[sessionId]/sse/route.ts`-এ একই ফাঁক (read-only)। একই gate। | 🔴 | ✅ **সম্পন্ন** |
| ০৪ | **WhatsApp webhook signature verification** — `app/api/webhooks/whatsapp/route.ts`-এ কোনো verification ছিল না; যে কেউ fake payload POST করে আপনার OpenRouter key-তে LLM call চালাতে পারত। `lib/core/meta-signature.ts`-এ shared helper বের করা হয়েছে (`verifyMetaSignature`, raw body + `X-Hub-Signature-256` + `timingSafeEqual`, fail-closed)। Instagram route-ও এখন একই helper ব্যবহার করে। | 🔴 | ✅ **সম্পন্ন** |
| ০৫ | **n8n webhook path audit** — `.env.example` template তৈরি (৩৮টি env var, কোনো আসল secret নেই) + `instrumentation.ts`-এ boot-time audit; প্রোডাকশনে `N8N_*_WEBHOOK_URL`-এ `/webhook-test/` পেলে `console.error` দেয়। `.gitignore`-এ `!.env.example` negation যোগ করা হয়েছে। | 🟠 | ✅ **সম্পন্ন** |

---

## Phase 2 — Monitoring ও Webhook নির্ভুলতা

> VPS ❌ · n8n ❌ — সবটাই এই repo-তেই শেষ হবে

---

### TASK-06 — Admin Health Panel: বানানো ডেটা সরানো

**Priority:** 🟠 High · **অবস্থা:** ✅ **সম্পন্ন** *(২০২৬-১০-১২)*

🎯 **কী**

`/admin/system` পেজটি এখন **শুধু মাপা-যায় এমন তথ্য** দেখাবে। যা মাপা যায় না, তা দেখাবে না বা "unknown" বলবে।

**নীতি: যা মাপা যায় তা দেখাও; যা মাপা যায় না তা দেখাবে না।**

❓ **কেন**

একটি health panel যেটি সত্যি বলতে পারে না, সেটি **না থাকার চেয়ে খারাপ** — কারণ admin ভরসা করে বসে থাকেন। আগের কোডে ১২টি জায়গায় বানানো ডেটা ছিল, যার মধ্যে সবচেয়ে খারাপ দুটি:

- **n8n fetch ব্যর্থ হলে `"online"` রিপোর্ট করত** — অর্থাৎ যে ব্যর্থতা ধরার জন্য এই panel আছে, সেটাই ঢেকে দিত।
- **notification না থাকলে ৩টি বানানো log line** দেখাত — যার একটি বলত "All message routing workflows active and synchronized", অথচ কোনো চেকই হয়নি।

📁 **ফাইল** *(৩টিই ইতিমধ্যে বদলানো হয়েছে)*

| ফাইল | কী করা হয়েছে |
|---|---|
| `app/api/admin/system/health/route.ts` | সম্পূর্ণ নতুন করে লেখা |
| `app/(admin)/admin/system/page.tsx` | fabricated UI সরানো |
| `public/locales/{en,bn}/admin.json` | `systemHealth`-এ ১০টি নতুন key |

**যা সরানো/ঠিক করা হয়েছে:**

| আগে | এখন |
|---|---|
| `uptime: "99.98%"` (fixed string) | **সরানো** — history ছাড়া মাপা অসম্ভব। বদলে `channels: { active24h, total }` (আসল সংখ্যা) |
| `latencyMs: Math.max(12, dbLatencyMs + 18)` (বানানো) | **সরানো** — push-based চ্যানেলে latency মাপাই যায় না। বদলে **"Last activity"** (আসল relative time) |
| `lastActivity: "1 min ago"` (fixed string) | আসল `ChatSession.updatedAt` থেকে (`groupBy platform → _max.updatedAt`) |
| `status: "active"` — তিন চ্যানেলেই hardcoded | recency থেকে: শেষ activity **< ১ ঘণ্টা** = `active`, **< ২৪ ঘণ্টা** = `idle`, নইলে `inactive` |
| fetch ব্যর্থ → `n8nStatus = "online"` | fetch ব্যর্থ → **`offline`**, `latencyMs = -1`, error log |
| `errorLogs` fallback — ৩টি বানানো লগ | **খালি array** + UI-তে "No system events recorded." empty-state |
| `handlePingChannel()` — `setTimeout(500)` ছাড়া কিছুই করত না, তারপর "ping successful (24ms)" দেখাত | **সরানো**। একটি POST ছাড়া webhook path পরখ করা যায় না; সত্যিকারের **Refresh** বাটনই যথেষ্ট |
| Badge সবসময় "Operational"/সবুজ | আসল status অনুযায়ী — `operational` / `degraded` / `down` (n8n বা DB offline হলে `down`) |
| `provider: "Neon PostgreSQL"` hardcoded | `DATABASE_URL`-এ `neon.tech` থাকলে "Neon PostgreSQL", নইলে "PostgreSQL" |
| Instagram চ্যানেল তালিকাতেই ছিল না | যোগ করা হয়েছে (`/api/webhooks/instagram`) |

**নতুন সতর্কবার্তা:** `N8N_WEBHOOK_URL`-এ `/webhook-test/` থাকলে পেজে হলুদ warning দেখায় — TASK-05-এর boot-audit-এর দৃশ্যমান সংস্করণ।

### ✅ যাচাইয়ের ফলাফল (২০২৬-১০-১২)

| # | যাচাই | ফলাফল |
|---|---|---|
| ১ | `npx tsc --noEmit` | **exit 0** — 0 error |
| ২ | `npm run build` | **exit 0** — পুরো build সফল, কোনো warning/error নেই |
| ৩ | Route + page-এ fabricated string (`99.98`, `1 min ago`, `Just now`, `ping successful`, `latencyMs: Math.max`, `All message routing workflows`) | **০টি** — শুধু ২টি কমেন্টে পুরনো আচরণের ব্যাখ্যা আছে (ইচ্ছাকৃত ডকুমেন্টেশন) |
| ৪ | Page-এ ভুল endpoint `/api/webhooks/facebook` | **০টি** |
| ৫ | কোডে `uptime` ব্যবহার | **০টি** (শুধু একটি কমেন্টে "কেন নেই" লেখা) |
| ৬ | `handlePingChannel` ফাংশন | **০টি** (শুধু একটি কমেন্টে "কেন সরানো হলো") |
| ৭ | Locale ফাইলে fabricated string | **০টি** |
| ৮ | JSX-এ hardcoded label (`Operational`, `Messaging Channels Active`, `Connected`) | **০টি** — সব `t()` দিয়ে |
| ৯ | `en` ও `bn` locale-এ `systemHealth`-এর key সেট | **অভিন্ন** (১৬টি key, দুটোতেই) |

> **যাচাইয়ের সীমাবদ্ধতা (সৎভাবে):** পেজটি `/admin` (admin-only, Clerk সুরক্ষিত) — তাই **লাইভ n8n/DB ডাউন করে দেখা হয়নি**, আর ব্রাউজারে চোখে দেখে যাচাইও করা হয়নি। যাচাই = static grep + `tsc` + `build` + locale key সমতা। **ইউজার নিজে `/admin/system` খুলে Dark ও Light দুই theme-এ দেখে নিলেই চূড়ান্ত।**

⚠️ **এই টাস্কের সাথে জড়িত একটি বাকি বিষয় (ইচ্ছাকৃতভাবে TASK-20-এ রাখা):** page-এ Facebook চ্যানেলের `endpoint` হিসেবে `/api/webhooks/n8n-facebook` দেখানো হচ্ছে — **এই route-টির অস্তিত্ব নেই** (শুধু `n8n-facebook/token-status/route.ts` আছে)। আগে ওখানে `/api/webhooks/facebook` ছিল, সেটিও ছিল না — অর্থাৎ দুটোই dead। সঠিক মান কী হবে তা **[TASK-20](#task-20--webhook-entry-point-ও-dead-reference-পরিষ্কার)** ঠিক করবে (ইউজারকে Meta Dashboard-এ FB-এর আসল Callback URL দেখতে হবে)।

---

### TASK-07 — Webhook নির্ভুলতা: dedupe + সঠিক retry semantics

**Priority:** 🟠 High · **অবস্থা:** ✅ **সম্পন্ন** *(২০২৬-১০-১৩)* · DB schema পরিবর্তন সম্পন্ন (`chatbot.WebhookDelivery`)

🎯 **কী**

তিনটি inbound webhook route-এ **দুটি সমস্যা একসাথে** ঠিক করতে হবে:

**(ক) Duplicate processing** — Meta একই event একাধিকবার পাঠায় (timeout, network glitch, বা normal retry policy: ~৭ দিন ধরে exponential backoff)। এখন কোনো dedupe নেই, তাই **একই মেসেজে দুবার reply + দুবার LLM খরচ**।

**(খ) নীরব message loss — এটিই বেশি ভয়ংকর** — বর্তমানে n8n-এ forward ব্যর্থ হলে route **HTTP 202** ফেরত দেয়:

```ts
// app/api/webhooks/whatsapp/route.ts:46-49  (instagram/route.ts:44-47-এও একই)
if (!response.ok) {
  return NextResponse.json({ received: true, forwarded: false }, { status: 202 });
}
```

`202` = "নিয়েছি ও মেনে নিয়েছি" — তাই **Meta আর retry করবে না**, আর মেসেজটি **চিরতরে হারিয়ে যাবে**। n8n ২ সেকেন্ডের জন্য ব্যস্ত থাকলে customer-এর মেসেজ হারায়, আর কেউ জানতেও পারে না।

সঠিক নকশা: **আগে dedupe করুন, তারপর forward; forward সফল হলে 200, ব্যর্থ হলে 5xx** — যাতে Meta retry করে, কিন্তু dedupe একই মেসেজ দুবার process হতে না দেয়। দুটো সমস্যা একই সমাধানে মেটে।

❓ **কেন**

- Duplicate = সরাসরি **আর্থিক ক্ষতি** (আপনার OpenRouter bill-এ) + customer দুটি একই reply পেয়ে বিভ্রান্ত হয়
- Silent loss = **নির্ভরযোগ্যতা হারানো**। একটি সেলস bot-এ একটি হারানো মেসেজ মানে একটি হারানো অর্ডার। অথচ system "সব ঠিক আছে" দেখায়।

📁 **ফাইল**

| ফাইল | কেন |
|---|---|
| `app/api/webhooks/whatsapp/route.ts` | dedupe + retry semantics |
| `app/api/webhooks/instagram/route.ts` | একই কাজ |
| `app/api/webhooks/n8n-facebook/route.ts` | ⚠️ **এই ফাইলটির অস্তিত্ব নেই** — Facebook-এর entry point আসলে কী, তা TASK-20-এ নিশ্চিত হতে হবে। নিশ্চিত হওয়ার পর এই route ফেলতে হবে (নাকি n8n সরাসরি পায় — সে অনুযায়ী সিদ্ধান্ত) |
| `prisma/schema/<উপযুক্ত ফাইল>.prisma` | নতুন model যোগ |
| `lib/core/webhook-idempotency.ts` | **নতুন** — shared helper |

💰 **খরচ সম্পর্কে:** dedupe চেকটি একটি ছোট indexed `INSERT` — Neon-এ ~৫-১৫ms। messenger-এর reply latency-তে এটি চোখে পড়ার মতো নয়, কিন্তু বাঁচায় পুরো একটি duplicate LLM call (৩-৬ সেকেন্ড + টাকা)।

🔧 **করণীয়**

**ধাপ ১ — নতুন Prisma model যোগ করুন** (উপযুক্ত schema ফাইলে, `chatbot` schema-র অধীনে):

```prisma
/// Inbound webhook idempotency ledger.
/// Meta retries deliveries for up to ~7 days, so a delivery key may repeat long
/// after the first attempt. The unique constraint is what makes the check
/// atomic — a duplicate insert fails instead of racing.
model WebhookDelivery {
  id         String   @id @default(cuid())
  provider   String   // "whatsapp" | "instagram" | "facebook"
  externalId String   // Meta's stable per-message id (wamid / mid)
  receivedAt DateTime @default(now())

  @@unique([provider, externalId])
  @@index([receivedAt])   // for the retention sweep
  @@schema("chatbot")
}
```

> 🔴 **এখানে থামুন।** DB-তে লেখার আগে **ইউজারের অনুমতি নিন** এবং আগে দেখান:
> ```bash
> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script
> ```
> Output-এ শুধু `CREATE TABLE "chatbot"."WebhookDelivery"` (+ index) থাকা উচিত। **`DROP` কিছুই থাকতে পারবে না** — `n8n_chat_histories` অক্ষত আছে কি না দেখে নিন। অনুমতি পেলে তবেই SQL চালান; `prisma db push` **কখনোই নয়**।

**ধাপ ২ — `lib/core/webhook-idempotency.ts`** (নতুন shared helper):

```ts
// English comments, as per project convention.
export type WebhookProvider = "whatsapp" | "instagram" | "facebook";

/** Pull every stable Meta message id out of a webhook payload. */
export function extractMessageIds(payload: unknown): string[]
```
- WhatsApp: `payload.entry[].changes[].value.messages[].id`
- Instagram: `payload.entry[].messaging[].message.mid` (এবং `changes[].value.message.mid` — দুই shape-ই সামলাবে)
- payload shape না মিললে/short-circuit: **খালি array ফেরাবে** (তখন dedupe skip করে forward করবে — মেসেজ হারানোর চেয়ে duplicate ভালো)
- `claimDeliveries(provider, ids)` → `createManyAndReturn({ skipDuplicates: true })` দিয়ে **একটিমাত্র atomic query**-তে নতুনগুলো লেখে এবং ঠিক কোনগুলো পেল তা ফেরত দেয়। *(পরিকল্পনায় `createMany` + `P2002` ধরা লেখা ছিল; `createManyAndReturn` আরও ভালো — কারণ এটি ঠিক কোন id-গুলো আসলে নতুন তা-ও বলে দেয়, যা আংশিক duplicate batch-এ দরকার)*
- সব id আগেই দেখা থাকলে → `{ isDuplicate: true }`

**ধাপ ৩ — দুইটি route-এ বসান** (তৃতীয়টি — Facebook — TASK-20-এ), এই ক্রমে:

1. Signature verify (আগেই আছে — হাত দেবেন না)
2. Payload parse
3. `claimDeliveries` → **সবগুলো duplicate** হলে সাথে সাথে `200` ফেরত দিন, **n8n-এ forward করবেন না**
4. n8n-এ forward
5. **সফল → `200`. ব্যর্থ → `502` এবং claim করা id-গুলো `releaseDeliveries` দিয়ে মুছে ফেলুন** (`202` নয়!) — release না করলে Meta-র retry duplicate হিসেবে বাদ পড়বে এবং মেসেজ চিরতরে হারাবে। এই ধাপটিই ৫০২-কে অর্থবহ করে।
6. dedupe ledger-এ পৌঁছানো না গেলে (DB ডাউন) → **fail-open**: log করে forward করুন। Duplicate, মেসেজ হারানোর চেয়ে ভালো।

**ধাপ ৪ — পুরনো row পরিষ্কার করার ব্যবস্থা:** একটি retention sweep (৭ দিনের বেশি পুরনো `WebhookDelivery` মুছে ফেলা)। Cron না থাকলে — `claimDeliveries`-এর ভেতরে ~১% সম্ভাবনায় একটি best-effort `deleteMany` চালানো যেতে পারে, অথবা একটি ছোট admin route। **যা-ই করুন, ব্যাখ্যা করে কমেন্ট লিখুন।**

✅ **গ্রহণযোগ্যতা**

- একই `message.id` দিয়ে **দুবার** একই POST পাঠালে → n8n **একবার** কল হয়, দুবারই `200` আসে
- n8n বন্ধ রেখে POST করলে → `502` আসে, **এবং claim মুছে ফেলা হয়** — তাই Meta-র retry নতুন মেসেজ হিসেবে forward হয় *(⚠️ এই লাইনটি সংশোধিত — `সংশোধনের লগ` দেখুন)*
- ভিন্ন `message.id` → সবসময় forward হয়
- `extractMessageIds` অপরিচিত payload-এ crash করে না (খালি array ফেরত দেয়)
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0
- ইউজার যা যা করতে হবে (DB migration চালানো, Meta dashboard-এ কিছু নয়) তা স্পষ্টভাবে জানানো

### ✅ বাস্তবায়নের রেকর্ড (২০২৬-১০-১৩)

| ফাইল | কী করা হয়েছে |
|---|---|
| `prisma/schema/merchant.prisma` | **নতুন** `WebhookDelivery` model (`chatbot` schema, `@@unique([provider, externalId])` + `receivedAt` index) |
| `lib/core/webhook-idempotency.ts` | **নতুন** — `extractMessageIds()`, `claimDeliveries()`, `releaseDeliveries()`, এবং `dedupeAndForward()` (claim → forward → ব্যর্থ হলে release) |
| `app/api/webhooks/whatsapp/route.ts` | `dedupeAndForward()` ব্যবহার; forward ব্যর্থ → **`502`** (আগে `202`) |
| `app/api/webhooks/instagram/route.ts` | একই কাজ |
| `app/api/cron/webhook-cleanup/route.ts` | **নতুন** — ৭ দিনের বেশি পুরনো row মুছে ফেলা (`CRON_SECRET` guard, বিদ্যমান cron-দের প্যাটার্ন) |
| `vercel.json` | `webhook-cleanup` cron এন্ট্রি (দৈনিক) — ⚠️ VPS-এ গেলে এটি [`scripts/cron/crontab.example`](../../scripts/cron/crontab.example)-এ সরবে, আর `vercel.json`-এর `crons` ব্লক মুছে যাবে (নাহলে দুইবার চলবে) |
| [`scripts/cron/`](../../scripts/cron/) | **নতুন (২০২৬-১০-১৩)** — VPS scheduler: `run-cron.sh` (whitelisted jobs, retry, `307`/`401`/`503` স্পষ্ট রিপোর্ট, `-L` ছাড়া `curl`), `crontab.example` (৪ দৈনিক + `*/10`), `cron.env.example` |
| [`docs/cron-demo.md`](../cron-demo.md) | **নতুন** — ৫টি cron-এর একক তালিকা + VPS install নির্দেশ (§৪) + TASK-22 ছাড়া কিছুই চলবে না (§৩) |

**যা ইচ্ছাকৃতভাবে করা হয়নি:**
- `app/api/webhooks/n8n-facebook/route.ts` **তৈরি করা হয়নি** — Facebook-এর entry point কী, তা TASK-20-এর ইউজার-যাচাই সাপেক্ষ। `dedupeAndForward()` ইতিমধ্যে `provider: "facebook"` সাপোর্ট করে, তাই route বানালে সরাসরি বসানো যাবে।

### ✅ যাচাইয়ের ফলাফল (২০২৬-১০-১৩)

| # | যাচাই | ফলাফল |
|---|---|---|
| ১ | `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script` | শুধু `CREATE TABLE chatbot.WebhookDelivery` + ২টি `CREATE INDEX` → অনুমোদিত preview-এর সাথে **হুবহু মিলে** |
| ২ | `prisma db execute` (শুধু CREATE, `db push` **নয়**) | `Script executed successfully.` |
| ৩ | Migration-এর পর পুনরায় diff | `WebhookDelivery`-এর কোনো `CREATE` আর নেই — টেবিল **সত্যিই তৈরি** |
| ৪ | `information_schema.tables`-এ সরাসরি query | `chatbot.WebhookDelivery` ✅ · `chatbot.n8n_chat_histories` ✅ · `public.n8n_chat_histories` ✅ — **কিছুই মুছে যায়নি** |
| ৫ | `npx tsc --noEmit` | **exit 0** — 0 error |
| ৬ | `npm run build` | **exit 0** — সম্পূর্ণ build সফল |
| ৭ | Route-এ `202` অবশিষ্ট আছে কি | **০টি** — দুটিই এখন `502`/`503` |
| ৮ | `createManyAndReturn` সাপোর্ট | নিশ্চিত (Prisma 7.8.0, generated client-এ `WebhookDeliveryCreateManyAndReturnArgs`-এ `skipDuplicates` আছে) — তাই dedupe **একটিমাত্র atomic query** |
| ৯ | **Live smoke test — আসল ডেটাবেসের বিরুদ্ধে** (jiti দিয়ে `lib/core/webhook-idempotency.ts` সরাসরি চালানো) | **২২/২২ PASS** — নিচে বিস্তারিত |

### ✅ Smoke test-এর ফলাফল (২০২৬-১০-১৩)

| যাচাই | ফলাফল |
|---|---|
| WhatsApp `changes[].value.messages[].id` (২টি id) | ✅ `["wamid.A","wamid.B"]` |
| WhatsApp **status receipt** (`statuses` only) | ✅ `[]` — ইচ্ছাকৃতভাবে বাদ, dedupe skip করে forward হবে |
| Instagram `messaging[].message.mid` · `changes[].value.message.mid` | ✅ দুটো shape-ই |
| এক payload-এ থাকা duplicate id | ✅ একটি হয় |
| malformed payload — `null`, string, number, `{}`, `entry:"x"`, `entry:[null]`, `id:123` (number), `messages:{}` | ✅ **৮টিই `[]` ফেরত দেয়, একটিও crash করে না** |
| প্রথম claim → ২টি id-ই পায়, `isDuplicate: false` | ✅ |
| একই id আবার claim → কিছুই পায় না, `isDuplicate: true` | ✅ |
| **আংশিক** overlap (`[id2, id3]` যেখানে id2 ইতিমধ্যে claimed) → **শুধু id3** | ✅ — `createManyAndReturn` বেছে নেওয়ার কারণই এটাই |
| একই `externalId` ভিন্ন provider-এ → স্বাধীন | ✅ |
| release → তিনটি row-ই যায় | ✅ |
| release-এর পর আবার claim → **পুনরায় পাওয়া যায়** (অর্থাৎ retry পথ কাজ করে) | ✅ — **সংশোধিত নকশার মূল যাচাই** |
| পরিষ্কার করার পর টেবিলে leftover | ✅ **০টি** (টেবিল আগের অবস্থায় ফেরত) |

> Smoke test-টি একটি অস্থায়ী স্ক্রিপ্ট দিয়ে চালানো হয়েছিল এবং **মুছে ফেলা হয়েছে** — repo-তে নতুন কোনো test ফাইল যোগ করা হয়নি (এই প্রকল্পে এখনো কোনো test runner নেই)।

> **যাচাইয়ের সীমাবদ্ধতা (সৎভাবে):** লাইভ Meta webhook দিয়ে end-to-end টেস্ট করা হয় **নি** (আসল Meta subscription + চলমান n8n দরকার)। যাচাই = schema/DB সরাসরি query + **আসল DB-র বিরুদ্ধে চলানো smoke test** + `tsc` + `build` + কোড পথ পর্যালোচনা। **Meta-র আসল retry আচরণ** (৭ দিনের backoff) মাপা সম্ভব নয় — সেটি ডকুমেন্টেশন-ভিত্তিক অনুমান।
>
> **জ্ঞাত সীমাবদ্ধতা ১ — আংশিক duplicate batch:** Meta যদি এক POST-এ একাধিক মেসেজ পাঠায় যার কিছু নতুন ও কিছু পুরনো, পুরো payload-ই forward হয় — অর্থাৎ পুরনোটি একবার duplicate process হতে পারে। payload পুনর্লিখন ইচ্ছাকৃতভাবে করা হয়নি (status callback হারানোর ঝুঁকি বেশি)। WhatsApp-এ সাধারণত প্রতি POST-এ একটিই মেসেজ আসে।
>
> **জ্ঞাত সীমাবদ্ধতা ২ — ledger ডাউন হলে fail-open:** DB-তে পৌঁছানো না গেলে dedupe **skip** করে forward করা হয় (ইচ্ছাকৃত: duplicate, মেসেজ হারানোর চেয়ে ভালো)। সেই সময়টুকুতে duplicate protection নেই, এবং `console.error`-এ তা জানানো হয়।
>
> **আচরণগত পরিবর্তন — unconfigured channel এখন `503` (আগে `200`):** `N8N_*_WEBHOOK_URL` না থাকলে আগে `200 {forwarded:false}` ফেরত আসত, অর্থাৎ চ্যানেলটি **প্রতিটি মেসেজ নীরবে খেয়ে ফেলত**। এখন `503` — Meta retry করবে এবং সমস্যাটি log-এ স্পষ্ট থাকবে।

---

### TASK-20 — Webhook entry-point ও dead reference পরিষ্কার

**Priority:** 🟡 Low (কিন্তু বিভ্রান্তিকর, আর নিরাপত্তা-সংশ্লিষ্ট) · **অবস্থা:** ⬜ বাকি

🎯 **কী**

`proxy.ts`-এর public-route তালিকায় এমন pattern আছে যার **কোনো route নেই**, এবং কোডে এমন endpoint লেখা আছে যা **অস্তিত্বই নেই**। প্রতিটির হয় route বানাতে হবে, নয়তো reference মুছতে হবে — "না থাকে আবার উল্লেখ থাকে" অবস্থা সবচেয়ে খারাপ।

❓ **কেন**

1. **Dead public pattern = নিরাপত্তা ঝুঁকি।** `proxy.ts`-এর `isPublicRoute` মানে **Clerk সুরক্ষা বন্ধ**। যে pattern-এর route নেই সেটি আজ নিরীহ, কিন্তু ভবিষ্যতে কেউ একই নামে route বানালে সেটি **নীরবে unauthenticated** হয়ে যাবে। কেন আছে, তা কারো জানা থাকবে না।
2. **ভুল endpoint = ভুল ডিবাগিং।** Admin panel ও comment বলছে Meta "এখানে" পাঠায়, অথচ সেখানে কিছু নেই — সমস্যা হলে ভুল জায়গায় খুঁজবেন।

📁 **ফাইল ও যা যা পাওয়া গেছে** *(যাচাইকৃত)*

| কোথায় | সমস্যা |
|---|---|
| `proxy.ts:19` — `'/api/webhooks/n8n-facebook(.*)'`, comment: *"n8n Facebook relay (Meta sends here)"* | **এই route নেই।** ডিরেক্টরিতে শুধু `app/api/webhooks/n8n-facebook/token-status/route.ts` আছে |
| `proxy.ts:18` — `'/api/webhooks/meta(.*)'` | **এই route নেই, আর কোথাও reference-ও নেই।** সম্পূর্ণ orphan |
| `app/api/admin/system/health/route.ts:30` — FB চ্যানেলের `endpoint: "/api/webhooks/n8n-facebook"` | অস্তিত্বহীন route দেখাচ্ছে |
| `.env` — `Next_JS_WEHBOOK` key **৩ বার** (বানান ভুল) | কোডে কোথাও ব্যবহৃত হয় না; শুধু বিভ্রান্তিকর |
| `architecture-analysis.md` §৬.৫ — `/api/webhooks/facebook` উল্লেখ | পুরনো তথ্য; প্রকৃত অবস্থা উপরের সারি |

🔧 **করণীয়**

1. **প্রথমে ইউজারকে জিজ্ঞেস করুন** (এটি কোড দেখে বোঝা অসম্ভব): **Facebook-এর জন্য Meta App Dashboard-এ Callback URL কী দেওয়া আছে?** দুটি সম্ভাবনা:
   - (ক) **n8n-এর URL** (যেমন `https://<n8n-host>/webhook/driplare-facebook`) → তাহলে Meta সরাসরি n8n-এ যায়, Next.js-এর কোনো route লাগবে না। **এইটিই সম্ভবত সত্য** (analysis-ও তাই বলছে)।
   - (খ) **`https://driplare-ai.vercel.app/api/webhooks/n8n-facebook`** → তাহলে route **তৈরি করতে হবে** (WhatsApp/Instagram-এর মতো: verify signature → dedupe → n8n-এ forward)।
2. উত্তর অনুযায়ী:
   - (ক) হলে → `proxy.ts:19`-এর dead pattern **মুছুন** (comment-সহ), `/api/webhooks/meta(.*)` **মুছুন**, এবং `health/route.ts`-এ FB চ্যানেলের endpoint **আসল n8n webhook URL** করুন (এবং `provider`/`endpoint` ধারণাটি পরিষ্কার করুন — কিছু চ্যানেল Next.js route-এ আসে, কিছু সরাসরি n8n-এ)।
   - (খ) হলে → `app/api/webhooks/n8n-facebook/route.ts` বানান, WhatsApp route-এর কাঠামো হুবহু অনুসরণ করে (TASK-07-এর dedupe সহ)।
3. `.env` ও `.env.example` থেকে `Next_JS_WEHBOOK` (৩টি) মুছুন। কোথাও দরকার হলে আলাদা নামে একটি সঠিক key দিন।
4. ✅ `architecture-analysis.md` §৬.৫-এ সংশোধনী নোট **ইতিমধ্যে যোগ করা হয়েছে** (২০২৬-১০-১২) — আবার করতে হবে না।

✅ **গ্রহণযোগ্যতা**

- `proxy.ts`-এর `isPublicRoute`-এ প্রতিটি pattern-এর পিছনে **একটি বাস্তব route** আছে (অথবা সরানো হয়েছে) — তালিকা মিলিয়ে দেখানো হবে
- Admin panel-এর প্রতিটি channel যে endpoint দেখায়, সেটি **সত্যিই আছে**
- `Next_JS_WEHBOOK` কোথাও নেই
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

---

### TASK-22 — Cron route গুলো আসলে চলেই না (Clerk ব্লকার)

**Priority:** 🔴 Critical · **অবস্থা:** ⬜ বাকি · *TASK-07 চলাকালীন আবিষ্কৃত (২০২৬-১০-১৩)*
**🗓️ ইউজারের সিদ্ধান্ত (২০২৬-১০-১৩): এখন নয়** — আগে নিজে যাচাই করবেন, তারপর ঠিক করা হবে। *(যাচাইয়ের সবচেয়ে সহজ উপায় এখন §"নিরাপদ যাচাই" — একটি `curl`; VPS হোক বা Vercel, একই ফল।)*

🎯 **কী**

`proxy.ts`-এর `isPublicRoute`-এ `/api/cron/(.*)` **নেই**, অথচ `proxy.ts`-ই এই repo-র একমাত্র middleware (`git ls-files` → শুধু `proxy.ts`; আলাদা `middleware.ts` নেই)। matcher `'/(api|trpc)(.*)'` — তাই প্রতিটি `/api/cron/*` request Clerk-এর `auth.protect()`-এ আটকে যায়। **কোনো scheduler-ই Clerk session পাঠায় না** — Vercel Cron হোক বা VPS-এর `curl`, দুটোই শুধু `Authorization: Bearer $CRON_SECRET` পাঠায়।

> 🔁 **Scheduler বদলে ফেললেও বাগটি একই থাকে** (২০২৬-১০-১৩: প্রোডাকশন VPS-এ যাওয়ার সিদ্ধান্ত)। VPS-এর crontab `*/10` frequency-র সমস্যা মিটিয়ে দেয়, কিন্তু Clerk-এর ব্লকার ছোঁয় না — বরং স্ক্রিপ্ট লগে জোরে `REDIRECTED (HTTP 307)` দেখাবে। তাই **TASK-22 এখনো অপরিহার্য**, আর ততক্ষণ TASK-07-এর `webhook-cleanup`-সহ ৫টি cron-ই অচল থাকবে।

**ফল: `/api/cron/*`-এর route handler সম্ভবত কখনো চলে না।**

❓ **কেন**

এটি ইতিমধ্যে একবার ঘটেছে এবং লিপিবদ্ধ আছে — মূল `task.md`-তে:

> **২. `proxy.ts` — দ্বিতীয় লুকানো ব্লকার।** `/api/automations/evaluate` `isPublicRoute`-এ ছিল না। ডিপ্লয় করলেও Clerk-এর `auth.protect()` n8n-কে sign-in-এ পাঠিয়ে দিত। যোগ করা হয়েছে।

ঠিক একই ভুল এখানেও, কিন্তু লক্ষ্যবস্তু ভিন্ন। প্রভাবে ক্ষতিগ্রস্ত (সম্ভাব্য):

| route | না চললে কী হয় |
|---|---|
| `/api/cron/reset-credits` | মাসিক credit reset হয় না → merchant-দের credit balance কখনো রিফ্রেশ হয় না |
| `/api/cron/process-downgrades` | plan downgrade কার্যকর হয় না → বাতিল করা customer-ও আগের plan পেতে থাকেন (**আয় হারানো**) |
| `/api/cron/usage-alerts` | usage সতর্কবার্তা যায় না → customer সীমা ছাড়িয়ে যান, জানতেও পারেন না |
| `/api/cron/webhook-cleanup` *(নতুন, TASK-07)* | `WebhookDelivery` টেবিল অসীম বাড়ে → dedupe index ধীরে ধীরে ভারী হয় |

⚠️ **অনুমান নয়, যাচাই করা:** `proxy.ts`-ই একমাত্র middleware · `/api/cron` `isPublicRoute`-এ নেই · একই class-এর বাগ আগে এখানেই ধরা পড়েছে। তবে **লাইভ invocation log দেখা হয়নি** — নিচের দুটোর যেকোনো একটি দিয়ে নিশ্চিত হওয়া যাবে।

**নিরাপদ যাচাই (কোনো বদল ছাড়াই) — `-L` ছাড়া `curl`:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" \
  <BASE_URL>/api/cron/usage-alerts
```
| ফল | মানে |
|---|---|
| `307` / `302` | **বাগ নিশ্চিত** ❌ — Clerk আটকে দিচ্ছে, handler চলে না |
| `200` | ঠিক আছে ✅ — Clerk ব্লকার নেই (বাকি অংশ শুধু `timingSafeEqual`) |
| `401` | `CRON_SECRET` মিলছে না |
| `500` | `CRON_SECRET` সেট করা নেই (`usage-alerts` `200` দিলেও চেক বাদ যাবে) |

> ⚠️ `-L` দেবেন না — redirect অনুসরণ করলে sign-in পেজের `200` আসে, আর আপনি ভাববেন job চলছে। Vercel-এ থাকলে বিকল্প: Project → **Cron Jobs** → প্রতিটির last-run status।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `proxy.ts` | `/api/cron/(.*)` public pattern যোগ (comment-সহ) |
| `app/api/cron/*/route.ts` | `CRON_SECRET` তুলনা **timing-safe** করা |

🔧 **করণীয়**

1. **প্রথমে প্রমাণ করুন** (এটি ছাড়া বদলাবেন না): উপরের `curl` চালিয়ে `307`/`302` দেখা, অথবা Vercel Dashboard → Cron Jobs → এন্ট্রিগুলোর last invocation status। যদি "Failed" দেখায় বা কোনো invocation-ই না থাকে → বাগ নিশ্চিত।
2. `proxy.ts`-এ যোগ করুন:
   ```ts
   '/api/cron/(.*)',  // Vercel Cron / VPS crontab — no Clerk session on the
                      // request; each route guards itself with
                      // `Authorization: Bearer $CRON_SECRET`
   ```
3. **একই সাথে তুলনাটি শক্ত করুন** — বর্তমানে cron route-গুলোতে `authHeader !== \`Bearer ${cronSecret}\`` (সাধারণ string compare, timing-attack-এ ঝুঁকিপূর্ণ)। `lib/core/meta-signature.ts`-এর মতো `crypto.timingSafeEqual` ব্যবহার করুন। public pattern যোগ করার সাথে সাথেই এটি করা উচিত, কারণ এরপর ওই route-গুলোর একমাত্র সুরক্ষা এই secret।
4. ✅ **সিদ্ধান্ত হয়ে গেছে (২০২৬-১০-১৩):** external scheduler-ই ব্যবহার করা হবে — **Hostinger VPS-এর crontab**। কোড [`scripts/cron/`](../../scripts/cron/) (`run-cron.sh`, `crontab.example`, `cron.env.example`), install-এর নির্দেশ [`cron-demo.md`](../cron-demo.md) §৪-এ। ⚠️ এটি এই সমস্যার সমাধান **নয়** — `/api/cron/*`-এ যেভাবেই কল হোক, Clerk একইভাবে আটকাবে।
5. **Vercel plan সীমা (এখন শুধু ইতিহাস):** ✅ যাচাই করা হয়েছে (Vercel docs, ২০২৬-০৭-১৫) — cron-এর **সংখ্যা** সব plan-এ **১০০**, অর্থাৎ ৪টি এন্ট্রি সমস্যা নয়। সীমা হলো **frequency**-তে: **Hobby-তে দিনে একবারের বেশি চলে না**, তাই `*/10 * * * *` দিলে *"Hobby accounts are limited to daily cron jobs"* error দিয়ে **পুরো deploy ফেল করে**। এটাই `run-automations`-এর এন্ট্রি সরানোর আসল কারণ — এবং **VPS-এ যাওয়ার আসল কারণ**। বিস্তারিত: [`cron-demo.md`](../cron-demo.md)।

✅ **গ্রহণযোগ্যতা**

- `<BASE_URL>/api/cron/usage-alerts`-এ `-L` ছাড়া `curl` **200** দেয় (আগে `307`) — Vercel-এ থাকলে: Cron Jobs-এর last-run status **200** (আগে হয় ব্যর্থ, নয়তো invocation-ই নেই)
- `reset-credits` হাতে trigger করে দেখা যায় যে credit আসলে reset হয়
- `CRON_SECRET` তুলনা timing-safe
- ভুল/অনুপস্থিত `Authorization` header দিলে **401** (public pattern-এর পরেও)
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

---

## Phase 3 — Merchant ডেটা সুরক্ষা

> VPS ❌ · **n8n সমন্বয় দরকার** (workflow ইউজার নিজে import করেন)

---

### TASK-08 — Token encryption at rest

**Priority:** 🔴 Critical · **অবস্থা:** ✅ **সম্পন্ন (2026-10-13)**

🎯 **কী**

`Integration.config` (Json) -এ সব integration token **সোজা plaintext** বসে আছে — `pageToken`, `accessToken`, `instagramAccessToken`, WhatsApp token ইত্যাদি। এগুলো **field-level encryption (AES-256-GCM)** দিয়ে encrypt করতে হবে।

❓ **কেন**

ডাটাবেস ফাঁস হলে (একটি leaked `DATABASE_URL`, একটি ভুল permission, Neon account compromise) — **সব merchant-এর Facebook Page hijack** হয়ে যাবে, WhatsApp Business account দিয়ে যেকেউ মেসেজ পাঠাতে পারবে। একটি SaaS-এ এটি এমন মাত্রার ক্ষতি যা ফিরিয়ে আনা প্রায় অসম্ভব। এনক্রিপ্টেড থাকলে চুরি হওয়া ডাম্প প্রায় অকেজো।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `prisma/schema/merchant.prisma:134-149` | `Integration` model — `config Json` |
| `lib/core/crypto.ts` | **নতুন** — encrypt/decrypt helper |
| `app/api/chatbots/[chatbotId]/integrations/**` | token লেখা/পড়ার সব জায়গা |
| `hooks/integrations/**` | client-এ token ফেরত দেওয়া হচ্ছে কি না, দেখতে হবে |
| `docs/n8n-JSON/*.json` | ⚠️ n8n workflow — সরাসরি Postgres থেকে token পড়ে |

⚠️ **সবচেয়ে বড় ঝুঁকি — n8n সরাসরি DB পড়ে**

n8n-এর `WhatsApp-Integration.json`-এ `n8n-nodes-base.postgres` node আছে — অর্থাৎ n8n **সরাসরি Postgres-এ query করে token নেয়**, আপনার API দিয়ে নয়। তাই শুধু Next.js-এ encrypt করলে **n8n token পড়তে পারবে না → সব live channel সাথে সাথে বন্ধ**।

দুটি পথ (ইউজারকে দেখিয়ে সিদ্ধান্ত নিতে হবে):

| পথ | কী | সুবিধা | অসুবিধা |
|---|---|---|---|
| **ক** | n8n workflow-এ একটি Code node যোগ করা যা একই key দিয়ে decrypt করে | DB schema/flow অপরিবর্তিত | `INTEGRATION_ENCRYPTION_KEY` n8n-এর env-এও রাখতে হবে; workflow ইউজারকে import করাতে হবে |
| **খ** | n8n থেকে DB query সরিয়ে একটি internal API (`/api/internal/integration-config`, `x-n8n-secret` দিয়ে সুরক্ষিত) থেকে token আনা | key শুধু এক জায়গায় (Vercel) | প্রতিটি AI reply-তে একটি cross-continent hop যোগ হয় (**latency বাড়বে**) |

> **সুপারিশ: পথ ক** — latency সবচেয়ে দামি সম্পদ, আর key দুই জায়গায় থাকা n8n-এর নিজস্ব `N8N_ENCRYPTION_KEY`-এর মতোই স্বাভাবিক অভ্যাস।

🔧 **করণীয়**

1. **Key:** `INTEGRATION_ENCRYPTION_KEY` (৩২ byte, base64) — `.env.example`-এ placeholder যোগ করুন। Boot-time audit-এ (TASK-05-এর `instrumentation.ts`) যোগ করুন: প্রোডাকশনে key না থাকলে `console.error`।
2. **Helper:** `lib/core/crypto.ts`
   ```ts
   // Format: v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>
   // The version prefix is what makes a future key rotation possible, and lets
   // decryptSecret() recognise values that were written before encryption existed.
   export function encryptSecret(plaintext: string): string
   export function decryptSecret(value: string): string
   ```
3. **Dual-read (rollout-এর চাবি):** `decryptSecret` যদি দেখে মান `v1:` দিয়ে শুরু হয় → decrypt; নইলে **plaintext ধরে নিয়েই ফেরত দেয়**। ফলে:
   - Encrypt করার আগের পুরনো row-ও কাজ করতে থাকবে → **কোনো downtime নেই**
   - ধীরে ধীরে re-encrypt করা যাবে, বড় bang নয়
4. **Migration script:** প্রতিটি `Integration` পড়ে, `config`-এর ভেতরের token field-গুলো encrypt করে ফেরত লেখে। ⚠️ **এটি DB-তে লেখে — ইউজারের অনুমতি ছাড়া চালাবেন না।** প্রথমে `--dry-run` mode বানিয়ে কতটি row বদলাবে দেখান।
5. **n8n দিক:** প্রভাবিত workflow JSON-গুলোতে decrypt ধাপ যোগ করুন (পথ ক) — কোন workflow, কোন node, কী বদলাবে তা লিখিতভাবে ইউজারকে দিন, কারণ **ইউজার নিজে import করবেন**।
6. **Client-এ token ফাঁস হচ্ছে কি না** — যাচাই করুন; থাকলে সেটিও বন্ধ করুন।

✅ **গ্রহণযোগ্যতা**

- নতুন সংযোগে DB-তে `v1:...` ফরম্যাটে token লেখা হয় — **plaintext নয়** (`grep` করে দেখানো হবে)
- পুরনো (plaintext) row নিয়েও সব কিছু আগের মতোই চলে — কোনো downtime নেই
- n8n প্রতিটি channel-এ reply পাঠাতে পারে (ইউজার লাইভ টেস্ট করবেন)
- `INTEGRATION_ENCRYPTION_KEY` `.env.example`-এ documented
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

### ✅ বাস্তবায়নের রেকর্ড (২০২৬-১০-১৩)

**সিদ্ধান্ত: পথ ক** — n8n workflow-এ decrypt Code node। কারণ critical path-এ নতুন network hop যোগ করা চলে না; একটি সাধারণ AI reply-তে ইতিমধ্যে ১১টি serial hop আছে, আর path খ প্রতি reply-তে ~২৩০ms যোগ করত।

**নতুন ফাইল**

| ফাইল | কী |
|---|---|
| [`lib/core/crypto.ts`](../../lib/core/crypto.ts) | `encryptSecret` / `decryptSecret` (AES-256-GCM), dual-read, `SECRET_CONFIG_KEYS`, `findPlaintextSecretKeys` |
| [`lib/core/key-fingerprint.ts`](../../lib/core/key-fingerprint.ts) | Edge-safe key validation + fingerprint (WebCrypto — Node `crypto` নয়) |
| [`lib/core/db-encryption.ts`](../../lib/core/db-encryption.ts) | Prisma `$extends` query hook — write-এ encrypt, read-এ decrypt |
| [`lib/domain/integration-config.ts`](../../lib/domain/integration-config.ts) | `SAFE_CONFIG_KEYS` allow-list + `toPublicIntegration()` — response থেকে credential ছাঁকা (ধাপ ৬) |
| [`scripts/encrypt-integration-secrets.ts`](../../scripts/encrypt-integration-secrets.ts) | Backfill; `--apply` ছাড়া **কিছুই লেখে না** |
| [`docs/integration-token-encryption.md`](../integration-token-encryption.md) | Rollout নির্দেশ — ক্রম, যাচাই, rollback |

**পরিবর্তিত ফাইল**

| ফাইল | কী বদলালো |
|---|---|
| [`lib/core/db.ts`](../../lib/core/db.ts) | shared client-এ `$extends` যুক্ত; `createBasePrismaClient()` export (script raw bytes দেখতে পারে, নইলে encrypted row আর plaintext row আলাদা করা যেত না) |
| [`instrumentation.ts`](../../instrumentation.ts) | boot-এ key audit + production-এ ৮-অক্ষরের fingerprint লগ |
| [`.env.example`](../../.env.example) | `INTEGRATION_ENCRYPTION_KEY` — কীভাবে বানাতে হবে, কেন n8n-এও লাগবে |
| [`package.json`](../../package.json) | `secrets:audit` (dry run) · `secrets:encrypt` (`--apply`) |
| `docs/n8n-JSON/{Facebook,Instagram,WhatsApp}-Integration.json` | `Fetch Integration` ↔ `Guard Active`-এর মাঝে **`Decrypt Integration Secrets`** Code node; নিচের সব `$('Fetch Integration')` reference নতুন node-এ ঘোরানো (FB ১১ · IG ১৮ · WA ১০) |
| ৮টি API route | `NextResponse.json(integration)` → `toPublicIntegration(integration)`; `config` এখন server-side allow-list দিয়ে ছাঁকা |

**কেন Prisma `$extends`, call site নয়**

`db.integration.*` প্রায় ৪০টি জায়গা থেকে ডাকা হয়। প্রতিটিতে হাত দিলে দুটি **নীরব** ব্যর্থতা থাকে — একটি write site বাদ পড়লে ওই token চিরতরে plaintext-এ থেকে যায় (অর্থাৎ ঠিক যে ঝুঁকি বন্ধ করতে এই টাস্ক, সেটিই খোলা থাকে), আর একটি read site বাদ পড়লে ciphertext access token হিসেবে Meta-তে যায়। Hook একবারে দুটোই ঢাকে, এবং existing ~৪০টি call site-এর টাইপ অপরিবর্তিত থাকে।

**কী encrypt হয়, কী ইচ্ছাকৃতভাবে plaintext থাকে**

| Encrypt ✅ | Plaintext ✅ (ইচ্ছাকৃত) |
|---|---|
| `pageToken`, `pageAccessToken`, `accessToken`, `instagramAccessToken`, `userAccessTokenLongLived` | `pageId`, `phoneNumberId`, `instagramAccountId`, `wabaId`, `connectionSource` |

কারণ n8n-এর SQL `WHERE i.config->>'pageId' = '...'` কেবল plaintext-এ match করে। ৭টি workflow-এর প্রতিটি `config->>'...'` reference grep করে যাচাই করা হয়েছে — `WHERE` clause-এ কোনো secret নেই।

**ধাপ ৬ — Client-এ credential ফাঁস: পাওয়া গেছে এবং বন্ধ করা হয়েছে**

Encryption at rest token লুকায় **ডাটাবেসে**। কিন্তু কয়েকটি API route Prisma row-টি **হুবহু** `NextResponse.json()`-এ ফেরত দিচ্ছিল — অর্থাৎ decrypt হওয়া live token সরাসরি browser-এ যেত। এতে encryption-এর সুবিধা অনেকটাই মুছে যেত: token আবার browser memory-তে, devtools-এর Network tab-এ, client-side error reporter-এ এবং সামনের যেকোনো proxy log-এ পড়ে থাকত।

সবচেয়ে বড় ক্ষেত্রটি ছিল [`app/api/integrations/route.ts`](../../app/api/integrations/route.ts) — workspace-এর **প্রতিটি bot-এর প্রতিটি integration** এক response-এ ফেরত দিত, `config` অপরিবর্তিত অবস্থায় (৭টি row-এর সবগুলো একসাথে)।

সমাধান — একটি shared **allow-list**, deny-list নয়:

> নতুন একটি credential field যোগ হলে সেটি **default-এ client-এ যায় না**। Deny-list হলে কেউ নাম যোগ করতে ভুল করলে সেটি চুপচাপ ফাঁস হত — আর ঠিক এই ধরনের নীরব ব্যর্থতা এড়াতেই allow-list বেছে নেওয়া হয়েছে।

`SAFE_CONFIG_KEYS`-এ থাকে শুধু display/identity field এবং UI-এর প্রয়োজনীয় setting।

⚠️ `muteAiOnHandover`, `directMessagingAiEnabled`, `tokenStatus` ইচ্ছাকৃতভাবে তালিকায় রাখা হয়েছে। কারণ [`ConfigureChannelModal.tsx`](../../components/integrations/ConfigureChannelModal.tsx) এগুলো পড়ে **আবার লিখেও দেয়** — তালিকা থেকে বাদ দিলে modal নিজের default ধরে নিত এবং পরের Save-এ merchant-এর আসল setting মুছে যেত। অর্থাৎ whitelist করার আগে UI-এর প্রতিটি `config.*` read grep করে দেখা হয়েছে।

`n8nWebhookUrl` বাদ দেওয়া হয়েছে — এটি credential নয়, কিন্তু internal infrastructure path; browser-এর এটি জানার দরকার নেই।

**⚠️ আলাদা একটি গুরুতর ফাঁস — `/api/test-db` (route-টি মুছে ফেলা হয়েছে)**

`app/api/test-db/route.ts` একটি debug route ছিল যা:

1. **কোনো authentication নেই** — `auth()` কলই করা হয় না, অর্থাৎ যেকোনো anonymous request ডাটা পেত;
2. `integration.findMany({ take: 10 })` চালিয়ে **পুরো `config` সহ** row ফেরত দিত — অর্থাৎ সব `pageToken`;
3. সঙ্গে `chatSession.findMany({ take: 50 })` — merchant-এর customer ডাটাও।

অর্থাৎ উপরের ৮টি route-এ ফাঁস বন্ধ করেও এই একটি route পুরো TASK-08-এর উদ্দেশ্য নস্যাৎ করে দিত: ডাটাবেসে token encrypted থাকত, কিন্তু একটি public URL সেগুলো decrypt করে দেখিয়ে দিত।

কোডবেসে `test-db` কোথাও reference করা নেই (grep-এ শূন্য match) — এটি পরীক্ষার সময়কার leftover। তাই sanitise না করে **route-টি মুছে ফেলা হয়েছে** (`git rm app/api/test-db`)।

**যেসব route-এ ফাঁস ছিল (৮টি)** — [`app/api/integrations/route.ts`](../../app/api/integrations/route.ts) · [`app/api/integrations/[integrationId]/route.ts`](../../app/api/integrations/[integrationId]/route.ts) (`PATCH`) · `chatbots/[chatbotId]/integrations/route.ts` (duplicate whitelist সরিয়ে shared module) · `.../integrations/[platform]/route.ts` · `.../[platform]/connect/route.ts` · `.../[platform]/disconnect/route.ts` · `.../facebook/connect/route.ts` · `.../n8n_facebook/connect/route.ts`

**আগেই নিরাপদ ছিল (৪টি route)** — `instagram/connect`, `whatsapp/connect`, `whatsapp/embedded/connect` (তিনটিই হাতে বাছা object ফেরত দেয়) এবং `instagram/oauth/callback` (redirect করে, row ফেরত দেয় না)।

`[platform]/disconnect`-এ ফাঁস ছিল না (`config: {}` সেট করা হয়), তবুও sanitiser বসানো হয়েছে — যাতে **নিয়মটি একটি থাকে**: কোনো route কাঁচা integration row ফেরত দেয় না। ব্যতিক্রম রাখলে পরের বার কেউ সেটিকেই নজির ধরে ফাঁস খুলে ফেলতে পারেন।

**ক্রম — ভাঙা এড়ানোর একমাত্র উপায়**

n8n token অ্যাপের API দিয়ে নয়, **সরাসরি Postgres থেকে** পড়ে। তাই:

১. n8n-এ decrypt node deploy → ২. অ্যাপ deploy → ৩. backfill → ৪. live test

ধাপ ১ এখনই নিরাপদ: decrypt node `v1:` না পেলে value অপরিবর্তিত রাখে, তাই সব row plaintext থাকা অবস্থায় import ও test করা যায় (শূন্য প্রভাব)। বিস্তারিত: [`integration-token-encryption.md`](../integration-token-encryption.md)

**যাচাইয়ের ফলাফল (২০২৬-১০-১৩)**

| যাচাই | পদ্ধতি | ফলাফল |
|---|---|---|
| Round-trip, dual-read, tamper rejection, nested/sentinel handling, key error message, fingerprint | ১৯টি দাবি চালিয়ে | ✅ **১৯/১৯ PASS** |
| Edge Runtime বান্ডল | `npm run build` | ✅ warning শূন্য (key inspection edge-safe module-এ সরানো হয়েছে) |
| Type check | `npx tsc --noEmit` | ✅ exit 0 — ০ error |
| Build | `npm run build` | ✅ exit 0, কোনো warning/error নেই |
| Lint (নতুন ফাইল) | `npm run lint` | ✅ নতুন ৬টি ফাইলে ০ finding (বাকি ৩৮৫টি pre-existing) |
| Extended client দিয়ে পড়া | read-only probe, **key ছাড়া** | ✅ ৭টি row পড়া গেছে — dual-read live DB-তে প্রমাণিত |
| DB-তে plaintext কোথায় | `npm run secrets:audit` (dry run) | ✅ **২টি row** — দুটোই facebook; WhatsApp/Instagram এখনো কেউ connect করেনি |
| n8n workflow graph | JSON parse + graph assertion | ✅ **২৭/২৭ PASS** — wiring ঠিক, stale `$('Fetch Integration')` reference ০, orphan node ০ |
| Client-এ token ফাঁস — route sweep | ১৩টি route-এর response shape হাতে পড়ে যাচাই | ✅ **৮টিতে ফাঁস ছিল → সব বন্ধ**; ৪টি আগেই নিরাপদ ছিল |
| `integration-config` helper | ২৪টি assertion চালিয়ে | ✅ **২৪/২৪ PASS** — token বাদ পড়ে, UI-এর setting টিকে থাকে, `null`/array/string config ক্র্যাশ করে না, ভবিষ্যতের অজানা key default-এ বাদ পড়ে |
| ধাপ ৬-এর পর type check + build | `npx tsc --noEmit` · `npm run build` | ✅ দুটোই exit 0; lint-এ নতুন ফাইলে ০ finding |
| `/api/test-db` ডাম্প | route-এর auth ও response হাতে পড়ে + পুরো কোডবেসে reference grep | ✅ **auth ছিলই না, reference ০ → route মুছে ফেলা হয়েছে** |

> ⚠️ **সবচেয়ে গুরুত্বপূর্ণ পাওয়া তথ্য:** backfill মাত্র **২টি row** বদলাবে, দুটোই Facebook (`pageToken` + `userAccessTokenLongLived`)। অর্থাৎ ঝুঁকির পরিধি ছোট — WhatsApp/Instagram-এ এখনো কোনো live credential নেই।

⚠️ **এখনো বাকি — ইউজারের কাজ**

- n8n-এ ৩টি workflow import + `NODE_FUNCTION_ALLOW_BUILTIN=crypto` ও `INTEGRATION_ENCRYPTION_KEY` env যোগ (নির্দেশ: [`integration-token-encryption.md`](../integration-token-encryption.md) §ধাপ ১)
- অ্যাপ deploy → `npm run secrets:encrypt` (**DB-তে লেখে — আলাদা অনুমতি সাপেক্ষ**) → প্রতিটি channel-এ live test

⚠️ **যাচাই করা হয়নি:** কোনো live Meta webhook end-to-end test চালানো হয়নি, এবং backfill **ইচ্ছাকৃতভাবে চালানো হয়নি** — `--apply` ইউজারের অনুমতি ছাড়া নিষিদ্ধ।

---

### TASK-09 — Order validation layer

**Priority:** 🟠 High · **অবস্থা:** ✅ সম্পন্ন (২০২৬-১০-১৩)

🎯 **কী**

AI যখন order তৈরি করে, তখন `Create Order` tool `$fromAI()`-এর দেওয়া মান **সোজা DB-তে INSERT** করে — কোনো validation ছাড়া। এর সামনে একটি validation স্তর বসাতে হবে (Zod schema + ন্যূনতম যাচাই)।

❓ **কেন**

AI ভুল name/phone/address দিতে পারে, হ্যালুসিনেট করতে পারে, বা customer "না" বলার পরও order বসিয়ে দিতে পারে। ফলে:
- **Courier ভুল ঠিকানায় যাবে** → টাকা ও বিশ্বাস দুটোই নষ্ট
- ভুয়া order-এ **inventory/analytics নষ্ট**
- ক্রেতার অর্ডার **না খেয়ে** থেকে যেতে পারে (AI ভেবেছে হয়েছে)

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `docs/n8n-JSON/Core-AI-Brain.json` | `Create Order` tool node |
| `prisma/schema/merchant.prisma` | order-সংশ্লিষ্ট model |
| `lib/validation/**` বা `lib/domain/orders.ts` | Zod schema + validation |
| `app/api/internal/...` | নতুন validation endpoint (নিচে দেখুন) |

🔧 **করণীয়**

1. **প্রথমে বর্তমান আচরণ বোঝুন:** n8n JSON-এ `Create Order` node খুঁজে বের করুন — কোন কোন ফিল্ড `$fromAI()` থেকে আসে, আর কোথায় INSERT হয়, তা লিখে ফেলুন।
2. **Zod schema বানান** (প্রকল্পে Zod আগেই আছে): phone (BD format), name (খালি নয়, দৈর্ঘ্য), address (ন্যূনতম দৈর্ঘ্য), quantity (ইন্টিজার, > ০, একটি sensible maximum), product (আসলেই ওই workspace-এর catalog-এ আছে কি না)।
3. **দুটি পথ — ইউজারকে দেখিয়ে সিদ্ধান্ত নিন:**
   - **ক) n8n-এর ভেতরে validation:** `Create Order`-এর আগে একটি Code node। দ্রুত, কিন্তু logic n8n JSON-এ আটকে যায় (version control দুর্বল) এবং Zod ব্যবহার করা যায় না।
   - **খ) Next.js-এ validation API:** নতুন route `POST /api/internal/orders` (TASK-05-এর মতো `x-n8n-secret` shared-secret + `timingSafeEqual` দিয়ে সুরক্ষিত)। n8n সরাসরি INSERT না করে এখানে POST করে। Zod-এর পূর্ণ শক্তি পাওয়া যায়, logic টেস্টযোগ্য, git-এ থাকে।
   > **সুপারিশ: পথ খ** — তবে এতে BD → US-East একটি hop যোগ হয় (~230ms)। যেহেতু এটি order-confirm path-এ (অপেক্ষাকৃত কম frequent), latency গ্রহণযোগ্য।
4. **পরীক্ষা ব্যর্থ হলে:** order তৈরি না করে AI-কে feedback দিন (n8n-এ error output → agent আরেকবার জিজ্ঞেস করবে)। ব্যবহারকারীকে কখনো ফেক confirmation দেখাবেন না।
5. **Confirmation step:** গুরুত্বপূর্ণ order-এ (যেমন phone/address) চূড়ান্ত INSERT-এর আগে customer-এর কাছ থেকে explicit হ্যাঁ নেওয়া — **অন্ততপক্ষে** AI-এর reply-তে সংক্ষিপ্ত সারসংক্ষেপ যাচাই করানো।

✅ **গ্রহণযোগ্যতা**

- ভুল phone/address/quantity দিলে order **তৈরি হয় না**, বরং একটি স্পষ্ট error লগ হয়
- সঠিক ডেটায় order আগের মতোই তৈরি হয় (regression নেই)
- validation logic-এ একটি unit test (সঠিক ও ভুল — দুই ধরনের case)
- কোন n8n workflow বদলাতে হবে তা লিখিতভাবে ইউজারকে দেওয়া
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0


📝 **বাস্তবায়ন — ২০২৬-১০-১৩**

**পথ খ বেছে নেওয়া হয়েছে — তবে পথ ক কার্যত অসম্ভব, এবং কারণটি টাস্ক লেখার সময় জানা ছিল না:**

`Create Order` একটি **AI tool** (`ai_tool` connection)। AI Agent ঠিক যখন প্রয়োজন তখনই তাকে ডাকে; গ্রাফে তার কোনো input edge নেই, তাই "আগে একটি Code node" বসানোর জায়গাই নেই। অর্থাৎ **পথ ক বাস্তবে implement করার উপায় ছিল না** — পথ খ-ই একমাত্র পথ।

| ফাইল | কী |
|---|---|
| `lib/core/timing-safe.ts` 🆕 | `timingSafeEqualString()` — shared secret-এর constant-time তুলনা |
| `lib/core/prisma-errors.ts` 🆕 | `isUniqueViolation()` / `isRecordNotFound()` |
| `lib/domain/order-schema.ts` 🆕 | Zod schema + normalization + catalogue মেলানো |
| `app/api/internal/orders/route.ts` 🆕 | order লেখার **একমাত্র** পথ |
| `lib/domain/order-schema.test.ts` · `lib/core/timing-safe.test.ts` · `lib/core/prisma-errors.test.ts` 🆕 | মোট **৭৮টি** unit test |
| `vitest.config.mts` 🆕 · `package.json` | test runner — প্রকল্পে আগে কোনো ছিল না |
| `docs/n8n-JSON/Core-AI-Brain.json` | `Create Order`: `postgresTool` → `httpRequestTool` |
| `app/api/automations/evaluate/route.ts` | হাতে লেখা `timingSafeEqual` তুলনা সরিয়ে shared helper |

**যে নিয়মগুলো এখন কার্যকর**

- **phone** — BD mobile (`01[3-9]` + ৮ digit)। `+880…`, `880…`, ট্রাঙ্ক `0` ছাড়া `1XXXXXXXXX`, ড্যাশ/স্পেস, এমনকি **বাংলা সংখ্যা (`০১৭…`)** — সব canonical `01XXXXXXXXX`-এ রূপান্তরিত হয়। না মিললে order তৈরি হয় না।
- **name** ২–১০০ অক্ষর · **address** ১০–৫০০ · **items** ১–২০ লাইন, প্রতি লাইনে `qty` ১–১০০
- **`items`** AI-এর পাঠানো JSON string বা আসল array — দুটোই গ্রহণ করে
- **total যাচাই** — AI-এর বলা total তার নিজের item লাইনগুলোর সাথে মিলতে হবে (±১ টাকা)। না মিললে order হয় না, কারণ এর মানে AI একটি লাইন ফেলে দিয়েছে বা বানিয়েছে
- **`productId` থাকলে DB-র দামই জেতে** — AI-এর মনে থাকা দাম কখনো invoice-এ যাবে না। `productId` এই chatbot-এর catalogue-এ না থাকলে, বা product inactive হলে order তৈরি হয় না। query `chatbotId` দিয়ে scoped, তাই অন্য workspace-এর id-ও একইভাবে ব্যর্থ হয়
- **`productId` না থাকলে** custom item ধরে নিয়ে AI-এর দাম রাখা হয় (merchant memang এমন জিনিস বেচে)
- চার্টার-বহির্ভূত key (যেমন `status`, `paymentStatus`) **বাদ পড়ে** — request body দিয়ে row-এর অবস্থা সেট করা যায় না
- `orderId` এখন `ORD-` + **৮** hex (আগে ৬) — আগের ১৬.৭M combination-এ ১০ হাজার order-এ সংঘর্ষ প্রায় নিশ্চিত ছিল

**API চুক্তি — `POST /api/internal/orders`**

`x-n8n-secret` (timing-safe; secret না থাকলে endpoint **বন্ধ**, খোলা নয়)।

**ব্যবসায়িক ব্যর্থতা সবসময় HTTP 200** + `{ success: false, reason, issues }`। কারণ n8n non-2xx-কে "node failed" বানায় — তখন AI Agent অস্পষ্ট transport error দেখে, আসল কারণটা নয়। 200 হলে agent `reason` পড়ে customer-কে **ঠিক জিনিসটাই** আবার জিজ্ঞেস করতে পারে। 401 / 400 / 500 শুধু সেইসবের জন্য যা AI ঠিক করতে পারে না।

**⚠️ যা এখনো করা হয়নি (TASK-23-এর অংশ)**

`Product Lookup`-এর `$fromAI('product_name')` এখনো সোজা SQL string-এ বসে (`ILIKE '%' || '…' || '%'`) — অর্থাৎ injection **এখনো খোলা**। TASK-09 সেটি মেটায় না (এটি একটি SELECT)। TASK-23-এ parameterized query (`$1`) দিয়ে মেটাতে হবে।

> 🧪 **ইউজারকে যাচাই করতে হবে (আমি চালাতে পারিনি):** `Core-AI-Brain.json` import করার পরে AI Agent-এ `Create Order` tool-টি খুলে নিশ্চিত করুন **ছয়টি parameter** দেখা যাচ্ছে — `customer_name`, `customer_phone`, `delivery_address`, `district`, `items_json`, `total_amount`। n8n `$fromAI()` কে tool schema-তে রূপান্তর করে, এবং এই node-টিই প্রথম যেটি `httpRequestTool` +`$fromAI()` ব্যবহার করছে — প্রকল্পে এর আগে এমন উদাহরণ ছিল না।


---

### TASK-23 — n8n tool node-এ SQL injection (`$fromAI()` escaping ছাড়া)

**Priority:** 🔴 Critical · **অবস্থা:** ⬜ বাকি · *Multimodal অডিট চলাকালীন আবিষ্কৃত (২০২৬-১০-১৩)*

🎯 **কী**

`Core-AI-Brain.json`-এর দুটি `postgresTool` node — `Product Lookup` ও `Create Order` — LLM-এর দেওয়া মান **escaping ছাড়া** সরাসরি SQL-এ বসায়:

```sql
-- Create Order (একই প্যাটার্ন Product Lookup-এও)
... '{{ $fromAI('customer_name', 'customer full name', 'string') }}', ...
```

`$fromAI()`-এর মান আসে **customer-এর নিজের লেখা টেক্সট থেকে** — তাই কেউ bot-কে একটি বাক্য লিখেই quote ভেঙে নিজের SQL চালাতে পারে। কোনো API key বা অ্যাকাউন্ট লাগে না।

❓ **কেন**

- **সবচেয়ে সহজ পথে সবচেয়ে বড় ক্ষতি।** আক্রমণকারীর যা লাগে: আপনার Facebook Page-এ একটি মেসেজ। prompt injection দিয়ে `customer_name`-এ `', '...` বসিয়ে SQL ভাঙা যায়।
- **Cross-tenant পড়া সম্ভব।** `Product Lookup`-এর `WHERE "chatbotId" = '...'` অংশটি comment করে দিলে অন্য merchant-এর পুরো প্রোডাক্ট ক্যাটালগ পড়া যায় — অর্থাৎ এটি শুধু "নিজের ডেটা নষ্ট" নয়, **অন্য ব্যবসার ডেটা পড়ার** পথ।
- **লেখাও সম্ভব — `Create Order` একটি INSERT।** ভুয়া order বসানো, বা `RETURNING` ব্যবহার করে ডেটা বের করা।
- **ঝুঁকিটি ইতিমধ্যেই জানা ছিল।** একই ফাইলের `Save Chat History` node-এ `.replace(/'/g, "''")` করা আছে — শুধু tool node-দুটোতে প্রয়োগ করা হয়নি। অর্থাৎ এটি নতুন আবিষ্কার নয়, একটি **বাদ পড়া জায়গা**।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| [`docs/n8n-JSON/Core-AI-Brain.json`](../n8n-JSON/Core-AI-Brain.json) | `Product Lookup` ও `Create Order` node-এর `query` |
| [`docs/n8n-JSON/Multimodal-Audit.md`](../n8n-JSON/Multimodal-Audit.md) §৯.২ | পাওয়া যাওয়ার বিবরণ |

🔧 **করণীয়**

1. **`Create Order` — [`TASK-09`](#task-09--order-validation-layer)-এর সাথে মিলিয়ে করুন।** TASK-09-এর **পথ খ** (Next.js-এ `POST /api/internal/orders`, n8n সরাসরি INSERT করবে না) বেছে নিলে এই node-এর injection **আপনাআপনি মিটে যায়** — কারণ INSERT-ই আর n8n-এ থাকবে না। তাই আগে TASK-09-এর সিদ্ধান্ত নিন।
2. **`Product Lookup` — আলাদা ব্যবস্থা লাগবে** (এটি একটি SELECT, TASK-09-এর আওতায় পড়ে না)। দুটি উপায়:
   - **(ক) Parameterized query:** n8n-এর postgres node-এ `$1` placeholder + `Options → Query Parameters` ব্যবহার করুন — সবচেয়ে নির্ভরযোগ্য, কারণ মান আর SQL-এর অংশ হয়ই না।
   - **(খ) ন্যূনতম:** `Save Chat History`-এর মতো `.replace(/'/g, "''")` — কাজ করবে, কিন্তু parameter binding-এর মতো নিরাপদ নয়।
   > **সুপারিশ: (ক)** — escaping ভুলে যাওয়া সহজ, parameter binding ভোলা যায় না।
3. **একই প্যাটার্ন আর কোথাও আছে কি না grep করুন** — SQL-এ interpolate হওয়া প্রতিটি `$fromAI(` ও `{{ $json` খুঁজে দেখুন।
4. ⚠️ **`chatbotId`-ও যাচাই করুন** — `Fetch Bot Config`, `Ensure Session`, `RAG Search`, `Order Created Check`, `Save Chat History` — সবগুলোতেই `chatbotId` quote-এর ভেতরে interpolated। WhatsApp/FB/IG-তে এটি DB থেকে আসে (নিরাপদ), কিন্তু web playground-এ এটি request body থেকে আসে → সেই route-টির validation যাচাই করুন।
5. n8n workflow **ইউজার নিজে import করবেন** — কোন node বদলেছে তা লিখিতভাবে দিন।

✅ **গ্রহণযোগ্যতা**

- `customer_name`-এ `x', 'y', 'z` দিলে SQL ভাঙে **না** — একটি নিরীহ value হিসেবে লেখা হয়, অথবা validation error দেয়
- `product_name`-এ SQL comment (`--`, `/*`) দিলে অন্য merchant-এর কোনো ডেটা ফেরত আসে না
- `Create Order` ও `Product Lookup` — দুটোতেই ব্যবস্থা নেওয়া (অথবা TASK-09-এর পথ খ-এর মাধ্যমে `Create Order` সরিয়ে ফেলা)
- কোন workflow import করতে হবে তা ইউজারকে লেখা দেওয়া
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

---

## Phase 4 — খরচ ও Resiliency

> VPS ❌

---

### TASK-10 — AI Gateway: model fallback + per-workspace quota enforcement

**Priority:** 🔴 Critical · **অবস্থা:** ✅ **সম্পন্ন — Part A (app-side gateway) + Part B (n8n-side quota pre-flight)**

🎯 **কী**

OpenRouter-এ যাওয়ার সব কল একটি **thin gateway**-র মধ্য দিয়ে যাবে, যেটি (১) একটি model fail করলে পরেরটায় যায়, (২) workspace-এর quota শেষ হলে **আটকে দেয়**, (৩) 429/402 সঠিকভাবে সামলায়।

❓ **কেন**

- **Single point of failure:** একটিই OpenRouter key। Key expire হলে / balance ফুরালে / 429 এলে — chat, embedding, prompt enhance, product extract, auto-train **সব একসাথে বন্ধ**। এখন কোনো fallback নেই (`lib/ai/embeddings.ts` ছাড়া — শুধু সেখানে ৩টি retry আছে)। মানে একটি billing ইস্যু পুরো প্রোডাক্ট থামিয়ে দিতে পারে।
- **Quota এখনো কার্যকর নয়:** খরচ **track** হচ্ছে (`lib/ai/charge-usage.ts`, `AIUsageLog`) কিন্তু **block** হচ্ছে না। অর্থাৎ একজন ব্যবসায়ী তাঁর plan-এর সীমা ছাড়িয়ে গেলেও সিস্টেম চুপচাপ চলতে থাকবে — **আপনার টাকা খরচ করে**।

📁 **ফাইল**

| ফাইল | এখন যা আছে |
|---|---|
| `lib/ai/openrouter-service.ts` | OpenRouter কল |
| `lib/ai/charge-usage.ts` | `chargeUsage()`, `recoverDuplicateCharge()`, `isUniqueViolation` — **ভালো foundation** |
| `lib/ai/usage-logger.ts`, `lib/ai/model-pricing.ts`, `lib/ai/cost-calculator.ts` | খরচ হিসাব |
| `lib/ai/credit-resolver.ts` | credit logic |
| `lib/ai/plan-model-access.ts`, `lib/ai/chat-models.ts` | model নির্বাচন |
| `lib/ai/embeddings.ts`, `rag.ts`, `prompt-assembler.ts`, `product-extract.ts`, `auto-train.ts`, `translation.ts`, `qa-training.ts` | openrouter কলকারী সব consumer |

🔧 **করণীয়**

1. **একটি কেন্দ্রীয় ফাংশন বানান** — `lib/ai/gateway.ts` → `callModel({ workspaceId, task, messages, model? })`। লক্ষ্য: **প্রতিটি** AI কল এই একটি দরজা দিয়ে যাবে। Railway-এর মতো নয়, বরং একটি সাধারণ orchestrator।
2. **Fallback chain:** primary model → fallback list → (প্রয়োজনে) একটি সস্তা model। `lib/ai/chat-models.ts`-এ per-task default ও fallback রাখুন — hardcode নয়।
3. **Quota enforcement:** কল করার **আগে** workspace-এর credit/usage চেক করুন। শূন্য হলে:
   - 402-এর মতো একটি স্পষ্ট typed error ফেরত দিন (কখনো চুপচাপ "সাধারণ" reply নয়)
   - AI reply-এর বদলে একটি বোধগম্য বার্তা (i18n) — "আপনার credit শেষ, plan upgrade করুন"
   - **Admin-কে জানান** যাতে এটি কেউ দেখেন
4. **429 / 402 / timeout হ্যান্ডলিং:** exponential backoff + jitter; fallback model-এ যাওয়া; `Retry-After` মানা। ⚠️ **Vercel function timeout মনে রাখুন** — retry বাজেট সীমিত রাখুন (মোট ~১০ সেকেন্ডের মধ্যে)।
5. **Structured logging:** প্রতি কলে workspace, task, model, token, খরচ, latency, fallback হয়েছিল কি না — `AIUsageLog`-এ। এটি TASK-14-এর ভিত্তি।
6. **পরিমাপ:** বদলের আগে/পরে একটি সাধারণ chat-এর p50/p95 latency ও cost লিখে রাখুন, যাতে fallback-এর খরচ বোঝা যায়।

✅ **গ্রহণযোগ্যতা**

- ✅ primary model `402`/`429` দিলে কল **স্বয়ংক্রিয়ভাবে** fallback model-এ যায় — chat বন্ধ হয় না *(app-side। ⚠️ গ্রাহকের সামনের reply-পথে cross-model fallback সম্ভব **নয়** — কারণ নিচে Part B-তে খোলাখুলি লেখা আছে)*
- ✅ quota শেষ হলে request **আটকায়** — app-side-এ `402` + `code`; আর গ্রাহকের সামনের পথে n8n-ই AI চালায় না, এবং গ্রাহক পান i18n বার্তা
- ✅ সব AI কল `gateway.ts` দিয়ে যায় — `grep -rn "chat\.completions\.create\|embeddings\.create" app lib` এখন gateway ছাড়া কিছু ফেরত দেয় না
- ✅ fallback path-এর unit test — [`ai-attempt-loop.test.ts`](../../lib/domain/ai-attempt-loop.test.ts) (১১টি)
- ✅ `npx tsc --noEmit` → 0 · `npm test` → ২০৫ পাস · `npm run build` → exit 0 (১১৫ পেজ, `/api/internal/ai-quota` সহ)

---

📝 **বাস্তবায়ন — Part A (২০২৬-১০-১৩) ✅**

**নতুন ফাইল**

| ফাইল | কী করে |
|---|---|
| `lib/ai/gateway.ts` | `callModel()` / `callEmbeddings()` — **একমাত্র দরজা**। quota → model বাছাই → chain → log |
| `lib/ai/gateway-http.ts` | `aiErrorResponse()` — typed error → HTTP status + `code` |
| `lib/ai/ai-error-message.ts` | client-এ `code` → i18n বার্তা |
| `lib/ai/openrouter-client.ts` | lazy singleton client; `maxRetries: 0` |
| `lib/ai/quota-guard.ts` | DB পড়ে `assertAIQuota()`; `React.cache()` দিয়ে per-request memoise |
| `lib/ai/fallback-resolver.ts` | task → primary model, এবং attempt chain |
| `lib/domain/ai-task.ts` | ৮টি task-এর নীতি — fallback চলবে কি না, bill হবে কি না |
| `lib/domain/ai-fallback.ts` | chain-এর ক্রম — কখনো **বেশি দামি** model-এ যায় না |
| `lib/domain/ai-quota.ts` | `decideQuota()` — ৫টি নিয়ম |
| `lib/domain/ai-retry.ts` | `classifyFailure()` / `planNextAttempt()` |
| `lib/domain/ai-attempt-loop.ts` | `runModelChain()` — wall-clock বাজেট মেনে chain চালায় |
| `lib/ai/ai-error.ts` | typed error + HTTP status map |
| `public/locales/{en,bn}/ai-errors.json` | ৬টি gateway বার্তা |

**যে ৮টি call site gateway-এ গেছে:** `embeddings.ts` · `translation.ts` · `product-extract.ts` · `auto-train.ts` · `enhance-prompt/route.ts` · `translate-prompt/route.ts` · `compare/route.ts` · `products/text-ingest/route.ts`

**সিদ্ধান্ত ১ — `compare`-এ fallback বন্ধ করা হলো।** `AI_TASK_POLICY.compare.allowsModelFallback = false`। কারণ তুলনার **একমাত্র** অর্থ হলো প্রতিটি উত্তর সত্যিই তার লেবেলের model থেকে এসেছে; fallback হলে "GPT-4o" লেখার নিচে অন্য model-এর লেখা বসত, আর merchant সেই মিথ্যা দেখে নিজের model বেছে নিতেন। একটা model চুপ থাকা ক্ষতিকর নয়, ভুল লেবেল ক্ষতিকর।

**সিদ্ধান্ত ২ — credit কাটা gateway-এর কাজ নয়।** `chargeUsage()`-ই একমাত্র balance ছোঁয়ে; gateway কেবল **পড়ে** সিদ্ধান্ত নেয়। একই balance-এ দুই লেখক থাকলে reply দুইবার bill হতো, আর n8n-এর পথ (`POST /api/internal/ai-usage`) তো আছেই।

**সিদ্ধান্ত ৩ — "Admin-কে জানান"-এর বদলে যা করা হলো।** প্রতিটি failed কলে ইমেইল পাঠানো মানে একই outage-এ শত শত মেইল — যে সমস্যার খবর দিচ্ছে তার চেয়ে বড় সমস্যা। তাই:
- **credit শেষ হলে** merchant নিজেই জানেন — `checkUsageThresholds()` ডাকা হয় ([`quota-guard.ts`](../../lib/ai/quota-guard.ts))। এটি আগে **কখনোই** চলত না এই পথে: fee কাটা হয় শুধু *সফল* charge-এর পরে, আর credit শেষ হওয়ার পর কোনো charge-ই সফল হয় না — অর্থাৎ "credit শেষ" মেইলটা হয়তো কখনো যেত না। `claimAlert` DB-তে dedupe করা, তাই loop চললেও একবারই যায়।
- **platform-wide outage** (provider-এর balance শেষ / key ভুল) `[AI_GATEWAY_ALERT]` হিসেবে loudly log হয়। এর জন্য সত্যিকারের alert channel (dedupe সমেত) **TASK-21**-এর কাজ — যে টাস্কের পুরো বিষয়ই alerting। সেটি একবারই বানানো হবে, এখানে আলাদা করে নয়।

**⚠️ Part A-তে যা হয়নি**
- **Item ৬ (latency পরিমাপ)** — করা হয়নি। আসল p50/p95 মাপতে live traffic বা সত্যিকারের key দিয়ে call দরকার, যা এই পরিবেশে নেই। লগ এখন `latencyMs` ও `fallbackFrom` দুটোই রাখে, তাই ট্রাফিক চললে TASK-14-এর ভিউ থেকেই সংখ্যা বেরোবে।

---

📝 **বাস্তবায়ন — Part B (২০২৬-১০-১৩) ✅**

**নতুন ফাইল**

| ফাইল | কী করে |
|---|---|
| [`app/api/internal/ai-quota/route.ts`](../../app/api/internal/ai-quota/route.ts) | `POST /api/internal/ai-quota` — AI চালানোর **আগে** জিজ্ঞেস করার একমাত্র দরজা। ভেতরে `assertAIQuota()` |
| [`public/locales/{en,bn}/ai-errors.json`](../../public/locales/bn/ai-errors.json) | `reply_unavailable` — **গ্রাহকের** দেখার লেখা (উপরের ৬টি key-ই merchant-এর ড্যাশবোর্ডের) |

**পরিবর্তিত n8n workflow:** [`Core-AI-Brain.json`](../n8n-JSON/Core-AI-Brain.json) — ৪টি node যোগ, ৫টি connection বদল

```
Gate Reply? (false) → Quota Check → Quota Allowed? → Media Router   [আগের পথ]
                                  ↘ Quota Blocked Reply             [নতুন, শেষ]

AI Agent (error output) → AI Failed Reply                          [নতুন, শেষ]
```

| node | কী |
|---|---|
| `Quota Check` | `POST /api/internal/ai-quota` — `Billing API`-র credential-ই ব্যবহার করে। `onError: continueRegularOutput` + `alwaysOutputData` |
| `Quota Allowed?` | `{{ $json.allowed !== false }}` — কেবল **স্পষ্ট** "না" আটকায় |
| `Quota Blocked Reply` | গ্রাহকের ভাষা বেছে বার্তা দেয়, শূন্য খরচে turn শেষ করে |
| `AI Failed Reply` | AI Agent ব্যর্থ হলে নিরবতার বদলে একটি বাক্য |
| `Quota Guard (বাংলা)` | sticky note — কী, কেন, credential, কীভাবে পরীক্ষা |

**সিদ্ধান্ত ৪ — চেকটা `Automation Gate`-এর **পরে**, তার সাথে জুড়ে দিয়ে নয়।** দুইটা কারণ:
1. Automation rule-এর ক্যানড উত্তর প্ল্যাটফর্মের কাছে **বিনামূল্যে** (কোনো model চলে না)। credit নেই বলেই সেটি আটকে দেওয়া মানে বিনা কারণে bot-কে চুপ করা। তাই চেকটা ঠিক যেখানে টাকা খরচ শুরু হয় — অর্থাৎ AI-র ঠিক আগে।
2. **TASK-11** ওই Gate-কে critical path থেকে সরাবে (cache)। চেকটা Gate-এর উত্তরের ভেতরে বসালে cache-করা verdict-এর সঙ্গে পুরনো quota সিদ্ধান্তও জমে যেত — Merchant credit শেষ হওয়ার পরেও TTL শেষ না হওয়া পর্যন্ত reply পেতেন।

**সিদ্ধান্ত ৫ — নীতির দ্বিতীয় কপি বানানো হলো না।** n8n-এর `Fetch Bot Config` আগেই `creditsBalance` আনে, তাই `balance > 0` সেখানেই বিনা খরচে দেখা যেত — কিন্তু তাহলে credit-এর নিয়ম দুই জায়গায় থাকত, আর admin panel থেকে credit বদলালে n8n-এর কপি পুরনো মান নিয়ে বসে থাকত (`credit-resolver.ts`-এর পুরো হেডারটাই এই ভুলের ইতিহাস)। খরচ: প্রতি AI-heavy মেসেজে একটি বাড়তি hop (~২৩০ms)।

**সিদ্ধান্ত ৬ — সব উত্তর `200`, এমনকি আটকালেও।** `/api/internal/orders`-এর মতোই: n8n একটি non-2xx-কে node failure বানায়, ফলে "credit নেই" কথাটি আর ব্যবসায়িক উত্তর থাকে না, `onError`-এর ব্যাখ্যায় পরিণত হয়। 401/400/500 কেবল সেসব ক্ষেত্রে যা model/workflow ছাড়া ঠিক হয় না।

**সিদ্ধান্ত ৭ — fail-open, দুই পাশেই।** `assertAIQuota()` নিজেই ইচ্ছে করে fail-open, আর n8n-এর IF কেবল `allowed === false` দেখে। অর্থাৎ প্ল্যাটফর্ম ডাউন/timeout/404 হলে AI চলবে। কারণ একটি ক্ষণিকের সার্ভার ত্রুটি যেন চলতি গ্রাহক-কথোপকথন চুপ না করে। **পরিণাম:** `Quota Check`-এর URL ভুল হলে node-টি চুপচাপ নিষ্ক্রিয় থাকবে, কোনো এরর দেখাবে না — Automation Gate-এর ঠিক যে ফাঁদটা sticky note-এ লেখা আছে।

**সিদ্ধান্ত ৮ — গ্রাহক কখনো billing-এর কথা শুনবেন না।** `aiErrors.quota_exceeded` ("credit রিচার্জ করুন") merchant-এর জন্য লেখা। যিনি ব্যক্তিগত চ্যাটে লিখছেন তিনি একজন shopper — merchant-এর টাকা শেষ হওয়ার খবর তাঁর সামনে ফাঁস করা merchant-এর ক্ষতি, আর bot-এর বিশ্বাসযোগ্যতাও নষ্ট করে। তাই `reply_unavailable` একটি নিরপেক্ষ বাক্য, আর সেটি দুই ভাষায় আলাদা key।

**⚠️ Part B-তে যা ইচ্ছে করেই করা হয়নি — cross-model fallback**

মূল্যায়ন করে দেখা গেল **n8n-এর LangChain path-এ OpenRouter-এর আসল fallback পাঠানো সম্ভব নয়**:

| দরকার | `lmChatOpenRouter`-এ আছে? |
|---|---|
| `models: [...]` (OpenRouter-এর native fallback তালিকা) | ❌ নেই — শুধু একটি `Model` dropdown |
| `modelKwargs` / extra body field | ❌ নেই — `modelKwargs` কেবল `responseFormat`-এর জন্য হার্ডকড |
| editable Base URL (গেটওয়ে-তে ঘুরিয়ে দেওয়ার জন্য) | ❌ নেই — `url` property `type: "hidden"` |

তাই priority অনুযায়ী যা **সম্ভব** ছিল তা করা হলো — `timeout` ৬ মিনিট → **৬০ সেকেন্ড** (আগে একটি reply ছয় মিনিট ঝুলে থাকতে পারত), `maxRetries: 2` explicit (n8n upgrade-এ চুপচাপ বদলে না যায়), আর ব্যর্থতাকে নিরবতার বদলে বার্তায় বদলানো।

⚠️ **AI Agent-এ `retryOnFail` ইচ্ছে করেই দেওয়া হয়নি** — Agent আবার চালানো মানে তার tool-গুলো আবার চালানো, অর্থাৎ `Create Order` দুইবার firing → একই অর্ডার দুবার। পুনরায় চেষ্টা কেবল model node-এর নিজের HTTP স্তরে (tool চলার আগেই)।

**যা একটি সিদ্ধান্ত দরকার (করা হয়নি, ইউজারের সিদ্ধান্ত):** n8n-এর `OpenAI Chat Model` node-এর credential-এ Base URL এডিটযোগ্য। যদি প্ল্যাটফর্মে একটি OpenAI-সামঞ্জস্যপূর্ণ `/api/ai/v1/chat/completions` বানানো হয়, তাহলে গ্রাহকের reply-ও Part A-র gateway দিয়ে যেত — অর্থাৎ fallback chain, quota ও billing **তিনটাই** এক সূত্রে। খরচ: tool-calling/streaming pass-through লিখতে হবে, আর প্রতি reply-তে প্ল্যাটফর্ম hot path-এ চলে আসবে (Vercel-এ সমস্যা হলে সব bot চুপ)। এটি TASK-11-এর লক্ষ্যের (hop কমানো) ঠিক উল্টো, তাই আলাদা টাস্ক হিসেবে ভাবা উচিত — এখানে চাপানো হয়নি।

**📥 ইউজারকে যা করতে হবে:** n8n → Workflows → Core-AI-Brain → ⋯ → **Import from File** → [`Core-AI-Brain.json`](../n8n-JSON/Core-AI-Brain.json)। ⚠️ import করার আগে বর্তমান workflow-টি JSON হিসেবে এক্সপোর্ট করে রাখুন। নতুন credential বানাতে হবে না — `Quota Check` `Driplare Platform Secret`-ই ব্যবহার করে, যা `Billing API` ও `Create Order`-এ আগেই বসানো আছে।

---

### TASK-11 — Automation Gate ও Billing API critical path থেকে সরানো

**Priority:** 🟠 High · **অবস্থা:** ✅ কোড ও যাচাই সম্পন্ন (২০২৬-১০-১৩) — শুধু n8n import ও মাপা latency ইউজারের হাতে বাকি · **n8n সমন্বয় দরকার**

🎯 **কী**

Core-AI-Brain-এর serial chain-এ দুটি cross-continent HTTPS হপ উত্তর দেওয়ার পথে **blocking** বসে আছে: **Automation Gate** (AI শুরুর আগেই) এবং **Billing API** (reply পাঠানোর আগে)। দুটোই BD → Vercel US-East ≈ **২৩০ms each** খায় এবং reply আটকে রাখে। এদের critical path থেকে সরাতে হবে।

❓ **কেন**

সাধারণ একটি text reply-তে ~১১টি serial hop। এর মধ্যে এই দুটি **আপনার নিজের সার্ভিসে** যাওয়া কল — অর্থাৎ অপ্রয়োজনীয়। এগুলো সরালে প্রতি reply-তে **~০.৫ সেকেন্ড** বাঁচে, কোনো ফিচার না হারিয়ে। VPS migration-এর (স্থগিত) চেয়ে এটি **সস্তা ও এখনই করা যায়**।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `app/api/automations/evaluate/route.ts` | n8n-এর Automation Gate যেখানে কল করে (বর্তমানে ১০s timeout, blocking) |
| `app/api/internal/ai-usage/route.ts` | Billing API |
| `docs/n8n-JSON/Core-AI-Brain.json` | node-এর অবস্থান |
| `proxy.ts:32` | `/api/automations/evaluate` public pattern (comment-সহ) |

🔧 **করণীয়**

1. **Automation Gate** — দুটি অপশন:
   - **(ক) cache:** gate-এর সিদ্ধান্ত কিছু সময়ের জন্য cache করুন (workspace+chatbot ধরে)। গুরুত্বপূর্ণ: cache **invalidate** করার ব্যবস্থা থাকতে হবে যখন merchant automation বদলান।
   - **(খ) n8n-এর ভেতরে আনুন:** automation rule গুলো query করে n8n নিজেই সিদ্ধান্ত নেয়। Hop পুরোপুরি শেষ, কিন্তু logic n8n-এ ছড়িয়ে যায়।
   > **সুপারিশ: (ক)** — একটি ছোট TTL cache + যেকোনো automation update-এ explicit invalidation।
2. **Billing API** — reply পাঠানোর **পরে** fire-and-forget করুন। বর্তমানে `onError: continueRegularOutput` আছে — সেটি শুধু **error** সামলায়, **latency কমায় না**। node-টি reply-এর পরে সরান, অথবা n8n-এর "fire and forget" প্যাটার্ন ব্যবহার করুন।
3. ⚠️ **সতর্কতা:** billing fire-and-forget করলে সেই কল কখনো **ব্যর্থ হতে পারে** — তাই একটি নির্ভরযোগ্য fallback লাগবে (যেমন n8n-এর retry, অথবা একটি queue/cron যা বকেয়া usage পাঠায়)। নাহলে **আয় হারাবেন**। এই fallback ছাড়া এটি করবেন না।
4. **পরিমাপ:** বদলের আগে/পরে একই ধরনের একটি মেসেজে end-to-end reply latency মেপে দেখান।

⚠️ **উপরের ১ ও ২ — দুটোই যাচাই করে বদলাতে হয়েছে।** কারণ নিচে।

---

✅ **যা করা হলো (২০২৬-১০-১৩)**

| # | কী | কোথায় |
|---|---|---|
| ক | Vercel region `sin1` (Singapore) — Neon-ও `ap-southeast-1`-এ, তাই প্রতি DB round trip-এর ~২৩০ms আন্তঃমহাদেশীয় যাত্রা শেষ | `vercel.json` |
| খ | n8n-এর আলাদা `Quota Check` নোড **বাদ**; credit verdict এখন `/api/automations/evaluate`-এর নিজের উত্তরের `quota` field-এ (এক হপ কম, নেট latency শূন্য — quota-র ২ read engine-এর ~৮ read-এর নিচে লুকিয়ে যায়) | `lib/ai/quota-answer.ts` (নতুন) · `app/api/automations/evaluate/route.ts` · `app/api/internal/ai-quota/route.ts` · `lib/automations/schema.ts` |
| গ | `chargeUsage()`-এ `calculateUsageCost` ও `resolveTotalCredits` একসাথে; `getCreditRules()` এখন `React.cache`-এ মোড়া — একই `ai_credit_rules` row আর দুইবার পড়া হয় না | `lib/ai/charge-usage.ts` · `lib/ai/credit-resolver.ts` |
| ঘ | `runEvent()`-এ `loadEngineRules` ও `buildEvaluationContext` সমান্তরাল (আচরণ অপরিবর্তিত) | `lib/automations/run.ts` |
| ঙ | n8n JSON: নোড মুছে ফেলা, connection পুনঃসজ্জিত, sticky note আপডেট — happy path **২০ → ১৯ নোড** | `docs/n8n-JSON/Core-AI-Brain.json` |

**১. Gate cache করা হলো না — এবং করা উচিতও নয়।** TASK-11 যেভাবে cache করতে বলেছিল সেটি অনিরাপদ, কারণ `runEvent()` শুধু পড়ে না, **লেখেও**:

- `persistTurn()` → `ChatMessage` + `ChatSession`। Live Inbox-এর **একমাত্র** সূত্র, কারণ n8n-এর `Save Chat History` চলে AI Agent-এর **পরে** — canned reply short-circuit হলে ওই নোডে পৌঁছায়ই না।
- `recordRun()` → Activity পেজের row · `touchAutomationStats()` → `Automation.lastRunAt`
- `applyFrequencyCaps()` → সিদ্ধান্ত **আগের `AutomationRun` row-এর উপর** নির্ভর করে (stateful)
- `executeSideEffects()` → email / webhook / tag

অর্থাৎ cache করলে frequency cap ভাঙত, Live Inbox-এ কথোপকথন হারাত, Activity log ফাঁকা হত, side effect বন্ধ হত।

**২. Billing `after()` / fire-and-forget করা হলো না।** `billingOk` **একমাত্র** দ্বিগুণ-বিল-রক্ষাকবচ: `Return to Platform` চারটি মান `Billing API`-র উত্তরের উপর নির্ভর করে, আর `app/api/chatbots/[chatbotId]/chat/route.ts:176`-এ `billingOk !== true` হলে প্ল্যাটফর্ম নিজে আবার `chargeUsage()` ডাকে — playground-এর কলটা `runId` পাঠায় না, তাই দুই charge পরস্পরের প্রতি idempotent নয়। উত্তর দেরিতে এলে বা না এলে **একই reply দুবার বিল হত**। তাই Path ক (নোড জায়গায়, ভেতরের খরচ কম) — যা ইতিমধ্যেই অনুমোদিত সিদ্ধান্ত ছিল।

**৩. সবচেয়ে বড় ফাঁদ, যা এড়ানো হয়েছে:** `/api/automations/evaluate`-র outer `catch` **fail-open** (DB hiccup-এ AI বন্ধ না করে "continue" ফেরায়)। `assertAIQuota` আটকালে `AIError` **throw** করে — সেই throw ওই ঢিলা catch-এ পড়লে credit শেষ হওয়া merchant-এর AI **চুপচাপ চলতেই থাকত**। তাই `resolveQuotaAnswer()` কখনো throw করে না, আর `runEvent`-এর error **আলাদা** ধরা হয় (একসাথে ধরলে engine-এর একটাই ব্যর্থতা quota-র রায়টাও নিয়ে ডুবত)।

**৪. ইচ্ছে করেই বাদ:** `unstable_cache` (§১) · `loadEngineRules`-এ tag-cache + ৪ write route-এ invalidation (region fix-এর পরে লাভ ~৫ms, বদলে per-instance `revalidateTag` staleness) · `$queryRaw … RETURNING` (ঝুঁকি > ৫ms লাভ) · `/api/internal/ai-quota` মুছে ফেলা (rollback path হিসেবে রাখা হলো — কলার এখন শূন্য)।

**৫. যা unit test করা হয়নি, সৎভাবে:** `getCreditRules()`-এর dedup যাচাই করা হয়নি, কারণ `React.cache` শুধু `react-server` condition-এ সত্যিকারের memoisation — vitest সেটি সেট করে না, তাই `react`-এর client build লোড হয় যেখানে `cache` নিছক passthrough (`node_modules/react/cjs/react.development.js:917`)। ওই টেস্ট প্রোডাকশন কোড ঠিক থাকা সত্ত্বেও fail করত — নকল করে পাস করানো মানে মিথ্যা নিশ্চয়তা। কারণটা `lib/ai/credit-resolver.ts`-এর কমেন্টে লিপিবদ্ধ। বাকি সব (`resolveQuotaAnswer`-এর fail-open ও never-throw নিয়ম, গ্রাহক-মুখী কপিতে billing শব্দ না থাকা) `lib/ai/quota-answer.test.ts`-এ pin করা।

⚠️ **Region-টা স্থায়ী সমাধান নয়** — Hostinger VPS + Coolify-তে গেলে Vercel region বলে কিছু থাকবে না। তখন Neon-কে VPS-এর কাছে আনতে হবে। এটি **আজকের** উপকার।

✅ **গ্রহণযোগ্যতা**

- ✅ সাধারণ text reply-তে platform-এর দিকে হপ **৩ → ২** (n8n node graph দিয়ে প্রমাণ; ⬜ মাপা latency ইউজারের হাতে)
- ⬜ latency আগের চেয়ে measurable-ভাবে কমেছে — **আগে/পরে সংখ্যা এখনো দেওয়া হয়নি** (নিচের ধাপ ২ ও ৬)
- ✅ billing তথ্য হারায় না — `Billing API` sync-ই রইল, আর `billingOk` অটুট (§২)
- ✅ কোন workflow import করতে হবে তা জানানো হয়েছে (নিচে)
- ✅ `npx tsc --noEmit` → exit 0 · `npm test` → 10 files / 224 tests সব pass · `npm run build` → exit 0

  > 🔎 tsc প্রথম চালানোতেই একটি আসল bug ধরা পড়েছিল: `lib/ai/quota-answer.ts`-এর JSDoc কমেন্টে লেখা `` `public/locales/*/ai-errors.json` `` — ওই **`*/`** জোড়াটাই কমেন্টটি আগেই বন্ধ করে দিয়েছিল, ফলে পরের লাইনগুলো কোড হিসেবে পড়ে "Unterminated template literal" দিয়েছিল। `{en,bn}` লিখে ঠিক করা হয়েছে। **এটাই প্রমাণ যে এই তিনটি command এড়িয়ে যাওয়া যায় না।**
- ✅ n8n JSON পarser দিয়ে যাচাই: `Core-AI-Brain.json` (৩৭ নোড) ও `Automation-Gate.json` — both parse OK · `Quota Check` নোড **নেই** · duplicate node name **নেই** · dangling connection edge **নেই**

📤 **ইউজারের হাতে বাকি (n8n)**

1. `prisma db push` **চলবে না** — এই টাস্কে schema-এ কিছুই বদলায়নি।
2. n8n-এ **আগে** Core-AI-Brain খুলে একটি আসল মেসেজের execution-এ `Automation Gate`, `Quota Check`, `Billing API` — তিনটির per-node timing লিখে রাখুন। **এটাই "before"।**
3. `docs/n8n-JSON/Core-AI-Brain.json` ইমপোর্ট করুন (আপনি নিজে)।
4. `Quota Check` নোডটা আর নেই কি না মিলিয়ে নিন (import replace করলে এমনিতেই যাবে)। ⚠️ `AI Failed Reply` নোডের JS এখন `$('Gate Decision')` পড়ে — **একই import-এ** বদলাতে হবে, নইলে মুছে ফেলা নোডের নাম ধরায় runtime-এ ভাঙবে।
5. পরীক্ষা: credit আছে → উত্তর আসে · credit ০ (একটি test workspace-এ) → `Quota Blocked Reply` দুই ভাষায় · workspace suspend → একই · Activity পেজে run row · Live Inbox-এ canned reply (এটাই `persistTurn`-এর প্রমাণ)।
6. **নতুন execution-এর timing লিখুন** — এটাই "after"। পার্থক্যটাই TASK-11-এর ফল।

---

### TASK-21 — OpenRouter ব্যালেন্স অ্যালার্ট ও খরচ পর্যবেক্ষণ (Ops)

**Priority:** 🟠 High · **অবস্থা:** ⬜ বাকি · **কোনো কোড নয় — কনফিগারেশন**

🎯 **কী**

OpenRouter account-এ **credit/balance alert** সেট করা, এবং n8n-এর নিজস্ব OpenRouter credential-এর জন্যও। পাশাপাশি একটি সাপ্তাহিক খরচ পর্যালোচনার অভ্যাস।

❓ **কেন**

TASK-10 fallback দেবে, কিন্তু **আগে জানতে পারলে** সেটিই সবচেয়ে ভালো। Analysis §২ বলছে: একটি key-ই সব কিছুর একমাত্র ভরসা (chat, embedding, prompt enhance, auto-train)। Balance নিঃশব্দে ফুরিয়ে গেলে **পুরো প্রোডাক্ট বন্ধ** — কোনো সতর্কবার্তা ছাড়াই, সম্ভবত রাত ৩টায়।

📁 **কোথায়**

- OpenRouter Dashboard → Settings → Limits/Credits
- n8n → Credentials → OpenRouter (আলাদা credential, n8n-owned)
- `AIUsageLog` (DB) — খরচের আসল উৎস

🔧 **করণীয়**

1. OpenRouter-এ auto-reload **অথবা** একটি threshold alert সেট করুন (যেমন balance $X-এর নিচে নামলে ইমেইল)।
2. n8n-এর OpenRouter credential-এর জন্য আলাদাভাবে দেখুন — কোথায় alert সেট করতে হয়।
3. একটি সহজ **admin খরচ ভিউ** দরকার কি না ভাবুন — `AIUsageLog`-এ ডেটা আছে, শুধু দেখানোর UI নেই। (বড় কাজ হলে আলাদা টাস্ক হিসেবে লিখুন।)
4. **Quota/limit** OpenRouter-এ সেট করুন — যাতে একটি bug বা abuse পুরো balance এক রাতে না খেয়ে ফেলে।

✅ **গ্রহণযোগ্যতা**

- Balance কমে গেলে ইউজার **আগেই** জানতে পারবেন (alert সত্যিই এসেছে কি না — একটি টেস্ট দেখে নিশ্চিত হবেন)
- n8n credential-এর জন্যও একই সুরক্ষা আছে
- ইউজারকে জানানো হয়েছে ঠিক কোথায় ক্লিক করতে হবে (স্ক্রিন-ধাপে)

---

### TASK-24 — Per-workspace credit budget

**Priority:** 🟠 High · **অবস্থা:** ⬜ বাকি *(TASK-10 Part A-এর সময় আবিষ্কৃত)*

🎯 **কী**

Credit সীমা এখন শুধু **User**-এ আছে (`creditsBalance`, `includedCredits`, `creditsUsedThisCycle`)। **Workspace**-এ কেবল `status` আছে — কোনো বাজেট নেই। একটি workspace-এর জন্য আলাদা মাসিক সীমা বসাতে হবে।

❓ **কেন**

একজন merchant একাধিক business (workspace) চালান। আজ একটি business-এর runaway loop বা abuse পুরো **account**-এর credit শেষ করে দেবে — ফলে বাকি business-গুলোর chatbot-ও একসাথে বন্ধ হয়ে যাবে, যদিও তারা কিছুই ভুল করেনি। উল্টোটাও সত্যি: একটি profitable business-এর খরচ আর একটি পরীক্ষামূলক business-এর খরচ আলাদা করে দেখা যায় না, তাই কোন business টিকিয়ে রাখা লাভজনক তা বোঝার উপায় নেই।

🔧 **করণীয়**

1. `Workspace`-এ `monthlyCreditBudget Int?` ও `creditsUsedThisCycle Int @default(0)` যোগ করুন (⚠️ `prisma db push` নয় — [`AGENTS.md`](../../AGENTS.md) অনুযায়ী `migrate diff` দেখিয়ে অনুমোদন নিয়ে SQL)।
2. [`lib/domain/ai-quota.ts`](../../lib/domain/ai-quota.ts)-এর `decideQuota()`-তে **দ্বিতীয়** সীমা যোগ করুন। ⚠️ User-সীমা আর workspace-সীমা — দুটোরই মানতে হবে; একটি পাস করলে অন্যটি এড়ানোর সুযোগ থাকা যাবে না।
3. [`lib/ai/quota-guard.ts`](../../lib/ai/quota-guard.ts)-এ workspace budget পড়া যোগ করুন (`React.cache()` দিয়ে memoise)।
4. Admin UI — workspace-এ বাজেট বসানো ও consumed/remaining দেখা।
5. একটি নতুন `QuotaBlockReason` (`workspace_budget_exceeded`) → [`ai-errors.json`](../../public/locales/bn/ai-errors.json)-এ বার্তা।

✅ **গ্রহণযোগ্যতা**

- একটি workspace-এর সীমা শেষ হলে **শুধু সেই workspace**-এর AI কল আটকায়; একই account-এর বাকি workspace চলে
- `creditsUsedThisCycle` মাসিক reset cycle-এ শূন্য হয় (User-এর `creditsResetDate`-এর সাথে মিলিয়ে)
- বার্তাটি বাংলা ও ইংরেজি দুটোতেই, এবং কোন business-এর সীমা শেষ তা স্পষ্ট

---

### TASK-25 — যেসব AI কাজ bill-ই হয় না (revenue leak)

**Priority:** 🟠 High · **অবস্থা:** ⬜ বাকি *(TASK-10 Part A-এর সময় আবিষ্কৃত)*

🎯 **কী**

Platform-এর নিজের OpenRouter key-তে চলে, `AIUsageLog`-এ খরচ **লেখা হয়**, কিন্তু merchant-এর `creditsBalance` থেকে **কিছুই কাটা হয় না** — এমন চারটি পথ চিহ্নিত করা হয়েছে।

❓ **কেন**

TASK-10 Part A করার সময় দেখা গেল `chargeUsage()`-এর মাত্র **২টি** caller আছে (`chat/route.ts`, `internal/ai-usage/route.ts`)। বাকি কয়েকটি route নিজে `creditsBalance: { decrement }` করে (নিচের তালিকা দেখুন), কিন্তু চারটি পথ কোথাও কাটে না। TASK-10-এর quota floor (`balance <= 0` হলে আটকায়) একমাত্র সুরক্ষা — অর্থাৎ যতক্ষণ merchant-এর balance শূন্যের উপরে আছে, এই কাজগুলো **বিনামূল্যে** চলবে।

📁 **যে চারটি পথ কাটে না**

| পথ | কল কোথায় | কেন গুরুত্বপূর্ণ |
|---|---|---|
| **Embeddings** | `lib/ai/embeddings.ts` → `callEmbeddings()` | সবচেয়ে বেশি volume। প্রতি RAG retrieval + প্রতি chunk write |
| **Translation** | `lib/ai/translation.ts` (`translateToEnglish`) | প্রতিবার Bengali prompt সংরক্ষণে |
| **Translate-prompt API** | `app/api/chatbots/translate-prompt/route.ts` | UI থেকে সরাসরি ডাকা হয় |
| **Enhance-prompt API** | `app/api/chatbots/enhance-prompt/route.ts` | ⚠️ নিচের ফাঁদটি দেখুন |
| **Text-ingest** | `app/api/chatbots/[chatbotId]/products/text-ingest/route.ts` | প্রতি bulk product import-এ |

⚠️ **ফাঁদ — একই নামের দুটি route:** `enhance-prompt`-এর **দুটি** route আছে। `[chatbotId]/enhance-prompt` credit কাটে (`getActionCredits("enhance_prompt")`), কিন্তু `chatbots/enhance-prompt` (scope ছাড়া) কিছুই কাটে না। একই কাজ, দুই দাম — এবং UI কোনটি ডাকে তার উপর নির্ভর করে merchant bill হবেন কি না। এটিই সবচেয়ে আগে ঠিক করা দরকার।

✅ **যে চারটি কাটে (তুলনার জন্য, এগুলো leak নয়):** `chat/route.ts` ও `internal/ai-usage/route.ts` (`chargeUsage`), `auto-train` (`AUTO_TRAIN_FEE`), `compare` (`creditsRequired`), `products/sync` (`PRODUCT_SYNC_FEE`), `[chatbotId]/enhance-prompt` (`getActionCredits`)

🔧 **করণীয়**

1. প্রতিটি পথের জন্য সচেতন সিদ্ধান্ত নিন — হয় (ক) plan-এ অন্তর্ভুক্ত, তাহলে খরচ লেখা থাকুক কিন্তু billing-এ ধরতে হবে না, নয়তো (খ) credit কাটতে হবে `credit-resolver.ts` দিয়ে (hardcode নয়)।
2. **দুটি `enhance-prompt` route-কে এক করুন** — অথবা scope ছাড়া variant-টিকে সরিয়ে দিন।
3. কাটা শুরু করলে [`lib/domain/ai-task.ts`](../../lib/domain/ai-task.ts)-এর `isCharged` বদলাবে — ⚠️ [`ai-task.test.ts`](../../lib/domain/ai-task.test.ts)-এর tripwire test তখনই fail করবে, যা ইচ্ছাকৃত: সিদ্ধান্তটা যেন চুপচাপ না হয়।

✅ **গ্রহণযোগ্যতা**

- প্রতিটি AI পথ হয় credit কাটে, নয়তো task.md-তে স্পষ্টভাবে "plan-এ অন্তর্ভুক্ত" লেখা থাকে
- `enhance-prompt`-এর একটাই route
- `AIUsageLog`-এর `creditsDeducted` আর `creditTransaction`-এর যোগফল মেলে

---

## Phase 5 — প্রোডাক্ট সম্পূর্ণতা

---

### TASK-12 — Website Widget route

**Priority:** 🟠 High · **অবস্থা:** ✅ কোড ও যাচাই সম্পন্ন (২০২৬-১০-১৩) — শুধু হাতে ব্রাউজার পরীক্ষা ইউজারের হাতে বাকি · **ইউজার-সিদ্ধান্ত মোতাবেক:** Origin allowlist নয়, **আলাদা widget key**

> ⚠️ **নিচের বিবরণটি টাস্ক লেখার সময়কার অবস্থা** — তখন route একেবারে অনুপস্থিত ছিল। কী করা হলো, আর কেন পরিকল্পনার `chatbotId`-চাবির বদলে `Integration.integrationId` চাবি হলো, তা এই সেকশনের শেষে **✅ যা করা হলো**-তে।

🎯 **কী**

Website channel-এর widget route **অস্তিত্বই নেই**। `hooks/integrations/useWebsiteIntegration.ts:26` এই HTML snippet দেয়:

```ts
return `<script src="${origin}/widget/${chatbotId}.js"></script>`;
```

কিন্তু `/widget/...` route **নেই** (`app/widget` নেই, `public/widget` নেই, `app/api/widget` নেই)। অর্থাৎ **একটি channel বিক্রি করা হচ্ছে যা কাজই করে না**।

❓ **কেন**

Customer সাইটে snippet বসাবেন, কিছুই ঘটবে না, আর তিনি বুঝতেও পারবেন না কেন — এটি সবচেয়ে খারাপ ধরনের bug: **নীরব**। Website widget সবচেয়ে সহজ channel (কোনো Meta approval লাগে না), তাই এটি সবচেয়ে দ্রুত বিক্রি হওয়ার কথা — অথচ ভাঙা।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `hooks/integrations/useWebsiteIntegration.ts:26` | embed snippet তৈরি করে |
| `app/api/chatbots/[chatbotId]/chat/route.ts` | widget যেখানে মেসেজ পাঠাবে (বিদ্যমান কি না যাচাই করুন) |
| `app/widget/[chatbotId]/**` | **নতুন** |
| `public/locales/{en,bn}/*.json` | widget-এর লেখা |

🔧 **করণীয়**

1. **প্রথমে বিদ্যমান পথ যাচাই করুন:** `app/api/chatbots/[chatbotId]/chat/route.ts` আছে কি? `Integration` model-এ `platform: "web"` থাকলে config-এ কী থাকে (widgetPosition ইত্যাদি)? `ChatSession.platform = "web"` কোথায় লেখা হয়?
2. **`GET /widget/[chatbotId]/route.ts`** — JavaScript ফেরত দেবে (`Content-Type: application/javascript`), যা:
   - একটি launcher bubble ও iframe (বা shadow-DOM) রেন্ডার করে
   - ⚠️ **অবশ্যই সঠিক CORS/cache header** দেবে — এবং **`chatbotId` বৈধ কি না যাচাই করবে** (নাহলে যে কেউ যেকোনো সাইটে যেকোনো ID বসিয়ে ফাঁকা widget পাবে)
   - `connected` না হলে **কিছু রেন্ডার করবে না** (নীরবে ব্যর্থ, কিন্তু server-এ log)
3. **চ্যাট UI** — হালকা, দ্রুত, `--primary` gradient ব্যবহার করে। n8n/`Core-AI-Brain`-এর সাথে সংযোগ আগের মতোই (web adapter)।
4. **Snippet origin ঠিক আছে কি না দেখুন** — dev-এ `localhost`, প্রোডাকশনে আসল domain। ভুল হলে snippet ভাঙা যাবে।
5. **Rate limiting** — public route, তাই abuse সম্ভব। একটি সাধারণ per-IP/per-chatbot সীমা ভাবুন (Vercel-এ Redis নেই — একটি হালকা DB-ভিত্তিক বা in-memory সীমা)।

✅ **গ্রহণযোগ্যতা**

- snippet একটি পরীক্ষামূলক HTML পেজে বসালে widget **লোড হয়** ও মেসেজ পাঠানো যায়
- যা জবাব আসে তা Inbox/Dashboard-এ দেখা যায়
- ভুল `chatbotId` দিলে **৫০৪/৪০৪**, ফাঁকা widget নয়
- Mobile-এ (ছোট screen) ঠিকভাবে কাজ করে; Dark/Light দুই theme-এ ভালো দেখায়
- কখনোই origin hardcode নয়
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

---

✅ **যা করা হলো (২০২৬-১০-১৩)**

প্রথমে যা পাওয়া গেল, সেটাই এই টাস্কের সবচেয়ে দরকারি তথ্য: **সমস্যাটা অর্ধেক ছিল না, ঠিক অর্ধেক ছিল।** UI-ভাগ (`useWebsiteIntegration`) আগেই লেখা ও পরিপাটি ছিল — কিন্তু runtime-ভাগ একেবারে অনুপস্থিত। অর্থাৎ merchant snippet কপি করে বসালে ব্রাউজারে **404** যেত এবং কোনো চিহ্নই থাকত না। এখন দুই ভাগ মিলে গেছে।

| # | কী | কোথায় |
|---|---|---|
| ক | **Widget-এর চাবি = `Integration.integrationId`** — নতুন কলাম লাগেনি, **শূন্য DDL** | `lib/domain/widget-key.ts` (নতুন) |
| খ | `GET /widget/[key].js` — Clerk-মুক্ত, DB দেখে সিদ্ধান্ত, বন্ধ থাকলে UI ছাড়াই কেবল একটি comment | `app/widget/[key]/route.ts` (নতুন) · `lib/widget/render-script.ts` (নতুন) |
| গ | `POST /api/widget/[key]` — CORS + `OPTIONS` preflight, per-IP ও per-session rate limit | `app/api/widget/[key]/route.ts` (নতুন) · `lib/widget/rate-limit.ts` (নতুন) |
| ঘ | `proxy.ts`-এ দুইটি public pattern (`/widget/(.*)`, `/api/widget/(.*)`) | `proxy.ts` |
| ঙ | **Connect আগে, snippet পরে** — server-এর ফেরত দেওয়া key থেকেই কোড তৈরি; config-এ আর `embedCode` লেখা হয় না | `hooks/integrations/useWebsiteIntegration.ts` · `app/(dashboard)/dashboard/platforms/page.tsx` |
| চ | ভিজিটর-মুখী লেখা দুই ভাষায়, merchant-মুখী `integrations.json` থেকে **আলাদা** namespace | `public/locales/{en,bn}/widget.json` · `lib/domain/widget-copy.ts` |
| ছ | **৩৪৮ টেস্ট** (আগে ২২৪) — widget-এর জন্য ১২৪ নতুন | `lib/domain/widget-*.test.ts` · `lib/widget/*.test.ts` |

**১. চাবি `integrationId` কেন — এবং তার সীমা সৎভাবে।** যা বাদ পড়ল ও কেন: একটি আলাদা `widgetKey` কলাম (DDL + backfill লাগত), `config`-এর ভেতরে চাবি (তাহলে lookup হয় full scan, নয়তো JSONB index — আবার DDL), আর script-এর ভেতরে গোপন চাবি (অকেজো: কপি করা `<script src>` ট্যাগ প্রতিবার নতুন চাবি আনত, তাই rotation-এর কোনো অর্থ থাকত না)। `integrationId` ইতিমধ্যেই `@unique @default(cuid())`, ইতিমধ্যেই indexed `findUnique` lookup, আর ইতিমধ্যেই merchant-এর ব্রাউজারে যাচ্ছে — তাই **নতুন কিছু ফাঁস হচ্ছে না**। সুরক্ষা আসে **scope** থেকে, গোপনীয়তা থেকে নয়: `/api/integrations/[integrationId]`-এর PATCH/DELETE Clerk-এ বাঁধা **এবং** `chatbot: { userId }`-এ scoped — অর্থাৎ চাবি হাতে পেলে কেউ কিছু **লিখতে** পারে না। বন্ধ করার lever হলো `connected: false`।

> ⚠️ **যা এই ডিজাইনে নেই, স্পষ্ট করে বলছি: চাবি rotate করা যায় না।** চাবি বদলাতে হলে schema বদলাতে হবে (নতুন nullable-unique কলাম), অর্থাৎ DDL — যা এই টাস্কে ইচ্ছে করেই করা হয়নি। চাবি ফাঁস হলে আজকের উপায় দুটো: চ্যানেল disconnect করে আবার connect (নতুন `integrationId`)। আলাদা চাবি + rotation চাইলে সেটি আলাদা টাস্ক, এবং সেখানে আগে `prisma migrate diff` দেখিয়ে অনুমতি নিতে হবে।

**২. সবচেয়ে বড় ফাঁদ — CORS, এবং সেটাই make-or-break।** Widget merchant-এর origin-এ চলে এবং **cross-origin** POST করে `Content-Type: application/json` দিয়ে, অর্থাৎ ব্রাউজার অবশ্যই একটি `OPTIONS` preflight পাঠাবে। preflight-এর উত্তর না মিললে widget লোড হবে, খুলবে, ভদ্রভাবে বসবে — আর প্রতিটি মেসেজে চুপচাপ ব্যর্থ হবে। তাই `OPTIONS` → `204` + `Access-Control-Allow-Origin: *` + `Allow-Methods` + `Allow-Headers` + `Max-Age: 86400`।

> ⚠️ **`Access-Control-Allow-Credentials` ইচ্ছে করেই দেওয়া হয়নি, এবং কখনো দেওয়া যাবে না।** কারণ widget ভিজিটরের কোনো cookie পাঠায় না — তাকে authorized করার কিছুই নেই। ওয়াইল্ডকার্ড origin-এর সাথে `Allow-Credentials` জোড়া লাগালে ব্রাউজার নিজেই তা প্রত্যাখ্যান করবে, আর নীতিগতভাবে সেটি হবে "যে-কেউ-পাঠাতে-পারে"-কে "পরিচয়-সহ-পাঠাতে-পারে" বানানোর চেষ্টা।

**৩. Rate limiter একটি **spill guard**, security boundary নয় — সৎভাবে।** `lib/widget/rate-limit.ts` in-memory ও per-instance: Vercel-এ কয়েকটি instance চললে প্রতিটির নিজের হিসাব, আর redeploy-এ সব শূন্য। এর কাজ একটাই — একটি ভুল/লুপিং ক্লায়েন্ট যেন হাজারো বার n8n না ডাকে। **আসল ছাদ হলো merchant-এর ব্যালেন্স** (quota guard), কারণ প্রতি মেসেজে তার ক্রেডিট কাটে। instance-জুড়ে হিসাব চাইলে durable store (Upstash/Redis) লাগবে — VPS-এ যাওয়ার পরে ভাববার বিষয়, এখন নয়।

**৪. ক্রেডিট কার কাটে — প্রশ্নটা যেখানে জিজ্ঞেস করা হয়েছিল।** **Merchant-এর, কখনো ভিজিটরের নয়।** ভিজিটর anonymous; তার কোনো অ্যাকাউন্ট, ব্যালেন্স বা পরিচয় নেই — ঠিক Facebook/WhatsApp/Instagram-এর মতোই। আর এখানে `isTestChat: false`, কারণ widget-ভিজিটর একজন **আসল ক্রেতা**, merchant নয় যে পরীক্ষা করছেন — এই একটি ফ্ল্যাগ ভুল হলে merchant-এর নিজের পরীক্ষার মেসেজ বিনামূল্যে হয়ে যেত, আর আসল ক্রেতার মেসেজ বিল হত।

**৫. একটি চুপচাপ-অতিরিক্ত-খরচের bug যা ধরা পড়ল ও বন্ধ হলো।** plan-blocked অবস্থায় `resolveModelConfig("simple", bot.model)` ব্যবহার করা স্বাভাবিক মনে হয় — কিন্তু সেটিই ঠিক সেই bug যা `lib/domain/plan-model-access.ts` আটকাতে বানানো: একটি Pro bot-এর DB-তে model id সংরক্ষিত থাকে, যা validation-এ **পাস করে**। তাই plan-blocked হলে model ইচ্ছে করেই **`"fast"` tier-এ clamp** করা হয়, bot-এর নিজের model-এ নয়।

**৬. Refusal-এ HTTP `200`, `402` নয়।** ক্রেডিট শেষ হলে যে বাক্যটি ভিজিটর পড়বে সেটি তার জন্য লেখা ("একটু পরে আবার চেষ্টা করুন"), merchant-এর বিলিং সংক্রান্ত নয় — তাই status code-ও ভিজিটরের দৃষ্টিকোণ থেকে সফল। ওই বাক্যে **billing-সংক্রান্ত কোনো শব্দ নেই** — এই নিয়মটি টেস্টে pin করা (`lib/domain/widget-copy.test.ts`-এ `BILLING_VOCABULARY` regex, দুই ভাষায়): ক্রেতা জানল যে দোকান বন্ধ, এবং দোকানের বিক্রি গেল।

**৭. যা unit test করা হয়েছে — এবং কীভাবে।** সবচেয়ে মূল্যবান টেস্টটি হাতে লেখা ছোট একটি DOM stub-এর উপর **আসল script চালায়**: mount হয়, click-এ খোলে, একবারই অভিবাদন দেয়, বাংলায় কথা বলে, ঠিক URL-এ ঠিক body পাঠায়, উত্তর `textContent` দিয়ে বসায় (`innerHTML` **খালি** — অর্থাৎ XSS payload ডেটাই থাকে), input খালি করে, blocked storage-এও টেকে, Enter ও Shift+Enter আলাদা করে, আর typing indicator ঠিক সময়ে **সরে যায়**। প্রতিটি assertion আসল আচরণ ধরে; কেবল string matching নয়।

**৮. যা unit test করা হয়নি, এবং কেন জানা দরকার।**

- **Happy path (একটি সত্যিকারের connected `website` integration) লাইভ যাচাই করা হয়নি** — কারণ সেটির জন্য DB-এ একটি row বানাতে হতো, আর অনুমতি ছাড়া DB-তে লেখা নিয়ম #১-এ নিষিদ্ধ। যা যা verified: রাউটিং, `.js`-এ Clerk-এর skip, suffix ছাড়া path, দুই public pattern, `204` preflight পূর্ণ CORS-সহ, অজানা key-তে `404` (CORS অটুট), traversal key-তে `500` নয় বরং `200` disabled script — আর DB→renderer অংশটি `tsc` দিয়ে generated client type-এর বিরুদ্ধে। **উপরের ধাপগুলো নিজে করে দেখুন (নিচে)।**
- **Rate limiter instance-জুড়ে** — উপরে §৩, নীতিগতভাবেই Vercel-এ অসম্ভব।

📥 **ইউজারকে যা করতে হবে (হাতে যাচাই)**

1. `prisma db push` লাগবে **না** — এই টাস্কে schema ছোঁয়া হয়নি। কোনো DDL নেই।
2. `/dashboard/platforms` → **Website Widget** connect করুন (এতে একটি `platform: "website"` integration row তৈরি হবে)।
3. যে snippet দেখাবে সেটি একটি পরীক্ষামূলক HTML পেজে `</body>`-র ঠিক আগে বসান, পেজটি খুলুন → **bubble দেখা উচিত**।
4. একটি মেসেজ পাঠান → উত্তর আসা উচিত, আর সেটি **Inbox/Dashboard-এ দেখা উচিত** (`ChatSession.platform = "web"`)।
5. চ্যানেলটি **disconnect** করুন → পেজ reload করলে widget **নীরবে অদৃশ্য** থাকবে (কোনো ভাঙা bubble নয়)।
6. একটি বাংলা ব্রাউজারে (বা `navigator.language` বাংলা করে) দেখুন — widget-এর নিজের লেখা বাংলায় আসবে, `AI assistant` ইংরেজিতেই থাকবে (AGENTS.md §৪)।
7. ভুল key দিয়ে দেখুন: `…/widget/vulut-key.js` → **404**, ফাঁকা বাবল নয়।
8. ⚠️ n8n-এর **`Core-AI-Brain`** কে `platform: "web"` / `channel: "web"` পেলোড চিনতে হবে। আজ পর্যন্ত widget বলতে কিছু ছিল না, তাই এই পথটি কখনো আসল ট্রাফিক পায়নি — প্রথম পরীক্ষাতেই এখানে আটকালে সেটাই কারণ।
9. বোনাস: Vercel-এর লগে নয়, **আসল ব্রাউজারে** দেখুন — CORS ভাঙা থাকলে কেবল ব্রাউজার কনসোলেই ধরা পড়ে, সার্ভার লগে ২০০-ই দেখায়।

---

## Phase 6 — Scale

> নিচের তিনটি **এখন urgency নয়** — উপরের কাজগুলো শেষ হলে করলেই চলবে। তবু তালিকায় রাখা হলো যাতে হারিয়ে না যায়।

| # | কাজ | Priority | অবস্থা | সারসংক্ষেপ |
|---|---|---|---|---|
| ১৩ | **Observability** — execution metrics + real cost per workspace | 🟠 | ⬜ | প্রতি execution-এর latency, success/failure, খরচ, fallback — সব এক জায়গায়। **`AIUsageLog` foundation আগেই আছে** (`lib/ai/charge-usage.ts`, `usage-logger.ts`, `cost-calculator.ts`) — শুধু UI + aggregation দরকার। `lib/ai/openrouter-service.ts`-এ model প্রতি pricing আনা যায়। **কোনো ফিচার নয় — সিদ্ধান্ত নেওয়ার চোখ।** এখন কোনো সংখ্যা জানা নেই: কোন workspace লাভজনক, কোন model কত খায়, কোথায় সময় যাচ্ছে। |
| ১৪ | **Sub-workflow দিয়ে duplication কমানো** | 🟡 | ⬜ | FB/IG/WA তিনটি workflow প্রায় **হুবহু কপি (প্রতিটি ~৬৬৬ লাইন)**। একটি bug fix করতে ৩ জায়গায় করতে হয় → একটি বাদ পড়ে যায়। Shared sub-workflow বের করুন: session upsert, Meta send, error handling। ⚠️ এটি n8n-এর ভেতরের কাজ — **ইউজার নিজে import করবেন**; AI JSON বানিয়ে দেবে। একবারে পুরোটা নয় — ধীরে ধীরে, প্রতিটি ধাপের পর লাইভ যাচাই। |
| ১৫ | **BYOK for enterprise + model routing per plan tier** | 🟡 | ⬜ | (ক) Enterprise customer নিজের OpenRouter key আনতে পারবেন — তাঁর খরচ তাঁর, আর আপনার key-র উপর চাপ কমে। (খ) `lib/ai/plan-model-access.ts` ও `chat-models.ts` ব্যবহার করে Starter/Growth-এর জন্য আলাদা model — সস্তা plan-এ সস্তা model, লাভজনকতা রক্ষা। |

---

## 🅿️ স্থগিত — Infrastructure Migration (VPS)

> **ইউজারের সিদ্ধান্ত: এখন নয়, পরে।** ইউজার এখন প্রোডাকশনে যাচ্ছেন না।

| # | কাজ | অবস্থা | কেন গুরুত্বপূর্ণ |
|---|---|---|---|
| ১৬ | Hostinger VPS + Coolify | 🅿️ স্থগিত | self-hosted নিয়ন্ত্রণ, খরচ |
| ১৭ | Postgres VPS-এ সরানো (একই region) | 🅿️ স্থগিত | n8n ও DB এক machine-এ → ~৫০ms × ৬ hop ≈ **৩০০ms সাশ্রয় প্রতি reply-তে**। `lib/core/db.ts`-এ `isNeon` branch আগেই আছে (`PrismaPg`) — migration সহজ |
| ১৮ | n8n queue mode + Redis + workers | 🅿️ স্থগিত | একটি slow AI execution আর বাকিদের block করবে না — **"যেকোনো সময় scale" চাওয়ার আসল উত্তর** |
| ১৯ | Vercel region `sin1` | 🅿️ স্থগিত | এক লাইনের পরিবর্তন (`vercel.json` → `"regions": ["sin1"]`), কিন্তু Vercel → Neon Singapore ২৩০ms → **~৫ms** |

**১৬–১৯ একসাথে করলে latency ৪০–৬০% কমবে** — তবে এটি infrastructure, ফিচার/নিরাপত্তার কাজ শেষ করে করলেই চলবে।

⚠️ **১৮ করার সময় যে ফাঁদগুলো আছে** (তখন মনে রাখতে হবে):
- `N8N_ENCRYPTION_KEY` **সব instance-এ একই** হতে হবে, নইলে credential decrypt হবে না
- Queue mode-এ binary data filesystem-এ রাখা যাবে না — S3 বা DB লাগবে
- PostgreSQL বাধ্যতামূলক (SQLite চলবে না)
- Worker concurrency ≥ ৫ রাখুন, নইলে DB connection pool শেষ হবে

---

## ⚠️ ডিপ্লয়ের আগে অবশ্যই — ইউজার নিজে যাচাই করবেন

এগুলো **এই repo থেকে যাচাই করা সম্ভব নয়** — শুধু ইউজারের ড্যাশবোর্ডে করা যায়:

| # | কী | কোথায় | না করলে কী হবে |
|---|---|---|---|
| ১ | ৫টি `N8N_*_WEBHOOK_URL`-এ `/webhook/` আছে (`/webhook-test/` নয়) | Vercel → Environment Variables | চ্যানেল নীরবে বন্ধ। Deploy-এর পর log-এ `[env-audit] All n8n webhook URLs use production paths.` দেখলে বুঝবেন ঠিক আছে ✅ |
| ২ | n8n-এ workflow-গুলো **Active** | n8n editor | `/webhook/` path শুধু Active workflow-এ চলে |
| ৩ | WhatsApp webhook যে Meta app-এ, সেটি `FACEBOOK_APP_SECRET`-এর app-ই কি | Meta App Dashboard | ভুল হলে channel **fail-closed** হয়ে বন্ধ (কোনো customer মেসেজ পাবেন না) |
| ৪ | `META_APP_SECRET` সেট আছে কি না (`FACEBOOK_APP_SECRET`-এর উপর precedence পায়) | Vercel | TASK-04-এর verification fail-closed |
| ৫ | Staging-এ IDOR যাচাই | — | ✅ **সম্পন্ন** (TASK-02, TASK-03) |
| ৬ | `INTEGRATION_ENCRYPTION_KEY` সেট | Vercel | TASK-08-এর পর token decrypt হবে না |
| ৭ | VPS-এ **TASK-22-এর আগে ও পরে** একটি cron হাতে চালিয়ে `200` নিশ্চিত করা (`curl` → `307` মানে Clerk আটকে দিচ্ছে) | VPS | [TASK-22](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) — ৪টি cron-ই নীরবে অচল থাকবে। Vercel-এ থাকলে: Dashboard → Cron Jobs-এর last-run status |
| ৮ | ~~৪টি cron-এর schedule **দৈনিক** কি না~~ ✅ **আর প্রযোজ্য নয়** — scheduler এখন **VPS-এর crontab**, তাই `*/10 * * * *` বৈধ | [`scripts/cron/crontab.example`](../../scripts/cron/crontab.example) | — *(আগের ঝুঁকি: Hobby + `*/10 * * * *` = **পুরো deploy ফেল**)। বিস্তারিত: [`cron-demo.md`](../cron-demo.md) §৩ সমস্যা ২* |
| ৯ | `CRON_SECRET` সেট আছে, এবং `/etc/driplare/cron.env`-এর মানটির সাথে **হুবহু** মেলে (chmod 600) | environment + VPS | প্রতিটি job `500` (`usage-alerts` `200` কিন্তু চেক বাদ) বা `401` — নীরবে কিছুই হবে না |
| ১০ | VPS crontab চালু হলে `vercel.json` থেকে `crons` ব্লক **মুছে ফেলা** | `vercel.json` | একই job দুইবার চলবে — `run-automations` customer-কে দুটি একই নুডজ পাঠাতে পারে |

---

## 🗂️ বাতিল হওয়া plan ফাইল

কাজের সময় নিচের ফাইলগুলো তৈরি হয়েছিল। **মুছে ফেলা হয়েছে** — কেন:

| ফাইল | কেন আর দরকার নেই |
|---|---|
| `01-db-client-caching.md` | TASK-01 ✅ সম্পন্ন — কোডেই সমাধান আছে |
| `02-integration-idor.md` | TASK-02 ✅ সম্পন্ন; সারসংক্ষেপ Phase 1-এ |
| `03-read-route-idor.md` | TASK-03 ✅ সম্পন্ন |
| `04-whatsapp-signature.md` | TASK-04 ✅ সম্পন্ন (`lib/core/meta-signature.ts` দেখুন) |
| `05-env-webhook-paths.md` | TASK-05 ✅ সম্পন্ন (`.env.example` + `instrumentation.ts` দেখুন) |
| `06-admin-health-truthfulness.md` | TASK-06 এখানেই পুরো লেখা আছে |

> **কেন এগুলো ফিরিয়ে আনা হচ্ছে না:** সম্পন্ন কাজের কোডটাই আসল প্রমাণ। ভবিষ্যতের কাজের জন্য এই একটি ফাইলই যথেষ্ট হওয়া উচিত — নাহলে ডকুমেন্টেশনে দুই জায়গায় সত্য থাকবে, আর একসময় একটি বাসি হয়ে যাবে।

---

## ⚠️ সংশোধনের লগ

| তারিখ | কী সংশোধিত | কারণ |
|---|---|---|
| ২০২৬-১০-১২ | "unauthenticated connect route" → "cross-tenant IDOR" | `proxy.ts:44-46`-এর Clerk middleware সব `/api/chatbots/**` সুরক্ষিত করে; আসল ঝুঁকি signed-in cross-tenant access |
| ২০২৬-১০-১২ | Scope ১টি route → ৭টি write route | একই ফাঁক ৭টি integration mutation route-এ পাওয়া গেছে |
| ২০২৬-১০-১২ | "`.env`-এ `/webhook-test/` ভুল" → "লোকাল dev-এ স্বাভাবিক; ঝুঁকি শুধু প্রোডাকশনে" | `.env` git-ignored লোকাল ফাইল; প্রোডাকশনের মান Vercel-এ। তাই সমাধান `.env` বদলানো নয় — template + boot-time audit |
| ২০২৬-১০-১২ | `04`-এর মূল দাবি "verification নেই" → যাচাইকৃত | Instagram route-এ verification ছিল, WhatsApp-এ ছিল না — helper বের করে একত্র করা হয়েছে |
| ২০২৬-১০-১২ | VPS migration Phase 2 → **স্থগিত**; বাকি কাজ নতুন ফেজে | ইউজার এখন প্রোডাকশনে যাচ্ছেন না |
| ২০২৬-১০-১২ | Analysis §৬.৫ "`/api/webhooks/facebook` reference করে" → পুরনো তথ্য | `proxy.ts`-এ আসলে `/api/webhooks/meta` ও `/api/webhooks/n8n-facebook` — **দুটোরই route নেই**। সঠিক ও সর্বশেষ অবস্থা TASK-20-এ |
| ২০২৬-১০-১২ | TASK-07 শুধু "duplicate protection" → "dedupe **+** সঠিক retry semantics" | যাচাই করে পাওয়া গেছে: forward ব্যর্থ হলেও route `202` ফেরত দেয় → Meta আর retry করে না → **মেসেজ চিরতরে হারায়** |
| ২০২৬-১০-১৩ | TASK-07-এর গ্রহণযোগ্যতা *"n8n বন্ধ রেখে POST করলে 502 আসে **আর row লেখা হয়**"* → *"claim **মুছে ফেলা** হয়"* | **আগের নকশাটি নিজের সাথে সাংঘর্ষিক ছিল।** row ধরে রাখলে Meta-র retry duplicate হিসেবে বাদ পড়ত → অর্থাৎ 502 যোগ করে কোনো লাভই হত না, মেসেজ তবু হারাত। সঠিক ক্রম: claim → forward → **ব্যর্থ হলে release**। এখন "মেসেজ বাঁচুক" ও "duplicate যেন না হয়" — দুটোই একসাথে সম্ভব |
| ২০২৬-১০-১৩ | unconfigured channel: `200 {forwarded:false}` → **`503`** | আগের আচরণে `N8N_*_WEBHOOK_URL` না থাকলে চ্যানেলটি **প্রতিটি মেসেজ নীরবে খেয়ে ফেলত** — TASK-07 যে সমস্যা ধরতে চায়, তারই একটি দৃষ্টান্ত |
| ২০২৬-১০-১৩ | নতুন টাস্ক **TASK-22** যোগ | TASK-07-এর cron route বানাতে গিয়ে পাওয়া গেল: `/api/cron/*` `isPublicRoute`-এ নেই → Clerk-এর `auth.protect()` আটকে দেয় → বিদ্যমান ৩টি cron সম্ভবত কখনো চলে না। এটি একটি **আলাদা, পূর্ব-বিদ্যমান** সমস্যা |
| ২০২৬-১০-১৩ | Scheduler: Vercel Cron → **Hostinger VPS-এর crontab** | ইউজারের সিদ্ধান্ত (প্রোডাকশন VPS-এ)। ফলে Hobby-র "দিনে একবার" সীমা আর বাধা নয় → `run-automations` `*/10 * * * *` ফিরে আসে। ⚠️ তবে **TASK-22 মেটায় না** — Clerk scheduler নির্বিশেষে আটকায়। কোড: [`scripts/cron/`](../../scripts/cron/) |
| ২০২৬-১০-১৩ | প্রি-ডিপ্লয় চেকলিস্ট #৭–#৯ (Vercel-কেন্দ্রিক) → **#৭–#১০ (VPS-কেন্দ্রিক)** | scheduler বদলেছে, তাই "Vercel → Cron Jobs" আর যাচাইয়ের জায়গা নয়। নতুন: হাতে `curl` করে `200` নিশ্চিত করা, `cron.env`-এর secret মেলানো, এবং **`vercel.json`-এর `crons` ব্লক মুছে ফেলা** (দুই জায়গা থেকে চললে `run-automations` দুইবার নুডজ পাঠায়) |
| ২০২৬-১০-১৩ | TASK-09-এর **"পথ ক" অকার্যকর ঘোষণা** — শুধু পথ খ বাস্তবায়িত | টাস্কে লেখা ছিল "`Create Order`-এর আগে একটি Code node"। কিন্তু `Create Order` একটি **AI tool** — গ্রাফে তার input edge নেই, তাই "আগে" কিছু বসানো অসম্ভব। ভুল পথটি কেটে দেওয়ায় সিদ্ধান্তটি একটাই থাকে |
| ২০২৬-১০-১৩ | TASK-09-এর total যাচাই: "AI-এর total বিশ্বাস করা" → **item লাইন থেকে হিসাব + মিলিয়ে দেখা** | AI-এর নিজের বলা total আর তার নিজের পাঠানো লাইন মিললে তবেই order হয়। না মিললে একটি লাইন ফেলে দেওয়া হয়েছে বা বানানো হয়েছে — দুটোই ভুল invoice-এর কারণ |
| ২০২৬-১০-১৩ | order id: ৬ hex → **৮ hex** | `md5`-এর ৬ hex = ১৬.৭M combination — birthday-boundary হিসাবে ~১০ হাজার order-এ সংঘর্ষ প্রায় নিশ্চিত। ৮ hex (৪.৩ বিলিয়ন) হাতে-কলমে এই ঝুঁকি শূন্য করে, আর সংঘর্ষ হলেও একটি retry সামলে নেয় |
| ২০২৬-১০-১৩ | TASK-10: "per-workspace quota" → **User-কোটা এখন, workspace budget আলাদা টাস্ক** | যাচাই করে দেখা গেল workspace-এ quota **নেই** — `creditsBalance`/`includedCredits` শুধু `User`-এ, `Workspace`-এ কেবল `status`। নেই এমন কিছু "enforce" করার চেষ্টা করলে ভুল জায়গায় সীমা বসত। তাই যা আছে তা আটকানো হলো, আর যা দরকার তা **TASK-24** হিসেবে লেখা হলো |
| ২০২৬-১০-১৩ | TASK-10: `Workspace.status === "suspended"` লেখা হচ্ছিল কিন্তু **কখনো পড়া হত না** | স্থগিত একটি workspace-ও credit পুড়িয়ে যেত। এখন `decideQuota()`-র প্রথম নিয়ম — এমনকি free message-এর উপরেও। একটি লেখা-হয়েছে-কিন্তু-পড়া-হয়নি ফিল্ড ঠিক সেই শ্রেণির বাগ, যা পরে "কেন এই account এখনো চলছে?" প্রশ্নে পরিণত হয় |
| ২০২৬-১০-১৩ | TASK-10: `compare`-এ fallback **নিষিদ্ধ** করা হলো | তুলনার একমাত্র অর্থ — প্রতিটি উত্তর তার লেবেলের model থেকেই এসেছে। fallback হলে "GPT-4o" লেখার নিচে অন্য model-এর লেখা বসত, আর merchant সেই মিথ্যা দেখে নিজের model বেছে নিতেন। model চুপ থাকা ক্ষতিকর নয়, ভুল লেবেল ক্ষতিকর |
| ২০২৬-১০-১৩ | TASK-10: "Admin-কে জানান" প্রতি-ব্যর্থতায় ইমেইল নয় → **merchant-কে dedupe করা alert + outage loudly log** | প্রতি failed কলে মেইল মানে একই outage-এ শত শত মেইল — যে সমস্যার খবর দিচ্ছে তার চেয়ে বড় সমস্যা। বদলে: credit শেষ হলে `checkUsageThresholds()` (DB-dedupe করা, `claimAlert`), আর platform-wide outage `[AI_GATEWAY_ALERT]`। সত্যিকারের alert channel **TASK-21**-এর কাজ — সেখানে একবারই বানানো হবে |
| ২০২৬-১০-১৩ | TASK-10: `checkUsageThresholds()` blocked পথেও ডাকা হয় | ⚠️ আগে **কখনোই** চলত না: fee কাটা হয় শুধু *সফল* charge-এর পরে, আর credit শেষ হওয়ার পর কোনো charge-ই সফল হয় না — অর্থাৎ "credit শেষ" মেইলটা হয়তো কখনো যেত না, merchant নীরবে reply হারাতেন |
| ২০২৬-১০-১৩ | TASK-10 Part A: fallback ও retry-এর নিয়ম `lib/domain/`-এ সরানো হলো | প্রথমে পুরো লুপটা `lib/ai/gateway.ts`-এ ছিল — অর্থাৎ `server-only` + Prisma-র ভেতরে আটকে, তাই পরীক্ষা করা অসম্ভব। কোডবেসের নিয়ম মেনে pure লজিক [`ai-attempt-loop.ts`](../../lib/domain/ai-attempt-loop.ts)-এ গেল → ১১টি test, কোনো mock নেই (provider, ঘড়ি, sleep — সব inject করা) |
| ২০২৬-১০-১৩ | নতুন টাস্ক **TASK-25** যোগ — ৪টি AI পথ bill-ই হয় না | `chargeUsage()`-এর মাত্র ২টি caller। embeddings (সবচেয়ে বেশি volume), translation, translate-prompt, text-ingest, এবং `enhance-prompt`-এর scope-ছাড়া variant — কোথাও credit কাটে না। সবচেয়ে জরুরি: **একই নামের দুটি `enhance-prompt` route**, যার একটি কাটে আর একটি কাটে না |
| ২০২৬-১০-১৩ | TASK-09 ✅ সম্পন্ন | endpoint `POST /api/internal/orders`, Zod layer, ৭৮টি unit test, `Create Order` node → `httpRequestTool` |
| ২০২৬-১০-১৩ | নতুন টাস্ক **TASK-23** যোগ — n8n tool node-এ SQL injection | Multimodal অডিট করতে গিয়ে পাওয়া গেল: `Product Lookup` ও `Create Order`-এ `$fromAI()`-এর মান escaping ছাড়া SQL-এ বসে — অথচ একই ফাইলের `Save Chat History`-তে escaping আছে। একটি চ্যাট মেসেজ দিয়েই চলানো সম্ভব, তাই আলাদা নিরাপত্তা টাস্ক |
| ২০২৬-১০-১৩ | TASK-10 Part B: quota চেক **`Automation Gate`-এর সাথে জুড়ে দেওয়া হয়নি** | লোভনীয় ছিল — Gate তো প্রতি মেসেজে প্ল্যাটফর্মে যায়, বাড়তি hop লাগত না। কিন্তু TASK-11 ঠিক ওই Gate-টিকেই cache করে critical path থেকে সরাবে; তাহলে quota verdict-ও cache-এ জমে যেত, আর credit শেষ হওয়া merchant TTL শেষ না হওয়া পর্যন্ত reply পেতেন। তাই আলাদা একটি endpoint |
| ২০২৬-১০-১৩ | TASK-10 Part B: `balance > 0` চেক n8n-এ **নকল করা হয়নি**, যদিও `Fetch Bot Config` আগেই `creditsBalance` আনে | নকল করা মানে credit-এর নিয়ম দুই জায়গায় — admin panel থেকে credit বদলালে n8n-এর কপি পুরনো মান নিয়ে বসে থাকত। এছাড়া suspension নিয়ম ও merchant-কে পাঠানো "credit শেষ" alert কেবল app-side থেকেই সম্ভব। দাম: প্রতি AI-heavy মেসেজে ~২৩০ms বাড়তি hop |
| ২০২৬-১০-১৩ | TASK-10 Part B: গ্রাহকের বার্তায় billing-এর **কোনো উল্লেখ নেই** | `aiErrors.quota_exceeded` ("credit রিচার্জ করুন") merchant-এর লেখা। কিন্তু ব্যক্তিগত চ্যাটে যিনি পড়ছেন তিনি shopper, merchant-এর account-এর সঙ্গে তাঁর সম্পর্ক নেই — merchant-এর টাকা শেষ হওয়ার খবর তাঁর সামনে যাওয়া merchant-এরই ক্ষতি। তাই আলাদা নিরাপদ key `reply_unavailable` |
| ২০২৬-১০-১৩ | TASK-10 Part B: **cross-model fallback করা হয়নি**, কারণ এটি অসম্ভব | যাচাই করে দেখা গেল `lmChatOpenRouter`-এ `models: [...]` নেই, `modelKwargs` নেই (`responseFormat`-এ হার্ডকড), এমনকি credential-এর `url`-ও `type: "hidden"`। তাই যা সম্ভব ছিল তাই: `timeout` ৬ মিনিট → ৬০ সেকেন্ড, `maxRetries: 2` explicit, আর ব্যর্থ হলে `AI Failed Reply`। বিকল্প (প্ল্যাটফর্মে OpenAI-সামঞ্জস্যপূর্ণ gateway) আলাদা সিদ্ধান্ত হিসেবে লেখা, চাপানো হয়নি |
| ২০২৬-১০-১৩ | TASK-10 Part B: `AI Agent`-এ **`retryOnFail` দেওয়া হয়নি** | Agent আবার চালানো মানে তার tool-গুলো আবার চালানো — অর্থাৎ `Create Order` দুইবার firing, একই অর্ডার দুইবার। একটি নিরীহ মনে হওয়া retry সেটিং সরাসরি ডুপ্লিকেট অর্ডার বানাতে পারত। পুনরায় চেষ্টা কেবল model node-এর HTTP স্তরে, tool চলার আগেই |
| ২০২৬-১০-১৩ | TASK-10 Part B: শেষ-হতে-যাওয়া reply-র জন্য `AI Failed Reply` যোগ | কাজটা quota নয়, তবুও এখানেই দরকার: AI Agent ব্যর্থ হলে (`Execute Core AI Brain`-এ এরর) caller পেত খালি `replyText` — Facebook-এ সেটি হয়ে যেত `"text": ""` সহ একটি Graph API call, অর্থাৎ ৪০০, আর গ্রাহক পেত **সম্পূর্ণ নীরবতা**। fallback নেই বলেই এই পথটা বন্ধ করা জরুরি ছিল |
| ২০২৬-১০-১৩ | TASK-11 ✅ সম্পন্ন — Gate **cache করা হয়নি**, বরং তার উল্টোটা প্রমাণিত | টাস্কে লেখা ছিল "Gate cache করুন"। কোড পড়ে দেখা গেল `runEvent()` শুধু পড়ে না, **লেখেও** — `ChatMessage`/`ChatSession` (Live Inbox-এর একমাত্র সূত্র), `AutomationRun` (Activity পেজ), `Automation.lastRunAt`, আর frequency-cap যা **আগের row-এর উপর** নির্ভর করে। cache করলে এই চারটিই ভাঙত। তাই টাস্কের সুপারিশ বাতিল করে আসল লাভ অন্য জায়গায় নেওয়া হলো: `Quota Check` হপ পুরো বাদ |
| ২০২৬-১০-১৩ | TASK-11: Billing fire-and-forget **করা হয়নি** — টাস্কে করা হয়েছিল সুপারিশ | সুপারিশের আগে যা যাচাই করা হয়নি: `billingOk` **একমাত্র** দ্বিগুণ-বিল-রক্ষাকবচ। উত্তর দেরিতে এলে `app/api/chatbots/[chatbotId]/chat/route.ts` নিজেই আবার `chargeUsage()` ডাকে, আর playground-এর কল `runId` পাঠায় না — তাই দুই charge একে অন্যের প্রতি idempotent নয়। অর্থাৎ latency বাঁচাতে গিয়ে **একই reply দুবার বিল** হত |
| ২০২৬-১০-১৩ | TASK-11: `resolveQuotaAnswer()` **কখনো throw করে না** | `/api/automations/evaluate`-র outer `catch` fail-open (DB hiccup-এ AI বন্ধ করে না)। `assertAIQuota` আটকালে throw করে — সেই throw ওই ঢিলা catch-এ পড়লে **credit শেষ হওয়া merchant-এর AI চুপচাপ চলতেই থাকত**, অথচ quota guard পুরোপুরি নিষ্ক্রিয় দেখাত |
| ২০২৬-১০-১৩ | TASK-11: Vercel region `sin1` যোগ | কারণটা টাস্কে লেখা ছিল না: Vercel ফাংশন ডিফল্ট `iad1` (US-East)-এ চলত, কিন্তু Neon **Singapore**-এ — অর্থাৎ **প্রতিটি** DB round trip আমেরিকা↔সিঙ্গাপুর পার হত (~২৩০ms)। ⚠️ VPS+Coolify-তে যাওয়ার পরে এটি অপ্রযোজ্য; তখন Neon-কে VPS-এর কাছে আনতে হবে |
| ২০২৬-১০-১৩ | TASK-11: `getCreditRules()`-এর dedup **unit test করা হয়নি**, এবং করা যায় না | `React.cache` সত্যিকারের memoisation করে কেবল `react-server` condition-এ; vitest সেটি সেট করে না, তাই passthrough client build লোড হয়। টেস্টটি প্রোডাকশন কোড ঠিক থাকা সত্ত্বেও fail করত — নকল করে পাস করানো মানে মিথ্যা নিশ্চয়তা। কারণ কোডের কমেন্টে লেখা |
| ২০২৬-১০-১৩ | TASK-12: চাবি `chatbotId` নয় → **`Integration.integrationId`** | টাস্কে লেখা ছিল `/widget/[chatbotId].js`। কিন্তু `chatbotId` **unique নয় per channel** — এক bot-এ Facebook+WhatsApp+Web তিনটিই থাকতে পারে, আর widget-কে জানতে হয় কোন integration-টি। বোনাস: `integrationId` ইতিমধ্যেই `@unique`+indexed+merchant-এর ব্রাউজারে যাওয়া, তাই **শূন্য DDL** |
| ২০২৬-১০-১৩ | TASK-12: ⚠️ **চাবি rotate করা যায় না** — জানা-জেনে মেনে নেওয়া সীমা | আলাদা `widgetKey` কলাম থাকলে rotation সম্ভব হত, কিন্তু সেটি DDL (schema + backfill) — যা এই টাস্কে অনুমোদিত ছিল না। তাই সুরক্ষা আসে **scope** থেকে (PATCH/DELETE Clerk-গেটেড ও `chatbot.userId`-scoped, অর্থাৎ চাবি হাতে পেলে কেউ **লিখতে** পারে না), গোপনীয়তা থেকে নয়। rotation চাইলে আলাদা টাস্ক + `prisma migrate diff` অনুমোদন |
| ২০২৬-১০-১৩ | TASK-12: plan-blocked পথে model = `resolveModelConfig("simple", bot.model)` **নয়** → `"fast"` | লোভনীয় ছিল bot-এর নিজের model ব্যবহার করা। কিন্তু একটি Pro bot-এর DB-তে model id সংরক্ষিত থাকে যা validation-এ **পাস করে** — অর্থাৎ plan ব্লক করা থাকলেও Pro model চলত। এটি ঠিক সেই bug যা `plan-model-access.ts` আটকাতে বানানো হয়েছিল |
| ২০২৬-১০-১৩ | TASK-12: widget-এর চাবি **Origin allowlist নয়** (ইউজার-সিদ্ধান্ত), আর CORS-এ `Allow-Credentials` নেই | allowlist রাখতে হত per-merchant domain তালিকা — অর্থাৎ DDL + UI + merchant-এর প্রতিটি subdomain/staging যোগ করার ঝামেলা, আর ভুল হলে widget **নীরবে** ভাঙত। `Allow-Credentials` ইচ্ছে করেই বাদ: widget ভিজিটরের কোনো cookie পাঠায় না, তাই সেটি যোগ করা মানে শুধু ঝুঁকি, লাভ শূন্য |
| ২০২৬-১০-১৩ | TASK-12: rate limiter সৎভাবে **"spill guard"** নামে ডকুমেন্টেড, "security boundary" নয় | in-memory, per-instance, redeploy-এ শূন্য। একটি ভুল/লুপিং ক্লায়েন্ট যেন হাজারো বার n8n না ডাকে — এটুকুই এর কাজ। **আসল ছাদ merchant-এর ব্যালেন্স** (quota guard)। instance-জুড়ে হিসাব চাইলে durable store লাগবে — VPS-এ যাওয়ার পরে |
| ২০২৬-১০-১৩ | TASK-12: টাস্কে দেওয়া দুই অপশনের মধ্যে **shadow DOM** বেছে নেওয়া হলো, iframe নয় | iframe হলে ভিজিটরের পেজ থেকে একটি আলাদা document + আলাদা script লোড + যোগাযোগের জন্য `postMessage` protocol লাগত, আর উচ্চতা/স্ক্রল নিয়ে যুদ্ধ আলাদা। shadow DOM একই ফাইলে পূর্ণ আলাদা CSS scope দেয় (`attachShadow({mode:"open"})`) — অর্থাৎ host পেজের কোনো style widget-এ ঢুকতে পারে না, দুই দিকেই কোনো `postMessage` নেই, আর একটি মাত্র HTTP রিকোয়েস্ট |

---

## সংশ্লিষ্ট নয় কিন্তু লক্ষণীয়

`.env`-এ `Next_JS_WEHBOOK` কী-টি **৩ বার** আছে (বানান ভুল — `WEBHOOK` নয়)। যাচাই করা হয়েছে: কোডে এটি কোথাও ব্যবহৃত হয় **না** — সম্ভবত n8n-এ বসানোর জন্য রাখা নোট। অ্যাপে কোনো প্রভাব নেই; শুধু বিভ্রান্তিকর। পরিষ্কার করা হবে TASK-20-এ।
