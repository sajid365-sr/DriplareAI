# DriplareAI — নতুন Pricing Strategy Implementation Plan

## সারসংক্ষেপ

বর্তমানে ৪টি প্ল্যান আছে: `starter (free)`, `growth`, `business`, `enterprise`। এগুলোকে সম্পূর্ণ পুনর্গঠন করে ৩টি শক্তিশালী প্ল্যানে নামিয়ে আনা হবে — `Starter`, `Business`, `Enterprise`। নতুন structure-এ platform access, premium features, chatbot limits এবং credit allocation সব কিছু স্পষ্টভাবে সংজ্ঞায়িত থাকবে।

---

## ১. প্রস্তাবিত ৩-টায়ার প্ল্যান কাঠামো (BD Region)

| বৈশিষ্ট্য | 🟢 Starter | 🔵 Business | 🟣 Enterprise |
|---|---|---|---|
| **মূল্য (BDT/মাস)** | ৳৯৯৯ | ৳২,৪৯৯ | Pay-as-you-go |
| **Trial** | ৩ দিন বিনামূল্যে | ❌ | ❌ |
| **Chatbot সংখ্যা** | ১টি | ৫টি | Unlimited |
| **Monthly Credits** | ১৫,০০০ | ৫০,০০০ | কোনো মাসিক limit নেই |
| **Facebook** | ✅ | ✅ | ✅ |
| **WhatsApp** | ❌ | ✅ | ✅ |
| **Instagram** | ❌ | ✅ | ✅ |
| **Website Widget** | ❌ | ❌ | ✅ |

---

## ২. Premium Features বিভাজন

আপনি যে premium services-এর কথা বলেছেন, সেগুলো এভাবে বিভাজন করার পরামর্শ দিচ্ছি:

| Premium Feature | Starter | Business | Enterprise |
|---|---|---|---|
| **AI System Prompt Enhance** | ❌ | ✅ | ✅ |
| **Auto Comment Reply (Facebook)** | ❌ | ✅ | ✅ |
| **Auto Order Creation (Steadfast & Pathao)** | ❌ | ✅ | ✅ |
| **FB Inbox দিয়ে Chatbot Training** | ❌ | ✅ | ✅ |

**যুক্তি:** Starter শুধু basic Facebook messaging-এর জন্য। Business থেকে সব automation শুরু হবে — এটাই আসল value proposition। Starter-কে lightweight রাখলে Business-এ upgrade করার incentive তৈরি হবে।

---

## ৩. Enterprise — Pay-as-you-go মডেল (বিস্তারিত প্রস্তাব)

> [!IMPORTANT]
> Enterprise-এর জন্য আপনি নতুন ধরনের implementation চান। নিচে ২টি option প্রস্তাব করছি। আপনাকে একটি বেছে নিতে হবে।

### Option A: Credit Pack মডেল (সহজ)
Enterprise user-রা কোনো fixed monthly fee দেবে না। পরিবর্তে:
- প্রতি মাসে **৳১,০০০ বেস ফি** (সার্ভার + সাপোর্ট কভার করতে)
- Credit **pack** কিনবে যা কখনো expire হবে না:
  - ১০,০০০ Credit → ৳৮০ টাকা
  - ৫০,০০০ Credit → ৳৩৫০ টাকা
  - ১,০০,০০০ Credit → ৳৬০০ টাকা
- সব platform + সব features included

### Option B: Pure PAYG মডেল (জটিল কিন্তু flexible)
- কোনো fixed fee নেই
- প্রতিটি AI reply-এর জন্য আলাদা charge:
  - Economy model: ৳০.০০৫/reply
  - Standard model: ৳০.০১৫/reply
  - Premium model: ৳০.০৫/reply
- মাস শেষে বিল generate হবে (prepaid wallet থেকে কাটবে)
- Minimum wallet balance: ৳৫০০

> [!NOTE]
> **আমার পরামর্শ: Option A বেছে নিন।** এটি implement করা সহজ, user-দের জন্য বোঝা সহজ, এবং আপনার revenue predictable থাকবে। Option B-এর billing complexity অনেক বেশি এবং user retention কমতে পারে।

---

## ৪. Credit সিস্টেম আপডেট

বর্তমান `credit-config.ts` এবং `plan-config.ts`-এ নতুন plan অনুযায়ী পরিবর্তন:

```
Starter:    ১৫,০০০ credits/মাস (পূর্বে growth-এ ছিল)
Business:   ৫০,০০০ credits/মাস (পূর্বে business-এ ছিল)
Enterprise: No monthly limit (pack-based)
```

বর্তমান `PlanKey = "starter" | "growth" | "business" | "enterprise"` থেকে পরিবর্তন হবে:
```
নতুন PlanKey = "starter" | "business" | "enterprise"
```

---

## ৫. বর্তমান প্রজেক্টে প্রভাব — পরিবর্তনের তালিকা

### ৫.১ Core Config Files

#### [MODIFY] [plan-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/plan-config.ts)
- `PlanKey` type থেকে `"growth"` বাদ দেওয়া
- `BD_PLANS` থেকে `growth` entry সরিয়ে নতুন Starter, Business, Enterprise define করা
- Starter-এ `trialDays: 3` এবং paid price যোগ করা
- `GLOBAL_PLANS` একইভাবে আপডেট

#### [MODIFY] [credit-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/credit-config.ts)
- `PLAN_CREDITS` object আপডেট:
  ```
  starter:    15000,
  business:   50000,
  enterprise: Infinity
  ```
- Enterprise Pack system যোগ (যদি Option A বেছে নেন)

#### [MODIFY] [payments.ts](file:///c:/Users/User/Projects/DriplareAI/lib/services/payments.ts)
- `PaymentPackageId` type আপডেট: `"growth_usd"`, `"growth_bdt"` সরানো; `"starter_bdt"`, `"business_bdt"` যোগ করা
- `PAYMENT_PACKAGES` record আপডেট

---

### ৫.২ UI/UX Files

#### [MODIFY] [pricing/page.tsx](file:///c:/Users/User/Projects/DriplareAI/app/(root)/pricing/page.tsx)
- ৪-কলাম grid থেকে ৩-কলাম grid-এ পরিবর্তন
- Enterprise-এর জন্য বিশেষ "Pay-as-you-go" UI section
- Premium features comparison table যোগ করা

#### [MODIFY] [pricing.json](file:///c:/Users/User/Projects/DriplareAI/public/locales/en/pricing.json)
- `growth` key সরানো
- `starter`, `business`, `enterprise` এর translations আপডেট

#### [MODIFY] [bn/pricing.json](file:///c:/Users/User/Projects/DriplareAI/public/locales/bn/pricing.json)
- একইভাবে বাংলা translations আপডেট

---

### ৫.৩ Database / Prisma

#### [MODIFY] [schema.prisma](file:///c:/Users/User/Projects/DriplareAI/prisma/schema.prisma)
- `User.plan` field এর default `"starter"` ঠিকই আছে
- বিদ্যমান `growth` plan user-দের migration এর জন্য একটি script বানানো দরকার

> [!WARNING]
> **Breaking Change:** Database-এ যাদের `plan = "growth"` আছে, তাদের automatically `"business"`-তে migrate করতে হবে। একটি migration script চালাতে হবে।

---

### ৫.৪ Feature Gate System

আপনার premium features (Auto Comment Reply, AI Enhance, etc.) গুলো plan-based gate করার জন্য `plan-config.ts`-এ নতুন field যোগ করার পরামর্শ দিচ্ছি:

```typescript
export interface PlanConfig {
  // ... existing fields ...
  premiumFeatures: {
    aiPromptEnhance: boolean;
    autoCommentReply: boolean;
    autoOrderCreation: boolean;
    fbInboxTraining: boolean;
  };
}
```

এবং যে API endpoint/component এই features ব্যবহার করে, সেখানে plan check যোগ করতে হবে।

---

## ৬. Open Questions — আপনার অনুমোদন দরকার

> [!IMPORTANT]
> **Enterprise Model:** Option A (Credit Pack) নাকি Option B (Pure PAYG) চান? এটি implementation-এর জন্য সবচেয়ে গুরুত্বপূর্ণ সিদ্ধান্ত।

> [!IMPORTANT]
> **Starter Trial:** ৩ দিনের trial-এ কত credit দেওয়া হবে? পরামর্শ: trial period-এ ৫,০০০ credit দিন (যথেষ্ট test করতে পারবে, কিন্তু abuse করা কঠিন হবে)।

> [!NOTE]
> **বিদ্যমান `growth` plan user:** যাদের এখন `growth` plan আছে, তাদের কোন plan-এ migrate করবেন? আমার পরামর্শ: `business`-এ migrate করুন এবং পরবর্তী billing cycle থেকে নতুন মূল্য প্রযোজ্য হবে।

> [!NOTE]
> **Website Widget (Enterprise Only):** Website Widget কি সত্যিই শুধু Enterprise-এ থাকবে? অনেক SaaS-এ widget সব plan-এই থাকে। এটি নিশ্চিত করুন।

---

## ৭. Verification Plan

1. **Unit Testing:** `plan-config.ts` এর নতুন plan structure ঠিকমতো কাজ করছে কিনা check
2. **Browser Testing:** Pricing page-এ ৩টি card ঠিকমতো render হচ্ছে কিনা
3. **Payment Flow:** Starter plan checkout → 3-day trial → billing শুরু
4. **Feature Gates:** Business plan-এ login করে Auto Comment Reply feature visible হচ্ছে কিনা
5. **Starter plan-এ:** WhatsApp integration block হচ্ছে কিনা
