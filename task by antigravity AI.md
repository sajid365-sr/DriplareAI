# Credit System Implementation Tasks

## TASK 1 — Database Schema
- `[x]` `schema.prisma` — User model rename: `includedMessages` → `includedCredits`, `messagesUsedThisCycle` → `creditsUsedThisCycle`
- `[x]` `schema.prisma` — User model-এ `creditsBalance` (Int, default 500) এবং `creditsResetDate` (DateTime?) যোগ
- `[x]` `schema.prisma` — নতুন `CreditTransaction` model তৈরি
- `[ ]` `prisma migrate` চালানো — **ম্যানুয়ালি করতে হবে**

## TASK 2 & 3 — Credit Config
- `[x]` `lib/ai/chat-models.ts` — `tier` field যোগ করা প্রতিটি model-এ
- `[x]` `lib/domain/credit-config.ts` — নতুন file তৈরি (MODEL_TIERS, CREDIT_COSTS, PLAN_CREDITS, helpers)

## TASK 4 — API Endpoints
- `[x]` `app/api/credits/check-and-deduct/route.ts` — নতুন endpoint তৈরি
- `[x]` `app/api/chatbots/[chatbotId]/chat/route.ts` — credit check দিয়ে replace (×2 multiplier)
- `[x]` `app/api/chatbots/[chatbotId]/enhance-prompt/route.ts` — credit check update (30 credits)
- `[x]` `app/api/chatbots/[chatbotId]/compare/route.ts` — credit check update (sum of both tiers)
- `[x]` `app/api/usage/route.ts` — credit fields return করা + billingCycleStart calculate from creditsResetDate
- `[x]` `app/api/cron/reset-credits/route.ts` — monthly reset cron

## TASK 5 — Frontend
- `[x]` Sidebar credit widget — credit balance + progress bar সহ সম্পন্ন
- `[x]` Usage Dashboard — stat-cards, quota-progress credits-এ update করা
- `[x]` Settings/CurrentPlan — credit usage progress করা
- `[x]` Referrals — bonus credits terminology update

## TASK 6 — n8n JSON Update
- `[x]` `Web Integration` — Fetch Bot Config query update (includedCredits/creditsUsedThisCycle)
- `[x]` `Web Integration` — Sync Next.js Database query update (credit deduction + CreditTransaction log)
- `[x]` `Facebook Integration` — Fetch Bot Config query update
- `[x]` `Facebook Integration` — Extract Fields code node update (creditCost calculation)
- `[x]` `Facebook Integration` — Sync Next.js Database query update (credit deduction + log)

## Reference Updates (existing field renames)
- `[x]` `lib/domain/plan-config.ts` — `includedMessages` → `includedCredits`
- `[x]` Settings/CurrentPlan components update
- `[x]` Usage quota-progress component update
- `[x]` Translation files (en + bn) — messages → credits terminology

## Pending (Manual Actions Required)
- `[ ]` **Prisma Migration**: `npx prisma migrate dev --name credit-system` চালান
- `[ ]` **n8n Manual Update**: Other n8n workflows (Source file upload, Instagram) এ ম্যানুয়ালি `includedMessages` → `creditsBalance` check করুন
- `[ ]` **Data Migration**: Existing users-দের `creditsBalance` ও `includedCredits` আপডেট করতে একটি one-time SQL query চালান
