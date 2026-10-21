# 📁 Task 01 — Inbox & Conversation UX
> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 7 rules apply to every item below.
> **Priority:** 🔵 HIGH
> **Pending Features from Analysis:** #1, #2, #3, #4, #5, #6, #7, #8, #9

---

## Scope Summary

Improve the Live Inbox (`/dashboard/inbox`) with 9 missing features that make conversations smarter, faster, and more human-friendly — from snooze to AI moderation assistance.

---

## Feature #1 — Chat Snooze / Reminder

**VideoScript:** *"বলে দিন কখন দেখবেন। ঠিক সেই সময়ে chatটা সামনে চলে আসে আপনাকে মনে করিয়ে দিয়ে।"*

### What to Build
A snooze button on each conversation that lets the agent set a future date/time. At that time, the chat automatically surfaces to the top of the inbox with a visual reminder badge.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `snoozeUntil DateTime?` to `ChatSession` model
- `app/api/chatbots/[chatbotId]/sessions/[sessionId]/snooze/route.ts` — PATCH endpoint
- `app/(dashboard)/dashboard/inbox/_components/SnoozeModal.tsx` — Date/time picker modal
- `app/(dashboard)/dashboard/inbox/_components/SnoozeBadge.tsx` — Countdown badge on session card
- `app/(dashboard)/dashboard/inbox/_components/useInboxState.ts` — Add snooze filter logic
- `public/locales/en/live-inbox.json` — Add snooze translation keys
- `public/locales/bn/live-inbox.json` — Add Bengali translations

### Key Logic
- Snoozed chats move to a "Snoozed" filter tab
- When `snoozeUntil` time passes, the session moves back to the active/all tab
- Show a `⏰` badge + remaining time on snoozed session cards
- Client polls or uses SSE to re-surface snoozed chats

### Completion Checklist
- [ ] Schema: `snoozeUntil` field added and migrated
- [ ] API: PATCH snooze/unsnooze route
- [ ] UI: Snooze modal with date-time picker
- [ ] UI: Snoozed tab filter + SnoozeBadge component
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #2 — Seen → Typing → Reply Delay Config

**VideoScript:** *"আগে seen, তারপর typing, তারপর উত্তর। ঠিক যেমন একজন মানুষ দেয়।"*

### What to Build
A configuration UI in the chatbot settings that lets the merchant set custom delay values for:
- Seen receipt delay (ms)
- Typing indicator duration (ms, per word/character)
- Reply send delay (ms)

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `humanDelayConfig Json?` to `Chatbot` model
- `app/api/chatbots/[chatbotId]/settings/route.ts` — Add delay fields to PATCH
- `app/(dashboard)/dashboard/chatbots/[chatbotId]/setup/_components/HumanDelaySettings.tsx` — New settings panel
- `public/locales/en/chatbots.json` — Add delay config keys
- `public/locales/bn/chatbots.json` — Bengali translations

### Completion Checklist
- [ ] Schema: `humanDelayConfig` added
- [ ] API: Settings PATCH updated
- [ ] UI: Delay configuration sliders/inputs
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #3 — Full-text Chat Message Search

**VideoScript:** *"নাম, ফোন নম্বর, order নম্বর এমনকি chat's ভেতরের যেকোনো একটা কথা লিখুন। পেয়ে যাবেন।"*

### What to Build
Extend the inbox search to search through message **content** (not just session titles). Results should highlight the matching message snippet.

### Files to Create/Modify
- `app/api/chatbots/[chatbotId]/sessions/search/route.ts` — Full-text search API using Postgres `ILIKE` or `tsvector`
- `app/(dashboard)/dashboard/inbox/_components/session-list.tsx` — Update to show message snippet in results
- `app/(dashboard)/dashboard/inbox/_components/MessageSearchResult.tsx` — New result item with snippet highlight
- `public/locales/en/live-inbox.json` — Search result keys
- `public/locales/bn/live-inbox.json` — Bengali

### Completion Checklist
- [ ] API: Full-text search route implemented
- [ ] UI: Search results show message content snippet
- [ ] UI: Highlighted matching text
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #4 — Chat Assignment to Team Member + Notification

**VideoScript:** *"chatটা তাকে assign করে দিন। তিনি notification পান আর সেই customer দায়িত্ব তখন তারই।"*

### What to Build
A UI to assign a conversation to a specific workspace member. The assigned member receives an in-app notification.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — `assignedToUserId` already exists; verify `assignedAt DateTime?` also added
- `app/api/chatbots/[chatbotId]/sessions/[sessionId]/assign/route.ts` — PATCH assign route
- `app/api/notifications/route.ts` — Extend to send assignment notification
- `app/(dashboard)/dashboard/inbox/_components/AssignAgentModal.tsx` — Team member picker modal
- `app/(dashboard)/dashboard/inbox/_components/conversation-panel.tsx` — Wire up assign button (already has UI label)
- `public/locales/en/live-inbox.json` — Assignment keys
- `public/locales/bn/live-inbox.json` — Bengali

### Completion Checklist
- [ ] Schema: `assignedAt` field verified/added
- [ ] API: Assign route + notification trigger
- [ ] UI: AssignAgentModal with workspace member list
- [ ] UI: Assigned badge shown on session card
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #5 — Team Member Management UI

**VideoScript:** *"Team member যোগ করুন যতজন খুশি। কোনো সীমা নেই।"*

### What to Build
A workspace team management page under Settings where the owner can invite, view, and remove team members.

### Files to Create/Modify
- `app/(dashboard)/dashboard/settings/team/page.tsx` — New page
- `app/(dashboard)/dashboard/settings/team/_components/TeamMemberList.tsx`
- `app/(dashboard)/dashboard/settings/team/_components/InviteMemberModal.tsx`
- `app/(dashboard)/dashboard/settings/team/_components/MemberRoleBadge.tsx`
- `app/api/workspaces/[workspaceId]/members/route.ts` — GET/POST/DELETE
- `public/locales/en/settings.json` — Team keys
- `public/locales/bn/settings.json` — Bengali

### Completion Checklist
- [ ] API: Workspace members CRUD
- [ ] UI: Team member list + invite modal
- [ ] UI: Role badges (Owner, Member, etc.)
- [ ] Settings sidebar link added
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #6 — AI Moderator Assistant Panel

**VideoScript:** *"পুরো কথোপকথনের সারাংশ দেয়। কথোপকথন নিয়ে যেকোনো প্রশ্ন করুন, উত্তর দেয়। আর এখন customerকে কী পাঠালে সবচেয়ে ভালো হয়... এক ক্লিকে পাঠিয়ে দিন।"*

### What to Build
An interactive AI assistant panel inside the CRM right panel that:
1. Generates a full conversation summary (not just last 4 messages)
2. Accepts a free-form question about the conversation and answers it
3. Suggests the next best reply → one-click send to the `HumanInputBar`

### Files to Create/Modify
- `app/(dashboard)/dashboard/inbox/_components/AiModeratorPanel.tsx` — New panel component
- `app/api/inbox/ai-assist/route.ts` — POST: generate summary / answer question / suggest reply
- `app/(dashboard)/dashboard/inbox/_components/crm-panel.tsx` — Replace basic `aiSummary` with `AiModeratorPanel`
- `public/locales/en/live-inbox.json` — AI assistant keys
- `public/locales/bn/live-inbox.json` — Bengali

### Completion Checklist
- [ ] API: AI assist route (summary / Q&A / reply suggestion)
- [ ] UI: AiModeratorPanel with 3 modes
- [ ] UI: One-click reply → pre-fill HumanInputBar
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #7 — Voice Message Handling in AI

**VideoScript:** *"Customer নিজের ভাষায় লিখুক বা voice বলুক কী চান। Agent বুঝে নেয়।"*

### What to Build
When the AI receives a voice message attachment, it transcribes the audio (using a speech-to-text API) and processes the transcription as a text message to find products/answer queries.

### Files to Create/Modify
- `app/api/chatbots/[chatbotId]/transcribe/route.ts` — POST: audio URL → transcription
- `lib/ai/transcription.ts` — Transcription service wrapper (Gemini Audio or Whisper)
- n8n workflow: Add voice message node before AI processing
- `public/locales/en/chatbots.json` — Transcription-related keys
- `public/locales/bn/chatbots.json` — Bengali

### Completion Checklist
- [ ] API: Transcription route
- [ ] Service: Transcription wrapper
- [ ] n8n: Voice branch added to AI workflow
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #8 — Quoted/Reply-to Message Context Handling

**VideoScript:** *"আগের কোনো message টেনে এনে reply দিলেন? সেটা ছবি হোক, voice হোক বা লেখা, agent ঠিক বোঝে কোনটার কথা হচ্ছে।"*

### What to Build
When a customer replies to a specific message (quoted reply), the AI receives the quoted context alongside the new message so it can answer accurately.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `replyToMessageId String?` to `ChatMessage`
- Webhook handlers (`app/api/webhooks/facebook`, `whatsapp`, `instagram`) — Extract `reply_to` context
- n8n: Pass quoted context in AI prompt payload
- `app/(dashboard)/dashboard/inbox/_components/message-bubble.tsx` — Show quoted message preview UI
- `public/locales/en/live-inbox.json` — Reply-to UI keys
- `public/locales/bn/live-inbox.json` — Bengali

### Completion Checklist
- [ ] Schema: `replyToMessageId` added
- [ ] Webhooks: Extract reply context from all 3 platforms
- [ ] n8n: Quoted context in AI prompt
- [ ] UI: Quoted message preview bubble
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #9 — Chrome Extension (Meta Business Suite)

**VideoScript:** *"আমাদের Chrome extension দিয়ে Business Suite থেকেই সব সামলানো যায়। চ্যাট হাতে নেওয়া, ফিরিয়ে দেওয়া, AI সহকারী সব সেখানেই।"*

> [!NOTE]
> This is a **separate browser extension project**, not a Next.js page. It requires a dedicated Chrome Extension repository. Plan separately.

### What to Build (Separate Repo)
- Chrome Extension manifest v3
- Content script that injects a floating sidebar into `business.facebook.com`
- Sidebar UI: AI toggle, AI moderator assistant, assign agent
- Auth: communicate with DriplareAI API using user's session token

### Completion Checklist
- [ ] Separate extension repository created
- [ ] Manifest v3 setup
- [ ] Content script + sidebar injected
- [ ] API integration (AI toggle, assignment)
- [ ] Published to Chrome Web Store (or internal distribution)
- [ ] Committed to `feature-update` (architecture doc at minimum)

---

*Task file: `task-01-inbox-ux.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`*

