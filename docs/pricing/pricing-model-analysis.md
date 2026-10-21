# DRIPLARE AI — Pricing বিশ্লেষণ ও Plan Architecture রিসার্চ প্লান

**তারিখ:** ২০২৬-১০-১৪ · **পাঠক:** founder
**আগের ভার্সন:** `docs/pricing/pricing-model-analysis.md` (২০ মিনিট আগের) — **ভুল ছিল, এই ফাইল তার সংশোধিত ও সম্পূর্ণ রূপ**

---

## ০. সংশোধন — আগে আমি যা ভুল বলেছিলাম

আমি লিখেছিলাম Fast = `gemini-2.5-flash-lite`, Smart = `gpt-4o-mini`, Genius = `gpt-4o`, credit `১/৩/৫`।

ওই চারটি মান আমি নিয়েছিলাম —

- `lib/domain/model-catalog.ts:226-230` → `DEFAULT_QUICK_SETUP`
- `lib/domain/credit-config.ts:57-61` → `CREDIT_COSTS`

**ওগুলো একদম নতুন ইনস্টলের seed**, মানে `ai_credit_rules` row **না থাকলে** যে মান বসে। ফাইলটা নিজেই এটা লিখে রেখেছে (`model-catalog.ts:113-129`: *"row নেই → এই seed-টাই প্রথম মান"*)। আপনার row আছে। তাই ওই মান আপনার সিস্টেমে **কোথাও চলে না**।

আপনার আসল কনফিগ DB-তে, আর আপনার স্ক্রিনশটে সেটাই দেখা যাচ্ছে:

| Preset | Model | Credit |
|---|---|---|
| Fast | DeepSeek V4 Flash 0423 | ৩ |
| Smart | Google Gemini 2.5 Flash | ৫ |
| Genius | Anthropic Claude Sonnet 4 | ১০ |

**শিক্ষা:** seed আর live কনফিগ এক নয়। এই রিপোর্টের প্রতিটি সংখ্যা এখন **আপনার প্যানেল বা আপনার DB** থেকে আসবে — কোডের ডিফল্ট থেকে নয়। যেখানে আপনার ডেটা ছাড়া বের করা অসম্ভব, সেখানে স্পষ্ট করে "অজানা" লেখা থাকবে।

---

## ১. আজ সত্যিই যা সেট আছে

### ১.১ আপনার `/admin/ai-settings`-এ যা দেখা যাচ্ছে (live)

| Model | $/1M (prompt · completion) | Credit | Merchant Active |
|---|---|---|---|
| `openai/gpt-4o-mini` | 0.15 · 0.60 | ৩ | বন্ধ |
| `openai/gpt-4o` | **2.50 · 10.00** | **৩** | বন্ধ |
| `deepseek/deepseek-chat` | 0.26 · 1.03 | ৩ | বন্ধ |
| `meta-llama/llama-3.3-70b-instruct` | **0.10 · 0.32** | **৫** | **চালু** |

Rate: **১ USD = ৳১২৬** (আপনার প্যানেলেই লেখা)

### ১.২ Preset

| Preset | Model | Credit | আসল খরচ $/1M |
|---|---|---|---|
| Fast | `deepseek/deepseek-v4-flash-0423` | ৩ | ⚠️ **অজানা** — আপনার প্যানেলে দেখুন |
| Smart | `google/gemini-2.5-flash` | ৫ | ~0.30 · 2.50 (যাচাই করুন) |
| Genius | `anthropic/claude-sonnet-4` | ১০ | ~3.00 · 15.00 (যাচাই করুন) |

### ১.৩ Plan-এর credit-এর আসল দাম

| কোথায় | দাম ÷ credit | ৳/credit |
|---|---|---|
| BD Starter | ৯৯৯ ÷ ১৫,০০০ | ০.০৬৬৬ |
| BD Business | ২,৪৯৯ ÷ ৫০,০০০ | ০.০৫০০ |
| BD Enterprise | ৪,৯৯৯ ÷ ১,৫০,০০০ | ০.০৩৩৩ |
| Business top-up | ৪০০ ÷ ৫০,০০০ | ০.০০৮০ |
| Enterprise top-up | ২,০০০ ÷ ৫,০০,০০০ | ০.০০৪০ |

---

## ২. মূল রোগ — credit কোনো কিছুর এককই নয়

এটা আপনার স্ক্রিনশট থেকেই প্রমাণযোগ্য, কোনো অনুমান ছাড়াই:

| Model | $/1M | খরচ/reply\* | Credit | **আসল খরচ প্রতি credit** |
|---|---|---|---|---|
| llama-3.3-70b | 0.10 · 0.32 | ৳০.০৬২৫ | **৫** | ৳০.০১২৫ |
| gpt-4o-mini | 0.15 · 0.60 | ৳০.০৯৮৩ | ৩ | ৳০.০৩২৮ |
| deepseek-chat | 0.26 · 1.03 | ৳০.১৭০০ | ৩ | ৳০.০৫৬৭ |
| gemini-2.5-flash | ~0.30 · 2.50 | ৳০.২৪৫৭ | ৫ | ৳০.০৪৯১ |
| **claude-sonnet-4** | ~3.00 · 15.00 | ৳২.০৭৯০ | **১০** | ৳০.২০৭৯ |
| **gpt-4o** | **2.50 · 10.00** | **৳১.৬৩৮০** | **৩** | **৳০.৫৪৬০** |

\* অনুমান: ৪,০০০ prompt + ৩০০ completion token, ৳১২৬/USD (§১২-এ সীমাবদ্ধতা দেখুন)

> **এক credit-এর আসল খরচ ৳০.০১২৫ থেকে ৳০.৫৪৬ — অর্থাৎ ৪৪ গুণ পার্থক্য।**
> "১ credit" মানে নির্দিষ্ট কিছু নয়। তাই credit দিয়ে দাম ঠিক করা মানে মিটার ছাড়া দাম ঠিক করা।

### আর সবচেয়ে খারাপ অংশটা সরাসরি আপনার প্যানেলে দেখা যাচ্ছে

- **llama-3.3-70b** — প্রতি reply খরচ ৳০.০৬২৫ — **৫ credit**
- **gpt-4o** — প্রতি reply খরচ ৳১.৬৩৮, অর্থাৎ llama-র **২৬ গুণ** — **৩ credit**

**যে model ২৬ গুণ বেশি খরচ করায়, তার credit কম।** সিঁড়িটা উল্টো। এটাই "confusing" লাগার আসল কারণ — কারণ এটা আসলেই এলোমেলো, শুধু অনুভূতি নয়।

### আজকের সিঁড়ি বনাম খরচ-সঙ্গত সিঁড়ি

Starter-এর ৳০.০৬৬৬/credit ধরে, **শূন্য মুনাফায়** (break-even) প্রতি model-এ কত credit হওয়া উচিত:

| Model | আজ | Break-even credit |
|---|---|---|
| llama-3.3-70b | ৫ | **~১** |
| gpt-4o-mini | ৩ | ~১–২ |
| deepseek-chat | ৩ | ~৩ ✅ |
| gemini-2.5-flash | ৫ | ~৪ |
| **gpt-4o** | **৩** | **~২৫** |
| **claude-sonnet-4** | **১০** | **~৩১** |

৭০% gross margin চাইলে: gpt-4o ≈ **৮২ credit**, claude-sonnet-4 ≈ **১০৪ credit**।

→ এখানেই আসল কথা: **৳০.০৬৬৬/credit দামে premium model লাভে বেচা অসম্ভব।** ১৫,০০০ credit-এর plan-এ ৮২ credit/reply মানে মাত্র ১৮৩টা premium reply।

---

## ৩. Preset-প্রতি আসল হিসাব

| Preset | Credit | খরচ/reply | Starter-এ (৳০.০৬৬৬) | Business-এ (৳০.০৫) | Enterprise-এ (৳০.০৩৩৩) |
|---|---|---|---|---|---|
| Fast | ৩ | ⚠️ অজানা | — | — | — |
| **Smart** | ৫ | ৳০.২৪৬ | **+২৬%** | **−২%** | **−৪৮%** |
| **Genius** | ১০ | ৳২.০৭৯ | **−২১২%** | **−৩১৬%** | **−৫২৪%** |

**চারটি নির্মম সত্য:**

1. **Genius প্রতি plan-এ লোকসান।** কোনো ব্যতিক্রম নেই।
2. **plan যত দামি, লোকসান তত বেশি** — Enterprise সবচেয়ে খারাপ (−৫২৪%)। অর্থাৎ আপনার সবচেয়ে বড় গ্রাহকই সবচেয়ে বেশি লোকসান করান।
3. **Smart Business plan-এ ঠিক break-even** (−২%) — মানে Smart সবচেয়ে বেশি ব্যবহৃত preset হলে ব্যবসা চলে, কিন্তু কোনো মুনাফা নেই।
4. **Top-up সবচেয়ে বিপজ্জনক** — ৳০.০০৮/credit-এ Genius reply বেচা মানে **২৫× লোকসান**। যে গ্রাহক সবচেয়ে বেশি টাকা দিচ্ছেন (top-up কিনছেন), তিনি সবচেয়ে বেশি লোকসান করাচ্ছেন।

### এই লোকসান কি আজ টের পাচ্ছেন?

বেশিরভাগ সম্ভাবনায় **না** — কারণ:

- **Breakage** — অধিকাংশ merchant credit শেষ করেন না
- **Genius কম ব্যবহার** — বেশিরভাগ গ্রাহক Fast/Smart-এ থাকেন
- **স্কেল ছোট** — ১০ জন merchant-এ এটা কাগজে ক্ষতি, ১,০০০-এ সেটাই ديwal

কিন্তু **যে merchant সত্যিই credit খরচ করবেন — তিনিই আপনার সবচেয়ে সক্রিয়, সবচেয়ে সন্তুষ্ট, সবচেয়ে কম churn-করা গ্রাহক।** এই ধরনের pricing বাগ ঠিক তাঁদেরই শাস্তি দেয়।

---

## ৪. দ্বিতীয় রোগ, যা সংখ্যা বদলে সারবে না

**credit একটা per-reply কাউন্টার। খরচ per-token।**

একই preset, একই credit — অথচ দুই merchant:

| | Merchant A | Merchant B |
|---|---|---|
| Knowledge base | ৫ পেজ | ২০০ পেজ |
| Conversation history | ৩ মেসেজ | ২০ মেসেজ (`contextWindowLength: 20`) |
| বাংলা reply | সংক্ষিপ্ত | লম্বা (বাংলা ইংরেজির চেয়ে বেশি token নেয়) |
| Prompt token | ~১,৫০০ | ~১২,০০০ |
| **আসল খরচ** | ৳০.১২ | **৳১.১০** |
| **credit কাটা** | ৫ | **৫** |

**Merchant B ৯ গুণ বেশি খরচ করান, একই দামে।**

→ তাই credit-এর সংখ্যা এদিক-ওদিক করে (§২-এর টেবিল) সমস্যাটা **কমবে, সারবে না**। কাউন্টারটা token-এর কথা জানে না, আর কখনো জানবে না।

**এর তিনটি সমাধান (§৯-এ বিস্তারিত):**

| | কী | ভালো | খারাপ |
|---|---|---|---|
| **ক** | credit-কে token-ভিত্তিক করা (১ credit = N token) | খরচের সাথে নিখুঁত মিল | merchant আন্দাজ করতে পারে না — bill shock |
| **খ** | per-reply credit রাখা, কিন্তু **আসল ব্যবহারের p90 মেপে** প্রতি preset-এ প্রতি plan-এ আলাদা মান বসানো | merchant-এর কাছে সহজ ও পূর্বানুমেয় | p90-এর বাইরের ভারী ব্যবহার এখনো লোকসান |
| **গ** | **hybrid** — per-reply base + token overage (Stripe/২০২৬-এর consensus) | base পূর্বানুমেয় + tail সুরক্ষিত | সবচেয়ে বেশি কাজ |

**সুপারিশ: এখন (খ) → পরে (গ)।** (ক) করবেন না — merchant-facing একক হিসেবে token কখনো গ্রহণযোগ্য নয়।

---

## ৫. যা ঠিক আছে — হাত দেবেন না

| # | যা | কেন রক্ষা করা দরকার |
|---|---|---|
| ১ | **credit-এর এক সূত্র** — `credit-resolver.ts`; admin override → কোড default → fallback | আগে n8n-এ `15`, কোডে tier মান, DB-তে admin মান — তিন রকম ছিল (`credit-resolver.ts:19-28`) |
| ২ | **Per-model credit admin-editable** — `ai_credit_rules.models[].credits` | **deploy ছাড়াই আজ দাম ঠিক করা যায়** (§৭.১) |
| ৩ | **Plan hierarchy এক জায়গায়** — `PLAN_KEYS`-এর ক্রমই hierarchy | "কোন plan বড়" দুবার লেখা যায় না |
| ৪ | **মডেল-অনুমতির একটাই নিয়ম** — `canUseProMode` = "plan কি paid?" | ইচ্ছে করেই per-plan model allow-list মুছে দেওয়া হয়েছে (`plan-config.ts:44-49`) |
| ৫ | **Region-aware, hardcode-মুক্ত** — `cheapestPaidPlan()` কখনো `"growth"` লিখে না | BD-তে growth নেই; BD merchant-কে কেনা-অসম্ভব plan দেখানো হত |
| ৬ | **USD→BDT read-time রূপান্তর** — `costBdt` কখনো যোগ করা হয় না | rate বদলালে পুরনো report-এ দুই rate মিশে ভুল দেখাত |
| ৭ | **`unit-economics` "জানি না"-কে `null` বলে, `0` নয়** | `0` মানে "কিছুই দেন না" — সুস্থ Enterprise account-ও রক্তক্ষরণ দেখাত |
| ৮ | **Minimum ৫ মডেল Merchant Active থাকতেই হবে** — `MIN_ACTIVE_MODELS` | admin ভুলে সব বন্ধ করলে merchant কিছুই পেতেন না |
| ৯ | **`scheduledDowngradePlan` + `process-downgrades` cron আগেই আছে** | trial বানাতে **নতুন রেল লাগবে না** (§১০-এ বড় পাওনা) |
| ১০ | **Top-up pack-এর দাম হিসাবসঙ্গত** — ৳০.০০৮ / ০.০০৫ / ০.০০৪ (ভলিউম ডিসকাউন্ট) | কাজ করে; তবে দামগুলোই খরচের নিচে (§৩) |

---

## ৬. টার্গেট: ৩-ধাপের পরিষ্কার ল্যাডার + আলাদা Enterprise লেন

আপনার সমস্যাটা হলো আজ **৭টি plan নাম** আছে (BD ৩ + Global ৪), তাতে চারটি আলাদা axis মিশে আছে — capacity, capability, model access, support — এবং প্রতিটি plan-এর feature-লিস্ট বাস্তবের সাথে মেলে না।

### ৬.১ নীতি — তিনটি প্রশ্ন, তিনটি axis

| Axis | প্রশ্ন | কত দিয়ে মাপা হয় |
|---|---|---|
| **কত** | গ্রাহক কতটা চালাবেন? | chatbot সংখ্যা, channel, credit |
| **কী** | গ্রাহক কী করতে পারবেন? | Pro mode, automations, live inbox, e-commerce |
| **কেমন সেবা** | কত দ্রুত সাহায্য? | onboarding, support, SLA |

আজ এই তিনটা একসাথে গুলিয়ে দেওয়া। আলাদা করলেই "confusing" ভাবটা চলে যায়।

### ৬.২ সবচেয়ে বড় নীতি: Starter-কে অসম্পূর্ণ করবেন না

Starter এমন হতে হবে যেটা দিয়ে গ্রাহক **সত্যিই ব্যবসা চালাতে পারেন** — অর্থাৎ গ্রাহকের প্রশ্নের উত্তর দিতে পারে, product দেখাতে পারে, order নিতে পারে। যে জিনিস gate করবেন সেগুলো **উৎপাদনশীলতার** ফিচার, **মূল কাজের** নয়।

কারণ পরিষ্কার: Starter কেটে ফেললে trial-এ থাকা গ্রাহক প্রোডাক্টের আসল শক্তি দেখতেই পান না → activation পড়ে যায় → conversion পড়ে।

### ৬.৩ প্রস্তাবিত ল্যাডার (সংখ্যাগুলো প্রস্তাব — চূড়ান্ত নয়)

| | **Starter** | **Growth** | **Business** |
|---|---|---|---|
| দাম (BD) | ৳৯৯৯ | ৳১,৯৯৯ | ৳৩,৯৯৯ |
| Chatbot | ১ | ৩ | ১০ |
| Channel / chatbot | ২ | ৫ | সব |
| Platform | Facebook + Website | + Instagram + **WhatsApp** | সব |
| Credit / মাস | ১৫,০০০ | ৪০,০০০ | ১,০০,০০০ |
| Model preset | Fast, Smart | Fast, Smart | Fast, Smart, **Genius** |
| Pro mode | ❌ | ✅ | ✅ |
| Automations | ❌ | সীমিত | ✅ |
| Live Inbox | ❌ | ✅ | ✅ |
| E-commerce / Orders | ❌ | ✅ | ✅ |
| Auto-Train / Product Sync | ❌ | ✅ | ✅ |
| Analytics | মৌলিক | ✅ | ✅ + export |
| Credit top-up | ❌ | ✅ | ✅ |
| Support | email | priority | dedicated + onboarding |

**আগের রিপোর্টের ভুল সংশোধন:** আগে আমি WhatsApp-কে Business-এ রাখার পক্ষে ছিলাম। **নয়** — BD-তে WhatsApp হলো সবচেয়ে চাওয়া channel। ওটা Starter-এ না থাকলে entry plan-টা অনেক BD ব্যবসার কাছে অর্থহীন; কিন্তু **Growth-এ রাখলে** সেটাই সবচেয়ে শক্তিশালী upsell হয় (৳৯৯৯ → ৳১,৯৯৯, কোনো ২.৫× লাফ ছাড়া)।

**যা এখনো ঠিক করা বাকি:** ৳৯৯৯ → ৳১,৯৯৯ → ৳৩,৯৯৯ — এই তিন ধাপপ্রতি ঠিক কত credit, সেটা §১১-এর গবেষণা ছাড়া ঠিক করা যাবে না।

### ৬.৪ Enterprise — 별도의 লেন, ল্যাডারের অংশ নয়

আপনার প্রশ্ন: *"কিভাবে আরও সুন্দর একটা Enterprise plan-এ কনভার্ট করা যায়?"*

**উত্তর: Enterprise-কে ল্যাডারে রাখবেন না। ওকে একটা আলাদা "কথা বলুন" লেন বানান।**

কারণ:

1. **আপনার top tier যা advertise করে, তার বেশিরভাগ নেই** — Team Access নেই, Custom Integration নেই, SLA নেই, Advanced Model Customization নেই (Business আর Enterprise-এর model access হুবহু এক)। একটা plan যা এমন জিনিস বেচে যেটা নেই, সেটা enterprise-এর মতো দেখায়ও না, বিশ্বাসযোগ্যও নয়।
2. **আপনার নিজের হিসাবেই Enterprise সবচেয়ে লোকসানি plan** (−৫২৪% Genius-এ, −৪৮% Smart-এ)।
3. **`contact: true` + admin-এর `manual_invoice` action আগেই আছে** — অর্থাৎ bulk-and-negotiate লেনটার কারিগরি ভিত্তি **ইতিমধ্যেই তৈরি**।

**করণীয়:** Enterprise = "Contact us", দাম প্রকাশিত নয়, চুক্তিতে যা থাকবে তা **প্রতি-গ্রাহক আলাদা করে লিখে দেওয়া** — SLA, seat, custom integration, onboarding, credit volume। promises গুলো তখন কোডে না রেখে **চুক্তিতে** রাখা হয়, আর প্রতিশ্রুতির সাথে বাস্তবের মিল রাখার দায়িত্ব আপনার বিক্রয় প্রক্রিয়ার।

আর যদি সত্যিই self-serve enterprise চান, তাহলে আগে এই তিনটার অন্তত দুটো বানাতে হবে: **annual billing + invoice/PO**, **team seat**, **SLA + support tier**। তিনটাই আজ নেই।

---

## ৭. আজই করা যায়, deploy ছাড়া

> ⚠️ **এই সেকশনটা stopgap** — হাতে সংখ্যা ঠিক করা। প্রকৃত সমাধান §১৭: credit নিজে নিজে দাম থেকে বের হবে, আপনি হাতে লিখবেন না। কিন্তু §১৭-এর আগে এই মুহূর্তে যা করা যায় তা এই:

**`/admin/ai-settings` → model প্রতি `credits` বদলে দিন।**

`ai_credit_rules.models[].credits` **admin override** — `resolveReplyCredits` (`credit-resolver.ts:198-204`) সবসময় এটাকেই কোড-ডিফল্টের আগে রাখে। অর্থাৎ:

| Model | আজ | প্রস্তাবিত (break-even + margin ধরে) |
|---|---|---|
| llama-3.3-70b | ৫ | **১–২** (কমিয়ে দিন — আজ বেশি নিচ্ছেন) |
| gpt-4o-mini | ৩ | ৩–৫ |
| deepseek-chat | ৩ | ৩ (ঠিক আছে) |
| gemini-2.5-flash (Smart) | ৫ | ৫–৮ |
| **claude-sonnet-4 (Genius)** | **১০** | **৬০–১০০** |
| **gpt-4o** | **৩** | **৬০–১০০** |

⚠️ **দুটো সাবধানতা:**

1. **এটা উপসর্গের চিকিৎসা।** credit বাড়ালে per-reply-বনাম-per-token ফাঁকটা (§৪) থেকে যায় — ভারী merchant এখনো একই দামে ৯ গুণ খরচ করাবেন।
2. **merchant-এর দেখা সংখ্যা বদলে যাবে।** ড্যাশবোর্ডে "Genius — ১০ credit" লেখা থাকলে ১০ → ৮০ করলে গ্রাহক হঠাৎ দেখবেন তাঁর credit ৮ গুণ দ্রুত শেষ হচ্ছে। **এটা যোগাযোগ ছাড়া করা যাবে না** — হয় সৎভাবে জানান, নয় টেক্সট বদলান ("Genius — premium, ৮× credit")।

---

## ৮. AI Feature গেটিং — আপনার দ্বিতীয় প্রশ্নের উত্তর

### ৮.১ প্রথমে একটা জরুরি কথা: **দুটো lever** থাকার কথা ছিল — কিন্তু একটা নেই

> 🔴 **সংশোধন (২০২৬-১০-১৪, ১৫.৩-এ মাপা):** নিচের বাক্যটি — *"ওগুলোর প্রায় সবই ইতিমধ্যেই credit-এ মিটারে আছে"* — **ভুল ছিল**। [`lib/domain/ai-task.ts:81-95`](../../lib/domain/ai-task.ts#L81-L95) পড়ে দেখা গেল **`isCharged: true` কেবল `chat`-এ**; এই টেবিলে নাম থাকা সাতটি AI task-ই `false`। অর্থাৎ `credit-config.ts`-এ দামগুলো **লেখা আছে**, কিন্তু **কারও কাছে কাটা হয় না**। ফাইলটি নিজেই লিখেছে: *"That is a revenue leak, not a design choice"* (→ TASK-25)। তাই **lever একটাই — gate**, যতক্ষণ meter সারানো না যায়।

আপনি চাইছেন dashboard-এর AI feature গুলো Pro/Growth/Business-এর জন্য gate করতে। লেখার সময় ধরা হয়েছিল ওগুলো credit-এ মিটারে আছে ([credit-config.ts:73-87](lib/domain/credit-config.ts#L73-L87)) — enhance ২০ credit, auto-train ৫০, product-sync ৩০, embedding ৫/১০০KB। ⚠️ **কিন্তু উপরের সংশোধন দেখুন: কোড কোথাও ওই credit কাটে না।**

| Lever | কখন ব্যবহার করবেন |
|---|---|
| **Meter (credit)** | যে feature খরচ করে কিন্তু **পার্থক্য তৈরি করে না** — সব plan-এ থাকুক, খরচটা credit-এ উঠুক |
| **Gate (plan)** | যে feature **বিক্রির কারণ** — গ্রাহক ওটার জন্যই বেশি দাম দিতে রাজি হন |

দুটো একসাথে করলে ভুল হবে: gate করা feature-এর credit নিলে গ্রাহক দ্বিগুণ দণ্ড পায় (দাম + credit) — এবং ওই credit ইতিমধ্যেই ক্ষতির।

### ৮.২ প্রতিটি AI feature-এর তালিকা ও সুপারিশ

| Feature | কোথায় | আজ গেটেড? | আজ মিটারড? | সুপারিশ |
|---|---|---|---|---|
| **Model Compare Arena** | `chatbots/[chatbotId]/compare/route.ts:220` | ✅ Pro-only | ✅ ২ model-এর base যোগ | রাখুন (এটাই সবচেয়ে সৎ গেট — Pro-এর সংজ্ঞা) |
| **Prompt Enhancer** | `chatbots/enhance-prompt/route.ts:34` | ❌ | ✅ ২০ credit | **gate করবেন না** — এটা activation feature; ২০ credit যথেষ্ট |
| **Prompt Enhancer (legacy)** | `chatbots/[chatbotId]/enhance-prompt/route.ts` | — | — | ✅ **১৫.৩-এ মুছে ফেলা হলো** — যাচাই করে দেখা গেল এর কোনো caller নেই (dead code) |
| **Prompt Translate** | `chatbots/translate-prompt/route.ts:36` | ❌ | ? | gate নয় — অল্প খরচ, setup-এর অংশ |
| **Product extract (FB posts → catalogue)** | `lib/ai/product-extract.ts:140` | ❌ | ⚠️ **শুধু লেখা আছে, কাটা হয় না** | **Growth+ gate করুন** — bulk/batch কাজ, এটাই পার্থক্যকারী |
| **Auto-Train engine** | `lib/ai/auto-train.ts:127` | ❌ | ⚠️ **লেখা আছে, কাটা হয় না** | **Growth+ gate করুন** |
| **Product text ingest** | `products/text-ingest/route.ts:87` | ❌ | ⚠️ **লেখা আছে, কাটা হয় না** | Growth+ (bulk) |
| **Embeddings — knowledge base** | `lib/ai/source-ingestion.ts:72,112` | ❌ | ⚠️ **লেখা আছে, কাটা হয় না** | **Starter-এ সীমিত সংখ্যক source** (যেমন ১০), Growth+ অসীম |
| **Embeddings — products/FAQ/sample** | `lib/ai/qa-training.ts` | ❌ | ⚠️ **লেখা আছে, কাটা হয় না** | Growth+ |
| **Automations engine + broadcast** | `lib/automations/*` | ❌ **একদমই ungated** | ❌ | **Growth+ gate করুন** — আপনার সবচেয়ে বড় অব্যবহৃত বিক্রয়-অস্ত্র |
| **Live Inbox / human takeover** | `app/(dashboard)/dashboard/inbox/*` | ❌ ungated | ❌ | **Growth+ gate করুন** (Global Business-এর লেখায় আছে, কিন্তু কোডে গেট নেই) |
| **E-commerce / Orders / Courier** | `app/api/orders/*` · `app/api/couriers` | ✅ **১৫.৩-এ গেট হলো** | ❌ | ✅ **সম্পন্ন** — লেখার path গেট, পড়া খোলা (§৮.৩) |

### ৮.৩ গেট করার আগে যে ফাঁকগুলো বন্ধ করতে হবে — ✅ **পাঁচটিই বন্ধ (১৫.৩)**

| ফাঁক | কোথায় ছিল | কেন জরুরি | ফল |
|---|---|---|---|
| **Legacy enhance-prompt gateway bypass** | `chatbots/[chatbotId]/enhance-prompt/route.ts` | raw `fetch` + `process.env.OPENROUTER_API_KEY` + হার্ডকড `google/gemini-2.5-flash` — **credit কাটে না, gateway-এর fallback/retry/latency log পায় না** | ✅ **ফাইলটি মুছে ফেলা হলো** — যাচাই করে দেখা গেল এর **কোনো caller নেই** (রেপো, টেস্ট, n8n — কোথাওও নয়), অর্থাৎ dead code |
| **`allowedPlatforms` শুধু ৭টা route-এ চেক হত** | generic `[platform]/connect` (website widget সহ সব) · `n8n_source/connect` | Starter-এর তালিকায় নেই এমন channel-ও যোগ করা যেত — আর generic route-টিই একমাত্র যেখানে slug আসে **URL থেকে** | ✅ generic route-এ gate যোগ; `n8n_source` ইচ্ছে করেই বাদ (channel নয়, ingest rail) |
| **Top-up gate কেবল client-side** | `TopUpCards.tsx` → `applyPaymentGrant` | direct API কলে Starter-ও Business-দামের pack কিনতে পারতেন | ✅ `uddoktapay/charge`-এ `isPackageAllowedForPlan` — **grant-এ নয়**, কারণ তখন টাকা চলে গেছে |
| **E-commerce গেট নেই** | `app/api/orders/**` (৭টি) · `app/api/couriers` | "No E-Commerce Integration" লেখা, কিন্তু সবাই ব্যবহার করতে পারতেন | ✅ **লেখার** ৭টি path গেট; **পড়া** খোলা (নিজের ইতিহাস যেন না হারায়) |
| **`canAddIntegration` সব route-এ ছিল না** | `usage-limit.ts` যেখানে ডাকা হয় তার বাইরে | নীরব ফাঁক | ✅ যোগ হলো — আর তখনই **একটি লাইভ bug** ধরা পড়ল: ছাদের উপরে reconnect-ও আটকাত |

**নীতি (এখন কোডে প্রয়োগ করা):** **UI-তে দেখান (upsell সহ), API-তে enforce করুন।** লুকিয়ে রাখলে গ্রাহক জানতেই পারেন না যে ভালো কিছু আছে; কেবল UI-তে আটকালে direct API কলে বেড়া টপকানো যায়।

⚠️ **একটি ব্যতিক্রম ইচ্ছে করেই:** E-Commerce-এ **পড়া খোলা রাখা হলো**। "No E-Commerce Integration" সীমাটি **তৈরি করার** উপর, **দেখার** উপর নয়। plan বদলালে merchant তাঁর নিজের বিক্রির ইতিহাস দেখতে না পারলে সীমাটি তাঁর নিজের ডেটা লুকিয়ে ফেলত — শাস্তি হত গ্রাহকের উপরে, অথচ অপরাধটি ছিল না।

### ৮.৩.১ গেটের নীতি এখন কোথায় থাকে — চারটি pure function

| ফাংশন | প্রশ্ন |
|---|---|
| `getPlanIfDefined(region, key)` | এই region-এ এই নামে plan আছে কি না |
| `planAllowsPlatform(plan, region, slug)` | এই channel খোলা কি না |
| `planAllowsEcommerce(plan, region)` | courier + orders আছে কি না |
| `isPackageAllowedForPlan(id, plan, region)` | এই package কেনা যাবে কি না |

⚠️ **`getPlan`-এর বদলে `getPlanIfDefined` কেন:** `getPlan("bd","growth")` চুপচাপ **starter** দেয় (BD-তে `growth` নেই)। gating-এ সেটি ব্যবহার করলে legacy `growth`/`pro` merchant — যিনি সত্যিই পরিশোধ করেছেন — Starter-এর সীমায় পড়ে channel হারাতেন, কোনো error ছাড়াই। তাই এই region জানা না-থাকা key → **fail-open**।

⚠️ **এবং এখন §৮.৪-এর তালিকাটাই ১৫.৩-এর পরের আসল কাজ।** উপরের চারটি ফাংশন যা করতে পারে তা হলো "এই feature-টি এই plan-পায় কি না" — কিন্তু Automations, Knowledge Base ও Live Inbox এখনো **কোনো plan-এর তালিকাতেই নেই**, তাই ওগুলো gate করার আগে ঠিক করতে হবে ওগুলো **কোন plan-এ বিক্রি করছেন**। সেটি ১৫.৪ (ল্যাডার) ও ১৫.৫-এর কাজ, কোডের নয়।


### ৮.৪ কোন ফিচার plan-এ **advertised-i নেই** — অথচ কাজ করে

- **Automations** (engine + blueprint + broadcast + Activity log) — পূর্ণ কাজ করে, কোনো plan-এর তালিকায় নেই
- **Knowledge Base / RAG** (file, website, FAQ, sample reply, Auto-Train) — পূর্ণ কাজ করে, তালিকায় নেই
- **Referrals** (১,৫০০ credit/referral)
- **Live Inbox / human takeover**

→ এগুলোই আপনার **আসল পার্থক্যকারী**, অথচ বিক্রয়-তালিকায় অনুপস্থিত। আর তালিকায় যা আছে তার অর্ধেক অস্তিত্বহীন (§১৩)।

---

## ৯. Model access কোন plan-এ কতটা

তিনটি পথ, একটা বেছে নিতে হবে:

| | পথ | কেমন লাগবে |
|---|---|---|
| **১** | **Preset-সিলিং** — Starter/Growth = Fast+Smart, Business+ = Genius | পরিষ্কার, সহজ, কিন্তু Starter-এর গ্রাহক "সেরাটা" দেখতেই পান না → trial-এ ক্ষতি |
| **২** | **সবাই সব preset পায়, কিন্তু credit-দাম plan-ভেদে আলাদা** | সবচেয়ে নমনীয়; "একই জিনিস সবার জন্য, দাম আলাদা" — কিন্তু `planRank`-এর এক-নিয়ম নীতির বাইরে যায় |
| **৩** | **সবাই সব preset পায়, credit-দাম খরচ-সঙ্গত (§৭)** | সবচেয়ে সৎ — gpt-4o-র দাম ৮০ credit, যে চান তিনি ব্যবহার করুন, দামটাই সত্যি কথা বলে |

⚠️ **`plan-config.ts:44-49`-এ যা লেখা আছে সেটা মনে রাখুন:** per-plan model allow-list ইচ্ছে করেই মুছে দেওয়া হয়েছে, কারণ মডেল বন্ধ করার প্রভাব প্রিসেটের ভেতর দিয়ে পরোক্ষে পড়ত, আর admin পর্দা বনাম merchant বাস্তব মেলানো কঠিন হত।

→ **সুপারিশ: (৩) মূল কৌশল, সাথে (১)-এর হালকা সংস্করণ।** অর্থাৎ credit-দাম খরচ থেকে জন্মাক (§৭), আর **trial-এ সব preset খুলে দিন** যাতে গ্রাহক সেরাটা দেখে আসক্ত হন — বিক্রয়ের কাজটা করবে credit-এর সৎ দাম, কৃত্রিম তালা নয়।

---

## ১০. Free trial — ৩/৫/৭ দিন

### ১০.১ বড় পাওনা: নতুন রেল লাগবে না

| যা দরকার | যা ইতিমধ্যেই আছে |
|---|---|
| Trial শেষে plan নামানো | `User.scheduledDowngradePlan` + `scheduledDowngradeAt` (`auth.prisma:14-15`) |
| কার্যকর করার engine | `lib/domain/plan-downgrade.ts:310-331` (`applyScheduledDowngrades`) |
| Cron | `app/api/cron/process-downgrades` — `vercel.json`-এ দৈনিক ০০:০০ |
| UI | `ScheduledDowngradeBanner.tsx`, `payments/manage/route.ts` |
| Merchant-এর জানার সুযোগ | `app/api/usage/route.ts:166-167` |

⚠️ **তবে:** TASK-22 (🔴 Clerk সব `/api/cron/*` আটকায়) এখনো বাকি। ওটা না সারলে trial **কখনো শেষ হবে না** — এটা এই ডিজাইনের একমাত্র কঠিন নির্ভরতা।

### ১০.২ যা নতুন লাগবে — এবং কেন

`scheduledDowngradePlan` দিয়ে বোঝা যায় **কী হবে**, কিন্তু **কেন** — অর্থাৎ "এটা কি trial-এর শেষ, নাকি paid plan-এর downgrade?" — সেটা বোঝা যায় না। এই পার্থক্য দরকার, কারণ:

- trial শেষে গ্রাহককে আলাদা banner/mail দেখাতে হবে
- trial শেষে **মাসিক free credit বন্ধ** করতে হবে (নইলে Starter-এ নেমে চিরকাল ১৫,০০০ credit ফ্রি — এটাই আজকের সবচেয়ে বড় ফাঁক, §১৩)
- একই গ্রাহক দ্বিতীয়বার trial নিতে পারবেন কি না, সেটা ঠিক করতে হবে

**প্রস্তাব:** `User`-এ একটি nullable column — `trialEndsAt DateTime?` (অথবা `trialStartedAt` + `trialEndsAt`)। **Additive-only, কোনো `DROP` নেই।**

> 🔴 **DDL নিয়ম:** `prisma db push` **চালানো যাবে না**। আগে
> `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script`
> চালিয়ে diff **আপনাকে দেখাতে হবে**, অনুমোদন নিতে হবে, তারপর আলাদা SQL চালাতে হবে।

### ১০.৩ কত দিন, আর কত ক্ষমতা

| প্রশ্ন | সুপারিশ | কারণ |
|---|---|---|
| **কত দিন** | **admin-configurable** (`ai_credit_rules`-এ, হার্ডকড নয়) — ডিফল্ট **৭** | আপনি পরীক্ষা করতে পারবেন; `plan-config.ts`-এর `trialDays` (৩/১৪) আজ কোথাও ব্যবহৃতই হয় না — ওটা প্রমাণ যে হার্ডকড করা ভুল |
| **কোন plan-এর ক্ষমতা** | **Business** (top self-serve) | গ্রাহক ছাদের সেরাটা দেখে আসক্ত হন; trial-এর কাজ activation, বিক্রয় নয় |
| **কত credit** | **ছোট, বাঁধা** — যেমন ২,০০০–৫,০০০ | ⚠️ নিচে দেখুন |
| **কার্ড লাগবে?** | ❌ না | UddoktaPay one-off (`region.ts:47`) — recurring নেই, তাই auto-charge-ই অসম্ভব |

### ১০.৪ ⚠️ Trial-এর নিরাপত্তা ফাঁক — এটা এড়ানো বাধ্যতামূলক

যদি trial-এ Business-এর পূর্ণ credit (১,০০,০০০) দেন আর Genius preset খুলে দেন:

**১,০০,০০০ credit ÷ ১০ credit/reply = ১০,০০০ reply × ৳২.০৭৯ = ৳২০,৭৯০**

→ অর্থাৎ **প্রতিটি trial account থেকে ৳২০,৭৯০ পর্যন্ত OpenRouter খরচ তুলে নেওয়া সম্ভব, এক টাকাও না দিয়ে।** ১০০টা ভুয়া account = ৳২০ লক্ষ।

**তাই তিনটা তালা একসাথে:**

1. **Trial-এর credit ছোট ও বাঁধা** (২,০০০–৫,০০০), plan-এর পূর্ণ allowance নয়
2. **Trial-এ Genius বন্ধ, বা Genius-এর credit সত্যিকারের দামে** (§৭)
3. **প্রতি গ্রাহক একবারই** — `PaymentTransaction`/`AIUsageLog` ইতিহাস + Clerk user id ধরে; একই ফোন/ইমেইল দিয়ে পুনরায় চেষ্টা আটকান

সাথে দরকার: trial-এর খরচ **প্রতিদিন মনিটর** করা (আপনার `/admin/observability` দিয়ে) — আর অস্বাভাবিক দেখলে হাত দিয়ে বন্ধ করার একটা রাস্তা।

### ১০.৫ Trial শেষে কী হবে

| | সুপারিশ | কারণ |
|---|---|---|
| ডিফল্ট গন্তব্য | **Starter** (hard lock নয়) | পণ্য ব্যবহারযোগ্য থাকে, গ্রাহক ফিরে আসতে পারেন — soft churn |
| মাসিক free credit | **বন্ধ** | নইলে free-forever leak (§১৩) |
| যোগাযোগ | ৭, ৩, ১ দিন আগে mail + in-app banner | bill shock নয়, **service shock**-ও খারাপ |
| Data | **কিছুই মুছবেন না** | data হারালে ফিরে আসার সম্ভাবনা শূন্য |

---

## ১১. রিসার্চ প্লান — কোন প্রশ্ন, কোন ডেটা, কোথা থেকে

**এই ছয়টা প্রশ্নের উত্তর ছাড়া §৬-এর সংখ্যাগুলো চূড়ান্ত করা যাবে না।** *(R1–R5 মাপা হয়ে গেছে — ফল §১৯-এ, প্রশ্নওয়ালা ক্রমে।)*

| # | প্রশ্ন | ডেটা কোথা থেকে | কেন দরকার |
|---|---|---|---|
| **R1** | প্রতি preset-এ **আসল median ও p90 খরচ/reply** কত? বাংলা বনাম ইংরেজি আলাদা করে? | `/admin/observability` → `AIUsageLog.costUsd`, `task = "chat"` | **সবচেয়ে জরুরি।** §২-এর সব সংখ্যা এই একটা মাপের উপর দাঁড়ানো। আমার token অনুমান (৪,০০০/৩০০) এটা দিয়ে প্রতিস্থাপন করতে হবে |
| **R2** | আজকের **credit utilisation** কত? কত % credit প্রতি মাসে খরচ হয়? কত % গ্রাহক top-up কেনেন? | `AIUsageLog`, `CreditTransaction`, `PaymentTransaction` | breakage-এর আসল মাপ। এটাই ঠিক করবে আজকের লাভটা সত্যি না ভাগ্য |
| **R3** | কোন dashboard AI feature **কতবার** ব্যবহার হয়? | `AIUsageLog.task` ভাগ করে (`enhance_prompt`, `auto_train`, `product_sync`, `compare`, embedding) | কোনটা gate করলে কষ্ট কম আর পার্থক্য বেশি — §৮-এর সিদ্ধান্ত এটার উপর |
| **R4** | **প্রতিযোগীর আসল দাম** | vendor-দের নিজের pricing পেজ — ManyChat, Wati, respond.io, Tidio, LazyChat, BotSailor, unichat.bd, NexStep — ✅ **মাপা হয়েছে, §১৯.৯** | BD-র ৳৯৯৯/১,৯৯৯/৩,৯৯৯ বাজারে কোথায় দাঁড়ায় |
| **R5** | **WhatsApp-এর per-conversation fee কে দেয় — আপনি নাকি merchant?** | Meta Business / WhatsApp Cloud API billing + `Integration.config` | ⚠️ আজ এই খরচ **কোথাও মিটারে নেই**। Meta-র conversation fee আপনার অ্যাকাউন্টে পড়লে প্রতি WhatsApp গ্রাহকই নীরব লোকসান। চ্যানেল-ভিত্তিক দামের আগে এটার উত্তর লাগবে |
| **R6** | আজ **signup → first payment** কত %? | `User.createdAt` বনাম `PaymentTransaction` | trial নেই, তাই এটাই baseline। trial চালু করার পরে এটার সাথে তুলনা করবেন |

### R5 কেন আলাদা করে জরুরি

আপনার `Integration` মডেল WhatsApp-কে যুক্ত করে, কিন্তু **Meta-র নিজের message/conversation fee** কোনো `AIUsageLog`-এ লেখা হয় না — কারণ ওটা OpenRouter-এর খরচ নয়। আপনার `computeUnitEconomics` কেবল `AIUsageLog.costUsd` যোগ করে (`unit-economics.ts:61-62`)।

**→ আজকের লাভ/লক্ষ্য হিসাবটা WhatsApp গ্রাহকের জন্য অসম্পূর্ণ।** এই একটা প্রশ্নের উত্তর বাকি সব দামের আগে দরকার।

### গবেষণার পদ্ধতি (প্রতিটি প্রশ্নে একই নিয়ম)

1. **নিজের ডেটা আগে** — অনুমান নয়, `AIUsageLog`-এর আসল সংখ্যা
2. **যা মাপা যায় না, সেটা "অজানা" লিখুন** — `unit-economics.ts`-এর `null` নীতির মতো। ভরা সংখ্যা না থাকার চেয়ে খারাপ
3. **প্রতিটি সংখ্যার সূত্র লিখে রাখুন** — এই রিপোর্টে আমার ভুলটা (§০) ঠিক এই কারণে হয়েছিল

---

## ১২. সীমাবদ্ধতা — যা এই রিপোর্টে অনুমান

| অনুমান | মান | আসল কোথায় |
|---|---|---|
| প্রতি reply-তে token | ৪,০০০ prompt + ৩০০ completion | `AIUsageLog.promptTokens` / `completionTokens` (**R1**) |
| USD→BDT | ৳১২৬ | আপনার প্যানেল — ইতিমধ্যেই ঠিক |
| gemini-2.5-flash দাম | $0.30 / $2.50 | তৃতীয় পক্ষের সূত্র থেকে; **আপনার প্যানেলে live মান আছে** |
| claude-sonnet-4 দাম | $3.00 / $15.00 | একই |
| Fast (deepseek-v4-flash-0423) দাম | **অজানা** | আপনার প্যানেল |
| gpt-4o / gpt-4o-mini / llama / deepseek-chat | **আপনার স্ক্রিনশট থেকে — নিশ্চিত** | — |

তৃতীয় পক্ষের সূত্রে gemini-2.5-flash-এর দুটো মান পাওয়া গেছে ($0.30/$2.50 OpenRouter-এ, $0.15/$0.60 Google-এর direct API-তে)। **আপনার প্যানেল যেটা দেখায় সেটাই সত্য**, কারণ ওটা OpenRouter-এর live snapshot।

---

## ১৩. ছোট কিন্তু আসল সমস্যা (পricing নয়, তবু টাকা)

| সমস্যা | প্রমাণ | প্রভাব |
|---|---|---|
| **Free-forever leak** | `reset-credits` cron **সব user**-কে মাসিক credit দেয়, Global Starter-কে ($০) সহ; `trialDays` কোথাও ব্যবহৃত হয় না | Global Starter-এর "১৪ দিনের trial" কখনো শেষ হয় না → চিরকাল ৫০০ credit/মাস, কোনো checkout নেই (`region.ts:55`) |
| **`Infinity` credit** | Global Enterprise `includedCredits: Infinity` → `getPlanCredits` sanitize করে ১,৫০,০০০ করে | তালিকায় "Unlimited Credits" লেখা, বাস্তবে সীমিত |
| **BD Starter paid অথচ Globals Starter-এর চেয়ে কম advertised** | Global Starter: "Web Widget"; BD Starter (৳৯৯৯): "Facebook Channel Only" | টাকা দেওয়া গ্রাহকের তালিকা ফ্রি গ্রাহকের চেয়ে দুর্বল দেখায় |
| **Annual billing নেই** | `pricing.json`-এ "Yearly (save 20%)" লেখা আছে, **কোনো কম্পোনেন্টে ব্যবহৃত হয় না**; `billingInterval` কোথাও নেই | অগ্রিম cash + কম churn হাতছাড়া |
| **Overage নেই** | credit শেষে `quota-guard` আটকে দেয় | আয়ের সুযোগ হাতছাড়া, আর গ্রাহকের AI চুপচাপ বন্ধ (service shock) |
| **Setup fee নেই** | BD প্রতিযোগীরা ৳১০,০০০–২৫,০০০ নেয় | bazar norm হাতছাড়া |
| **খালি প্রতিশ্রুতি** | Team Access, All Couriers (১/৩ — শুধু Steadfast), Custom Integration, Advanced Model Customization, Priority Support, SLA, 3/14-day trial | সব **নেই** (§১৪) |

---

## ১৪. খালি প্রতিশ্রুতির তালিকা (marketing বনাম কোড)

| প্রতিশ্রুতি | কোথায় লেখা | বাস্তব |
|---|---|---|
| "Team Access" | Global Business | **নেই** — `Workspace`-এ একজনই owner, কোনো member/invite model নেই |
| "E-Commerce (All Couriers)" | BD Business | **১/৩** — শুধু Steadfast কাজ করে; Pathao/RedX credential ফর্ম আছে, API কল নেই |
| "Custom Integration" | BD Enterprise | **নেই** |
| "Advanced Model Customization" | BD Enterprise | **নেই** — Business ও Enterprise-এর model access **হুবহু এক** |
| "Priority Support" / "SLA & Dedicated Support" | Global | **নেই** — শুধু string |
| "3-day free trial" / "14-day trial" | দুই region | **`trialDays` কোথাও ব্যবহৃত হয় না** |

**নীতি:** হয় কোড লিখুন, নয় টেক্সট সরান। একটা মিথ্যা প্রতিশ্রুতি একটা হারানো গ্রাহক — আর BD বাজারে মুখের কথা সবচেয়ে দ্রুত ছড়ায়।

---

## ১৫. সাব-টাস্ক ও ক্রম

| # | সাব-টাস্ক | নির্ভরতা | DB লেখে? |
|---|---|---|---|
| **১৫.১** | **R1–R6 চালান** — `/admin/observability` ও DB থেকে আসল সংখ্যা; এই রিপোর্টের প্রতিটি অনুমান প্রতিস্থাপন — ✅ **সম্পন্ন, §১৯** | — | ❌ (কেবল পড়া) |
| **১৫.২** | **Credit-দাম স্বয়ংক্রিয়ভাবে দাম থেকে উদ্ভাবন (§১৭)** — `targetBdtPerCredit` একটাই admin সংখ্যা; বাকি ২০টা মডেলের credit নিজে নিজে বের হবে; diff preview + "Apply" + ±২০% সীমা — ✅ **সম্পন্ন (কোড), §১৭.৬ · §১৯.১০** | ১৫.১ | ⚠️ হ্যাঁ (PlatformSetting) |
| **১৫.৩** | **Feature গেটিং** — §৮-এর ম্যাট্রিক্স; ৫টি enforce-ফাঁক বন্ধ (§৮.৩), **§১৯.১২** | ১৫.১ (R3) | ❌ |
| **১৫.৪** | **৩-ধাপের ল্যাডার** — Starter/Growth/Business চূড়ান্ত, বৈধতা ও i18n | ১৫.১, ১৫.২ | ❌ |
| **১৫.৫** | **Enterprise-কে আলাদা লেন করা** — "Contact us", নেগোসিয়েটেড চুক্তি, `manual_invoice` পথ | ১৫.৪ | ❌ |
| **১৫.৬** | **Free trial** — `trialEndsAt` DDL + `process-downgrades` রেল + abuse তালা + banner/mail | ১৫.৪, **TASK-22** | ⚠️ হ্যাঁ (DDL) |
| **১৫.৭** | **Annual billing + overage/auto top-up** | ১৫.৪ | ⚠️ হ্যাঁ |
| **১৫.৮** | **WhatsApp channel-এর নিজস্ব খরচ মিটার করা** (R5-এর ফল) | ১৫.১ | ? |
| **১৫.৯** | 🔴 **`reset-credits` cron-এ "টাকা দিয়েছে কি না" যাচাই যোগ করা (§১৮.২খ)** | ১৫.১ | ❌ কোড, তবে live cron-এর আচরণ বদলায় |

**ক্রম:** ১৫.১ → ১৫.২ → ১৫.৩ → ১৫.৪ → ১৫.৫ → **১৫.৯** → ১৫.৬ → ১৫.৭

> 🔴 **১৫.৯ ট্রায়ালের আগে বাধ্যতামূলক (১৫.৬-এর পূর্বশর্ত)।** নইলে ট্রায়াল শেষ হওয়া প্রতিটি account প্রতি ৩০ দিনে plan-এর পূর্ণ credit পেতেই থাকবে — চিরকাল (§১৮.২খ)। ট্রায়াল চালু করে ১৫.৯ পরে করলে leak-টা ততদিন বাড়তেই থাকবে, আর প্রতিটি দিনেরই মূল্য আছে।

⚠️ **১৫.২ ও ১৫.৬ DB-তে লেখে** — তাই প্রতিটির আগে অনুমোদন লাগবে। আর ১৫.২ merchant-এর দেখা credit সংখ্যা বদলায়, তাই **যোগাযোগের পরিকল্পনা ছাড়া ship করা যাবে না।**

---

## ১৬. ঝুঁকি ও যা ইচ্ছে করেই করা হবে না

| ঝুঁকি | প্রশমন |
|---|---|
| Trial abuse (৳২০,৭৯০/account পর্যন্ত) | §১০.৪-এর তিনটি তালা — ছোট credit, Genius বন্ধ, প্রতি user একবার |
| Cron আটকে থাকলে trial কখনো শেষ হয় না | TASK-22 আগে সারতে হবে (§১০.১) |
| Credit সংখ্যা বদলে গ্রাহক বিভ্রান্ত | যোগাযোগ + UI-তে সৎ লেবেল ("premium — ৮× credit") |
| সংখ্যাগুলো আবার অনুমান হয়ে যাওয়া | ১৫.১-এর আগে কোনো সংখ্যা চূড়ান্ত করা হবে না (§১৬-এর শেষ সারি) |
| বিদ্যমান গ্রাহকের দাম হঠাৎ বদলানো | grandfathering — পুরনো গ্রাহকের plan/credit অপরিবর্তিত রাখা, কেবল নতুন signup-এ নতুন দাম |

### যা ইচ্ছে করেই করা হবে না

- **`prisma db push`** — কখনোই নয়; সবসময় `migrate diff` দেখিয়ে অনুমোদন
- **Per-plan model allow-list ফিরিয়ে আনা** — `plan-config.ts:44-49`-এ ঠিক কেন এটা মুছে দেওয়া হয়েছিল লেখা আছে; সেটাই আবার ভাঙা হবে
- **Prompt Enhancer গেট করা** — activation feature; credit-ই যথেষ্ট
- **Free plan-কে চিরকাল credit দেওয়া** — এটাই আজকের leak (§১৩)
- **সংখ্যা এদিক-ওদিক করে আসল ফাঁক ঢাকা** — আসল ফাঁক per-reply-বনাম-per-token (§৪), ওটা token-এর হিসাব ছাড়া সারবে না

---

## ১৭. Credit-এর দাম হাতে সেট করা বন্ধ করা (১৫.২-এর প্রকৃত রূপ)

### ১৭.১ এখন যা হচ্ছে

Admin প্যানেলে প্রতি মডেলের জন্য credit হাতে লেখা হয়। **২০টা মডেল Merchant Active হলে ২০টা সংখ্যা হাতে লেখা** — এবং প্রতিটাই ভুল হওয়ার সুযোগ।

**প্রমাণ যে এভাবে চলে না** — আপনার নিজের প্যানেলে আজ দুইটা মডেল উল্টো সেট করা আছে:

| Model | `MODEL_TIER_MAP` ডিফল্ট | Admin দিয়েছেন |
|---|---|---|
| `openai/gpt-4o` | premium → ৫ credit | **৩** |
| `meta-llama/llama-3.3-70b-instruct` | standard → ৩ credit | **৫** |

অথচ gpt-4o-র আসল খরচ llama-র **২৬ গুণ**। মানুষ ২০টা সংখ্যা চোখে মিলিয়ে রাখতে পারে না — এটা মানুষের দোষ নয়, পদ্ধতির।

### ১৭.২ নাম দেখে tier অনুমান কেন ব্যর্থ

`getModelTier()` (`credit-config.ts:150-178`) মডেলের **নামের প্যাটার্ন** দেখে tier ঠিক করে। নাম আর দামের সম্পর্ক নেই:

| Model | নাম শুনে | আসল দাম ($/1M) |
|---|---|---|
| `google/gemini-2.5-flash-lite` | সস্তা | ~০.১০ / ০.৪০ |
| `google/gemini-2.5-flash` | **সস্তা** | ~০.৩০ / ২.৫০ |

একই "flash" শব্দে **১০ গুণ** দামের ফারাক। এছাড়া `MODEL_TIER_MAP`-এ না থাকা নতুন মডেল `standard`-এ পড়ে — একটি সস্তা নতুন মডেল চুপচাপ ৩ credit হয়ে যেতে পারে, বা একটি দামি মডেলও।

### ১৭.৩ যা ইতিমধ্যেই তৈরি আছে

| যন্ত্র | ফাইল | কাজ |
|---|---|---|
| **আসল লাইভ দাম** | `lib/ai/model-pricing.ts` → `resolveModelPrice(modelId)` | OpenRouter থেকে প্রতি মডেলের $/1M আনে ও cache করে (৫ মিনিট memory → PlatformSetting `openrouter_pricing` → কোড fallback)। আপনি প্যানেলে যে $ দাম দেখেন, ওটাই এই |
| Refresh + مشاهدة | `refreshPricingSnapshot()`, `getPricingSnapshotInfo()` | "Sync pricing" চাওয়া বা cron |
| Tier অনুমান | `getModelTier()` | নাম দেখে (১৭.২-এর সমস্যা) |
| Resolution order | `resolveReplyCredits()` | admin override → tier default → fallback |

**অভাব কেবল একটাই জায়গায়: tier টা দাম থেকে আসা উচিত, নাম থেকে নয়।**

### ১৭.৪ প্রস্তাবিত পরিবর্তন

**একটি ফাংশল বদল + একটি নতুন admin সংখ্যা।**

```
credit = ceil( (promptTokens × promptPrice + completionTokens × completionPrice) ÷ 1e6 × usdToBdtRate ÷ targetBdtPerCredit )
```

Admin যা সেট করবেন — **শুধু একটি সংখ্যা**: `targetBdtPerCredit` (যেমন ৳০.০৬)।

- token সংখ্যা হার্ডকড নয় — `AIUsageLog.promptTokens`/`completionTokens`-এর **আসল p75** প্রতি preset-এ (১৫.১-এর R1 থেকে), তাই সিস্টেম নিজে নিজে শিখবে
- নতুন মডেল যোগ হলে credit স্বয়ংক্রিয়ভাবে বের হবে — `MODEL_TIER_MAP`-এ হাত দেওয়ার দরকার নেই
- OpenRouter দাম বদলালে credit অনুসরণ করবে
- admin override থাকবে **ব্যতিক্রমের জন্য**, নিয়মের জন্য নয়

### ১৭.৫ পুরোপুরি অটোমেটিক নয় — কেন

Merchant "Genius = ১০ credit" দেখে অভ্যস্ত। হঠাৎ ৭০ হলে সে বিশ্বাস হারায় → churn। তাই:

1. Cron প্রতিদিন হিসাব করবে (কোনো DB লেখা নেই)
2. Admin প্যানেলে **diff** দেখাবে: মডেল · এখনকার credit · প্রস্তাবিত credit · কারণ (দাম বদলেছে / token অনুমান বদলেছে)
3. Admin একবার "Apply" চাপবেন
4. **±২০% সীমা** — এর বেশি বদলালে স্বয়ংক্রিয়ভাবে লাগবে না, শুধু পতাকা উঠবে (OpenRouter হঠাৎ দাম বাড়ালে মুনাফা নীরবে খেয়ে না ফেলে)

এটাই `unit-economics.ts`-এর `null` নীতির মতো একই ভাব: **সিস্টেম সিদ্ধান্ত নেয় না, সিদ্ধান্তের তথ্য দেয়।**

### ১৭.৬ যা আসলে বানানো হলো — আর এই নকশা থেকে যা বদলাল (২০২৬-১০-১৪)

| এই নকশায় ছিল | যা বানানো হলো | কেন বদলাল |
|---|---|---|
| Cron প্রতিদিন হিসাব করবে | **কোনো cron নেই** — admin প্যানেল খোলার সময়েই হিসাব হয় (`GET /api/admin/ai-settings/derivation`) | Cron কেবল একটা diff বানাত, আর কেউ না দেখলে সেটি কোন কাজে লাগত না। প্যানেল খোলার মুহূর্তে হিসাব মানে **সবসময় আজকের দাম**, আর পর্দায় যা দেখা যায় ঠিক সেটাই Apply হয় — দুইটা আলাদা সংখ্যার সুযোগই নেই |
| token-অনুমান R1-এর আসল p75 হবে | **৪,০০০ + ৩০০ অনুমানই থাকল** | R1-এর ৪৫টি row-এর ৪০টিই playground, **০টি `exact`** — অর্থাৎ নিজেই অনুমান; কারণ §১৯.২-তে |
| `targetBdtPerCredit` কোথায় থাকবে — বলা ছিল না | **নিজের আলাদা `ai_credit_derivation` row** | `ai_credit_rules`-এর **চারটি writer পুরো value একবারে বদলে দেয়** (model add, fetch-models, validate-models, openrouter-service)। ওখানে রাখলে পরের বার একটি মডেল যোগ করলেই admin-এর target চুপচাপ মুছে যেত |
| ±২০% সীমা | সীমা অপরিবর্তিত, তবে পাশে **"Confirm all N"** বোতাম | আসল ৩৪টি মডেলে **৩৩টিই** সীমা ছাড়িয়ে গেছে — অর্থাৎ Apply চিরতামাটি নিষ্ক্রিয় থাকত, যদি admin ৩৩টি বাক্স হাতে টিক না দিতেন |

⚙️ **নীতিটা অটুট রইল:** `resolveReplyCredits()`-এর একটি লাইনও বদলানো হয়নি। derivation বিলিং-এর সময়ে চলে না — সে কেবল সংখ্যাগুলো `ai_credit_rules.models[].credits`-এ **লিখে দেয়**, যা বিলিং আগে থেকেই পড়ত (admin override)। তাই কোনো নতুন resolution স্তর নেই, আর **কেউ Apply না চাপলে merchant-এর credit বদলায় না**।

📊 আসল ৩৪টি মডেলে চালানোর ফল — §১৯.১০।

---

## ১৮. ট্রায়ালের খরচ নিয়ন্ত্রণ — আসল সংখ্যা

### ১৮.১ ভয়ের জায়গা ভুল

"সবাই সমান use করবে" — এটা সমস্যা নয়। **প্রিপেইড রিচার্জের মতো**: credit শেষ হলে `quota-guard` নিজেই আটকে দেয়। যে একদিনে শেষ করে আর যে এক মাসে — খরচ একই, কারণ **ছাদটা credit-এ, সময়ে নয়**।

### ১৮.২ আসল সমস্যা দুইটা

**(ক) একবারের খরচ ৯ গুণ বেশি হিসাব হচ্ছে**

| | আজকের credit-দামে | ৳০.০৬/credit-এ |
|---|---|---|
| সর্বোচ্চ ৳/credit (gpt-4o) | ৳০.৫৪৬ | ৳০.০৫৯ |
| ৩,০০০ credit-এর সর্বোচ্চ খরচ | **৳১,৬৩৮** | **৳১৮০** |

→ **১৭-এর কাজটাই ট্রায়ালের সবচেয়ে বড় সুরক্ষা।** আলাদা কোনো প্রক্রিয়া লাগে না।

**(খ) ⚠️ প্রতি মাসে credit আবার — এটাই আসল বিপদ**

`app/api/cron/reset-credits/route.ts:33-38` — এই cron `creditsResetDate <= now` এমন **সব** user-কে plan-এর পূর্ণ credit দেয়। **টাকা দিয়েছে কি না, তা দেখে না।**

মানে ট্রায়াল শেষে Starter-এ নামার পরে গ্রাহক **প্রতি ৩০ দিনে ১৫,০০০ credit পেতেই থাকবেন — চিরকাল, এক টাকা না দিয়ে**:

| ১০০ জন non-converting ট্রায়াল | মাসিক credit | আজকের দামে | ১৭ করার পরে |
|---|---|---|---|
| চিরকাল, প্রতি মাসে | ১৫,০০,০০০ | **৳৮,১৯,০০০** | **৳৯০,০০০** |

**এইটাই "বিল অনেক হবে" — ট্রায়াল নয়, ট্রায়ালের পরে যা হয়।**

### ১৮.৩ তিনটি তালা (গুরুত্বের ক্রমে)

| # | তালা | কেন প্রথমে |
|---|---|---|
| ১ | **Credit-এর দাম খরচ থেকে উদ্ভূত করা (§১৭)** | ৯ গুণ কমায়; একই কাজে trial + profitability দুইটাই ঠিক হয় |
| ২ | **Trial-expired account-কে `reset-credits` skip করা** | এইটা ছাড়া খরচ **চিরকাল** বাড়তেই থাকবে — একবারের নয় |
| ৩ | **Trial-এ credit ছোট, একবারই, মাসিক রিসেট নেই, top-up বন্ধ** | ছাদটা absolute রাখে |

### ১৮.৪ Trial credit-এর সূত্র

```
trial credits = গ্রহণযোগ্য CAC (৳) ÷ সর্বোচ্চ ৳/credit
```

উদাহরণ: CAC ৳৩০০ ÷ ৳০.০৬ = **৫,০০০ credit** → সর্বোচ্চ খরচ ৳৩০০।
BD Business ৳২,৪৯৯ → **৮ জন ট্রায়ালে ১ জন কিনলেই খরচ উঠে যায়।**

এই কারণেই হার্ডকড "৩ দিন / ৫,০০০ credit" নয় — **CAC থেকে বের হওয়া সংখ্যা**, আর CAC বদলালে trial credit-ও বদলাবে।

### ১৮.৫ আসল abuse vector: একজন, বহু account

একজন বেশি use করলে ছাদ ৳৩০০-ই থাকে। কিন্তু একজন **১০০টা account** বানালে ছাদ ১০০ গুণ। তাই:

| তালা | কীভাবে |
|---|---|
| এক Clerk account = এক trial | `User.userId` + `PaymentTransaction`/`AIUsageLog` ইতিহাস |
| **আসল channel লাগবে** | একটি আসল Facebook page / WhatsApp number connect না করলে trial activate হবে না — ভুয়া account সহজ, ১০০টা আসল page কঠিন। একইসাথে trial-টা সত্যিকারের হয় |
| প্রতিদিন নজর | `/admin/observability` — trial account-গুলোর cost/day |
| হাত-দিয়ে বন্ধ | অস্বাভাবিক দেখলে trial বাতিল করার একটা রাস্তা |

### ১৮.৬ Trial শেষে

| | | কারণ |
|---|---|---|
| ডিফল্ট | **Starter** (hard lock নয়) | পণ্য ব্যবহারযোগ্য থাকে, ফিরে আসার পথ খোলা |
| মাসিক credit | **বন্ধ** (তালা ২) | নইলে চিরকালের leak |
| ডেটা | **কিছুই মোছা হবে না** | ডেটা হারালে ফিরে আসার সম্ভাবনা শূন্য |
| যোগাযোগ | ৭ · ৩ · ১ দিন আগে mail + in-app banner | bill shock নয়, **service shock**-ও খারাপ |

---

## ১৯. পরিমাপ — R1–R6-এর ফল (২০২৬-১০-১৪)

> এই সেকশনের প্রতিটি সংখ্যা **ডেটাবেস থেকে গোনা** অথবা **প্রোডাকশনের নিজের মডিউল দিয়ে হিসাব করা** — কোনো অনুমান নেই। যেখানে মাপা যায়নি, সেখানে "মাপা যায়নি" লেখা আছে।

### ১৯.১ যন্ত্রটা

`scripts/pricing-research.ts` — সম্পূর্ণ **read-only**। ভেতরে `create` / `update` / `upsert` / `delete` নেই, raw SQL নেই। ডেটাবেসে একটিও row লেখা হয় না।

```bash
npm run pricing:research              # মানুষের পড়ার জন্য
npm run pricing:research -- --json    # + docs/pricing/research-output.json
```

⚠️ `--conditions=react-server` লাগে, শো-এর জন্য নয়। `credit-resolver.ts` ও `model-pricing.ts` শুরু হয় `import "server-only"` দিয়ে, যার default entry throw করে; এই condition-এ সেটি খালি module-এ resolve হয় — ঠিক যেমন Next.js server component-এর ভেতরে হয়। ফলে script **প্রোডাকশনের ঠিক সেই ফাংশনগুলোই** কল করে (`deriveModelCredits`, `getCreditRules`, `resolveModelPrice`) — নকল করে লেখা কোনো হিসাব নেই, তাই এখানকার সংখ্যা আর প্রোডাক্টের সংখ্যা আলাদা হতে পারে না।

### ১৯.২ R1 — আসল reply-এর token সংখ্যা

| | |
|---|---|
| মোট row | **৪৫** (২০২৬-০৯-২৫ → ২০২৬-১০-১৪) |
| `costSource = "exact"` | **০** — সবগুলো `estimated` |
| `channel = "playground"` | **৪০ / ৪৫** |
| `task` | **৪৫টিতেই `null`** |

| | prompt | completion |
|---|---|---|
| আজ ধরে নেওয়া (`DEFAULT_EXPECTED_REPLY_TOKENS`) | ৪,০০০ | ৩০০ |
| মাপা p75 | **২,০১৪** | **৫৪৮** |

**সিদ্ধান্ত: অনুমানটাই রাখা হচ্ছে — মাপাটা দিয়ে বদলানো হচ্ছে না।** তিনটি কারণ, প্রতিটাই যাচাইযোগ্য:

1. **৪৫টি row-এর ৪০টিই `playground`** — অর্থাৎ ড্যাশবোর্ডে আপনি নিজে টেস্ট করেছেন। আসল merchant-এর ট্রাফিক নয়।
2. **একটিও `exact` নয়** — সব `estimated`, যার মানে token সংখ্যাগুলো নিজেই টেক্সটের দৈর্ঘ্য থেকে **অনুমান করা**। অর্থাৎ এটা অনুমানের অনুমান।
3. **আসল ট্রাফিক কম হবে না** — Knowledge Base-এর RAG context আর বাংলা লেখা prompt সংখ্যা উপরে ঠেলে। টেস্ট চ্যাটে কোনো KB ছিল না।

ভালো দিকটা হলো দিকটা: ৪,০০০ + ৩০০ অনুমানটা **merchant-এর কাছ থেকে বেশি নেয়, কম নয়** (gpt-4o-তে ৳১.৬৩৮ বনাম ৳১.৩২৫)। ভুল হলে ভুলটা প্ল্যাটফর্মের পক্ষে — যা সঠিক দিক।

> 📌 `AIUsageLog`-এ **preset (Fast/Smart/Genius) লেখা হয় না** — কেবল resolved `modelId`। তাই "preset-প্রতি token" মাপা এই স্কিমায় সম্ভবই নয়; নতুন কলাম ছাড়া (১৫.২-এর বাইরে)।

### ১৯.৩ R1b — ৩৪টি মডেলের **৩৪টিই** ভুল দামে

লাইভ `ai_credit_rules`-এ ৩৪টি মডেল সেট করা আছে। ৪৫৫-মডেলের OpenRouter snapshot থেকে দাম নিয়ে, মাপা token-এ (২,০১৪ + ৫৪৮) হিসাব করলে:

| model | CONFIGURED | DERIVED | cost/reply |
|---|---|---|---|
| `deepseek/deepseek-v3.2` | 1 | 7 | ৳০.১২১ |
| `deepseek/deepseek-v4-flash` | 3 | 2 | ৳০.০৩৬ |
| `deepseek/deepseek-v4-flash-0731` | 5 | 3 | ৳০.০৪৮ |
| `openai/gpt-4o-mini` | 3 | 4 | ৳০.০৭৯ |
| `deepseek/deepseek-chat` | 3 | 8 | ৳০.১৪৩ |
| `deepseek/deepseek-chat-v3.1` | 3 | 7 | ৳০.১২৯ |
| `deepseek/deepseek-r1` | 3 | 18 | ৳০.৩৫০ |
| `meta-llama/llama-3.3-70b-instruct` | 5 | 11 | ৳০.২০৪ |
| `google/gemini-2.5-flash` | 5 | 13 | ৳০.২৪৯ |
| `google/gemini-2.5-flash-image` | 3 | 13 | ৳০.২৪৯ |
| `deepseek/deepseek-v4-pro` | 3 | 19 | ৳০.৩৭৪ |
| `anthropic/claude-haiku-4.5` | 3 | 30 | ৳০.৫৯৯ |
| `deepseek/deepseek-v4-pro-0813` | 3 | 31 | ৳০.৬০৮ |
| `anthropic/claude-sonnet-5` | 5 | 60 | ৳১.১৯৮ |
| `openai/gpt-4o` | **3** | **67** | ৳১.৩২৫ |
| `anthropic/claude-sonnet-4` | 10 | 90 | ৳১.৭৯৭ |
| `anthropic/claude-sonnet-4.5` | 5 | 90 | ৳১.৭৯৭ |
| `anthropic/claude-sonnet-4.6` | 5 | 90 | ৳১.৭৯৭ |
| `anthropic/claude-opus-4.5` | 5 | 150 | ৳২.৯৯৫ |
| `anthropic/claude-opus-4.6` | 5 | 150 | ৳২.৯৯৫ |
| `anthropic/claude-opus-4.7` | 20 | 150 | ৳২.৯৯৫ |
| `anthropic/claude-opus-4.8` | 20 | 150 | ৳২.৯৯৫ |
| `anthropic/claude-opus-5` | 20 | 150 | ৳২.৯৯৫ |
| `anthropic/claude-fable-5` | 30 | 300 | ৳৫.৯৯০ |
| `anthropic/claude-opus-4.1` | 40 | 450 | ৳৮.৯৮৫ |
| *(৬টি মডেল — দামই snapshot-এ নেই, নিচে)* | 3–50 | — | — |

**কোনোটাই টিকিয়ে রাখা যায় না।** `gpt-4o` ৩ credit-এ ৳১.৩২৫-এর reply দিচ্ছে — অর্থাৎ একটি credit ৳০.০২০-এর বদলে ৳০.৪৪-এ বিক্রি হচ্ছে, **২২ গুণ লোকসানে**।

আর যেগুলো সিঁড়িটাকেই উল্টো করে দেয় (এগুলো আন্দাজ নয়, গোনা):

```
❌ openai/gpt-4o-mini          ৳০.০৭৯ → ৩ credit
   deepseek-v4-flash-0731      ৳০.০৪৮ → ৫ credit     (কম দাম, বেশি credit)
❌ deepseek-v3.2               ৳০.১২১ → ১ credit
   openai/gpt-4o-mini          ৳০.০৭৯ → ৩ credit     (বেশি দাম, কম credit)
❌ openai/gpt-4o               ৳১.৩২৫ → ৩ credit
   anthropic/claude-sonnet-5   ৳১.১৯৮ → ৫ credit
❌ anthropic/claude-sonnet-4.5 ৳১.৭৯৭ → ৫ credit
   anthropic/claude-sonnet-4   ৳১.৭৯৭ → ১০ credit    (একই দাম, দ্বিগুণ credit)
```

#### 🔴 নতুন ফাঁদ যা এই রান ধরে ফেলল: দাম না থাকলে derivation মিথ্যা বলছিল

**৬টি মডেল OpenRouter-এর ৪৫৫-মডেল snapshot-এই নেই**, তাই `resolveModelPrice()` তার placeholder দাম ($০.১৫ / $০.৬০) বসাচ্ছিল — আর derivation সেটাকে **আসল দাম ভেবে** credit বের করছিল:

| model | CONFIGURED | placeholder থেকে "derived" |
|---|---|---|
| `anthropic/claude-opus-4` | 40 | **4** |
| `anthropic/claude-opus-4.7-fast` | 50 | **4** |
| `anthropic/claude-opus-4.8-fast` | 30 | **4** |
| `anthropic/claude-opus-5-fast` | 30 | **4** |
| `anthropic/claude-3-haiku` | 3 | 4 |
| `deepseek/deepseek-r1-distill-llama-70b` | 3 | 4 |

একটা "Apply" বাটন থাকলে চারটি মডেলের credit **৩০–৫০ থেকে ৪-এ** নেমে যেত — শূন্যে নয়, কিন্তু কার্যত বিনামূল্যে। কারণটা স্পষ্ট: `priceUnknown` তখন কেবল দাম **অবৈধ** হলে true হতো (NaN/ঋণাত্মক), আর placeholder দাম একটা বৈধ সংখ্যা।

**ঠিক করা হয়েছে** (`credit-derivation.ts`): `DeriveCreditsInput`-এ `priceSource` যোগ হয়েছে, আর `"fallback"` হলে মডেলটি `priceUnknown: true` পায় — তখন `planCreditUpdate()` **নতুন সংখ্যা প্রস্তাবই করে না**, admin-এর বসানো মানটাই ফিরিয়ে দেয় verdict `needs_review` সহ। ৪টি টেস্টে পিন করা, যার একটি হুবহু এই `50 → 4` কেসটাই ধরে।

> এই ফাঁদটা **১৫.১ চালানোর আগে অজানা ছিল** — কাগজে-কলমে হিসাবে ধরা পড়ত না, কারণ কাগজে placeholder দাম কখনো আসে না।

#### আর একটি মিলিয়ে দেখা দরকার

আপনার প্যানেলের স্ক্রিনশটে `meta-llama/llama-3.3-70b-instruct` ছিল $০.১০ / $০.৩২, কিন্তু OpenRouter-এর আজকের snapshot বলছে **$০.৫৯ / $০.৭৯**। `deepseek/deepseek-chat`-এও ভিন্নতা ($০.২৬/$১.০৩ বনাম **$০.৩২/$০.৮৯**)। ছয়টির মধ্যে চারটি মিলেছে, দুইটি মেলেনি।

দুইটাই হতে পারে — দাম সত্যিই বদলেছে, বা প্যানেল বাসি snapshot দেখাচ্ছে। **যেটাই হোক, এর মানে একটাই দাঁড়ায়:** হাতে-লেখা credit যে দামের উপর দাঁড়িয়ে ছিল, সেটাই বাসি ছিল। এটাই §১৭-এর পুরো যুক্তি — দাম থাকবে **এক জায়গায়** (live snapshot), আর credit সেই দাম থেকেই প্রতিবার বেরোবে। ১৫.২-তে প্যানেল যে দাম দেখাবে আর derivation যে দাম ব্যবহার করবে — **একটাই সূত্র** হতে হবে।

### ১৯.৪ R2 — যা পাওয়া গেল: **top-up pack-গুলো খরচের নিচে বিক্রি হচ্ছে** 🆕

`payment-packages.ts` থেকে, আর ৳০.০২০ target ধরে:

| pack | দাম | credit | ৳/credit | প্ল্যাটফর্মের খরচ | ফল |
|---|---|---|---|---|---|
| `topup_50k_business_bdt` | ৳৪০০ | ৫০,০০০ | ৳০.০০৮ | ৳১,০০০ | **−৳৬০০** |
| `topup_100k_business_bdt` | ৳৮০০ | ১,০০,০০০ | ৳০.০০৮ | ৳২,০০০ | **−৳১,২০০** |
| `topup_50k_enterprise_bdt` | ৳২৫০ | ৫০,০০০ | ৳০.০০৫ | ৳১,০০০ | **−৳৭৫০** |
| `topup_100k_enterprise_bdt` | ৳৪৫০ | ১,০০,০০০ | ৳০.০০৪৫ | ৳২,০০০ | **−৳১,৫৫০** |

Plan-এর সাথে তুলনা করুন: Business plan ৳২,৪৯৯-এ ৫০,০০০ credit দেয় — অর্থাৎ merchant-এর কাছে ৳০.০৫/credit। Top-up ঠিক সেই credit-ই দিচ্ছে **৳০.০০৮-এ**, যা plan-এর চেয়ে **৬.২৫ গুণ সস্তা** — এবং **খরচের ২.৫ গুণ নিচে**।

এটা উল্টো, দুইবার:
- **অর্থনীতির দিক থেকে:** top-up credit plan credit-এর চেয়ে **দামি** হওয়া উচিত। সস্তা হলে merchant upgrade না করে top-up-ই করবেন — আর তাতে আপনি প্রতি pack-এ ৳৬০০–১,৫৫০ হারাবেন।
- **অর্থাৎ আজ যিনি top-up কেনেন, তিনি upgrade করলে আপনি বেশি পেতেন আর কম হারাতেন।**

**সমাধান দাম বাড়ানো নয় — credit সংখ্যা কমানো।** ৳৪০০-এ ৫০,০০০-এর বদলে ~২০,০০০ credit (৳০.০২০/credit, break-even) — এবং তার উপরে একটা margin রেখে ~১৫,০০০। Merchant-এর কাছে বার্তাটা পরিষ্কার থাকে: "plan নিলে প্রতি credit সস্তা"।

### ১৯.৫ R2b — আজ কোনো সংকট নেই, আর সেটাই সবচেয়ে জরুরি খবর

| | |
|---|---|
| মোট user | **৫** |
| কোনোদিন pay করেছে | ৪ (**৮০%** — n=৫, অর্থহীন) |
| মোট পাওয়া টাকা | **৳৩৬,৪৮১** (২১টি payment) |
| মোট AI খরচ | **$০.০৭৭৬** = **৳৯.৭৮** |
| credit utilisation | ০% – ১.৬% |

**প্ল্যাটফর্ম আজ লোকসান করছে না।** ৳৩৬ হাজার আয়ের বিপরীতে AI-তে খরচ ৳১০। §২-§৪-এর সমস্ত "লোকসান" **ভবিষ্যতের**, বর্তমানের নয় — এবং সেটা ভালো খবর: আপনি সময়মতো ধরতে পেরেছেন, টাকা খুইয়ে শেখার দরকার নেই।

তবে এখান থেকেই সবচেয়ে অস্বস্তিকর সত্যটা আসে: **এই ৫ জন user আর ৪৫টি টেস্ট মেসেজ দিয়ে কোনো pricing সিদ্ধান্ত যাচাই করা অসম্ভব।** অনুপাত, churn, কোন feature কেউ ব্যবহার করে — কোনোটাই এখনো মাপা যায় না। তাই ১৭.৪-এর `targetBdtPerCredit = ৳০.০২০` আজ দাঁড়িয়ে আছে **সূত্রের উপর, ডেটার উপর নয়** — এবং সূত্রটা সৎ: ১৫,০০০ / ৫০,০০০ / ১,৫০,০০০ allowance-এ ৭০% / ৬০% / ৪০% margin।

### ১৯.৬ R2c — `growth` plan-এর ভূত

`paymentTransaction`-এ:

| packageId | payment | টাকা |
|---|---|---|
| `business_bdt` | ৮ | ৳১৯,৯৯২ |
| `growth_bdt` | ১১ | ৳১০,৯৮৯ |
| `manual_invoice` | ২ | ৳৫,৫০০ |

`growth_bdt` = **legacy** (৳৯৯৯, backward-compat-এর জন্য রাখা)। কিন্তু ডেটাবেসে আজও **২ জন user-এর `plan = "growth"`** — অথচ `plan-config.ts`-এর **BD ক্যাটালগে `growth` বলে কিছু নেই** (ওটা Global plan, $২৯)।

এতে দুটো প্রশ্ন:
1. `getPlanCredits("growth", "bd")` ওই দুই user-কে কী দেয়? (fallback-এর উপর নির্ভরশীল)
2. ১৫.৪-এর ল্যাডার বদলানোর সময় ওই দুই user-কে **`starter`-এ migrate** করতে হবে, নইলে তারা ল্যাডারের বাইরে পড়ে থাকবে।

➡️ **১৫.৪-এর গ্রহণযোগ্যতায় যোগ করা হলো: `growth`/`pro` user-দের migration path।**

### ১৯.৭ R3 — কোন feature কেউ ব্যবহার করছে না

৪৫টি row-এর সবগুলোতেই `task = null` (gateway tag নেই), আর channel-ভিত্তিক ভাগ:

| channel | call | খরচ |
|---|---|---|
| playground | ৪০ | $০.০৬২৯ |
| web | ১ | $০.০০৭১ |
| whatsapp | ১ | $০.০০৬৯ |
| facebook | ১ | $০.০০০৬ |
| quick_setup | ১ | $০.০০০১ |
| auto_train | ১ | $০.০০০০ |

`isFreeMessage = false` — ৪৫টিতেই। অর্থাৎ trial-এর free-message path **এখনো একবারও চলে নি**।

**এর মানে ১৫.৩ (feature gating) ডেটা ছাড়াই সিদ্ধান্ত নিতে হবে।** §৮-এর ম্যাট্রিক্স তাই অনুমানের উপর দাঁড়িয়ে — এবং সেটা স্বীকার করে এগোনোই সঠিক। ভালো দিক: gate ভুল হলে ক্ষতি সীমিত (একজন merchant একটা feature পাবেন না, যা সহজে ঠিক করা যায়), আর গেট না করলে ক্ষতি টাকার।

### ১৯.৮ R5 — WhatsApp-এর Meta fee: **দুই সপ্তাহ আগে নিয়ম বদলে গেছে** 🔴

এটা §১১-এ "blind spot" বলে রাখা ছিল। খুঁজে দেখা গেল এটি তার চেয়ে অনেক বড়।

**যা বদলেছে:**

| কখন | কী |
|---|---|
| ২০২৫-০৭-০১ | Meta **per-conversation** ছেড়ে **per-message**-এ গেছে — প্রতি *delivered* message-এ বিল |
| ২০২৬-০৮-০১ | Meta-র নিজের AI (Meta Business Agent) token-ভিত্তিক, $২.০০ / ১M token |
| **২০২৬-১০-০১** | **Service message (অর্থাৎ আপনার AI-র free-form উত্তর)-ও billable হয়ে গেছে** — প্রতি number-এ মাসে **১,০০০টি free**, তারপর বিল |
| **আজ ২০২৬-১০-১৪** | অর্থাৎ এটি **১৪ দিন আগে কার্যকর হয়েছে** |

**অক্ষত যা আছে:** সব incoming (গ্রাহকের পাঠানো) message · প্রতি number-এ মাসে ১,০০০ service message · Click-to-WhatsApp ad বা Page CTA থেকে আসা ৭২-ঘণ্টার Free Entry Point window।

**খরচ:** বাংলাদেশ ২০২৬-১০-০১ থেকে Meta-র rate card-এ **আলাদা market**। কিন্তু ঠিক কত, তা নির্ভরযোগ্যভাবে বলা যাচ্ছে না — যে সূত্রগুলো পেলাম তারা service/utility-র জন্য **$০.০০১৪ থেকে $০.০০৯২** পর্যন্ত বলছে (৬.৫ গুণ ছড়িয়ে আছে), প্রতিটিই নিজের দাবিতে নিশ্চিত। **তাই একটি সংখ্যা বেছে নিয়ে সত্য বলে চালানো যাবে না।** একমাত্র নির্ভরযোগ্য সূত্র আপনার নিজের Meta Business-এর rate card।

নিচের হিসাবটা তাই **দিক বোঝানোর জন্য**, পরিমাণ দাবি করার জন্য নয় ($০.০০৩৭ ≈ ৳০.৪৭ ধরে):

| | |
|---|---|
| LLM token (gpt-4o-mini, মাপা token-এ) | ৳০.০৭৯ |
| WhatsApp service message (১,০০০-এর উপরে) | ~৳০.৪৭ |
| **অনুপাত** | **WhatsApp নিজেই AI-র চেয়ে ~৬ গুণ দামি** |

#### কিন্তু আসল প্রশ্নটা টাকার নয় — **কে বিলটা দেয়**

Meta-র নিয়ম (একাধিক সূত্রে মিলেছে):

> যে **credit line** ধরে আছে, সে-ই Bill To Party — এবং সে Meta-র কাছে **পুরোপুরি দায়ী**। আর **একবার কোনো WABA-তে credit line attach হলে সেটি বদলানো, সরানো বা পাল্টানো যায় না** — একমাত্র উপায় নতুন WABA বানানো।

দুটি মোড:
1. **Direct billing** — merchant নিজের card দেয় Meta Business Suite-এ, Meta **সরাসরি merchant-কে** বিল করে। আপনার কোনো দায় নেই।
2. **Credit line share** — আপনি আপনার credit line merchant-এর WABA-তে দেন; Meta **আপনাকে** বিল করে, আপনি merchant-এর কাছ থেকে তোলেন। Merchant না দিলে লোকসানটা **আপনার**।

আর আপনার কোড দেখছে: WhatsApp যুক্ত হয় **Meta Embedded Signup** দিয়ে (`NEXT_PUBLIC_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`, `exchangeWhatsAppEmbeddedSignupCode`), অর্থাৎ merchant onboarding হয় **আপনার** Meta app দিয়ে। Embedded Signup-এর কোন variant-এ credit line কার, সেটা **আপনার Meta app-এর সেটআপে** ঠিক হয় — কোড দেখে বলা অসম্ভব।

> 🔴 **এটি TASK-15-এর সবচেয়ে জরুরি যাচাই, এবং ১৫.৮-এর চেয়ে জরুরি।** আপনার Meta Business Suite-এ দেখুন: merchant-দের WABA-তে **আপনার credit line attach আছে কি না**। থাকলে —
> - প্রতি WhatsApp মেসেজের টাকা **আপনার card থেকে** যাচ্ছে;
> - ১,০০০ free-র পর প্রতি ১,০০০ service message-এ ~৳৪৭০ (আন্দাজি রেটে) আপনার খরচ;
> - আর যেহেতু credit line বদলানো যায় না, **যে WABA-গুলো ইতিমধ্যেই যুক্ত হয়েছে সেগুলো থেকে বেরোনোর পথ নেই** — শুধু নতুন WABA দিয়ে।
>
> আর যদি Meta-তে **Tech Provider** হিসেবে রেজিস্টার্ড থাকেন, তাহলে নিয়ম হলো Tech Provider **credit line দিতে পারে না, markup নিতে পারে না** — সেটাও মিলিয়ে দেখতে হবে।

#### ১৫.৮-এর অগ্রাধিকার বদলাল

আগে ভাবা ছিল "WhatsApp-এর খরচ মিটারে নেই, যোগ করা দরকার"। এখন পরিষ্কার:

| | |
|---|---|
| খরচটা **আপনার** হলে | 🔴 **সংকট** — মিটার নয়, credit line-ই আসল সমস্যা। ১৫.৮ তখন অপরিহার্য, আর তার আগে ১,০০০-free হিসাবটা লাগবে |
| খরচটা **merchant-এর** হলে | 🟡 transparency — merchant dashboard-এ "Meta আলাদা বিল করে, আমরা করি না" লেখাটাই যথেষ্ট; মিটার nice-to-have |

**উত্তরটা জানা ছাড়া ১৫.৮-এর ডিজাইন করা মানে ভুল সমস্যার সমাধান বানানো।**

### ১৯.৯ R4 — প্রতিযোগীরা AI-কে আসলে কীভাবে দাম দেয়

**পদ্ধতি:** প্রতিটি সংখ্যা ভেন্ডরের **নিজের pricing পেজ** থেকে পড়া `[OFFICIAL]`; দাম লোড না হলে ভেন্ডরের নিজের app-store listing/blog `[OFFICIAL-LISTING]`; নইলে লেবেল দেওয়া `[3P]`/`[PRESS]`। **কোনোটিই অনুমান নয়** — না পেলে `NOT FOUND` লেখা আছে। তারিখ: ২০২৬-১০-১৪।

#### Global

| Platform | Entry | উপরের tier | AI/usage-এর মিটার | সূত্র |
|---|---|---|---|---|
| **ManyChat** | Free $0 (২৫ contact) | Essential **$14/mo** (~$17 মাসিক) · Pro **$29** · Business $69 · Advanced $139 | **AI-র আলাদা মিটার নেই, per-message fee নেই** — Pro+তে bundled। আসল চালক **Active Contacts**, ওভারেজ $০.১০ → $০.০০৪/contact | `[OFFICIAL]` [manychat.com/pricing](https://manychat.com/pricing) |
| **Wati** | Growth **$69/mo** ($59 বার্ষিক) | Pro $149 · Business $349 | base plan-এ প্রকৃত AI মিটার নেই; **AI আলাদা "Astra" add-on** — Pro **$99/mo = ৫,০০০ credit**, Business $399 = ২৫,০০০ | `[OFFICIAL]` [Astra pricing](https://www.wati.io/products/astra/pricing/) · `[OFFICIAL-LISTING]` [wati.io/en/pricing](https://www.wati.io/en/pricing/) (দাম রেন্ডার হয়নি) |
| **respond.io** | Starter **$99/mo** ($79 বার্ষিক), ৫ user, **৫,০০০ AI credit** | Growth $199 (১০,০০০) · Advanced $349 (২০,০০০) | **AI credit** (per-message নয়); ওভারেজ **$১৫ / ১,০০০ credit**, hard cap ২০০% | `[OFFICIAL]` [respond.io/pricing](https://respond.io/pricing) |
| **Tidio** | Free $0 (৫০ conversation) | Starter **$24.17/mo** (১০০) · Growth $49.17 | **Lyro AI আলাদা add-on — ৫০ conversation-এ $৩২.৫০/mo থেকে**; প্রথম ৫০টি আজীবন ফ্রি; Premium = pay-per-resolution | `[OFFICIAL]` [tidio.com/pricing](https://www.tidio.com/pricing/) |
| **BotSailor** | Free $0 (২০০ subscriber, **২,০০,০০০ AI token/mo**) | ১K sub **$8.99** · ১০K $44.99 · ১০০K $130.19 — **সবগুলোতেই ২০ লাখ AI token/mo** | **AI token** মিটার | `[OFFICIAL]` [botsailor.com/pricing](http://botsailor.com/pricing) |
| **Chatfuel** | Business **$18/mo** (বার্ষিক, মাসিক $২০) + **$২০ AI credit/mo** | Agency S $90 + $১০০ credit | **wallet / AI credit**; মাসিক credit **roll over করে না** (স্পষ্ট লেখা) | `[OFFICIAL]` [chatfuel.com/pricing](https://chatfuel.com/pricing) · [billing docs](https://chatfuel.com/docs/billing/chatfuel-plans-and-pricing) |
| **Intercom (Fin)** | **$0.99 প্রতি resolution** | সব plan-এ একই — third-party helpdesk-এও, seat ছাড়া | **per resolution** (conversation-এ একবার) | `[OFFICIAL]` [intercom.com/pricing](https://www.intercom.com/pricing) |
| **Zoho SalesIQ** | Free (৩ operator) · **$7** per operator/mo | Professional **$12.75** · Enterprise **$20** | **Zia bundled** (আলাদা দাম নেই); মিটার = **bot chat session** (২৫K / ৫০K / ২ লক্ষ) | `[OFFICIAL]` [zoho.com/salesiq/pricing.html](https://www.zoho.com/salesiq/pricing.html) |
| **Zoho Desk** | Express **$7/user/mo** | Standard $14 · Pro $23 · Enterprise $40 | **AI নিচের tier থেকেই bundled** — "**মাসে ৩ কোটি token পর্যন্ত ফ্রি**" | `[OFFICIAL]` [zoho.com/desk/pricing.html](https://www.zoho.com/desk/pricing.html) |

#### বাংলাদেশ

| প্রোডাক্ট | দাম | AI-র মিটার | সূত্র / সতর্কতা |
|---|---|---|---|
| **Unified Chat** (unichat.bd) | Starter **৳২,৪৯৫/mo** → Growth ৳৩,৯৯৫ · Professional ৳৬,৯৯৫ · Business ৳১৪,৯৯৫, **সাথে এককালীন setup ৳১০,০০০–২৫,০০০** | **AI-র কোনো দাম বা মিটার নেই** — শুধু "Webhook for AI Chatbot" (নিজের Dialogflow/Rasa/n8n আনুন) | `[OFFICIAL]` [unichat.bd/Pricing.html](https://unichat.bd/Pricing.html) |
| **LazyChat** (lazychat.io) | Trial **৳৪,৯৯৯/mo** (৬,৬০০ credit) · Standard ৳১২,৫০০ (১৮,০০০) · Pro ৳২৬,০০০ (৪০,০০০); সাথে $২০/mo Basic tier | **credit-based** — কেবল **AI reply + comment-automation message** কোটা খায় | `[OFFICIAL]` [lazychat.io](https://lazychat.io/) — পেজে template-এর বাকি লেখা পড়ে আছে, তাই সংখ্যাগুলো **indicative** |
| **NexStep Digital** | **৳৫০০/mo** + ৭ দিন ফ্রি ট্রায়াল | বলা নেই | `[PRESS]` [presscenter.com — NexStep](https://presscenter.com/nexstep-digital-facebook-page-ai-chatbot-24-7-bengali-auto-reply/) — **press release, ভেন্ডরের সাইট নয়** |
| **ColourBangla** | setup **৳১৫,০০০–২৫,০০০** + **৳৩,০০০/mo** maintenance | বলা নেই | `[3P]` [colourbangla.com](https://colourbangla.com/ai-automation-company-bangladesh/) — **সার্ভিস এজেন্সি, SaaS নয়** |
| Repliq (BD) · Intelligent Machines · "Chatbot BD" · Zaman IT | **NOT FOUND** | — | খুঁজে কিছু পাওয়া যায়নি — অর্থাৎ দাম প্রকাশ্যে নেই |

#### এই বাজার AI-কে যেভাবে দাম দেয় — ৯টি পর্যবেক্ষণ

1. **প্রকৃত per-message AI metering কেউ করে না।** সবাই bundle/unit-এ ভাগ করে — "AI credit", "AI token", কি "conversation/resolution"।
2. **দুটি স্কুল:** (ক) per-outcome — Intercom **$০.৯৯/resolution**, Tidio Premium pay-per-resolution; (খ) credit bundle — respond.io **$১৫/১,০০০ credit**, Wati Astra **$২০/১,০০০ credit**।
3. **credit-ই সবচেয়ে common unit** (respond.io, Wati, Chatfuel wallet, BotSailor token) — বাংলা বাজারে LazyChat-ও credit ব্যবহার করে।
4. **base subscription এখনো contact/subscriber-ভিত্তিক** (ManyChat "active contacts", BotSailor "subscribers") — AI আলাদা meter।
5. **AI প্রায়ই আলাদা add-on**, "included" লেখা থাকলেও — Wati (Astra), Tidio (Lyro), Chatfuel (wallet credit)।
6. **"Unlimited AI" কেউ বিক্রি করে না** — প্রত্যেকের ছাদ আছে, আর ওভারেজ বা hard cap (respond.io ২০০%) আছে।
7. **credit সাধারণত roll over করে না** (Chatfuel স্পষ্ট বলেছে; Wati ৩ মাস) — অর্থাৎ ব্যবহার না করলেও revenue ধরে রাখে।
8. **Meta/WhatsApp-এর message cost সব জায়গায় আলাদা লাইন** — subscription-এর বাইরে, markup সহ (Wati ~৬০–৮০%)। AI খরচ আর channel খরচ কখনো এক কোটা নয়।
9. **BD বাজারের signature = কম মাসিক + এককালীন setup fee** (৳১০,০০০–২৫,০০০), entry ৳২,৪৯৫–৪,৯৯৯/mo — international entry ($১৪–৯৯)-এর চেয়ে অনেক সস্তা। আর বেশিরভাগ BD প্লেয়ার AI **meterই করে না** — বরং "নিজের AI webhook দিয়ে জুড়ে নিন" বলে দেয় (LazyChat ব্যতিক্রম)।

> 🎯 **মূল takeaway:** বাজারে "AI খরচের unit" আসলে **credit** — আর তা প্রায় সবসময় base platform fee-এর **উপরে আলাদা layer**। কেউ per-message ভিত্তিতে AI বেচে না। অর্থাৎ §১৭-এর দিকটা (credit = একক, আর সেটি আসল খরচ থেকে উদ্ভাবিত) বাজারের প্রচলিত রীতির সাথে সাংঘর্ষিক নয় — বরং **credit-টা কীসের একক, সেটাই এই রিপোর্টের মূল প্রশ্ন**, আর উত্তর: আসল খরচের।

#### যে দুই জায়গায় সূত্র পরস্পরবিরোধী (লুকানো হচ্ছে না)

- **Zoho SalesIQ:** SoftwareSuggest `[3P]` বলছে $৪/$৮/$১৩ — অফিসিয়াল পেজ বলছে **$৭/$১২.৭৫/$২০**। **অফিসিয়ালটাই ধরা হয়েছে।**
- **ManyChat:** third-party ব্লগগুলো বলছে AI একটি ~$২৯ add-on; অফিসিয়াল পেজে **আলাদা AI খরচ নেই**।

### ১৯.১০ ১৫.২ আসল ৩৪টি মডেলে চালানো হলো — উদ্ভাবনের diff

§১৯.৩ মেপেছিল "কতটা ভুল"। এটা তার পরের ধাপ: উদ্ভাবন যন্ত্রটা **আসল লাইভ catalogue-এ** চালালে কী দাঁড়ায়। পড়া হয়েছে প্রোডাকশনের নিজের মডিউল দিয়েই (`buildDerivationPreview()` — `credit-derivation.ts` + `model-pricing.ts`), একটি **read-only** স্ক্রিপ্টে (`--conditions=react-server`, চালানোর পরে মুছে ফেলা)। **DB-তে একটি row-ও লেখা হয়নি।**

সেটিং: `targetBdtPerCredit = ৳০.০২০` · রেট ৳১২৬/USD · token অনুমান ৪,০০০ + ৩০০ · দামের snapshot `2026-10-14T09:00:56.973Z`।

| total | unchanged | withinThreshold | needsReview | priceUnknown | priceDrift | appliesByDefault |
|---|---|---|---|---|---|---|
| ৩৪ | ১ | ০ | ৩৩ | ৬ | ১৪ | ০ |

- **`inversions: 0`** — উদ্ভাবিত সিঁড়িতে কোথাও "বেশি দামের মডেলের credit কম" নেই। যে নিয়মটা §১৯.৩-এ **৩৪টির ৩৪টিতেই** লঙ্ঘিত ছিল, সেটি আর নেই।
- **allowance margin ৭০ / ৬০ / ৪০%** — §১৭.৪-এর সিঁড়িটা বাস্তব মডেল-দাম দিয়েও অটুট থাকে (Starter ৳৩০০ · Business ৳১,০০০ · Enterprise ৳৩,০০০ খরচ)।
- **`priceDrift = ১৪`** — অর্থাৎ ৩৪টির ১৪টির **stored দাম বাসি**। Apply সেগুলো credit-এর সাথে ঠিক করে দেয়, যা নিরাপদ: stored দাম কেবল **প্রদর্শনের** জন্য, বিলিং `resolveModelPrice()` লাইভ পড়ে, আর প্যানেলে ওটা সম্পাদনের কোনো উপায়ও নেই।

উল্লেখযোগ্য সারি (অনুমানিত token-এ, অর্থাৎ ৪,০০০ + ৩০০):

| model | আজ | উদ্ভাবিত | খরচ/reply |
|---|---|---|---|
| `deepseek/deepseek-v4-flash` | 3 | **3** *(অপরিবর্তিত)* | ৳০.০৫৩ |
| `openai/gpt-4o` | 3 | **82** | ৳১.৬৩৮ |
| `anthropic/claude-fable-5` | 30 | **347** | ৳৬.৯৩০ |
| `anthropic/claude-opus-4.1` | 40 | **520** | ৳১০.৩৯৫ |
| ৫টি opus (4.5–5) | 20 | **174** | ৳৩.৪৬৫ |
| ৬টি `priceUnknown` (fallback দাম) | 3–50 | **অপরিবর্তিত** | — |

> ⚠️ **§১৯.৩-এর টেবিলের সাথে মিলিয়ে দেখবেন না — দুটো ভিন্ন token-এ হিসাব।** §১৯.৩-এ **মাপা** ২,০১৪ + ৫৪৮ token, এখানে **অনুমানিত** ৪,০০০ + ৩০০ — তাই `gpt-4o` ওখানে ৬৭, এখানে ৮২। দুটোই সঠিক, দুটোই স্পষ্ট করে লেখা। §১৯.২-এর সিদ্ধান্ত অনুযায়ী লাইভ derivation **অনুমানটাই** ব্যবহার করে (কারণ মাপাটা নিজেই অনুমান ছিল)।

#### 🆕 একটি পণ্য-সিদ্ধান্ত, যা এই রান ছাড়া অদৃশ্য থাকত

প্রিমিয়াম মডেলগুলো উদ্ভাবনে **১৭৪–৫২০ credit**-এ পড়ে (৳৩.৪৭–১০.৪০ প্রতি reply)। হিসাবটা ঠিক — মডেলগুলো সত্যিই এত খরচ করায়। কিন্তু তার মানে দাঁড়ায়:

| | Starter-এর ১৫,০০০ credit-এ কতটি reply |
|---|---|
| `deepseek/deepseek-v4-flash` (৩ credit) | **৫,০০০** |
| `openai/gpt-4o` (৮২) | **১৮২** |
| `anthropic/claude-opus-4.1` (৫২০) | **২৯** |

অর্থাৎ **প্রিমিয়াম মডেলগুলো আজকের allowance-এ অর্থনৈতিকভাবে ব্যবহারই করা যায় না** — অবশ্যই "লোকসান" নয় (credit এখন খরচের সমান), কিন্তু merchant-এর কাছে **অকেজো**। §৮-এর feature gating-এর (১৫.৩) সবচেয়ে বাস্তব যুক্তি এটাই: কোন plan-এ কোন মডেল থাকবে, তা নির্ধারণ করবে **credit-এর সংখ্যা নয়, allowance-এর আকার**।

#### আর একটি শিক্ষা, যেটা যুক্তি দিয়ে ধরা পড়ত না

উপরের টেবিলের `appliesByDefault = ০` আর `needsReview = ৩৩` মানে: **প্রতিটি row** ±২০% সীমা ছাড়িয়ে গেছে, কারণ হাতে-লেখা সংখ্যাগুলো ১০–২৭ গুণ ভুল ছিল। ফলে প্যানেলের "Apply" বোতামটা **চিরতামাটি নিষ্ক্রিয়** থাকত — admin ৩৩টি বাক্স হাতে টিক না দেওয়া পর্যন্ত। এমন প্যানেল থাকা না থাকা সমান।

সমাধান: **"Confirm all N"** — একটি কাজ, যা সংখ্যাটি **নাম নিয়েই** বলে দেয় কতগুলো row বড় পরিবর্তন। অর্থাৎ নিরাপত্তার বৈশিষ্ট্যটা (বড় বদলের জন্য একটি সচেতন কাজ) অটুট রইল, কেবল ৩৩ বার নয় বরং **একবার**। ±২০% সীমা তাই বাতিল হয়নি — কেবল ব্যবহারযোগ্য করা হলো।

### ১৯.১১ যা মাপা গেল না — স্পষ্ট করে

| প্রশ্ন | কেন যায় না | কী লাগবে |
|---|---|---|
| বাংলা বনাম ইংরেজি খরচ | `AIUsageLog`-এ ভাষার field নেই | নতুন কলাম (আলাদা টাস্ক) |
| কোন preset-এ কত খরচ | preset সংরক্ষণ হয় না, শুধু resolved `modelId` | নতুন কলাম |
| merchant-এর সন্তুষ্টি | কোথাও কোনো signal নেই | পণ্যের সিদ্ধান্ত, ডেটার নয় |
| WhatsApp-এর আসল খরচ | কোনো কলামে লেখা হয় না (§১৯.৮) | ১৫.৮, তবে আগে credit line-এর উত্তর |
| churn / retention | ৫ জন user-এ অর্থহীন | ট্রাফিক |

### ১৯.১২ ১৫.৩ যা বদলাল — আর যে দুটি সংখ্যা এই ডককে সংশোধন করে

১৫.৩ "feature gating" হিসেবে শুরু হয়েছিল §৮-এর ম্যাট্রিক্স প্রয়োগ করতে গিয়ে। কিন্তু গেট বসানোর আগে কোড পড়ে **দুটো মাপা আবিষ্কার** হলো, আর দুটিই এই ডকের পূর্বের দাবি ভাঙে:

**১. §৮.১-এর ভিত্তি ভুল ছিল।** ডকে লেখা ছিল *"প্রায় সব AI feature ইতিমধ্যেই credit-এ মিটারে আছে — enhance ২০, auto-train ৫০, product-sync ৩০"*। কোড পড়ে দেখা গেল [`lib/domain/ai-task.ts:81-95`](../../lib/domain/ai-task.ts#L81-L95)-এ **`isCharged: true` কেবল `chat`-এ** — `enhance_prompt`, `translate`, `compare`, `text_ingest`, `product_extract`, `auto_train`, `embedding` **সাতটিই `false`**। ফাইলটি নিজেই ওই লাইনে লিখে রেখেছে: *"That is a revenue leak, not a design choice"*।

➡️ দুই ফল: **(ক)** §৮.১-এর সংখ্যাগুলো কোথাও নেই — লেখার সময়েই ভুল; **(খ)** ১৫.৩-এর gating **meter-এর উপর দাঁড়াতে পারে না**, কারণ meter নেই। এই সেকশনের "দুটো lever" **(credit + gate)** কথাটি তাই এখন এক lever-এ নামল যতক্ষণ TASK-25 বাকি। ⚠️ `isCharged` আলাদা টাস্কের বিষয়, ১৫.৩-এ ছোঁয়া হয়নি।

**২. §৮.৪-এর তালিকা আসলে ১৫.৩-এর পরের কাজ, ভেতরের নয়।** ১৫.৩ যা করতে পারে তা হলো নিয়ম প্রয়োগ — কিন্তু Automations, Knowledge Base, Live Inbox **কোনো plan-এর feature-তালিকাতেই নেই**। gate বসানোর আগে ঠিক করতে হবে ওগুলো **কোন plan-এ বিক্রি করছেন**। সেটি ১৫.৪/১৫.৫-এর কাজ।

**যা এখন আছে:** চারটি pure entitlement function, ১১টি route-এ gate, nav-এর সাথে সমন্বয়, আর ২০টি নতুন টেস্ট যা পুরো নিয়ম-টেবিল ধরে রাখে (প্রতিটি "retired key"-এর প্রশ্ন সমেত)। `tsc` ০ · **৫২৩ টেস্ট পাস / ২১ ফাইল** · build exit ০ · কোনো DDL নেই · কোনো DB row লেখা হয়নি।

⚠️ **একটি পণ্যের সিদ্ধান্ত যা ইউজারকে জানানো হলো (§৮.৩.১-এ বিস্তারিত):** Web Widget **entry plan-এ যোগ করা হলো** (দুই region-এই), কাটা হলো না। কারণ Global Starter-এর নিজের feature-তালিকা ওই চ্যানেল promise করত, আর widget-ই ৩-day trial-এর একমাত্র ব্যবহারযোগ্য channel (Facebook-এ Meta app review লাগে, widget-এ একটি script tag)। BD-র লেখা "Facebook Channel Only" → "Facebook + Web Widget"-এ সংশোধিত। রিভার্ট = `plan-config.ts`-এ এক লাইন।

---

## তথ্যসূত্র

**আপনার নিজের কোড ও ডেটা (প্রাথমিক):** `/admin/ai-settings` স্ক্রিনশট · `AIUsageLog` · `lib/domain/plan-config.ts` · `credit-config.ts` · `credit-resolver.ts` · `payment-packages.ts` · `unit-economics.ts` · `plan-downgrade.ts` · `usage-limit.ts` · `vercel.json` · **`scripts/pricing-research.ts` (২০২৬-১০-১৪-এর লাইভ রান)**

**§১৯-এর মাপা ডেটা:** `docs/pricing/research-output.json` — `npm run pricing:research -- --json` দিয়ে পুনরুৎপাদনযোগ্য

**Meta WhatsApp per-message billing (§১৯.৮):**
- [Wati — WhatsApp Service Message Pricing Changes Explained (2026)](https://www.wati.io/en/blog/whatsapp-service-message-pricing/)
- [Wati — WhatsApp API Pricing Changes 2026: What Meta's Two New Fees Actually Cost You](https://www.wati.io/en/blog/whatsapp-api-pricing-changes-2026-what-meta-s-two-new-fees-actually-cost-you/)
- [Chat2Desk — WhatsApp Business API Pricing Changes: October 2026](https://chat2desk.com/en/blog/articles/whatsapp-business-api-billing-to-change)
- [Telnyx — WhatsApp Business API Cost After Meta's October 1 Changes](https://telnyx.com/resources/whatsapp-business-api-cost)
- [respond.io — WhatsApp Business Messaging API Pricing Calculator](https://respond.io/whatsapp-pricing-calculator-october-2026)
- [360Dialog — Who Bills for Meta Business Agent Messages?](https://360dialog.com/blog/who-bills-you-for-meta-business-agent-messages-and-why-its-not-your-bsp/) — credit line / Bill To Party ব্যাখ্যা
- [Plivo — WhatsApp Tech Provider / Reseller docs](https://www.plivo.com/docs/messaging/concepts/whatsapp/resellers) — Tech Provider markup নিষিদ্ধ
- [Gallabox — WhatsApp Rate Card](https://docs.gallabox.com/pricing-and-billing/whatsapp-pricing/rate-card) · [HighLevel changelog — Meta pricing changes from 1 October](https://ideas.gohighlevel.com/changelog/removing-the-5-processing-fee-and-meta-pricing-changes-from-1-october) — বাংলাদেশের রেট (সূত্রগুলো পরস্পরবিরোধী, §১৯.৮ দেখুন)

**§১৯.১০-এর ১৫.২ রান:** প্রোডাকশনের নিজের মডিউল (`lib/ai/credit-plan.ts` → `buildDerivationPreview()`) দিয়ে একটি **read-only** স্ক্রিপ্টে চালানো, তারপর স্ক্রিপ্টটি মুছে ফেলা — DB-তে একটি row-ও লেখা হয়নি। পুনরাবৃত্তি করতে: প্যানেলে **Recalculate** চাপুন (একই কোড পথ, একই সংখ্যা)।

**§১৯.৯-এর প্রতিযোগী দাম (২০২৬-১০-১৪-এ ভেন্ডরের নিজের পেজ থেকে):**
- **Global:** [ManyChat](https://manychat.com/pricing) · [Wati plans](https://www.wati.io/en/pricing/) ও [Wati Astra](https://www.wati.io/products/astra/pricing/) · [respond.io](https://respond.io/pricing) · [Tidio](https://www.tidio.com/pricing/) · [BotSailor](http://botsailor.com/pricing) · [Chatfuel](https://chatfuel.com/pricing) + [billing docs](https://chatfuel.com/docs/billing/chatfuel-plans-and-pricing) · [Intercom](https://www.intercom.com/pricing) · [Zoho SalesIQ](https://www.zoho.com/salesiq/pricing.html) · [Zoho Desk](https://www.zoho.com/desk/pricing.html)
- **বাংলাদেশ:** [Unified Chat](https://unichat.bd/Pricing.html) · [LazyChat](https://lazychat.io/) · [NexStep Digital (press release)](https://presscenter.com/nexstep-digital-facebook-page-ai-chatbot-24-7-bengali-auto-reply/) · [ColourBangla (সার্ভিস এজেন্সি)](https://colourbangla.com/ai-automation-company-bangladesh/)
- ⚠️ ManyChat ও Zoho SalesIQ-র পেজ সরাসরি fetch-এ `403` দেয়, তাই একটি text-extraction proxy দিয়ে পড়া হয়েছে — সংখ্যাগুলো মিলিয়ে নেওয়া ভালো। দুই জায়গায় third-party সূত্র অফিসিয়ালের সাথে **মেলেনি** (§১৯.৯-এর শেষ অংশ)।

**AI SaaS pricing-এর সাধারণ প্রবণতা (পটভূমি):**
- [Stripe — AI SaaS pricing models: a guide for founders](https://stripe.com/resources/more/ai-saas-pricing-models)
- [Sadu Capital — AI Broke Classic SaaS Pricing](https://www.sadu.vc/thoughts-blog/ai-broke-classic-saas-pricing-heres-whats-replacing-it)
- [Dodo Payments — AI Pricing Models 2026](https://dodopayments.com/blogs/ai-pricing-models)

**Model দাম (তৃতীয় পক্ষ — আপনার প্যানেলই সত্য):**
- [LLM Cost Calculator (OpenRouter listings)](https://emaadshamsi.github.io/llm-cost-calculator/)
- [Crazyrouter — The True Cost of AI APIs in 2026](https://crazyrouter.com/en/blog/ai-pricing-api-pricing-guide-2026)
