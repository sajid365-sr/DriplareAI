# 🎯 Task 04 — Smart Follow-up & Lead Engine
> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 7 rules apply to every item below.
> **Priority:** 🟠 MEDIUM
> **Pending Features from Analysis:** #28, #29, #30, #31, #32

---

## Scope Summary

Upgrade the Leads system from a static list into a full smart follow-up engine: AI-optimized timing, call-scheduling from chat, call result logging, lost-sale analytics, and re-engagement automation for repeat non-buyers.

---

## Feature #28 — Smart Follow-up Engine (AI Optimal Timing)

**VideoScript:** *"সে নিজেই ঠিক করে কাকে কখন কী বললে ভালো হয় আর এটাও জানে কখন আর কিছু মনে করানো উচিত না।"*

### What to Build
The AI follow-up engine analyzes each lead's conversation history, last interaction time, and behavior signals to determine the optimal time and message type for a follow-up. It also knows when NOT to follow up (e.g., after a purchase, or too many unanswered messages).

### Files to Create/Modify
- `lib/ai/followup-optimizer.ts` — AI scoring: analyze lead → suggest timing + message
- `app/api/automations/followup-optimize/route.ts` — POST: run optimizer for a lead
- `app/(dashboard)/dashboard/leads/page.tsx` — Check if monolithic → refactor if needed
- `app/(dashboard)/dashboard/leads/_components/LeadCard.tsx` — Show AI-suggested follow-up time
- `app/(dashboard)/dashboard/leads/_components/SmartFollowupBadge.tsx` — Timing indicator
- `public/locales/en/leads.json` — New namespace
- `public/locales/bn/leads.json` — Bengali

> [!IMPORTANT]
> The current `/dashboard/leads/page.tsx` is a single-file page. Before making changes, **check if it is monolithic** (Rule 4). If it has no `_components/` folder, refactor first.

### Key Logic
- "Do not follow up" signals: `leadStatus === 'won'`, 3+ unanswered follow-ups, customer explicitly said "not interested"
- Optimal time: analyze when the customer historically responds (morning / evening patterns from message timestamps)

### Completion Checklist
- [ ] Page: Refactor leads page if monolithic (Rule 4)
- [ ] Service: Follow-up optimizer AI logic
- [ ] API: Optimizer route
- [ ] UI: Smart timing badge on lead cards
- [ ] i18n: en + bn (new namespace `leads.json`)
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #29 — Lead Call Scheduling (Time-based Reminder)

**VideoScript:** *"Customer বললেন, শুক্রবার বিকেল পাঁচটায় কল দিন। ঠিক সেই সময়টাই lead উঠে যায়।"*

### What to Build
When a customer specifies a callback time in chat, the AI extracts the date/time and creates a scheduled lead reminder. At the scheduled time, the lead card moves to the top of the list with a notification for the team.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `callScheduledAt DateTime?`, `callScheduledNote String?` to `Lead` model (or `ChatSession` if Lead is derived)
- `app/api/leads/[id]/schedule-call/route.ts` — PATCH: set scheduled time
- n8n: Detect "call me at [time]" intent → extract datetime → call schedule-call API
- `app/(dashboard)/dashboard/leads/_components/ScheduledCallBadge.tsx` — Countdown timer badge
- `app/(dashboard)/dashboard/leads/_components/ScheduleCallModal.tsx` — Manual schedule picker
- `public/locales/en/leads.json` — Call scheduling keys
- `public/locales/bn/leads.json` — Bengali

### Completion Checklist
- [ ] Schema: `callScheduledAt` field
- [ ] API: Schedule call route
- [ ] n8n: Datetime extraction from chat intent
- [ ] UI: Scheduled badge + countdown
- [ ] UI: Manual schedule modal
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #30 — Call Result Logging

**VideoScript:** *"আপনার টিম কল দিয়ে এক ট্যাপে ফলাফলটা লিখে রাখে।"*

### What to Build
After a team member calls a lead, they can log the call result with a single tap from the lead page: select an outcome + optional note. This updates the lead status and records call history.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `CallLog` model: `leadId`, `outcome`, `note`, `calledBy`, `calledAt`
- `app/api/leads/[id]/log-call/route.ts` — POST: create call log entry
- `app/(dashboard)/dashboard/leads/_components/CallResultModal.tsx` — Quick outcome selector
- `app/(dashboard)/dashboard/leads/_components/CallHistoryTimeline.tsx` — Past call log
- `public/locales/en/leads.json` — Call log keys
- `public/locales/bn/leads.json` — Bengali

### Call Outcome Options
- ✅ Interested — will buy
- 🕐 Call back later
- ❌ Not interested
- 📵 No answer
- 🚫 Wrong number

### Completion Checklist
- [ ] Schema: `CallLog` model
- [ ] API: Log call route
- [ ] UI: CallResultModal + CallHistoryTimeline
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #31 — Lost Sale Reason Analytics

**VideoScript:** *"আপনি দেখতে পান কোন কারণে sale হারাচ্ছেন।"*

### What to Build
A "Lost Sales" analytics section that aggregates why leads were marked as "not interested" or "lost", showing which reasons are most common and which product types have the highest drop-off.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `lostReason String?`, `lostAt DateTime?` to `Lead`
- `app/api/leads/analytics/lost-reasons/route.ts` — GET: aggregated lost reason data
- `app/(dashboard)/dashboard/leads/_components/LostSalesChart.tsx` — Bar/donut chart
- `app/(dashboard)/dashboard/leads/_components/LostReasonPicker.tsx` — Reason selector when marking lost
- `public/locales/en/leads.json` — Lost reasons keys
- `public/locales/bn/leads.json` — Bengali

### Lost Reason Categories
- Price too high
- Product not available
- Competitor
- Not ready to buy
- No response
- Other

### Completion Checklist
- [ ] Schema: `lostReason` + `lostAt` fields
- [ ] API: Lost reason analytics route
- [ ] UI: LostSalesChart + LostReasonPicker
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #32 — Re-engagement AI for Repeat Non-buyers

**VideoScript:** *"কেউ বারবার আগ্রহ দেখিয়েও কিনছেন না? Agent তাকে product details আর একটা offer পাঠিয়ে convert করার চেষ্টা করে।"*

### What to Build
A re-engagement automation that identifies leads who have shown interest (browsed products, asked prices) 2+ times but never placed an order. The AI sends them a personalized message with product details and a special offer.

### Files to Create/Modify
- `lib/ai/reengagement-engine.ts` — Logic to identify repeat-interest non-buyers
- `app/api/cron/reengagement/route.ts` — Cron job: find candidates → trigger AI message
- `app/(dashboard)/dashboard/automations/_components/ReengagementRuleCard.tsx` — Config UI
- `public/locales/en/automations.json` — Re-engagement keys
- `public/locales/bn/automations.json` — Bengali

### Trigger Conditions
- Lead has visited/inquired 2+ times with no order
- Last interaction was 3–7 days ago
- Lead status is not `won` or `lost`

### Completion Checklist
- [ ] Service: Re-engagement candidate detection
- [ ] Cron: Re-engagement job
- [ ] UI: Rule configuration card
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

*Task file: `task-04-followup-leads.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`*

