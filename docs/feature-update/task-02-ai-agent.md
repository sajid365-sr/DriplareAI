# 🤖 Task 02 — AI Agent Capabilities

> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 8 rules apply to every item below.
> **Priority:** 🟢 HIGH
> **Completed Features:** #10 🟦, #11 🟦, #12 🟦, #13 🟦, #14 🟦, #15 🟦, #16 🟦, #17 🟦, #18 🟦 (ALL COMPLETED)
> **Pending Features from Analysis:** None

---

## Scope Summary

Upgrade the AI agent's core intelligence: image recognition for product matching, native product checkout page, cross-platform identity, smart comment management, spam blocking, message batching, and a safe practice mode.

---

## 🟦 Feature #10 — Advanced Image Recognition (Product Matching)

**VideoScript:** _"ছবিটা যেভাবেই তোলা হোক, দেখতে আপনার কোন product মতো। পুরো catalog সাথে মিলিয়ে ঠিক সেই পণ্যটা customerকে পাঠায়।"_

### What to Build

When a customer sends a photo, the AI uses vision capabilities to identify what the image looks like and searches the merchant's product catalog for visually similar items. Returns product cards of the closest matches.

### Files to Create/Modify

- `app/api/chatbots/[chatbotId]/image-search/route.ts` — POST: image URL → similar products
- `lib/ai/image-product-match.ts` — Vision model call (Gemini Vision / GPT-4V) → extract description → vector search against product embeddings
- n8n: Add image-type branch in message handler → call image-search API → return product cards
- `public/locales/en/chatbots.json` — Image search keys
- `public/locales/bn/chatbots.json` — Bengali

### Key Logic

1. Receive image URL from webhook
2. Call vision model: "Describe this product in detail"
3. Embed the description
4. Vector similarity search against `Chunk` table (product embeddings)
5. Return top 3–5 product matches as product card carousel

### Completion Checklist

- [x] API: Image search route
- [x] Service: Vision → description → vector search pipeline
- [x] n8n: Image branch wired
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #11 — Native Product Page (Chat-native Checkout)

**VideoScript:** _"Buy Now tap করলেই order form সামনে। আরেক tap order confirm। Confirmation আর bill নিজেই chat চলে আসে। আর এর জন্য আপনার কোনো website লাগে না।"_

### What to Build

A standalone, shareable product detail page (no separate website needed) that is sent inside chat as a link. The page shows full product info, lets the customer fill in their order details, and on submit — sends the order confirmation + bill back to the chat automatically.

### Files to Create/Modify

- `app/p/[productId]/page.tsx` — Public product page (new route group)
- `app/p/[productId]/_components/ProductHero.tsx` — Images, name, price, stock
- `app/p/[productId]/_components/VariantSelector.tsx` — Size/color buttons
- `app/p/[productId]/_components/OrderForm.tsx` — Name, phone, address fields
- `app/p/[productId]/_components/OrderConfirmation.tsx` — Success state
- `app/api/p/[productId]/order/route.ts` — POST: create order + send bill to chat
- `public/locales/en/product-page.json` — New namespace
- `public/locales/bn/product-page.json` — Bengali

### Key Logic

- Product page URL: `https://driplare.ai/p/{productId}?session={sessionId}&channel=messenger`
- On order submit → create Order in DB → call platform API to send bill to chat session
- No login required for customer

### Completion Checklist

- [x] New route group `app/p/` created
- [x] Product page components (modular)
- [x] Order submission + chat notification
- [x] i18n: en + bn (new namespace)
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #12 — Quick-reply Buttons (General)

**VideoScript:** _"Optionগুলো নিজে থেকেই button হয়ে যায়। Customer শুধু tap করে।"_

### What to Build

When the AI response contains a list of options (sizes, colors, yes/no choices), these automatically render as tappable quick-reply buttons in the chat rather than plain text.

### Files to Create/Modify

- n8n: AI response parser → detect `[BUTTONS: option1, option2, ...]` syntax → send as platform quick-replies (Facebook buttons / WhatsApp list)
- `app/(dashboard)/dashboard/inbox/_components/message-bubble.tsx` — Render quick-reply button UI for history view
- `public/locales/en/live-inbox.json` — Button display keys
- `public/locales/bn/live-inbox.json` — Bengali

### Key Logic

- AI wraps options in a special marker: `[BUTTONS: Small, Medium, Large, XL]`
- n8n parser extracts buttons and sends as platform-native interactive messages
- Fallback to plain text list if platform doesn't support buttons

### Completion Checklist

- [x] n8n: Button syntax parser + platform send
- [x] UI: Quick-reply bubbles in inbox history view
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #13 — Cross-platform Customer Identity Linking

**VideoScript:** _"Customer যেখানেই যান, agent তাকে চেনে। আজ inbox কথা হলো। কাল একটা post comment করলেন। মাঝে আপনার আরেকটা post reaction দিলেন। তারপর আবার inbox এলেন। Agent সবটা জুড়ে নিয়ে কথা বলে।"_

### What to Build

A customer identity system that links a single real person across multiple platforms (Facebook, Instagram, WhatsApp, Web) using phone number, name, or Meta PSID linkage.

### Files to Create/Modify

- `prisma/schema/merchant.prisma` — New `CustomerProfile` model with linked session IDs and identifiers
- `app/api/crm/customers/route.ts` — Extend with identity linking logic
- `app/api/crm/link-identity/route.ts` — POST: manually link two sessions
- `app/(dashboard)/dashboard/inbox/_components/crm-panel.tsx` — Show linked sessions from other platforms
- `app/(dashboard)/dashboard/inbox/_components/LinkedSessionsPanel.tsx` — New section
- `public/locales/en/live-inbox.json` — Identity keys
- `public/locales/bn/live-inbox.json` — Bengali

### Schema Design

```prisma
model CustomerProfile {
  id           String   @id @default(cuid())
  workspaceId  String
  phone        String?
  name         String?
  sessions     String[] // array of sessionIds across platforms
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Completion Checklist

- [x] Schema: `CustomerProfile` model added
- [x] API: Identity linking route
- [x] UI: Linked sessions panel in CRM
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #14 — Comment Auto-DM + Product-aware Comment Reply

**VideoScript:** _"এক ছবির post কেউ comment করলে agent সেই product ধরেই comment উত্তর দেয়। সাথে inbox message পাঠায়।"_

### What to Build

A configuration page where merchants can set up post-level comment automation: which posts have which product(s) associated, and what message to auto-DM when someone comments.

### Files to Create/Modify

- `prisma/schema/automation.prisma` — Add `CommentAutomation` model
- `app/(dashboard)/dashboard/automations/_components/comment-automation/CommentAutomationCard.tsx`
- `app/(dashboard)/dashboard/automations/_components/comment-automation/PostProductLinker.tsx`
- `app/api/automations/comment/route.ts` — CRUD
- `public/locales/en/automations.json` — Comment automation keys
- `public/locales/bn/automations.json` — Bengali

### Completion Checklist

- [x] Schema: `CommentAutomation` model
- [x] API: Comment automation CRUD
- [x] UI: Post-product linker + comment rule cards
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #15 — Comment Re-engagement (No DM reply follow-up)

**VideoScript:** _"comment করে কেউ inbox সাড়া না দিলে? কিছু সময় পরে সেই comment আরেকবার মনে করিয়ে দেয়, আগ্রহটা চলে যাবার আগেই।"_

### What to Build

If a user commented but did not reply to the auto-DM within N minutes, send a follow-up DM to re-engage them.

### Files to Create/Modify

- `app/api/cron/comment-followup/route.ts` — Cron job to check unanswered comment DMs
- `prisma/schema/automation.prisma` — Add `followUpSentAt DateTime?` to `CommentAutomation` tracking
- `app/(dashboard)/dashboard/automations/_components/comment-automation/FollowUpDelayPicker.tsx`
- `public/locales/en/automations.json` — Follow-up keys
- `public/locales/bn/automations.json` — Bengali

### Completion Checklist

- [x] Schema: Follow-up tracking fields
- [x] Cron: Comment follow-up job
- [x] UI: Delay picker in comment automation settings
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #16 — Per-user AI Permanent Block (Spam Protection)

**VideoScript:** _"একবার দেখে তার জন্য AI বন্ধ করে দিন। তার লেখা message AI এক পয়সাও আর খরচ হয় না।"_

### What to Build

A permanent AI block for specific sessions/users. Unlike the temporary `.` dot toggle, this is a one-time block that persists and prevents any AI credits from being consumed for that user.

### Files to Create/Modify

- `prisma/schema/merchant.prisma` — Add `isAiBlocked Boolean @default(false)` to `ChatSession`
- `app/api/chatbots/[chatbotId]/sessions/[sessionId]/block/route.ts` — PATCH block/unblock
- `app/(dashboard)/dashboard/inbox/_components/conversation-panel.tsx` — Add block button to toolbar
- n8n: Check `isAiBlocked` flag before processing message
- `public/locales/en/live-inbox.json` — Block keys
- `public/locales/bn/live-inbox.json` — Bengali

### Completion Checklist

- [x] Schema: `isAiBlocked` field added
- [x] API: Block/unblock route
- [x] UI: Block button + blocked indicator badge
- [x] n8n: Guard check at workflow entry
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #17 — Multi-message Batching

**VideoScript:** _"Customer একসাথে অনেকগুলো message দিলে সবগুলো পড়ে, বুঝে এক messageই উত্তর দেয়।"_

### What to Build

A message batching system: when a user sends multiple messages within a short window (e.g., 3 seconds), the AI waits and processes all of them together before generating a single response.

### Files to Create/Modify

- n8n: Add a "batch window" wait node before the AI node (collect messages within time window)
- `lib/ai/message-batcher.ts` — Batching utility: group messages by sessionId + time window
- `app/api/webhooks/facebook/route.ts`, `whatsapp`, `instagram` — Forward to batcher before n8n
- `public/locales/en/chatbots.json` — Batching config keys
- `public/locales/bn/chatbots.json` — Bengali

### Completion Checklist

- [x] Batching logic implemented (service layer)
- [x] Webhook handlers updated to use batcher
- [x] n8n: Batch window node configured
- [x] i18n: en + bn keys
- [x] TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #18 — AI Practice Mode

**VideoScript:** _"শুরুতে agent থাকে practice mode। শুধু আপনার test message উত্তর দেয়, আসল customer না। পছন্দ হলে এক ক্লিকে live।"_

### What to Build

A toggle on the chatbot setup page: when enabled, the AI only responds to messages from the workspace owner's own test account — all real customer messages are silently ignored (no AI response, no credit charge). One click switches to "Live" mode.

### Files to Create/Modify

- `prisma/schema/merchant.prisma` — Add `mode String @default("live")` to `Chatbot` (`"practice"` | `"live"`)
- `app/api/chatbots/[chatbotId]/mode/route.ts` — PATCH practice/live toggle
- `app/(dashboard)/dashboard/chatbots/[chatbotId]/setup/_components/PracticeModeToggle.tsx` — Toggle with explanation
- n8n: Check `mode === "practice"` → only respond to owner's test PSID
- `public/locales/en/chatbots.json` — Practice mode keys
- `public/locales/bn/chatbots.json` — Bengali

### Completion Checklist

- [x] Schema: `mode` field added
- [x] API: Mode toggle route
- [x] UI: Practice mode toggle card with visual indicator
- [x] n8n: Practice mode guard
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

_Task file: `task-02-ai-agent.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`_
