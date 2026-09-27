# Task List — Pricing & Credit System Update

- [x] `lib/domain/credit-config.ts` — CREDIT_COSTS ও PLAN_CREDITS ভ্যালু আপডেট করা
- [x] `lib/domain/plan-config.ts` — BD_PLANS আপডেট (Starter, Business, Enterprise)
- [x] Backend: Enterprise লিমিট ও চেক যুক্ত করা
  - [x] `app/api/credits/check-and-deduct/route.ts` — Enterprise bypass সরানো
  - [x] `app/api/chatbots/[chatbotId]/chat/route.ts` — Enterprise bypass সরানো
  - [x] `app/api/chatbots/[chatbotId]/enhance-prompt/route.ts` — Enterprise bypass সরানো
  - [x] `app/api/chatbots/[chatbotId]/compare/route.ts` — Enterprise bypass সরানো
  - [x] `app/api/cron/reset-credits/route.ts` — Enterprise রিসেট ও টপ-আপ গাণিতিক ফর্মুলা যোগ করা
- [x] Payments & Top-ups:
  - [x] `lib/services/payments.ts` — Payment Packages ও `finalizePayment` আপডেট
  - [x] টপ-আপ ক্রেডিট পারচেজ UI এবং গেটওয়ে হ্যান্ডলার যোগ করা
- [x] UI / Frontend:
  - [x] `app/(dashboard)/dashboard/chatbots/[chatbotId]/chat/_components/chat-settings.tsx` — Fast/Smart/Genius UI এবং Enterprise-এর advanced toggle যোগ করা
  - [x] `app/(root)/pricing/page.tsx` — ৩-কলাম গ্রিড ও প্রাইসিং লেবেল আপডেট
  - [x] `app/(dashboard)/dashboard/payment/_components/PricingCards.tsx` — ৩-কলাম গ্রিড ও প্রাইসিং লেবেল আপডেট
- [x] Verification:
  - [x] Typescript compilation / typecheck সফলভাবে সম্পন্ন হয়েছে
  - [x] টপ-আপ ফ্লো এবং পেমেন্ট লজিক কোড লেভেলে ভেরিফাই করা হয়েছে
