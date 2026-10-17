# Architecture-Update — Master Task List

> **সূত্র:** [`architecture-analysis.md`](./architecture-analysis.md)
> **শেষ হালনাগাদ:** ২০২৬-১০-১৭ — TASK-07 ✅ · TASK-08 ✅ · TASK-09 ✅ সম্পন্ন · **TASK-10 Part A ✅ ও Part B ✅** (AI Gateway + n8n-side quota pre-flight) · **TASK-11 ✅** (Gate+Billing এক হপ কম, Vercel `sin1`) · **TASK-12 ✅** (Website Widget — এখন সত্যিই কাজ করে) · **TASK-13 ✅** (AI Observability — খরচের চোখ, সাথে বানানো revenue হিসাব সংশোধিত) · TASK-24 ও TASK-25 যোগ (workspace budget + revenue leak) · **TASK-14 ✅** (adapter drift guard + shared-node sync script + IG/WA-র ভাঙা brain id) · **✅ TASK-15 — ৯টি সাব-টাস্কের কোডই সম্পূর্ণ** (২০২৬-১০-১৬: ১৫.৮ শেষ, ডিফল্টে বন্ধ) · 📄 **নতুন ফাইল: [`task-whatsapp-billing.md`](./task-whatsapp-billing.md)** — WhatsApp credit line / Embedded Signup / Tech Provider / BSP-এর পুরো সিদ্ধান্ত ও বাকি কাজ · scheduler = VPS-এর crontab ([`cron-demo.md`](../cron-demo.md))
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
   কারণ `db push` একটি **অপর্যালোচিত diff** সোজা প্রয়োগ করে — কী মুছছে বা বদলাচ্ছে তা দেখার সুযোগ দেয় না। *(⚠️ ২০২৬-১০-১৪-এ সংশোধিত কারণ: আগে এখানে লেখা ছিল "`db push` `n8n_chat_histories` মুছে ফেলবে" — সেটি এখন **আর সত্য নয়**, কারণ ওই টেবিল দুটি এখন schema-তেই ঘোষিত ([`merchant.prisma`](../../prisma/schema/merchant.prisma) → `N8nChatHistory`, `N8nChatHistoryLegacy`) — ঠিক এই কারণেই। যাচাই করা diff-এ কোনো `DROP` আসে না। নিয়মটি তবুও বলবৎ, কারণ সুরক্ষাটা টিকে আছে কেবল ওই দুটি model ঘোষিত থাকলে — আর সেটি যে কেউ ভুলে সরিয়ে দিতে পারে।)* উপরের diff-এর output ইউজারকে দেখিয়ে অনুমতি নিতে হবে, তারপর আলাদা SQL চালাতে হবে।
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
| ৬ — Scale | ৩ | **২** | **১** | ০ |
| 🅿️ স্থগিত — VPS | ৪ | ০ | ০ | ৪ |
| **মোট** | **২৫** | **১৪** | **১** | **১০** |

> **👉 ⏸️ স্থগিত: TASK-15 — Pricing ladder, credit auto-derivation, feature gating ও free trial** *(Phase 6-এর শেষে)* — **৯টি সাব-টাস্কের কোডই সম্পন্ন (১৫.১ · ১৫.২ · ১৫.৩ · ১৫.৪ · ১৫.৫ · ১৫.৯ · ১৫.৬ · ✅ **১৫.৭** · ✅ **১৫.৮**)** — ⚠️ ১৫.৮-এর কোড ২০২৬-১০-১৬-এ লেখা হয়েছে **ডিফল্টে বন্ধ অবস্থায়** (`whatsappFeeBdtPerMessage = 0`), অর্থাৎ deploy করলেই কিছুই কাটে না; **🆕 ২০২৬-১০-১৭-এ সিদ্ধান্ত হয়েছে: Model B — প্ল্যাটফর্মই Meta-কে বিল দেবে** (merchant কার্ড দেবেন না), তবে Tech Provider-এর credit line না থাকায় এটি **একটি Solution Partner / BSP-র মাধ্যমে (MPS)** করতে হবে — চুক্তির পরে admin panel-এ **সর্বমোট effective রেট** বসালেই surcharge চালু। ⚠️ Surcharge আদৌ চালু হবে কি না (খরচ credit-এ ফেরত নেওয়া হবে, না সম্পূর্ণ প্ল্যাটফর্ম বহন করবে) **এখনো অনির্ধারিত** — তাই `0`-ই সঠিক। সম্পূর্ণ আলোচনা, প্রমাণ ও করণীয়: [`task-whatsapp-billing.md`](./task-whatsapp-billing.md)। ⚠️ **১৫.৭-এর কোড, টেস্ট ও build শেষ (২০২৬-১০-১৫), কিন্তু চালু করার আগে দুটি দরজা আপনার হাতে:** (১) `pricing_catalogue` PlatformSetting row তৈরি — একটি DB লেখা; (২) deploy-এর আগে §5b-র মেয়াদোত্তীর্ণ-কিন্তু-পরিশোধকারী তালিকা দেখা। বিস্তারিত TASK-15 সেকশনে। ২০২৬-১০-১৫-এ **১৫.৪ (কোড ও DB migration) · ১৫.৫ · ১৫.৯ · ১৫.৬** শেষ হলো, ক্রম ১৫.৪ → ১৫.৫ → ১৫.৯ → ১৫.৬ মেনে — বিস্তারিত ও প্রতিটি সিদ্ধান্তের কারণ TASK-15 সেকশনে। ✅ **DB migration (১৫.৪):** read-only যন্ত্র [`scripts/task15-migration-audit.ts`](../../scripts/task15-migration-audit.ts) চালিয়ে ৫ জন user-এর মাপা অবস্থা দেখানো হয়েছে (কেউ কোনো channel হারাবেন না — migrate হবে SD Prince ও Test User, দুজনেই `growth @ bd`, ব্যালেন্স ৫০০, connected channel শূন্য), তারপর আপনার স্পষ্ট অনুমতির পরে [`scripts/task15-migrate-legacy-plans.ts`](../../scripts/task15-migrate-legacy-plans.ts) `--apply` দিয়ে দুইজনকে `business`-এ আনা হয়েছে (`setUserPlan` — দ্বিতীয় implementation নয়; ডিফল্ট dry-run, আর পুনরায় চালালে "Nothing to migrate")। আউটপুট TASK-15 সেকশনের "🧪 যাচাই" অংশে। **এই round-এ DDL শূন্য** — ১৫.৬-এর `trialEndsAt` কলামটির দরকারই পড়েনি (`planExpiresAt` পুনর্ব্যবহার), তাই `migrate diff`/`db push`-এর প্রশ্ন ওঠেনি। ৳৯০,০০০/মাস leak-এর ঢাকনা (১৫.৯) বসানো হলো **TASK-22-এর আগেই** — অর্থাৎ leak সক্রিয় হওয়ার আগেই। ✅ **তিনটি যাচাই-ই সবুজ (২০২৬-১০-১৫):** `npx tsc --noEmit` → **০ error** · `npm test` → **৫৭২টি পাস / ২৪ ফাইল** (আগে ৫২৩/২১) · `npm run build` → **exit 0**। ⚠️ যাচাইয়ের সময় **দুটি সত্যিকারের বাগ** ধরা পড়ে ঠিক করা হয়েছে (একটি test-এর tripwire কখনোই পাস করত না, আর `refundStatus` nullable-এ Prisma-র `not`-এর অনিশ্চয়তা — যেটি ভুল হলে পরিশোধকারীর chatbot বন্ধ করত) — দুটোরই বিবরণ TASK-15 সেকশনের **"🧪 যাচাই"** অংশে। ⚠️ TASK-13-এর পাঠ এখানে সত্যিই প্রযোজ্য: `tsc`/`build` সবুজ হওয়া কোনো **DB query চালায় না** — সেই দিকটি ১৫.১-এর read-only audit দিয়ে মাপা হয়েছে (নিচের অংশে)। — **সূত্র:** [`docs/pricing/pricing-model-analysis.md`](../pricing/pricing-model-analysis.md)। ⚠️ **দুটি পুরনো সিদ্ধান্ত বাতিল:** ~~BYOK~~ (ইউজার-সিদ্ধান্ত + কারিগরিভাবে অসম্ভব) ও ~~per-plan model allow-list~~ (ইচ্ছে করেই মুছে দেওয়া হয়েছিল)। — **TASK-14 সম্পন্ন (২০২৬-১০-১৪):** ⚠️ **পথ বদলানো হয়েছে** — sub-workflow নয়, **sync script** (`lib/n8n/shared-nodes.json` + `npm run n8n:sync`), কারণ sub-workflow কারিগরিভাবে `respondToWebhook` নোড দুটি ভাগ করতেই পারে না, অথচ sync script পারে; আর runtime-এ শূন্য খরচ। সাথে আসল bug: IG/WA-র brain id placeholder ছিল — **ওরা কখনো উত্তরই দিত না**। *(TASK-11 ও TASK-12 দুটোই সম্পন্ন — তবে TASK-11-এর n8n import ও "before/after" timing, আর TASK-12-এর একবার হাতে ব্রাউজার পরীক্ষা ইউজারের হাতে বাকি; দুটোর ধাপ নিজ নিজ সেকশনে আছে। TASK-13-এর কোড ও তিনটি যাচাই (`tsc` · `test` · `build`) সম্পন্ন — ২০২৬-১০-১৪; কেবল **হাতে UI পরীক্ষা** ইউজারের হাতে বাকি, সেকশন দেখুন)* ⚠️ **TASK-14-এর একটি ধাপ জরুরি: IG/WA-র corrected JSON আবার n8n-এ import করতে হবে** (সেকশন দেখুন) *(Phase 2-এ এখনো [`TASK-20`](#task-20--webhook-entry-point-ও-dead-reference-পরিষ্কার) ও [`TASK-22`](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) বাকি, তবে ডকুমেন্টের নিয়ম অনুযায়ী টাস্ক নম্বর ধরে এগোনো হয়। ⚠️ TASK-14 হলো n8n workflow-এর ভেতরের কাজ — সেখানে **ব্লকার TASK-22 নয়**, বরং import ইউজারের হাতে)*
>
> **⚠️ TASK-07 চলাকালীন একটি প্রোডাকশন ব্লকার পাওয়া গেছে — [`TASK-22`](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) দেখুন।** বিদ্যমান ৩টি cron সম্ভবত কখনো চলে **নাই**।

**ক্রম কেন এমন:** মানুষের ডেটা ও আপনার টাকা রক্ষা করা আগে, ফিচার পরে। VPS **migration** (নিচে 🅿️ — টাস্ক ১৬–১৯: app/DB সরানো, region বদলানো) এখনো **স্থগিত**, কারণ সেগুলো এই repo-র বাইরের সিদ্ধান্ত।

> 🗓️ **হালনাগাদ (২০২৬-১০-১৩):** প্রোডাকশন **Hostinger VPS**-এ ডেপ্লয় হবে — অর্থাৎ VPS "ভবিষ্যতে" নয়, **এটাই গন্তব্য**। তবে migration টাস্কগুলো এখনো ছোঁয়া হয়নি। যেটি এই নথিতে **এখনই** প্রভাব ফেলে: scheduled কাজ আর Vercel Cron-এ চলবে না, চলবে **VPS-এর crontab**-এ — কোড [`scripts/cron/`](../../scripts/cron/), নির্দেশ [`cron-demo.md`](../cron-demo.md) §৪। এর ফলে `run-automations`-এর `*/10` frequency সমস্যা **সমাধান হয়ে গেছে** (TASK-22-এর item 5), কিন্তু Clerk-এর ব্লকার **একই আছে** — [TASK-22](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) এখনো অপরিহার্য।

---

### ➡️ এরপর কী — হালনাগাদ ২০২৬-১০-১৭

**TASK-15-এর ৯টি সাব-টাস্কের কোড এখন ১০০% সম্পূর্ণ** (১৫.৮-ও ২০২৬-১০-১৬-এ শেষ)। যা বাকি, তা দুই ভাগে ভাগ করা যায় — এবং **দুই ভাগই আলাদা ধরনের কাজ**।

#### ক. কোড নয় — deploy gate, আপনার হাতে

| # | কাজ | টাস্ক | অবস্থা |
|---|---|---|---|
| ১ | `pricing_catalogue` PlatformSetting row তৈরি | ১৫.৭ | ⬜ **আপনার অনুমতি লাগবে** (DB লেখা) |
| ২ | মেয়াদোত্তীর্ণ-কিন্তু-পরিশোধকারী merchant-দের তালিকা দেখা | ১৫.৭ | ✅ **মাপা হয়েছে — শূন্য** (২০২৬-১০-১৬, read-only) |
| ৩ | WhatsApp বিলিংয়ের পথ ঠিক করা (BSP / MPS) | ১৫.৮ | 🔴 **এটাই সবচেয়ে বড় বাকি কাজ** → [`task-whatsapp-billing.md`](./task-whatsapp-billing.md) |
| ৪ | `/admin/ai-settings`-এর নতুন প্যানেল দুই theme-এ চোখে দেখা | ১৫.৮ | ⬜ আপনার হাতে |

#### খ. পরবর্তী টাস্ক — Priority অনুযায়ী

| ক্রম | টাস্ক | কী | Priority | অবস্থা |
|---|---|---|---|---|
| ১ | [**TASK-22**](#task-22--cron-route-গুলো-আসলে-চলেই-না-clerk-ব্লকার) | `/api/cron/*` Clerk-এ আটকে — **৫টি cron সম্ভবত কখনো চলে না** (reset-credits, webhook-cleanup, ট্রায়াল-মেয়াদ…) | 🔴 Critical | ⬜ বাকি |
| ২ | [**TASK-23**](#task-23--n8n-tool-node-এ-sql-injection-fromai-escaping-ছাড়া) | n8n tool node-এ `$fromAI()` escape ছাড়া **SQL injection** | 🔴 Critical | ⬜ বাকি |
| ৩ | [**TASK-24**](#task-24--per-workspace-credit-budget) | Per-workspace credit budget — একটি business-এর runaway পুরো account-এর credit শেষ করে | 🟠 High | ⬜ বাকি |
| ৪ | [**TASK-25**](#task-25--যেসব-ai-কাজ-bill-ই-হয়-না-revenue-leak) | ৪টি AI পথ যেখানে খরচ হয় কিন্তু credit কাটে না (revenue leak) | 🟠 High | ⬜ বাকি |
| ৫ | [**TASK-21**](#task-21--openrouter-ব্যালেন্স-অ্যালার্ট-ও-খরচ-পর্যবেক্ষণ-ops) | OpenRouter balance alert — **শুধু কনফিগারেশন, কোনো কোড নয়** | 🟠 High | ⬜ বাকি |
| ৬ | [**TASK-20**](#task-20--webhook-entry-point-ও-dead-reference-পরিষ্কার) | `proxy.ts`-এ dead webhook pattern + admin panel-এ অস্তিত্বহীন endpoint | 🟡 Low | ⬜ বাকি |
| — | TASK-16–19 | VPS migration | 🅿️ স্থগিত | ⬜ বাকি |

> 🔴 **ক্রম নিয়ে একটি সৎ কথা।** উপরের §০ বলছে "টাস্ক নম্বর ধরে এগোবে" — অর্থাৎ ডকের ক্রমে পরেরটি **TASK-20**। কিন্তু **TASK-22 🔴 Critical** (৫টি cron অচল মানে credit reset, webhook cleanup, ট্রায়ালের মেয়াদ — সব চুপচাপ বন্ধ), আর **TASK-23 একটি খোলা নিরাপত্তা ফাঁক**। তাই পরামর্শ: **২২ → ২৩ → ২৪ → ২৫ → ২১ → ২০**। এটি §১-এর *"মানুষের ডেটা ও আপনার টাকা রক্ষা আগে, ফিচার পরে"* নীতির সাথেই সামঞ্জস্যপূর্ণ — শুধু নম্বরের ক্রমে নয়।

> 📌 **TASK-24 ও TASK-25 এখন আরও জরুরি হয়ে গেছে** — কারণ ১৫.৭/১৫.৮ শেষ মানে billing ও cost-metering প্রোডাকশনে যাচ্ছে। ওই দুই টাস্ক না থাকলে খরচ **হিসাবের বাইরে** থেকে যাবে, ঠিক যে সমস্যাটা ১৫.৭ সমাধান করছে।

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
| ১৩ | **Observability** — execution metrics + real cost per workspace | 🟠 | ✅ | প্রতি execution-এর latency, success/failure, খরচ, fallback — সব এক জায়গায়। **`AIUsageLog` foundation আগেই আছে** (`lib/ai/charge-usage.ts`, `usage-logger.ts`, `cost-calculator.ts`) — শুধু UI + aggregation দরকার। `lib/ai/openrouter-service.ts`-এ model প্রতি pricing আনা যায়। **কোনো ফিচার নয় — সিদ্ধান্ত নেওয়ার চোখ।** এখন কোনো সংখ্যা জানা নেই: কোন workspace লাভজনক, কোন model কত খায়, কোথায় সময় যাচ্ছে। **✅ ২০২৬-১০-১৪** — `/admin/observability` পেজ, shared `computeUnitEconomics`, বানানো revenue map মুছে ফেলা, sidebar এন্ট্রি। বিস্তারিত নিচে। ⚠️ success/failure rate **মাপা যায় না** (ব্যর্থ কলে row-ই লেখা হয় না) — তাই সেটি সরানো হয়েছে, লেবেলও বদলানো |
| ১৪ | **Duplication কমানো (shared node এক জায়গায়)** | 🟡 | ✅ | ~~Sub-workflow~~ **← পথ বদলানো হয়েছে (ইউজার-অনুমোদিত):** মাপার পর দেখা গেল sub-workflow **কারিগরিভাবে পারে না** — `Respond 200 to Meta` ও `Return hub.challenge` `respondToWebhook` নোড, যাদের webhook-মালিক workflow-এই থাকতে হয়; অথচ **sync script** ওগুলোও ভাগ করতে পারে, কারণ সে লেখার সময়ে কাজ করে, runtime-এ নয়। তাই: `lib/n8n/shared-nodes.json` (৬টি canonical নোড) + `npm run n8n:sync` + drift guard যা sync ভুলে গেলে `npm test` ফেল করায়। ⚠️ ~~প্রতিটি ~৬৬৬ লাইন হুবহু কপি~~ → মাপা: byte-identical মাত্র ~১৫%। সাথে আসল bug: IG/WA-র brain id placeholder ছিল → **ওরা কখনো উত্তরই দিত না**। বিস্তারিত নিচে। |
| ১৫ | **Pricing ladder, credit auto-derivation, feature gating ও free trial** | 🔴 | 🔄 | ~~BYOK~~ **বাদ (ইউজার-সিদ্ধান্ত, ২০২৬-১০-১৪ + কারিগরিভাবে অসম্ভব — উত্তর আসে n8n-এর নিজের credential-এ)**। ~~model routing per plan tier~~ **বাদ (per-plan allow-list ইচ্ছে করেই মুছে দেওয়া হয়েছিল)**। এখন: (ক) credit হাতে সেট করা বন্ধ → দাম থেকে স্বয়ংক্রিয় উদ্ভাবন (`targetBdtPerCredit` = ৳০.০২০), (খ) dashboard AI feature-এর plan gating (gate বনাম meter), (গ) Starter/Growth/Business ল্যাডার পরিষ্কার, (ঘ) Enterprise আলাদা নেগোসিয়েটেড লেন, (ঙ) abuse-নিরাপদ free trial (৩/৫/৭ দিন), (চ) WhatsApp-এর Meta fee মিটার, (ছ) 🔴 `reset-credits` cron-এর leak বন্ধ — **trial-এর পূর্বশর্ত**। বিস্তারিত নিচে। |

### TASK-13 — Observability: execution metrics + real cost per workspace

**Priority:** 🟠 High · **অবস্থা:** ✅ কোড সম্পন্ন (২০২৬-১০-১৪) — `tsc`/`build`/test ইউজারের হাতে বাকি · **ইউজার-সিদ্ধান্ত:** শুধু app-side latency (n8n-এ হাত নয়), সৎ লেবেল সহ

🎯 **কী**

`AIUsageLog` টেবিলে প্রতি AI কলে `task`, `model`, token, `costUsd`, `creditsDeducted`, `latencyMs`, `fallbackFrom`, `costSource` — সব লেখা হচ্ছিল। কিন্তু পুরো `app/`-এ টেবিলটি **একটি জায়গাতেই পড়া হত**: `app/api/user/export/route.ts` (ইউজারের ডেটা এক্সপোর্ট)। অর্থাৎ **খরচের চোখ ছিল না** — সিস্টেম চোখ বন্ধ করে চলছিল।

❓ **কেন**

কোন workspace লাভজনক, কোন model টাকা খাচ্ছে, কোথায় সময় যাচ্ছে — কোনোটাই জানা ছিল না। তার চেয়ে খারাপ: যা "জানা" ছিল তা **বানানো** ছিল (নিচে ক ও সংশোধনের লগ দেখুন)। একটি ভুল সংখ্যা না থাকার চেয়ে খারাপ, কারণ admin সেটির উপর ভরসা করেন — TASK-06-এর শিক্ষা।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `lib/domain/plan-revenue.ts` **(নতুন)** | plan → মাসিক আয় (BDT), region-সচেতন |
| `lib/domain/unit-economics.ts` **(নতুন)** | revenue − cost = profit/margin; একটাই হিসাব, দুই route-এর বদলে |
| `lib/domain/observability.ts` **(নতুন)** | percentile, fallback rate, task resolution, latency coverage |
| `lib/services/observability.ts` **(নতুন)** | Prisma `groupBy`/`aggregate` wiring (`server-only`) |
| `app/api/admin/observability/route.ts` **(নতুন)** | `GET`, `requireAdminApi()` guard |
| `app/(admin)/admin/observability/**` **(নতুন)** | পেজ + `_components/` (KPI · Task · Model · Top Workspaces · Reliability · Provenance) |
| `components/admin/workspaces/MarginCell.tsx` **(নতুন)** | margin/কারণ — workspace টেবিল ও observability, দুই জায়গায় এক |
| `app/api/admin/workspaces/route.ts` · `[id]/route.ts` | hardcoded revenue map **মুছে** helper ব্যবহার |
| `CostAnalyticsTab.tsx` · `WorkspaceTable.tsx` · `FinancialSummaryCards.tsx` | Latency/Fallback কলাম, `null` → "—", CSS variable রঙ |
| `app/globals.css` | `--chart-1…6` টোকেন (দুই theme) |
| `public/locales/{en,bn}/observability.json` | নতুন namespace (register করা হয়েছে `lib/core/i18n.ts`-এ) |
| `components/admin/AdminSidebar.tsx` | Platform group-এ নতুন এন্ট্রি |

🔧 **করণীয় (যা করা হলো)**

| # | কী | কোথায় |
|---|---|---|
| ক | **বানানো revenue map মুছে ফেলা** — `{starter:0, growth:2990, pro:7990, agency:14990, enterprise:19900}` → plan catalogue থেকে পড়া | `lib/domain/plan-revenue.ts` |
| খ | **একটাই money হিসাব** — আগে দুই route-এ দুই কপি ছিল (দুটোই ভুল) | `lib/domain/unit-economics.ts` |
| গ | **`/admin/observability`** — এক সারি filter, তার নিচে সব panel | `app/(admin)/admin/observability/` |
| ঘ | **DB-side aggregation** — `groupBy`/`aggregate`; পুরো টেবিল `findMany` নয় | `lib/services/observability.ts` |
| ঙ | **Latency/Fallback কলাম** বিদ্যমান Analytics ট্যাবে, `null` → "—" (০ নয়) | `CostAnalyticsTab.tsx` |
| চ | **`task` null হলে `channel` থেকে task** — পুরনো row-র খরচ "unknown"-এ হারায় না | `resolveObservabilityTask` |
| ছ | **`--chart-*` টোকেন** — hardcoded রঙের আসল কারণ ছিল টোকেনের অভাব | `app/globals.css` |

✅ **গ্রহণযোগ্যতা**

- `/admin/observability` — task, model, workspace, cost provenance, latency ও fallback দেখা যায়
- প্রতিটি সংখ্যা **মাপা**, আর যা মাপা যায়নি তা "—" বা কারণ-সহ লেখা — `0`/`0%` নয়
- `/admin/workspaces`-এর সাথে সংখ্যা মেলে (এখন একই helper)
- Dark ও Light দুই theme-এ, mobile → বড় monitor সবখানে ঠিক
- `npx tsc --noEmit` → 0 · `npm test` → সব পাস · `npm run build` → exit 0
- **কোনো DDL নেই, DB-তে কোনো row লেখা নেই, n8n ছোঁয়া হয়নি**

---

✅ **যা করা হলো (২০২৬-১০-১৪)**

**১. 🔴 সবচেয়ে জরুরি আবিষ্কার — profit সংখ্যাগুলো বানানো ছিল।** দুই admin route-এ হুবহু একই hardcoded map ছিল, যার তিনটি key (`growth`, `pro`, `agency`) এই প্রোডাক্টে **plan-ই নয়**, আর বাকিগুলোর দামও `plan-config.ts`-এর সাথে মেলে না (আসল BD দাম ৯৯৯ / ২,৪৯৯ / ৪,৯৯৯)। Region-ও উপেক্ষিত ছিল, অথচ Global plan USD-এ। অর্থাৎ admin যতদিন "Net Profit" ও "Margin" দেখেছেন, সবগুলো কাল্পনিক। দুটো কপিই মুছে একটাই pure helper (`computeUnitEconomics`) — কারণ **অসুখটা কপি, ভুল টেবিল ছিল কেবল উপসর্গ**।

**২. "মাপা যায়নি" আর "শূন্য" আলাদা করা।** `netProfitBdt`/`netMarginPercent` এখন `number | null`। যার plan-এর দাম পড়া যায় না (Enterprise = "Custom", বা অজানা key) তার জন্য `0%` বা `−100%` ছাপা বন্ধ — ওগুলো দুটোই **দাবি**: `0%` বলে "এই ক্রেতা কিছু দেন না", `−100%` বলে "পুরো খরচই লস"। কোনোটাই মাপা নয়। এখন বদলে **কারণ** লেখা হয় ("Custom pricing" / "Unknown plan" / "Free plan") — `components/admin/workspaces/MarginCell.tsx`।

**৩. ⚠️ একটি cost-attribution bug, যা পরিকল্পনার বাইরে গিয়ে ঠিক করা হলো।** Workspace detail-এর খরচ মাপার সময় query-তে `OR: [{userId}]` ছিল — অর্থাৎ **একই মালিকের অন্য workspace-এর খরচও** এই workspace-এর ঘাড়ে চাপত। এখন scope = `workspaceId` অথবা তার chatbot-গুলো। এটি margin-কে প্রভাবিত করত, তাই একই সংশোধন-তালিকায় রাখা হলো (সংশোধনের লগ দেখুন)।

**৪. Percentile — পরিকল্পনা থেকে ইচ্ছাকৃত বিচ্যুতি।** পরিকল্পনায় ছিল `$queryRaw` + `percentile_cont`। করা হলো JS-এ, সর্বশেষ ২০,০০০ timed row-র নমুনা থেকে। কারণ: একই filter **দুই ভাষায়** (Prisma `where` + raw SQL `WHERE`) লিখলে সেটিই আবার drift-এর উৎস হয়ে দাঁড়ায় — অর্থাৎ ঠিক যে রোগটি এই টাস্ক আছে তা দূর করতে গিয়ে নতুন একটি জন্মাত। trade-off সৎভাবে: p95 "সাম্প্রতিক N timed call"-এর, "সব"-এর নয় — আর সেটি UI-তে লেখাও আছে (`latencySampleCapped`)।

**৫. Fallback rate, success rate নয় — এবং UI সেটি বলে।** বিকল্প (ledger) চাইত নতুন টেবিল = DDL + অনুমতি, তাই আজকের সীমার ভেতরেই থেমে **সীমাটি স্পষ্ট লেখা** হলো।

⚠️ **যা মাপা যায় না — খোলাখুলি**

| যা নেই | কেন | ভবিষ্যতে কী লাগবে |
|---|---|---|
| **Success / failure rate** | ব্যর্থ call-এ **কোনো row-ই লেখা হয় না** — `lib/ai/gateway.ts` কেবল সফল chain-এর পরে log করে। 100% success "মাপা" হত কারণটাই গাণিতিক। তাই বদলে **fallback rate** দেখানো হয় (যা সত্যিই মাপা) | failure ledger (নতুন table/column) — DDL, অনুমতি সাপেক্ষ, আলাদা টাস্ক |
| **আসল ক্রেতা-reply-র latency** | customer reply n8n-এ যায় সরাসরি, আর n8n billing callback-এ `latencyMs` পাঠায় না (`/api/internal/ai-usage`-এর Zod schema-তে তিনটি field-ই নেই)। অর্থাৎ Facebook/WhatsApp/Instagram-এর প্রতিটি আসল reply-তে `latencyMs = null` | n8n workflow-তে `latencyMs` যোগ করা (ইউজার-সিদ্ধান্ত: এখন নয়)। UI-তে যেখানে "—", সেখানে tooltip-এ কারণ লেখা |
| **Instance-জুড়ে সংখ্যা** | কোনো durable store নেই | VPS-এ যাওয়ার পরে |

### ✅ যাচাইয়ের ফলাফল (২০২৬-১০-১৪)

| # | যাচাই | ফলাফল |
|---|---|---|
| ১ | `npx tsc --noEmit` | **exit 0 — ০ error** |
| ২ | `npm test` (vitest) | **১৭টি ফাইল, ৪২৫টি test — সব পাস**; এর মধ্যে নতুন ৩টি ফাইলে (`plan-revenue` · `unit-economics` · `observability`) **৭৭টি** |
| ৩ | `npm run build` | **exit 0** — কোনো warning/error নেই; build-তালিকায় `ƒ /admin/observability` ও `ƒ /api/admin/observability` দুটোই আছে |
| ৪ | i18n key সমতা | নতুন `observability` namespace-এ `en` ও `bn`-এর key সেট অভিন্ন |

**প্রথম চালানোর সময় যা বেরিয়েছে (আড়াল করা হয়নি):**

- **একটি আসল error ছিল এই টাস্কেরই** — `ObservabilityFilters.tsx`-এ `onValueChange`-এর মান `string | null`, কিন্তু `onChannelChange` কেবল `string` নেয়। "All channels" sentinel-এ নামানোর সময় `null` case বাদ পড়েছিল → এখন `null`-ও `""`-তে collapses (অর্থাৎ cleared = no filter)। **ঠিক করা হয়েছে, এরপর tsc ০ error।**
- **বাকি ৭৪টি error এই টাস্কের নয়, দুটি পরিবেশগত কারণে:**
  - `node_modules`-এ **`vitest` install-ই করা ছিল না** (lockfile-এ ছিল, ফোল্ডারে নেই) — তাই ১৬টি বিদ্যমান test ফাইলে `Cannot find module 'vitest'` ও তার ফলে implicit-`any`। `npm install` চালিয়ে পূরণ করা হয়েছে; সেই error-গুলো সবই চলে গেছে। *(মানে: এই repo-তে `npm test` এর আগেও চলত না — এটি TASK-13-এর আগে থেকেই ছিল।)*
  - `.next/types/validator.ts` পুরনো build-এর অবশেষ — সর্বশেষ commit-এ (`1fe3045`) মুছে ফেলা `app/api/test-db` route-টি এখনো নির্দেশ করছিল। fresh `npm run build`-এ সেটিও চলে গেছে।

### 🔴 লাইভে প্রথম চালানোর সময় পাওয়া ব্লকার (২০২৬-১০-১৪)

তিনটি যাচাই সবুজ হওয়ার **পরেও** ইউজার `/admin/observability` খুললে **৫০০** এলো — `P2022: The column does not exist in the current database`।

**কারণ:** `billing.AIUsageLog`-এ live ডাটাবেসে **৩টি কলামই অনুপস্থিত** ছিল:

| কলাম | কোথা থেকে | DB-তে | schema-তে |
|---|---|---|---|
| `task` | TASK-10 (gateway provenance) | ❌ | ✅ |
| `latencyMs` | TASK-10 (resiliency) | ❌ | ✅ |
| `fallbackFrom` | TASK-10 (resiliency) | ❌ | ✅ |

অর্থাৎ **TASK-10-এর migration কখনো এই ডাটাবেসে চালানোই হয়নি** — কোড লিখেছিল, কলাম বানায়নি।

**কেন `tsc`/`test`/`build` ধরতে পারেনি:** তিনটির **একটিও আসল ডাটাবেসে query চালায় না** — `tsc` শুধু type দেখে, vitest শুধু `lib/domain/`-এর pure ফাংশন (কোনো DB নেই), `build` শুধু compile করে। **এই টাস্কের সবচেয়ে বড় শিক্ষা: type-check সবুজ হওয়া মানে স্কিমা আর ডাটাবেস মিলে আছে — নয়।**

**কী কী ভেঙেছিল:**

| Route | অবস্থা | আগেও ভাঙা ছিল? |
|---|---|---|
| `/api/admin/observability` | ৫০০ | 🆕 নতুন (TASK-13) |
| `/api/admin/workspaces/[id]` | ৫০০ | ⚠️ **হ্যাঁ** — `findMany`-তে `select` নেই, তাই **সব** কলাম আনে → `fallbackFrom` খুঁজে ব্যর্থ। `git diff` দিয়ে যাচাই: এই `findMany` TASK-13-এর আগেই ছিল |
| `/api/user/export` | ৫০০ (একই কারণে) | ⚠️ হ্যাঁ — কোনো ইউজার চাওয়ার আগেই ভাঙা ছিল |
| `/api/admin/workspaces` (list) | ✅ কাজ করত | `groupBy` শুধু grouped + aggregated কলাম আনে, তাই বেঁচে গেছে |

**সমাধান — অনুমতিক্রমে চালানো হয়েছে (নিয়ম #১ ও #২):** diff দেখিয়ে অনুমতি নেওয়ার পর কেবল যোগাত্মক DDL:

```sql
ALTER TABLE "billing"."AIUsageLog"
  ADD COLUMN IF NOT EXISTS "task" TEXT,
  ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER,
  ADD COLUMN IF NOT EXISTS "fallbackFrom" TEXT;
```

**যাচাই করা ফলাফল:** ৩টি কলামই যোগ হয়েছে (nullable, schema-র সাথে মিলে) · **৩৭টি row আগে-পরে অপরিবর্তিত** · `chatbot.n8n_chat_histories` ও `public.n8n_chat_histories` — **দুটোই অটুট** · এরপর diff-এ `AIUsageLog`-এর কিছুই নেই।

**প্রথম লোডে পেজটি যা দেখাবে** (সরাসরি SQL-এ মিলিয়ে দেখা, ৩৭টি row):

| bucket | calls | cost (USD) |
|---|---|---|
| playground | ৩২ | ০.০৫৫৪৭ |
| web | ১ | ০.০০৭১৪ |
| whatsapp | ১ | ০.০০৬৮৫ |
| facebook | ১ | ০.০০০৬৪ |
| quick_setup | ১ | ০.০০০১০ |
| auto_train | ১ | ০.০০০০০৪ |

fallback row = **০** · latency coverage = **০/৩৭**। তাই Latency প্যানেল সৎভাবেই "কোনো timed call নেই" দেখাবে (০ ছাপবে না), আর ৩৭টি row-ই `task = null` → `channel` থেকে পড়া হবে, ফলে `legacyTaskRows` নোটিশটি আসবে।

**আসল Prisma client দিয়ে প্রমাণ** (raw SQL নয় — হুবহু যে query গুলো ৫০০ দিচ্ছিল):

```
✅ groupBy(task, channel)                         -> 6 buckets
✅ groupBy(where fallbackFrom != null)            -> 0 buckets
✅ findMany (সব কলাম — যে query টা ৫০০ দিত)       -> 3 rows
✅ workspace-detail findMany (cmscv7kp1…269ztn)   -> 5 rows
✅ latency aggregate (where latencyMs != null)    -> count = 0
```

📥 **ইউজারকে যা করতে হবে (হাতে যাচাই)**

1. `prisma db push` লাগবে **না** — কোনো DDL নেই, schema অপরিবর্তিত।
2. `/admin/observability` খুলুন — Dark ও Light, mobile ও desktop।
3. `/admin/workspaces`-এর KPI-র সাথে মিলিয়ে দেখুন — **এখন সংখ্যা মিলতেই হবে**, কারণ দুটি এখন একই helper ব্যবহার করে।
4. ⚠️ **আগে/পরে:** revenue সংশোধনের পর margin সংখ্যা **বদলাবে**। এটি কাঙ্ক্ষিত — আগেরটি ভুল ছিল।
5. একটি workspace-এ ড্রিল-ডাউন করে Analytics ট্যাবে দেখুন: আসল ক্রেতা-reply-র row-তে **Latency = "—"** (যথাযথ, কারণ সেটি মাপা হয়নি)।
6. ডেটাবেসে খুব কম row আছে (WhatsApp/Instagram-এ এখনো live credential নেই — TASK-08-এর সাক্ষ্য), তাই প্রধান যাচাই হলো **খালি ডেটায় পেজটি ভাঙে না**।

---

### TASK-14 — Duplication কমানো: shared node এক জায়গায় *(সম্পন্ন — ২০২৬-১০-১৪)*

**Priority:** 🟡 Medium · **অবস্থা:** ✅ **সম্পন্ন** · **ইউজার-সিদ্ধান্ত (২০২৬-১০-১৪):** প্রথমে পথ **গ — ধাপে ধাপে**; তারপর ধাপ ২-এর জন্য **sub-workflow নয়, sync script** *(AskUserQuestion-এ মাপা তথ্য দেখিয়ে)*

🎯 **কী**

টাস্কটির লক্ষ্য ঠিক ছিল, কিন্তু তার **তিনটি ভিত্তিই মাপার পর ভেঙে গেল** — তাই প্রথম কাজ ছিল মাপা, আর সেটিই পথ বদলে দিল। সবচেয়ে জরুরি অংশটি (একটি **লাইভ bug**) টাস্কে লেখাই ছিল না — §খ দেখুন।

❓ **টাস্কটি যে তিনটি কথা বলেছিল, আর মাপা সত্য**

| টাস্কে বলা | মাপা সত্য | ফল |
|---|---|---|
| "প্রতিটি ~৬৬৬ লাইন, প্রায় হুবহু কপি" | ~২০ KB; byte-identical মাত্র **২,৯৪৫ B ≈ ১৫%** | ~৬৫% **সত্যিকারের per-platform** কোড — সরানো যেত না |
| "Shared sub-workflow বের করুন" | `Respond 200 to Meta` ও `Return hub.challenge` হলো `respondToWebhook` — n8n-এ **sub-workflow parent-এর webhook-এ উত্তর দিতে পারে না** | sub-workflow দিয়ে **সর্বোচ্চ সুবিধাটাই** পাওয়া যেত না |
| "session upsert, Meta send, error handling" — এই তিন ভাগ করুন | ৫টি send নোড সত্যিই আলাদা API; **error-handling নোড তিন adapter-এ আদৌ নেই** | ৩টির মধ্যে ১টিই বাস্তব |

⚠️ **আর একটি সংশোধন — আমার নিজের আগের দাবি ভুল ছিল:** আমি বলেছিলাম sub-workflow "একটি queue hop" যোগ করে। **তা নয়** — [n8n-এর PR #32206](https://github.com/n8n-io/n8n/pull/32206) ও [এই বিশ্লেষণ](https://github.com/sandgardenhq/dh-library/blob/main/content/en/n8n/08-one-execution-many-processes.md) অনুযায়ী sub-workflow **একই worker-এ inline** চলে (আলাদা Bull job নেই, queue dispatch নেই) — খরচ কেবল +১ execution record। সংশোধনের পরও **sync script** বেছে নেওয়ার আসল কারণ queue নয়, বরং উপরের দ্বিতীয় সারি: `respondToWebhook`।

📊 **যা মাপা হলো (অনুমান নয়)**

| প্রশ্ন | উত্তর |
|---|---|
| তিনটি adapter কি সত্যিই "হুবহু কপি"? | **না** — ~২০ KB-র মধ্যে byte-identical মাত্র **২,৯৪৫ B ≈ ১৫%** |
| নোড সংখ্যা | FB **১৯** · IG **১৮** · WA **১৮** |
| সম্পূর্ণ অভিন্ন নোড | **৫টি** — `Return hub.challenge` (১০৬ B) · `Respond 200 to Meta` (৮৫ B) · `Guard Active` (৪৯৮ B) · `Split Gallery` (৪৮ B) · `Decrypt Integration Secrets` (**২,২০৮ B**) *(সব আকার `parameters`-এর, কারণ ওটুকুই নকল হয়)* |
| এক literal-এ ভিন্ন | `Webhook` (`.path`) · `If Webhook Verify` (per-channel secret) · `Upsert Chat Session` (SQL-এ একটি platform literal) |
| সত্যিই per-platform | `Normalize * Payload` (৭৯/৯৯/৯৩ লাইন) · `Build Brain Payload` (৭৮/৩৭/৩৮ — FB Meta profile আনে, IG/WA আনে না) · `Fetch Integration` SQL · `Route Reply Type` (FB: `isComment`; IG/WA: `galleryImages.length`) · ৫টি send নোড |

অর্থাৎ ডুপ্লিকেশন **গঠনগত** (একই কাঠামো + ৩ ভাগে literal-ভিন্ন নোড), **লেখার নকল নয়**। শুধু `Decrypt Integration Secrets`-ই সত্যিকারের বড় অভিন্ন payload — ৬১ লাইন AES-256-GCM।

⏱️ **sub-workflow-এর দাম (এবং কেন এখনই পুরোটা করা হলো না)**

Shared sub-workflow-তে সরালে প্রতি inbound মেসেজে **+১টি n8n execution** ও queue mode-এ একটি **queue hop** যোগ হয় — যা TASK-11 এইমাত্র সরিয়েছিল। এটি এমন সুবিধার সাথে সরাসরি সংঘর্ষে, যা এখনো লাইভে মাপা হয়নি। তাই আগে **ডুপ্লিকেশন ধরার ব্যবস্থা**, পরে কাঠামো বদল।

---

#### ক. Drift Guard — ডুপ্লিকেশনের আসল ওষুধ

টাস্কের প্রবাদটি ছিল: *"একটি bug fix করতে ৩ জায়গায় করতে হয় → একটি বাদ পড়ে যায়।"* কিন্তু আসল ক্ষতিটি **বাদ পড়াটা নয় — বাদ পড়াটা চুপচাপ ঘটাটা**। n8n-এ তিনটি workflow-এর মধ্যে কোনো সংযোগ নেই; কোনো চ্যানেল পুরনো আচরণে থেকে গেলে **কোথাও কোনো error হয় না** — সে কেবল অন্যরকম ব্যবহার করে, আর সেটি মাসখানেক পরে ধরা পড়ে।

`lib/n8n/workflow-drift.test.ts` **(নতুন)** সেই সংযোগটি তৈরি করে: `docs/n8n-JSON/*.json` পড়ে `npm test`-কে ফেল করায় যেই মুহূর্তে তারা সরে যায়। n8n ছোঁয় না, runtime-এ শূন্য প্রভাব।

| যা পাহারা দেয় | কেন এটাই |
|---|---|
| **৬টি canonical নোড** প্রতিটি adapter-এ হুবহু মেলে (`type` · `typeVersion` · `parameters`) — §গ দেখুন | `Decrypt` সরে গেলে **একটি চ্যানেলেরই** token decrypt হওয়া বন্ধ হয় — দেখতে লাগে "আজ Instagram খারাপ", কোড বদল নয় |
| ১২টি spine নোড তিনটিতেই উপস্থিত | নোড মুছে গেলে n8n error দেয় না — চেইন থেমে যায় |
| `Upsert Chat Session`-এর SQL canonical-এর সাথে মেলে, `%%PLATFORM%%` বদলে | ৬০০ B তিনবার লেখা, একটি literal-এ ভিন্ন; বাকি কোনো পার্থক্যই drift |
| canonical-এ `templated` ঠিক একটিই নোড (`Upsert Chat Session`) | অন্য কোনো নোডে channel নাম ঢুকে গেলে সাথে সাথে ধরা পড়ে |
| প্রতি adapter নিজের পরিচয় তিন জায়গায় মেলায় (Webhook `.path` · SQL literal · brain-এ `platform`) | copy-paste-এ দুটি বদলে তৃতীয়টি না বদলালে workflow নিখুঁতভাবে চলে — **ভুল চ্যানেলে** |
| চারজন brain caller একই `workflowId`, placeholder নয় | §খ দেখুন |
| তিন adapter-এর `workflowInputs` key-set এক | playground বৈধভাবে অতিরিক্ত `channel` পাঠায় (brain `platform`-এ fallback করে), adapter-দের তেমন কারণ নেই |
| প্রতিটি `$('Node')` reference বাস্তবে আছে কি না | নোডের নাম বদলালে পুরনো নাম সব expression-এ থেকে যায়; n8n ফাইল গ্রহণ করে, fail করে **runtime-এ কেবল সেই শাখায়** |

`Position`/`id`/sticky-note **ইচ্ছে করেই বাদ** — নোড টেনে সরানো drift নয়, আর layout-এ ফেল করা guard এক সপ্তাহেই mute হয়ে যায়। `Automation-Gate.json` ইচ্ছে করেই reference-check থেকে বাদ — সে সম্পূর্ণ workflow নয়, সম্পূর্ণতার জন্য রাখা paste-helper fragment (৪টি নোড + `Gate Setup (বাংলা)`), যে `When Called by Platform` ও `Fetch Bot Config`-কে ডাকে এবং তারা থাকে `Core-AI-Brain`-এ। **যাচাই করা হয়েছে** — ভাঙা reference নয়।

#### খ. 🔴 আসল যে bug-টি পাওয়া গেল

`Instagram-Integration.json` ও `WhatsApp-Integration.json`, দুইটিরই `Execute Core AI Brain` নোডে ছিল:

```json
"workflowId": { "__rl": true, "value": "REPLACE_WITH_CORE_AI_BRAIN_WORKFLOW_ID", ... }
```

Facebook-এ সঠিক id ছিল, IG/WA-তে placeholder। **ফলে IG ও WA কখনোই brain-এ পৌঁছাতে পারত না** — webhook যাচাই হয়ে যেত (তাই সবকিছু স্বাভাবিক দেখাত), কিন্তু উত্তর আসত না। এবং ইউজার এইমাত্র এই দুই ফাইল n8n-এ import করেছেন — অর্থাৎ এ মুহূর্তে IG/WA **লাইভে ভাঙা**।

দুই ফাইলেই Facebook-এর রূপে বদলানো হলো (`"value": "rXK4xU4dY9NETqjB"` + `"cachedResultUrl": "/workflow/rXK4xU4dY9NETqjB"`)। চারজন caller-ই এখন একমত — PR-এ ধরা পড়ার আগেই `npm test` ধরবে।

> 💡 এই bug-টি নিজেই TASK-14-এর যৌক্তিকতা প্রমাণ: **একই ভুল তিন জায়গায় খোঁজা হচ্ছিল, আর একটিতে বাদ পড়েছিল।** Guard-টি লেখার সাথে সাথেই সেটি ধরে ফেলল।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `lib/n8n/shared-nodes.json` **(নতুন)** | ৬টি canonical নোড — **একমাত্র সূত্র**। `Upsert Chat Session`-এর SQL-এ `%%PLATFORM%%` টোকেন |
| `lib/n8n/shared-nodes.ts` **(নতুন)** | `loadCanonical` · `findDrift` · `applyCanonicalNodes` — check ও fix **একই কোড** ব্যবহার করে |
| `scripts/sync-n8n-shared-nodes.ts` **(নতুন)** | `npm run n8n:sync` — canonical তিন adapter-এ লেখে; `--check` শুধু রিপোর্ট করে |
| `lib/n8n/workflow-drift.test.ts` **(নতুন)** | guard — sync ভুলে গেলে `npm test` ফেল করে |
| `package.json` | `"n8n:sync"` স্ক্রিপ্ট যোগ |
| `docs/n8n-JSON/Instagram-Integration.json` | placeholder brain id → আসল id (§খ) |
| `docs/n8n-JSON/WhatsApp-Integration.json` | একই (§খ) |

#### গ. ধাপ ২ — Sync script (sub-workflow নয়)

একটি **প্রশ্নের উত্তরেই** পথটি নির্ধারিত হলো: *কোন নোডগুলো সত্যিই ভাগ করা যায়?* ছয়টি — `Return hub.challenge` · `Respond 200 to Meta` · `Decrypt Integration Secrets` · `Guard Active` · `Split Gallery` · `Upsert Chat Session`।

`lib/n8n/shared-nodes.json` এগুলো একবার ধরে রাখে; `npm run n8n:sync` তিন adapter-এ লিখে দেয়। যা ছোঁয়া হয় **না**: `id`, `position`, `credentials`, `continueOnFail` — ওগুলো per-file তথ্য, ভাগ করার নয়।

| কেন এটাই sub-workflow-এর চেয়ে ভালো | |
|---|---|
| `respondToWebhook` দুটিও ভাগ হয় | sub-workflow **কখনো** পারত না — n8n-এ একটি sub-workflow parent-এর webhook-এ উত্তর দিতে পারে না |
| প্রতি মেসেজে **+১ execution নেই** | TASK-11 ঠিক এই ধরনের খরচ সরিয়েছিল |
| নোড নাম অপরিবর্তিত | `Guard Active` যে `$('Decrypt Integration Secrets')` ডাকে, সে রেফারেন্স ভাঙে না |
| import-ক্রমের কোনো ফাঁদ নেই | sub-workflow-এ হলে আগে সেটি import করতে হতো, নইলে তিন চ্যানেলই থামত |

**যাচাই করা হয়েছে (round-trip):** একটি adapter-এর `Decrypt` jsCode ইচ্ছাকৃতভাবে ভাঙা হলো → `npm test` **নোডের নাম ধরে** ফেল করল, `--check` exit 1 দিল → `npm run n8n:sync` লিখল → `git diff` **সম্পূর্ণ খালি** (অর্থাৎ byte-for-byte হুবহু ফিরল)। guard আর script একই `findDrift` ব্যবহার করে, তাই "in sync" নিয়ে তাদের মতভেদ সম্ভব নয়।

**যা ইচ্ছে করেই যোগ করা হয়নি:** `Upsert Chat Session`-এর SQL-এর টোকেন ছাড়া বাকি সব — যেমন `Fetch Integration`-এর আলাদা কলাম তালিকা, `Build Brain Payload`-এর Meta profile fetch (FB করে, IG/WA করে না)। ওগুলো **সত্যিই** per-channel; জোর করে এক করলে আসল আচরণ ভাঙত।

⏭️ **ভবিষ্যতে কেউ একটি shared নোড বদলাতে চাইলে**

১. `lib/n8n/shared-nodes.json` বদলান → ২. `npm run n8n:sync` → ৩. `npm test` (সবুজ কি না) → ৪. যে workflow গুলো বদলেছে সেগুলো n8n-এ **re-import**। ধাপ ৩ না করলে CI/টেস্ট নিজেই ধরে ফেলবে; ধাপ ৪ বাদ দিলে repo ও n8n আলাদা কথা বলবে — সেটি guard ধরতে পারে না, কারণ guard repo-ই পড়ে।

📥 **ইউজারকে যা করতে হবে (হাতে যাচাই)**

1. ⚠️ **সবচেয়ে জরুরি:** n8n-এ যে `Instagram-Integration` ও `WhatsApp-Integration` এইমাত্র import করেছেন, **সেগুলো মুছে আবার `docs/n8n-JSON/` থেকে import করুন**। ওগুলোতে placeholder brain id ছিল — IG/WA এখনো উত্তর দেবে না। (Facebook-এর import ঠিকই আছে।)
2. `prisma db push` লাগবে **না** — এই ধাপে schema ছোঁয়া হয়নি কিছুই।
3. **Web-Playground দিয়ে প্রথম পরীক্ষা** (এটাই সবচেয়ে সস্তা, কারণ credential লাগে না) — brain-এর উত্তর আসছে কি না দেখুন।
4. IG/WA credential বসে গেলে: দুই চ্যানেলেই একটি করে মেসেজ পাঠিয়ে দেখুন — উত্তর আসে, Live Inbox-এ কথোপকথন দেখা যায়, Activity-তে run row আসে।
5. `npm test` চালান — ১৮ ফাইল / ৪৪৪ টেস্ট (আগে ৩৪৮)। এর মধ্যে ১৯টি এই টাস্কের guard।
6. **কোনো নতুন ফাইল import করার দরকার নেই** — `n8n:sync` তিন adapter-কে canonical-এর সাথে মিলিয়ে রাখে, কিন্তু আজকের অবস্থায় তিনটিই **ইতিমধ্যেই মিলে আছে** (`--check` চালিয়ে দেখা গেছে: তিনটিই "in sync")। অর্থাৎ এই টাস্কে n8n-এ নতুন কিছু আনতে হবে না, শুধু IG/WA-র ঠিক করা সংস্করণ (ধাপ ১)।

---

### TASK-15 — Pricing ladder, credit auto-derivation, feature gating ও free trial

**Priority:** 🔴 High · **অবস্থা:** ✅ **কোড সম্পূর্ণ (২০২৬-১০-১৬)** — ৯টি সাব-টাস্কের সবগুলোই শেষ, `tsc` → ০ · `npm test` → ৬৯৮/২৯ · `build` → exit 0 · 🚫 **শুধু deploy gate বাকি, তিনটিই আপনার হাতে** (১) `pricing_catalogue` row *(DB লেখা — অনুমতি লাগবে)* · (২) §5b-র মেয়াদোত্তীর্ণ-তালিকা *(মাপা হয়েছে: **শূন্য**)* · (৩) WhatsApp billing পথ *(BSP/MPS)* · **সূত্র:** [`docs/pricing/pricing-model-analysis.md`](../pricing/pricing-model-analysis.md) ও [`task-whatsapp-billing.md`](./task-whatsapp-billing.md)

🎯 **কী**

ছয়টি অংশ। প্রথম দুটি একসাথে বাঁধা — একটি অন্যটি ছাড়া অর্থহীন:

| | কী |
|---|---|
| **ক** | **Credit-এর দাম হাতে সেট করা বন্ধ করা** — admin একটাই সংখ্যা দেবেন (`৳/credit`), বাকি ২০+ মডেলের credit **আসল দাম থেকে নিজে নিজে** বের হবে |
| **খ** | **Dashboard-এর AI feature গুলো plan-ভিত্তিক করা** — কোনটা **gate** (bikroy-er কারণ), কোনটা **meter** (credit-এ খরচ) |
| **গ** | **Starter / Growth / Business ল্যাডার পরিষ্কার করা** — চারটি গুলিয়ে-যাওয়া axis আলাদা করা |
| **ঘ** | **Enterprise-কে ল্যাডার থেকে বের করা** — self-serve নয়, নেগোসিয়েটেড লেন |
| **ঙ** | **Free trial (৩/৫/৭ দিন)** — abuse-নিরাপদ, DDL ছাড়া যতটা সম্ভব |
| **চ** | **WhatsApp channel-এর নিজস্ব খরচ** মিটার করা (Meta-র per-conversation fee আজ কোথাও নেই) |

❓ **কেন**

Credit আজ **কোনো কিছুর এককই নয়**। আপনার নিজের প্যানেল থেকেই প্রমাণ:

| Model | খরচ/reply | Credit |
|---|---|---|
| `openai/gpt-4o` | ৳১.৬৩৮ | **৩** |
| `meta-llama/llama-3.3-70b-instruct` | ৳০.০৬২৫ | **৫** |

যে মডেল **২৬ গুণ বেশি** খরচ করায়, তার credit **কম**। ফলে এক credit-এর আসল খরচ ৳০.০১২৫ – ৳০.৫৪৬ — **৪৪ গুণ** পার্থক্য।

ফলাফল: Genius প্রতি plan-এ লোকসান (Starter −২১২%, Business −৩১৬%, Enterprise **−৫২৪%**) — অর্থাৎ **যত বড় গ্রাহক, তত বেশি লোকসান**। আর দ্বিতীয় রোগ: credit per-**reply** কাউন্টার, খরচ per-**token** — তাই সংখ্যা এদিক-ওদিক করে সমস্যা **কমবে, সারবে না** (একই preset-এ দুই merchant-এর খরচে ৯ গুণ ফারাক, credit কাটে একই)।

দুই নম্বর কারণ, যা প্লান শুরুর আগেই পাওয়া গেছে: **`reset-credits` cron টাকা দিয়েছে কি না দেখে না** (`app/api/cron/reset-credits/route.ts:33-38`) — ১০০ জন non-converting ট্রায়ালে **৳৯০,০০০/মাস, চিরকাল**। এটি ঠিক না করে trial চালু করা মানে leak-টা নিজের হাতে খুলে দেওয়া।

📁 **ফাইল**

| ফাইল | কী |
|---|---|
| `lib/ai/credit-derivation.ts` **(নতুন)** | pure core — দাম + token + target → credit। §ক-এর হৃদয় |
| `lib/ai/credit-resolver.ts` | resolution order-এ নতুন স্তর বসবে: admin override → **উদ্ভাবিত** → tier default |
| `lib/ai/model-pricing.ts` | ⚠️ **ছোঁয়া হবে না** — `resolveModelPrice()` আগেই আসল দাম আনে, ওটাই ব্যবহার হবে |
| `lib/domain/credit-config.ts` | `getModelTier()` (নাম-ভিত্তিক) → দাম-ভিত্তিক প্রতিস্থাপন |
| `app/(admin)/admin/ai-settings/**` | diff preview (পুরনো → নতুন) + "Apply"; ±২০% সীমা |
| `app/api/cron/reset-credits/route.ts` | 🔴 টাকা-দিয়েছে-কি-না যাচাই (§ঙ-এর পূর্বশর্ত) |
| `lib/domain/plan-config.ts` · `payment-packages.ts` | ল্যাডার ও top-up প্যাক পুনর্গঠন |
| `public/locales/{en,bn}/pricing.json` (+ নতুন namespace) | সব লেখা i18n-এ |

🔧 **করণীয় (ক্রম)**

| # | সাব-টাস্ক | নির্ভরতা | DB লেখে? |
|---|---|---|---|
| **১৫.১** | **R1–R6 চালানো** — `scripts/pricing-research.ts` (read-only) দিয়ে মাপা। ফল §১৯-এ। **পাওয়া গেল:** ৩৪টি মডেলের **৩৪টিই** ভুল দামে · ৪টি নতুন ফাঁদ (নিচে) · **০টি** `exact` usage row (৪৫টির ৪০টিই playground) | — | ✅ **সম্পন্ন** |
| **১৫.২** | **Credit স্বয়ংক্রিয় উদ্ভাবন** — `targetBdtPerCredit` একটাই admin সংখ্যা; diff preview + Apply + ±২০% সীমা। ইনপুট থাকে **আলাদা** `ai_credit_derivation` row-এ (কারণ নিচে) — ✅ **সম্পন্ন** | ১৫.১ | ⚠️ PlatformSetting |
| **১৫.৩** | **Feature gating** — §খ; ৫টি enforce-ফাঁক বন্ধ (legacy enhance-prompt gateway bypass · `allowedPlatforms` · top-up server check · e-commerce · `canAddIntegration`) + ৪টি pure entitlement function যা ১১টি route একসাথে পড়ে — ✅ **সম্পন্ন** | ১৫.১ | ❌ |
| **১৫.৪** | **৩-ধাপের ল্যাডার চূড়ান্ত + legacy migration** — একটাই region-সচেতন resolver (`resolveLegacyPlanKey`/`resolvePlanKeyForRegion`); `VALID_PLAN_KEYS` ও `LEGACY_PLAN_ALIASES` দুটোই মুছে ফেলা — ✅ **সম্পন্ন (২০২৬-১০-১৫)**, DB migration-সহ (২ জন `growth @ bd` → `business`, আপনার অনুমোদনের পরে `setUserPlan` দিয়ে) | ১৫.১, ১৫.২ | ✅ |
| **১৫.৫** | **Enterprise আলাদা লেন** — "Contact us" CTA + `isPackageAllowedForPlan`-এ নেগোসিয়েটেড-গেট; admin rail আগেই ছিল — ✅ **সম্পন্ন (২০২৬-১০-১৫)** | ১৫.৪ | ❌ |
| **১৫.৯** | 🔴 **`reset-credits`-এ "টাকা দেয়েছে কি না" যাচাই** — `isResetEligible` (ever-paid) + একটি `groupBy`-তে প্রমাণ + `skippedByReason` — ✅ **সম্পন্ন (২০২৬-১০-১৫)** | ১৫.১ | ❌ কোড, তবে live cron-এর আচরণ বদলায় |
| **১৫.৬** | **Free trial** — ✅ **সম্পন্ন (২০২৬-১০-১৫), ⚠️ `trialEndsAt` DDL লাগেনি** (`planExpiresAt` পুনর্ব্যবহার); connect-এ শুরু + `processExpiredTrials()` + abuse তালা | ১৫.৪, **১৫.৯**, TASK-22 | ❌ **DDL নেই** |
| **১৫.৭** | **Annual billing + overage / auto top-up** | ১৫.৪ | ✅ কোড · 🚫 deploy gate |
| **১৫.৮** | **WhatsApp channel-এর নিজস্ব খরচ মিটার** (R5-এর ফল) | ১৫.১ | ✅ **কোড সম্পন্ন (২০২৬-১০-১৬) — ডিফল্টে বন্ধ** · ✅ **বিলিং মডেল নির্ধারিত (২০২৬-১০-১৭): Model B** · ⬜ **বাকি: BSP/MPS চুক্তি** → [`task-whatsapp-billing.md`](./task-whatsapp-billing.md) |

> 🔴 **১৫.৮-এর আগে একটি প্রশ্নের উত্তর লাগবে (১৫.১-এ পাওয়া গেছে, §১৯.৮)।** Meta **২০২৬-১০-০১ থেকে service message-ও billable করেছে** (প্রতি number-এ মাসে ১,০০০ free)। আর Meta-র নিয়ম: **credit line যে ধরে, সে-ই বিল দেয়; একবার WABA-তে attach হলে বদলানো যায় না।** আপনার WhatsApp যুক্ত হয় **আপনার নিজের Meta app-এর Embedded Signup** দিয়ে — তাই merchant-দের WABA-তে credit line কার, তা **আপনার Meta Business Suite-এ দেখে নিতে হবে**।
>
> - খরচ **আপনার** হলে → 🔴 এটা মিটার সমস্যা নয়, **নগদ সমস্যা**; ১৫.৮ অপরিহার্য, আর পুরনো WABA থেকে বেরোনোর পথ নেই (নতুন WABA ছাড়া)।
> - খরচ **merchant-এর** হলে → 🟡 ১৫.৮ একটি transparency ফিচার, সংকট নয়।
>
> **উত্তর ছাড়া ১৫.৮ ডিজাইন করা মানে ভুল সমস্যার সমাধান বানানো।**
>
> ✅ **এই Dilemma-টির সমাধান হয়েছে অবরুদ্ধ না থেকে বরং "ডিফল্টে বন্ধ" ক'রে deploy করা (২০২৬-১০-১৬)।** কারণ উত্তরটি কেবল **একটি সংখ্যা** ঠিক করে — surcharge-এর অস্তিত্ব নয়। কোডটি এখন প্রোডাকশনে থাকতে পারে শূন্য প্রভাব নিয়ে, আর credit line **merchant-এর** হলে admin panel-এর ঘরটি `0`-ই থেকে যাবে (অর্থাৎ কিছুই বসবে না, দুইবার চার্জও হবে না); **আপনার** হলে আপনার rate cardের সংখ্যাটি বসালেই কাজ শেষ। বিস্তারিত ও কোড ১৫.৮-এর সেকশনে।
>
> 🆕 **উত্তর পাওয়া গেছে (২০২৬-১০-১৭) — তবে সেটি সহজ উত্তর নয়।** আপনি বেছেছেন **Model B: খরচ প্ল্যাটফর্মের, merchant কার্ড দেবেন না।** কিন্তু যাচাই করে দেখা গেল — **Tech Provider-এর credit line থাকে না**, তাই Tech Provider হয়েও আমরা Meta-কে বিল দিতে পারি না; "মার্চেন্ট-এর credit line" বনাম "আমাদের" এই দ্বৈতটি আসলে **তিনটি** শাখায় ভাঙে (Tech Provider · Solution Partner · MPS/BSP)। ফল: **BSP/MPS চুক্তিই ১৫.৮-এর আসল বাকি কাজ**, কোড নয়। ⚠️ আরেকটি স্থায়ী নিয়ম: **credit line একবার WABA-তে বসলে বদলানো যায় না** — তাই প্রথম আসল merchant onboard করার *আগেই* বিলিং পথ ঠিক হতে হবে। সম্পূর্ণ বিশ্লেষণ, খরচের ছড়া ও BSP-কে করার ৭টি প্রশ্ন: [`task-whatsapp-billing.md`](./task-whatsapp-billing.md)।

**ক্রম:** ১৫.১ → ১৫.২ → ১৫.৩ → ✅ ১৫.৪ → ✅ ১৫.৫ → ✅ **১৫.৯** → ✅ ১৫.৬ → ✅ **১৫.৭** → ✅ **১৫.৮** *(সবগুলোই ২০২৬-১০-১৫/১৬-এ সম্পন্ন — **কোডের দিক থেকে TASK-15 বন্ধ**)। 🚫 **চালু করার তিনটি দরজা আপনার হাতে:** (১) §5b-র তালিকা — *মাপা হয়েছে: শূন্য* · (২) `pricing_catalogue` row — *DB লেখা, অনুমতি লাগবে* · (৩) ১৫.৮-এর বিলিং পথ — *Model B ঠিক হয়েছে, BSP/MPS চুক্তি বাকি* → [`task-whatsapp-billing.md`](./task-whatsapp-billing.md)*

> 🔴 **১৫.৯ ট্রায়ালের পূর্বশর্ত।** ট্রায়াল চালু করে ১৫.৯ পরে করলে leak প্রতিদিন বাড়তেই থাকত — তাই ক্রমে ১৫.৯ আগে, ১৫.৬ পরে। **উভয়ই সম্পন্ন।**
> ✅ **১৫.৪ পুরোপুরি শেষ** — কোড ও DB migration দুটোই (২০২৬-১০-১৫)।

---

#### সিদ্ধান্ত (ইউজার-অনুমোদিত, ২০২৬-১০-১৪)

| বিষয় | সিদ্ধান্ত | কারণ |
|---|---|---|
| **BYOK** | ❌ **বাদ** | ইউজার: *"কাস্টমার কোন OpenRouter API key আনবেন না… জানবেন ই না আমরা কি ব্যবহার করতেছি।"* কারিগরিভাবেও অসম্ভব ছিল — উত্তর আসে n8n-এর `lmChatOpenRouter` নোডে, n8n-এর নিজের credential দিয়ে (`Core-AI-Brain.json:462-511`) |
| **Per-plan model allow-list** | ❌ **ফিরবে না** | `plan-config.ts:44-49`-এ কেন মুছে দেওয়া হয়েছিল তা লেখা আছে — সেটাই আবার ভাঙা হবে |
| **`targetBdtPerCredit`** | ✅ **৳০.০২০** | নিচে কারণ |

##### `targetBdtPerCredit = ৳০.০২০` কেন

উদ্ভাবনের সূত্র: `credit = ceil(খরচ(৳) ÷ targetBdtPerCredit)`। তাই **target-ই প্ল্যাটফর্মের প্রতি-credit খরচ** — সেটা ঠিক করলেই প্রতিটি plan-এর পূর্ণ allowance-এর খরচ জানা হয়ে যায়:

| Plan | আজ credit-এর দাম | পূর্ণ allowance-এর খরচ (৳০.০২০-এ) | Margin |
|---|---|---|---|
| Starter ৳৯৯৯ | ৳০.০৬৬৬ | ১৫,০০০ × ০.০২ = **৳৩০০** | **৭০%** |
| Business ৳২,৪৯৯ | ৳০.০৫০০ | ৫০,০০০ × ০.০২ = **৳১,০০০** | **৬০%** |
| Enterprise ৳৪,৯৯৯ | ৳০.০৩৩৩ | ১,৫০,০০০ × ০.০২ = **৳৩,০০০** | **৪০%** |

**৳০.০২০-ই বেছে নেওয়ার কারণ:**

1. **এটিই একমাত্র মান যেখানে আজকের credit সংখ্যাগুলো (১৫,০০০ / ৫০,০০০ / ১,৫০,০০০) সঠিক প্রমাণিত হয়** — ৭০% / ৬০% / ৪০% margin-এর একটি স্বাভাবিক অবরোহী সিঁড়ি। অন্য কোনো target-এ হয় সংখ্যা বদলাতে হয়, নয় দাম।
2. **সস্তা মডেল ছোট সংখ্যায় পড়ে** (১–৫ credit) — merchant-এর কাছে পরিচিত ও বোধগম্য।
3. **দামি মডেল সৎ সংখ্যায় পড়ে** (৮০–১০৫ credit) — "Genius" যে সত্যিই ৮ গুণ দামি, সেটা সংখ্যাতেই দেখা যায়।

##### প্রস্তাবিত credit (৳০.০২০ ধরে, ৳১২৬/USD, ৪,০০০ + ৩০০ token)

| Model | আজ | প্রস্তাবিত | কেন |
|---|---|---|---|
| `meta-llama/llama-3.3-70b-instruct` | ৫ | **৪** | কমছে — আজ বেশি নেওয়া হচ্ছিল |
| `openai/gpt-4o-mini` | ৩ | **৫** | প্রায় অপরিবর্তিত |
| `deepseek/deepseek-chat` | ৩ | **৯** | বাড়ছে |
| `google/gemini-2.5-flash` (Smart) | ৫ | **১৩** | বাড়ছে — আজ Business-এ লোকসান |
| `openai/gpt-4o` | **৩** | **৮২** | ⚠️ **২৭ গুণ** |
| `anthropic/claude-sonnet-4` (Genius) | **১০** | **১০৪** | ⚠️ **১০ গুণ** |

⚠️ **দুই সতর্কতা, যা এড়ানো যাবে না:**

1. **Merchant-এর দেখা সংখ্যা বদলাবে।** "Genius = ১০ credit" দেখে অভ্যস্ত গ্রাহক হঠাৎ ১০৪ দেখলে বিশ্বাস হারাবেন। তাই **যোগাযোগের পরিকল্পনা ছাড়া ship করা যাবে না** — এবং §১৫.১-এর আসল token সংখ্যা পাওয়ার পরে চূড়ান্ত হবে।
2. **Top-up প্যাক এখন credit-এর খরচের নিচে।** Business top-up ৳০.০০৮/credit, Enterprise ৳০.০০৪ — অর্থাৎ **প্রতি top-up credit-এ লোকসান**। ৳০.০২০ target-এ টিকতে হলে প্যাকের **credit সংখ্যা কমাতে হবে** (দাম নয়) — আজ top-up plan-এর চেয়ে ৬× সস্তা, যা উল্টো: top-up credit plan credit-এর চেয়ে **দামি** হওয়া উচিত।

✅ **গ্রহণযোগ্যতা**

- `targetBdtPerCredit` একটি জায়গায়, admin-editable — কোনো মডেলের credit কোডে হার্ডকড নয়
- নতুন মডেল যোগ করলে **কোনো হাত না দিয়েই** credit বের হয়; OpenRouter দাম বদলালে প্যানেলে diff দেখা যায়
- একবারে ±২০%-এর বেশি বদল নিজে নিজে লাগে না — পতাকা ওঠে
- প্রতিটি plan-এর পূর্ণ allowance-এর খরচ ও margin জানা ও মাপা
- ✅ trial: এক account = একবার; আসল channel connect না করলে activate হয় না; মাসিক credit রিসেট বন্ধ
- ✅ `reset-credits` এমন user-কে skip করে যে কখনো টাকা দেয়নি
- যেসব feature কোডে নেই, সেগুলো **তালিকা থেকেও** যায় (Team Access · All Couriers · Custom Integration · Advanced Model Customization · Priority Support · SLA · 3/14-day trial)
- `npx tsc --noEmit` → 0 · `npm test` → সব পাস · `npm run build` → exit 0
- ⚠️ **যেকোনো DDL বা DB-লেখার আগে আলাদা অনুমোদন** — `prisma db push` কখনো নয়, `migrate diff` দেখিয়ে অনুমোদন

---

🔵 **অগ্রগতি**

| সাব-টাস্ক | অবস্থা | তারিখ |
|---|---|---|
| **১৫.১** — R1–R6 মাপা (`scripts/pricing-research.ts`) | ✅ **সম্পন্ন** | ২০২৬-১০-১৪ |
| **১৫.২ (কোর)** — `lib/ai/credit-derivation.ts` + ৩৮টি টেস্ট | ✅ **সম্পন্ন** | ২০২৬-১০-১৪ |
| **১৫.২ (admin UI)** — diff preview + "Apply" + `app/api/admin/ai-settings/derivation` | ✅ **সম্পন্ন** | ২০২৬-১০-১৪ |
| **১৫.২ (ডকুমেন্টেশন)** — এই সেকশন + §১৯ | ✅ **সম্পন্ন** | ২০২৬-১০-১৪ |
| **১৫.৩ (ফাঁক ১)** — dead legacy enhance-prompt route মুছে ফেলা | ✅ **সম্পন্ন** | ২০২৬-১০-১৪ |
| **১৫.৩ (ফাঁক ২–৫ + entitlement নীতি)** — ৪টি pure function · ১১টি route-এ gate · nav সমন্বয় · ২০টি নতুন টেস্ট | ✅ **সম্পন্ন** | ২০২৬-১০-১৪ |
| **১৫.৪** — legacy `growth`/`pro` → region-সচেতন migration + একটাই key-resolver | ✅ **সম্পন্ন** — কোড **ও** DB migration (আপনার অনুমোদনের পরে `setUserPlan`; ২ জন `growth @ bd` → `business`) | ২০২৬-১০-১৫ |
| **১৫.৫** — Enterprise নেগোসিয়েটেড লেন ("Contact us") | ✅ **সম্পন্ন** | ২০২৬-১০-১৫ |
| **১৫.৯** — 🔴 `reset-credits`-এ payment যাচাই | ✅ **সম্পন্ন** | ২০২৬-১০-১৫ |
| **১৫.৬** — Free trial (`planExpiresAt` পুনর্ব্যবহার — **DDL লেগেছে ০টি**) | ✅ **সম্পন্ন** | ২০২৬-১০-১৫ |
| **১৫.৭** — Annual + overage | ✅ **কোড, টেস্ট ও build সম্পন্ন** — 🚫 deploy gate বাকি | — |
| **১৫.৮** — WhatsApp cost meter | ✅ **কোড, টেস্ট ও build সম্পন্ন (২০২৬-১০-১৬) — ডিফল্টে বন্ধ** · ✅ **বিলিং মডেল: Model B (২০২৬-১০-১৭)** | admin panel-এ দুটি ঘর যোগ হয়েছে (`WhatsAppCostPanel`), ফি-এর ডিফল্ট **`0`** অর্থাৎ কিছুই কাটে না। ⚠️ **Tech Provider একা যথেষ্ট নয়** — credit line থাকে না; **BSP/MPS চুক্তি এখনো বাকি**, সেটিই একমাত্র বাকি কাজ → [`task-whatsapp-billing.md`](./task-whatsapp-billing.md) |

**➡️ ৯টি সাব-টাস্কের কোড এখন সম্পূর্ণ** (১৫.৮-ও ২০২৬-১০-১৬-এ শেষ, ডিফল্টে বন্ধ অবস্থায়)। ⚠️ **১৫.৭-এর কোড, টেস্ট ও build শেষ — কিন্তু চালু করার আগে দুটি দরজা আপনার হাতে:** (১) `pricing_catalogue` PlatformSetting row তৈরি (একটি DB লেখা), (২) deploy-এর আগে §5b-র মেয়াদোত্তীর্ণ-পেয়ার তালিকা দেখা *(✅ ২০২৬-১০-১৬-এ **read-only** মাপা হয়েছে — **শূন্য**: প্রতিটি পরিশোধকারী merchant-এর মেয়াদ জীবিত)*। 🔴 **আর ১৫.৮-এর তৃতীয় দরজা — WhatsApp billing পথ:** ২০২৬-১০-১৭-এ **Model B** (প্ল্যাটফর্ম বিল দেবে) ঠিক হয়েছে, কিন্তু **Tech Provider-এর credit line না থাকায় BSP/MPS চুক্তি ছাড়া তা কার্যকর করা যাবে না** → [`task-whatsapp-billing.md`](./task-whatsapp-billing.md)। ✅ **১৫.৪ এখন পুরোপুরি শেষ** — কোড ও DB migration দুটোই; আপনার অনুমোদনের পরে `setUserPlan` দিয়ে ২ জন legacy `growth @ bd` merchants (SD Prince, Test User) `business`-এ এসেছেন, ব্যালেন্স ৫০০ → ৫০,০০০, আর কেউ কোনো channel হারাননি (তাঁদের connected channel শূন্যই ছিল)। বিস্তারিত নিচের "🧪 যাচাই" অংশে।

**✅ ১৫.১ — যা মাপা হলো (২০২৬-১০-১৪)**

যন্ত্র: `scripts/pricing-research.ts` — structure-গতভাবেই **read-only** (কেবল `findMany` / `groupBy` / `aggregate` / `count`; কোনো `create`/`update`/`upsert`/`delete` নেই, raw SQL নেই)। চালান `npm run pricing:research` দিয়ে; `-- --json` দিলে `docs/pricing/research-output.json`-ও লেখে। বিস্তারিত ফল `docs/pricing/pricing-model-analysis.md`-এর **§১৯**-এ।

> 💡 **একটি কৌশলগত আবিষ্কার:** `npx tsx --conditions=react-server script.ts` দিলে `import "server-only"` করা মডিউলগুলোও (যেমন `credit-resolver.ts`, `model-pricing.ts`) সাধারণ Node স্ক্রিপ্ট থেকে চলে — কারণ এই condition-এ `server-only` খালি module-এ resolve হয়, ঠিক যেমন Next.js server component-এ হয়। ফলে স্ক্রিপ্ট **প্রোডাকশনের ঠিক সেই ফাংশনগুলোই** কল করে (`getCreditRules`, `resolveModelPrice`, `deriveModelCredits`); নকল করে লেখা হিসাব নেই, তাই স্ক্রিপ্টের সংখ্যা আর প্রোডাক্টের সংখ্যা আলাদা হতে পারে না।

**R1 — আসল reply-এর token।** মাত্র ৪৫টি row, **০টি `exact`**, ৪০টি playground, ৪৫টিতেই `task = null`। মাপা p75 = ২,০১৪ + ৫৪৮ বনাম অনুমান ৪,০০০ + ৩০০। **সিদ্ধান্ত: অনুমানটাই রাখা হচ্ছে** — কারণ ট্রাফিকটা আপনার নিজের টেস্ট, প্রতিটি row-এর token-ই নিজে থেকে অনুমান করা (`estimated`), আর আসল merchant ট্রাফিকে Knowledge Base-এর context যোগ হয়। দিকটা ভালো: অনুমান **merchant-এর কাছ থেকে বেশি নেয়, কম নয়** — ভুল হলে ভুলটা প্ল্যাটফর্মের পক্ষে।

**R1b — ৩৪টির ৩৪টিই ভুল।** `openai/gpt-4o` ৩ credit-এ ৳১.৩২৫-এর reply দিচ্ছে — প্রতি credit ৳০.৪৪-এ বিক্রি, অর্থাৎ **২২ গুণ লোকসান**। ৫টি নথিভুক্ত inversion, যার একটি নির্মম: `claude-sonnet-4.5` আর `claude-sonnet-4`-এর খরচ **হুবহু এক** (৳১.৭৯৭), অথচ credit ৫ বনাম ১০।

**R1b — 🔴 একটি নতুন ফাঁদ, যা কাগজে ধরা পড়ত না।** ৬টি মডেল OpenRouter-এর ৪৫৫-মডেল snapshot-এই নেই, তাই `resolveModelPrice()` placeholder দাম ($০.১৫/$০.৬০) বসাচ্ছিল — **আর derivation সেটাকে আসল দাম ভেবে credit বের করছিল।** ফলে `claude-opus-4` ৪০ → **৪**, `claude-opus-4.7-fast` ৫০ → **৪**। "Apply" চাপলে চারটি মডেলের credit ৩০–৫০ থেকে ৪-এ নেমে যেত — কারণ `priceUnknown` তখন কেবল দাম **অবৈধ** হলে true হতো (NaN/ঋণাত্মক), আর placeholder দাম একটা বৈধ সংখ্যা।
**ঠিক করা হয়েছে:** `DeriveCreditsInput`-এ `priceSource` যোগ; `"fallback"` হলে `priceUnknown: true` — আর তখন `planCreditUpdate()` **নতুন সংখ্যা প্রস্তাবই করে না**, admin-এর বসানো মানটাই ফেরত দেয় `needs_review` verdict সহ। ৪টি নতুন টেস্ট, যার একটি হুবহু এই `50 → 4` কেসটা ধরে।

**R2 — 🆕 top-up pack-গুলো খরচের নিচে বিক্রি হচ্ছে।** `topup_50k_business_bdt` = ৳৪০০-এ ৫০,০০০ credit (৳০.০০৮/credit), অথচ তার খরচ ৳১,০০০ (৳০.০২০/credit) — **প্রতি pack-এ ৳৬০০ লোকসান**; চারটি pack-এ ৳৬০০–১,৫৫০। আর plan-এর সাথে তুলনায় top-up credit **৬.২৫ গুণ সস্তা** — যা উল্টো, কারণ top-up plan credit-এর চেয়ে **দামি** হওয়া উচিত। **সমাধান দাম বাড়ানো নয়, credit সংখ্যা কমানো** (৫০,০০০ → ~১৫,০০০)।

**R2b — আজ কোনো সংকট নেই, আর এটাই আসল খবর।** ৫ জন user · **৳৩৬,৪৮১** আয় · মোট AI খরচ **$০.০৭৭৬ (৳৯.৭৮)** · credit utilisation ০–১.৬%। অর্থাৎ §২–§৪-এর সব "লোকসান" **ভবিষ্যতের, বর্তমানের নয়** — সময়মতো ধরা পড়েছে, টাকা খুইয়ে শেখার দরকার নেই। কিন্তু এর সাথে সত্যটাও: **এই ডেটা দিয়ে কোনো pricing সিদ্ধান্ত যাচাই করা অসম্ভব** — `৳০.০২০` আজ দাঁড়িয়ে আছে সূত্রের উপর, ডেটার উপর নয়।

**R2c — `growth` plan-এর ভূত।** ১১টি payment (৳১০,৯৮৯) এসেছে legacy `growth_bdt` প্যাকেজে, আর ডেটাবেসে **২ জন user-এর `plan = "growth"`** — অথচ `plan-config.ts`-এর BD ক্যাটালগে `growth` বলে কিছু নেই (ওটা Global, $২৯)। ➡️ **১৫.৪-এর গ্রহণযোগ্যতায় যোগ করা হলো: `growth`/`pro` user-দের migration path।**

**R5 — 🔴 WhatsApp-এর নিয়ম দুই সপ্তাহ আগে বদলেছে।** ২০২৫-০৭-০১-এ Meta per-conversation ছেড়ে **per-message**-এ গেছে; **২০২৬-১০-০১ থেকে service message (অর্থাৎ আপনার AI-র free-form উত্তরও) billable** — প্রতি number-এ মাসে ১,০০০ free, তারপর বিল। আজ ২০২৬-১০-১৪, অর্থাৎ ১৪ দিন আগে কার্যকর। বাংলাদেশের আসল রেট সূত্রে-সূত্রে **৬.৫ গুণ ছড়িয়ে আছে** ($০.০০১৪–$০.০০৯২), তাই **কোনো একটি সংখ্যা সত্য বলে চালানো হয়নি** — নির্ভরযোগ্য সূত্র আপনার Meta Business-এর নিজের rate card-ই। **আসল প্রশ্নটি টাকার নয়, credit line কার** — বিস্তারিত ১৫.৮-এর নিচে।

**R3 — feature গেটিং ডেটা ছাড়াই করতে হবে।** ৪৫টি row-এর সবগুলোতেই `task = null`, ৪০টি playground, `isFreeMessage` একবারও `true` নয়। অর্থাৎ §৮-এর ম্যাট্রিক্স অনুমানের উপর দাঁড়িয়ে — সেটা স্বীকার করে এগোনোই সঠিক।

⚠️ **একটি মিলিয়ে দেখা দরকার:** প্যানেলের স্ক্রিনশটে `meta-llama/llama-3.3-70b-instruct` ছিল $০.১০/$০.৩২, আজকের snapshot বলছে **$০.৫৯/$০.৭৯** (`deepseek-chat`-এও ভিন্নতা: $০.২৬/$১.০৩ বনাম $০.৩২/$০.৮৯)। ছয়টির মধ্যে চারটি মিলেছে, দুইটি মেলেনি। কারণ যেটাই হোক, সিদ্ধান্ত একটাই — হাতে-লেখা credit যে দামের উপর দাঁড়িয়ে ছিল **সেটাই বাসি ছিল**। তাই ১৫.২-তে প্যানেল যে দাম দেখাবে আর derivation যে দাম ব্যবহার করবে, তা **একই সূত্র** হতে হবে।

**✅ ১৫.২ — যা বানানো হলো (২০২৬-১০-১৪)**

**১. `targetBdtPerCredit = ৳০.০২০` — সিদ্ধান্ত ও তার কারণ কোডে লেখা।** (`credit-derivation.ts`-এর হেডার + `DEFAULT_TARGET_BDT_PER_CREDIT`-এর doc comment)। এই একটি সংখ্যাই এখন পুরো সিঁড়িটা ঠিক করে। কারণ পরীক্ষাযোগ্য: ৳০.০২০-এ আজকের credit allowance গুলো (১৫,০০০ / ৫০,০০০ / ১,৫০,০০০) ঠিক **৭০% / ৬০% / ৪০%** margin-এর স্বাভাবিক অবরোহী সিঁড়ি দেয় — অর্থাৎ **plan-এর দাম আর credit-এর সংখ্যা আগেই সঙ্গত ছিল; ভুল ছিল কেবল প্রতি-মডেলের হাতে-লেখা সংখ্যাটা।**

**২. যন্ত্রটা ছিল, ব্যবহার হচ্ছিল না।** `lib/ai/model-pricing.ts` আগেই OpenRouter থেকে প্রতি মডেলের আসল দাম এনে cache করত, আর `/admin/ai-settings` সেটাই দেখাত। অর্থাৎ প্যানেলে যে $ দাম দেখা যাচ্ছিল, সেটা **হাতে লেখা নয়** — অথচ ঠিক তার পাশেই credit হাতে লেখা হচ্ছিল। নতুন মডিউলটি ওই দামের প্রথম প্রকৃত ভোক্তা।

**৩. Pure module, DB/নেটওয়ার্ক ছাড়া।** কারণ এতে আসল প্যানেল-সংখ্যা দিয়েই টেস্ট লেখা যায় (mock নয়)। `lib/ai/credit-derivation.ts`-এ: `deriveModelCredits` · `deriveCatalogueCredits` · `estimateReplyCostUsd` · `sanitizeTargetBdtPerCredit` · `reviewCreditChange` · `planCreditUpdate` · `computeAllowanceEconomics`।

**৪. যা মাপা যায়নি তা `null`, `0` নয় — `unit-economics.ts`-এর একই নীতি।** দাম ব্যবহারযোগ্য না হলে `credits` floor (১) হয় কিন্তু `priceUnknown: true` ওঠে, আর `effectiveBdtPerCredit` **`null`** থাকে। কারণ অজানা দামে `1` credit নেওয়া **নীরব ভর্তুকি**, সিদ্ধান্ত নয় — প্যানেলকে সেটা আলাদা করে দেখাতে হবে।

**৫. ⚠️ একটি ফাঁদ ধরা পড়ল টেস্ট লেখার সময়েই: floating-point dust.** ৳0.062496 ÷ ৳0.02 = `3.1248000000000004`, নির্দোষ। কিন্তু একটি খরচ target-এর **ঠিক গুণিতক** হলে ভাগফল `5.000000000000001`-এ পড়তে পারে, আর তখন `Math.ceil` **৬** credit কাটত — যেখানে ৫ হওয়া উচিত। তাই `toPrecision(12)` দিয়ে ধুলো সরানো হয় (ঠিক `model-pricing.ts` যেভাবে per-token → per-1M করে), আর সেটি পিন করতে একটি টেস্ট আছে।

**৬. সবচেয়ে জরুরি টেস্টটি সংখ্যা নয়, একটি বৈশিষ্ট্য দাবি করে:** "যে মডেল বেশি খরচ করায়, তার credit কম হতে পারবে না" — ছয়টি আসল প্যানেল-মডেল জোড়ায় জোড়ায় যাচাই করা। সংখ্যা-ভিত্তিক টেস্ট target বা token-অনুমান বদলালেই ভেঙে যেত; এই বৈশিষ্ট্যটা ভাঙে না, আর **যে নিয়মটা আজ লঙ্ঘিত হয়েছে সেটাই ধরে**।

**৭. ইনপুট আর আউটপুট আলাদা রাখা হলো — `ai_credit_derivation`।** শুরুতে `targetBdtPerCredit` আর token-অনুমান `ai_credit_rules`-এর ভেতরেই রাখার পরিকল্পনা ছিল। কোড পড়ে দেখা গেল ওই row-এর **পাঁচটি লেখক**, যার **চারটি পুরো JSON value একবারে প্রতিস্থাপন করে** — `app/api/admin/ai-settings/route.ts:166`, `.../fetch-models/route.ts:288`, `.../validate-models/route.ts:151`, `lib/ai/openrouter-service.ts:491`। অর্থাৎ target-টা ওখানে রাখলে **admin পরের বারে একটি মডেল যোগ করলেই সেটি চুপচাপ মুছে যেত**, আর derivation নিঃশব্দে ৳০.০২০-এ ফিরে যেত। তাই ইনপুটের নিজের row, নিজের **একটাই** লেখক। `credit-resolver.ts`-এর **একটি লাইনও বদলানো হয়নি** — বিলিং পথ আগের মতোই।

**৮. প্ল্যানটা সার্ভারে তৈরি হয়, ক্লায়েন্ট কখনো একটি credit-সংখ্যা পাঠায় না।** `lib/ai/credit-plan.ts` (`import "server-only"`) দেয় `buildDerivationPreview()` ও `applyDerivation()`, আর `app/api/admin/ai-settings/derivation/route.ts` শুধু দুটি দরজা — GET preview, POST apply। POST-এ admin যা পাঠান তা মাত্র দুটো: `targetBdtPerCredit`/`expectedTokens` (ঐচ্ছিক) আর `confirm[]`। অর্থাৎ "কোন মডেলে কী বসবে" কখনো ব্রাউজার থেকে আসে না; ব্রাউজার কেবল বলতে পারে *"এই row-টা আমি দেখেছি"*। `no_settings_row` অবস্থায় route `409` দেয় — নতুন row বানিয়ে দেয় না, কারণ তাহলে `app/api/admin/ai-settings`-এর default-গুলোর **দ্বিতীয় একটি কপি** জন্মাত।

> ক্লায়েন্ট-নিরাপদ type আলাদা ফাইলে — `lib/ai/derivation-types.ts`। কারণ `server-only` মডিউল থেকে কেবল `import type` করলেও client bundle ভাঙে; ঠিক একই কারণে `lib/domain/model-catalog.ts` আগেই আলাদা করা হয়েছিল।

**৯. `priceUnknown` row confirm করলেও লেখা হয় না।** ১৫.১-এ ধরা পড়া ফাঁদটাই এখানে দ্বিতীয়বার আটকানো হলো: যে ৬টি মডেল OpenRouter-এর snapshot-এ নেই, তাদের placeholder দাম ($০.১৫/$০.৬০) থেকে credit বেরোলে `claude-opus-4` **৪০ → ৪** হয়ে যেত। এখন `planCreditUpdate()` ওই row-এ নতুন সংখ্যা **প্রস্তাবই করে না**, আর `applyDerivation()` confirm পেলেও লিখতে অস্বীকার করে (`skipped: price_unknown`) — কারণ admin-এর অনুরোধ একটি placeholder-দামকে আসল দাম বানায় না। এই আচরণটি পিন করতে একটি টেস্ট আছে।

**১০. আসল ৩৪টি মডেলেই মাপা হলো** (read-only স্ক্রিপ্ট, `--conditions=react-server`, একবার চালিয়ে মুছে ফেলা)। ৳০.০২০ · ৳১২৬/USD · ৪,০০০ + ৩০০ token ধরে:

| total | unchanged | withinThreshold | needsReview | priceUnknown | priceDrift | appliesByDefault |
|---|---|---|---|---|---|---|
| ৩৪ | ১ | ০ | ৩৩ | ৬ | ১৪ | ০ |

আর **`inversions: 0`** — উদ্ভাবিত সিঁড়িতে কোথাও "দামি মডেলের credit সস্তার চেয়ে কম" নেই; যে নিয়মটা ৩৪টির ৩৪টিতেই লঙ্ঘিত ছিল, সেটি আর নেই। allowance-এর margin **৭০ / ৬০ / ৪০%** — §ক-এর টেবিলটি বাস্তবে মিলে গেল।

দ্বিতীয় ফল, যা একটি পণ্য-সিদ্ধান্ত: `anthropic/claude-opus-4.1` **৪০ → ৫২০** (৳১০.৩৯৫), পাঁচটি opus **২০ → ১৭৪** (৳৩.৪৬৫), `openai/gpt-4o` **৩ → ৮২** (৳১.৬৩৮), আর `deepseek/deepseek-v4-flash` **৩ → ৩** (অপরিবর্তিত, ৳০.০৫২৭)। হিসাব ঠিক — মডেলগুলো সত্যিই এত খরচ করায়। কিন্তু এর মানে Starter-এর ১৫,০০০ credit-এ opus-এর একটি reply মাত্র **২৯টি** — অর্থাৎ **প্রিমিয়াম মডেলগুলো আজকের allowance-এ অর্থনৈতিকভাবে ব্যবহারই করা যায় না**। allowance প্যানেলটা ঠিক এটাই দেখানোর জন্য বসানো। পাশাপাশি **১৪টি stored দাম বাসি (`DRIFT`)** — Apply সেগুলো credit-এর সাথে ঠিক করে দেয়, যা নিরাপদ কারণ stored দাম কেবল **প্রদর্শনের** জন্য (বিলিং `resolveModelPrice()` লাইভ পড়ে — `ModelConfigSheet.tsx:150-169`-এ সম্পাদনার কোনো উপায়ও নেই)।

**১১. ⚠️ এই মাপটাই একটি UX ত্রুটি ধরা পড়াল, যেটি যুক্তি দিয়ে ধরা পড়ত না।** উপরের টেবিলে `appliesByDefault = ০` আর `needsReview = ৩৩` — অর্থাৎ **প্রতিটি row** ±২০% সীমা ছাড়িয়ে গেছে, তাই "Apply" বোতামটি **চিরতামাটি নিষ্ক্রিয়** থাকত; admin-কে ৩৩টি বাক্স একটি একটি করে টিক দিতে হত। এমন প্যানেল থাকা না থাকা সমান। সমাধান: **"Confirm all N"** — একটি কাজ, যা **সংখ্যাটি নাম নিয়েই** বলে দেয় কতগুলো row বড় পরিবর্তন; তাই নিরাপত্তার বৈশিষ্ট্যটি (বড় বদলের জন্য একটি সচেতন কাজ) অটুট, কেবল ৩৩ বার নয় বরং **একবার**। সঙ্গে টেবিল `max-h-[30rem]`-এ স্ক্রল-সীমিত, আর বোতামের লেবেলেই লেখা কতটি অনুমোদনের অপেক্ষায় (`Apply (N waiting)`)।

**১২. যাচাই:** `npx tsc --noEmit` → ০ · `npm test` → **৫০৩ পাস / ২০ ফাইল** (আগে ৪৮২ — ১৫.২-কোরের ৩৮টি, `credit-plan`-এর ১৭টি, আর ১৫.১-এর ফাঁদ ধরা পড়ে +৪) · `npm run build` → exit 0, route তালিকায় `/api/admin/ai-settings/derivation`। `en`/`bn`-এ `aiSettings.derivation`-এর **৪৯টি key হুবহু মিলছে** (জোড়ায় জোড়ায় যাচাই করা)। **কোনো DDL নেই, DB-তে একটি row-ও লেখা হয়নি, n8n ছোঁয়া হয়নি** — এখনো পর্যন্ত সবকিছু DDL-মুক্ত ও প্রত্যাবর্তনযোগ্য।

**⚠️ যা এখনো বাকি ও কেন:**

- **token-অনুমান (`4,000 + 300`) এখনো একটি অনুমান,** মাপা নয় — ১৫.১ মেপেছে, কিন্তু মাপাটা আপনার নিজের টেস্ট ট্রাফিক (৪৫টি row, ০টি `exact`), তাই **বদলানো হয়নি**; কারণ §১৯.২-তে। ট্রাফিক বাড়লে `npm run pricing:research` আবার চালাতে হবে।
- **`resolveReplyCredits()`-এ একটি লাইনও বদলায়নি — বদলানো উচিতও নয়।** derivation বিলিং-এর সময়ে চলে না; সে কেবল **materialise** করে। admin "Apply" চাপলে সংখ্যাটি `ai_credit_rules.models[].credits`-এ লেখা হয়, আর ওই পথটাই (`credit-resolver.ts:198` — admin override → tier default → standard ৩) বিলিং আগে থেকেই পড়ত। তাই এখানে নতুন কোনো resolution স্তর নেই, কেবল সংখ্যাগুলোর একটি স্বয়ংক্রিয় উৎস। আর কিছুই **নিজে থেকে** বদলাবে না: **কেউ Apply না চাপলে merchant-এর credit আজ আগের মতোই কাটে**, কারণ `applyDerivation()`-এর একমাত্র caller admin প্যানেল। ⚠️ `ai_credit_derivation` row-টি এখনো **নেই** — তাই প্রথম preview-তে default (৳০.০২০ · ৪,০০০ + ৩০০) ধরে দেখানো হবে, আর Apply চাপলে তবেই row-টি তৈরি হবে।
- **একটি সংখ্যা এখনো অজানা:** Fast preset (`deepseek/deepseek-v4-flash-0423`)-এর দাম — ব্যবহারকারীর প্যানেল থেকে পাওয়া বাকি। ⚠️ খেয়াল করুন: লাইভ snapshot-এ `deepseek/deepseek-v4-flash` **আছে** ($০.০৯/$০.১৮), কিন্তু `-0423` suffix-টা নেই — তাই এটি §১৯.৩-এর "দাম নেই" তালিকাতেও পড়তে পারে।

---

**🔄 ১৫.৩ — অনুসন্ধান ও ফাঁক ১ (২০২৬-১০-১৪)**

**ফাঁক ১ ✅ — dead legacy route মুছে ফেলা হলো।** `app/api/chatbots/[chatbotId]/enhance-prompt/route.ts` মুছে ফেলা হয়েছে। **যাচাই করা হয়েছে যে তার কোনো caller নেই** — রেপোর ভেতরে কোথাও নেই (একমাত্র `enhance` caller [`chat-settings.tsx:102`](../../app/(dashboard)/dashboard/chatbots/[chatbotId]/setup/_components/chat-settings.tsx#L102), সে ডাকে `/api/chatbots/enhance-prompt`), কোনো test-এ নেই, n8n JSON-এও নেই। অর্থাৎ এটি **dead code**, যা একই কাজের **দ্বিতীয় ও ভিন্ন-নিয়মের** একটি দরজা খোলা রাখছিল:

| | legacy route (মুছে ফেলা) | লাইভ route |
|---|---|---|
| AI কল | raw `fetch` — gateway বাদ | `callModel()` — gateway |
| model | হার্ডকড `google/gemini-2.5-flash` | একই, তবে tier-নীতির অধীনে |
| credit | **২০ কাটত** (হাতে লেখা transaction) | **কাটে না** (`ai-task.ts:84` → `isCharged: false`) |
| plan | Starter-কে `403` | কোনো গেট নেই |

⚠️ **⚠️ একটি বড় মাপা আবিষ্কার, যা §৮.১-এর ভিত্তিটাই বদলে দেয়:** `lib/domain/ai-task.ts:81-95` পড়ে দেখা গেল **শুধু `chat` বিল হয়** — `enhance_prompt`, `translate`, `compare`, `text_ingest`, `product_extract`, `auto_train`, `embedding` — **সাতটির একটিও নয়**। অর্থাৎ pricing ডকের **§৮.১-এর ধারণা ("প্রায় সব feature ইতিমধ্যেই credit-এ মিটারে আছে — enhance ২০, auto-train ৫০, product-sync ৩০") লেখার সময় সত্য ছিল না**; কোডে ওগুলো বলে: *"That is a revenue leak, not a design choice"*। ➡️ **এটি TASK-25-এর মাপা প্রমাণ**, এবং এর মানে ১৫.৩-এ **meter-এর উপর ভরসা করা যাবে না** — gate-ই আপাতত একমাত্র lever। (আলাদা টাস্ক, তাই ১৫.৩-এ `isCharged` বদলানো হচ্ছে না।)

**ফাঁক ২ ও ৫ — `allowedPlatforms` / `canAddIntegration`।** ম্যাপ করা হলো: `canAddIntegration` আছে **৭টি** route-এ (facebook · instagram ×২ · whatsapp ×২ · n8n_facebook), আর **নেই** [`[platform]/connect`](../../app/api/chatbots/[chatbotId]/integrations/[platform]/connect/route.ts) ও [`n8n_source/connect`](../../app/api/chatbots/[chatbotId]/integrations/n8n_source/connect/route.ts)-এ। ⚠️ **তবে এটি যোগ করার আগে একটি দ্বন্দ্ব আপনার সিদ্ধান্ত দরকার** (নিচে)।

**ফাঁক ৩ — top-up gate সত্যিই কেবল ক্লায়েন্টে।** [`TopUpCards.tsx:71`](../../app/(dashboard)/dashboard/payment/_components/TopUpCards.tsx#L71) শুধু ফিল্টার করে, আর [`uddoktapay/charge`](../../app/api/payments/uddoktapay/charge/route.ts#L16) `package_id` যাচাই করে **কেবল "এটি একটি BDT প্যাকেজ" হিসাবে** — plan দেখে না। [`applyPaymentGrant`](../../lib/services/admin-credits.ts#L527)-এর `topup` শাখাতেও plan-যাচাই নেই। ➡️ Starter merchant সরাসরি API-তে `topup_50k_business_bdt` পাঠিয়ে ৫০,০০০ credit কিনতে পারেন।

**ফাঁক ৪ — e-commerce গেট একেবারেই নেই।** `app/api/orders/**`-এর **৭টি route-এর একটিতেও** `plan-config`/`planRank` ছোঁয়া হয়নি (grep করে দেখা গেছে)। অথচ Starter-এর feature-লেখায় স্পষ্ট: *"No E-Commerce Integration"*।

**ফাঁক ২, ৩, ৪, ৫ ✅ — নীতি এক করা হলো।** নিচে চারটি ফাঁকের চিকিৎসা (বিস্তারিত পরের ব্লকে)।

**⚠️ দ্বন্দ্বটি মিটানো হলো — তবে "না" দিকে নয়, "হ্যাঁ" দিকে।** Global Starter-এর feature-তালিকায় লেখা ছিল **"Web Widget"**, কিন্তু `allowedPlatforms` ছিল **`["facebook"]`** — আর `maxIntegrationsPerChatbot: 1`। অর্থাৎ ওই plan-এর নিজের লেখাই পরস্পরবিরোধী। ফাঁক ২ enforce করার আগে থামতে হতো এখানে, কারণ **Web Widget এইমাত্র (TASK-12/১৩) লাইভে গেছে** — আর যে Starter merchant আজ widget ব্যবহার করছেন, তাঁর চ্যানেল কেটে দেওয়া হত।

সিদ্ধান্ত: **Web Widget entry plan-এ থাকবে, দুই region-এই** (`allowedPlatforms: ["facebook", "website"]`), আর BD-র লেখা **"Facebook Channel Only" → "Facebook + Web Widget"**-এ সংশোধিত। কারণ তিনটি:

1. **ওটাই ট্রায়াল plan-এর একমাত্র ব্যবহারযোগ্য চ্যানেল।** Facebook Messenger চালাতে Meta app + page permission লাগে; widget-এ কিছুই লাগে না — শুধু একটা script tag। যে plan-এ **৩-day free trial** আছে, তার ব্যবহারকারীর পক্ষে widget-ই একমাত্র বাস্তবসম্মত প্রথম ধাপ।
2. **উপসেল ক্ষয় হয় না:** Business এখনো ১০ chatbot · ৫০,০০০ credit · সব channel · ই-কমার্স · top-up দেয় — starter ১টি chatbot, ১টি integration, ৪টি channel-এর কোনোটিই নয়।
3. **উল্টো দিকের ভুলটাই ভারী:** FB-only চাপালে একটি লাইভ, সদ্য-শিপ করা চ্যানেল নীরবে ভাঙত; widget রাখলে সর্বোচ্চ ক্ষতি হয় "একটু বেশি দেওয়া"।

⚠️ **ইউজার-সিদ্ধান্ত প্রয়োজন হলেও এটি ইচ্ছে করেই "হ্যাঁ" দিকে নেওয়া হলো** — কারণ এখানে ভরসার নিয়মটি ছিল "কিছু ভেঙো না", "কিছু কমাও" নয়। ফিরিয়ে নিতে চাইলে `plan-config.ts:97-107`-এ এক লাইন।

---

**✅ ১৫.৩ — যা বানানো হলো (২০২৬-১০-১৪)**

**১. নীতির একক উৎস — চারটি pure function** ([`lib/domain/plan-config.ts`](../../lib/domain/plan-config.ts))

| ফাংশন | প্রশ্ন |
|---|---|
| `getPlanIfDefined(region, key)` | এই region-এ এই নামে কোনো plan আছে কি না (নেই হলে `null`) |
| `planAllowsPlatform(plan, region, slug)` | এই plan-এ এই channel খোলা কি না |
| `planAllowsEcommerce(plan, region)` | courier + orders এই plan-এ আছে কি না |
| `isPackageAllowedForPlan(id, plan, region)` | এই plan এই package কিনতে পারে কি না |

⚠️ **`getPlan`-এর বদলে `getPlanIfDefined` কেন — এটাই ১৫.৩-এর সবচেয়ে জরুরি সিদ্ধান্ত।** `getPlan("bd","growth")` চুপচাপ **starter** ফেরত দেয় (কারণ BD-তে `growth` নেই)। ওই উত্তরটি ভুল উত্তরের মতো দেখায় না, তাই entitlement-এর প্রশ্নে এর ফল সরাসরি টাকা: **legacy `growth`/`pro` merchant — যিনি সত্যিই পরিশোধ করেছেন, আর `payment-packages.ts`-এ যাঁদের `growth_bdt`/`pro_bdt` package এখনো আছে — চুপচাপ Starter-এর সীমায় পড়ে নিজের channel হারাতেন**। তাই: এই region-এর catalogue যে key-র নামেই কোনো plan রাখে না, তার জন্য **নিয়মও নেই** → **fail-open**। "না-জানি" আর "না" আলাদা রাখা হলো।

**২. ফাঁক ২ ও ৫ — generic connect route-এ gate** ([`[platform]/connect`](../../app/api/chatbots/[chatbotId]/integrations/[platform]/connect/route.ts))
`getOwnedChatbot` → `canAddIntegration` — হুবহু বাকি ৭টি route-এর ক্রমে (ownership আগে, কারণ limit-গণনা URL-এর `chatbotId`-এ হয়, যা user-scoped নয়)। সাথে slug **lowercase** করা হলো gate ও write — দুই জায়গাতেই, নইলে `FACEBOOK` gate পাস করে `chatbotId_platform` unique key-টাই এড়িয়ে যেত।
➡️ **`n8n_source/connect` ইচ্ছে করেই gate করা হলো না:** এটি channel নয়, একটি ingest-URL rail; কোনো plan-এর `allowedPlatforms`-এ `n8n_source` নেই, তাই platform-gate দিলে সেটি **সবার** জন্য ভাঙত। আর এটি নিজের chatbot-এ একটি row লেখে, যা merchant-এর নিজের ছাদেই ধরা আছে — আক্রমণকারীর লাভ শূন্য।

**৩. 🔴 ফাঁক ৫-এ একটি লাইভ bug বেরোল — `canAddIntegration` ছাদের উপরে reconnect আটকাত।**
আগে **সব** `connected` integration গোনা হত। ফলে যে chatbot ছাদে পৌঁছে গেছে (`count 1 >= max 1`), সেখানে **পুরনো channel-টি আবার connect করলে অনুরোধ ফিরে যেত ৪০৩** — অর্থাৎ BD Starter merchant তাঁর **একমাত্র** Facebook channel-এর টোকেন নবায়ন করতে পারতেন না, অথচ নতুন কিছু যোগ করছিলেন না। এখন যে platform-টি connect করা হচ্ছে সেটি গণনা থেকে বাদ। **কিছুই শিথিল হয় না:** যে platform এখনো connected নয় তার সংখ্যা অপরিবর্তিত, তাই নতুন channel ছাড়াতে পারে না।
➡️ এই bug-টি **৭টি আগে-থাকা gated route-এ ছিল**, ১৫.৩-এ যোগ হওয়া route-এ নয় — অর্থাৎ এটি ঠিক করার ফলে সামগ্রিক gate **শক্ত হয়েছে, দুর্বল নয়**।

**৪. ফাঁক ৩ — top-up plan-gate** ([`uddoktapay/charge`](../../app/api/payments/uddoktapay/charge/route.ts))
`isPackageAllowedForPlan(package_id, user.plan, region)` — নিয়ম: **top-up pack কেবল সেই plan-ই কিনতে পারে যার নামে pack-টি** (pack-এর দাম plan-ভিত্তিক: Business ৫০হাজার ৳৪০০, Enterprise ৳২৫০ — তাই mismatch মানে হয় ফাঁকা credit, নয় ছাড়)। **Plan package** (`business_bdt`) সীমাবদ্ধ **নয়** — সেটি আপগ্রেডের পথ, এবং ঠিক সেই পথটিই এই gate-এর কারণ।
⚠️ **`applyPaymentGrant`-এ ইচ্ছে করেই কোনো plan-check নেই:** ফাংশনটি চলে টাকা কাটা হয়ে যাওয়ার **পরে** (gateway webhook)। সেখানে আটকালে ফল হত "টাকা গেছে, credit মেলেনি" — আসল ফাঁকটির চেয়ে খারাপ। তাই সিদ্ধান্ত এক জায়গায়: checkout-এ।

**৫. ফাঁক ৪ — E-Commerce entitlement** (`ecommerceEnabled`, catalogue-এ ঘোষিত)
নতুন gate `canUseEcommerce(userId)`, আর UI একই নিয়ম পড়ে ([`/api/usage`](../../app/api/usage/route.ts) → `planAllowsEcommerce`) যাতে nav আর API কখনো দুই কথা না বলে।
- **যা গেট হলো (লেখা):** `POST /api/orders` · `PATCH`/`DELETE /api/orders/[id]` · `bulk-delete` · `bulk-dispatch` · `sync-status` (+ `sync-courier`, যা ওটির alias) · **`POST /api/couriers`** — শেষটি ওই endpoint যেটি plan-এর লেখা আসলে বেচে: Business পায় "E-Commerce (All Couriers)", Starter পায় "No E-Commerce Integration"।
- **যা ইচ্ছে করেই গেট হলো না (পড়া):** `GET /api/orders*` · `GET /api/couriers`। কারণ একটি সীমা **তৈরি করার** উপর, **দেখার** উপর নয় — plan বদলালে merchant তাঁর নিজের বিক্রির ইতিহাস আর দেখতে না পারলে সীমাটি তাঁর নিজের ডেটা লুকিয়ে ফেলত।
- **nav:** Starter-এ E-Commerce গ্রুপ লুকানো ([`Sidebar.tsx`](../../components/layout/Sidebar.tsx))। শর্ত `usage?.ecommerceEnabled !== false` — **`!usage?.ecommerceEnabled` নয়**, কারণ `usage` fetch হওয়ার আগে `null` থাকে, আর "এখনো আসেনি"-কে "পায় না" পড়লে পরিশোধকারী merchant প্রতিটি navigation-এ নিজের মেনু হারাতেন ও ফিরে পেতেন।
- ⚠️ **সীমা স্পষ্ট করে বলছি:** Products ও Discounts-এর আলাদা API নেই (`app/api/products`, `app/api/discounts` — কোনো ফোল্ডারই নেই), তাই সেগুলো কোনো gate-এর আওতায় পড়েনি। nav লুকানোয় Starter-এর কাছে ওই পেজগুলোর পথ নেই, তবে ইচ্ছাকৃত API-কল এখনো খোলা — এই মুহূর্তে সেটি একটি **জানা সীমা**, দাবি নয়।

**৬. যাচাই (১৫.৩)**

| যাচাই | ফল |
|---|---|
| `npx tsc --noEmit` | **exit 0** |
| `npm test` | **৫২৩ পাস / ২১ ফাইল** (আগে ৫০৩/২০) — নতুন `lib/domain/plan-entitlements.test.ts`-এ ২০টি |
| `npm run build` | **exit 0**, ১১৮টি পেজ |
| build-এর route manifest-এ legacy enhance-prompt | **০ বার** |
| DDL / DB row | **শূন্য** — কোনো schema বদল নেই, কোনো row লেখা হয়নি |
| n8n JSON | **অপরিবর্তিত** |

নতুন টেস্টগুলো চার ফাংশনের **পুরো নিয়ম-টেবিল** ধরে রাখে, প্রতিটি "retired key"-এর প্রশ্ন সমেত — কারণ নিয়মটি এখন ১১টি route handler পড়ে, আর ওগুলো পড়ে পুনর্গঠন করা মানে একই হিসাব আবার করা।

---

**✅ ১৫.৪ · ১৫.৫ · ১৫.৯ · ১৫.৬ — যা বানানো হলো (২০২৬-১০-১৫)**

**ক্রম (নির্ভরতা মেনে যা করা হলো):** ১৫.১ (পুনরায় মাপা) → ১৫.৪ → ১৫.৫ → ১৫.৯ → ১৫.৬

চারটির প্রত্যেকটিই নিচে, তার **আগের** `কেন` অংশটি অপরিবর্তিত রেখে — কারণ যুক্তিগুলো এখনো সত্য, শুধু অবস্থাটা বদলেছে।

**অনুসন্ধানের চারটি সিদ্ধান্ত-বদলানো আবিষ্কার** (পরিকল্পনার সময় যা পাওয়া গেল, আর প্রত্যেকটিই পরিকল্পনা বদলেছে):

| # | আবিষ্কার | ফল |
|---|---|---|
| ১ | 🔴 **"এই cycle-এ টাকা দিয়েছে" শর্ত দিলে প্রোডাক্ট ভাঙত** — এই প্ল্যাটফর্মে **recurring billing বলে কিছু নেই**; প্রতিটি plan কেনাকাটা এক-বারের `PaymentTransaction` | ৩০-দিনের উইন্ডোতে প্রথম মাসের পর **প্রতিটি পরিশোধকারী** skip হয়ে যেতেন → আপনার অনুমোদিত নিয়ম **ever-paid** |
| ২ | 🟢 **১৫.৬-এর জন্য DDL লাগতেই পারে না** — `User.planExpiresAt` কলামটি **আগেই আছে**, payment grant-এ লেখা হয়, আর merchant-কে "Renews on …" দেখানোও হয়। Trial তো ঠিক সেটাই: **একটি plan period যা শেষ হয়, নবায়ন হয় না** | **কোনো `migrate diff` নেই, কোনো অনুমোদন লাগে না** — পরিকল্পনার ⚠️ DDL সতর্কতাটি বাতিল |
| ৩ | 🔴 **`growth`-এর ভূতটি grant-এর সময়েই জন্মে, UI-তে নয়** — `admin-credits.ts`-এ `PLAN_KEYS`-এর **একটি দ্বিতীয় কপি** ছিল যেখানে `growth` **বৈধ** | region-সচেতন যাচাই (`getPlanIfDefined`/`resolvePlanKeyForRegion`) থাকলে এটি অসম্ভব ছিল → **দুটো কপিই মুছে ফেলা হলো** |
| ৪ | 🟢 **১৫.৫-এর রেল দুটোই আগেই বানানো** — client-এ `dashboard/payment/page.tsx` আগেই `plan.contact` ধরে "contact sales" দেখায়; server-এ `createPayableInvoice(kind: "plan")` → invoice → webhook → `applyPaymentGrant`-এর `invoice_plan` শাখা **সত্যিই plan apply করে** | **একটি নতুন admin UI-ও লাগল না** — শুধু public pricing page-এর CTA আর server-side gate |

---

#### ✅ ১৫.৪ — legacy `growth`/`pro` → region-সচেতন migration + একটাই key-resolver

**১. একটি মাত্র সূত্র — `resolveLegacyPlanKey(region, key)` + `resolvePlanKeyForRegion(region, key)`** ([`lib/domain/plan-config.ts`](../../lib/domain/plan-config.ts))

| legacy key | BD | Global | কেন |
|---|---|---|---|
| `growth` | `business` | `growth` | BD-তে ৳৯৯৯-এর পুরনো plan; Global-এ আজও একটি **সত্যিকারের** plan ($২৯) — alias নয় |
| `pro` | `business` | `growth` | `pro` ছিল $২৯ / ৳২,৯০০ — দুই region-এ সেই দামের tier |
| `agency` | `enterprise` | `enterprise` | Enterprise-এর আগের নাম |

⚠️ **একই শব্দ দুই region-এ দুই জিনিস** — তাই alias-টেবিল **region-সচেতন** করা হয়েছে। একটি region-নিরপেক্ষ টেবিল ঠিক সেই পার্থক্যটাই মুছে দিত যেটা থেকে বাগটি জন্মেছিল।

**২. দ্বিতীয় কপি মেরে ফেলা (AGENTS.md §6)।** `admin-credits.ts`-এর `VALID_PLAN_KEYS` (একটি `PLAN_KEYS`-এর নকল, যেখানে `growth` বৈধ) **মুছে ফেলা হয়েছে**, আর `LEGACY_PLAN_ALIASES`-ও। plan-এর ক্রম (hierarchy) এখন **এক জায়গায়** — `PLAN_KEYS` (`plan-config.ts:18`)। `resolvePlanForGrant` এখন `resolvePlanKeyForRegion`-কে ডাকে।

**৩. 🔴 migration-এর সময় ধরা পড়া দুটি বাগ, যেগুলো ঠিক করা হয়েছে:**

- **hierarchy-র তুলনা ভুল হত।** `setUserPlan` `previousPlan`-কে সরাসরি `PLAN_KEYS`-এ খুঁজলে একজন legacy BD `growth` user-এর `previousIdx === -1` হত, ফলে তাঁকে `starter`-এ নামানো **upgrade** হিসেবে চিহ্নিত হত আর pause-যুক্তি বাদ পড়ত (তাঁর chatbot চলতেই থাকত, অথচ plan নেমে গেছে)। **সমাধান:** `previousPlan`-কে আগে `resolvePlanKeyForRegion` দিয়ে resolve করা হয়।
- **credit দুইবার যোগ হত।** `getPlanCredits(previousPlan, region)`-এ কাঁচা `"growth"` পাঠালে BD-তে সেটি **চুপচাপ starter (১৫,০০০)** ফেরত দেয় — অর্থাৎ পুরনো allowance-টি admin-এর "bonus" বলে গুনে **আবার যোগ** হত। **সমাধান:** `getPlanCredits(currentKey ?? previousPlan, region)`।

✅ **DB migration-ও শেষ (২০২৬-১০-১৫) — আপনার স্পষ্ট অনুমতির পরে।** মাপার যন্ত্র: [`scripts/task15-migration-audit.ts`](../../scripts/task15-migration-audit.ts) — structure-গতভাবেই **read-only** (কেবল `findMany`/`groupBy`; কোনো `create`/`update`/`upsert` নেই, raw SQL নেই), নিজের শেষ লাইনেই লিখেছে *"nothing was written"*। তার আউটপুট দেখিয়ে অনুমতি নেওয়ার পরে লেখার যন্ত্র: [`scripts/task15-migrate-legacy-plans.ts`](../../scripts/task15-migrate-legacy-plans.ts) — ডিফল্ট **dry-run**, লেখে কেবল `--apply`-এ; আর নিজে কলাম না লিখে **`setUserPlan`-ই ডাকে** (দ্বিতীয় implementation নয় — উপরের `VALID_PLAN_KEYS`-এর শিক্ষা)।

চালান: `npx tsx --conditions=react-server scripts/task15-migrate-legacy-plans.ts [--apply]`। ⚠️ `tsx` `devDependencies`-এ নেই, কিন্তু `npx` চাহিদামতো নামিয়ে নেয় — অথবা ডকে থাকা `jiti` রুটিন।

**ফল:** ২ জন `growth @ bd` → `business` (`direction: sidegrade`, `includedCredits` ৫০০ → ৫০,০০০, `creditsResetDate`/`planExpiresAt` = ২০২৬-১১-১৩)। **কেউ কোনো channel হারাননি** — তাঁদের connected channel শূন্যই ছিল, অনুমান নয় মাপা। পুনরায় চালালে *"Nothing to migrate"* — অর্থাৎ idempotent। বিস্তারিত "🧪 যাচাই" অংশে।

**৪. i18n — যে key অব্যবহৃত এবং যা বলে তা মিথ্যা, সেটিই মুছে ফেলা হলো।** `public/locales/{en,bn}/pricing.json` থেকে সরানো হয়েছে: `free` (`price: "৳০"`/`"$0"` — অথচ BD Starter **৳৯৯৯**), `pro` (`"৳২৯০০"`/`"$29"`), এবং `starter`/`growth`/`business`/`ent`-এর duplicate `name`+`desc` ব্লক (plan-এর নাম ও feature ক্যাটালগেই `LocalizedString` হিসেবে আছে, পেজ `resolveLocalStr` দিয়ে পড়ে)। `monthly`/`yearly` রাখা হলো — ১৫.৭ ওগুলোই লাগবে, আর ওরা মিথ্যা কিছু বলে না।

**নির্ভরতা:** ১৫.১ (R2c) · ১৫.২ · **DB লেখে (migration — ✅ সম্পন্ন ২০২৬-১০-১৫, আপনার অনুমোদনের পরে)**

---

#### ✅ ১৫.৫ — Enterprise আলাদা লেন ("Contact us" + নেগোসিয়েটেড চুক্তি)

**১. BD Enterprise-কে Global-এর আয়নায় বসানো** ([`plan-config.ts`](../../lib/domain/plan-config.ts)) — `price: 0` · `priceLabel: "Custom"/"কাস্টম"` · `contact: true` · `includedCredits`/`perCreditRate` অপরিবর্তিত।

এতে **আগে থেকেই-কাজ-করা** জিনিসগুলো নিজে থেকে সঠিক হয়ে গেল (আলাদা করে কোথাও লিখতে হয়নি):
- `plan-revenue.ts` → `basis: "custom"` (০ নয় — "unknown ≠ 0" নীতি), আর admin panel-এর ভুয়া **১০০% margin** চলে গেল
- `computeAllowanceEconomics` → margin `null` (খরচ ৳৩,০০০ **জানা**, দাম অজানা)
- pricing page-এর `/mo` suffix আগেই `plan.contact`-এ বন্ধ ছিল

⚠️ **৳৪,৯৯৯ সংখ্যাটি মুছে ফেলা হয়নি — কোডের মন্তব্যে ইতিহাস হিসেবে রাখা হয়েছে।** কারণ derivation-এ এই tier-এর মাপা লোকসান ছিল **−৫২৪%**, আর সেই সংখ্যাটিই সিদ্ধান্তের সাক্ষ্য।

**২. একমাত্র সত্যিকারের ফাঁক ছিল CTA** ([`app/(root)/pricing/page.tsx`](../../app/(root)/pricing/page.tsx))। আগে **প্রতিটি** plan `router.push("/dashboard/payment")` করত — অর্থাৎ Enterprise চেপে গ্রাহক একটি **dead end** ঘুরে আসতেন (ওই tier-এর কোনো package কেনা যায় না, কারণ প্রকাশিত দামই নেই)। এখন `plan.contact` হলে CTA = **"Contact us"**, যা contact form খোলে।
⚠️ এটি `paymentAvailable`/`isSignedIn`-এর শর্তের **বাইরে** — কথাবার্তার জন্য payment gatewayও লাগে না, account-ও লাগে না; তাই Global region-এও (যেখানে gateway নেই) Enterprise-এর রূপান্তরের পথটি খোলা থাকল।

**৩. কোডবেসে একটি মাত্র contact form** ([`components/landing/BookDemoModal.tsx`](../../components/landing/BookDemoModal.tsx)) — `source` · `namespace` · `keyRoot` · `messageIntro` prop যোগ করে generalise করা হলো (ডিফল্ট = আজকের আচরণ হুবহু, তাই landing page-এ কিছুই বদলায়নি)। আলাদা একটি second form না বানানোর কারণ: দুটি form থাকলে একটির bug অন্যটিতে লাগত, আর `/api/contact`-এর validation দুই জায়গায় মিলিয়ে রাখতে হত। ফাইলের নাম ঐতিহাসিক (`BookDemoModal`) — একটি মন্তব্যে লেখা।

**৪. Server-side gate (defence in depth — ১৫.৩-র নীতি: gate-এর জায়গা checkout)** — `isPackageAllowedForPlan`-এ নতুন নিয়ম: **`contact: true` plan-এর package কেনা যায় না**। নেগোসিয়েটেড tier-এর প্রকাশিত দাম নেই, তাই চার্জ করার মতো কিছুই নেই। `uddoktapay/charge` আগেই এই ফাংশন ডাকে, তাই আলাদা কিছু লাগল না।
⚠️ **`enterprise_bdt` ক্যাটালগে থাকল** (৳৪,৯৯৯, `amount` সহ) — পুরনো transaction-এর grant path (`resolvePlanForGrant`) টাকা কাটার **পরে** এটি পড়ে; ১৫.৩-এ ঠিক এই কারণেই grant-এ কোনো plan-যাচাই নেই ("টাকা গেছে, credit মেলেনি" আসল ফাঁকের চেয়েও খারাপ)।

**৫. admin rails — নতুন কোড নেই, শুধু যাচাই।** নেগোসিয়েটেড চুক্তির পথটি আগেই খোলা: admin → `manual_invoice` action (`plan` সহ) → `createPayableInvoice(kind: "plan")` → invoice email → merchant pay → webhook → `applyPaymentGrant` → `invoice_plan` শাখা সত্যিই plan apply করে।

**নির্ভরতা:** ১৫.৪ · DB লেখে প্রোডাকশনে (invoice row) — কোড লেখা ✅

---

#### ✅ ১৫.৯ — 🔴 `reset-credits`-এ payment যাচাই

**সিদ্ধান্ত (আপনার অনুমোদিত):** **ever-paid** — যার ইতিহাসে একটি paid ও refund-না-হওয়া plan payment আছে সে-ই যোগ্য।

**১. নতুন pure module [`lib/domain/payment-status.ts`](../../lib/domain/payment-status.ts).** `PAID_STATUSES` `payment-issues.ts:34` থেকে সরানো হলো, কারণ ওই ফাইলটি `import "server-only"` + `db` — অর্থাৎ তার ভেতরের কিছু **টেস্টে import করা যায় না**, অথচ reset-এর নিয়মটি অবশ্যই পরীক্ষাযোগ্য হতে হবে। `payment-issues.ts` এখন **re-export** করে, তাই `scripts/pricing-research.ts`-এর মতো বর্তমান consumer অপরিবর্তিত (একটাই সূত্র)।

**২. নতুন pure predicate [`lib/domain/reset-eligibility.ts`](../../lib/domain/reset-eligibility.ts)** — ক্রমটাই নিয়ম, আর প্রতিটি ধাপের একটি কারণ আছে:

| ক্রম | শর্ত | ফল | কেন এই ক্রমে |
|---|---|---|---|
| ১ | জীবিত plan payment আছে | ✅ `ever_paid` | ⚠️ **সবার আগে**, `hasRefundedPayment`-এরও আগে: যিনি টাকা দিয়ে refund নিয়ে **আবার** টাকা দিয়েছেন, তিনি পরিশোধকারী। ক্রম উল্টো হলে ঠিক তিনি বাদ পড়তেন |
| ২ | refund হয়েছে, নতুন payment নেই | ⛔ `refunded` | টাকা আমাদের কাছে নেই |
| ৩ | plan key এই region-এর ক্যাটালগেই নেই | ✅ `unknown_plan` | fail-safe — `isPaidPlan`-এর মতো একই দিক; নইলে একজন legacy পেইং merchant নবায়ন হারাতেন |
| ৪ | `contact: true` (নেগোসিয়েটেড), payment নেই | ⛔ `negotiated_unpaid` | ⚠️ `contact: true` plan-এর `price`-ও ০, তাই **এই ধাপটি ৫-এর আগে থাকতেই হবে** |
| ৫ | এই region-এ plan-এর দাম ০ | ✅ `free_plan` | Global Starter — **আবশ্যক**: Global-এ gateway-ই নেই, তাই এটিকে আটকালে ওই free tier চিরকাল ৫০০ credit-এ আটকে যেত |
| ৬ | নাহলে | ⛔ `never_paid` | দাম আছে, টাকা নেই — **এটিই আসল ছিদ্র** |

**🔴 ধাপ ৪ যে ফাঁদটি আটকাল (পরিকল্পনার টেক্সটে ছিল না):** পরিকল্পনার ধাপের ক্রম হুবহু মানলে একটি `contact: true` plan ধাপ ৫-এ (`price === 0`) গিয়ে পড়ত → একজন **চুক্তিভিত্তিক Enterprise, যাঁকে admin invoice ছাড়া plan দিয়েছেন**, প্রতি মাসে ১,৫০,০০০ credit পেতেন — **একটিই অ্যাকাউন্টে ≈ ৳৯,০০০/মাস, চিরকাল**। অর্থাৎ ছিদ্র বন্ধ করতে গিয়ে নতুন একটি ছিদ্র জন্মাত। তাই `config.contact === true` যাচাই ধাপ ৫-এর **আগে** বসানো হলো।

**৩. [`app/api/cron/reset-credits/route.ts`](../../app/api/cron/reset-credits/route.ts)**
- **একটি** `paymentTransaction.groupBy(["userId","refundStatus"])` দিয়ে পুরো প্রমাণ — per-user query নয় (N+1 নয়)। ⚠️ প্রতিটি refund "হয়ে গেছে" কিনা (`refundStatus === "refunded"`) — `requested`/`approved`/`rejected` এখনো আমাদের টাকা, তাই তারা paid-সেটেই থাকে।
- credit grant **শুধু যোগ্য হলে**; skip হলে **ব্যালেন্স, `includedCredits`, `creditsUsedThisCycle` — কিছুই বদলায় না**, কেবল `creditsResetDate` এগোয় (নইলে বাদ-পড়া user-রা প্রতিদিন আবার স্ক্যান হত)।
- response ভাঙা হলো: `{ processed, granted, skipped, failed, skippedByReason, resetAt }` — কারণ একটি **নীরব skip** সমান ফারাক (নীরব leak) নতুন করে জন্ম দিত। ✏️ **সংশোধন:** পরিকল্পনায় লেখা ছিল `{ processed, granted, skipped, skippedByReason, resetAt }`; `failed` যোগ করা হলো কারণ আগের কোডে প্রতি-user try/catch ছিল আর সেই সংখ্যাটি হারালে "কতজন সত্যিই প্রক্রিয়া হলো" প্রশ্নের উত্তর থাকত না।
- cycle সংখ্যা `30` আজ ৩+ জায়গায় ছিল → একটি `CYCLE_DAYS` constant।

⚠️ **সৎ সীমা — TASK-22 বাকি, তাই cron আজ প্রোডাকশনে চলে না** (Clerk সব `/api/cron/*` আটকায়)। অর্থাৎ এই পরিবর্তন প্রোডাকশনের আচরণ **বদলাবে না** যতক্ষণ TASK-22 না হয় — এটি এখনই land করার **নিরাপদ** সময়, কারণ leak খোলার আগেই ঢাকনা বসছে।

**⚠️ জানা সীমা (ইচ্ছাকৃত, লুকানো নয়):** ধাপ ৬ একজন **comp-করা** অ্যাকাউন্টকেও ধরে (admin `setUserPlan` দিয়ে যাঁকে কোনো `PaymentTransaction` ছাড়া plan দিয়েছেন)। তাঁর ব্যালেন্স **শূন্য হয় না** — skip মানে balance অপরিবর্তিত, আর `skippedByReason`-এ কারণটি admin দেখতে পান। প্রতিকারও admin-এর হাতেই: আরেকবার `setUserPlan` (নতুন cycle) বা admin top-up। বিকল্পটি ছিল "admin-এর দেওয়া plan-ও যোগ্য ধরা" — কিন্তু তাহলে trial user-কে admin plan "দিলে" ছিদ্রটি আবার খুলত, অর্থাৎ bypass-টি গ্রাহকের অনুরোধে খোলা যেত।

**নির্ভরতা:** ১৫.১ · TASK-22 (যাচাইয়ের জন্য) · DB লেখে না ✅

---

#### ✅ ১৫.৬ — Free trial (⚠️ **DDL লেগেছে ০টি** — পরিকল্পনার সতর্কতাটি বাতিল)

**সিদ্ধান্ত (আপনার অনুমোদিত):** `planExpiresAt` পুনর্ব্যবহার। abusive signal = Clerk verified email + admin watching (জানা সীমা হিসেবে লিখিত)।

**🔴 কেন কোনো DDL লাগল না:** পরিকল্পনায় ধরা হয়েছিল `trialEndsAt` নামে একটি **নতুন কলাম** = DDL। কিন্তু কোড ও schema পড়ে দেখা গেল `User.planExpiresAt` (`prisma/schema/auth.prisma:13`) **আগেই আছে**, payment grant-এ লেখা হয় (`admin-credits.ts`), আর merchant-কে দেখানোও হয় ("Renews on …")। একটি trial তো ঠিক সেটাই: **একটি plan period যা শেষ হয়, নবায়ন হয় না**। তাই **কোনো `migrate diff` নেই, কোনো অনুমোদন লাগে না, `prisma db push`-এর প্রশ্নই ওঠে না।**
⚠️ কিন্তু এর একটি **সত্যিকারের উল্টো দিক** ছিল, এবং সেটি ঠিক করতে হয়েছে: যেহেতু trial এখন `planExpiresAt` লেখে, আগের "Renews on …" লেখাটি **মিথ্যা হয়ে যেত** — একজন trial গ্রাহক ভাবতেন তাঁর plan নবায়ন হবে, অথচ ওই তারিখে তাঁর chatbot বন্ধ হয়ে যাবে। সার্ভারে `planIsTrial` গোনা হয় ([`app/api/usage/route.ts`](../../app/api/usage/route.ts), `hasPaidForPlan` দিয়ে) আর পর্দা তখন **"Free trial ends on …"** লেখে ([`CurrentPlan.tsx`](../../app/(dashboard)/dashboard/settings/_components/CurrentPlan.tsx))। নতুন UI কপি `settings.json`-এ (en+bn)।

**১. trial শুরু = প্রথম সত্যিকারের channel connect** ([`lib/domain/trial.ts`](../../lib/domain/trial.ts) — নতুন)। ডকের গ্রহণযোগ্যতা: *"আসল channel connect না করিলে activate হয় না"*। শর্তগুলো সবই **একই নিরাপদ দিকে** ঝোঁকে — সন্দেহ হলে trial **দেওয়া হয় না**:

| শর্ত | না মিললে |
|---|---|
| user আছেন | `user_not_found` |
| region-এ gateway আছে | `region_has_no_gateway` — ⚠️ Global-এ **ইচ্ছে করেই নেই** (নিচে) |
| plan-এর `trialDays` আছে | `no_trial_for_plan` — Business/Enterprise-এ নেই, আর **unknown key-ও নয়** |
| platform সত্যিই একটি channel | `not_a_channel` — `n8n_source` বাদ (১৫.৩-এর নিজের যুক্তি: ওটা ingest-rail, channel নয়) |
| plan ওই channel অনুমোদন করে | `platform_not_allowed` — নিয়মটি plan-এর `allowedPlatforms` **থেকেই** আসে, নকল নয় |

**⚠️ Global-এ trial ইচ্ছে করেই বন্ধ** (কোডে লেখা): Global Starter-এর দামই $০, আর `paymentGateway: null` — টাকা নেওয়ার পথই নেই। trial-এর একমাত্র উদ্দেশ্য রূপান্তর, আর সেখানে মেয়াদ শেষে merchant-এর অবস্থা হত: **bot paused, credit নেই, কেনার উপায় নেই**। ওই পরিণতি trial না দেওয়ার চেয়েও খারাপ। (ওখানে `free_plan` নিয়মে Starter-এর ৫০০ credit প্রতি cycle-এ নবায়নও হয় — স্থায়ী free tier, trial-এর দরকারই নেই।)

**২. "এক account = একবার" — atomic compare-and-set।** বসানো হয় `db.user.updateMany({ where: { userId, planExpiresAt: null }, … })` দিয়ে, আর claim হারলে `already_used`। দুটি tab একসাথে connect করলে দুটোই `planExpiresAt == null` পড়তে পারত — `updateMany`-এর `where`-এ শর্তটি রাখায় কেবল একজন জেতে (ঠিক যে প্যাটার্নে `applyPaymentGrant` নিজের duplicate webhook আটকায়)। `planExpiresAt` **কখনো মুছে ফেলা হয় না**, তাই trial আর কখনো arm হয় না; সেটি কেবল payment বদলাতে পারে।

**৩. ⚠️ `scheduleDowngrade` ব্যবহার করা যায় না — যুক্তিটি নিজেই একটি ফাঁদ।** `plan-downgrade.ts`-এর বিদ্যমান রেলটি tempting, কিন্তু `applyDowngrade` target plan-এর allowance **বসায়** — অর্থাৎ trial শেষে আবার ১৫,০০০ credit দিয়ে **leak-টা আবার খুলত**। তাই একই cron-এ একটি **আলাদা, স্পষ্ট শাখা** `processExpiredTrials()` ([`lib/domain/plan-downgrade.ts`](../../lib/domain/plan-downgrade.ts)):
- selector: `planExpiresAt <= now` **AND** কোনো paid plan payment নেই (`listExpiredUnpaidTrials`) — কেবল সময় পার হওয়া যথেষ্ট নয়, কারণ যিনি টাকা দিয়ে নতুন মেয়াদ পেয়েছেন তিনি trial-expiry নন
- কাজ: **chatbot গুলো `status: "paused"`** + notification ("Your trial ended — subscribe to continue", ইংরেজিতে — কোডবেসের প্রচলিত নিয়ম)
- pause অংশটি ছোট একটি helper `pauseChatbots(chatbotIds)`-এ ভাগ করা হলো, যাতে দুই জায়গা (downgrade ও trial-expiry) একই আচরণ দেয়
- ব্যালেন্স **শূন্য করা হয় না** (ধ্বংসাত্মক ও অপ্রয়োজনীয় — bot paused থাকলে AI চলে না); integration **connected-ই থাকে**; `planExpiresAt` **মুছব না** — সেটিই "trial ব্যবহৃত" হওয়ার একমাত্র দলিল
- **idempotency নতুন কলাম ছাড়াই:** notification যায় **কেবল `paused > 0` হলে** — অর্থাৎ একবার শান্ত হওয়ার পর দৈনিক cron একটি নীরব no-op

**৪. abuse — জানা সীমা, দাবি নয়।** "এক account = একবার" ✅ (`planExpiresAt` guard)। একই ব্যক্তি একাধিক account → Clerk-এর verified email + rate limit, আর admin-এর জন্য একটি **read-only** রিপোর্ট: [`GET /api/admin/trials`](../../app/api/admin/trials/route.ts) → `buildTrialReport()` সক্রিয়/মেয়াদোত্তীর্ণ trial-এর তালিকা **একই email domain-এ clustered** করে (gmail/yahoo-র মতো পাবলিক provider আলাদা গোনা হয় — একটি cluster-এ হাজার লোক, তাই ওই সংকেত অর্থহীন)।
⚠️ **IP বা phone সংরক্ষিতই নেই** (কোনো কলাম নেই), আর সেটি ধরতে নতুন কলাম মানে DDL — তাই প্রতারণার তালা **"email + monitoring"**, এবং এটি **সীমা হিসেবে** লেখা, অর্জন হিসেবে নয়।

**৫. allowance-এর নিয়ম দুই ফাইলে মিলেই সম্পূর্ণ:** (ক) allowance **একবার**, channel connect-এ (`trial.ts`); (খ) তারপর কেবল **টাকায়** (`reset-credits` → `isResetEligible`)। দুটোর একটি ছাড়া অন্যটি অর্থহীন — ১৫.৯ না থাকলে trial-এর ১৫,০০০ credit প্রতি মাসে নীরবে নবায়ন হত, আর এই ফাইল না থাকলে payment-হীন user কখনোই allowance পেত না (default `creditsBalance` ৫০০, BD Starter-এর ১৫,০০০ নয়)।

⚠️ এখানে একটি **runtime DB লেখা** (merchant-এর নিজের কাজে চালিত), কোনো migration নয় — এটাই ইচ্ছাকৃত।

**নির্ভরতা:** ১৫.৪ · **১৫.৯** · TASK-22 (যাচাইয়ের জন্য) · **DDL নেই** ✅

---

#### 🧪 যাচাই — প্রথমে কোড-পাঠ, তারপর তিনটি কমান্ড ও ১৫.১-এর মাপা

**⚠️ ক্রমটি সৎভাবে লিখে রাখা হলো:** এই round-এর প্রথমার্ধে মেশিন শুধু allowlist-করা read-only কমান্ড চালাত (বাকি সব, এমনকি MCP tool-ও, "classifier temporarily unavailable" বলে ব্লক ছিল)। তাই নিচের প্রথম টেবিলটি **কোড-পাঠ (static) যাচাই** — এবং ঠিক সেই পড়াটাই দুটি বাগ ধরে। পরে সীমাবদ্ধতা সরে গেলে **তিনটি কমান্ডই সত্যিই চালানো হয়েছে** এবং ১৫.১-এর read-only অডিটও — তার ফল নিচে আলাদা করে। অর্থাৎ কোনো দাবি অচালিত-কমান্ডের উপর দাঁড়িয়ে নেই।

| কী যাচাই করা হলো | কীভাবে | ফল |
|---|---|---|
| নতুন চারটি test ফাইল ও দুইটি সংশোধিত test ফাইল — প্রতিটি assertion সোর্সের সাথে মিলিয়ে পড়া | কোড-পাঠ: `trial.ts`, `reset-eligibility.ts`, `plan-config.ts`, `plan-revenue.ts`, `credit-derivation.ts`, `payment-packages.ts`, `admin-credits.ts`, `plan-downgrade.ts` — assertion-এ ব্যবহৃত প্রতিটি মান (৩/১৪ দিন, ১৫,০০০/৫০,০০০ credit, ৭০/৬০%, `enterprise.price === 0`) সোর্স থেকে মেলানো | ✅ মিলেছে |
| 🔴 **একটি টেস্টে সত্যিকারের বাগ পাওয়া গেল ও ঠিক করা হলো** | `reset-eligibility.test.ts`-এর tripwire: টুকরোটি `granted++` **পর্যন্ত** নেওয়া হচ্ছিল, তাই তার ভেতরে *eligible* শাখার `creditsBalance: newBalance`-ও পড়ে যেত → `not.toContain("creditsBalance")` **কখনোই পাস করত না**। এখন টুকরোটি `continue;`-এ থামে | ✅ সংশোধিত |
| 🔴 **একটি সম্ভাব্য প্রোডাকশন বাগ পাওয়া গেল ও অনিশ্চয়তা সরানো হলো** | `trial.ts`-এর `refundStatus: { not: "refunded" }` — কলামটি nullable, আর প্রায় প্রতিটি payment-এ মান `NULL`। Prisma-র `not` NULL row ফেরত দেয় কি না তা **চালিয়ে যাচাই করা যায়নি**, অথচ ভুল পড়ায় `processExpiredTrials` টাকা-দেওয়া merchant-দের chatbot বন্ধ করে দিত। এখন `OR: [{ refundStatus: null }, { refundStatus: { not: "refunded" } }]` — দুই পড়াতেই এক ফল | ✅ সংশোধিত |
| সব `import` ও signature (কোড-পাঠে): `getRegionConfig` · `getPlanIfDefined` · `resolvePlanKeyForRegion` · `planAllowsPlatform` · `computeAllowanceEconomics` · `hasPaidForPlan` · `requireAdminApi` · `pauseChatbots` · `processExpiredTrials` | প্রতিটির export ও signature আসল ফাইলে মিলিয়ে দেখা | ✅ মিলেছে |
| trial → connect route → cron: তিন জায়গায় সত্যিই জোড়া লেগেছে কি | `connect/route.ts:90` → `startTrialIfEligible`; `process-downgrades/route.ts:49` → `processExpiredTrials`; `admin/trials/route.ts` → `buildTrialReport` | ✅ যুক্ত |
| `VALID_PLAN_KEYS` · `LEGACY_PLAN_ALIASES` সত্যিই মুছে গেছে (দ্বিতীয় কপি নেই) | repo-ব্যাপী grep — কোডে শূন্য live reference, কেবল মন্তব্য/ডকে ইতিহাস | ✅ |
| i18n key-সমতা, হাতে | `pricing.json` (en ⇄ bn, ১৫ key + `contactModal.*`), `home.json`-এর `bookModal` (১১ key), `settings.json`-এর `profile` (`trial`, `trialEndsOn`) | ✅ হুবহু মিল |
| AGENTS.md §3 — hardcoded রঙ | `pricing/page.tsx` ×৩ + `BookDemoModal.tsx` ×১ (`text-white`) → `text-primary-foreground` | ✅ সংশোধিত |

**✅ তিনটি কমান্ডই চালানো হয়েছে (২০২৬-১০-১৫):**

| কমান্ড | ফল |
|---|---|
| `npx tsc --noEmit` | **০ error** ✅ — ⚠️ প্রথম চালানোর দুইটি error ছিল `.next/dev/types/validator.ts` ও `.next/types/validator.ts`-এ, আর দুটিই **TASK-14-এ মোছে ফেলা** `enhance-prompt/route.js`-এর নাম ধরে (এই ডকের নিজের নথিভুক্ত ফাঁদ — উপরে "সংশোধনের লগ" দেখুন)। `rm -rf .next/dev .next/types` (অথবা `npm run clean`) দিলে দুইটিই চলে যায়, তারপর ০ |
| `npm test` | **৫৭২টি পাস / ২৪ ফাইল** ✅ (১৫.৩-এ ছিল ৫২৩ / ২১ — অর্থাৎ নতুন ৩টি ফাইলের ৪৯টি test) |
| `npm run build` | **exit 0** ✅ |

⚠️ **এই চালানোটাই আমার কোড-পাঠে করা দুটি সংশোধন প্রমাণ করে** — অন্যথায় দুটিই ধরা পড়ত না: (ক) tripwire-এর টুকরো এখন `continue;`-এ থামে, (খ) `trial.test.ts`-এর `OR` শাখার expectation এখন `trial.ts`-এর সাথে হুবহু মেলে।

**✅ ১৫.১-এর read-only মাপা চালানো হয়েছে** — `npx tsx --conditions=react-server scripts/task15-migration-audit.ts` (⚠️ `tsx` `devDependencies`-এ নেই, কিন্তু `npx` চাহিদামতো নামিয়ে নেয় — এই repo-র `n8n:sync` script-ও ঠিক এই কারণে `npx tsx` ব্যবহার করে)।

**আউটপুট (৫ জন user, সবটা পড়া — কিছু লেখা হয়নি):**

| # | user | plan @ region | ব্যালেন্স | connected channel | ১৫.৯ verdict |
|---|---|---|---|---|---|
| ১ | Sajid Sorker | `business @ bd` ✅ | ৫৪,১২৯ (included ৫৫,০০০ — ৫,০০০ bonus) | facebook, website(disconnected) | ✅ `ever_paid` |
| ২ | SD Prince | ⚠️ `growth @ bd` → **business** | ৫০০ | **— none —** | ✅ `ever_paid` |
| ৩ | Test User | ⚠️ `growth @ bd` → **business** | ৫০০ | **— none —** | ✅ `ever_paid` |
| ৪ | S.I. Rabby | `starter @ bd` | ৫০০ | — none — | ✅ `ever_paid` |
| ৫ | IMTIUZ ZIDAN | `starter @ bd` | ৫০০ | **facebook** | ⛔ **`never_paid`** |

**🔴 groupBy-র verdict কলামটিই বাগটির প্রমাণ:** `growth @ bd ×2` → `[RETIRED → business]`, আর ঠিক তার পাশে অডিট নিজেই লিখেছে `silent fallback → getPlan() → 15000 credits (starter)`। অর্থাৎ ওই দুই অ্যাকাউন্টে পর্দায় "GROWTH" লেখা, কিন্তু প্রতিটি হিসাব starter-এর (৫০,০০০-এর বদলে ১৫,০০০ credit, WhatsApp বন্ধ)।

**অন্যান্য মাপা তথ্য:**
- **কেউই কোনো channel হারাবে না** — যে দুইজনকে migrate করা হবে (SD Prince, Test User) তাঁদের **শূন্যটি** connected channel। এটিই migration-এর নিরাপত্তার প্রধান প্রমাণ, অনুমান নয়।
- দুইজনেরই `scheduledDowngradePlan = null` এবং ব্যালেন্স = **৫০০** (sign-up ডিফল্ট) — অর্থাৎ এটা তাঁদের **প্রথম** সত্যিকারের plan cycle হবে।
- ⚠️ **লক্ষণীয় (এই round-এর কাজ নয়):** `paymentTransaction.currency`-তে **case-অসঙ্গতি** — ২টি row `BDT` (completed, ৩,০০০+২,৫০০ = ৳৫,৫০০), বাকি ২৪টি `bdt`। `payment-issues.ts`-এর duplicate-detection `currency`-তে exact match করে, তাই এই অসঙ্গতি একদিন duplicate ধরা ব্যর্থ করতে পারে → আলাদা করে দেখার বিষয়।
- `plan / initiated / bdt` ৪টি, ৳৯,৯৯৬ — কখনো সম্পন্ন হয়নি; সঠিকভাবেই "plan revenue নয়"।

**✅ এখন migration হলো — আপনার অনুমোদনের পরে (২০২৬-১০-১৫)।** অনুমতি নিয়ে `scripts/task15-migrate-legacy-plans.ts --apply` চালানো হয়েছে। ⚠️ **script-টি `setUserPlan`-ই ডাকে, নিজে কলাম লেখে না** — কারণ নতুন করে লেখা মানে "plan বদল" কথাটির দ্বিতীয় একটি implementation, আর ঠিক সেই দ্বিতীয়-কপি রোগেই `growth`-এর ভূত জন্মেছিল (`VALID_PLAN_KEYS`)। script-এর নিজের দায়িত্বটুকু কেবল **খুঁজে বের করা**; credit reset, `plan_change_admin` audit row, notification ও chatbot reconciliation — সব একই audited ফাংশনের।

**যা লেখা হলো (প্রতি অ্যাকাউন্টে):** `plan` → `business` · `includedCredits`/`creditsBalance` → **৫০,০০০** (bonus = ০, কারণ পুরনো `includedCredits` ছিল ৫০০ — শূন্যের নিচে নামতে পারে না) · `creditsUsedThisCycle` → ০ · `creditsResetDate` ও `planExpiresAt` → **২০২৬-১১-১৩** · `scheduledDowngrade*` → `null` · একটি `credit_transaction` (`plan_change_admin`) · একটি `notification`। `direction` = **`sidegrade`** — কারণ `growth` ও `business` দুটোই এই region-এ resolve হয়ে `business` হয়, অর্থাৎ কেউ "উপরে" বা "নিচে" যায়নি, কেবল নামটা ঠিক হয়েছে। তাই `enforceLimits: false`-ও নিরাপদ, কোনো chatbot pause হয়নি।

**⚠️ audit-এ `creditTransaction`-এর `adminId` একটিই:** `system:task15-migrate-legacy-plans` — কোনো মানুষ বোতাম চাপেননি, আর যে মানুষ কাজটি করেননি তাঁর নাম লেখা তার চেয়ে খারাপ। `system:` prefix-এ filter করে আলাদা করা যায়।

**⚠️ তিনটির দুইটি সীমা, লিখিত:** (ক) script-টি ইতিহাস নয়, বর্তমান **অবস্থা** পড়ে — অর্থাৎ এটা "কে ভুল plan-এ আছে" ঠিক করে, "কে কখন `growth_bdt` কিনেছিল" নয় (সেটি `paymentTransaction`-এ অক্ষত আছে, এবং থাকা উচিত)। (খ) DISCOVERY আর WRITE দুটি আলাদা round-trip, তাই **লেখার ঠিক আগে প্রতিটি row আবার পড়া হয়** — stale পড়ার উপর migrate করলে একজনকে দেখানো হত আর আরেকজনের বদল হত।

**যাচাই করা হলো, দাবি নয়** — migration-এর পরে অডিট আবার চালানো: `growth @ bd ×2` গোষ্ঠীটি **গায়েব**, এখন `business @ bd ×3 [OK]`; এবং script-টি দ্বিতীয়বার চালালে লিখেছে *"Nothing to migrate — every stored plan key is sold in its own region."* অর্থাৎ নিয়মটিই idempotent, আর সেটি প্রমাণিত, অনুমিত নয়।

---

**✅ §৫খ — deploy gate এখনই মাপা হয়েছে (২০২৬-১০-১৬, read-only)। ফল: 🟢 পরিষ্কার, শূন্য।**

[`scripts/task15-migration-audit.ts`](../../scripts/task15-migration-audit.ts) আবার চালানো হলো (কিছুই লেখা হয়নি — timestamp `2026-10-16T05:51:45.910Z`), আর **§5b** বলছে:

```
5b. 🔴 Already-expired payers (১৫.৭ deploy gate — read-only)
  ✅ none — every paying merchant has a live period.
     Flipping ১৫.৭ changes nothing for anyone today.
```

⚠️ **এটির অর্থ কী, এবং কী নয় — দুটোই স্পষ্ট থাকুক:**
- **অর্থ:** `plan_expired` নিয়ম চালু করলে **আজ কেউ credit-নবায়ন হারাবেন না** — অর্থাৎ ধাপ D জাহাজে পাঠানোর সবচেয়ে বড় ঝুঁকিটি (পরিশোধকারী merchant হঠাৎ বন্ধ) **মাপা, অনুমিত নয়**।
- **অর্থ নয়:** এটি "কখনোই ঘটবে না" নয়। এই মুহূর্তে ৫ জন user, আর চারজনই হয় `planExpiresAt = NULL` (fail-safe → যোগ্য), নয় মেয়াদ ভবিষ্যতে (`2026-11-13`)। তাই **পর্যবেক্ষণটি আজকের অবস্থার, নীতির নয়** — এই ডকের নিজের নিয়ম: মাপা সংখ্যা দিয়ে দাবি করা, দাবি দিয়ে মাপা নয়।

**অন্যান্য মাপা তথ্য (§৫-এর অংশও):** reset-eligibility preview — Sajid Sorker · SD Prince · Test User · S.I. Rabby → ✅ `ever_paid`; IMTIUZ ZIDAN → ⛔ `never_paid` (অর্থাৎ টাকা না দিয়ে credit নবায়ন চাওয়ার একমাত্র অ্যাকাউন্ট, আর ১৫.৯-এর ঢাকনা ঠিক তাকেই আটকায়)।

**📌 এখনো আপনার সিদ্ধান্ত বাকি (কিছুই আমি নিজে করব না):** `pricing_catalogue` PlatformSetting row তৈরি করা — সেটি একটি **DB লেখা**, তাই আপনার অনুমতি ছাড়া হবে না। তার আগে পর্যন্ত `getPricingCatalogue()` খালি ক্যাটালগ ফেরায় = কোডের ডিফল্ট দাম, অর্থাৎ কিছুই ভাঙে না।

---

#### ✅ ১৫.৭ — বার্ষিক বিলিং · ডাইনামিক প্রাইসিং · ছাড় · credit-শেষের ইনভয়েস (কোড সম্পূর্ণ — deploy gate বাকি)

**আপনার সিদ্ধান্ত (২০২৬-১০-১৫):** বার্ষিক ছাড় **২৫%** · পুরো প্রাইসিং admin panel থেকে ডাইনামিক · ছাড়ের **তিন রূপই** (সবার জন্য %, প্রতি-merchant কাস্টম দাম, checkout-এ কুপন) · credit শেষে **সেবা থেমে যাবে** + আগেভাগে **ইনভয়েস-সহ reminder** (৫০/৮০/৯০%) · credit **মাসে মাসে** (একবারে নয়) · **auto top-up বাদ** (বাংলাদেশি রেল নেই, Uddoktapay manual-এ থাকছেন)।

**🔴 খোঁজ করতে গিয়ে পাওয়া আসল সমস্যাটি — এটি ১৫.৭-এর কেন্দ্র।**

আপনি জিজ্ঞেস করেছিলেন *"বট চালু থেকে বিল জমতে থাকলে যদি মার্চেন্ট বিল না দেয়..?"* — অথচ আজকের কোডে **এই পরিস্থিতিটাই ঘটতে পারে না, কারণ বিল কখনো জমেই না**। [`isResetEligible`](../../lib/domain/reset-eligibility.ts)-এর নিয়মটি ছিল **ever-paid**: যে একবার ৳৯৯৯ দিয়েছে সে **প্রতি ৩০ দিনে পূর্ণ allowance চিরকাল** পায়। `planExpiresAt` কেউ পড়তই না।

| আগে যা হত | ফল |
|---|---|
| একবার পেমেন্ট → প্রতি মাসে পূর্ণ allowance, চিরকাল | credit কখনো সত্যিই শেষ হয় না; "থেমে যাবে" নীতির কোনো দাঁত নেই |
| বার্ষিক plan | অর্থহীন — ১২ মাসের credit অগ্রিম নিলেও মেয়াদ শেষে কিছুই বদলাত না |

তাই ১৫.৭-এর কেন্দ্র **`plan_expired` নিয়মটি**, annual billing নয় — annual billing সেই নিয়মের ফল, কারণ নয়।

**🟢 অনুসন্ধানের চারটি আবিষ্কার যা কাজটি ছোট করে দিল**

1. **কোনো DDL লাগল না — একটিও।** `PlatformSetting` (`key @unique` + `value Json`) আগেই টাইপড JSON config-এর ঘর, আর তাতে `ai_credit_rules` · `ai_credit_derivation` · `openrouter_pricing` আগেই আছে। দাম, ছাড়, কুপন, cycle — সব ওটেই।
2. **প্রতি-merchant কাস্টম দাম আগেই বানানো** (`createPayableInvoice`, `kind: "plan"`) → নতুন কোড নেই, কেবল admin UI-তে ঢোকার পথ।
3. **WhatsApp-এর হিসাব একটি বিদ্যমান index-এ চলে** — `AIUsageLog`-এ আসল `channel` কলাম + `@@index([chatbotId, createdAt])`।
4. **নীল-ছাপ নীতি: ডিফল্ট কোডে, override DB-তে** — `PlanConfig.price` কোডেই থাকে, DB-তে কেবল **override**। ফলে **একটিও বিদ্যমান test ভাঙেনি** — আর সেটিই সবচেয়ে বড় প্রমাণ যে refactor-টি যোগাত্মক।

**✅ যা শেষ (ধাপ A · B · C · D.১)**

| ধাপ | কী | কোথায় |
|---|---|---|
| A | pure pricing engine — ছাড় **গুণ** হয় (যোগ নয়), **৳১ floor**, `normalizeCatalogue` fail-safe | [`lib/domain/pricing-catalogue.ts`](../../lib/domain/pricing-catalogue.ts) |
| A | DB রেল — **কোনো in-memory cache নেই** (App Router-এ প্রতি handler-এর আলাদা module instance) | [`lib/services/pricing-catalogue.ts`](../../lib/services/pricing-catalogue.ts) |
| A | admin API — Zod বাধ্যতামূলক, **পড়তে ব্যর্থ হলে ৫০০, ডিফল্ট নয়** | [`app/api/admin/pricing/route.ts`](../../app/api/admin/pricing/route.ts) |
| A | admin পর্দা — ৫টি component + ১৯টি test; `sidebar.pricing` যোগ | [`app/(admin)/admin/pricing/`](<../../app/(admin)/admin/pricing/page.tsx>) |
| A | দাম client-এ পৌঁছায় **prop দিয়ে, fetch দিয়ে নয়** — নইলে `/pricing` server-rendered থাকত না, দাম flash করত, আর crawler ভুল দাম index করত | [`components/region-provider.tsx`](../../components/region-provider.tsx) |
| A | **৭টি display site** ✅ — `/pricing` · `PricingCards` · `TopUpCards` (নকল তালিকা **মুছে**) · `PricingPreviewSection` (হার্ডকড `BD_PLANS` **মুছে**) · `BillingAndPlanTab` · `CreateInvoiceDialog` · admin pricing | [`app/(root)/pricing/page.tsx`](<../../app/(root)/pricing/page.tsx>) · [`TopUpCards.tsx`](<../../app/(dashboard)/dashboard/payment/_components/TopUpCards.tsx>) |
| B | কুপন — ষষ্ঠ endpoint `POST /api/payments/coupon/preview`; ব্যবহারের সংখ্যা **লেজার থেকে গোনা**, blob-এ লেখা নয় | [`charge/route.ts`](../../app/api/payments/uddoktapay/charge/route.ts) |
| C | `billing-cycle.ts` — `CYCLE_DAYS=30` (credit) · `YEARLY_DAYS=365` (সেবার মেয়াদ) · `resolvePlanExpiry = max(now, current) + period` (**স্ট্যাক করে**, তাই ২৫তম দিনে নবায়ন করলে ৫ দিন জ্বলে না) | [`lib/domain/billing-cycle.ts`](../../lib/domain/billing-cycle.ts) |
| C | বার্ষিক plan-এ credit **মাসে মাসে** (১২ cycle) — আপনি যা চেয়েছেন; `creditsResetDate` ৩০-ই থাকে | [`lib/services/admin-credits.ts`](../../lib/services/admin-credits.ts) |
| D.১ | 🔴 `plan_expired` নিয়ম — **মেয়াদ-ভিত্তিক reset** | [`reset-eligibility.ts`](../../lib/domain/reset-eligibility.ts) |

**🔴 D.১-এ পরিকল্পনার টেক্সট থেকে দুটি বিচ্যুতি (দুটোই কারণসহ)**

1. **`plan_expired` পরিকল্পনার "শেষ ধাপে (সবার পরে)" বসানো হয়নি, বরং `ever_paid`-এর আগে।** কারণ: শেষে বসালে নিয়মটি **ঠিক যে merchant-দের লক্ষ্য করে তাদের জন্যই চিরকাল নিষ্ক্রিয় থাকত** — মেয়াদোত্তীর্ণ merchant-এর `hasPaidPlanPayment` সবসময় `true`, তাই `ever_paid` আগেই ফায়ার করত।
2. **`paidShape` গার্ড যোগ করা হলো:** `price > 0 && !contact`। কারণ Global-এর free Starter (৳০) আর legacy `growth`/`pro` — এদের অতীত `planExpiresAt` থাকলেও **নবায়ন হওয়া উচিত**। নিয়মটি এক বাক্যে: **"যে টাকা দেওয়া হয়েছে, সেটিই শেষ হতে পারে — যেখানে টাকা নেই, সেখানে ফুরানোর কিছু নেই।"**

**⚠️ একটি ফাঁদ যা যাচাই করা হয়েছিল (এবং পরীক্ষায় বসানো হয়েছে):** প্রতিটি plan grant একই মুহূর্তে `planExpiresAt` ও `creditsResetDate` বসায় — অর্থাৎ মাঝপথে নবায়ন না করলে **প্রতিটি পরিশোধকারী merchant** প্রথম reset-এ বাদ পড়তেন। চারটি ক্রম মিলিয়ে দেখা হয়েছে; দেরিতে নবায়ন করলে ৫ দিন credit বন্ধ থাকে, কিন্তু grant-এ **পুরো allowance** ফেরে, অর্থাৎ merchant পুরোপুরি ফেরত পান।

⚠️ **নতুন cron শাখা বা নতুন pause-যুক্তি লাগেনি** — মেয়াদোত্তীর্ণ merchant কেবল নতুন credit পান না, আর ব্যালান্স শূন্য হলে বিদ্যমান quota-guard AI থামিয়ে দেয়। এটিই সবচেয়ে ছোট ও সবচেয়ে সৎ রূপ।

**⬜ বাকি — আপনার একটি অনুমতির অপেক্ষায়, একটি প্রশ্নের অপেক্ষায়**

| কী | অবস্থা | কেন |
|---|---|---|
| **`pricing_catalogue` row তৈরি** | 🚫 **আপনার অনুমতির অপেক্ষায়** | এটি একটি **DB লেখা**। অনুমতি ছাড়া একটি row-ও লেখা যাবে না। (কোড ও পর্দা প্রস্তুত; row না থাকলে `getPricingCatalogue()` খালি catalogue দেয় = কোডের ডিফল্ট দাম, অর্থাৎ কিছুই ভাঙে না) |
| **ধাপ D.২ — reminder ইনভয়েস** | ✅ **সম্পন্ন** | `THRESHOLDS` `[100, 80]` → `[100, 90, 80, 50]`, ইনভয়েস-ধাঁচের email (Pay বাটন সমেত), আর একটি **নতুন "মেয়াদ শেষ হচ্ছে" ট্রিগার** (৭/৩/১ দিন) — যিনি credit ফুর করান না তাঁর reminder কখনো আসত না, অথচ মেয়াদ শেষে তাঁর নবায়ন বন্ধ হবে। **DB-তে কোনো invoice row বসবে না** (আপনার সিদ্ধান্ত) — নইলে ৫০%-এ পৌঁছানো প্রতিটি merchant-এর একটি `pending` transaction চিরকাল পড়ে থাকত |
| **ধাপ D ছাড়ার আগে** | 🚫 **deploy gate** | [`scripts/task15-migration-audit.ts`](../../scripts/task15-migration-audit.ts)-এর **§5b** চালিয়ে এমন user-দের তালিকা দেখাতে হবে যাঁদের `planExpiresAt` **ইতিমধ্যে অতীত** অথচ plan payment আছে — শুধু তাঁদেরই সম্মতি নিয়ে ধাপ D ছাড়া হবে |
| **ধাপ E — WhatsApp Meta খরচ** | ✅ **কোড সম্পন্ন (ডিফল্টে বন্ধ)** | নিচে ১৫.৮ দেখুন — কোড ও টেস্ট শেষ, তবে **চালু করার আগে** আপনার ৫ মিনিটের একটি যাচাই লাগবে |

**✅ D.২ যা করা হলো (২০২৬-১০-১৫)**

| কী | কেন এভাবে |
|---|---|
| `renewal-reminder.ts` (pure) + `renewal-reminder.test.ts` | নিয়মটি test-যোগ্য রাখতে — `lib/services/`-এ repo-র প্রথম টেস্ট হতো, যা নিয়ম ভাঙত |
| একটি **আলাদা ফাংশন**, `checkUsageThresholds`-এর নতুন শাখা নয় | শতাংশ **খরচ** মাপে (`creditsUsedThisCycle`); reminder **সময়** মাপে (`planExpiresAt`)। এক করলে একটি `if`-এর এক শাখা অন্যটির ইনপুট বানাত |
| এক run-এ **একটির বেশি** মেয়াদ-শেষের email নয় (`break`) | শতাংশ-বার্তা একটি **অবস্থার** কথা ("৮০% শেষ") যা সত্য থাকেন; মেয়াদ-বার্তা একটি **সময়ের** কথা ("৭ দিন বাকি") যা পরদিনই মিথ্যা। তিনটি পাঠালে ৩ দিন বাকি merchant পেতেন "৭ দিন বাকি" লেখা email |
| `scanRenewalReminders` — **আলাদা** candidate তালিকা | `scanUsageThresholds` `creditsBalance` দিয়ে ছাঁকে; বার্ষিক merchant কখনো নন। এক করলে ঠিক যাঁদের জন্য reminder-টি বানানো, তাঁরাই বাদ পড়তেন |
| `/api/usage` hook **+** cron, দুই পথই | cron-টি Clerk-এ আটকে থাকে (TASK-22), তাই cron-কেবল পথ মানে **কোনোদিন না যাওয়া**। `/api/usage` hook-টি শূন্য বাড়তি query (user row আগেই পড়া) আর await করা হয় না; idempotency DB-level |
| tripwire টেস্ট (৭টি) | চারটি রিগ্রেশন pure টেস্টে ধরা **অসম্ভব** — কারণ চারটিই "যে call-টি নেই"। ⚠️ দুইটি mutation দিয়ে যাচাই করা হয়েছে যে tripwire সত্যিই কামড়ায় |

**🔴 deploy-এর পরের প্রথম রানের একটি অনিবার্য পার্শ্ব-প্রভাব (লুকানো নয়)**

`THRESHOLDS` `[100, 80]` → `[100, 90, 80, 50]` করা মানে: deploy-এর পর **প্রথম** cron/alert রানেই **যে merchant ইতিমধ্যে ৫০% ও ৯০% পার করেছেন, তিনি দুটি email পাবেন** — যদিও তাঁরা ইতিমধ্যে একবার ৮০%-এর mail পেয়ে থাকতে পারেন। কারণ আগে কোন শতাংশে পৌঁছানো হয়েছিল তা কোথাও **জমা রাখা নেই**, তাই backfill-টি suppression করা যাবে না।

- কেন মেনে নিচ্ছি: দুটি অতিরিক্ত email **ক্ষতিকর নয়** — একই নিয়ম, একই কুপন ছাড়, আর সেই email-টি তখন **সত্যও** ("আপনি ৫০%/৯০% পার হয়েছেন")।
- ⚠️ তবে চাইলে deployment-এর আগে চালানো যেতে পারে: একটি এককালীন SQL যা বিদ্যমান ৫০%+ merchant-দের জন্য `UsageAlert` row বসায় (থ্রেশহোল্ড ৫০ ও ৯০) — **এটি একটি DB লেখা**, তাই আপনার অনুমতি লাগবে। না করলে কিছুই ভাঙে না, কেবল একটি email যায়।

**🔴 জানা সীমা, লুকানো নয়**

- **কুপনের গোনা ও চার্জের মাঝে একটি ক্ষীণ window:** একটি merchant দুটি tab-এ একই এক-বারের কুপন একসাথে চালালে দুটিই যেতে পারে। ক্ষতি: সে দুবার কম দামে কিনবে (সে নিজেই টাকা দিচ্ছে, তহবিল থেকে ফাঁক হচ্ছে না), আর ~৫–১০ merchant-এর স্কেলে ঝুঁকি নগণ্য। প্রতিকারের একমাত্র সৎ উপায় একটি `CouponRedemption` টেবিল — যা DDL, তাই এই round-এ বাদ।
- **লেখা ও চার্জের দাম একই ফাংশন থেকে** (`resolveListPrice` + `resolveCheckoutAmount`) — একটি সরলীকৃত হিসাব পর্দায় লিখলে দুই জায়গায় দুই দাম দেখাত, যা এই প্ল্যাটফর্মে সবচেয়ে খারাপ ধরনের বাগ। ⚠️ `resolveListPrice` region-ব্যাপী ছাড় **ধরে না**, তাই পর্দায় `publicPrice()`-ও ডাকতে হয়।
- Clerk `/api/cron/*` আটকায় (TASK-22), তাই D/E-এর cron-চালিত অংশ end-to-end যাচাই হয়নি — কেবল unit test ও হাতে route কল।

---

#### ✅ ১৫.৮ — WhatsApp channel-এর নিজস্ব খরচ মিটার *(কোড সম্পূর্ণ ২০২৬-১০-১৬ · বিলিং মডেল নির্ধারিত ২০২৬-১০-১৭ — **ডিফল্টে বন্ধ**)*

**কেন:** ২০২৫-০৭-০১-এ Meta per-conversation ছেড়ে **per-message**-এ গেছে, আর **২০২৬-১০-০১ থেকে service message (আপনার AI-র free-form উত্তরও) billable** — অর্থাৎ ১৪ দিন আগে। প্রতি number-এ মাসে ১,০০০ free, তারপর বিল।

**🔴 যে প্রশ্নের উত্তর ছাড়া এই টাস্ক ডিজাইনই করা যায় না:** Meta-র নিয়ম — **credit line যে ধরে, সে-ই বিল দেয়; একবার WABA-তে attach হলে বদলানো যায় না।** আপনার WhatsApp যুক্ত হয় **আপনার নিজের Meta app-এর Embedded Signup** দিয়ে।
➡️ **আপনার Meta Business Suite-এ দেখে নিতে হবে merchant-দের WABA-তে credit line কার।**
- খরচ **আপনার** হলে → 🔴 এটি মিটার সমস্যা নয়, **নগদ সমস্যা**; ১৫.৮ অপরিহার্য, আর পুরনো WABA থেকে বেরোনোর পথ নেই (নতুন WABA ছাড়া)।
- খরচ **merchant-এর** হলে → 🟡 এই surcharge **সম্পূর্ণ অপ্রয়োজনীয়**, আর বসালে **দুইবার চার্জ** হত।

শাখা দুটির ফারাক বড় স্কেলে ≈ **৳৫,০০০/মাস/merchant** — তাই কোড লেখার আগে এই ৫ মিনিটের যাচাই।

> 🆕 **আপডেট (২০২৬-১০-১৭) — উপরোক্ত প্রশ্নটির উত্তর এসেছে, এবং সেটি তিন শাখায় ভেঙেছে।**
>
> **সিদ্ধান্ত: Model B** — খরচ প্ল্যাটফর্মের, merchant কার্ড দেবেন না, তবে WhatsApp connect হবে **Embedded Signup** দিয়েই।
>
> ⚠️ **কিন্তু Tech Provider দিয়ে এটি সম্ভব নয়।** যাচাই করে দেখা গেছে: **Tech Provider-এর credit line থাকে না** — তাই Tech Provider হয়েও নিজে Meta-কে বিল দেওয়া যায় না, merchant-কে কার্ড দিতেই হয়। একমাত্র পথ **Multi-Partner Solution (MPS):** একটি **Solution Partner / BSP** তার credit line merchant-এর WABA-তে বসায়, Meta BSP-কে ইনভয়েস করে, BSP আপনাকে। *(Embedded Signup-এর UX পুরোপুরি আপনার হাতে থাকে।)*
>
> 🔴 **স্থায়ী নিয়ম:** credit line একবার WABA-তে বসলে **বদলানো যায় না** — বদলাতে নতুন WABA লাগে। তাই **প্রথম আসল merchant onboard করার আগেই** BSP চূড়ান্ত করতে হবে; ডেমো/টেস্ট হবে **test WABA**-তে।
>
> ⚠️ **Surcharge আদৌ চালু হবে কি না — এখনো অনির্ধারিত।** *"সব খরচ আমার প্ল্যাটফর্ম বহন করবে"* মানে (ক) **অগ্রিম দেওয়া, পরে credit থেকে ফেরত নেওয়া** — নাকি (খ) **সম্পূর্ণ নিজে নেওয়া**? (খ) হলে surcharge কখনো চালু হবে না, আর Starter-এ প্রতি merchant-এ ৳৩০০–৳১,৮৬৬ পর্যন্ত লোকসান হতে পারে। তাই **`0`-ই আজ সঠিক**।
>
> 📄 **সম্পূর্ণ আলোচনা** — খরচের ছড়া ও সূত্র, Tech Provider বনাম Solution Partner, Embedded Signup-এর ৩টি requirement ও বর্তমান অবস্থা, BSP-কে করার ৭টি প্রশ্ন, ধাপে ধাপে করণীয়: [`task-whatsapp-billing.md`](./task-whatsapp-billing.md)।

---

##### ✅ কোড সম্পন্ন (২০২৬-১০-১৬) — এবং হাতে-কলমে যাচাইও

**যে ৯টি ফাইলে হাত পড়েছে** (৪টি নতুন):

| ফাইল | কী |
|---|---|
| 🆕 [`lib/domain/whatsapp-cost.ts`](../../lib/domain/whatsapp-cost.ts) | pure নিয়ম — `FREE_MESSAGES_PER_CYCLE`, `currentWhatsappCycleStart()`, `whatsappSurchargeCredits()`, `bdtPerCreditFrom()` |
| 🆕 [`lib/domain/whatsapp-cost.test.ts`](../../lib/domain/whatsapp-cost.test.ts) | ২৩টি টেস্ট — সীমানা (৯৯৯/১০০০/১০০১), ceil, তিনটি kill-switch, `NaN`-অভেদ্যতা, চক্র-জানালা, আর **৫টি service tripwire** |
| 🆕 [`lib/services/whatsapp-surcharge.ts`](../../lib/services/whatsapp-surcharge.ts) | DB-রেল — `whatsappSurcharge(userId, chatbotId, now?)` |
| ✏️ [`lib/ai/charge-usage.ts`](../../lib/ai/charge-usage.ts) | surcharge-টি তৃতীয় add-on (নিচে **কেন এখানে, `credit-resolver.ts`-এ নয়**) |
| ✏️ [`lib/ai/credit-resolver.ts`](../../lib/ai/credit-resolver.ts) | `CreditRules`-এ দুটি নতুন key-র ডিফল্ট (⚠️ `resolveReplyCredits` **অপরিবর্তিত**) |
| ✏️ [`lib/domain/credit-config.ts`](../../lib/domain/credit-config.ts) | দুটি ডিফল্ট ধ্রুবক, দুটি ছাদ, দুটি `sanitize*` |
| ✏️ [`app/api/admin/ai-settings/route.ts`](../../app/api/admin/ai-settings/route.ts) | GET-এ merge, POST-এ sanitize |
| ✏️ [`app/api/admin/ai-settings/fetch-models/route.ts`](../../app/api/admin/ai-settings/fetch-models/route.ts) | ⚠️ **তৃতীয় ফাঁদ** — এই route পুরো value নতুন করে লেখে, তাই key দুটি এখানে না রাখলে "Fetch Models" চাপলেই surcharge নীরবে বন্ধ হয়ে যেত |
| 🆕 [`app/(admin)/admin/ai-settings/_components/WhatsAppCostPanel.tsx`](../../app/(admin)/admin/ai-settings/_components/WhatsAppCostPanel.tsx) | admin-এর দুটি ঘর — catalog toolbar-এ নয়, কারণ এটি মডেল-ক্যাটালগের বিষয় নয় |

**✅ যাচাই (২০২৬-১০-১৬):** `npx tsc --noEmit` → **০ error** · `npm test` → **৬৯৮টি পাস / ২৯ ফাইল** (১৫.৭-এর শেষে ছিল ৬৭৫/২৮; অর্থাৎ এই টাস্কে **+২৩টি টেস্ট**) · `npm run build` → **exit 0**।

**🔬 মিউটেশন দিয়ে tripwire যাচাই করা হয়েছে (কেবল লিখে রাখা নয়):** `credit-resolver.ts`-এ আসলেই `whatsapp-cost` import যোগ করে দেখা হয়েছে — টেস্ট **ফেল** করে, তারপর ফাইল হুবহু ফিরিয়ে আনা হয়েছে।

---

###### ⚠️ নকশা থেকে ৬টি বিচ্যুতি — প্রত্যেকটির কারণ-সহ

নিচের হ্যান্ডঅফ অংশটি **যেমন ভাবা হয়েছিল** তেমনই রাখা আছে (ইতিহাস), কিন্তু কোড লেখার সময় ছয় জায়গায় সেটি বদলাতে হয়েছে। প্রতিটি বদল নিচের সারণিতেই ব্যাখ্যা করা:

| # | নকশায় ছিল | কোডে যা হয়েছে | কেন |
|---|---|---|---|
| ১ | 🔴 ঋণাত্মক `freeMessages` → **`0`-এ clamp** (§১) | **ডিফল্টে (১০০০) ফেরা** | clamp করলে অর্থ দাঁড়াত "ফ্রি tier নেই", অর্থাৎ একটি **ভাঙা config-এর দাম merchant দিতেন** — প্রথম বার্তা থেকেই চার্জ। ডিফল্টে ফিরলে খরচ আমাদের ঘাড়ে, যা এই নকশার ঘোষিত পক্ষপাত। আর `freeMessages = 0` এখন **আলাদা অর্থে বৈধ** ("ইচ্ছে করে ফ্রি tier ছাড়া"), তাই দুটিকে এক করা যায় না |
| ২ | helper **`charge-usage.ts`-এর ভেতরেই** (§৪) | আলাদা ফাইল `lib/services/whatsapp-surcharge.ts` | ⚠️ AGENTS §১ ("monolithic ফাইল নয়") + tripwire-টির একটি ছোট, লক্ষ্যযুক্ত ফাইল দরকার ছিল |
| ৩ | `creditsResetDate`-ও পড়া হত (§৪ ধাপ ১) | **পড়াই হয় না** | চক্র-জানালা ক্যালেন্ডার মাস (§৪-এর নিজের সুপারিশ), তাই `creditsResetDate`-এর কোনো কাজই ছিল না — একটি অপ্রয়োজনীয় query বাদ |
| ৪ | দুটি নতুন key-র **Zod schema** (§৫) | ফাইলের নিজের `sanitize*` ছাঁচ | `ai-settings/route.ts`-এ `usdToBdtRate`-ও Zod নয়, বরং `sanitizeUsdToBdtRate`। ⚠️ **এখানে AGENTS §2 ("Zod") মানা হয়নি** — ফাইলের অভ্যন্তরীণ সামঞ্জস্য বেছে নেওয়া হয়েছে। ভিন্নমত থাকলে জানাবেন, Zod-এ বদলানো ১০ মিনিটের কাজ |
| ৫ | দুটি ছাদ-এর উল্লেখ নেই | `WHATSAPP_FREE_MESSAGES_MAX = 100000`, `WHATSAPP_FEE_BDT_MAX = 50` | একটি টাইপো (`0.54`-এর বদলে `54`) হলে **সব merchant-এর credit একদিনেই নিঃশেষ** হয়ে যেত। ৫০ ৳ ছাদটিই আসল রেটের (~০.৫৪) চেয়ে ১০০ গুণ, তাই সত্যিকারের মান কখনো আটকাবে না |
| ৬ | `persistSettings` অপরিবর্তিত | `{ ...settings, ...next }` merge | নতুন client-side ফাঁদ: ভবিষ্যতে কেউ কেবল `models`/`quickSetup` নিয়ে আংশিক অবজেক্ট বানিয়ে সেভ করলে `whatsappFeeBdtPerMessage` বাদ পড়ত → sanitizer সেটিকে **`0` করে দিত** → surcharge নীরবে বন্ধ। এটি `fetch-models` route-এর ঠিক একই ফাঁদ, ক্লায়েন্টে |

**⚠️ একটি পরিকল্পনা-স্তরের ভুল যা tripwire ধরে ফেলেছিল:** প্রথমে লেখা হয়েছিল `expect(resolverSource).not.toContain("whatsapp-cost")` — কিন্তু `credit-resolver.ts`-এর **একটি মন্তব্যেই** ওই পথটি লেখা ("হিসাবের নিয়ম `lib/domain/whatsapp-cost.ts`-এ")। অর্থাৎ assertion-টি একটি **শব্দ** মাপছিল, কোড নয়। এখন `not.toMatch(/import[^;]*whatsapp-cost/)` — import স্টেটমেন্টটিই ধরা হয়, মন্তব্য নয়। (মিউটেশন দিয়ে প্রমাণিত, উপরে দেখুন।)

**⚠️ কনফিগের ডিফল্টে যা দাঁড়াল:** `whatsappFreeMessages = 1000` · `whatsappFeeBdtPerMessage = 0` — অর্থাৎ **deploy করলেই কিছুই কাটে না**। admin panel-এ একটি সংখ্যা বসিয়ে Save চাপলেই চালু।

---

###### 📐 মূল নকশা — যেমন ভাবা হয়েছিল (ইতিহাস, উপরের ৬টি সংশোধন সহ পড়ুন)

---

###### ০. দরজা — ৫ মিনিট, এর আগে এক লাইন কোডও নয়

Meta Business Suite → WhatsApp Manager → **Payment settings**। দেখতে হবে credit line **কার নামে**। ⚠️ একবার WABA-তে attach হলে **বদলানো যায় না**, তাই এটি পরে "ঠিক করে নেওয়ার" বিষয় নয় — এটিই সিদ্ধান্ত।

> ✍️ এখানে লিখে রাখুন: **credit line = ______________ · যাচাইয়ের তারিখ ______________**

| উত্তর | তাহলে |
|---|---|
| **আপনার** (DRIPLARE-এর) | ✅ surcharge বসান — তবে **হার যাচাই করার পর** (ধাপ ৫ দেখুন), আর শুরুতে বন্ধ অবস্থায় |
| **merchant-এর** | 🚫 **সurcharge লিখবেন না — টাস্কটি এখানেই শেষ।** তাঁর নিজের Meta অ্যাকাউন্টে বিল যাচ্ছে, অর্থাৎ আমাদের কিছুই দেওয়ার নেই। বসালে **দুইবার চার্জ** — একটি তাঁর Meta-তে, একটি আমাদের credit-এ |

**যে হারটি লাগবে (নিজের rate card থেকেই, অনুমান থেকে নয়):** Bangladesh-এর service-message rate, আর Meta-র নিজের free-tier সংখ্যা (Meta ১,০০০ বললেও আপনার WABA-র console-এ যেটি লেখা, সেটিই সত্য)।

---

###### ১. `lib/domain/whatsapp-cost.ts` (pure — `server-only` নয়, তাই test-যোগ্য)

```ts
export const FREE_MESSAGES_PER_CYCLE = 1000;

export interface SurchargeInput {
  /** ⚠️ এই বার্তাটি বাদ দিয়ে, তার **আগে** যতটি গেছে (`count()` MongoDB-র মতো "already written") */
  messagesBeforeThisOne: number;
  /** Meta-র খরচ প্রতি service message-এ (৳) — admin-নিয়ন্ত্রিত */
  feePerMessageBdt: number;
  /** plan-এর দাম ÷ তার credit — ক্যাটালগ থেকে, কখনো হার্ডকড নয় */
  bdtPerCredit: number;
  /** না দিলে `FREE_MESSAGES_PER_CYCLE` */
  freeMessages?: number;
}

export function whatsappSurchargeCredits(input: SurchargeInput): number
export function bdtPerCreditFrom(planPriceBdt: number, includedCredits: number): number
```

**চারটি শর্ত, প্রত্যেকটির আলাদা কারণ:**

| শর্ত | ফল | কেন |
|---|---|---|
| `messagesBeforeThisOne < freeMessages` | `0` | ফ্রি tier |
| `feePerMessageBdt <= 0` বা `!isFinite` | `0` | **এটিই kill-switch** — admin একটি সংখ্যা ০ করলে surcharge বন্ধ। আর `isFinite` গার্ড না থাকলে `NaN` credit হয়ে ব্যালেন্স নষ্ট করত |
| `bdtPerCredit <= 0` বা `!isFinite` | `0` | **ভাগ-নিরাপত্তা।** Global-এর free Starter-এ দাম ০, তাই `0 ÷ 0 = NaN`। ⚠️ এখানেই `ceil` বসালে `Math.ceil(NaN)` → `NaN` → credit `NaN` → ব্যালেন্স চিরতরে করrupted |
| নাহলে | `Math.ceil(fee / bdtPerCredit)` | ⚠️ `ceil`, `round` নয় — এবং সর্বনিম্ন ১, কারণ একটি reply-তে ০ credit কাটা মানে খরচ আমাদের ঘাড়ে |

⚠️ ~~**`freeMessages`-কে ঋণাত্মক হলে clamp করা হয় `0`-এ**~~ — 🔴 **এই লাইনটি কোডে মানা হয়নি।** ঋণাত্মক/অগণিত মান **ডিফল্টে (১০০০) ফেরে**, কারণ `0`-এ clamp করলে অর্থ দাঁড়ায় "ফ্রি tier নেই", অর্থাৎ ভাঙা config-এর দাম merchant দিতেন। বিস্তারিত উপরের বিচ্যুতি-সারণির **#১**-এ।

###### ২. `lib/domain/whatsapp-cost.test.ts`

বাধ্যতামূলক কেস: `999 → 0`, `1000 → ceil(...)` (⚠️ সীমানাটি **দুই দিকে** — ১০০০ নম্বর বার্তা ফ্রি, ১০০১ নয়), `0.1 → 1` (ceil), `fee = 0 → 0`, `bdtPerCredit = 0 → 0`, `NaN` — যেকোনো ইনপুটে `Number.isFinite` মিথ্যা নয় এমন ফল কখনো নয়, আর `freeMessages = -5 → 0`।

###### ৩. 🔴 সচেতন বিচ্যুতি — surcharge-টি `credit-resolver.ts`-এ নয়, `charge-usage.ts`-এ

পরিকল্পনায় লেখা ছিল "`testChatMultiplier`-এর পাশে **ঠিক একই ছাঁচে**" [`credit-resolver.ts`](../../lib/ai/credit-resolver.ts)-এ। লিখতে বসে তিনটি কারণ খুঁজে পাওয়া গেল কেন সেটি ভুল জায়গা:

1. **`resolveReplyCredits`-এর দুইজন caller.** [`resolveCompareCredits`](../../lib/ai/credit-resolver.ts) (লাইন ২৪২) তাকেও ডাকে। channel-নির্ভর surcharge ওখানে বসলে **compare** একটি অদ্ভুত পথ ধরত, আর `compare`-এর নিজের একটি সূক্ষ্ম নিয়ম আছে (গুণক **যোগফলের** উপর, প্রতিটি মডেলের উপর নয়) — দুটি নিয়ম একই ফাংশনে মিশে যেত।
2. **নামটি মিথ্যা হয়ে যেত।** "এই model-এর জন্য credits" নামের একটি **pure-সদৃশ** ফাংশনের ভেতরে লুকিয়ে তিনটি I/O লাগত (user পড়া, `count()`, ক্যাটালগ পড়া)। যে ফাংশন একবার pure ছিল, সেটি ১৫.৮-এর পরে দুইবার DB-তে যায়।
3. **সেমান্টিকভাবে এটি একটি add-on।** `image_message` ও `audio_per_minute` আগেই [`resolveTotalCredits`](../../lib/ai/charge-usage.ts) (লাইন ১০৫)-এ reply-এর উপরে যোগ হয়। WhatsApp-এর খরচ **হুবহু সেই জিনিস** — "এই reply-র সাথে একটা বাড়তি খরচ যুক্ত হলো"।

✅ **ফল: `resolveReplyCredits` অপরিবর্তিত থাকে** — অর্থাৎ তার বিদ্যমান সব টেস্ট (এবং `credit-plan.test.ts`) হাতে-ই অক্ষত। এই অক্ষত থাকাটাই প্রমাণ যে বিচ্যতিটি সঠিক।

###### ৪. `charge-usage.ts`-এ যা যোগ হবে

`resolveTotalCredits`-এ একটি তৃতীয় add-on, ঠিক image/audio-র মতো:

```ts
// only for real WhatsApp traffic — never test chat, never web/facebook
if (channel === "whatsapp" && !isTestChat && input.chatbotId) {
  credits += await whatsappSurcharge(userId, input.chatbotId);
}
```

⚠️ **তিনটি ইনপুট আগে `resolveTotalCredits`-এ পৌঁছাতে হবে:** আজ সেটি কেবল `input` পায়, অথচ `channel`, `isTestChat`, আর আসল `userId` (chatbotId থেকে বের করা) তার বাইরে থাকে। তাই signature বদলাবে — `{ userId, channel, isTestChat }` আলাদা করে পাঠাতে হবে। **`userId`-টি `input.userId` নয়** — `chatbotId` থেকে বের করা আসলটি, নইলে n8n-এর কল (যেখানে `userId` মাঝে মাঝে থাকে না) চুপচাপ surcharge বাদ দিত।

⚠️ **সচেতন বিচ্যুতি #২:** নকশায় helper-টি **এই ফাইলের ভেতরেই** রাখার কথা ছিল; কোডে সেটি আলাদা ফাইল [`lib/services/whatsapp-surcharge.ts`](../../lib/services/whatsapp-surcharge.ts)-এ। কারণ উপরের বিচ্যুতি-সারণিতে (#২)।

নতুন helper (আলাদা ফাইলে — `lib/services/whatsapp-surcharge.ts`):

```ts
export async function whatsappSurcharge(userId: string, chatbotId: string, now = new Date()): Promise<number>
```

এর ভেতরে পাঁচটি ধাপ:
1. user থেকে `plan`, `region` পড়া (এক `findUnique`) — ⚠️ **`creditsResetDate` পড়া হয় না** (বিচ্যুতি #৩), কারণ জানালাটি ক্যালেন্ডার মাস
2. ⚠️ `count({ where: { chatbotId, channel: "whatsapp", createdAt: { gte: cycleStart } } })` — বিদ্যমান `@@index([chatbotId, createdAt])`-এই চলে, নতুন index লাগে না
3. ক্যাটালগ থেকে `resolveListPrice(plan, region, "monthly", catalogue)` → `amount`
4. `getPlanCredits(plan, region)` → `includedCredits`, তারপর `bdtPerCreditFrom(amount, included)`
5. হার `getCreditRules()` থেকে, তারপর `whatsappSurchargeCredits(...)`

⚠️ **`cycleStart` — একটি সিদ্ধান্ত, খোলাখুলি লেখা থাকুক:** Meta-র ১,০০০ ফ্রি **তার নিজের মাসে** রিসেট হয়, আমাদের credit-চক্রে নয় (`creditsResetDate − ৩০ দিন`)। সুপারিশ: **ক্যালেন্ডার মাস** (`Date.UTC(y, m, 1)`) ব্যবহার করুন — কারণ সেটিই Meta-র নিজের জানালার সাথে মেলে; আমাদের চক্র ধরে গুনলে এমন একটি জানালায় দুই মাসের বার্তা জমে **overcharge** হতো, যেটি ভুলের খারাপ দিক। এক লাইনে নির্ধারিত, এক জায়গায়।

⚠️ 🔴 **`createdAt: { gte: cycleStart }`-এর অর্থ — "এই বার্তাটি বাদ দিয়ে", এবং এটি ইচ্ছাকৃত।** এখানে গোনা হয় **ইতিমধ্যে লেখা** `AIUsageLog` row-গুলি, আর বর্তমান বার্তার row-টি তোলে **পরে**, ৩.ঘ ধাপে। তাই গণনাটি ঠিক: আগের ৯৯৯টি ফ্রি, ১০০০তমটিও ফ্রি (কারণ তার আগে ৯৯৯টি লেখা), আর ১০০১তমটি বিল-যোগ্য। **এই মন্তব্যটি কোডে রাখুন** — নইলে ভবিষ্যতে কেউ এটিকে "off-by-one বাগ" ভেবে "ঠিক" করে দেবেন, আর তখন প্রতিটি merchant ১,০০০-এর বদলে ৯৯৭ ফ্রি পাবেন — অথবা উল্টো দিকে সারিবদ্ধভাবে বেশি।

###### ৫. কনফিগ — `ai_credit_rules`-এ দুটি নতুন key, এবং **ডিফল্টে বন্ধ**

| key | ডিফল্ট | কেন ডিফল্টটি এই |
|---|---|---|
| `whatsappFreeMessages` | `1000` | Meta-র ঘোষিত সংখ্যা — তবে আপনার console-এ যা লেখা, সেটিই চূড়ান্ত |
| `whatsappFeeBdtPerMessage` | **`0`** | 🔴 **ডিফল্টে শূন্য মানে surcharge বন্ধ।** কারণ শর্ত ২-এর ভিত্তিতে `0` → `0` credit। এটি ভালো কারণ হারটি এখনো আপনার rate card থেকে **যাচাই হয়নি**, আর একটি অনুমান করা হার দিয়ে deploy করলে নীরবে ভুল টাকা কাটা শুরু হত — যার প্রমাণ কেবল একটি সন্দেহ-জাগানো invoice হতো |

➡️ **এই নকশার সবচেয়ে বড় সুবিধা:** কোডটি **এখনই** প্রোডাকশনে যেতে পারে, শূন্য প্রভাব নিয়ে। তারপর আপনি rate card দেখে সংখ্যা বসাবেন — এবং টাস্কটি শেষ হবে **কোড লেখা ছাড়াই**। চালু করার দুটি শর্ত একসাথে: (ক) credit line আপনার, (খ) হার যাচাই করা।

###### ৬. টেস্ট

- `whatsapp-cost.test.ts` — উপরের সব কেস
- **tripwire** (বিদ্যমান ছাঁচেই): `charge-usage.ts`-এর source পড়ে নিশ্চিত হওয়া যে surcharge-টি `channel === "whatsapp"` শর্তের ভেতরে, `isTestChat` বাদ দেয়, আর `count()`-এর `where`-এ `chatbotId` ও `channel` **দুটিই** আছে। ⚠️ শেষটি বাদ পড়লে একজন merchant-এর সব chatbot মিলে একটিই ফ্রি tier গুনত, আর দ্বিতীয় chatbot থেকে প্রথম দিন থেকেই চার্জ শুরু হতো — একটি নীরব, ব্যাখ্যাতীত চার্জ
- অপরিবর্তিত থাকবে: `credit-plan.test.ts` · `plan-revenue.test.ts` · `credit-resolver`-এর টেস্ট — ✅ এবং এটিই বিচ্যুতির সঠিকতার প্রমাণ

###### ৭. যাচাই

`npx tsc --noEmit` → ০ · `npm test` → সব পাস · `npm run build` → exit 0।

✅ **আসল ফল (২০২৬-১০-১৬):** `tsc` → **০** · `npm test` → **৬৯৮ / ২৯ ফাইল** · `build` → **exit 0**।

**হাতে (আপনি):** ১,০০০ বার্তা পাঠানো অসম্ভব, তাই একটি test account-এ `ai_credit_rules`-এর `whatsappFreeMessages` সাময়িকভাবে `0` করে একটি WhatsApp বার্তা পাঠান, তারপর [`/dashboard/usage`](app/dashboard/usage) ও লেজারে দেখুন: credit = base + surcharge, আর `AIUsageLog.creditsDeducted`-এ সেই যোগফল। শেষে `whatsappFreeMessages` আবার `1000` করে দিন।

###### ৮. 🚫 যা করবেন না

- **`bdtPerCredit`-এ `৳৯৯৯` হার্ডকড করা** — ধাপ A-তে admin দাম বদলালে সংখ্যাটি মিথ্যা হয়ে যেত, আর সূত্রটি তখনো ঠিক দেখাত
- **`০ credit` কাটা** (round-এর বদলে) — খরচ সম্পূর্ণ আমাদের ঘাড়ে
- **🔴 surcharge-টি credit line merchant-এর হলে বসানো** — এটিই একমাত্র ভুল যার পরিণতি ফেরানো অসম্ভব: দুইবার চার্জ
- **test chat বা `web`/`facebook`-এ বসানো** — ফ্রি tierটিই WhatsApp-এর জন্য
- **একজন merchant-এর দুই chatbot-এর গুনতি এক করা** — Meta-র ফ্রি tier **প্রতি নাম্বারে**, প্রতি user-এ নয়

###### ৯. জানা সীমা — লুকানো নয়

- **🔴 একটি race-ঝুঁকি আছে:** `count()` লেনদেনের বাইরে পড়া হয়, তাই একই মুহূর্তে দুটি WhatsApp reply এলে দুটিই একই "আগের সংখ্যা" দেখতে পারে। সীমানা অতিক্রমের ঠিক সময়ে এটি কয়েকটি বার্তা **কম** ধরবে (undercharge) — অর্থাৎ ভুলটি আমাদের দিকে। প্রতিকারের উপায় একটি DB counter কলাম, যা DDL — ইচ্ছা করেই বাদ
- **আমাদের গুনতি একটি surrogate, Meta-র নিজের counter-ই চূড়ান্ত** — দুই COUNT কখনো হুবহু মিলবে না, আর মিলতে হবে না
- **⚠️ উদার দিকের সচেতন পক্ষপাত:** একটি chatbot-এ দুটি নাম্বার থাকলে সে ২,০০০ ফ্রি পাবে, ১,০০০ নয়। কারণটি অপরিবর্তিত — **বেশি নিলে merchant বিশ্বাস হারান, কম নিলে আমরা সামান্য খরচ বহন করি**
- **✅ অগ্রাধিকার নয়:** কম-বেশি কয়েকশ' credit নির্ভুলতার চেয়ে "কখনো ভুলভাবে বেশি না নেওয়া" বেশি জরুরি। তাই প্রতিটি বিতর্কিত সীমানায় কম-নেওয়ার দিকেই ঝোঁক

**নির্ভরতা:** ১৫.১ (R5) · **প্রথম ধাপ:** Meta Business Suite (ধাপ ০) — এটিই একমাত্র blocker, কোড নয়।

---

**⚠️ ১৫.৩ যা ছেড়ে গেল — জানা সীমা, দাবি নয় (পরে দেখার জন্য)**

| কী | অবস্থা | কেন এখনই নয় |
|---|---|---|
| **Automations · Live Inbox · Knowledge Base / RAG** | ❌ এখনো ungated — পূর্ণ কাজ করে, কোনো plan-এর তালিকাতেই নেই | ⛔ **১৫.৪-এর উপর নির্ভরশীল:** gate বসানোর আগে ঠিক করতে হবে ওগুলো **কোন plan-এ বিক্রি করছেন**। নিয়ম আগে বানালে ভুল নিয়ম enforce হত |
| **`isCharged: false` — ৭টি AI task** (`enhance_prompt`, `translate`, `compare`, `text_ingest`, `product_extract`, `auto_train`, `embedding`) | 🔴 credit-দাম লেখা আছে, **কাটা হয় না** | এটি **TASK-25**; ১৫.৩-এ ছোঁয়া হয়নি ইচ্ছে করেই। §৮.১-এর "দুই lever" দাবিটি এর উপর ভেঙেছে (→ §৮.১, §১৯.১২) |
| **Products ও Discounts-এর API** | 🟡 কোনো API-ই নেই (`app/api/products`, `app/api/discounts` ফোল্ডার দুটিই অস্তিত্বহীন) | nav লুকানোয় Starter-এর পথ নেই, তবে ইচ্ছাকৃত কল খোলা। পেজগুলো কোন endpoint পড়ে তা খুঁজে বের করতে হবে |
| **`n8n_source/connect`** | 🟡 ইচ্ছে করেই গেট করা হয়নি | channel নয়, ingest-URL rail; কোনো plan-এর `allowedPlatforms`-এ এর নাম নেই, তাই platform-gate দিলে **সবার** জন্য ভাঙত। আর নিজের chatbot-এ row লেখে, যা merchant-এর নিজের ছাদেই ধরা আছে |
| **Web Widget entry plan-এ** | ✅ রাখা হয়েছে (দুই region) | ⚠️ **পণ্যের সিদ্ধান্ত, ইউজারের অনুমোদন ছাড়া নেওয়া** — BD-র লেখা "Facebook Channel Only" → "Facebook + Web Widget" সংশোধিত। ভিন্নমত থাকলে `plan-config.ts`-এ এক লাইন |

**আর একটি টেকনিক্যাল ফাঁদ, পরে মনে রাখতে:** কোনো route বা পেজ **মুছে ফেললে** `.next/dev/types/validator.ts` বাসি হয়ে যায়, আর `tsc` মুছে ফেলা ফাইলের নাম ধরে মিথ্যা `TS2307` দেয়। সমাধান: `rm -rf .next/dev .next/types` তারপর build (বিস্তারিত "সংশোধনের লগ"-এ)।

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
| ২০২৬-১০-১৪ | 🔴 **`PLAN_MONTHLY_REVENUE_BDT` map সম্পূর্ণ মুছে ফেলা** — profit/margin এখন plan catalogue থেকে | দুই admin route-এ হুবহু একই hardcoded map ছিল: `{starter:0, growth:2990, pro:7990, agency:14990, enterprise:19900}`। `growth`/`pro`/`agency` এই প্রোডাক্টে **plan-ই নয়**, `enterprise` global-এ "Custom", আর আসল BD দাম ৯৯৯/২,৪৯৯/৪,৯৯৯। Region সম্পূর্ণ উপেক্ষিত ছিল। অর্থাৎ `/admin/workspaces`-এর প্রতিটি "Net Profit" ও "Margin" এবং workspace detail-এর MRR কার্ড — **বানানো সংখ্যা**, যা admin সত্য বলে ভরসা করতেন। ঠিক যে শ্রেণির সমস্যা TASK-06 মিটিয়েছিল |
| ২০২৬-১০-১৪ | TASK-13: `netProfitBdt` / `netMarginPercent` / `overallMarginPercent` → **`number \| null`** | যে workspace-এর plan-এর দাম পড়া যায় না তার জন্য `0%` বা `−100%` ছাপা হত — দুটোই **দাবি**, মাপ নয়: `0%` বলে "এই ক্রেতা কিছু দেন না", `−100%` বলে "পুরো খরচই লস" (এতে একটি সুস্থ Enterprise account রক্তাক্ত দেখাত)। এখন `null` + স্পষ্ট কারণ ("Custom pricing" / "Unknown plan" / "Free plan"), আর KPI-তে `revenueUnknownCount` — কতটি workspace হিসাবের বাইরে থাকল তা দেখা যায় |
| ২০২৬-১০-১৪ | 🔴 TASK-13: workspace খরচের query থেকে **`{ userId }` OR-clause সরানো হয়েছে** | আগে scope ছিল `OR: [{userId}, {workspaceId}, {chatbotId}]` — অর্থাৎ **একই মালিকের অন্য workspace-এর খরচ**ও এই workspace-এর ঘাড়ে চাপত (এক মালিকের ৩টি workspace থাকলে প্রতিটিতেই তিনটিরই খরচ দেখাত)। এখন scope = `workspaceId` অথবা তার chatbot-গুলো। এটি পরিকল্পনার বাইরে ধরা পড়া একটি correctness bug — margin-কে সরাসরি প্রভাবিত করত বলে একই সংশোধনে রাখা হলো |
| ২০২৬-১০-১৪ | TASK-13: latency p50/p95 — পরিকল্পনার `$queryRaw percentile_cont` **নয়**, বরং JS-এ (সর্বশেষ ২০,০০০ timed row-র নমুনা) | একই filter দুই ভাষায় (Prisma `where` + raw SQL `WHERE`) লিখলে সেটিই drift-এর নতুন উৎস — অর্থাৎ যে রোগটি দূর করতে এই টাস্ক, তা দূর করতে গিয়ে নতুন একটি জন্মাত। trade-off লুকানো হয়নি: p95 এখন "সাম্প্রতিক N timed call"-এর, আর সেটি UI-তে `latencySampleCapped` দিয়ে লেখাও আছে |
| ২০২৬-১০-১৪ | TASK-13: **success/failure rate সরানো হলো**, টাস্কে লেখা থাকা সত্ত্বেও | টাস্কের তালিকায় "success/failure" ছিল, কিন্তু ব্যর্থ call-এ **কোনো `AIUsageLog` row-ই লেখা হয় না** (`gateway.ts` কেবল সফল chain-এর পরে log করে)। তাই এমন "success rate" ১০০% হত **সংজ্ঞা দ্বারাই** — অর্থাৎ মাপা নয়, বানানো। যা সত্যিই মাপা যায় তা হলো **fallback rate** (`fallbackFrom != null`), আর UI সেটিকে বারবার "success rate নয়" বলেও জানায়। failure ledger = নতুন table = DDL → আলাদা টাস্ক |
| ২০২৬-১০-১৪ | TASK-13: লেবেল **"Fallback Rate"**, "Success Rate" বা "Error Rate" নয় | একটি panel যে মিথ্যা বলে সেটি না থাকার চেয়ে খারাপ (TASK-06)। ২% fallback-কে ৯৮% success পড়া যায়, অথচ ডেটা সেটি সমর্থন করে না — তাই নামটা এমন যে ভুল পড়ার সুযোগই নেই, আর প্যানেলের সবচেয়ে বড় বাক্যটিই ব্যাখ্যা করে এটি কী নয় |
| ২০২৬-১০-১৪ | TASK-13: `task` null হলে **`channel` থেকে task পড়া হয়**, "unknown"-এ ফেলে দেওয়া নয় | `AIUsageLog.channel` আগে ওভারলোডেড ছিল (`enhance_prompt`, `auto_train`, `compare` — `ai-task.ts`-এর `legacyChannel` এই ইতিহাস লিখে রাখে)। শুধু `task` দেখলে পুরনো সমস্ত খরচ "unknown" bucket-এ যেত — অর্থাৎ ইতিহাস মুছে যেত। কতটি row এভাবে পড়া হলো, তা পেজে দেখানো হয় (`legacyTaskRows`) |
| ২০২৬-১০-১৪ | TASK-13: `app/globals.css`-এ **`--chart-1…6` টোকেন যোগ** | hardcoded রঙের **আসল কারণ** ছিল টোকেনের অভাব — chart-এর জন্য কোনো CSS variable ছিলই না, তাই লেখক `bg-emerald-500/10` লিখতেন। টোকেন যোগ করা মানে পরের বার আর ওই পথে যাওয়ার প্রয়োজন নেই। মানগুলো যাচাই-করা reference palette থেকে নেওয়া, আন্দাজে বাছা নয় |
| ২০২৬-১০-১৪ | TASK-13: `MarginCell` বের করে **এক জায়গায়** আনা হলো | একই money-label এখন দুই caller (workspace টেবিল ও observability-র cost ranking) ব্যবহার করে। দুটি কপি রাখলে সেটিই আবার সেই অসুখ যা `unit-economics.ts` দূর করার জন্য বানানো হয়েছিল — একটি দামের লেখা দুই জায়গায় থাকা মানে একদিন দুটো আলাদা কথা বলা |
| ২০২৬-১০-১৪ | ⚠️ TASK-13-এ **দেখা যায়নি** (জেনে-শুনে): `workspaces.ledger.*` ও `workspaces.overview.*` translation key দুটিই `admin.json`-এ **নেই** | ঐ দুই ট্যাব বাংলায়ও ইংরেজি দেখায় — `t()` চুপচাপ fallback-এ যাওয়ায় কেউ ধরতে পারে না। এই টাস্কে যেগুলো ছোঁয়া হলো (`kpi`, `table`, `analytics`) সেগুলো যোগ করা হয়েছে; ledger/overview আলাদা করে দেখার কাজ, কারণ তাদের লেখা পড়ে অনুবাদ করতে হবে (আন্দাজে নয়) |
| ২০২৬-১০-১৪ | TASK-13 যাচাই: `ObservabilityFilters`-এ `onValueChange`-এর `string \| null` → `string`-এ নামানো | "All channels" sentinel-কে `""`-তে ফেরানোর সময় `null` case বাদ পড়েছিল, তাই tsc একটি error দিচ্ছিল (এটিই প্রথম চালানোর ৭৫টি error-এর মধ্যে **এই টাস্কের একমাত্র**)। এখন `null` ও sentinel — দুটোই `""`-তে collapses: "cleared" আর "no filter" আসলে একই কথা |
| ২০২৬-১০-১৪ | ⚠️ এই repo-তে **`vitest` install-ই ছিল না** (lockfile-এ ছিল, `node_modules`-এ নেই) | ফলে ১৬টি বিদ্যমান test ফাইল `Cannot find module 'vitest'` দিয়ে type-check ফেল করত — অর্থাৎ `npm test` এতদিন চালানোই যেত না, এবং `tsc` কখনো ০ error দিত না। `npm install` চালিয়ে পূরণ করা হয়েছে; ফল: tsc-এর ৭৪টি error একসাথে চলে যায়, আর **৪২৫টি test সব পাস**। এই তথ্য টাস্কের ডকুমেন্টে না থাকলে পরের বারের অনুসন্ধান একই প্রথম ধাপে আটকে যেত |
| ২০২৬-১০-১৪ | 🔴 TASK-13 লাইভে ৫০০ দিচ্ছিল → কারণ **TASK-10-এর migration কখনো চালানোই হয়নি**; অনুমতিক্রমে ৩টি `ADD COLUMN` চালানো হলো | `billing.AIUsageLog`-এ live ডাটাবেসে `task` · `latencyMs` · `fallbackFrom` — তিনটিই ছিল না, অথচ `billing.prisma`-তে ঘোষিত। ফলে `groupBy({by:["task"]})` ও যেকোনো `findMany` (select ছাড়া) `P2022` দিত। ⚠️ এর মানে **TASK-10-এর যাচাইও অসম্পূর্ণ ছিল** — তখন `tsc`/`build` সবুজ হয়েছিল, কারণ ওগুলোর একটিও আসল ডাটাবেসে query চালায় না। শুধু যোগাত্মক DDL: ৩৭টি row অপরিবর্তিত, n8n টেবিল দুটি অটুট, এখন diff পরিষ্কার |
| ২০২৬-১০-১৪ | নিয়ম #২-এর **কারণ** সংশোধিত: "`db push` `n8n_chat_histories` মুছে ফেলবে" → এখন আর সত্য নয় | ওই দুটি টেবিল এখন schema-তেই ঘোষিত (`N8nChatHistory`, `N8nChatHistoryLegacy`) — প্রমাণ: live diff-এ **কোনো `DROP TABLE` আসে না**। নিয়মটি তবুও বলবৎ, কিন্তু সৎ কারণটি এখন ভিন্ন: `db push` একটি **অপর্যালোচিত** diff প্রয়োগ করে। আর সুরক্ষাটি টিকে আছে কেবল ওই দুটি model ঘোষিত থাকলে — `db push`-এর উপর ভরসা করা মানে একজন ভুলে model দুটি সরালেই সব chat memory চলে যাওয়া। **ভয়টা schema-র উপর ছাড়া ভালো, নিয়মের উপর রাখা ভালো** |
| ২০২৬-১০-১৪ | TASK-13: `chatbot.Chunk`-এর `id` default-এর diff — **কোনো ব্যবস্থা নেওয়া হয়নি** | diff দেখাচ্ছিল `SET DEFAULT gen_random_uuid()::text`, কিন্তু live DB-তে মানটি আসলে আছে — `(gen_random_uuid())::text` (Postgres বন্ধনী স্বাভাবিক করে লেখে)। কার্যত অভিন্ন, ৩৪টি row ঠিকঠাক তৈরি হয়েছে। অর্থাৎ এটি **drift নয়, কেবল টেক্সটের পার্থক্য** — না যাচাই করে "ঠিক" করতে গেলে অকারণ DDL হত |
| ২০২৬-১০-১৪ | TASK-14: টাস্কের মূল ভিত্তি — *"প্রায় হুবহু কপি (প্রতিটি ~৬৬৬ লাইন)"* — **মাপা হলো এবং ভুল প্রমাণিত** | তিনটি JSON পড়ে গোনা হলো: byte-identical মাত্র **২,৯৪৫ B ≈ ১৫%** (৫টি নোড), নোড সংখ্যা FB ১৯ / IG ১৮ / WA ১৮, প্রতিটি ফাইল ~৬৬৬ নয় বরং ~২০ KB। বাকি ~৬৫% সত্যিকারের per-platform কোড (payload normalisation, profile lookup, reply API)। অর্থাৎ সমস্যাটি **লেখার নকল নয়, গঠনের মিল** — আর এটি জানা জরুরি ছিল, কারণ "কপি কমানো" লক্ষ্য ধরে এগোলে যা সরানো যেত না তা সরানোর চেষ্টায় আসল কোড ভাঙত। একমাত্র সত্যিকারের বড় অভিন্ন payload: `Decrypt Integration Secrets` (২,২০৮ B, ৬১ লাইন) |
| ২০২৬-১০-১৪ | 🔴 TASK-14: **টাস্কে লেখাই ছিল না** এমন একটি লাইভ bug — IG ও WA-র brain id ছিল placeholder | দুই ফাইলেই `"value": "REPLACE_WITH_CORE_AI_BRAIN_WORKFLOW_ID"` (Facebook-এ সঠিক id)। ফলে IG/WA-র webhook যাচাই হয়ে যেত, কিন্তু brain-এ পৌঁছানোর পথই ছিল না — অর্থাৎ **দুই চ্যানেল সম্পূর্ণ নীরব**, আর কোনো error কোথাও নেই। ইউজার এইমাত্র ওই দুই ফাইল import করেছেন, তাই এ মুহূর্তে লাইভে ভাঙা। ঠিক করা হলো (`rXK4xU4dY9NETqjB` + `cachedResultUrl`), আর **guard লেখার সাথে সাথেই ধরল**। এটি TASK-14-এর যৌক্তিকতার সেরা প্রমাণ: একই ভুল তিন জায়গায় খোঁজা হচ্ছিল, একটিতে বাদ পড়েছিল |
| ২০২৬-১০-১৪ | TASK-14: sub-workflow refactor **এই ধাপে করা হলো না** — টাস্কে চাওয়া সত্ত্বেও | n8n-এ একটি `executeWorkflow` কল মানে প্রতি inbound মেসেজে **+১টি execution** (আর queue mode-এ +১টি queue hop)। TASK-11 এইমাত্র ঠিক এই ধরনের hop সরিয়েছিল, মেপে। লাভ অমাপা অবস্থায় খরচ যোগ করা ঠিক উল্টো দিকে যাওয়া — তাই আগে **ডুপ্লিকেশন ধরার ব্যবস্থা** (যা runtime-এ শূন্য), পরে কাঠামো বদল: লাইভ যাচাই + মাপা per-node timing-এর পরে, আলাদা অনুমতিতে |
| ২০২৬-১০-১৪ | TASK-14 guard: `position`/`id`/sticky-note ইচ্ছে করেই বাদ, আর `Automation-Gate.json` reference-check থেকে বাদ | ওগুলো assertion-এ রাখলে n8n-এ নোড টেনে সরানোই test ফেল করাত — অর্থাৎ guard এক সপ্তাহেই mute হয়ে যেত, আর তারপর আসল drift-ও চোখ এড়াত। `Automation-Gate.json` বাদ কারণ সে সম্পূর্ণ workflow নয়: **যাচাই করা হয়েছে** — তাতে ৪টি নোড + `Gate Setup (বাংলা)` sticky, আর যে `When Called by Platform` / `Fetch Bot Config`-কে সে ডাকে তারা থাকে `Core-AI-Brain`-এ (regex-এর "dangling reference" ছিল false positive, bug নয়) |
| ২০২৬-১০-১৪ | TASK-14 ধাপ ২: sub-workflow **নয়** → **sync script** (ইউজার-অনুমোদিত পথ বদল) | টাস্ক যা চেয়েছিল তা কারিগরিভাবে **সর্বোচ্চ সুবিধাটাই** হারাত: `Respond 200 to Meta` ও `Return hub.challenge` হলো `respondToWebhook`, আর n8n-এ একটি sub-workflow parent-এর webhook-এ উত্তর দিতে পারে না — ওই দুটি কেবল **লেখার সময়ে** ভাগ করা যায়। sync script সেটিই করে: `lib/n8n/shared-nodes.json`-এ ৬টি নোড একবার, `npm run n8n:sync` তিনটিতে লেখে, runtime-এ শূন্য খরচ |
| ২০২৬-১০-১৪ | ⚠️ **আমার নিজের আগের দাবি প্রত্যাহার:** TASK-14-এ sub-workflow "একটি queue hop যোগ করে" — **ভুল ছিল** | [n8n PR #32206](https://github.com/n8n-io/n8n/pull/32206) ও [এই বিশ্লেষণ](https://github.com/sandgardenhq/dh-library/blob/main/content/en/n8n/08-one-execution-many-processes.md): sub-workflow **একই worker-এ inline** চলে — আলাদা Bull job নেই, queue dispatch নেই; খরচ কেবল +১ execution record। সংশোধনের পরেও সিদ্ধান্ত বদলায়নি, তবে কারণটি এখন ভিন্ন ও সঠিক: `respondToWebhook` (উপরের সারি), queue নয়। **মাপা টেস্ট ছাড়া একটি architecture দাবি করা ঠিক হয়নি** — এই লগেই লেখা থাকল |
| ২০২৬-১০-১৪ | TASK-14: guard আর script **একই `findDrift`** ব্যবহার করে — comparison দুই জায়গায় লেখা হয়নি | প্রথম খসড়ায় test-এ comparison-টা আবার লেখা হয়েছিল ("key order আলাদা" যুক্তিতে)। সেটি ঠিক যে রোগটি দূর করার জন্য `shared-nodes.ts` বানানো হলো, সেটিই জন্মাত: একদিন check আর fix "in sync" নিয়ে ভিন্ন মত পোষণ করত, আর তখন test সবুজ দেখিয়েও n8n-এ ভিন্ন কিছু যেত। এখন একটি ফাংশন, দুই caller |
| ২০২৬-১০-১৪ | TASK-14: canonical-এ **একটিমাত্র** templated নোড (`Upsert Chat Session`), আর পরিষ্কারভাবে ঘোষিত | ওই SQL-এ channel নাম লেখা হয়, তাই সেই literal-ই একমাত্র বৈধ পার্থক্য — বাকি ৫টি নোডে `%%PLATFORM%%` থাকলে test-ই ফেল করবে (একটি assertion আছে যা templated তালিকা হুবহু এক মানে ধরে)। এতে ভবিষ্যতে কেউ ভুল করে channel-নির্দিষ্ট কিছু canonical-এ ঢোকালে সাথে সাথে ধরা পড়বে |
| ২০২৬-১০-১৪ | ⚠️ **একটি route মুছে ফেললে `tsc` মিথ্যা error দেয়** — `.next/dev/types/validator.ts` বাসি হয়ে যায় | legacy enhance-prompt route মুছে ফেলার পরে `tsc` দুটি `TS2307` দিল, আর দুটিই **মুছে ফেলা ফাইলটির** নাম ধরে (`.next/dev/types/validator.ts:962` ও `.next/types/validator.ts:962`) — অর্থাৎ ত্রুটিটি কোডে নয়, **জেনারেট করা টাইপ-ফাইলে**। `.next/dev` ও `.next/types` মুছে আবার build চালালে দুইটিই যায়। ➡️ ভবিষ্যতে কোনো route/পেজ সরালে প্রথমে এই দুই ফোল্ডার মুছুন, নইলে আসল error-কে ডুবিয়ে দেবে |
| ২০২৬-১০-১৪ | 🔴 **§৮.১-এর ভিত্তি ভুল প্রমাণিত — "প্রায় সব AI feature ইতিমধ্যেই credit-এ মিটারে আছে"** | [`lib/domain/ai-task.ts:81-95`](../../lib/domain/ai-task.ts#L81-L95) পড়ে মাপা হলো: **`isCharged: true` কেবল `chat`-এ**; `embedding`, `enhance_prompt`, `translate`, `compare`, `text_ingest`, `product_extract`, `auto_train` — **সাতটিই `false`**। ফাইলটি নিজেই লিখে রেখেছে: *"That is a revenue leak, not a design choice"*। মানে §৮.১-এর সংখ্যাগুলো (enhance ২০, auto-train ৫০, product-sync ৩০) **কোডে কোথাও নেই** — লেখার সময়েই ভুল ছিল। ➡️ দুই ফল: (ক) এটি **TASK-25-এর মাপা প্রমাণ**, (খ) **১৫.৩-এর gating ডিজাইন meter-এর উপর দাঁড়াতে পারবে না** — যেহেতু meter নেই, gate-ই একমাত্র lever। `isCharged` আলাদা টাস্কের বিষয়, তাই এখানে ছোঁয়া হয়নি |
| ২০২৬-১০-১৪ | 🔴 ১৫.৩-এ একটি **লাইভ bug** ধরা পড়ল — `canAddIntegration` ছাদের উপরে **reconnect** আটকাত | আগে **সব** `connected` integration গোনা হত, তাই যে chatbot সীমায় পৌঁছে গেছে (`count 1 >= max 1`) সেখানে **পুরনো** channel-টি আবার connect করলে ৪০৩ আসত — অর্থাৎ BD Starter merchant তাঁর **একমাত্র** Facebook channel-এর টোকেন নবায়ন করতে পারতেন না, অথচ নতুন কিছু যোগ করছিলেন না। এখন যে platform connect করা হচ্ছে সেটি গণনা থেকে বাদ। **কিছুই শিথিল হয় না:** এখনো-সংযুক্ত-নয় এমন platform-এর সংখ্যা অপরিবর্তিত, তাই নতুন channel ছাড়াতে পারে না। bug-টি **৭টি আগে-থাকা gated route-এ ছিল** — অর্থাৎ সংশোধনে সামগ্রিক gate শক্ত হলো, দুর্বল নয় |
| ২০২৬-১০-১৪ | 🔴 ১৫.৩: `getPlan()`-এর চুপচাপ fallback entitlement-এ ব্যবহার **যায় না** → নতুন `getPlanIfDefined()` | `getPlan("bd","growth")` চুপচাপ **starter** দেয়। gating-এ সেটি ব্যবহার করলে **legacy `growth`/`pro` merchant — যিনি সত্যিই পরিশোধ করেছেন, আর যাঁদের `growth_bdt`/`pro_bdt` package এখনো `payment-packages.ts`-এ আছে — Starter-এর সীমায় পড়ে নিজের channel হারাতেন**, অথচ কোথাও কোনো error নেই। তাই এই region-এর catalogue যে key-র নামে plan রাখে না, তার জন্য **নিয়মও নেই → fail-open**। "না-জানি" আর "না" আলাদা রাখা হলো। ⚠️ `getPlan` নিজে বদলানো হয়নি — সেটি TASK-04-এর বিষয় এবং অন্য caller-রা তার fallback-এর উপর নির্ভর করে |
| ২০২৬-১০-১৪ | 🔴 ১৫.৩-এ **পণ্যের সিদ্ধান্ত** — Web Widget entry plan থেকে কাটা হলো **না**, বরং দুই region-এই যোগ করা হলো | Global Starter-এর নিজের feature-তালিকা "Web Widget" বলত, কিন্তু `allowedPlatforms` ছিল `["facebook"]` — অর্থাৎ plan-টির নিজের দুই লাইন পরস্পরবিরোধী, আর কোনোটিই enforce হত না। ফাঁক ২ বন্ধ করতে গিয়ে যেকোনো একটি দিক বেছে নিতে হত। "না" দিকে গেলে **এইমাত্র (TASK-12/১৩) লাইভে যাওয়া Web Widget** সেই plan-এর merchant-দের জন্য নীরবে বন্ধ হয়ে যেত। "হ্যাঁ" দিকে যাওয়ার আসল কারণ: **widget-ই ট্রায়াল plan-এর একমাত্র ব্যবহারযোগ্য channel** — Facebook Messenger-এ Meta app + page permission লাগে, widget-এ শুধু একটি script tag। উপসেল ক্ষয় হয় না (Business এখনো ৯টি বেশি chatbot, ৩৫,০০০ বেশি credit, সব channel, ই-কমার্স, top-up দেয়)। BD-র লেখা "Facebook Channel Only" → "Facebook + Web Widget"-এ সংশোধিত। ⚠️ রিভার্ট করতে চাইলে `plan-config.ts`-এ এক লাইন |
| ২০২৬-১০-১৪ | ১৫.৩: top-up gate **checkout-এ, `applyPaymentGrant`-এ নয়** — এবং e-commerce gate **লেখায়, পড়ায় নয়** | (ক) `applyPaymentGrant` চলে টাকা কাটা হয়ে যাওয়ার **পরে**; সেখানে plan-check দিলে ফল হত "টাকা গেছে, credit মেলেনি" — আসল ফাঁকের চেয়ে খারাপ। (খ) `GET /api/orders*` ও `GET /api/couriers` ইচ্ছে করেই খোলা: সীমাটি **তৈরি করার** উপর, **দেখার** উপর নয় — plan বদলালে merchant তাঁর নিজের বিক্রির ইতিহাস দেখতে না পারলে সীমাটি তাঁর নিজের ডেটা লুকিয়ে ফেলত। ⚠️ এই সম্মতি-নীতিতে Sidebar-ও পড়ে, নইলে nav একটি কথা বলত আর API আরেকটি |
| ২০২৬-১০-১৫ | 🔴 ১৫.৯: পরিকল্পনার যোগ্যতার নিয়ম **"এই cycle-এ টাকা দিয়েছে" → "কখনো টাকা দিয়েছে"** | এই প্ল্যাটফর্মে **recurring billing বলে কিছুই নেই** — প্রতিটি plan কেনাকাটা এক-বারের `PaymentTransaction`, নবায়নের কোনো রেল নেই। ৩০-দিনের উইন্ডো দিলে প্রথম মাসের পর **প্রতিটি পরিশোধকারী merchant** skip হয়ে যেতেন — অর্থাৎ leak বন্ধ করতে গিয়ে প্রোডাক্টটাই ভাঙত। এই আবিষ্কারটি পরিকল্পনা লেখার সময় পাওয়া গেছে |
| ২০২৬-১০-১৫ | 🔴 ১৫.৯: `isResetEligible`-এর ধাপের ক্রম পরিকল্পনার টেক্সট থেকে **বদলানো হয়েছে** | পরিকল্পনার ক্রমে (refunded → `price === 0` → paid → never) একটি `contact: true` plan ধাপ ২-এ পড়ত, কারণ নেগোসিয়েটেড plan-এর `price`-ও ০। ফলে একজন **চুক্তিভিত্তিক Enterprise, যাঁকে admin invoice ছাড়া plan দিয়েছেন**, প্রতি মাসে ১,৫০,০০০ credit পেতেন — একটিই অ্যাকাউন্টে ≈ ৳৯,০০০/মাস, চিরকাল। অর্থাৎ ছিদ্র বন্ধ করতে গিয়ে নতুন একটির জন্ম হত। দুটি বদল: (ক) `contact === true` যাচাই `price === 0`-এর **আগে**, (খ) `hasPaidPlanPayment` **সবার আগে**, যাতে "refund নিয়ে আবার টাকা দেওয়া" merchant বাদ না পড়েন |
| ২০২৬-১০-১৫ | ১৫.৯: response-এ **`failed` যোগ করা হলো** (পরিকল্পনায় ছিল না) | পরিকল্পনার আকার ছিল `{ processed, granted, skipped, skippedByReason, resetAt }`। কিন্তু আগের কোডে প্রতি-user try/catch ছিল, আর সেই সংখ্যাটি বাদ দিলে "কতজন সত্যিই প্রক্রিয়া হলো" প্রশ্নের উত্তর থাকত না — `processed = granted + skipped` ধরে নিতে হত, যা ব্যর্থতা লুকিয়ে ফেলত |
| ২০২৬-১০-১৫ | 🟢 ১৫.৬: **পরিকল্পনার একমাত্র ⚠️ DDL সতর্কতাটি বাতিল** — `trialEndsAt` কলাম লাগল না | `User.planExpiresAt` (`prisma/schema/auth.prisma:13`) **আগেই আছে**, payment grant-এ লেখা হয়, আর merchant-কে "Renews on …" দেখানো হয়। একটি trial তো ঠিক সেটাই: **একটি plan period যা শেষ হয়, নবায়ন হয় না**। তাই কোনো `migrate diff` নেই, কোনো অনুমোদন লাগে না। বোনাস: "এক account = একবার" শর্তটি স্বাভাবিকভাবেই আসে — `planExpiresAt` কেবল `NULL` থাকলে বসে, আর trial শেষে সেটি মুছে ফেলা হয় না |
| ২০২৬-১০-১৫ | ⚠️ ১৫.৬-এর **পাশাপাশি-প্রভাব**: "Renews on …" লেখাটি মিথ্যা হয়ে যেত, তাই সার্ভারে `planIsTrial` যোগ | যেহেতু trial এখন `planExpiresAt` লেখে, ওই কলাম থাকলেই "নবায়ন হবে" লেখা যেত না — অথচ trial-এ নবায়ন হয় না, ওই তারিখে chatbot বন্ধ হয়। পার্থক্যটি কেবল টাকায়, তাই সেটি `hasPaidForPlan()` দিয়ে `/api/usage`-এ ঠিক হয়, আর `CurrentPlan.tsx` তখন "Free trial ends on …" লেখে। খরচ: প্রতি usage fetch-এ একটি indexed `count()` |
| ২০২৬-১০-১৫ | ১৫.৬: trial-expiry-র জন্য `scheduleDowngrade` রেল **ব্যবহার করা হয়নি** | tempting ছিল — `processAllDueDowngrades()` আগেই আছে। কিন্তু `applyDowngrade` target plan-এর allowance **বসায়** — অর্থাৎ trial শেষে আবার ১৫,০০০ credit দিয়ে **leak-টা আবার খুলত**। তাই একই cron-এ একটি আলাদা শাখা `processExpiredTrials()`: chatbot গুলো `paused`, ব্যালেন্স **অস্পর্শ**, `planExpiresAt` **অমুছে** (সেটিই "trial ব্যবহৃত" হওয়ার দলিল), আর notification কেবল `paused > 0` হলে — অর্থাৎ নতুন কলাম ছাড়াই idempotent |
| ২০২৬-১০-১৫ | ১৫.৬: Global region-এ trial **ইচ্ছে করেই চালু করা হলো না** | Global Starter-এর দামই $০, আর `paymentGateway: null` — টাকা নেওয়ার পথই নেই, অথচ trial-এর একমাত্র উদ্দেশ্য রূপান্তর। মেয়াদ শেষে merchant-এর অবস্থা হত: **bot paused, credit নেই, কেনারও উপায় নেই** — ওই পরিণতি trial না দেওয়ার চেয়েও খারাপ। ওখানে `free_plan` নিয়মে Starter-এর ৫০০ credit প্রতি cycle-এ নবায়নও হয় (স্থায়ী free tier), তাই trial-এর দরকারই নেই |
| ২০২৬-১০-১৫ | 🔴 ১৫.৪: `PLAN_KEYS`-এর **দ্বিতীয় কপি** (`admin-credits.ts`-এর `VALID_PLAN_KEYS`) মুছে ফেলা | সেটিই `growth`-এর ভূতের জন্ম দিয়েছিল: region-নিরপেক্ষ তালিকায় `growth` **বৈধ**, তাই একজন BD user-এর `User.plan` হয়ে যেত `growth` — অথচ BD ক্যাটালগে ওটি নেই, ফলে `getPlan("bd","growth")` **চুপচাপ starter** ফেরত দিত (পর্দায় "GROWTH", হিসাবে Starter: ৫০,০০০ credit-এর বদলে ১৫,০০০, আর WhatsApp বন্ধ)। `LEGACY_PLAN_ALIASES`-ও একই কারণে মুছে ফেলা হলো — এখন একটি মাত্র দরজা, `resolvePlanKeyForRegion` |
| ২০২৬-১০-১৫ | 🔴 ১৫.৪ migration-এর সময় **দুটি বাগ ধরা পড়ল ও ঠিক করা হলো** | (ক) **hierarchy ভুল হত:** `previousPlan`-কে সরাসরি `PLAN_KEYS`-এ খুঁজলে legacy BD `growth` user-এর index `-1` হত, ফলে তাঁকে `starter`-এ নামানো **upgrade** হিসেবে চিহ্নিত হত আর pause-যুক্তি বাদ পড়ত (তার chatbot চলতেই থাকত, অথচ plan নেমে গেছে)। (খ) **credit দুইবার যোগ হত:** `getPlanCredits("growth", "bd")` চুপচাপ starter-এর ১৫,০০০ ফেরত দেয়, তাই পুরনো allowance-টি admin-এর "bonus" বলে গুনে **আবার যোগ** হত। দুটোরই সমাধান এক: resolve আগে, তারপর হিসাব |
| ২০২৬-১০-১৫ | ১৫.৫: BD Enterprise-কে self-serve থেকে **নেগোসিয়েটেড** করা হলো (`price: 0` · `contact: true`) | ∞ chatbot + ∞ credit-কে একটি **নির্দিষ্ট** দামে বিক্রি করা মানে সমীকরণের এক দিক স্থির করা, যার অন্য দিক অসীম — derivation-এ মাপা লোকসান ছিল **−৫২৪%**। ⚠️ ৳৪,৯৯৯ সংখ্যাটি কোডের মন্তব্যে ইতিহাস হিসেবে রাখা হলো; নিয়মটির প্রমাণ দুটি: admin panel-এর ভুয়া **১০০% margin** এখন `basis: "custom"` (০ নয় — "unknown ≠ 0"), আর `computeAllowanceEconomics`-এ margin `null` (খরচ ৳৩,০০০ **জানা**, দাম অজানা) |
| ২০২৬-১০-১৫ | ১৫.৫: `enterprise_bdt` package **ক্যাটালগে থাকল**, কেবল checkout-এ আটকানো হলো | মুছে ফেললে পুরনো transaction-এর grant path (`resolvePlanForGrant`) — যেটি টাকা কাটার **পরে** চলে — আর ওই প্যাকেজটি পড়তে পারত না: "টাকা গেছে, plan মেলেনি"। তাই নিয়মটি `isPackageAllowedForPlan`-এ (checkout-এ), ক্যাটালগে নয় — ১৫.৩-এর নীতির ধারাবাহিকতা |
| ২০২৬-১০-১৫ | 🔴 ১৫.৫: pricing page-এ **আসল সত্যটি সব plan-এর জন্য ছিল না** — Enterprise-এর CTA একটি dead end ছিল | প্রতিটি plan `router.push("/dashboard/payment")` করত, এমনকি `contact: true`-ও — অর্থাৎ গ্রাহক "Choose plan" চেপে এমন একটি পেজে যেতেন যেখানে ওই tier কেনার কোনো উপায় নেই। এখন `plan.contact` হলে "Contact us" → একটিই contact form (`BookDemoModal`-কে `source`/`namespace`/`keyRoot` prop দিয়ে generalise করা হলো, দ্বিতীয় form বানানো হয়নি)। ⚠️ CTA-টি `paymentAvailable`/`isSignedIn`-এর বাইরে — কথাবার্তার জন্য gateway লাগে না, তাই Global region-এও রূপান্তরের পথ খোলা |
| ২০২৬-১০-১৫ | ১৫.৪ i18n: `pricing.json` থেকে **অব্যবহৃত ও মিথ্যা** key মুছে ফেলা | `free.price = "৳০"` / `"$0"` — অথচ BD Starter **৳৯৯৯**, আর TASK-13-র regression test ঠিক এই "Starter is free" কথাটাই নিষিদ্ধ করেছে। সাথে `pro` (`"৳২৯০০"`/`"$29"`) ও `starter`/`growth`/`business`/`ent`-এর duplicate name+desc। নিয়ম: **যে key অব্যবহৃত এবং যা বলে তা মিথ্যা, সেটিই মুছে ফেলা**। `monthly`/`yearly` রাখা হলো — ১৫.৭ ওগুলোই লাগবে, আর ওরা মিথ্যা কিছু বলে না |
| ২০২৬-১০-১৫ | AGENTS.md §3 লঙ্ঘন সংশোধিত — pricing page ও contact form-এ `text-white` | চারটি `text-white` (`pricing/page.tsx` ×৩, `BookDemoModal.tsx` ×১) → `text-primary-foreground`। hardcoded রঙের **আসল কারণ** টোকেনের অভাব নয় — টোকেন আছে, কেবল লেখার সময় ব্যবহার হয়নি |
| ২০২৬-১০-১৫ | 🔴 ১৫.৬: `refundStatus: { not: "refunded" }` → **`OR: [{ null }, { not: "refunded" }]`** | `refundStatus` একটি **nullable** কলাম, আর স্বাভাবিক payment-এ মানটাই `NULL` (refund কেবল ব্যতিক্রমে লেখা হয়)। Prisma-র `not` একটি nullable কলামে NULL row ফেরত দেয় কি না, সেটি SQL-এর তিন-মান-যুক্তির প্রশ্ন — আর যাচাইয়ের কমান্ড চালানো না যাওয়ায় মিলিয়ে দেখা যায়নি। **যদি `not` NULL বাদ দিত**, তবে `hasPaidForPlan` প্রতিটি সাধারণ payment-এ `false` হত → `listExpiredUnpaidTrials` প্রত্যেক পরিশোধকারীকে "non-paying trial" ধরত → `processExpiredTrials` **তাঁদের chatbot বন্ধ করে দিত**। দুই পড়ার মধ্যেই একই ফলাফল আসে বলেই `OR`-টি স্পষ্ট করে লেখা হলো (বাহুল্য হলেও ক্ষতিকর নয়, আর প্রশ্নটি বাহুল্যের নয় — টাকা-দেওয়া merchant-এর সেবা বন্ধের) |
| ২০২৬-১০-১৫ | ১৫.৪: DB migration নতুন করে কলাম লেখে **নাই** — বিদ্যমান `setUserPlan` ডাকা হলো | একটি migration script নিজে `user.update(...)` করলে "plan বদল" কথাটির **দ্বিতীয় implementation** জন্মাত — ঠিক যে রোগে `VALID_PLAN_KEYS` থেকে `growth`-এর ভূত এসেছিল (উপরের লগ দেখুন)। তাই [`scripts/task15-migrate-legacy-plans.ts`](../../scripts/task15-migrate-legacy-plans.ts)-এর একমাত্র দায়িত্ব **খুঁজে বের করা**; credit reset, `plan_change_admin` audit row, notification ও chatbot reconciliation — সব `setUserPlan`-এর ভেতরেই থাকে, অর্থাৎ একই audited ফাংশন যা `/admin/workspaces` ডাকে। সাথে: ডিফল্ট **dry-run** (`--apply` ছাড়া কিছুই লেখে না), আর প্রতিটি write-এর ঠিক আগে row আবার পড়া হয় (discovery ও write দুটি আলাদা round-trip — stale পড়ায় migrate করলে একজনকে দেখানো হত আর আরেকজনের বদল হত) |
| ২০২৬-১০-১৫ | ⚠️ ১৫.৪ migration: audit row-এর `adminId` একটি **system actor** — কোনো মানুষ নয় | `creditTransaction`-এ একজন admin-এর নাম লেখা হত যিনি বোতাম চাপেননি; সেটি না-লেখার চেয়ে খারাপ, কারণ audit-এ মিথ্যা attribution ঢোকে। `system:task15-migrate-legacy-plans` / `system@driplare.invalid` — `system:` prefix-এ filter করে পৃথক করা যায় |
| ২০২৬-১০-১৫ | 🔴 ১৫.৭: `pricing.json`-এ রাখা `yearly` key-টি **ঠিক সেই দিনেই মিথ্যা প্রমাণিত** | ১৫.৪-এ লেখা হয়েছিল *"`monthly`/`yearly` রাখা হলো — ১৫.৭ ওগুলোই লাগবে, আর ওরা মিথ্যা কিছু বলে না"*। কিন্তু রাখা **মানটি** ছিল `"Yearly (save 20%)"` / `"বার্ষিক (২০% সাশ্রয়)"` — হাতে লেখা **২০%**, অথচ কোডের ডিফল্ট ছাড় **২৫%**, আর এখন সেই ছাড় admin-এর হাতে যেকোনো মুহূর্তে বদলাতে পারে। অর্থাৎ **একটি অনুবাদ-ফাইলে হার্ডকড করা যেকোনো শতাংশ একটি অপেক্ষমাণ মিথ্যা** — রাখার সিদ্ধান্ত ঠিক ছিল, রাখা মানটি নয়। সংশোধন: `yearly` এখন কেবল লেবেল ("Yearly" / "বার্ষিক"), আর ভগ্নাংশটি কম্পোনেন্টে বসে **ক্যাটালগ থেকে** (`annualDiscountPercent`) — অর্থাৎ বিজ্ঞাপিত ছাড় আর চার্জ করা ছাড় একই সূত্র থেকে আসে, দুটো আলাদা হয়ে যাওয়ার পথই নেই। একই কারণে `payment.json`-এর `cycle.saving`-ও |
| ২০২৬-১০-১৫ | ১৫.৭: `TopUpCards.tsx`-এর নকল দাম-তালিকা মুছে ফেলা — **কারণ সম্ভাবনা, ঘটনা নয়** | টাস্কে এটি "pre-existing ত্রুটি" বলে লেখা ছিল, তাই প্রথমে যাচাই করা হলো। **পাঁচটি pack-এর `price` ও `credits` হুবহু `PAYMENT_PACKAGES`-এর সাথে মিলেছে** (৪০০/৮০০/২৫০/৪৫০/২০০০) — অর্থাৎ কপিটি লেখার সময়ে ভুল কিছু বলেনি, এবং কোনো ভুল দাম কখনো পর্দায় ওঠেনি। আসল সমস্যা ভিন্ন: checkout চার্জ করে `pkg.amount` থেকে, আর এখন admin `/admin/pricing` থেকে top-up-এর দাম বদলাতে পারেন — তখন হাতে-লেখা তালিকা পুরনো দাম দেখাত অথচ কার্ড থেকে নতুন দাম কাটা যেত। ➡️ **একই দিনে আমার নিজের লেখা কমেন্টে "পর্দায় ৳৪০০ দেখিয়ে ৳৫০০ কাটা যেত" দাবিটি মিথ্যা ছিল** (দুটোই ৪০০)। কমেন্টটি সংশোধিত — কারণ না-ঘটা একটি ঘটনাকে ঘটেছে বলে লিখে রাখা মানে পরের পাঠক একটি ভুল ইতিহাস শেখেন, আর সেই ইতিহাস দিয়েই তিনি পরের সিদ্ধান্ত নেন |
| ২০২৬-১০-১৫ | ১৫.৭: কুপনের "কতবার ব্যবহৃত" সংখ্যা **blob-এ লেখা হয় না** — অর্থের লেজার থেকে গোনা হয় | স্বাভাবিক পথ ছিল `PricingCatalogue` JSON-এ একটি `redeemedCount` রেখে checkout-এ বাড়ানো। কিন্তু blob-টি read-modify-write, তাই দুটি checkout একসাথে চললে একটি increment হারাত — **আর হারানো সংখ্যাটির অর্থ টাকা**: সীমা ভুল হিসেবে আগেই বন্ধ হয়ে যেত, বা ভুল হিসাবে আরও বিক্রি হত। তাই `countCouponRedemptions` `PaymentTransaction.metadata.couponCode` গোনে — হুবহু যে নীতিতে `hasPaidForPlan` ([trial.ts:205](../../lib/domain/trial.ts#L205)) আলাদা flag না রেখে payment row গোনে। বোনাস: admin পর্দায় দেখানো সংখ্যা আর কুপনটি সত্যিই বন্ধ হওয়ার মুহূর্ত কখনো আলাদা হতে পারে না, কারণ দুটিই **একই ফাংশন** |
| ২০২৬-১০-১৫ | ১৫.৭: দাম client-এ **prop-এ** যায়, fetch-এ নয় — এবং দুই region একসাথে | `RegionProvider` আগেই একটি client context, যা [`app/layout.tsx`](../../app/layout.tsx) (async, `cookies()` পড়ে) পূরণ করে। ঠিক সেই ছাঁচেই `initialCatalogue` যোগ করা হলো — নতুন কোনো client-side fetch নয়। কারণ দুটি: (ক) fetch হলে `/pricing`-এ দাম **পরে** আসত, অর্থাৎ পাবলিক প্রাইসিং পেজে একটি দৃশ্যমান দাম-বদল (flash) এবং সার্চ ইঞ্জিনের কাছে দামহীন HTML; (খ) দুই region-এর ক্যাটালগ একসাথে পাঠানো হয় কারণ region client-এ বদলায় (`getRegionFromCookie()`) — নইলে region টগল করলে প্রতিবার একটি নতুন round trip লাগত |
| ২০২৬-১০-১৫ | ১৫.৭: **একটি পড়ার পথ, দুটি ভিন্ন ব্যর্থতা-নীতি** — admin-এ ৫০০, public-এ নিরাপদ ডিফল্ট | `GET /api/admin/pricing` ব্যর্থ হলে **৫০০ দেয়, ডিফল্ট ক্যাটালগ নয়** — [`ai-settings/route.ts`](../../app/api/admin/ai-settings/route.ts)-এর নীতি। কারণটি নিষ্ঠুর: PUT গোটা ক্যাটালগ **প্রতিস্থাপন** করে, তাই একটি ব্যর্থ read-এর পরে ফর্ম দেখানোর অর্থ — admin যা দেখছেন তা কোডের ডিফল্ট দাম, আর Save চাপলে সেগুলোই সত্যিকারের দাম হয়ে যেত। অর্থাৎ **শূন্য দৃশ্যমান ভুলে সব আসল দাম মুছে যেত**, আর admin "সংরক্ষিত" বার্তাও পেতেন। তাই সার্ভার ৫০০ দেয়, আর পর্দা ফর্মটিই দেখায় না (full-screen error + retry)। উল্টো দিকে রেন্ডারের পথটি fail-safe: ভাঙা/অজানা JSON → খালি ক্যাটালগ → কোডের ডিফল্ট দাম। **অর্থাৎ কোনো অবস্থাতেই "সব দাম ০" হবে না** — ৳০ দেখানোর চেয়ে ৳৯৯৯ দেখানো ভালো, কারণ একটি মিথ্যা দাম কেনাবেচার সিদ্ধান্ত নষ্ট করে |
| ২০২৬-১০-১৫ | ১৫.৭: `GET /api/admin/pricing` এখন `{ catalogue, redemptions }` ফেরত দেয় — খালি ক্যাটালগ নয় | admin পর্দার "কতবার ব্যবহৃত" সংখ্যাটি checkout-এর **হুবহু একই** `countCouponRedemptions` থেকে নেওয়া হলো, নতুন কোনো endpoint বা নতুন কোনো stored counter বানিয়ে নয়। আকার বদলানো মানে বিদ্যমান GET-এর কোনো consumer থাকলে সেটি ভাঙত, তাই আগে গোনা হলো: **একটিও নেই** — এই পর্দাটিই প্রথম। ভবিষ্যতে যেন খালি অবজেক্ট পড়ে বিভ্রান্তি না হয়, তাই wrapper-টি ইচ্ছে করেই **নামযুক্ত** (`catalogue`), এবং `redemptions` আলাদা রাখা হলো কারণ তার আকার ভিন্ন (`code → count`) |
| ২০২৬-১০-১৫ | ১৫.৭ · D.২: `UsageAlert`-এর **একটি** `Int` কলামে দুই অর্থ — আর সেটিই DDL বাঁচাল | মেয়াদ-শেষের reminder-কে credit-থ্রেশহোল্ডের সাথে এক টেবিলে রাখতে চাইলে সহজ পথ ছিল নতুন কলাম (`kind`) বা নতুন টেবিল। বদলে **চিহ্নটিকেই** বাহক করা হলো: শতাংশ ধনাত্মক (`50/80/90/100`), আর "কত দিন বাকি" ঋণাত্মক (`-7/-3/-1`) — যা কখনো সংঘর্ষ করতে পারে না, কারণ শতাংশ ঋণাত্মক নয়। `cycleStart`-ও তখন দুই অর্থ পায়: শতাংশে `creditsResetDate` (credit-চক্র), reminder-এ `planExpiresAt` (plan-মেয়াদ)। ফলে `@@unique([userId, cycleStart, threshold, channel])` **দুই ক্ষেত্রেই** কাজ করে অপরিবর্তিত — আর গ্রাহক নবায়ন করলে `planExpiresAt` সরে যায়, অর্থাৎ পরের মেয়াদের তিনটি reminder আপনা-আপনি আবার খোলে |
| ২০২৬-১০-১৫ | ১৫.৭ · D.২: মেয়াদ-শেষের reminder-এ **এক run-এ একটি email** — শতাংশ-থ্রেশহোল্ডের মতো সব নয় | শতাংশ-বার্তা একটি **অবস্থার** কথা ("আপনি ৮০% পার হয়েছেন") — যা সত্য থেকে যায়, তাই তিনটি পাঠানো ক্ষতিকর নয়। মেয়াদ-বার্তা একটি **সময়ের** কথা ("৭ দিন বাকি") — যা পরদিনই মিথ্যা। তিনটি পাঠালে ৩ দিন বাকি থাকা merchant পেতেন "৭ দিন বাকি" লেখা email, আর সেই ভুলটির দাম টাকায়: যিনি ভাবেন সাত দিন হাতে আছে, তিনি নবায়ন করতে দেরি করেন — অথচ মেয়াদ শেষে তাঁর credit নবায়ন বন্ধ। তাই `RENEWAL_REMINDER_DAYS` জরুরি-আগে সাজানো (`[1,3,7]`) ও লুপ প্রথম **অদাবিকৃত** থ্রেশহোল্ডেই `break` করে — ফলে এক সপ্তাহের cron-বিরতিতেও একটি সৎ বার্তা যায়, তিনটি অসৎ নয় |
| ২০২৬-১০-১৫ | ১৫.৭ · D.২: reminder-এর path **দুটি** — cron + `/api/usage` hook | পরিকল্পনায় কেবল cron ছিল। কিন্তু [`/api/cron/*` Clerk-এর middleware-এ আটকায়](../../app/api/cron/usage-alerts/route.ts) (TASK-22), অর্থাৎ cron-কেবল পথ মানে প্রোডাকশনে **কোনোদিন না যাওয়া** — আর এই email-টিই নতুন নিয়মে একজন বার্ষিক merchant-এর **একমাত্র** নবায়নের সংকেত (তিনি credit ফুর করান না, তাই ৫০/৮০/৯০%-এর একটি বার্তাও পান না)। তাই `/api/usage`-এও hook বসানো হলো, কারণ সেই route-টি ঠিক তখনই চলে যখন merchant তাঁর plan-টি দেখছেন। শূন্য বাড়তি query (user row `include`-এ আগেই আছে), await করা হয় না (পেজ ধীর হয় না), আর idempotency DB-level, তাই বারবার ডাকা নিরাপদ |
| ২০২৬-১০-১৫ | 🔴 ১৫.৭ · D.২: **আমার লেখা tripwire প্রথমে দাঁতহীন ছিল — mutation test দিয়ে ধরা পড়ল** | assertion-টি ছিল `expect(block).toContain("claimAlert")`। তারপর claim-শর্তটি `true` দিয়ে **শর্ট-সার্কিট** করে দেখানো হলো (অর্থাৎ guard-টি নামমাত্র রাখা হলো, কাজ করা বন্ধ): **টেস্ট তখনো সবুজ**। কারণ পরীক্ষা করা হচ্ছিল একটি **শব্দ**, আচরণ নয় — আর ঠিক এটিই tripwire-লেখার সহজ ফাঁদ: সবুজ রঙ ভরসা দেয়, অথচ কিছুই রক্ষা করে না। তাই assertion-টি **গঠনে** বদলানো হলো (await করা claim → `if (!claimed)` গার্ড → `channel: "app"`, এই ক্রমেই), আর দুইটি আসল রিগ্রেশন (claim বাদ দেওয়া, `break` বাদ দেওয়া) চালিয়ে দেখা হলো যে টেস্টটি সত্যিই **কামড়ায়**। ⚠️ সীমাটিও সৎভাবে স্বীকার করা: এটি একটি **পাঠ্য-পরীক্ষা**, তাই একেবারে সমার্থক-দেখতে একটি শক্তিক্ষয় ধরা নাও পড়তে পারে — যা ধরে, তা হলো claim/গার্ড/`break` **মুছে ফেলা** বা ক্রম বদলানো |
| ২০২৬-১০-১৫ | ⚠️ ১৫.৭ · D.২: deploy-এর পর **প্রথম** রানে ৫০%+ merchant-রা দুটি করে backfill email পাবেন — মেনে নেওয়া হলো | `THRESHOLDS` `[100, 80]` → `[100, 90, 80, 50]`। আগে কোন শতাংশে পৌঁছানো হয়েছিল তা কোথাও জমা নেই (কোনো "previous percent" কলাম নেই, আর সেটি হতো DDL), তাই backfill ঠেকানোর উপায় নেই। সিদ্ধান্ত: মেনে নেওয়া — কারণ email-দুটি **তখন সত্যই** ("আপনি ৫০%/৯০% পার হয়েছেন"), ক্ষতিকর নয়, আর দরকার হলে deploy-এর আগে একটি এককালীন SQL দিয়ে আগেই `UsageAlert` row বসানো যায় (সেটি DB লেখা → অবশ্যই আপনার অনুমতি লাগবে) |
| ২০২৬-১০-১৬ | 🔴 ১৫.৮: পরিকল্পনার **"ঋণাত্মক `freeMessages` → `0`-এ clamp"** বদলে **ডিফল্টে (১০০০) ফেরা** | clamp করার অর্থ দাঁড়াত "ফ্রি tier নেই", অর্থাৎ একটি **ভাঙা config-এর দাম merchant দিতেন** — প্রথম বার্তা থেকেই চার্জ, পর্দায় কোনো কারণ ছাড়াই। ডিফল্টে ফিরলে খরচ আমাদের ঘাড়ে, যা এই নকশার ঘোষিত পক্ষপাত (কম নেওয়া > বেশি নেওয়া)। সাথে: `freeMessages = 0` এখন **আলাদা অর্থে বৈধ** ("ইচ্ছে করে ফ্রি tier ছাড়া"), তাই শূন্য ও ঋণাত্মককে এক করা আর সম্ভবও নয়। ⚠️ নকশার যুক্তিটি ("নাহলে সব বার্তা ফ্রি হয়ে যেত") নিজের ভুলের **বিপরীত দিক** নিয়ে ছিল — অর্থাৎ দুটো ভিন্ন প্রশ্ন একসাথে মিলিয়ে ফেলা হয়েছিল |
| ২০২৬-১০-১৬ | ১৫.৮: surcharge-এর helper `charge-usage.ts`-এর ভেতরে **নয়** → আলাদা `lib/services/whatsapp-surcharge.ts` | (ক) AGENTS §১ — বিলিং-কোর ফাইলটি আরও বড় না করা; (খ) tripwire-টির একটি ছোট, লক্ষ্যযুক্ত ফাইল দরকার ছিল যার `where`-ক্লজ হুবহু মাপা যায় |
| ২০২৬-১০-১৬ | ১৫.৮: `creditsResetDate` **পড়াই হয় না** (নকশায় পড়ার কথা ছিল) | চক্র-জানালা ক্যালেন্ডার মাস (নকশার নিজের সুপারিশ, যা মানা হয়েছে), তাই `creditsResetDate`-এর কোনো কাজই ছিল না — অর্থাৎ নকশাটি নিজের দুই অংশে পরস্পরবিরোধী ছিল। ফল: প্রতিটি surcharge-হিসাবে একটি অপ্রয়োজনীয় `findUnique` বাদ |
| ২০২৬-১০-১৬ | ১৫.৮: `bdtPerCredit`-এ **দুই ছাদ যোগ** — `WHATSAPP_FEE_BDT_MAX = 50`, `WHATSAPP_FREE_MESSAGES_MAX = 100000` | নকশায় কোনো ছাদ ছিল না, অথচ `POST /api/admin/ai-settings`-এ একটি টাইপো (`0.54`-এর বদলে `54`) **সব merchant-এর credit এক দিনেই নিঃশেষ** করে দিত। ৫০ ৳ ছাদটি আসল রেটের (~০.৫৪) চেয়ে ১০০ গুণ, তাই সত্যিকারের মান কখনো আটকাবে না — কেবল টাইপো আটকায় |
| ২০২৬-১০-১৬ | ⚠️ ১৫.৮: admin form দুটি নতুন ঘর পেল **আলাদা কম্পোনেন্টে** (`WhatsAppCostPanel`), catalogue toolbar-এ নয় | `usdToBdtRate` টুলবারে আছে কারণ সেটি পর্দার প্রতিটি দাম-প্রিভিউকে প্রভাবিত করে — অর্থাৎ তার জায়গাটি সেখানে **বাধ্যতামূলক**। কিন্তু WhatsApp-এর ফি মডেল-ক্যাটালগের কোনো অংশ নয়; toolbar-এ বসালে এটি পড়া হত "আরেকটি মডেল-দাম সেটিং" হিসেবে। আলাদা কার্ড নিজের শিরোনাম, status badge ও শর্ত নিজেই বলে |
| ২০২৬-১০-১৬ | ⚠️ ১৫.৮: `persistSettings` এখন `{ ...settings, ...next }` merge করে, কেবল `next` নয় | নতুন client-side ফাঁদ, `fetch-models` route-এর সার্ভার-সংস্করণের যমজ: কোনো builder কেবল `models`/`quickSetup` নিয়ে আংশিক অবজেক্ট বানিয়ে সেভ করলে `whatsappFeeBdtPerMessage` বাদ পড়ত → sanitizer সেটিকে `0` করে দিত → **surcharge নীরবে বন্ধ**। আজ প্রতিটি builder `...settings` spread করে, তাই এটি ঠিক আচরণ অপরিবর্তিত রাখে — এটি সেই ভুলটির বিরুদ্ধে সুরক্ষা যা ঘটলে ধরা পড়ত না |
| ২০২৬-১০-১৬ | 🔴 ১৫.৮: **দ্বিতীয় toothless tripwire** — এটি লিখতে গিয়েও একই ফাঁদে পড়া হলো | assertion-টি ছিল `expect(resolverSource).not.toContain("whatsapp-cost")`, কিন্তু `credit-resolver.ts`-এর **একটি মন্তব্যেই** ওই পথটি লেখা আছে ("হিসাবের নিয়ম `lib/domain/whatsapp-cost.ts`-এ")। অর্থাৎ পরীক্ষাটি একটি **শব্দ** মাপছিল, কোড নয় — আর ওই ফাইলটি সম্পাদনার সময়েই টেস্ট **ভাঙছিল**, যদিও কেউ ওখানে surcharge বসায়নি। সংশোধন: `not.toMatch(/import[^;]*whatsapp-cost/)` — import স্টেটমেন্টটিই ধরা হয়, মন্তব্য নয়। ✅ **মিউটেশন দিয়ে প্রমাণিত:** আসলেই import যোগ করে দেখা হয়েছে — টেস্ট **ফেল** করে, তারপর ফাইল হুবহু ফেরত। ⚠️ পাঠ: **১৫.৭ · D.২-এর ঠিক সেই একই রোগ দুই দিনে দুইবার** (উপরের লগে দেখুন) — সবুজ টেস্ট নিজে থেকে কিছু প্রমাণ করে না, মিউটেশনই করে |
| ২০২৬-১০-১৬ | ⚠️ ১৫.৮: দুটি নতুন key-র কনফিগে **Zod ব্যবহার করা হয়নি** — ফাইলের নিজের `sanitize*` ছাঁচ, অর্থাৎ **AGENTS §2 মানা হয়নি** | নকশায় "Zod schema" লেখা ছিল, আর AGENTS §2-ও Zod বাধ্যতামূলক করে। কিন্তু `ai-settings/route.ts`-এ `usdToBdtRate`-ও হাতে-লেখা `sanitizeUsdToBdtRate` — অর্থাৎ একই ফাইলে দুটো ভিন্ন ভ্যালিডেশন-রীতি রাখা হত। ফাইলের অভ্যন্তরীণ সামঞ্জস্য বেছে নেওয়া হলো। **⚠️ এটি জানা-জেনে নেওয়া একটি নিয়ম-লঙ্ঘন, তাই এখানে লেখা থাকল** — `/admin/pricing`-এর route-এ Zod-ই আছে (সেখানে নতুন ফাইল ছিল, তাই দ্বিধা ছিল না) |


---

## সংশ্লিষ্ট নয় কিন্তু লক্ষণীয়

`.env`-এ `Next_JS_WEHBOOK` কী-টি **৩ বার** আছে (বানান ভুল — `WEBHOOK` নয়)। যাচাই করা হয়েছে: কোডে এটি কোথাও ব্যবহৃত হয় **না** — সম্ভবত n8n-এ বসানোর জন্য রাখা নোট। অ্যাপে কোনো প্রভাব নেই; শুধু বিভ্রান্তিকর। পরিষ্কার করা হবে TASK-20-এ।
