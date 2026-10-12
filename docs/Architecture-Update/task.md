# Architecture-Update — Master Task List

> **সূত্র:** [`architecture-analysis.md`](./architecture-analysis.md)
> **শেষ হালনাগাদ:** ২০২৬-১০-১২
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
| ২ — Monitoring ও Webhook নির্ভুলতা | ৩ | **১** | ০ | ২ |
| ৩ — Merchant ডেটা সুরক্ষা | ২ | ০ | ০ | ২ |
| ৪ — খরচ ও Resiliency | ৩ | ০ | ০ | ৩ |
| ৫ — প্রোডাক্ট সম্পূর্ণতা | ১ | ০ | ০ | ১ |
| ৬ — Scale | ৩ | ০ | ০ | ৩ |
| 🅿️ স্থগিত — VPS | ৪ | ০ | ০ | ৪ |
| **মোট** | **২১** | **৬** | **০** | **১৫** |

> **👉 পরের টাস্ক: [`TASK-07`](#task-07--webhook-নির্ভুলতা-dedupe--সঠিক-retry-semantics)**

**ক্রম কেন এমন:** মানুষের ডেটা ও আপনার টাকা রক্ষা করা আগে, ফিচার পরে। ইউজার সিদ্ধান্ত নিয়েছেন **এখন VPS-এ যাবেন না** — তাই infrastructure-এর সব কাজ একদম নিচে **স্থগিত** করা হলো।

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

**Priority:** 🟠 High · **অবস্থা:** ⬜ **বাকি** · **⚠️ DB schema পরিবর্তন লাগবে**

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
- `claimDeliveries(provider, ids)` → নতুন id-গুলো `createMany({ skipDuplicates: true })` দিয়ে লেখে; `P2002` unique-violation ধরে ফেলে (concurrent delivery-র race)
- সব id আগেই দেখা থাকলে → `{ isDuplicate: true }`

**ধাপ ৩ — তিনটি route-এ বসান**, এই ক্রমে:

1. Signature verify (আগেই আছে — হাত দেবেন না)
2. Payload parse
3. `extractMessageIds` → **সবগুলো duplicate** হলে সাথে সাথে `200` ফেরত দিন, **n8n-এ forward করবেন না**
4. `claimDeliveries` দিয়ে নতুনগুলো লিখুন
5. n8n-এ forward
6. **forward সফল → `200`. ব্যর্থ → `502`** (`202` নয়!) — যাতে Meta আবার পাঠায়। Dedupe থাকায় retry করলে double-process হবে না।

**ধাপ ৪ — পুরনো row পরিষ্কার করার ব্যবস্থা:** একটি retention sweep (৭ দিনের বেশি পুরনো `WebhookDelivery` মুছে ফেলা)। Cron না থাকলে — `claimDeliveries`-এর ভেতরে ~১% সম্ভাবনায় একটি best-effort `deleteMany` চালানো যেতে পারে, অথবা একটি ছোট admin route। **যা-ই করুন, ব্যাখ্যা করে কমেন্ট লিখুন।**

✅ **গ্রহণযোগ্যতা**

- একই `message.id` দিয়ে **দুবার** একই POST পাঠালে → n8n **একবার** কল হয়, দুবারই `200` আসে
- n8n বন্ধ রেখে POST করলে → `502` আসে (আর `WebhookDelivery`-এ row লেখা হয় — অর্থাৎ retry এলে duplicate হবে না)
- ভিন্ন `message.id` → সবসময় forward হয়
- `extractMessageIds` অপরিচিত payload-এ crash করে না (খালি array ফেরত দেয়)
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0
- ইউজার যা যা করতে হবে (DB migration চালানো, Meta dashboard-এ কিছু নয়) তা স্পষ্টভাবে জানানো

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

## Phase 3 — Merchant ডেটা সুরক্ষা

> VPS ❌ · **n8n সমন্বয় দরকার** (workflow ইউজার নিজে import করেন)

---

### TASK-08 — Token encryption at rest

**Priority:** 🔴 Critical · **অবস্থা:** ⬜ বাকি · **এই তালিকার সবচেয়ে বড় কাজ**

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

---

### TASK-09 — Order validation layer

**Priority:** 🟠 High · **অবস্থা:** ⬜ বাকি

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
   - **ক) n8n-এর ভেতরে validation:** `Create Order`-এর আগে একটি Code node। দ্রুত, কিন্তু منطق n8n JSON-এ আটকে যায় (version control দুর্বল) এবং Zod ব্যবহার করা যায় না।
   - **খ) Next.js-এ validation API:** নতুন route `POST /api/internal/orders` (TASK-05-এর মতো `x-n8n-secret` shared-secret + `timingSafeEqual` দিয়ে সুরক্ষিত)। n8n সরাসরি INSERT না করে এখানে POST করে। Zod-এর পূর্ণ শক্তি পাওয়া যায়, logic টেস্টযোগ্য, git-এ থাকে।
   > **সুপারিশ: পথ খ** — তবে এতে BD → US-East একটি hop যোগ হয় (~230ms)। যেহেতু এটি order-confirm path-এ (অপেক্ষাকৃত কম frequest), latency গ্রহণযোগ্য।
4. **পরীক্ষা ব্যর্থ হলে:** order তৈরি না করে AI-কে feedback দিন (n8n-এ error output → agent আরেকবার জিজ্ঞেস করবে)। ব্যবহারকারীকে কখনো ফেক confirmation দেখাবেন না।
5. **Confirmation step:** গুরুত্বপূর্ণ order-এ (যেমন phone/address) চূড়ান্ত INSERT-এর আগে customer-এর কাছ থেকে explicit হ্যাঁ নেওয়া — **অন্ততপক্ষে** AI-এর reply-তে সংক্ষিপ্ত সারসংক্ষেপ যাচাই করানো।

✅ **গ্রহণযোগ্যতা**

- ভুল phone/address/quantity দিলে order **তৈরি হয় না**, বরং একটি স্পষ্ট error লগ হয়
- সঠিক ডেটায় order আগের মতোই তৈরি হয় (regression নেই)
- validation logic-এ একটি unit test (সঠিক ও ভুল — দুই ধরনের case)
- কোন n8n workflow বদলাতে হবে তা লিখিতভাবে ইউজারকে দেওয়া
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

---

## Phase 4 — খরচ ও Resiliency

> VPS ❌

---

### TASK-10 — AI Gateway: model fallback + per-workspace quota enforcement

**Priority:** 🔴 Critical · **অবস্থা:** ⬜ বাকি

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

- primary model `402`/`429` দিলে কল **স্বয়ংক্রিয়ভাবে** fallback model-এ যায় — chat বন্ধ হয় না
- quota শেষ একটি workspace-এর request **আটকায়**, কিন্তু বার্তাটি স্পষ্ট ও i18n-করা
- সব AI কল `gateway.ts` দিয়ে যায় (`grep` করে দেখানো হবে — বাইরে সরাসরি OpenRouter কল নেই)
- fallback path-এর একটি unit test
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

---

### TASK-11 — Automation Gate ও Billing API critical path থেকে সরানো

**Priority:** 🟠 High · **অবস্থা:** ⬜ বাকি · **n8n সমন্বয় দরকার**

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

✅ **গ্রহণযোগ্যতা**

- সাধারণ text reply-তে node-দুটো আর reply আটকায় না (n8n execution log দিয়ে প্রমাণ)
- latency আগের চেয়ে measurable-ভাবে কমেছে (আগে/পরে সংখ্যা দেওয়া)
- billing তথ্য **হারায় না** — fallback পথ কাজ করছে (যাচাই করে দেখানো)
- কোন workflow import করতে হবে তা ইউজারকে লিখিতভাবে দেওয়া
- `npx tsc --noEmit` → 0 · `npm run build` → exit 0

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

## Phase 5 — প্রোডাক্ট সম্পূর্ণতা

---

### TASK-12 — Website Widget route

**Priority:** 🟠 High · **অবস্থা:** ⬜ বাকি

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

---

## সংশ্লিষ্ট নয় কিন্তু লক্ষণীয়

`.env`-এ `Next_JS_WEHBOOK` কী-টি **৩ বার** আছে (বানান ভুল — `WEBHOOK` নয়)। যাচাই করা হয়েছে: কোডে এটি কোথাও ব্যবহৃত হয় **না** — সম্ভবত n8n-এ বসানোর জন্য রাখা নোট। অ্যাপে কোনো প্রভাব নেই; শুধু বিভ্রান্তিকর। পরিষ্কার করা হবে TASK-20-এ।
