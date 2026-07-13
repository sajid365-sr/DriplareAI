# DriplareAI — Credit System ও AI Model Tier বিশ্লেষণ

## ১. বর্তমান Credit Cost Structure বিশ্লেষণ

### বর্তমান অবস্থা ([credit-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/credit-config.ts)):

```
reply_economy:    5 credits/reply
reply_standard:   15 credits/reply
reply_premium:    50 credits/reply
```

### এটা কি ঠিক আছে? — **আংশিক ঠিক, কিন্তু সমস্যা আছে**

#### ✅ যেটা ঠিক আছে:
- ৩-tier model system-এর ধারণাটা ভালো — সব AI chatbot SaaS এটা করে
- Economy → Standard → Premium-এ cost বাড়ছে — এটা logical

#### 🔴 সমস্যা ১: Credit per reply অত্যন্ত বেশি (especially Premium)

**হিসাব করা যাক — একজন Business user (৫০,০০০ credit/মাস) কতটি reply পাবে:**

| Tier | Credit/Reply | ৫০,০০০ Credit-এ কতটি Reply | দিনে গড়ে (৩০ দিন) |
|---|---|---|---|
| Economy | ৫ | ১০,০০০ replies | ~৩৩৩/দিন ✅ |
| Standard | ১৫ | ৩,৩৩৩ replies | ~১১১/দিন ⚠️ |
| Premium | ৫০ | ১,০০০ replies | ~৩৩/দিন ❌ |

> [!WARNING]
> একটি active Facebook page-এ দিনে ৫০-১০০+ মেসেজ আসতে পারে। Premium model ব্যবহার করলে Business plan-এর ৫০,০০০ credit **মাত্র ১০-২০ দিনেই শেষ হয়ে যাবে।** এটি কাস্টমারদের হতাশ করবে।

#### 🔴 সমস্যা ২: Economy → Premium-এর মধ্যে ১০x gap

```
Economy:  5 credits
Standard: 15 credits (3x economy)
Premium:  50 credits (10x economy, 3.3x standard)
```

Standard → Premium jump (৩.৩×) কিছুটা বেশি। SaaS best practice হলো tier-এর মধ্যে **২-৩× gap** রাখা।

---

### প্রস্তাবিত Credit Cost (Adjusted):

| Tier | বর্তমান | প্রস্তাবিত | যুক্তি |
|---|---|---|---|
| Economy | ৫ | **৩** | হালকা model-এর জন্য আরও সাশ্রয়ী, বেশি reply |
| Standard | ১৫ | **৮** | মূল workhorse tier — সবচেয়ে বেশি ব্যবহার হবে |
| Premium | ৫০ | **২০** | High-quality কিন্তু affordable, ১০x নয় |

**নতুন হিসাব — Business user (৫০,০০০ credit/মাস):**

| Tier | Credit/Reply | ৫০K Credit-এ Replies | দিনে গড়ে |
|---|---|---|---|
| Economy | ৩ | ১৬,৬৬৭ | ~৫৫৫/দিন ✅ |
| Standard | ৮ | ৬,২৫০ | ~২০৮/দিন ✅ |
| Premium | ২০ | ২,৫০০ | ~৮৩/দিন ✅ |

> [!TIP]
> এই structure-এ একটি busy Facebook page (দিনে ১০০+ মেসেজ) Premium model দিয়েও **পুরো মাস চলতে পারবে** Business plan-এ।

---

## ২. Model Tier Naming — "Economy/Standard/Premium" কি সঠিক?

### 🔴 সমস্যা: খুব Technical

আপনার কাস্টমার কারা? **বাংলাদেশি ছোট-মাঝারি ব্যবসার মালিক যারা Facebook/Instagram-এ পণ্য বিক্রি করেন।** তাদের কাছে:

- ❌ "Economy model" মানে কী — তারা জানে না
- ❌ "GPT-4o" বা "Gemini 2.5 Flash" — এগুলো alien language
- ❌ "Model Tier" — কী জিনিস?

### ✅ আপনার ধারণা সঠিক পথে — কিন্তু আরেকটু refine দরকার

আপনি বলেছেন কোম্পানি দেখাতে (Google, OpenAI ইত্যাদি) — এটা ভালো ধারণা। কিন্তু আমি কিছু counterpoint তুলে ধরি:

#### Counter-argument ১: কোম্পানি নাম দেখালে confusion তৈরি হতে পারে

ধরুন কাস্টমার দেখছে:
```
Google → Standard
Google → Pro
OpenAI → Standard
OpenAI → Pro
DeepSeek → Standard
```

কাস্টমার ভাববে: "Google Standard আর OpenAI Standard — এদের মধ্যে পার্থক্য কী? কোনটা ভালো? আমি কোনটা নিবো?"

#### Counter-argument ২: সব কোম্পানির সব tier-এ model নেই

```
বর্তমান model mapping:
  Google    → Economy (Flash Lite) + Standard (Flash) + Premium (Pro 1.5)  ← ৩টি tier আছে
  OpenAI    → Standard (4o-mini) + Premium (4o, o1)                       ← Economy নেই
  Anthropic → Standard (Haiku) + Premium (Sonnet)                         ← Economy নেই
  DeepSeek  → Economy (V3) + Premium (R1)                                 ← Standard নেই
  Meta      → Economy (8B) + Standard (70B)                               ← Premium নেই
```

তাহলে "Google Standard" vs "OpenAI Standard" — এদের quality ও cost আলাদা। কিন্তু কাস্টমারকে একই price charge করা হচ্ছে। এটা **কোম্পানি-ভিত্তিক grouping-এর মূল সমস্যা।**

---

## ৩. আমার প্রস্তাব — ৩টি Approach

### 🏆 প্রস্তাব A: "Smart AI Quality" মডেল (⭐ সবচেয়ে ভালো)

**ধারণা:** কাস্টমারকে কোম্পানি বা model দেখানো হবে না। পরিবর্তে ৩টি সহজ "AI Quality Level" দেখাবে:

```
┌─────────────────────────────────────────────────────────────┐
│              AI মডেল সিলেক্ট করুন                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚡ Fast (দ্রুত)                              ৩ Credit     │
│  দ্রুত উত্তর দেয়, সাধারণ প্রশ্নের জন্য পারফেক্ট           │
│                                                             │
│  🎯 Smart (স্মার্ট)                   ⭐ Recommended       │
│  বুদ্ধিমান ও নির্ভুল উত্তর             ৮ Credit            │
│                                                             │
│  🧠 Genius (জিনিয়াস)                         ২০ Credit    │
│  সবচেয়ে শক্তিশালী AI, জটিল প্রশ্নের জন্য                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Backend-এ কী হবে:**
- **Fast** → Gemini 2.5 Flash Lite (সবচেয়ে সস্তা ও দ্রুত)
- **Smart** → Gemini 2.5 Flash (best value for money)
- **Genius** → Claude 3.5 Sonnet বা GPT-4o (সেরা quality)

Platform (Driplare) নিজে সেরা model select করে — কাস্টমারকে technical details জানতে হবে না।

**কেন এটা সেরা:**
- ✅ কাস্টমার সহজে বোঝে — "দ্রুত", "স্মার্ট", "জিনিয়াস"
- ✅ বাংলায় + ইংরেজিতে কাজ করে
- ✅ Platform পরে model switch করতে পারবে (যেমন Gemini Flash → GPT-4o-mini) কাস্টমার না জেনে — cost optimization
- ✅ কোনো "Google vs OpenAI" confusion নেই
- ✅ কোনো টেকনিক্যাল শব্দ নেই

> [!IMPORTANT]
> **এই approach-এর সবচেয়ে বড় সুবিধা:** আপনি পরে যেকোনো সময় backend model পাল্টাতে পারবেন (নতুন সস্তা model আসলে) — কাস্টমার কিছু জানবে না, কিন্তু তাদের experience ভালো থাকবে। **এটা আপনার platform-এর cost control করার ক্ষমতা দেয়।**

---

### 📋 প্রস্তাব B: "Company + Tier" মডেল (আপনার ধারণা, refined)

```
┌─────────────────────────────────────────────────────────────┐
│              AI মডেল সিলেক্ট করুন                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🟢 Google AI                                               │
│     ├── Standard (৮ Credit)     ⭐ Recommended              │
│     └── Pro (২০ Credit)                                     │
│                                                             │
│  🔵 OpenAI (ChatGPT)                                       │
│     ├── Standard (৮ Credit)                                 │
│     └── Pro (২০ Credit)                                     │
│                                                             │
│  🟣 Anthropic (Claude)                                      │
│     ├── Standard (৮ Credit)                                 │
│     └── Pro (২০ Credit)                                     │
│                                                             │
│  🟡 DeepSeek                                                │
│     ├── Fast (৩ Credit)                                     │
│     └── Pro (২০ Credit)                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**সমস্যা:**
- ⚠️ কাস্টমার confused হবে — "Google Standard আর OpenAI Standard — কোনটা ভালো?"
- ⚠️ সব কোম্পানির সব tier-এ model নেই (ওপরে দেখানো হয়েছে)
- ⚠️ কাস্টমারকে একটি অপ্রয়োজনীয় সিদ্ধান্ত নিতে বাধ্য করা হচ্ছে
- ⚠️ পরে backend model পাল্টাতে কঠিন — কাস্টমার "Google" select করেছে, সে Google-ই expect করবে

---

### 📋 প্রস্তাব C: Hybrid — "Quality + Optional Advanced"

```
Default view (সাধারণ কাস্টমার):
  ⚡ Fast (৩ Credit)
  🎯 Smart (৮ Credit) ⭐
  🧠 Genius (২০ Credit)

Advanced view (toggle button দিয়ে) — যারা tech-savvy:
  ⚡ Fast → Google Gemini Flash Lite
  🎯 Smart → Google Gemini Flash / OpenAI GPT-4o Mini
  🧠 Genius → Claude 3.5 Sonnet / GPT-4o
```

**সুবিধা:**
- ✅ সাধারণ কাস্টমার simple view দেখবে
- ✅ Tech-savvy কাস্টমার advanced details দেখতে পারবে
- ⚠️ কিন্তু implementation একটু complex

---

## ৪. আমার সুপারিশ — প্রস্তাব A কেন সেরা

> [!IMPORTANT]
> **আমি প্রস্তাব A ("Smart AI Quality" মডেল) strongly recommend করছি।**

### কারণ ১: Customer Journey সবচেয়ে সহজ
```
বর্তমান customer journey:
  ১. Model list দেখো (১৭টি model! 😱)
  ২. Gemini 2.5 Flash Lite কী? Flash আর Flash Lite-র পার্থক্য কী?
  ৩. Economy/Standard/Premium কী?
  ৪. Confused হয়ে default model-ই রেখে দাও

প্রস্তাবিত customer journey:
  ১. ৩টি option দেখো: Fast, Smart, Genius
  ২. Smart recommended দেখে select করো
  ৩. Done! ✅
```

### কারণ ২: Platform-এর Cost Control
ধরুন ভবিষ্যতে:
- Google Gemini-র price বেড়ে গেলো
- একটি নতুন সস্তা model আসলো (যেমন DeepSeek V5)
- কোনো model deprecate হলো

**প্রস্তাব A-তে:** আপনি backend-এ model switch করবেন। কাস্টমার "Smart" select করেছে — তার experience একই থাকবে, কিন্তু আপনার cost কমবে।

**প্রস্তাব B-তে:** কাস্টমার "Google Standard" select করেছে — আপনি DeepSeek-এ switch করতে পারবেন না, কারণ কাস্টমার explicitly Google বেছে নিয়েছে।

### কারণ ৩: Pricing Simplicity
- ৩টি clear tier: ৩, ৮, ২০ credits
- কোনো কোম্পানি comparison দরকার নেই
- কোনো hidden complexity নেই

---

## ৫. প্রস্তাবিত Code Structure — প্রস্তাব A implement করলে

### chat-models.ts পরিবর্তন:

```typescript
// কাস্টমার-facing quality tiers
export type AIQualityTier = "fast" | "smart" | "genius";

export interface AIQualityConfig {
  tier: AIQualityTier;
  label: { en: string; bn: string };
  description: { en: string; bn: string };
  creditCost: number;
  icon: string;       // emoji or lucide icon name
  recommended?: boolean;
  // Backend model mapping — কাস্টমার এটা দেখবে না
  backendModel: string;  // OpenRouter model string
}

export const AI_QUALITY_TIERS: AIQualityConfig[] = [
  {
    tier: "fast",
    label: { en: "Fast", bn: "দ্রুত" },
    description: { 
      en: "Quick replies, perfect for common questions", 
      bn: "দ্রুত উত্তর, সাধারণ প্রশ্নের জন্য পারফেক্ট" 
    },
    creditCost: 3,
    icon: "⚡",
    backendModel: "google/gemini-2.5-flash-lite",
  },
  {
    tier: "smart",
    label: { en: "Smart", bn: "স্মার্ট" },
    description: { 
      en: "Intelligent & accurate, best for most businesses", 
      bn: "বুদ্ধিমান ও নির্ভুল, বেশিরভাগ ব্যবসার জন্য সেরা" 
    },
    creditCost: 8,
    icon: "🎯",
    recommended: true,
    backendModel: "google/gemini-2.5-flash",
  },
  {
    tier: "genius",
    label: { en: "Genius", bn: "জিনিয়াস" },
    description: { 
      en: "Most powerful AI, for complex customer interactions", 
      bn: "সবচেয়ে শক্তিশালী AI, জটিল কাস্টমার ইন্টারঅ্যাকশনের জন্য" 
    },
    creditCost: 20,
    icon: "🧠",
    backendModel: "anthropic/claude-3.5-sonnet",
  },
];
```

### credit-config.ts পরিবর্তন:

```typescript
export const CREDIT_COSTS = {
  reply_fast:     3,    // was: reply_economy: 5
  reply_smart:    8,    // was: reply_standard: 15
  reply_genius:   20,   // was: reply_premium: 50
  
  // বাকি সব একই থাকবে
  test_chat_multiplier: 2,
  enhance_prompt: 30,
  file_embedding_per_100kb: 5,
  image_message: 15,
  audio_per_minute: 20,
} as const;
```

---

## ৬. অন্যান্য Credit Cost — এগুলো কি ঠিক আছে?

| Action | বর্তমান Cost | মতামত |
|---|---|---|
| `test_chat_multiplier: 2` | ✅ | ঠিক আছে — playground-এ test-এ বেশি charge যুক্তিসঙ্গত |
| `enhance_prompt: 30` | ⚠️ | একটু বেশি। Starter-র ১৫K credit-এ মাত্র ৫০০ বার enhance করা যাবে। **২০** করলে ভালো হয় |
| `file_embedding_per_100kb: 5` | ✅ | যথেষ্ট কম, knowledge base upload-এ কাস্টমার burden ফিল করবে না |
| `image_message: 15` | ⚠️ | Smart tier (৮) + image (১৫) = ২৩ credit একটি ছবি-সহ reply-তে। **১০** করলে ভালো |
| `audio_per_minute: 20` | ⚠️ | Voice message ৩ মিনিট হলে ৬০ credit + reply cost। **১৫** করলে balance ভালো হবে |

---

## ৭. Open Questions — আপনার সিদ্ধান্ত দরকার

> [!IMPORTANT]
> **প্রশ্ন ১:** প্রস্তাব A (Fast/Smart/Genius — কোম্পানি hide করা) নাকি প্রস্তাব B (Company + Tier দেখানো) — কোনটা চান?

> [!IMPORTANT]
> **প্রশ্ন ২:** Credit per reply — নতুন rates (৩/৮/২০) কি OK? নাকি বর্তমান (৫/১৫/৫০) রাখতে চান?

> [!NOTE]
> **প্রশ্ন ৩:** Dashboard playground-এ `test_chat_multiplier: 2` ঠিক আছে? (মানে playground-এ test করলে ২× credit খরচ হবে)

> [!NOTE]
> **প্রশ্ন ৪:** Advanced users-দের জন্য কি "model details দেখুন" toggle রাখবেন? (প্রস্তাব C — Hybrid approach)
