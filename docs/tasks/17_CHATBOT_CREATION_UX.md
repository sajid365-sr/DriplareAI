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
cards are locked, and under which plan. That is the input Phase 3d consumes.

**Ships dormant.** Every model is on every plan until an admin restricts one, so
this phase changes no merchant's behaviour on its own.

## Phase 3d — The lock is shown, not just enforced ✅

3c made the server refuse a model the plan does not include. The merchant met
that refusal as a toast **after** pressing Save, and learned nothing about why.
3d puts the answer on the card itself.

| File | Change |
| --- | --- |
| `components/chatbots/LockedOverlay.tsx` | **New.** `planLock` (the client verdict), `LockedContent` (the blur), `LockedOverlay` (lock badge + reason + upgrade CTA) |
| `components/chatbots/use-openrouter-models.ts` | `allowedPlans` added to `UiChatModelConfig` and `UiResolvedModelConfig`, and carried through all three field-by-field maps |
| `.../chat/_components/chat-settings.tsx` | Tier cards and model rows render the lock; the two "your current choice is locked" warnings; the dead `isEnterprise` deleted |
| `public/locales/{en,bn}/chatbots.json` | New `model_lock` block, 8 keys |

### Why blur plus an overlay, rather than a `disabled` attribute

A greyed-out card says "you may not have this" and nothing else. The merchant's
next question is always *which* plan, and *what do I do about it* — so the card
keeps its shape and its credit price (visible, blurred, unreadable) and the space
on top of it is spent on the answer: the plan that unlocks it and a link to buy
it. A `disabled` button would also have made the CTA unreachable.

The one hand-written detail that matters: the tier card is a `<button>` **inside**
a separate `relative` wrapper, with the overlay as its sibling. Putting the
overlay inside the button would have blurred the overlay too.

### The verdict is shared, not re-derived

`planLock` (client) and `checkModelAccess` (server) both end in the same
`lib/domain/model-catalog.ts` functions — `pickRequiredPlan(allowedPlans, region)`
in particular, which is why a BD merchant is told "Business" and never "Growth".
The lock is not a second reading of the rule; it is the same reading. Verified by
running both against each other (below).

### Three maps, one silent drop

`allowedPlans` had to be added in **three** separate places in the client hook —
the `mappedModels` map, `parseTiers()` and `deriveTiers()` — because each one
rebuilds its rows field by field. Missing any one of them is invisible: the
dashboard would show a model as open that the server refuses. It is the same trap
that made `/api/ai-models` need its own fix in 3c, so all four now carry the
same comment.

`PLACEHOLDER_TIERS` deliberately has no `allowedPlans`, so nothing is locked
before the server has answered. A lock that appears for one frame on an unlocked
model is worse than a lock that arrives late.

### `disabled` on the model row is load-bearing

cmdk stops calling `onSelect` **and** stops the arrow keys on a `disabled`
`CommandItem`. Guarding only `onSelect` would have left the keyboard able to pick
a locked model — the same class of gap as gating the UI but not the API.

### The CTA sits in the popover footer, not in the row

A row is itself a button, and an `<a>` inside a `<button>` is invalid HTML, so
the "See plans" link lives in a footer line under the list that counts the locked
models. It also reads better than the same link repeated on every row.

### "Your current choice is locked" — the state that breaks a live agent

If a plan is downgraded (or an admin newly restricts a model already in use) the
bot's **saved** model becomes one the chat route refuses, so that agent stops
replying. Both tabs now say so in a warning banner and name the way out. This is
the loud half of the same problem Phase 3e's auto-fallback will solve quietly.

## Phase 3e — The gate moved from the model to the mode ✅

Phase 3a–3d built a per-model plan fence: an `allowedPlans` list on every
catalogue entry, a Plan Access section in the admin's Configure drawer, a lock on
each affected card, and four routes enforcing it. **That whole fence has been
taken down**, because it put the rule in the wrong place.

### Why it was the wrong rule

A merchant never picks a model id. They pick **Fast / Smart / Genius**, and the
admin maps each tier to a model. So a per-model fence could only ever reach the
merchant *through* the presets — the admin's screen said one thing and the
merchant met it as something else. Keeping those two arithmetic stories in step
was the cost, and the fence also had to be re-checked on every model the admin
later repointed.

The rule that was actually wanted is one question, asked once: **is this plan
paid?**

```
Starter                    → Simple (Guided) only
everything above Starter   → Simple + Pro, over every model the admin
                             has left Merchant Active
```

`canUseProMode(plan)` (`lib/domain/plan-config.ts`) is that question, and it sits
on `planRank`, so `PLAN_KEYS` order *is* the hierarchy rather than a second list
to maintain.

### What was removed

| Gone | Was |
| --- | --- |
| `allowedPlans` on the catalogue, `ChatModelConfig`, `TierOption`, `SeedModel` | the per-model rule |
| `isModelAllowedForPlan`, `isActiveModelForPlan`, `pickRequiredPlan`, `sanitizeAllowedPlans` | its four readers in `lib/domain/model-catalog.ts` |
| Plan Access section in `ModelConfigSheet.tsx` | the admin surface for it |
| Plan Access column + badge in `ModelCatalogTable.tsx` | its list rendering |
| `model_lock.{unavailable,ctaGeneric,footer,currentTierLocked,currentModelLocked}` | its five strings |
| `aiSettings.configSheet.planAccess*`, `aiSettings.catalog.planAccessAll`, `...columns.planAccess` | its seven admin strings |
| `app/api/credits/check-and-deduct/route.ts` | see below |

What survives from 3d, because it was right for a different reason: the lock
*primitives* (`LockedOverlay`, `LockedContent`, blur + overlay, shown rather than
hidden), the single 403 + `code` response shape, and "no lock before the server
has answered".

### The four guards became one line

`lib/ai/plan-model-access.ts` no longer reads the database at all. The rule
depends on `plan` alone, which the caller already holds, so every function is
synchronous and the old `MODEL_ACCESS_UNAVAILABLE` 503 branch — "could not read
the rule, so I cannot say" — **no longer exists as a state**. One fewer failure
mode is one fewer way a merchant gets stuck.

`checkProModeAccess` answers with a discriminated union, so `requiredPlan` exists
in the type only when the answer is `blocked`. It used to be `PlanKey | undefined`,
which forced every caller to answer a question with no meaning — what is
`requiredPlan` when access is allowed? The Simple branch of `resolveModelForPlan`
was inventing a plan name nobody would ever read.

`cheapestPaidPlan(region)` replaces `pickRequiredPlan`, and it can never return
`undefined`: every region sells at least one paid plan above Starter, so the
"no plan to name" state that BD's missing `growth` used to create is gone too.
BD is told **Business**, Global is told **Growth** — the same rule, read per
region.

**Compare is Pro by definition.** Its `modelA` / `modelB` arrive in the request
body — choosing a specific model *is* the Pro feature — so that route now calls
`checkProModeAccess` directly instead of checking two ids against a list.

**The guard on `PUT /api/chatbots/[id]` had a hole.** The condition was
`if (model || provider)`, so a body of `{ promptMode: "pro" }` alone skipped the
gate entirely: nothing was saved (no Save button pressed) but the plan fence
could be stepped over. `promptMode` is now part of the condition.

### Making the write path agree with the read path

`lib/ai/plan-model-access.ts` gained `reconcilePromptModeForPlan(userId, plan)`,
called from `applyDowngrade` (so the cron path and the admin path both get it)
and from `setUserPlan`'s upgrade branch.

It exists because stored state could outlive the rule, and the failure was
silent. `resolveModelConfig("simple", "openai/gpt-4o")` finds no tier key, falls
through to `getValidatedModelId`, and **runs the model anyway** — so a bot left on
`promptMode: "pro"` after a downgrade would keep calling the expensive model while
the Simple tab highlighted no card at all. Reading as "nothing selected" while
billing the heavy model is exactly the kind of quiet spend that
`create-agent-dialog.tsx` picks its cheapest-tier default to avoid.

So a downgrade now writes `promptMode: "simple"` and `model: "fast"` — the same
`FALLBACK_SIMPLE_TIER` a new agent gets — and the count is written into the
notification the merchant already receives. Without that sentence they would just
find a cheaper tier one day and assume their setup had broken.

Only the **down** direction does anything. An upgrade never flips anyone to Pro:
that is the merchant's own choice, and it should not be made for them before they
press Save.

### Why the dead route mattered

`POST /api/credits/check-and-deduct` read `userId` from its request body and had
**no authentication of any kind** — so an anonymous request could decrement any
merchant's balance, and write a `CreditTransaction` in their name. It was
confirmed dead before deletion: no source file references it, and no workflow in
`docs/n8n-JSON/` calls it (the only endpoints n8n hits are
`/api/internal/ai-usage` and `/webhook/playground/chat`), which is also the live
billing path. Deleted, along with the now-empty `app/api/credits/` folder.

### The dead JSON key

Old `ai_credit_rules` rows still carry `allowedPlans`. Nothing reads it, but the
admin's GET → edit → POST cycle would have carried it forever — a setting visible
on no screen that outlives everyone who knew about it. Both
`POST /api/admin/ai-settings` and `GET /api/admin/ai-settings/fetch-models` now
`delete row.allowedPlans` on every model they write, so the key falls off on the
next save or refresh. No migration, and no `prisma db push`.

## Not done yet

- **Phase 4** — Terminology: the sidebar says "ChatBot" while the page title says
  "AI Agents". The playground rework (renaming `/chat` → `/playground`, the
  three-tab IA, the two-pane layout) is tracked separately in
  [18_PLAYGROUND_RESTRUCTURE.md](18_PLAYGROUND_RESTRUCTURE.md), because that
  branch of work is about information architecture rather than plan gating.

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

Phase 3d:

- [x] `npx tsc --noEmit` — clean
- [x] `npm run build` — exit 0, "✓ Compiled successfully in 55s"
- [x] `npx eslint` on the three touched files — 6 problems (3 errors, 3 warnings),
      and linting `git show HEAD:` copies of the two modified ones reports 7
      (3 errors, 4 warnings). The difference is exactly the deleted dead
      `isEnterprise`; nothing new was added
- [x] `isEnterprise` is gone repo-wide (grep over all `.ts`/`.tsx`)
- [x] **The client's verdict and the server's verdict, run against each other** —
      39 assertions. Both real modules were compiled unmodified (only the emitted
      `require()` specifiers were redirected to stubs; `db` is a stateful fake)
      and asked the same question about the same catalogue entry, over: absent /
      `null` / `[]` / junk-only / a bare string, business-only, growth-only in
      each region, duplicate + mixed case + surrounding whitespace, a junk key
      beside valid ones, an unknown current plan, and region omitted. Every case
      asserts `planLock().locked === (checkModelAccess().status === "blocked")`
      **and** that both sides return the same `requiredPlan` — so the dashboard
      and the API cannot disagree. BD + growth-only yields `undefined` on both
      sides, i.e. no plan is named that BD does not sell
- [x] **The hook's three field-by-field maps, run for real** — 19 assertions
      driving the actual `useOpenRouterModels()` with a stubbed fetch and a
      hand-rolled `useState`/`useEffect`/`useMemo`: a model's `allowedPlans`
      survives the `mappedModels` map; `parseTiers` sanitises `"  BUSINESS "`,
      a duplicate and an unknown key into `["business","enterprise"]` while
      leaving `effectiveCredits` alone; `[]` on a tier means "no lock" rather
      than "nobody"; `deriveTiers` (server sent no `tiers`) takes the lock from
      the preset's own model and still multiplies credits; and when
      `/api/ai-models` fails, the fallback source's models — which carry no
      `allowedPlans` — show no lock. All pass
- [x] Locale diff is a pure insertion, 10/0 in both files; CRLF preserved
      (363 → 373 line endings, none of them lone LF) and no trailing newline
      introduced; en/bn key parity holds for all 8 new keys
- [ ] Manual: Blur + overlay with the right plan name on a locked tier card and a
      locked model row, and the "See plans" footer in the model dropdown
- [ ] Manual: Bengali + English, dark + light, mobile (375px) — the overlay has
      to stay readable over the blurred card in both themes
