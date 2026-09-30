# Task 17: Chatbot Creation & Onboarding UX

Branch: `feature/chatbot-creation-ux`

## Objective

The chatbot creation journey asked for the same decision in more than one place,
so a merchant could set a model and never see it reflected afterwards.

| Concern | Was | Now |
| --- | --- | --- |
| Bot identity | `/chatbots/new` (name + model + full source UI) | Create dialog (name only) |
| Bot brain (model + prompt) | `/chatbots/new` **and** playground → AI Model tab | Playground only |
| Bot knowledge (sources) | `/chatbots/new` **and** orphan `[chatbotId]/sources` **and** Knowledge Base | Knowledge Base only |

## Why the model moved to the playground

The tier abstraction (Fast / Smart / Genius) is the non-technical merchant's
language, and it already lives in the playground's AI Model tab next to each
tier's credit cost. Asking for a raw OpenRouter model in the creation form put
the technical vocabulary in front of exactly the user the tiers exist to protect,
and made the decision *before* the Quick Setup wizard had asked what the business
actually does.

## Phase 1 — Model has one owner ✅

| File | Change |
| --- | --- |
| `_components/create-agent-dialog.tsx` | **New.** Name-only dialog; quota hint; inline 403 handling |
| `_components/ChatbotsHeader.tsx` | `onCreate` callback replaces the `router.push` to the deleted route |
| `_components/EmptyState.tsx` | Same |
| `page.tsx` | Owns dialog state; plan-quota derivation rewritten |
| `new/page.tsx` | **Deleted** — its model picker and source UI were the duplicates |
| `chat-settings.tsx` | Tier cards now store and detect the tier key |
| `use-openrouter-models.ts` | Dropped `getModelKeyFromId` (dead after the above) |
| `public/locales/{en,bn}/chatbots.json` | `new_bot` → `create_dialog` |

### Bug fixed alongside: Simple-mode tier cards never highlighted

`QUALITY_LEVELS` built its key with `getModelKeyFromId(tiers.fast.modelId)`,
producing `openrouter|google/gemini-2.5-flash-lite`. But `/chatbots/new` stored a
concrete model id while the create route kept `promptMode: "simple"` — so
`currentModelKey` (`openrouter|openai/gpt-4o`) matched no card. A configured bot
rendered three unselected cards, reading as if the setup had been lost.

The fix uses the convention `handleModelSelect` already understood but was never
fed — a `tier|<key>` key ([chat/page.tsx:61](app/(dashboard)/dashboard/chatbots/[chatbotId]/chat/page.tsx#L61)) — so the cards now store
`fast` / `smart` / `genius` itself. Both storage shapes are matched
([chat-settings.tsx:157](app/(dashboard)/dashboard/chatbots/[chatbotId]/chat/_components/chat-settings.tsx#L157)),
so bots created earlier with an explicit model still light up the right card, and
a genuine mismatch says so instead of showing nothing.

Verified against both API routes: `SIMPLE_TIER_KEYS` in
[POST](app/api/chatbots/route.ts#L57), [PUT](app/api/chatbots/[chatbotId]/route.ts#L116)
and [GET](app/api/chatbots/[chatbotId]/route.ts#L39) all round-trip a tier key
unchanged.

### Bug fixed alongside: Enterprise could not create any agent

`/api/usage` returns `includedChatbots: planConfig.maxChatbots`, and Enterprise
is `Infinity` — which `JSON.stringify` turns into `null`. The list page compared
`bots.length >= usage.includedChatbots`, i.e. `0 >= null`, which is `true`, so an
unlimited plan was permanently "limit reached". An absent cap is now treated as
no cap. The used-count also switched to `usage.chatbots_total`, matching what
`canCreateChatbot` actually counts, so the UI can no longer offer a create the
API would reject.

## Phase 2 — Knowledge has one owner ✅

Removing the source uploader from creation left a gap: a merchant could make an
agent and never learn it had to be trained. Phase 2 closes it by pointing at the
owner instead of re-implementing it.

| File | Change |
| --- | --- |
| `chat/_components/setup-checklist.tsx` | **New.** Data-driven checklist card on the playground |
| `chat/page.tsx` | Renders it above the settings cards; passes the knowledge count |
| `_components/create-agent-dialog.tsx` | Success toast now carries a **Train now** action → Knowledge Base |
| `[chatbotId]/sources/page.tsx` | Retired — now a redirect to `/dashboard/knowledge-base?botId=…` |
| `api/chatbots/[chatbotId]/route.ts` | `_count` also counts `sampleReplies` |
| `public/locales/{en,bn}/chatbots.json` | `success_hint` + `train_now` in `create_dialog`; new `setup_checklist` block |

**The checklist reports state, it does not decide it.** Each row is derived from
real data — `_count.sources + _count.faqs + _count.sampleReplies` for knowledge,
`/api/chatbots/[chatbotId]/integrations` for channels — so it cannot claim a step
is pending after it has been done. It hides itself once nothing is left, and the
viewer can dismiss it per agent. `coming_soon` platforms are excluded from the
channel count, since a step that cannot be completed is not a step.

**Why `sources/_components` survives.** The Knowledge Base's
`ContentTrainingSection` imports its four upload tabs from that folder, so only
the *page* was duplicated. The route is kept as a redirect (rather than deleted)
so existing bookmarks still land somewhere useful.

### Dismissal is per-viewer, not per-agent

The "hide this checklist" flag lives in `localStorage`, read through
`useSyncExternalStore`. A `useState` initializer would return a different value
on the client than the server rendered — a hydration mismatch — and `localStorage`
does not exist during SSR. This is deliberately **not** a `Chatbot` column: it
would have needed a `prisma db push`, and a pushed schema would drop the live
`n8n_chat_histories` chat-memory table (see `docs/tasks/` notes on that trap).

## Phase 2b — Channels have one owner too ✅

The checklist's "Connect a channel" step exposed a second duplication of the same
shape as the model: **two** places to connect a channel. `/dashboard/platforms`
was the page merchants actually used, but the per-chatbot
`/dashboard/chatbots/[id]/integrations` page was the only home of the Website
Widget embed code and of the generic connect used by every platform without an
OAuth flow. Deleting it would have quietly removed a feature, so the flow moved
first and the route was retired second.

| File | What changed |
| --- | --- |
| `app/(dashboard)/dashboard/platforms/page.tsx` | Owns the generic connect (`config` is now persisted — the old copy posted `{}` and dropped the widget's `embedCode`), the `?botId=` deep link, and the "More Channels" list |
| `.../platforms/_components/PlatformsHeader.tsx` | Website Widget entry in the platform picker; "More Channels" section for admin-activated platforms; icon/colour now read from the shared map instead of a second hardcoded copy |
| `.../platforms/_components/getPlatformIcon.tsx` | Exact-id map (incl. Telegram, Slack, TikTok, Messenger, Webhook, Custom API) before the fuzzy matching, so `tiktok` no longer renders as a website widget |
| `hooks/integrations/useWebsiteIntegration.ts` | Moved out of the orphan folder; `ConnectPlatformPayload`; toasts translated |
| `components/integrations/WebsiteWidgetModal.tsx` | Moved out; fully translated (it shipped with every string hardcoded in English); `text-emerald-500` → `text-success` |
| `app/api/integrations/instagram/oauth/callback/route.ts` | All six returns now land on `/dashboard/platforms?botId=…` |
| `app/(dashboard)/dashboard/chatbots/[chatbotId]/integrations/page.tsx` | Replaced by a redirect, so the old OAuth return URL and any bookmark still work |

**The deep link is derived during render, not synced into state.** `?botId=` is
read from `searchParams` and folded into `activeBotFilter` on every render
(precedence: the viewer's own pick → the deep link → the first agent). Copying it
into `useState` via an effect would trip `react-hooks/set-state-in-effect` and
would break when the page is already mounted and only the query string changes.
Choosing an agent by hand calls `router.replace("/dashboard/platforms")` so a
refresh does not snap the selection back.

**Known limitation, carried over unchanged.** The generic connect route only
upserts an integration row. For `webhook` and `custom_api` that leaves the
merchant with a "connected" channel and no endpoint to POST to — the retired page
behaved the same way. Worth a follow-up; it is not a regression from this change.

## Phase 3 — A model can be sold on some plans only ✅ (3a–3c)

The plan could not gate a model because there was nowhere to write the rule.
`ai_credit_rules` is a single `PlatformSetting` row holding a JSON blob, and the
catalogue inside it is the one place a model is described. Adding an
`allowedPlans` key to each catalogue entry therefore needs no migration at all —
which matters here, because `prisma db push` would drop the live
`n8n_chat_histories` table.

### The rule

```
allowedPlans: absent or []  →  every plan
allowedPlans: ["business"]  →  business (and anything the admin adds later)
```

An explicit **list**, not a minimum. `growth` exists only in Global, so a
minimum would have made a BD business user and a Global business user get
different verdicts out of one identical rule.

`isModelAllowedForPlan` and `pickRequiredPlan` live in `lib/domain/model-catalog.ts`
— deliberately client-safe, so the admin panel, the dashboard and the API all
run the *same* function rather than three readings of one rule.

### Where it is enforced

| # | File | What it decides |
|---|------|-----------------|
| 1 | `app/api/chatbots/route.ts` (POST) | creating an agent |
| 2 | `app/api/chatbots/[chatbotId]/route.ts` (PUT) | changing its model |
| 3 | `app/api/chatbots/[chatbotId]/compare/route.ts` | both compared models |
| 4 | `app/api/chatbots/[chatbotId]/chat/route.ts` | the reply that gets billed |
| 5 | `app/api/ai-models/route.ts` | what the dashboard is *told* |
| 6 | `lib/ai/chat-models.ts` | resolving a stored value to a real model |

`lib/ai/plan-model-access.ts` is the only place that reads the rule out of the
DB; `toDeniedResponse` turns a verdict into the 403/503 in one line, so all four
enforcing routes answer with the same `code`.

### The three things that made the old silence possible

**The gate checks the resolved model, not the requested one.**
`resolveModelForPlan(promptMode, selectedTierOrModel, plan)` resolves first, then
verifies. This closes two holes at once: `promptMode: "simple"` means the client
sends `"fast"`, not a model id, so there is nothing to compare against a
catalogue until the preset is consulted; and a request for a deprecated alias
resolves to a *different* id, so checking the raw value would have left that id
unexamined. What is checked is exactly what gets called and billed.

**The compare route was the widest hole.**
Its `modelA` / `modelB` come straight from the request body, never from the
dashboard's list. Locking the UI alone would have stopped a merchant who clicks
and nobody who types. That route also re-resolved both models a second time
further down (same call, same input) — removed.

**"Not allowed" is a distinct answer, not another fallback.**
`resolveModelConfig` silently drops to the Fast tier when a model is gone. That
is right for a deprecated id and wrong for a plan restriction: the merchant
believes their choice is running while a different model answers. So
`resolveModelForPlan` returns `blocked` and the route says so. It deliberately
does **not** hunt for a substitute tier — choosing the alternative is the
admin's call, and silently choosing one is how this bug was born.

**If the rule cannot be read, the answer is 503, not "allowed".** Returning an
empty map on a DB blip would read as "no restrictions" and quietly open the
fence. Same reasoning as `/api/ai-models` serving a 500 instead of a hardcoded
catalogue.

### Carried forward

`allowedPlans` is also threaded onto `ChatModelConfig` and `TierOption`, so
`/api/ai-models` can tell the dashboard which models and which Fast/Smart/Genius
cards are locked, and under which plan. That is the input for the blurred
locked-card UI (3d) — the server work is done; the UI is not.

**Ships dormant.** Every model is on every plan until an admin restricts one, so
this phase changes no merchant's behaviour on its own.

## Not done yet

- **Phase 3d** — the client half of the above: blur + overlay on a locked model,
  an upgrade CTA, and deleting the dead `isEnterprise` in `chat-settings.tsx`.
- **Phase 3e** — retiring `app/api/credits/check-and-deduct/route.ts` (it trusts
  the `userId` in its body, so any signed-in user can drain another merchant's
  balance — confirmed dead: no caller, and absent from `Core-AI-Brain.json`), and
  rewriting a chatbot's model when its owner's plan stops covering it.
- **Phase 4** — Terminology: the sidebar says "ChatBot" while the page title says
  "AI Agents".

## Verification

Phase 1, Phase 2 and Phase 2b, run after each:

- [x] `npx tsc --noEmit` — clean
- [x] `npx eslint` on every new/changed file — the only findings are the 9
      pre-existing ones in `chat/page.tsx` (`any` types, `fetchBot` ordering,
      unused `err`). Confirmed identical against `HEAD`'s copy of that file, so
      this work added none
- [x] `npm run build` — exit 0, "Compiled successfully"
- [x] No remaining references to `/dashboard/chatbots/new` or the `new_bot` keys
- [x] Locale diffs are pure insertions (22 lines each in Phase 2, 30 each in
      Phase 2b), no reformatting; en/bn key parity holds for every new key
- [x] Both retired routes (`sources`, `integrations`) appear in the build output
      as dynamic routes, i.e. the redirects compile
- [ ] Manual: create → toast shows **Train now** → lands in the Knowledge Base
- [ ] Manual: checklist rows flip to done as knowledge/channels are added
- [ ] Manual: Bengali + English, dark + light, mobile (375px)
- [ ] Manual: `/dashboard/chatbots/<id>/integrations` redirects to
      `/dashboard/platforms?botId=<id>` with that agent pre-selected
- [ ] Manual: Website Widget connect from the Connect New Channel dropdown shows
      the embed code modal

Phase 3a–3c:

- [x] `npx tsc --noEmit` — clean
- [x] `npx eslint` on all 9 touched files — 7 problems, and all 7 are the
      pre-existing `no-explicit-any` in `ai-models/route.ts` (2),
      `compare/route.ts` (2) and `openrouter-service.ts` (3). Confirmed identical
      by linting `git show HEAD:` copies of those three, which report the same 7
      at the same offsets. Nothing new added
- [x] `npm run build` — exit 0, "Compiled successfully in 39.3s"
- [x] **The rule itself, run for real** — 23 assertions against the compiled
      `lib/domain/*`: absent / non-array / `[]` / junk-only all mean "every
      plan"; duplicates, case and whitespace normalise to `PLAN_KEYS` order, so
      one set can never serialise two ways; an unknown key like `"premium"` is
      dropped while the valid keys beside it survive; `pickRequiredPlan` returns
      `business` rather than `growth` for a BD user, and `undefined` when the
      model is only on plans BD does not sell. All pass
- [x] **The enforcement module, run for real** — `lib/ai/plan-model-access.ts`
      compiled *unmodified* (only the emitted JS's `require()` specifiers were
      redirected to stubs) against a fake `ai_credit_rules` row: 25 assertions
      covering allowed / blocked / unknown, `requiredPlan` per region, the
      `required_plan` field being omitted rather than faked, `[]` meaning "every
      plan" rather than "nobody", two models checked in one read, corrupt rows
      (`null`, a bare string, an entry with no `id`) skipped without throwing,
      and a DB outage yielding 503 + `MODEL_ACCESS_UNAVAILABLE` rather than 403
      or a silent allow. All pass
- [ ] Manual: as a Starter user, `PUT /api/chatbots/<id>` with a business-only
      model id → 403 `MODEL_NOT_IN_PLAN`, not 200. Same for `/compare`. This is
      the one claim the harness above cannot make for me, because the routes sit
      behind Clerk and I cannot hold a session — it needs a real login
