# DriplareAI — Enterprise Pricing সমস্যা বিশ্লেষণ ও সমাধান প্রস্তাব

## ১. বর্তমান অবস্থা — যা আছে (Code Analysis)

### বর্তমান Plan Structure ([plan-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/plan-config.ts)):

| Plan | মূল্য (BDT) | Credits | Chatbots | Platforms |
|---|---|---|---|---|
| **Starter** | ৳০ (Free) | ৫০০ | ১ | Facebook |
| **Growth** | ৳৯৯৯/মাস | ১৫,০০০ | ৩ | FB + IG + WhatsApp |
| **Business** | ৳২,৪৯৯/মাস | ৫০,০০০ | ১০ | সব |
| **Enterprise** | Custom | Infinity | Unlimited | সব |

### প্রস্তাবিত Plan Structure ([implementation_plan](file:///c:/Users/User/Projects/DriplareAI/implementation_plan_pricing_update.md)):

| Plan | মূল্য (BDT) | Credits | Chatbots | Platforms |
|---|---|---|---|---|
| **Starter** | ৳৯৯৯/মাস (৩-দিন trial) | ১৫,০০০ | ১ | Facebook |
| **Business** | ৳২,৪৯৯/মাস | ৫০,০০০ | ৫ | FB + IG + WhatsApp |
| **Enterprise** | Pay-as-you-go | কোনো limit নেই | Unlimited | সব (Widget সহ) |

---

## ২. যে সমস্যাগুলো চিহ্নিত হয়েছে

### 🔴 সমস্যা ১: Enterprise-এ কোনো মূল্য নির্ধারিত নেই

Implementation plan-এ Enterprise-কে "Pay-as-you-go" বলা হয়েছে কিন্তু:
- **কোনো নির্দিষ্ট per-credit মূল্য নেই**
- কোনো minimum commitment নেই
- কাস্টমার জানেই না সে কত টাকায় কত ক্রেডিট পাবে

> [!CAUTION]
> **ফলাফল:** একজন Enterprise কাস্টমার pricing page দেখে সিদ্ধান্ত নিতে পারবে না। "Contact Sales" মডেল বড় SaaS-এ কাজ করে (যেমন Salesforce, AWS) কারণ তাদের sales team আছে। কিন্তু **বাংলাদেশের মার্কেটে একটি নতুন SaaS-এর জন্য এটা conversion killer।**

---

### 🔴 সমস্যা ২: Credit Pack মূল্য Business Plan-এর সাথে সরাসরি conflict করে

Implementation plan-এর **Option A: Credit Pack** অনুযায়ী:

```
Enterprise Credit Packs:
  ১০,০০০ Credit → ৳৮০
  ৫০,০০০ Credit → ৳৩৫০
  ১,০০,০০০ Credit → ৳৬০০
  + ৳১,০০০ base fee/মাস
```

**তুলনা করা যাক:**

| তুলনা | Business Plan | Enterprise (Credit Pack) |
|---|---|---|
| ৫০,০০০ ক্রেডিটের জন্য খরচ | **৳২,৪৯৯** | ৳১,০০০ (base) + ৳৩৫০ (pack) = **৳১,৩৫০** |
| ১,০০,০০০ ক্রেডিটের জন্য খরচ | Business-এ নেই | ৳১,০০০ + ৳৬০০ = **৳১,৬০০** |
| সব features | ✅ | ✅ |
| সব channels | ✅ | ✅ + Widget |

> [!WARNING]
> **বিপর্যয়কর সমস্যা:** একজন কাস্টমার Business-এ ৳২,৪৯৯ দিয়ে ৫০,০০০ ক্রেডিট পায়। কিন্তু Enterprise-তে মাত্র **৳১,৩৫০ দিয়ে একই ৫০,০০০ ক্রেডিট + Website Widget + Unlimited Chatbot** পাবে! তাহলে কেউ কেন Business plan কিনবে?

---

### 🔴 সমস্যা ৩: Per-Credit Rate অসামঞ্জস্যতা

বর্তমান code-এ per-credit rate:
- **Business:** ৳০.০০৮/credit (extra credit-এর জন্য)
- **Growth:** ৳০.০১/credit

কিন্তু Credit Pack-এর হিসাবে:
- **১০,০০০ Credit → ৳৮০** = ৳০.০০৮/credit
- **৫০,০০০ Credit → ৳৩৫০** = ৳০.০০৭/credit
- **১,০০,০০০ Credit → ৳৬০০** = ৳০.০০৬/credit

Enterprise-এর per-credit rate Business-এর চেয়ে **কম** — এটা pricing hierarchy ভেঙে দেয়।

---

## ৩. গভীর বিশ্লেষণ — কেন এই সমস্যা তৈরি হচ্ছে?

মূল কারণ হলো **"Pay-as-you-go" ধারণাটি এভাবে apply করা হয়েছে যেখানে নিচের plan-এর চেয়ে Enterprise সস্তা হয়ে যাচ্ছে।** একটি সঠিক pricing hierarchy-তে:

```
Starter < Business < Enterprise (value ও মূল্য দুটোই বাড়বে)
```

কিন্তু বর্তমান প্রস্তাবে:
```
Starter (৳৯৯৯) < Enterprise (৳১,৩৫০) < Business (৳২,৪৯৯) ❌
```

---

## ৪. প্রস্তাবিত সমাধান — Enterprise Pricing Design

### ✅ চূড়ান্ত প্রস্তাব: "Premium Base + Top-up Credit" মডেল

**ধারণা:** Enterprise হলো Business-এর উপরের একটি premium tier — তাই base fee Business-এর চেয়ে বেশি হবে এবং included credits থাকবে। ক্রেডিট শেষ হলে top-up করবে।

| বৈশিষ্ট্য | Starter | Business | Enterprise |
|---|---|---|---|
| **মূল্য** | ৳৯৯৯/মাস | ৳২,৪৯৯/মাস | **৳৪,৯৯৯/মাস** |
| **Included Credits** | ১৫,০০০ | ৫০,০০০ | **১,৫০,০০০** |
| **Extra Credit Rate** | ৳০.০১/credit | ৳০.০০৮/credit | **৳০.০০৫/credit** |
| **Chatbots** | ১ | ৫ | Unlimited |
| **Platforms** | Facebook | FB + IG + WA | সব + Widget |
| **Premium Features** | ❌ | ✅ | ✅ |
| **Credit Top-up** | ❌ | ✅ | ✅ |
| **Priority Support** | ❌ | ✅ | ✅ |

### Top-up Credit Packs (Business ও Enterprise উভয়ের জন্য):

| Pack | Business মূল্য | Enterprise মূল্য |
|---|---|---|
| ৫০,০০০ Credit | ৳৪০০ (৳০.০০৮/cr) | ৳২৫০ (৳০.০০৫/cr) |
| ১,০০,০০০ Credit | ৳৮০০ (৳০.০০৮/cr) | ৳৪৫০ (৳০.০০৪৫/cr) |
| ৫,০০,০০০ Credit | — | ৳২,০০০ (৳০.০০৪/cr) |

> [!NOTE]
> Top-up credit কখনো expire হবে না — এটি extra credit হিসেবে balance-এ যোগ হবে। Monthly reset-এ included credits আবার reset হবে কিন্তু top-up balance অক্ষুণ্ণ থাকবে।

---

## ৫. Open Questions — সিদ্ধান্ত

| প্রশ্ন | সিদ্ধান্ত |
|---|---|
| **Enterprise মডেল** | ✅ প্রস্তাব A (Premium Base + Top-up) — অনুমোদিত, কোনো adjustment নেই |
| **Enterprise included credits** | ✅ ১,৫০,০০০ — আপাতত এটাই থাকবে |
| **Top-up পদ্ধতি** | ✅ Self-serve — কাস্টমার Dashboard থেকে নিজেই কিনবে |
| **USD pricing** | ⏸️ আপাতত দরকার নেই — শুধু BD market |
| **Business-এ top-up** | ✅ হ্যাঁ, Business plan-এও credit top-up অপশন থাকবে (per-credit rate ৳০.০০৮) |

---

## ৬. Profit Analysis

```
ধরি, AI API cost প্রতি credit-এ ~ ৳০.০০২ (average across tiers)

Enterprise কাস্টমার মাসে ৳৪,৯৯৯ দেয়:
  - ১,৫০,০০০ credit × ৳০.০০২ = ৳৩০০ API cost
  - Gross Profit = ৳৪,৯৯৯ - ৳৩০০ = ৳৪,৬৯৯ (94% margin) ✅

Business কাস্টমার মাসে ৳২,৪৯৯ দেয়:
  - ৫০,০০০ credit × ৳০.০০২ = ৳১০০ API cost
  - Gross Profit = ৳২,৪৯৯ - ৳১০০ = ৳২,৩৯৯ (96% margin) ✅

Top-up Pack (৫০,০০০ credit → ৳২৫০ Enterprise):
  - API cost = ৳১০০
  - Profit = ৳১৫০ (60% margin) ✅

Top-up Pack (৫০,০০০ credit → ৳৪০০ Business):
  - API cost = ৳১০০
  - Profit = ৳৩০০ (75% margin) ✅
```
