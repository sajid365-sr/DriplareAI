# Auto-Train Engine — live social auto-training with AI parsing

## Context

The **Auto-Train Engine** tab ([components/knowledge-base/AutoTrainSection.tsx](components/knowledge-base/AutoTrainSection.tsx))
is currently a disabled "Coming soon" placeholder — a single card with a dead button. It does nothing.

The goal (per the RepliBee reference screens the user shared) is a real 3-step wizard:
1. **Pick connected profiles** — show the user's connected platforms (Facebook / WhatsApp / Instagram),
   let them select which to learn from and **manually choose how many chats** to pull per profile.
2. **Auto-train** — clicking the button shows an animated progress bar + percentage while the backend
   fetches the chats, sends them to an AI model via **OpenRouter**, and the AI parses them.
3. **Review & edit** — the AI's drafts come back grouped into **FAQs / Sample Replies / Content Training**;
   each item has a checkbox (kept by default) + inline Edit. Nothing is saved until the user approves;
   approved items are persisted (with RAG embeddings) via the Part-2 pipeline.

### Confirmed decisions (asked the user)
- **Chat source = live fetch from the connected platform.** Facebook has a live Graph API
  (`fetchFacebookConversations` + `fetchFacebookConversationMessages`, already used by the
  `sources/fb-conversations/ingest` route). WhatsApp & Instagram have **no history API** — their
  messages only arrive via webhooks and live in `ChatSession`+`ChatMessage`, so for those two we read
  the stored rows "received since you connected" (this exact caveat is shown on the reference screen).
- **Draft types = FAQs + Sample Replies + Content Training** (the three that already have persistence +
  RAG endpoints from Part 2). Products/Quick-replies/Tag-replies are out of scope.
- **Credits = flat 50 per run** (any number of profiles), balance-checked and logged, matching the reference.

### Verified architecture that shapes the approach
- Connected profiles are already returned by `GET /api/chatbots/[chatbotId]/integrations`
  ([app/api/chatbots/[chatbotId]/integrations/route.ts](app/api/chatbots/[chatbotId]/integrations/route.ts))
  — each entry has `platform`, `connected`, and a safe `config` (`pageName` / `instagramUsername` /
  `displayPhoneNumber`) we can use as the profile label. **Reuse this endpoint on the client.**
- FB conversation → Q&A extraction pattern already exists in
  [app/api/chatbots/[chatbotId]/sources/fb-conversations/ingest/route.ts](app/api/chatbots/[chatbotId]/sources/fb-conversations/ingest/route.ts)
  (`buildQAPairsFromFB`, `fetchFacebookConversationMessages`). We reuse the fetch helpers and generalize
  the transcript-building.
- `ChatSession` (`platform`, `guestName`, `sessionId`) + `ChatMessage` (`role`, `content`, `sentByHuman`,
  `timestamp`) hold stored WhatsApp/Instagram conversations ([prisma/schema.prisma](prisma/schema.prisma:166-252)).
- OpenRouter chat completions: `openRouter.chat.completions.create()` from
  [lib/ai/embeddings.ts](lib/ai/embeddings.ts); model ids via `getOpenRouterModel` in
  [lib/ai/chat-models.ts](lib/ai/chat-models.ts). The `compare` route is the reference call shape.
- Persistence + RAG embedding of approved drafts reuses Part 2:
  `syncTrainingSource` / `formatFaqContent` / `formatSampleReplyContent`
  ([lib/ai/qa-training.ts](lib/ai/qa-training.ts)) and `createSourceWithEmbeddings`
  ([lib/ai/source-ingestion.ts](lib/ai/source-ingestion.ts)). FK note (from Part 2): companion Sources /
  FAQs / SampleReplies must be keyed to `bot.chatbotId` (business key), not the cuid `id`.
- Credits: `CREDIT_COSTS` + `getCreditCostByModel` in
  [lib/domain/credit-config.ts](lib/domain/credit-config.ts); deduction + `CreditTransaction` log
  pattern is in the `compare` route (`db.$transaction([...])`).

---

## A. AI helper — `lib/ai/auto-train.ts` (new)

Pure logic, no HTTP. Exports:

- `type AutoTrainDrafts = { faqs: {question,answer}[]; sampleReplies: {customerMessage,reply}[]; content: {title,content}[] }`
- `type ConversationTranscript = { platform: string; label: string; text: string }` — one per chat,
  formatted `Customer: … / Owner: …` lines (reuse the FB pair-builder logic, generalized).
- `buildTranscriptsFromChatMessages(sessions, messagesBySession)` → `ConversationTranscript[]`
  (for WhatsApp/Instagram stored rows: `role !== "assistant"` ⇒ Customer, else Owner).
- `async parseConversationsToDrafts(transcripts, opts)`:
  - Joins transcripts into one corpus (cap total chars, e.g. ~40k, to bound tokens/cost).
  - Calls `openRouter.chat.completions.create` with `response_format: { type: "json_object" }`,
    a system prompt instructing: *extract recurring customer questions → FAQs; representative
    owner replies → sample replies (tone); durable business facts → content chunks; dedupe;
    reply in the customers' language; return strict JSON {faqs, sampleReplies, content}.*
  - Model: `google/gemini-2.5-flash` (standard tier, cheap, JSON-capable) via `getOpenRouterModel`.
  - Defensive JSON parse (strip code fences, `try/catch`), clamp array sizes, trim/drop empties.
    Returns `AutoTrainDrafts` (empty arrays on failure, never throws to the route).

## B. Fetch route — `app/api/chatbots/[chatbotId]/auto-train/route.ts` (new, POST)

Body: `{ selections: { platform: string; count: number }[] }` (count = max chats for that profile).

1. `auth()` → 401; `getOwnedChatbot(userId, identifier)` → 404 (resolve `bot.chatbotId`).
2. Validate selections (non-empty, known platforms, clamp `count` to 1..100).
3. **Credit check** — flat `AUTO_TRAIN_FEE = 50`; if `user.creditsBalance < fee` → 402
   `{ code: "INSUFFICIENT_CREDITS", ... }` (same shape the compare route uses).
4. **Gather transcripts per selected platform:**
   - `facebook` / `n8n_facebook`: find the connected integration, read `config.pageId`+`config.pageToken`;
     `fetchFacebookConversations` → take `count` → `fetchFacebookConversationMessages` each →
     generalized pair-builder → transcripts. (If token missing, fall through to stored-message path.)
   - `whatsapp` / `instagram`: `db.chatSession.findMany({ where:{chatbotId, platform}, take:count,
     orderBy:{updatedAt:"desc"} })` → `db.chatMessage.findMany` for those sessionIds →
     `buildTranscriptsFromChatMessages`.
5. If **zero** transcripts gathered → 200 with `{ drafts: {empty}, warning: "no_conversations" }`
   and **do not** charge credits (nothing to train on).
6. `parseConversationsToDrafts(transcripts)` → drafts.
7. **Deduct credits + log** in a `db.$transaction`: decrement `creditsBalance`, increment
   `creditsUsedThisCycle`, create `CreditTransaction { action_type:"auto_train", credits_spent:fee,
   metadata:{ platforms, transcriptCount } }`.
8. Return `{ drafts, meta: { transcriptCount, creditsSpent } }`. All wrapped in try/catch → 500.

> Wall-clock note: a single FB Graph fetch + one OpenRouter call typically completes well within the
> Next.js route budget; total corpus is capped. Progress is animated client-side (see D) — no SSE needed.

## C. Apply route — `app/api/chatbots/[chatbotId]/auto-train/apply/route.ts` (new, POST)

Body: `{ faqs:[{question,answer}], sampleReplies:[{customerMessage,reply}], content:[{title,content}] }`
(only the items the user kept). Auth+ownership as above, keyed to `bot.chatbotId`. For each group,
reuse Part-2 persistence exactly so everything gets RAG-embedded and shows up in the other tabs:
- FAQ → `db.faq.create` then `syncTrainingSource({type:"faq", content: formatFaqContent(...)})`,
  save returned `sourceId` back (same as the faqs POST route).
- Sample reply → `db.sampleReply.create` + `syncTrainingSource({type:"sample_reply", ...})`.
- Content → `createSourceWithEmbeddings({ type:"text", name: title, content })`.
Each item is best-effort (try/catch per item); return `{ added: { faqs, sampleReplies, content } }` counts.
No extra credit charge (embedding of kept items is free, per the reference copy).

## D. Credit config — `lib/domain/credit-config.ts`

Add `auto_train: 50` to `CREDIT_COSTS` (so `action_type` typing + future tweaks live in one place).
Export a small `AUTO_TRAIN_FEE` or read `CREDIT_COSTS.auto_train` in the route.

## E. UI — `components/knowledge-base/`

Rewrite `AutoTrainSection.tsx` into a small state machine with `stage: "picker" | "running" | "review"`,
and add three presentational subcomponents. Keep the existing intro card copy as the picker's header.

- **`AutoTrainSection.tsx`** — orchestrator. Loads profiles from `/api/chatbots/{agentId}/integrations`
  (filter `connected`). Holds selection state (`Set<platform>` + per-platform `count`), the fetched
  `drafts`, and `stage`. Handlers: `startTraining()` (POST /auto-train, drives progress, → review),
  `applyDrafts(selected)` (POST /auto-train/apply → toast + reset to picker).
- **`AutoTrainProfilePicker.tsx`** — reference screen 5: one selectable card per connected profile
  (platform icon + profile label + check), a **chat-count control** per selected profile
  (segmented `10 / 25 / 50 / 100`, default 25 — satisfies "manually select how many chats"), the
  processing-fee row (`50 credits`), credits-available line, and the **"Auto-train N profiles"** button
  (disabled if none selected). Shows the WhatsApp "no message-history API" caveat when WA is selected.
  Empty state when no connected profiles → link/hint to Integrations.
- **`AutoTrainProgress.tsx`** — centered animated Framer-Motion progress bar + big percentage that
  eases 0→~90% through labeled phases ("Fetching conversations…", "Reading with AI…",
  "Drafting suggestions…") while the request is in flight, then snaps to 100% on resolve. (Client-side
  simulated progress — a single AI call can't report真 progress; standard pattern.)
- **`AutoTrainReview.tsx`** — reference output screen: tab pills **FAQs (n) / Sample replies (n) /
  Content (n)** with a per-tab list of checkable cards (checked by default), inline **Edit** (toggles the
  card into the same textarea layout the Add modals use), "Deselect all", and a footer
  **"Add to agent"** button that sends only checked+edited items to `applyDrafts`. Reuses `toast`.
- **`index.ts`** — export the three new components.
- Reuse existing lucide icons, Framer Motion, semantic Tailwind tokens (dark/light-safe), and the
  platform icon mapping already used by the integrations UI if easily importable; otherwise a small
  inline `facebook|whatsapp|instagram` icon map.

## F. i18n — `public/locales/{en,bn}/knowledge-base.json`

Extend the existing `autoTrain` block (EN + BN in lockstep) with keys for: picker
(`selectProfiles`, `chatsToTrain`, per-count labels, `feeLabel`, `creditsAvailable`, `noProfiles`,
`whatsappCaveat`, `startButton` already exists), progress (`phaseFetching`, `phaseReading`,
`phaseDrafting`, `percentComplete`), review (`reviewTitle`+`reviewDescription` exist; add `tabFaqs`,
`tabSampleReplies`, `tabContent`, `deselectAll`, `addToAgent`, `foundCount`, `emptyDrafts`), and
toasts (`trainingFailed`, `noConversations`, `insufficientCredits`, `applied`, `applyFailed`).

---

## Verification
1. `npm run build` (Next 16) — type-check passes; new routes + components compile.
2. **Picker**: open Knowledge Base → Auto-Train Engine for a bot with ≥1 connected platform → profiles
   render with labels; select one, pick a chat count; button enables and reads "Auto-train 1 profile".
   Bot with no integrations → friendly empty state.
3. **Run (Facebook)**: click → progress bar animates → returns to Review with FAQs/Sample/Content tabs
   populated from real page conversations. Verify one OpenRouter call in logs and a `CreditTransaction`
   row with `action_type:"auto_train", credits_spent:50`; `creditsBalance` dropped by 50.
4. **Run (WhatsApp/Instagram)**: with stored inbox messages → drafts appear; with none → "no
   conversations" info state and **no** credit charged.
5. **Insufficient credits**: balance < 50 → 402 surfaced as a friendly toast, no charge.
6. **Review → Apply**: deselect a few, edit one, click "Add to agent" → toast with counts; then check the
   FAQs / Sample Replies / Content Training tabs — kept items now appear there (proves persistence), and
   asking one FAQ's question in the **Compare** sandbox surfaces it via `[Context N]` (proves embedding).
7. Toggle BN/EN + dark/light across all three stages — labels, phases, tabs, buttons localized & themed.
