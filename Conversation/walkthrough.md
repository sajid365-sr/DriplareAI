# DriplareAI — Pricing এবং Credit System আপডেট করার Walkthrough

এই কাজের মাধ্যমে DriplareAI-এর প্রাইসিং মডেল ৩-টায়ারে রূপান্তর করার কাজ সম্পন্ন করা হয়েছে এবং নতুন ও পুরাতন সব ধরনের কাজ সম্পন্ন করে সম্পূর্ণ প্রজেক্ট টাইপচেক ভেরিফাই করা হয়েছে।

## সম্পন্ন হওয়া পরিবর্তনসমূহ (Changes Made)

### ১. Credit এবং Model Configuration
- **[credit-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/credit-config.ts)**:
  - `CREDIT_COSTS` আপডেট করা হয়েছে (Economy = ১, Standard = ৩, Premium = ৫ ক্রেডিট)।
  - `PLAN_CREDITS` ৩-টায়ার মডেলের লিমিট অনুযায়ী সেট করা হয়েছে (Starter = ১৫,০০০, Business = ৫০,০০০, Enterprise = ১,৫০,০০০ ক্রেডিট)।
- **[plan-config.ts](file:///c:/Users/User/Projects/DriplareAI/lib/domain/plan-config.ts)**:
  - `BD_PLANS` ৩-টায়ারে রি-ডিফাইন করা হয়েছে (Starter, Business, Enterprise)।

### ২. Backend: Credit Validation ও Reset logic
- **[check-and-deduct/route.ts](file:///c:/Users/User/Projects/DriplareAI/app/api/credits/check-and-deduct/route.ts)**:
  - Enterprise ইউজারদের ক্ষেত্রে ক্রেডিট ডিডাকশন বাইপাস লজিক সরিয়ে ফেলা হয়েছে যাতে তাদের ক্রেডিটও লিমিট অনুযায়ী ট্র‍্যাক হয়।
- **[chat/route.ts](file:///c:/Users/User/Projects/DriplareAI/app/api/chatbots/[chatbotId]/chat/route.ts)**, **[enhance-prompt/route.ts](file:///c:/Users/User/Projects/DriplareAI/app/api/chatbots/[chatbotId]/enhance-prompt/route.ts)**, **[compare/route.ts](file:///c:/Users/User/Projects/DriplareAI/app/api/chatbots/[chatbotId]/compare/route.ts)**:
  - ক্রেডিট চেকিং এবং লিমিট এপিআই লেভেলে এন্টারপ্রাইজ ইউজারদের জন্য সঠিকভাবে প্রয়োগ করা হয়েছে।
- **[reset-credits/route.ts](file:///c:/Users/User/Projects/DriplareAI/app/api/cron/reset-credits/route.ts)**:
  - টপ-আপের নন-এক্সপায়ারিং রোল-ওভার লজিক ফর্মুলা `topUpRemaining = Math.max(0, user.creditsBalance - Math.max(0, planCredits - user.creditsUsedThisCycle))` ব্যবহার করে বসানো হয়েছে।

### ৩. Billing, Payments & Top-ups
- **[payments.ts](file:///c:/Users/User/Projects/DriplareAI/lib/services/payments.ts)**:
  - ৩টি টপ-আপ প্যাকেজ BDT এবং Uddoktapay গেটওয়ের জন্য কনফিগার করা হয়েছে।
  - `finalizePayment` এ টপ-আপ প্যাকেজ পেমেন্টের ক্ষেত্রে কোনো প্ল্যান চেঞ্জ ছাড়া ব্যালেন্স ইনক্রিমেন্ট এবং নোটিফিকেশন যুক্ত করার লজিক ভেরিফাই করা হয়েছে।
- **[TopUpCards.tsx](file:///c:/Users/User/Projects/DriplareAI/app/(dashboard)/dashboard/payment/_components/TopUpCards.tsx)**:
  - একটি প্রিমিয়াম এবং আধুনিক টপ-আপ ক্রেডিট পারচেজ উইজেট তৈরি করা হয়েছে, যা লাইট/ডার্ক মোড সমর্থন করে।
  - ইউজার কোনো প্ল্যান-এ আছেন তার ভিত্তিতে সঠিক টপ-আপ অপশন শো করে। Starter প্ল্যানের ক্ষেত্রে টপ-আপ কেনার অপশন লক দেখায় এবং বিজনেস/এন্টারপ্রাইজে আপগ্রেড করার পরামর্শ দেয়।
- **[page.tsx (payment)](file:///c:/Users/User/Projects/DriplareAI/app/(dashboard)/dashboard/payment/page.tsx)**:
  - নতুন `TopUpCards` ইন্টিগ্রেট করা হয়েছে এবং Uddoktapay গেটওয়ে চার্জ এপিআই-এর মাধ্যমে টপ-আপ কেনার ফ্লো তৈরি করা হয়েছে।

### ৪. Frontend Settings & UI
- **[chat-settings.tsx](file:///c:/Users/User/Projects/DriplareAI/app/(dashboard)/dashboard/chatbots/[chatbotId]/chat/_components/chat-settings.tsx)**:
  - Fast (⚡), Smart (🎯), Genius (🧠) কোয়ালিটি লেভেল কার্ড UI এবং এন্টারপ্রাইজ ইউজারদের জন্য সার্চেবল ১৭টি কাস্টম মডেল সিলেক্ট করার অ্যাডভান্সড কম্বোবক্স টগল বাটন ভেরিফাই ও ইন্টিগ্রেট করা হয়েছে।
- **[pricing/page.tsx](file:///c:/Users/User/Projects/DriplareAI/app/(root)/pricing/page.tsx)** এবং **[PricingCards.tsx](file:///c:/Users/User/Projects/DriplareAI/app/(dashboard)/dashboard/payment/_components/PricingCards.tsx)**:
  - BDT এন্টারপ্রাইজ প্ল্যানের ক্ষেত্রে `perCreditLabel` (৳০.০০৫) ও রেট দেখানোর কোড শর্তটি আপডেট করা হয়েছে (`plan.key !== "starter" && plan.includedCredits !== Infinity`) যাতে গ্লোবাল ও বিডি মার্কেটপ্লেস উভয় ক্ষেত্রেই নিখুঁতভাবে রেন্ডার হয়।
- **i18n Translations**:
  - `public/locales/en/payment.json` এবং `public/locales/bn/payment.json`-এ টপ-আপ সম্পর্কিত সব ডাইনামিক স্ট্রিং যোগ করা হয়েছে।

## Verification
- `npx tsc --noEmit` রান করে সম্পূর্ণ টাইপচেক রান করা হয়েছে এবং প্রজেক্টটি কোনো এরর ছাড়াই সফলভাবে কম্পাইল হয়েছে।
