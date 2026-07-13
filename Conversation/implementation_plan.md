# DriplareAI — Pricing এবং Credit System 업데이트 করার Implementation Plan

এই প্ল্যানে DriplareAI-এর প্রাইসিং মডেলকে ৩-টায়ারে রূপান্তর করা, "Premium Base + Top-up" মডেল চালু করা, এবং AI মডেল সিলেকশনকে ৩টি সহজ Quality Levels (Fast, Smart, Genius)-এ পরিবর্তন করার পদক্ষেপগুলো বিস্তারিত উল্লেখ করা হলো।

## User Review Required

> [!IMPORTANT]
> **মূল সিদ্ধান্তসমূহ যা এই প্ল্যানে যুক্ত করা হয়েছে:**
> 1. **Credit Cost per Reply:** Economy (Fast) = ১, Standard (Smart) = ৩, Premium (Genius) = ৫ ক্রেডিট।
> 2. **অন্যান্য Action-এর Cost হ্রাস:** `enhance_prompt` = ২০, `image_message` = ৫, `audio_per_minute` = ৫ ক্রেডিট।
> 3. **AI Quality Level Model Selection:** সাধারণ কাস্টমাররা শুধু Fast (⚡), Smart (🎯), Genius (🧠) সিলেক্ট করতে পারবেন।
> 4. **Enterprise Advanced Toggle:** শুধুমাত্র Enterprise ব্যবহারকারীরা "Advanced Model Details" টগল অন করে ১৭টি কাস্টম মডেলের মধ্য থেকে পছন্দমতো মডেল সিলেক্ট করতে পারবেন।
> 5. **Top-up Packages:** Business এবং Enterprise ব্যবহারকারীদের জন্য আলাদা মূল্যের Top-up ক্রেডিট প্যাক ব্যবস্থা থাকবে যা কখনো expire হবে না।

---

## Proposed Changes

### ১. Credit এবং Model Configuration

#### [MODIFY] [credit-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/credit-config.ts)
- `CREDIT_COSTS` আপডেট:
  - `reply_economy` = 1
  - `reply_standard` = 3
  - `reply_premium` = 5
  - `enhance_prompt` = 20
  - `image_message` = 5
  - `audio_per_minute` = 5
- `PLAN_CREDITS` আপডেট:
  - `starter` = 15000
  - `business` = 50000
  - `enterprise` = 150000
  - `growth` = 15000 (legacy compatibility)

#### [MODIFY] [plan-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/plan-config.ts)
- `BD_PLANS` ৩-টায়ার মডেলে আপডেট:
  - **Starter:** ৳৯৯৯/মাস (৩-দিন trial), ১৫,০০০ ক্রেডিট, ১টি চ্যাটবট, FB চ্যানেল।
  - **Business:** ৳২,৪৯৯/মাস, ৫০,০০০ ক্রেডিট, ১০টি চ্যাটবট, সব চ্যানেল।
  - **Enterprise:** ৳৪,৯৯৯/মাস, ১,৫০,০০০ ক্রেডিট, আনলিমিটেড চ্যাটবট, সব চ্যানেল + Widget।
- `PlanKey` থেকে `"growth"` বাদ না দিয়ে legacy user support-এর জন্য টাইপে রেখে দেওয়া।

---

### ২. Backend: Credit Validation ও Reset logic

#### [MODIFY] [route.ts (check-and-deduct)](file:///c:/Users/User/Projects/DriplareAI/app/api/credits/check-and-deduct/route.ts)
- Enterprise ব্যবহারকারীদের জন্য `unlimited` credit deduction bypass কোড সরিয়ে ফেলা (যাতে তাদের ক্রেডিটও ব্যালেন্স থেকে বিয়োগ হয়)।

#### [MODIFY] [route.ts (chat, enhance-prompt, compare)](file:///c:/Users/User/Projects/DriplareAI/app/api/chatbots/[chatbotId]/chat/route.ts)
- চ্যাট এপিআই, কম্পেয়ার এপিআই এবং এনহ্যান্স প্রম্পট এপিআই থেকে Enterprise-এর ক্রেডিট চেক বাইপাস লজিক বাদ দেওয়া, যাতে এন্টারপ্রাইজ প্ল্যানেও সঠিক ক্রেডিট লিমিট চেক প্রযোজ্য হয়।

#### [MODIFY] [route.ts (reset-credits)](file:///c:/Users/User/Projects/DriplareAI/app/api/cron/reset-credits/route.ts)
- Enterprise ব্যবহারকারীদের ক্রেডিট রিসেট এপিআই-এর ফিল্টার থেকে বাদ দেওয়া (যাতে তাদের ক্রেডিটও রিসেট হয়)।
- **নন-এক্সপায়ারিং টপ-আপ ক্রেডিট ফর্মুলা:**
  `topUpRemaining = Math.max(0, user.creditsBalance - Math.max(0, planCredits - user.creditsUsedThisCycle))`
  `newBalance = planCredits + topUpRemaining`
  এই গাণিতিক ফর্মুলা যোগ করা যাতে রিসেটের সময় কাস্টমারের অব্যবহৃত টপ-আপ ক্রেডিট অক্ষুণ্ণ থাকে।

---

### ৩. Billing ও Payments

#### [MODIFY] [payments.ts](file:///c:/Users/User/Projects/DriplareAI/lib/services/payments.ts)
- নতুন Uddoktapay প্যাকেজ এবং Top-up প্যাকসমূহ যুক্ত করা:
  - `topup_50k_business_bdt` = ৳৪০০
  - `topup_100k_business_bdt` = ৳৮০০
  - `topup_50k_enterprise_bdt` = ৳২৫০
  - `topup_100k_enterprise_bdt` = ৳৪৫০
  - `topup_500k_enterprise_bdt` = ৳২,০০০
- `finalizePayment` ফাংশনে top-up প্যাকেজের চেক যুক্ত করা:
  - যদি প্যাকেজ আইডি `topup_` দিয়ে শুরু হয়, তবে ব্যবহারকারীর প্ল্যান পরিবর্তন হবে না, শুধু `creditsBalance` নির্দিষ্ট পরিমাণে বৃদ্ধি পাবে।

---

### ৪. Frontend settings ও UI

#### [MODIFY] [chat-settings.tsx](file:///c:/Users/User/Projects/DriplareAI/app/\(dashboard\)/dashboard/chatbots/[chatbotId]/chat/_components/chat-settings.tsx)
- ব্যবহারকারীর প্ল্যান চেক করা:
  - যদি `starter` বা `business` হয়, তবে শুধু ৩টি Quality Levels (Fast / Smart / Genius) রেডিও বাটন/কার্ড লেআউটে দেখাবে।
  - যদি `enterprise` হয়, তবে একটি টগল দেখাবে: "Show Custom Models" (উন্নত কাস্টমাইজেশন)। টগল অন থাকলে আগের সার্চেবল কম্বোবক্স আসবে, টগল অফ থাকলে সাধারণ ৩টি Quality Levels আসবে।
- Quality Levels ম্যাপিং:
  - Fast (⚡) -> Gemini 2.5 Flash Lite
  - Smart (🎯) -> Gemini 2.5 Flash
  - Genius (🧠) -> Claude 3.5 Sonnet

#### [MODIFY] [PricingCards.tsx](file:///c:/Users/User/Projects/DriplareAI/app/\(dashboard\)/dashboard/payment/_components/PricingCards.tsx) এবং [page.tsx (pricing)](file:///c:/Users/User/Projects/DriplareAI/app/\(root\)/pricing/page.tsx)
- ৩-কলাম রেসপন্সিভ গ্রিড কোড যুক্ত করা।
- Enterprise প্ল্যানের `perCreditLabel` এবং অন্যান্য ডিটেইলস সঠিক BDT আকারে প্রদর্শন করা।

---

## Verification Plan

### Automated/Local Tests
- `npm run dev` সার্ভার চলমান রেখে নতুন UI ভিউ চেক করা।
- Settings পেজ থেকে Fast/Smart/Genius এবং Enterprise ব্যবহারকারীদের জন্য advanced model toggle চেক করা।
- এপিআই লেভেলে ক্রেডিট ব্যালেন্স রিসেট ও ক্রেডিট কাটার লজিক ম্যানুয়ালি যাচাই করা।
