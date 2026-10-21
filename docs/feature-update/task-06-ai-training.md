# 🧠 Task 06 — AI Training & Feedback
> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 7 rules apply to every item below.
> **Priority:** 🟣 MEDIUM
> **Pending Features from Analysis:** #34, #35, #36, #37

---

## Scope Summary

Make the AI self-improving and merchant-controllable: conversational retraining with preview, an unanswered questions tracker, prompt version rollback, and an in-app feature request system with status tracking.

---

## Feature #34 — Conversational AI Training (Natural Language Retraining)

**VideoScript:** *"কোনো উত্তর পছন্দ হলো না? সাধারণ ভাষায় বলে দিন, এটা এভাবে বদলাও। Agent বদলায়, নিজেই test করে। ঠিক customer ফোনে যেমন দেখাবে, ফলাফলটা দেখায়। আপনি হ্যাঁ বললে তবেই update।"*

### What to Build
A natural language training interface where the merchant types an instruction (e.g., "Always mention our return policy after answering price questions"), the AI generates a new system prompt change, shows a live preview of how the response would look, and only applies it after merchant approval.

### Files to Create/Modify
- `app/api/chatbots/[chatbotId]/train/route.ts` — POST: instruction → new prompt draft + preview
- `lib/ai/prompt-trainer.ts` — Instruction → prompt modification logic
- `app/(dashboard)/dashboard/chatbots/[chatbotId]/setup/_components/ConversationalTrainer.tsx` — Training UI
  - Text input for natural language instruction
  - Preview panel (simulated customer message → new response)
  - Approve / Discard buttons
- `public/locales/en/chatbots.json` — Training UI keys
- `public/locales/bn/chatbots.json` — Bengali

### Key Flow
```
Merchant types: "When asked about delivery time, always say 3-5 working days"
  → AI modifies systemPrompt draft
  → Runs test: "When will my order arrive?" → shows new response
  → Merchant clicks Approve → draft becomes live prompt
  → Merchant clicks Discard → no changes
```

### Completion Checklist
- [ ] API: Training route (instruction → draft + preview)
- [ ] Service: Prompt modification logic
- [ ] UI: ConversationalTrainer component (input → preview → approve/discard)
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #35 — Unanswered Questions List

**VideoScript:** *"customer কোন প্রশ্নগুলোর উত্তর agent দিতে পারেনি তারও একটা তালিকা থাকে। কোনটা কতবার এসেছে সেটা সহ। পাশেই button, উত্তরটা শিখিয়ে দিন।"*

### What to Build
Track questions where the AI failed (gave a fallback/uncertain response, or was explicitly flagged). Display them in a ranked list by frequency with a quick-teach button that opens the FAQ editor pre-filled with the question.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `UnansweredQuestion` model
- `app/api/chatbots/[chatbotId]/unanswered/route.ts` — GET (list) + POST (log new unanswered)
- `lib/ai/fallback-detector.ts` — Logic to detect AI fallback responses in n8n workflow
- n8n: On AI fallback → POST to `/unanswered` API with message content
- `app/(dashboard)/dashboard/knowledge-base/_components/UnansweredQuestionsList.tsx` — New section
- `app/(dashboard)/dashboard/knowledge-base/_components/QuickTeachButton.tsx` — Opens FAQ modal pre-filled
- `public/locales/en/knowledge-base.json` — Unanswered keys
- `public/locales/bn/knowledge-base.json` — Bengali

### Schema
```prisma
model UnansweredQuestion {
  id         String   @id @default(cuid())
  chatbotId  String
  question   String
  count      Int      @default(1)  // how many times this came up
  lastSeenAt DateTime @default(now())
  resolved   Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([chatbotId, resolved])
  @@schema("chatbot")
}
```

### UI Design
```
| Question                          | Asked | Action          |
|-----------------------------------|-------|-----------------|
| What are your delivery charges?   |  12x  | [Teach Answer]  |
| Do you have COD?                  |   8x  | [Teach Answer]  |
| How long does delivery take?      |   5x  | [Teach Answer]  |
```

### Completion Checklist
- [ ] Schema: `UnansweredQuestion` model
- [ ] API: Unanswered questions CRUD
- [ ] n8n: Fallback detection → log route call
- [ ] UI: UnansweredQuestionsList in Knowledge Base page
- [ ] UI: QuickTeachButton → pre-fill FAQ modal
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #36 — One-click Prompt Rollback (Version History)

**VideoScript:** *"পছন্দ না হলে এক ক্লিকে আগের অবস্থায়।"*

### What to Build
Every time the system prompt is updated, save the previous version. Show a version history list with a "Restore" button to roll back to any previous version instantly.

### Files to Create/Modify
- `prisma/schema/merchant.prisma` — Add `PromptVersion` model
- `app/api/chatbots/[chatbotId]/prompt-versions/route.ts` — GET versions + POST restore
- `app/(dashboard)/dashboard/chatbots/[chatbotId]/setup/_components/PromptVersionHistory.tsx` — Version list UI
- `app/(dashboard)/dashboard/chatbots/[chatbotId]/setup/_components/RestoreVersionModal.tsx` — Confirm restore dialog
- `public/locales/en/chatbots.json` — Version history keys
- `public/locales/bn/chatbots.json` — Bengali

### Schema
```prisma
model PromptVersion {
  id           String   @id @default(cuid())
  chatbotId    String
  versionNumber Int
  systemPrompt String   @db.Text
  rawPrompt    String?  @db.Text
  compiledPrompt String? @db.Text
  changedBy    String   // userId
  changeNote   String?  // optional: what was changed
  createdAt    DateTime @default(now())

  @@index([chatbotId])
  @@schema("chatbot")
}
```

### UI Design
```
Version History
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
v5  (Current)  Oct 21 · "Added return policy instruction"
v4             Oct 19 · "Updated greeting tone"        [Restore]
v3             Oct 17 · "Product price format fix"     [Restore]
v2             Oct 15 · "Initial setup"                [Restore]
```

### Completion Checklist
- [ ] Schema: `PromptVersion` model + auto-save on prompt update
- [ ] API: Get versions + restore route
- [ ] UI: PromptVersionHistory panel
- [ ] UI: RestoreVersionModal confirm dialog
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #37 — In-app Feature Request System

**VideoScript:** *"নতুন কোনো feature দরকার মনে হলে app ভেতর থেকেই বলুন। লিখে কিংবা মুখে বলে। আমরা সেটা নিয়ে কী করলাম সেটাও সেখানেই দেখতে পাবেন।"*

### What to Build
An in-app feature request panel (accessible from the sidebar or settings) where merchants can submit feature requests by text, see all their past requests, and see the status of each request (Received → Under Review → In Development → Shipped → Declined).

### Files to Create/Modify
- `prisma/schema/admin.prisma` — Add `FeatureRequest` model (admin-visible)
- `app/api/feedback/feature-request/route.ts` — POST submit + GET list
- `app/(dashboard)/dashboard/settings/_components/FeatureRequestPanel.tsx` — New panel
- `app/(dashboard)/dashboard/settings/_components/FeatureRequestCard.tsx` — Individual request with status
- `app/(admin)/admin/feedback/page.tsx` — Admin view to manage and update request statuses
- `public/locales/en/settings.json` — Feature request keys
- `public/locales/bn/settings.json` — Bengali

### Status Pipeline
```
Received → Under Review → In Development → Shipped ✅
                       ↘ Declined ❌
```

### Schema
```prisma
model FeatureRequest {
  id          String   @id @default(cuid())
  userId      String
  workspaceId String?
  title       String
  description String   @db.Text
  status      String   @default("received") // received | reviewing | in_dev | shipped | declined
  adminNote   String?  // response from the team
  upvotes     Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@schema("admin")
}
```

> [!NOTE]
> Voice input (`lিখে কিংবা মুখে বলে`) can be implemented using the Web Speech API in the browser. Add a microphone button to the submission form that transcribes voice to text before submission.

### Completion Checklist
- [ ] Schema: `FeatureRequest` model
- [ ] API: Submit + list routes (merchant + admin)
- [ ] UI: FeatureRequestPanel in settings
- [ ] UI: Status badges + admin note display
- [ ] Admin: Manage requests page
- [ ] Voice input: Microphone button (Web Speech API)
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

*Task file: `task-06-ai-training.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`*

