# TASK-WA — WhatsApp বিলিং, Embedded Signup ও Meta চ্যানেল খরচ

> **সূত্র:** [`task.md`](./task.md) → TASK-15 · ১৫.৮
> **তৈরি:** ২০২৬-১০-১৭ · **আলোচনা:** ২০২৬-১০-১৬ – ১৭
> **অবস্থা:** 🟡 **সিদ্ধান্ত আংশিক** — "Model B" (প্ল্যাটফর্ম বিল দেবে) ঠিক হয়েছে; **বিলিংয়ের পথ (BSP / MPS) এখনো বাকি**
> **এই ফাইল কেন আলাদা:** ১৫.৮-এর **কোড সম্পূর্ণ**। কিন্তু *"কে Meta-কে টাকা দেবে"* — এই একটি প্রশ্ন পুরো আলোচনা দখল করেছে, আর তার উত্তর কোডে নেই, Meta-র অ্যাকাউন্ট সেটআপে আছে। তাই সিদ্ধান্ত, প্রমাণ ও বাকি কাজ এখানে এক জায়গায় রাখা হলো, যাতে [`task.md`](./task.md)-এর ২,৪০০+ লাইন না পড়েই কাজ শুরু করা যায়।

---

## ০. যে নিয়মগুলো এখানেও প্রযোজ্য

[`task.md`](./task.md) §০-এর নিয়ম অপরিবর্তিত। এই ফাইলের জন্য বিশেষভাবে:

| # | নিয়ম |
|---|---|
| ১ | 🚫 **DB-তে যেকোনো লেখার আগে ইউজারের অনুমতি** (এই ফাইলে আপাতত কোনো DB লেখা নেই) |
| ২ | 🚫 **`prisma db push` নয়** — দরকার হলে `migrate diff` দেখিয়ে অনুমতি |
| ৩ | 🇧🇩 ইউজারের সাথে **বাংলায়**; কোড কমেন্ট **ইংরেজিতে**; বাংলায় technical শব্দ (WhatsApp, WABA, Embedded Signup, BSP, Tech Provider, Credit Line) **ইংরেজিতেই** |
| ৪ | 🔒 **কোনো credential, App Secret, token বা কার্ডের নম্বর এই ফাইলে লিখবে না — কোথাও লিখবে না** |
| ৫ | 👤 **ইউজার নিজে** Meta Business Suite-এ কাজ করবেন; AI শুধু ধাপ ও যাচাইয়ের তালিকা দেবে |
| ৬ | 📊 **মাপা সংখ্যা দিয়ে দাবি, দাবি দিয়ে মাপা নয়** — নিচের সব রেটে সূত্র দেওয়া আছে, আর যেখানে সূত্রগুলো একমত নয় সেখানে তা **স্পষ্ট করে বলা আছে** |

---

## ১. এক নজরে

| বিষয় | সিদ্ধান্ত / অবস্থা | তারিখ |
|---|---|---|
| **বিলিং মডেল** | ✅ **Model B** — প্ল্যাটফর্ম Meta-কে বিল দেবে, merchant কিছুই করবেন না | ২০২৬-১০-১৭ |
| **Onboarding** | ✅ **Embedded Signup** — merchant-এর WhatsApp সংযোগের একমাত্র পথ | ২০২৬-১০-১৭ |
| **Biz Verification** | ✅ সম্পন্ন | — |
| **Integrity** | ✅ সম্পন্ন | — |
| **App Review + Access Verification** | ⬜ **বাকি** | — |
| **Tech Provider access** | 🟡 নেওয়ার সিদ্ধান্ত হয়েছে | ২০২৬-১০-১৭ |
| **Tech Provider-ই যথেষ্ট?** | 🔴 **না** — Tech Provider-এর credit line থাকে না, তাই নিজে বিল দিতে পারে না | যাচাইকৃত |
| **সমাধান** | 🔴 **Multi-Partner Solution (MPS)** — একটি Solution Partner / BSP-এর credit line | **⬜ বাকি — এটাই আসল বাকি কাজ** |
| **১৫.৮-এর কোড** | ✅ সম্পূর্ণ, **ডিফল্টে বন্ধ** (`whatsappFeeBdtPerMessage = 0`) | ২০২৬-১০-১৬ |
| **Surcharge চালু করবেন কি?** | 🟡 **অনির্ধারিত** — "খরচ প্ল্যাটফর্ম বহন করবে" মানে *অগ্রিম দেওয়া* না *সম্পূর্ণ নিজে নেওয়া* — এটা এখনো স্পষ্ট নয় (নিচে §১১.৩) | — |

---

## ২. খরচটা আসলে কোথায় — inbound নয়, outbound

প্রতি WhatsApp বার্তায় **তিনটি** আলাদা খরচ, কিন্তু Meta-র খরচ মাত্র একটিতে:

| ধাপ | কে দেয় | খরচ |
|---|---|---|
| merchant-এর গ্রাহক → আমাদের webhook (**inbound**) | — | **শূন্য** — Meta গ্রাহকের পাঠানো বার্তায় কিছু নেয় না |
| AI উত্তর তৈরি করে | আমরা (credit থেকে) | OpenRouter / LLM token খরচ |
| AI-র উত্তর → গ্রাহকের WhatsApp (**outbound**) | **Meta** | প্রতি phone number-এ মাসে **১,০০০ free**, তারপর per-message |
| n8n + hosting | আমরা | সার্ভার খরচ |

👉 **Meta শুধু আমরা যেটা পাঠাচ্ছি তার টাকা নেয়।**

### ২.১ চ্যানেল-ভিত্তিক তুলনা

| চ্যানেল | Meta-র per-message ফি |
|---|---|
| **WhatsApp** | ✅ **আছে** — ২০২৬-১০-০১ থেকে AI-র free-form service reply-ও বিলযোগ্য (১,০০০ free-র পরে) |
| **Facebook Messenger** | ❌ **নেই** |
| **Instagram DM** | ❌ **নেই** |
| **Website widget** | ❌ **নেই** (সম্পূর্ণ আমাদের নিজের stack) |

**Messenger ও Instagram কেন ফ্রি:** ওই দুই API-তে Meta প্রতি বার্তায় টাকা নেয় না — খরচটা **সময় ও engineering** (App Review, Business Verification), টাকা নয়। বিধিনিষেধ থাকে ২৪-ঘণ্টার messaging window ও message tag-এ।

**WhatsApp কেন আলাদা:**
- **২০২৪-১১:** service conversation ফ্রি ঘোষণা
- **২০২৫-০৭-০১:** per-conversation মডেল বাদ, **per-message** চালু (template-দের জন্য)
- **২০২৬-১০-০১:** 🔴 **service message বিলযোগ্য** — অর্থাৎ গ্রাহকের প্রশ্নের জবাবে **আমাদের AI-র নিজের লেখা উত্তরও** এখন টাকার হিসাবে পড়ে, প্রতি number-এ মাসে ১,০০০-এর পরে

> ⚠️ এটাই ১৫.৮-এর পুরো জন্ম। এর আগে AI-র WhatsApp উত্তর সম্পূর্ণ ফ্রি ছিল।

---

## ৩. "Credit line" আসলে কী — এবং একটা সংশোধন

### ৩.১ সহজ কথা

Meta-র Billing Hub-এ **দুটি আলাদা জিনিস** আছে, আর আগে এই দুটোকে এক করে বলা হয়েছিল। এখন আলাদা করে বুঝুন:

| জিনিস | কোথায় | মানে |
|---|---|---|
| **Payment method** | *Billing & payments → Payment methods* | **কার্ড** — Meta টাকা তুলবে এখান থেকে |
| **Credit line** | *Billing & payments → Credit lines* | **মাসিক ইনভয়েসের সুবিধা** — Meta নিজের স্ক্রিনে লেখে: *"Credit lines are a payment setting where you pay us based on monthly invoices. The amounts shown are not credit or financing."* |

⚠️ **সংশোধন:** আগে "credit line = যে কার্ড থেকে কাটে" বলা হয়েছিল — সেটি **ঢিলা** ছিল। সঠিক কথা: **credit line Meta-বরাদ্দ একটি পোস্টপেইড ইনভয়েসিং সুবিধা**, যা **শুধু Solution Partner-দের** দেওয়া হয়। এটা কোনো ব্যাংক-ক্রেডিট বা ফাইন্যান্সিং নয় (Meta-র নিজের লেখা)।

**দুটোর যেটাই থাকুক — ফল একই: যে ধরে, সে-ই বিল দেয়।**

### ৩.২ আজকের মাপা অবস্থা (ইউজারের স্ক্রিনশট, ২০২৬-১০-১৭)

| পর্দা | ফল |
|---|---|
| Accounts → **Driplare** | Current balance **$0.00** · *"You haven't added any payment methods."* · Payment activity: *"You have no recent spending."* · Currency: **Bangladesh** |
| **Credit lines** | 🚫 *"No credit line has been allocated."* |
| **Payment methods** | 🚫 *"No payment methods added."* |

👉 **অর্থ:** আজ এই WABA থেকে **বিলযোগ্য একটি বার্তাও পাঠানো যাবে না**। ফ্রি tier-এর ভেতরে কিছু চলবে, তারপর নীরবে বন্ধ — কোনো দৃশ্যমান error ছাড়াই।

---

## ৪. Tech Provider vs Solution Partner — পার্থক্যটাই সব

| | **Tech Provider** | **Solution Partner / BSP** |
|---|---|---|
| Embedded Signup বানাতে পারে? | ✅ হ্যাঁ | ✅ হ্যাঁ |
| Customer onboard করতে পারে? | ✅ হ্যাঁ | ✅ হ্যাঁ |
| **Credit line আছে?** | ❌ **না** | ✅ **হ্যাঁ** |
| **কে Meta-কে টাকা দেয়?** | **Customer নিজে** | **Partner** |
| Meta কাকে ইনভয়েস করে? | Customer-কে | Partner-কে (aggregated) |

**মূল উদ্ধৃতি:**

> *"Unlike Solution Partners, Tech Providers do not have credit lines. Business customers onboarded by Tech Providers must provide their own payment method after onboarding. Meta will then bill these customers for API usage, and the Tech Provider will bill for other services."*

> *"The Solution Partner is the **Bill To Party** — they are liable for and must pay Meta for all WhatsApp spend on their credit line."*

### ৪.১ ফলাফল — একটা কঠিন সত্য

**Tech Provider access নিলে আপনার প্ল্যাটফর্মের credit খরচ হবে না — কারণ বিলটাই আপনার হবে না।** বিল যাবে merchant-এর কার্ডে।

👉 Tech Provider আপনাকে **onboard করার ক্ষমতা** দেয়, **বিল দেওয়ার ক্ষমতা নয়**। দুটো সম্পূর্ণ আলাদা বিষয়।

তাই আপনার তিনটি চাওয়া একসাথে:

| চাওয়া | Tech Provider একা পূরণ করে? |
|---|---|
| merchant কিছুই করবেন না | ❌ না |
| প্ল্যাটফর্ম বিল দেবে | ❌ না |
| Embedded Signup ব্যবহার হবে | ✅ হ্যাঁ |

---

## ৫. Model A বনাম Model B — সিদ্ধান্ত: **B**

| | **Model A** — merchant-এর নিজের WABA | **Model B** — প্ল্যাটফর্মের WABA/credit line |
|---|---|---|
| কার্ড কার | merchant-এর | **আমাদের** (BSP-র মাধ্যমে) |
| Merchant-এর কাজ | কার্ড দিতে হবে | **কিছুই না** |
| Meta-র বিল | merchant-কে | **আমাদের** |
| Onboarding friction | বেশি | **কম** |
| আমাদের ঝুঁকি | শূন্য | **খোলা-শেষ** — ট্রাফিক যত, খরচ তত, টাকা আগে যাচ্ছে |

### ৫.১ সিদ্ধান্ত (২০২৬-১০-১৭)

> ✅ **Model B-তে যাবো। কাস্টমার/মার্চেন্টের কিছু করতে হবে না। সব খরচ আমার প্ল্যাটফর্ম বহন করবে। কিন্তু কাস্টমার WhatsApp login করার সময় Embedded Signup-ই ব্যবহার করবে।**

⚠️ **এই সিদ্ধান্তের একটি অনিবার্য ফল, যা স্পষ্ট থাকুক:** Model B-তে **আমরা আগে টাকা দিই, পরে credit-এ ফিরে পাই** — আর এই "ফিরে পাওয়াটাই" ১৫.৮-এর surcharge। তাই ১৫.৮ কোনো বাড়তি ফিচার নয়, **Model B-র আর্থিক ভিত্তি**।

---

## ৬. Embedded Signup — ৩টি requirement ও আজকের অবস্থা

App Dashboard → WhatsApp → Embedded Signup Builder (ইউজারের স্ক্রিনশট, ২০২৬-১০-১৭):

| Requirement | অবস্থা | Metadata |
|---|---|---|
| **Business Verification** | ✅ **সম্পন্ন** | *"You can start building the prototype ... You will get Tech-Provider onboarding limits."* |
| **App Review & Access Verification** | ⬜ **বাকি** | *"You cannot use this app in production until app review and access verification is completed. You will have to manually add users to the App for testing."* |
| **Integrity** | ✅ **সম্পন্ন** | *"Your business has been cleared to continue with integration."* |

### ৬.১ Tech Provider হওয়ার ক্রম

1. ✅ **Business Portfolio Verification** — *Classic* verification বাধ্যতামূলক; PLBV এখানে গ্রহণযোগ্য নয়
2. ⬜ **Tech Provider onboarding** — App Dashboard থেকে (ধাপ ১ পাস না হলে ব্লকড)
3. ⬜ **App Review + Advanced Access** — `whatsapp_business_management`, `whatsapp_business_messaging`, `public_profile`
4. ⬜ **Access Verification** — কোম্পানির তথ্য যাচাই
5. ⬜ **Embedded Signup** — Facebook Login for Business + Multi-Partner Solution ID

### ৬.২ App Review-তে যা লাগবে

- **দুটি demo video:** (ক) app থেকে বার্তা তৈরি + পাঠানো, যা WhatsApp client-এ পৌঁছায়; (খ) app থেকে message template তৈরি
- প্রতিটি permission-এ data usage-এর ব্যাখ্যা
- UI **ইংরেজিতে** (বা সাবটাইটেল), **1080p+**, প্রস্থ ≤ 1440px

### ৬.৩ যে ভুলগুলো সবচেয়ে বেশি আটকায়

- 🚫 App icon-এ Meta-র ট্রেডমার্ক (যেমন "WA", "WhatsApp")
- 🚫 Privacy policy লিংক ভুল বা geo-fenced
- 🚫 "Login with Facebook" বাটন অ-মানসম্মত
- 🚫 App icon / category / primary contact অনুপস্থিত

### ৬.৪ Onboarding সীমা

| অবস্থা | নতুন business / rolling ৭ দিন |
|---|---|
| Tech Provider ডিফল্ট | **১০** |
| Business Verification + App Review + Access Verification শেষ | **২০০** |
| এর বেশি | Meta Business Partner status লাগবে |

📌 **পরিকল্পনার জন্য:** প্রথম ৭ দিনে ১০ জন — অর্থাৎ প্রাথমিক merchant-দের জন্য যথেষ্ট, তবে লঞ্চের সময় সীমাটা মনে রাখুন।

---

## ৭. 🔴 মূল বাধা এবং একমাত্র সমাধান

### ৭.১ সমাধান: Multi-Partner Solution (MPS)

```
আপনি (Tech Provider)   →  নিজের Meta App + Embedded Signup বানান
          +
Solution Partner / BSP  →  নিজের credit line merchant-এর WABA-তে বসায়
          =
merchant কার্ড দেখেন না  ·  Meta বিল BSP-কে করে  ·  BSP বিল আপনাকে
```

এতে **Embedded Signup-এর UX সম্পূর্ণ আপনার হাতে থাকবে**, শুধু বিলিংটা BSP সামলাবে। Plivo, YCloud, Kapso, Gupshup, 360dialog, Prelude — সবাই ঠিক এই মডেলেই কাজ করে।

📌 Meta App Dashboard-এ বাঁ দিকের মেনুতে **"Partner Solutions"** আইটেমটিই এর প্রবেশপথ।

### ৭.২ দুটির মধ্যে বাছাই

| পথ | সময় | ঝুঁকি | সুপারিশ |
|---|---|---|---|
| **নিজে Solution Partner হওয়া** | Meta Business Partner status + চুক্তি + credit check + ভলিউম — বছরের ব্যাপার | বড় প্রাথমিক বিনিয়োগ | ❌ এখন নয় |
| **একটি BSP দিয়ে MPS** | চুক্তি কয়েক সপ্তাহ | BSP-র per-message markup | ✅ **এখনকার একমাত্র বাস্তব পথ** |

### ৭.৩ BSP-দের সাথে সবচেয়ে গুরুত্বপূর্ণ শর্ত

Meta-র Free tier **১,০০০/phone number/মাস** Meta-র দিকে থেকে বহাল থাকে, কিন্তু **BSP তার নিজের ফি প্রথম বার্তা থেকেই নিতে পারে**। তাই চুক্তির আগে **লিখিতভাবে** জেনে নিন — নইলে ফ্রি-tier-এর হিসাব ভুল হবে।

---

## ৮. 🔴 স্থায়ী নিয়ম — একবার বসলে বদলানো যায় না

> **Meta-র নিয়ম: একটি credit line একবার কোনো WABA-তে attach হলে আর সরানো বা বদলানো যায় না। বদলাতে হলে নতুন WABA তৈরি করতে হবে।** Partner **revoke** করতে পারে (ভবিষ্যৎ বিলিং বন্ধ হবে), কিন্তু **detach** করতে পারে না।

### ৮.১ এর ব্যবহারিক অর্থ — চারটি সতর্কতা

1. ⚠️ **প্রথম আসল merchant onboard করার আগেই** বিলিং মডেল ও BSP চূড়ান্ত করতে হবে।
2. ⚠️ পরে "এখন থেকে আমরা দেব" বলে লাভ নেই — নতুন WABA = **number আবার verify + template আবার approve**।
3. ⚠️ **ডেমো merchant দিয়ে করলেও সেই WABA চিরতরে আটকে যাবে।** তাই টেস্ট করবেন **test number / test WABA** দিয়ে, আসল merchant-এর নাম্বার দিয়ে নয়।
4. ⚠️ Meta-র স্ক্রিন নিজেই বলছে: অন্য পোর্টফোলিওর credit line পেতে হলে মালিককে **"Grant Access to your business portfolio"** করতে হবে।

---

## ৯. ⚠️ ফাঁদ — Embedded Signup-এ কার্ডের ধাপ "skip" করা যায়, কিন্তু করবেন না

কার্ডের ধাপটা এড়িয়ে যাওয়া কারিগরিভাবে সম্ভব। কিন্তু তখন:

| ফল | বিস্তারিত |
|---|---|
| ❌ Template message ব্লক | marketing / utility / OTP — **প্রথম বার্তা থেকেই**; `131042 — Business Eligibility Payment Issue` |
| ⚠️ সীমিত চলা | ফ্রি tier-এর ভেতরে কিছু চলবে, তারপর **নীরবে বন্ধ** |
| 😱 সবচেয়ে ভয়ংকর | **merchant ভাববেন সব ঠিক আছে**, অথচ তাঁর গ্রাহকরা উত্তর পাচ্ছেন না |
| ⚠️ তাৎক্ষণিক প্রভাব | `payment method` ছাড়া WABA-তে **Default** ব্যাজ থাকে না — message limit ও template approval-ও pause হতে পারে |

👉 "কার্ডের ধাপ skip করিয়ে দিলাম" **সমাধান নয়, সমস্যা লুকানো**।

---

## ১০. খরচের হিসাব — এবং সূত্রগুলো কেন একমত নয়

### ১০.১ বাংলাদেশের service-message রেট (২০২৬-১০-০১ থেকে)

| সূত্র | USD / বার্তা | ≈ BDT |
|---|---|---|
| Gallabox rate card | $0.0043 | **৳০.৫২** |
| Ominiflow (BD) | $0.0014 | **৳০.১৭** |
| Recruitly | $0.0092 | **৳১.১২** |
| গ্রামের কাগজ (VAT সহ, সর্বোচ্চ) | — | **৳০.১৮** |

🔴 **ছড়া ≈ ৬ গুণ** (৳০.১৭ – ৳১.১২)।

⚠️ **এর কারণ:** BSP-দের ব্লগ ও রেট কার্ড পুরনো হয়; কিছু সূত্র marketing-রেট মিশিয়ে দেয়; VAT/কর আলাদা করে দেখায়। **আসল সংখ্যাটি আসে Meta-র নিজের rate card ও আপনার BSP-র চুক্তি থেকে** — এটাই অনুমানের বদলে যাচাই করার একমাত্র উপায়।

### ১০.২ আমাদের কোড এখন কী ধরে

| ধাপ | মান |
|---|---|
| BD service message (কোডের অনুমান) | ≈ $০.০০৪৩ ≈ **৳০.৫৪** |
| BD Starter-এর প্রতি credit-এ আয় | ৳৯৯৯ ÷ ১৫,০০০ = **৳০.০৬৬৬** |
| **প্রতি WhatsApp উত্তরে** | `ceil(0.54 ÷ 0.0666)` = **≈ ৯ credit** |

### ১০.৩ Starter plan-এ ঝুঁকির হিসাব

১৫,০০০ credit ≈ **১,৬৬৬ WhatsApp বার্তা** (৯ credit/বার্তা ধরে)

| আসল রেট | প্ল্যাটফর্মের খরচ | আয় ৳৯৯৯-এর বিপরীতে |
|---|---|---|
| ৳০.১৮ | ≈ **৳৩০০** | ✅ আরামদায়ক |
| ৳০.৫৪ | ≈ **৳৯০০** | ⚠️ প্রায় পুরো টাকা |
| ৳১.১২ | ≈ **৳১,৮৬৬** | 🔴 **লোকসান** |

⚠️ এই তিনটি সারিই **একই plan, একই ১৫,০০০ credit** — পার্থক্য শুধু রেট। তাই রেট জানার আগে surcharge সংখ্যা বসানো মানে **অন্ধভাবে দাম ঠিক করা**।

### ১০.৪ BSP যোগ হলে

**আপনার effective রেট = Meta-র রেট + BSP-র ফি + VAT/কর।** তাই `whatsappFeeBdtPerMessage`-এ বসাতে হবে **সর্বমোট effective রেট**, শুধু Meta-র রেট নয়।

### ১০.৫ 🟡 এখনো অনির্ধারিত — surcharge চালু হবে কি?

আপনার বাক্য ছিল: *"সব খরচ আমার প্লাটফর্ম বহন করবে।"* এর **দুটি পড়া** সম্ভব:

| পড়া | মানে | ১৫.৮-এর surcharge |
|---|---|---|
| **(ক) অগ্রিম দেওয়া** | প্ল্যাটফর্ম Meta/BSP-কে আগে দেয়, পরে credit থেকে ফিরে পায় | ✅ **চালু হবে** — আসল রেট জানার পরে |
| **(খ) সম্পূর্ণ নিজে নেওয়া** | কোনোদিন merchant-এর কাছে ফেরত চাওয়া হবে না | ❌ **কখনো চালু হবে না** |

🔴 **(খ) হলে ব্যবসার হিসাব বদলে যায়:** Starter-এ একজন merchant মাসে ৳৩০০–৳১,৮৬৬ পর্যন্ত লোকসান দিতে পারেন। তাই এই দুটোর মধ্যে **একটি বেছে নেওয়া দরকার** — আর সেই সিদ্ধান্তের আগে surcharge `0`-ই থাকবে।

---

## ১১. ১৫.৮-এর কোড — সম্পূর্ণ, ডিফল্টে বন্ধ

### ১১.১ যা তৈরি হয়েছে (৯টি ফাইল, ৪টি নতুন)

| ফাইল | কী |
|---|---|
| [`lib/domain/whatsapp-cost.ts`](../../lib/domain/whatsapp-cost.ts) 🆕 | pure হিসাব — free-tier সীমা, ceil, ভাগ-নিরাপত্তা |
| [`lib/domain/whatsapp-cost.test.ts`](../../lib/domain/whatsapp-cost.test.ts) 🆕 | ২৩টি টেস্ট + ২টি tripwire |
| [`lib/services/whatsapp-surcharge.ts`](../../lib/services/whatsapp-surcharge.ts) 🆕 | চক্রে কত WhatsApp বার্তা গেল — ledger থেকে `count()` |
| [`WhatsAppCostPanel.tsx`](../../app/(admin)/admin/ai-settings/_components/WhatsAppCostPanel.tsx) 🆕 | admin UI — দুটি ইনপুট + জীবন্ত estimate |
| [`lib/ai/charge-usage.ts`](../../lib/ai/charge-usage.ts) | চার্জের সময় surcharge পাঠানো |
| [`lib/domain/credit-config.ts`](../../lib/domain/credit-config.ts) | ২টি clamp + ডিফল্ট `0` |
| [`app/api/admin/ai-settings/route.ts`](../../app/api/admin/ai-settings/route.ts) · [`fetch-models/route.ts`](../../app/api/admin/ai-settings/fetch-models/route.ts) | sanitize + triple-guard |
| [`page.tsx`](../../app/(admin)/admin/ai-settings/page.tsx) · [`types.ts`](../../app/(admin)/admin/ai-settings/_components/types.ts) | প্যানেল বসানো + merge-সুরক্ষা |
| [`public/locales/{en,bn}/admin.json`](../../public/locales/en/admin.json) | ১৮টি key × ২ ভাষা |

### ১১.২ যাচাই (২০২৬-১০-১৬ – ১৭)

| কমান্ড | ফল |
|---|---|
| `npx tsc --noEmit` | **০ error** |
| `npm test` | **৬৯৮ পাস / ২৯ ফাইল** (১৫.৭-এর পরে +২৩) |
| `npm run build` | **exit 0** |
| i18n parity | **৭০০ en / ৭০০ bn**, শূন্য ফাঁক |

🔬 **tripwire মিউটেশন দিয়ে যাচাই করা হয়েছে** — প্রথম সংস্করণটি একটি **মন্তব্য** মাপছিল, কোড নয়। ঠিক করে `import`-statement ধরা হয়েছে, তারপর ইচ্ছাকৃতভাবে কোড ভেঙে দেখা হয়েছে টেস্ট সত্যিই ফেলে কি না — **ফেলেছিল** (`1 failed | 22 passed`)। তারপর ফাইলটি হুবহু ফিরিয়ে আনা হয়েছে।

### ১১.৩ চালু করতে ঠিক কী করতে হবে

`/admin/ai-settings` → **WhatsApp Channel Cost (Meta)** প্যানেল:

| ঘর | আজ | কখন বসাবেন |
|---|---|---|
| **Free messages** | `1000` | সাধারণত বদলাতে হবে না (Meta-র allowance) |
| **Fee per message (৳)** | **`0`** ← **এটাই "বন্ধ"** | BSP চুক্তির পরে, **সর্বমোট effective রেট** |

⚠️ **`0` রাখাই আজকের সঠিক অবস্থা।** এটি নিষ্ক্রিয় কোড নয় — এটি ইচ্ছাকৃত নিরাপদ অবস্থা, যেখানে merchant **দুইবার** চার্জ হন না।

### ১১.৪ যা বদলাবে না

- Free tier **১,০০০ / phone number / মাস** — প্রতি merchant-এ নয়। কোড `chatbotId` ধরে গোনে, যা Meta-র নিয়মের সাথে মেলে।
- `resolveReplyCredits` — surcharge ওখানে বসানো **হয়নি** (ইচ্ছাকৃত); অর্থাৎ মডেল-প্রতি credit-এর ফাংশন channel-নিরপেক্ষ থাকে।

---

## ১২. করণীয় — ধাপে ধাপে

### ১২.১ এখনই (কোড/অ্যাকাউন্টের বাইরে, শুধু সিদ্ধান্ত)

- [ ] **§১০.৫-এর (ক) না (খ)?** — surcharge ভবিষ্যতে চালু হবে কি না, ঠিক করুন
- [ ] **একটি target BSP-এর তালিকা বানান** — ৩–৫টি (Gupshup, YCloud, 360dialog, Kapso, Plivo, অথবা বাংলাদেশি BSP)
- [ ] **§১৩-এর প্রশ্নগুলো লিখে রাখুন** — চুক্তির আগে প্রতিটির লিখিত উত্তর নিন

### ১২.২ App Review (আপনার হাতে)

- [ ] Tech Provider onboarding শুরু করুন
- [ ] দুটি demo video রেকর্ড করুন (§৬.২ অনুযায়ী)
- [ ] `whatsapp_business_management` + `whatsapp_business_messaging`-এ Advanced Access চান
- [ ] Access Verification সম্পূর্ণ করুন
- [ ] App icon, privacy policy, category, primary contact — §৬.৩ মিলিয়ে দেখুন

### ১২.৩ BSP চুক্তির পরে

- [ ] BSP-র Embedded Signup config (config_id / solution_id) নিন
- [ ] **১টি test WABA** দিয়ে end-to-end চালান (§৮.১ — test WABA-তেই)
- [ ] আসল effective রেট বের করুন (Meta + BSP + VAT)
- [ ] `/admin/ai-settings`-এ fee বসান — **এটাই একমাত্র কোড-সংশ্লিষ্ট ধাপ**
- [ ] প্রথম আসল merchant onboard করুন — **এর পরে আর বিলিং মডেল বদলানো যাবে না**

---

## ১৩. BSP-কে যে ৭টি প্রশ্ন করতে হবে (উত্তর লিখিত নিন)

| # | প্রশ্ন | কেন |
|---|---|---|
| ১ | বাংলাদেশে **service message**-এর effective রেট কত (Meta + আপনার ফি + VAT সহ)? | এটাই panel-এ বসবে |
| ২ | **১,০০০ free/month** pass-through হয়, নাকি আপনার ফি **প্রথম বার্তা থেকেই**? | ফ্রি-tier-এর হিসাব এর উপর নির্ভর করে |
| ৩ | আমি **নিজের Meta App + Embedded Signup** ব্যবহার করতে পারব, আপনি শুধু credit line দেবেন (MPS)? | UX আমাদের হাতে রাখতে চাই |
| ৪ | **WABA-র মালিক কে** হবে, আর ভবিষ্যতে অন্য BSP-তে migrate করার পথ আছে কি? | §৮-এর স্থায়ী নিয়ম |
| ৫ | Prepaid না postpaid? সর্বনিম্ন monthly, চুক্তির মেয়াদ, **exit clause**? | working capital |
| ৬ | Merchant churn করলে credit line **revoke** হলে WABA-র কী হয়? | নতুন WABA লাগবে কি না |
| ৭ | **SLA ও support** — messaging বন্ধ হলে কত সময়ে সাড়া? | গ্রাহকের চোখে আমাদের ভাবমূর্তি |

---

## ১৪. সিদ্ধান্তের লগ

| তারিখ | সিদ্ধান্ত | কারণ |
|---|---|---|
| ২০২৬-১০-১৫ | WhatsApp-এর Meta খরচ **credit-এ ফোল্ড** | আলাদা বিল মানে বন্ধ চুক্তি আবার খোলা |
| ২০২৬-১০-১৬ | ১৫.৮ কোড **ডিফল্টে বন্ধ** অবস্থায় লেখা | রেট অজানা; ভুল সংখ্যা merchant-কে দুইবার চার্জ করাতে পারে |
| ২০২৬-১০-১৭ | **Model B** — প্ল্যাটফর্ম বিল দেবে | merchant-এর কার্ডের ঝামেলা শূন্য |
| ২০২৬-১০-১৭ | **Embedded Signup-ই** onboarding-এর পথ | UX আমাদের হাতে |
| ২০২৬-১০-১৭ | **Tech Provider access নেওয়ার সিদ্ধান্ত** | Embedded Signup-এর পূর্বশর্ত |
| ২০২৬-১০-১৭ | 🔴 **Tech Provider একা যথেষ্ট নয় — MPS/BSP লাগবে** | যাচাইকৃত: TP-র credit line নেই |
| — | 🟡 Surcharge চালু হবে কি — **অনির্ধারিত** | §১০.৫ |

---

## ১৫. সূত্র

**Meta প্রাইসিং ও service message**
- [WhatsApp Service Message Pricing Changes Explained (Wati)](https://www.wati.io/en/blog/whatsapp-service-message-pricing/)
- [WhatsApp Service Message Pricing Changes in October 2026 (SendPulse)](https://sendpulse.com/blog/whatsapp-service-message-pricing)
- [WhatsApp Business API Cost After Meta's October 1 Changes (Telnyx)](https://telnyx.com/resources/whatsapp-business-api-cost)
- [WhatsApp API Pricing October 2026 (MyOperator)](https://myoperator.com/blog/whatsapp-api-pricing-october-2026-update)

**বাংলাদেশের রেট**
- [WhatsApp Rate Card (Gallabox)](https://docs.gallabox.com/pricing-and-billing/whatsapp-pricing/rate-card)
- [WhatsApp Business API Bangladesh 2026 (Ominiflow)](https://ominiflow.com/whatsapp-business-api/bangladesh)
- [WhatsApp Business Rates by Country (Recruitly)](https://recruitly.io/whatsapp-business/rates)
- [হোয়াটসঅ্যাপে মেসেজ পাঠালেই দিতে হবে টাকা (গ্রামের কাগজ)](https://www.gramerkagoj.com/information-technology/314925)

**Partner মডেল ও credit line**
- [Solution Partners & Tech Providers (Gupshup)](https://partner-docs.gupshup.io/docs/what-is-sp-tp)
- [Managing credit lines (Meta docs)](https://support.chatarchitect.com/books/meta-whatsapp/page/managing-credit-lines-developer-documentation/export/pdf)
- [Partner-initiated WABA creation (Meta docs)](https://support.chatarchitect.com/books/meta-whatsapp/page/partner-initiated-waba-creation-developer-documentation/export/pdf)
- [Embedded Signup (Meta docs)](https://support.chatarchitect.com/books/meta-whatsapp/page/embedded-signup-developer-documentation/export/pdf)
- [Tech Provider vs Solution Partner (Ominiflow)](https://ominiflow.com/blog/tech-provider-vs-solution-partner)
- [New WhatsApp account model (360dialog)](https://docs.360dialog.com/partner/onboarding/new-whatsapp-account-model)

**Tech Provider ও App Review**
- [WhatsApp Tech Provider Program FAQ (Twilio)](https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/faq)
- [Tech Provider Program integration guide (Twilio)](https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide)
- [Technical Development Partner Onboarding (YCloud)](https://helpdocs.ycloud.com/partner-center/english-en-2/ji-shu-kai-fa-huo-ban/ji-shu-kai-fa-huo-ban-ru-men)
- [Become a Meta Tech Provider (Kapso)](https://docs.kapso.ai/docs/platform/become-tech-provider)
- [Tech Provider Integration / resellers (Plivo)](https://docs.plivo.com/docs/messaging/concepts/whatsapp/resellers)

**MPS ও managed billing**
- [Partner billing `meta_billing_mode` (Kapso)](https://docs.kapso.ai/docs/platform/tech-providers/overview)
- [Billed by Prelude vs. Billed by Meta (Prelude)](https://docs.prelude.so/verify/v2/documentation/whatsapp)
- [Become a Partner (Meta)](https://whatsappbusiness.com/partners/become-a-partner/)

**Payment ও messaging বন্ধ**
- [Messaging Paused Due to a Payment Error (runnr.ai)](https://runnr.ai/support/messaging-paused-due-to-a-payment-error-on-meta)
- [Error 131042 — Business Eligibility Payment Issue](https://gohighlevelassist.freshdesk.com/support/solutions/articles/155000007936-error-131042-business-eligibility-payment-issue)
- [Add Payment Method for WhatsApp Business API (Zaptilo)](https://zaptilo.ai/add-payment-method-to-whatsapp-business)

**চ্যানেল তুলনা**
- [Instagram Messaging API: How DM Automation Works 2026 (setsmart)](https://setsmart.io/blog/instagram-messaging-api)

---

## ১৬. 🔵 পরবর্তী পদক্ষেপ — সংক্ষেপে

1. **§১০.৫-এর সিদ্ধান্ত** — surcharge ভবিষ্যতে চালু হবে কি না (এটা বাকি সব কিছুর দিক ঠিক করে)
2. **App Review** — আপনার হাতে, কোডের সাথে সম্পর্কহীন
3. **BSP বেছে নেওয়া** — MPS-এর জন্য; এটাই সবচেয়ে বড় বাকি কাজ
4. **১টি test WABA** দিয়ে end-to-end যাচাই
5. **আসল রেট বসানো** — admin panel, একটি সংখ্যা
6. **প্রথম আসল merchant** — ⚠️ এর পরে বিলিং মডেল স্থায়ী

> ✅ **কোডের দিক থেকে এই টাস্কে কিছুই বাকি নেই।** বাকিটা Meta অ্যাকাউন্ট, চুক্তি ও একটি সংখ্যা।
