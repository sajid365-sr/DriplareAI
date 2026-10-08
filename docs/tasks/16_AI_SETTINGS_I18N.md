# Task 16: AI Settings Page — i18n Hardening

## Objective
`/admin/ai-settings` and every component under it rendered hardcoded English even
when the app was switched to Bengali. Make all user-facing text dynamic through
`react-i18next`, backed by the existing `admin` namespace.

Source of the issue: AGENTS.md §4 (Dual Language Support / file-based translations).

## Scope
| File | Change |
|---|---|
| `public/locales/en/admin.json` | `aiSettings` block rewritten (104 leaf keys) |
| `public/locales/bn/admin.json` | Same block, Bengali (104 leaf keys — full parity) |
| `AISettingsHeader.tsx` | 4 button labels + subtitle |
| `QuickSetupPresets.tsx` | Preset cards restructured; `PRESET_CARDS` no longer holds English |
| `ModelCatalogToolbar.tsx` | Title, counters, search, 3 filter dropdowns |
| `ModelCatalogTable.tsx` | 7 column headers, empty state, badges, tooltip, menu |
| `ModelPagination.tsx` | Rows-per-page, range line, sr-only nav labels |
| `DeleteModelModal.tsx` | Title, description, both buttons |
| `ModelCombobox.tsx` | Default placeholder, search, empty state, per-1M |
| `ModelConfigSheet.tsx` | All labels; dead `t` binding now actually used |
| `page.tsx` | 7 toast messages + validating overlay |

## Translation rules applied
- Technical terms stay English in Bengali (AGENTS.md §4): `Model`, `Credit`,
  `Provider`, `Preset`, `Tier`, `Token`, `Prompt`, `Completion`, `Dashboard`,
  `Merchant`, `Fast` / `Smart` / `Genius`, `Deprecated`, `Status`.
- Plural forms use i18next `_one` / `_other` suffixes. Bengali has no plural
  inflection, so both branches intentionally carry identical text.
- Sentences containing inline markup use `<Trans>` with ordered
  `<0>`, `<1>`, `<2>` indices.

## Dead keys removed
`reset`, `modelsTitle`, `modelsSub`, `tiersTitle`, `tiersSub`, `governanceTitle`,
`governanceSub`, `tabs.*`, `quickSetup.*`, `autoPricing.*` — none had a single
call site (verified by grepping `aiSettings.` across the repo).

## Side effect beyond i18n
`types.ts` — the USD→BDT rate `120` was a literal inside `formatPriceWithBDT`
and again inside the toolbar's "Rate: 1 USD = 120 BDT" sentence. A translated
sentence cannot carry a hardcoded number, so it became an exported
`USD_TO_BDT_RATE` constant used by both. Resolves part of finding F early.

## Phase A — housekeeping
`ModelConfigSheet.tsx` — removed unreferenced imports `Cpu`, `Sparkles`, `Badge`
(flagged by eslint; pre-existing), and the previously dead `t` binding from
`useTranslation` is now genuinely used.

---

# Phase B — Dead code sweep

Finding B ("dead code") was already resolved inside Phase A, so this phase
instead swept the whole surface for anything else unreferenced.

## Method
For every exported symbol in `credit-resolver.ts`, `credit-config.ts`,
`_components/types.ts` and `ModelConfigSheet.tsx`, counted repo-wide references
and subtracted the declaration line. A first pass that excluded the declaring
file produced false positives (`CREDIT_COSTS`, `CreditActionType`,
`getCreditCostByModel` are all used internally) — the count-based pass is the
authoritative one.

## Result — exactly one dead export
| Symbol | File | Verdict |
|---|---|---|
| `getTierCreditCost(tier)` | `lib/ai/credit-resolver.ts` | **Removed** — zero call sites anywhere, not even internally |

Consequence: `getCreditCostByTier` became an unused import in the same file and
was removed from the import block. The function itself stays exported from
`credit-config.ts` (20 references elsewhere).

ESLint with `@typescript-eslint/no-unused-vars: error` across both ai-settings
directories: **zero findings**.

## Known duplication created by Phase A (belongs to finding F)
`USD_TO_BDT_RATE = 120` now exists in two modules:
- `app/(admin)/admin/ai-settings/_components/types.ts` (added in Phase A)
- `lib/ai/cost-calculator.ts:48` (pre-existing, module-private)

Net effect is still an improvement — the toolbar's literal `120` inside the
"Rate: 1 USD = 120 BDT" sentence was removed, so the project went from three
copies to two. Consolidating both into one shared module is finding F.

## Phase B verification
- [x] `npx tsc --noEmit` → exit 0
- [x] `npx eslint` on `credit-resolver.ts` + both ai-settings directories →
      no new findings (3 pre-existing `set-state-in-effect` errors remain)
- [x] repo-wide grep for `getTierCreditCost` (including docs) → no references


## Verification
- [x] `node` — both JSON files parse; en/bn key parity 104 / 104, zero drift
- [x] `npx tsc --noEmit` → exit 0, no type errors
- [x] i18next render test — every interpolated and plural key printed in both
      locales; `1 credit` / `5 credits`, `1 popular model` / `34 popular models`
- [x] `npx eslint` on both directories — no new findings
- [ ] Visual check in the browser — BD region (Bengali) and Global region (English)
- [ ] Visual check — Dark and Light mode
- [ ] Visual check — mobile width (375px)

---

# Phase C — Admin-editable USD → BDT rate

## Why
The rate `120` was hardcoded. The real rate drifts constantly, so every ৳ figure
derived from it — the catalogue's price previews, per-workspace cost analytics,
admin billing, the exported report — was silently wrong the moment the real rate
moved. The rate had to become data, not a constant.

## Decision — one rate, converted at read time
Two options were on the table: `costBdt` is persisted per log at write time
(`lib/ai/charge-usage.ts:272`), so either
1. reports sum the stored `costBdt`, and history keeps the rate it was written
   at, or
2. reports sum `costUsd` and multiply by the **current** rate at read time.

Option 2 was chosen (user: "সব জায়গায় এক রেট"). Option 1 mixes rates inside a
single report — old rows at 120, new rows at 130 — so the total is a number no
rate ever produced. Option 2 re-prices history, which is the correct behaviour
when the underlying cost is in USD and ৳ is only a display currency.

`AIUsageLog.costBdt` is still written (cheap, and useful as a written-time
reference) but **is no longer read by any report or UI**.

## Single source of truth
| Layer | Symbol |
|---|---|
| Constant + bounds + sanitiser | `DEFAULT_USD_TO_BDT_RATE`, `USD_TO_BDT_RATE_MIN/MAX`, `sanitizeUsdToBdtRate()` in `lib/domain/credit-config.ts` |
| Server read | `getUsdToBdtRate()` in `lib/ai/credit-resolver.ts` — reads `ai_credit_rules.usdToBdtRate` fresh from the DB on every call, exactly like `getCreditRules()` |
| Admin panel | `settings.usdToBdtRate` off the `/api/admin/ai-settings` payload |

`credit-config.ts` is client-safe (no `server-only`), so both sides share the
same bounds and sanitiser. The literal `120` now exists in exactly one place.

## Files changed
| File | Change |
|---|---|
| `lib/domain/credit-config.ts` | New currency section — default, bounds, sanitiser |
| `lib/ai/credit-resolver.ts` | `CreditRules.usdToBdtRate`, parsing, `getUsdToBdtRate()` |
| `lib/ai/cost-calculator.ts` | Private `USD_TO_BDT_RATE = 120` deleted; awaits the live rate |
| `_components/types.ts` | `AISettingsData.usdToBdtRate`; `formatPriceWithBDT` takes the rate as a parameter |
| `_components/ModelCatalogToolbar.tsx` | Rate sentence replaced by an inline number input at the marked spot |
| `_components/ModelCatalogTable.tsx` | Passes `settings.usdToBdtRate` |
| `_components/ModelCombobox.tsx` | New required `usdToBdtRate` prop |
| `_components/QuickSetupPresets.tsx` | Passes it through |
| `page.tsx` | `handleUpdateUsdToBdtRate` |
| `api/admin/ai-settings/route.ts` | Default, GET merge, POST sanitise |
| `api/admin/ai-settings/fetch-models/route.ts` | **Critical** — this route rebuilt the whole value from scratch, so without this the rate reset to 120 on every "Fetch Models" click |
| `api/usage/route.ts` | `totalChargedAmount` + platform breakdown from `costUsd` |
| `api/admin/workspaces/route.ts` | Dropped `_sum.costBdt`; `apiCostBdt` derived from `costUsd` |
| `api/admin/workspaces/[id]/route.ts` | Model + channel breakdowns, `totalCostBdt`, and the 100-row log list |
| `api/admin/billing/route.ts` | `ai_usage` log rows |
| `api/user/export/route.ts` | JSON payload + PDF table |
| `prisma/schema/billing.prisma` | Stale `// costUsd × 120` comment |

## Input behaviour
The toolbar input keeps a local string draft so intermediate states ("12" on the
way to "129", or an empty field after clearing) are not rejected mid-keystroke.
Only well-formed positive numbers propagate up; clamping happens once, on save,
in `sanitizeUsdToBdtRate`. Invalid text reverts to the saved value on blur.

The rate flows through the existing **Save Settings** button — there is no
auto-save, matching every other field on the page.

## i18n
`catalog.showing` lost its `{{rate}}` interpolation (a translated sentence can't
carry an editable number); `catalog.rateLabel`, `catalog.rateSuffix` and
`catalog.rateHint` added. Parity is now **107 / 107**.

## Phase C verification
- [x] `npx tsc --noEmit` → exit 0
- [x] en/bn key parity 107 / 107, zero drift; no leftover `{{rate}}`
- [x] repo-wide grep for `costBdt` — remaining hits are the write path, the
      `CostAnalyticsTab` / billing page consumers (both fed by the fixed routes),
      and docs. No report sums a stored `costBdt`.
- [x] repo-wide grep for a literal `120` rate → only `DEFAULT_USD_TO_BDT_RATE`
- [x] ESLint on every touched file — problem count identical to `HEAD` for all
      four files that already had findings (14 total, all pre-existing
      `no-explicit-any`); zero new findings
- [ ] Visual check — type a rate, Save, confirm table ৳ updates
- [ ] Visual check — "Fetch Models" no longer resets the rate

## Not done
The remaining findings from the research pass are untouched:
**C** — ReFetch button state bug (`AISettingsHeader.tsx:74-77`: `onReFetch` sets
`loading` but the button reads `saving`), **D** — `minCreditThreshold` /
`defaultProvider` have no UI and `temperature` / `isManualOverride` are not
visible, **E** — the `Assigned Tier` dropdown is inert, **G** — duplicate
default catalogues in `api/admin/ai-settings/route.ts` vs `api/ai-models/route.ts`,
**H** — no column sorting, no dirty-state guard, whitelist and 35-model cap.

---

# Phase D — Findings C and E

## C — the ReFetch button never showed its own loading state

The reported symptom was a prop mismatch: `onReFetch` (`fetchSettings`) sets
`loading`, while the button reads `saving`. The cause ran deeper.

`page.tsx` gated the whole page on `if (loading || !settings)` and rendered the
placeholder instead. So clicking ReFetch **unmounted the entire page** into a
white "Loading AI & Credit settings…" — the button could never render its own
spinner, and the admin lost their search text, all four filters and the current
page number on every refresh.

Fix: two distinct load paths.

| Mode | State | Effect |
|---|---|---|
| `"initial"` | `loading` | Page not yet rendered — placeholder is correct |
| `"refresh"` | `refreshing` | Page stays mounted; only the ReFetch button spins |

`AISettingsHeader` gained a `refreshing` prop and now reads `refreshing || saving`
for `disabled` and `refreshing` for the spinner.

One trap worth recording: `onClick` passes the MouseEvent to its handler, so
`onReFetch={fetchSettings}` would have put the event into the `mode` parameter —
silently reproducing the original bug in a new form. Hence the explicit
zero-argument `handleRefresh` wrapper.

**Still open (finding H):** ReFetch discards unsaved edits with no confirmation.
That was already true before this change, and a dirty-state guard is its own
finding.

## E — the `Assigned Tier` dropdown promised a credit cost it never applied

Research corrected the original note. `tier` was *not* fully inert: it is
persisted, served by `/api/ai-models`, rendered as a badge in the merchant
dashboard (`chat-settings.tsx:307`) and used for fallback model selection
(`pickPreferredModel`). So the dropdown was wired — just not to the one thing its
own label promised.

The labels read `Economy (1 Cr)` / `Standard (3 Cr)` / `Premium (5 Cr)`, yet
selecting one left the credit number untouched. An admin could mark a model
`Premium` and still bill it 1 credit while the merchant's dashboard displayed a
"Premium" badge.

Fix: picking a tier now applies that tier's cost as the credit value.

- The number comes from `getCreditCostByTier()` in `credit-config.ts` — the same
  `CREDIT_COSTS` table billing already uses, never a literal. The values match the
  labels exactly (1 / 3 / 5).
- `isManualOverride` is set, because choosing a tier *is* a deliberate decision
  about that model — the same flag `handleFetchOpenRouterModels` preserves.
- The admin can still type over the number afterwards; tier is the template, not
  a lock. A hint line under the grid says so in both languages.

`fetch-models` now also preserves an existing model's `tier` (a new
`previousTiers` map, mirroring `previousCredits`). Without it, every "Fetch
Models" click recomputed the tier from the model's average price and silently
undid the admin's choice — the same failure mode already fixed for the rate in
Phase C.

## Phase D verification
- [x] `npx tsc --noEmit` → exit 0
- [x] en/bn key parity **108 / 108** (`configSheet.tierHint` added to both)
- [x] ESLint per-file, `HEAD` vs now — no new findings anywhere:
      `page.tsx` 2→2, `AISettingsHeader.tsx` 0→0, `fetch-models/route.ts` 7→7,
      `ModelConfigSheet.tsx` 5→1 (Phase A removed 3 unused imports). The
      remainder are pre-existing `set-state-in-effect` / `no-explicit-any`.
- [ ] Visual check — ReFetch spins in place, filters and page number survive
- [ ] Visual check — choosing Premium fills the credit field with 5
- [ ] Visual check — "Fetch Models" leaves a hand-picked tier alone

## Still not done
**D** — `minCreditThreshold` / `defaultProvider` have no UI, `temperature` is not
editable, `isManualOverride` is not visible. **G** — duplicate default catalogues
in `api/admin/ai-settings/route.ts` vs `api/ai-models/route.ts`; the two disagree
(`gemini-2.0-flash-001` is `Standard` but carries 1 credit). **H** — no column
sorting, no dirty-state guard, whitelist and the 35-model cap.



---

# Phase E — Price filter in the model catalogue

## What was added
Two orthogonal controls on the "LLM Models Catalog & Auto-Pricing" toolbar:

| Control | Options | Effect |
|---|---|---|
| Price range | All / Under $1 / $1–$5 / Above $5 (per 1M) | Narrows the list to a price band |
| Price sort | Catalogue Order / Low → High / High → Low | Brings the cheapest or priciest to the top |

## Price basis
`blendedPricePerM()` — the average of `promptPrice` and `completionPrice` per 1M
tokens. This is deliberately the same figure `fetch-models` uses to auto-assign a
tier (`avgCostPerM`), so ordering by price and ordering by tier can never
disagree. The definition lives once, in `_components/types.ts`.

## New files
- `_components/price-filter.ts` — `PriceSort`, `PriceRange`, `matchesPriceRange()`,
  `sortByPrice()`. Bands are lower-inclusive, upper-exclusive, so `$1.00` belongs
  to `$1–$5` only and no model is counted twice. Verified: every sampled price
  lands in exactly one band.

`sortByPrice` copies before sorting — the input array comes straight from React
state and must not be mutated in place.

## Toolbar layout
The filter bar had `sm:flex-nowrap` with four controls; a fifth would have
squeezed every Select until the labels clipped. Now `flex-wrap` at all widths, so
wide screens still get one row (`flex-1` each) and narrow ones wrap two per row.

## i18n
9 new keys under `aiSettings.catalog.filters` in both locales, including a
`priceHint` tooltip explaining the blended basis. Parity now **118 / 118**.

## Lint findings caught and fixed during this phase
- `page.tsx` — unused `blendedPricePerM` import (the logic moved into
  `price-filter.ts`). Removed.
- `ModelCatalogToolbar.tsx` — the Phase C rate input used
  `useEffect(() => setRateDraft(...), [usdToBdtRate])`, which trips
  `react-hooks/set-state-in-effect` and costs a second render on every rate
  change. Replaced with React's documented "adjust state when a prop changes"
  pattern (compare-and-set during render). The `useEffect` import went with it.

Both files are back to their `HEAD` lint counts (page.tsx 2, toolbar 0 — all
pre-existing).

## Verification
- [x] `npx tsc --noEmit` → exit 0
- [x] en/bn parity 118 / 118
- [x] Price band logic: sampled prices 0, 0.1875, 0.21, 0.375, 0.999, 1, 1.0001,
      4.999, 5, 6.25, 9, 1000 → each lands in exactly one band
- [x] ESLint per-file `HEAD` vs now → no new findings
- [ ] Visual check — sort and range together, in both themes and at 375px

## Cosmetic note
Rewriting the locale JSON via `JSON.stringify` expanded one unrelated one-line
object (`users.stats`) to multi-line form. Every other hunk in those two files is
inside `aiSettings`. The file is now uniformly formatted.

---

# Merchant Active audit — findings only, no code changed

Requirement: only models with `isMerchantActive === true` **and**
`isDeprecated !== true` may reach merchants anywhere in `/dashboard`.

## The filter is correct on the normal path
`app/api/ai-models/route.ts:99` and `lib/ai/openrouter-service.ts:404-406` both
apply it, both are uncached and `force-dynamic` with `Cache-Control: no-store`,
so an admin toggle is reflected immediately. No stale-flag cache exists.

## Gap 1 (High) — disabling every model disables the filter instead
Both paths have a fallback that fires **exactly when the active list is empty**:

- `app/api/ai-models/route.ts:113` — returns the hardcoded `DEFAULT_ACTIVE_MODELS`
  (`:12-68`), which carries no flags at all.
- `lib/ai/openrouter-service.ts:408-409` returns `null` for an empty active list,
  and `:436-437` then serves `getCachedOpenRouterModels()` — the entire curated
  OpenRouter live catalogue — or `FALLBACK_MODELS`.

So an admin who switches every model off still sees models in the picker,
Fast/Smart/Genius cards, compare, and the new/edit bot pages.

Worse: `lib/ai/chat-models.ts:126-138` `getValidatedModelId` builds its
`activeIds` from that same list, so with an empty DB list **every** curated model
passes server-side validation and can be used and billed.

The fix must distinguish two cases that are currently conflated:
- no `PlatformSetting` row at all → defaults are legitimate bootstrap
- row exists but zero models pass the filter → honour it (empty stays empty)

## Gap 2 (Medium) — no catalogue check at billing time
`app/api/credits/check-and-deduct/route.ts:71`,
`app/api/internal/ai-usage/route.ts:55` and `lib/ai/charge-usage.ts:108` accept
any model string and only derive a tier and price. None consult the catalogue.
The dashboard UI paths do normalise server-side (rows 10–12 of the audit), but the
n8n path that produces real customer replies is outside this repo and is billed
with an unvalidated id.

## Gap 3 (Medium) — client-side flag-less fallbacks
`components/chatbots/use-openrouter-models.ts:47-98,214` seeds state with
`FALLBACK_CHAT_MODELS` and keeps it on fetch failure (`:274-278`).
`compare/page.tsx:33-34` and `chatbots/new/page.tsx:24` initialise their
selections from that same array, so a default can point at a disabled model.

## Gap 4 (Low) — hardcoded operational models
`enhance-prompt` (both routes), `auto-train.ts:82`, `product-extract.ts:46`,
`products/text-ingest/route.ts:88`, `translate-prompt/route.ts:42` hardcode
`google/gemini-2.5-flash` / `-flash-lite`. Not merchant-selectable, so no flag
leak, but admins cannot disable or re-price them.

---

# Phase F — Merchant Active becomes a real gate

The audit above found the flag worked on the normal path but collapsed exactly
when the active list was empty. This phase makes the flag authoritative and stops
admin choices from being silently reverted.

## The rules (user-approved)

1. **At least 5 models must stay Merchant Active.** Going below is refused.
2. **The Fast / Smart / Genius presets must point at active models.** Turning one
   off is refused until another model is chosen for that preset.
3. **No hardcoded fallback catalogue anywhere.** Everything comes from the admin
   panel. A new install bootstraps from one shared seed.

Decision on a preset model: **block** (not auto-reassign) — the preset drives
billing, so swapping it silently would change what merchants are charged.

## New file: `lib/domain/model-catalog.ts`

Client-safe (no `server-only`), so the admin UI and the API routes run the *same*
function — a client guard can never be looser than the server's.

| Export | Purpose |
|---|---|
| `MIN_ACTIVE_MODELS` | `5` |
| `isActiveModel()` | `isMerchantActive === true && isDeprecated !== true` — previously copy-pasted in 4 places |
| `countActiveModels()` | — |
| `validateModelCatalog()` | Returns a `CatalogViolation` or `null` |
| `CATALOG_VIOLATION_I18N` | violation code → i18n key |
| `DEFAULT_MODELS_CATALOG`, `DEFAULT_QUICK_SETUP` | The **single** seed, now shared by both routes |

`validateModelCatalog` returns one of:
- `{ code: "too-few-active", activeCount, required }`
- `{ code: "preset-inactive", presetLabel, modelId }`

The count rule is checked first — that is the primary rule and the message the
admin needs when they hit the limit.

**Deliberately *not* a violation:** a preset whose model is missing from the
catalogue entirely. That happens when OpenRouter retires a model — not the
admin's doing — so blocking the save would punish them for someone else's change.
`QuickSetupPresets` already warns (`presets.notInCatalog`) and
`buildDynamicTierMap` already falls back.

The seed is 6 active models with all three presets inside that set — it satisfies
its own rule. (Verified: `validateModelCatalog(seed) === null`.)

## Enforcement — three toggle paths, one validator

Merchant Active is writable from three places, and all three now go through
`checkCatalog()` in the page:

| Path | File | Before |
|---|---|---|
| Catalogue table toggle | `ModelCatalogTable.tsx:149` | unguarded |
| **"Configure Model" drawer toggle** | `ModelConfigSheet.tsx:151` | unguarded — a second, easy-to-miss door |
| Delete model | `page.tsx` `confirmDeleteModel` | unguarded |

The drawer needed a new `onRequestMerchantActiveChange` prop: it only holds the
one open model, so it cannot count anything itself. The parent computes the
would-be catalogue and answers yes/no.

**Server-side is the real gate.** `POST /api/admin/ai-settings` validates the
*sanitised* list — sanitising sets `isMerchantActive: false` on deprecated
models, so a payload that looks valid can still break the rule. A 400 carries the
`violation`, and `handleSave` shows the specific reason instead of a generic
"could not save".

## Presets now only offer active models

`QuickSetupPresets` used to pass the *whole* catalogue to `ModelCombobox`, so an
admin could set Fast to a model that merchants could not even select. Now it
passes active models only — with one exception: if the *currently selected* model
is no longer active, it is kept at the top of the list so the trigger still shows
its name, plus a `presets.inactiveModel` warning. Showing a placeholder while the
preset still points at that model would be a lie on screen.

## Guarding the deprecation path

`validate-models` writes to the DB directly and cannot be blocked — OpenRouter
really did retire the model. So it now returns a `violation` field and the client
raises it as a toast. Without this, an admin whose catalogue silently dropped to
3 active models would have no way to find out.

## Two more silent-revert bugs found and fixed

Same class as the rate (Phase C) and tier (Phase D) resets — this route rebuilds
the whole value, so anything not explicitly carried over is lost.

**`fetch-models` re-enabled every disabled model.** It hardcoded
`isMerchantActive: true`, so an admin who disabled 25 of 30 models and then
clicked "Fetch Models" got all 25 back — and they went straight to merchants.
Now a `previousMerchantActive` map preserves the choice (`??`, not `||`, because
`false` is a real answer). Brand-new models still arrive active.

**`confirmDeleteModel` never rolled back.** It set state optimistically, then
showed an error toast on failure without restoring. A model could vanish from the
screen while still in the DB.

## Fallbacks removed

| Location | Before | Now |
|---|---|---|
| `api/ai-models/route.ts:12-68` | `DEFAULT_ACTIVE_MODELS`, 5 hardcoded models | deleted |
| `api/ai-models/route.ts:113` | empty active list → hardcoded list | empty stays empty |
| `api/ai-models/route.ts` catch | DB error → hardcoded list, `success: true` | `500`, `success: false` — an unknown catalogue is reported as unknown |
| `api/admin/ai-settings` GET | `length > 0` guard → an empty array showed defaults | falls back only when `models` is absent |
| `openrouter-service.ts` `getActiveMerchantModelsFromDb` | empty list → `null` | `null` = no configuration; `[]` = configured and empty. DB error → `[]` (not `null`, which would bootstrap) |
| `openrouter-service.ts` `getTrustedOpenRouterModels` | `length > 0` → fell through to the entire live OpenRouter catalogue | only `null` bootstraps |
| `openrouter-service.ts` `buildDynamicTierMap` | `models.length > 0 ? models : FALLBACK_MODELS` | uses `models` as given |

### Bootstrap, not fallback

The distinction the fix turns on:

```
no ai_credit_rules row        → seed catalogue (legitimate first value;
                                the admin's first Save creates the row)
row exists, even if empty     → that is the truth; no seed is applied
```

With `MIN_ACTIVE_MODELS` enforced, the second case can no longer be reached
through the UI, so merchants cannot be left with an empty picker by accident.

## i18n

3 new keys per locale: `catalogRules.tooFewActive`, `catalogRules.presetInUse`,
`presets.inactiveModel`. Parity **467 / 467**, zero drift. The violation object is
passed straight to `t()` as interpolation values.

## Verification
- [x] `npx tsc --noEmit` → exit 0
- [x] `validateModelCatalog` behaviour, 7/7 cases: 6 active → pass; exactly 5 →
      pass; 4 → `too-few-active`; preset off → `preset-inactive`; preset missing →
      no violation; preset deprecated → `preset-inactive`; no `quickSetup` → count
      rule only
- [x] Seed satisfies its own rule (`active = 6`, validator returns `null`)
- [x] en/bn parity 467 / 467
- [x] ESLint per-file `HEAD` vs now — no file went up:
      ai-settings route 6→6, fetch-models 7→7, validate-models 8→8,
      **ai-models 4→2**, **openrouter-service 4→3**, page.tsx 2→2,
      QuickSetupPresets 0→0, ModelConfigSheet 5→1, model-catalog.ts 0 (new)
- [x] repo-wide grep: `DEFAULT_ACTIVE_MODELS` survives only in this doc's audit
      section (historical record)
- [ ] Visual check — turn off models until 5 remain, confirm the 6th is refused
- [ ] Visual check — try to disable the Fast preset's model, confirm the message
- [ ] Visual check — disable 3 models, click "Fetch Models", confirm they stay off
- [ ] Visual check — preset dropdown lists only merchant-active models

## Still not done (deferred by the user)
**D** — `minCreditThreshold` / `defaultProvider` have no UI, `temperature` is not
editable, `isManualOverride` is not visible. **G** — the two default catalogues
disagreed (`gemini-2.0-flash-001` was `Standard` but carried 1 credit); this
phase removed the duplication as a side effect, and the values now come solely
from the seed, so that class of disagreement is gone by construction.
**H** — no column sorting, no dirty-state guard, whitelist and the 35-model cap.
**Gap 2/3/4** from the audit — billing-time catalogue validation, client-side
`FALLBACK_CHAT_MODELS`, and hardcoded operational models.

---

## Phase G — Quick Setup Presets: নিজের Save বাটন, আর Multiplier UI বাদ

(এখানের "G" বলতে এই ধাপটাকে বোঝানো হয়েছে — উপরের অডিট finding **G**-এর সাথে
এর কোনো সম্পর্ক নেই।)

### যা বদলানো হলো

| # | আগে | এখন |
|---|---|---|
| ১ | প্রিসেট কার্ডের প্রতিটি পরিবর্তন সঙ্গে সঙ্গে `settings`-এ যেত, সেভ করতে হত পেজের একদম উপরের হেডার বাটনে | সেকশনের **নিজের Save বাটন**, কার্ডগুলোর ঠিক নিচে ডান কোণে |
| ২ | "Test Chat Multiplier" ইনপুট প্রিসেট কার্ডের নিচে বসানো ছিল | UI থেকে **সম্পূর্ণ বাদ** |

### ১. আলাদা Save — কেন আর কীভাবে

হেডার বাটন পেজের একদম উপরে, অথচ প্রিসেট কার্ড তিনটা অনেক নিচে। শুধু একটা
preset বদলাতে গেলেও scroll করে উপরে উঠতে হত।

- `QuickSetupPresets` এখন নিজের **ড্রাফট** রাখে (`QuickSetupDraft`):
  `quickSetup` (তিনটা মডেল) আর `credits` (শুধু **বদলানো** মডেলগুলোর মান)।
  ⚠️ `credits`-এ সব মডেল না রেখে কেবল বদলানোগুলো রাখা হয়েছে — নাহলে সেভের
  সময় admin যা ছোঁয়ইনি তার উপরেও জোর করে মান বসে যেত।
- ড্রাফট **কেবল mount-এ seed** হয় (lazy `useState`), prop বদলালে রিসেট হয় না।
  কারণ: এই সেকশনে কিছু বদলানোর পর নিচের Catalogue-তে একটা টগল চাপলেই
  `settings` নতুন অবজেক্ট হয় — তখন ড্রাফট মুছে গেলে খেটে করা কাজ হারিয়ে যেত।
- সেভ **ব্যর্থ হলে ড্রাফট অটুট থাকে**, যাতে admin-এর পরিবর্তন হারিয়ে না যায়।
  `onSave` কেবল সত্যিকারের সফলতায় `true` ফেরত দেয়।

`page.tsx`-এ সেভের পথ একটাই — `persistSettings(next)`:

- অপ্টিমিস্টিক `setSettings(next)`, ব্যর্থ হলে `previous`-এ **rollback**
  (আগে হেডারের সেভে rollback ছিল না, তাই পর্দায় নতুন মান দেখাত অথচ DB-তে
  পুরনো মান থাকত)।
- সেভের পরে রিফেচ এখন `fetchSettings("refresh")` — আগে `"initial"` ছিল, ফলে
  সেভ করলেই পুরো পেজ unmount হয়ে "Loading…" ঝলক দিত আর admin-এর
  Search/Filter/Page সব হারিয়ে যেত। ("C" ঠিক করার সময় ReFetch-এর জন্য এই
  বাগটা সারানো হয়েছিল, কিন্তু সেভের পথে রয়ে গিয়েছিল।)
- হেডারের সেভ (`handleSave`) আর প্রিসেটের সেভ (`handleSavePresets`) — দুটোই
  এই একই ফাংশন ডাকে। `handleSavePresets` আগে `checkCatalog` দিয়ে নিয়ম
  যাচাই করে, তাই ভাঙা মানে অকারণে একটা round-trip নষ্ট হয় না।
- `checkCatalog`-এ দ্বিতীয় প্যারামিটার (`quickSetup`) যোগ হয়েছে: প্রিসেট
  সেভের সময় `settings.quickSetup` এখনো আপডেট হয়নি, তাই ড্রাফটের মানটাই
  যাচাই করতে হয় — নাহলে পুরনো মান যাচাই হয়ে ভুল উত্তর আসত।

### ২. Test Chat Multiplier বাদ

ইউজারের সিদ্ধান্ত: গুণকটার দরকার নেই — দাম বদলাতে হলে প্রিসেট কার্ডের credit
সংখ্যাটাই বদলে সেভ করবেন।

- UI থেকে ইনপুটটা তোলা হয়েছে; `aiSettings.testChatMultiplier` i18n key দুটো
  en/bn দুই জায়গা থেকেই মুছে দেওয়া হয়েছে (আর কোথাও ব্যবহৃত হত না)।
- `page.tsx`-এর `handleUpdateTestChatMultiplier` অব্যবহৃত হয়ে যাওয়ায় বাদ।
- ⚠️ **আন্ডারলাইং প্লাম্বিং ইচ্ছে করেই অটুট** — `testChatMultiplier`
  `credit-resolver` → `resolveReplyCredits` → billing পর্যন্ত পুরো পথে এখনো
  আছে, আর DB-তে মান **১**। কারণ ওটা billing path; UI তোলার সাথে সাথে ওখানকার
  হিসাব বদলানো এই ধাপের কাজ নয়। কার্ডে `effectiveCredits` এখনো
  `credits × multiplier` হিসেবেই দেখানো হয় — তাই DB-তে পুরনো কোনো মান (যেমন ২)
  পড়ে থাকলেও কার্ড কখনো মিথ্যা বলবে না ("কার্ডে ৫, কাটে ১০" ফিরে আসবে না)।

### i18n

- নতুন: `aiSettings.presets.save`, `.saving`, `.unsavedChanges`
- বাদ: `aiSettings.testChatMultiplier.label`, `.hint`
- `.sub` হালনাগাদ — এখন "সেভ করলে নিচের Catalogue-তেও একই মান বসে" বলা হয়
- parity: **468 / 468**

### Verification

- [x] `npx tsc --noEmit` — পরিষ্কার
- [x] ESLint — `page.tsx` ২টা এরর, দুটোই **pre-existing** (HEAD-এও একই ২টা ছিল:
      filter-reset effect আর initial-fetch effect)। নতুন কিছু যোগ হয়নি।
      `QuickSetupPresets.tsx` — ০
- [x] i18n key parity + কোনো stale `testChatMultiplier` key নেই
- [x] repo-wide grep: `onUpdateQuickSetup` / `onUpdateTestChatMultiplier`
      কোথাও আর অবশিষ্ট নেই
- [ ] Visual check — কার্ডের মান বদলে সেভ, তারপর Catalogue-তে গিয়ে মান মিলছে কি না
- [ ] Visual check — সেভ না করে পেজ Reload দিলে ড্রাফট হারানো (প্রত্যাশিত)
- [ ] Visual check — প্রিসেটের মডেল বদলে সেভ করলে ড্যাশবোর্ডের Fast/Smart/Genius কার্ডে সেটাই দেখানো

### এখনো বাকি

**Compare পেজের hardcoded মডেল** — সার্ভার চেইন যাচাই করা হয়েছে (৩৪ মডেল,
৫টা active; `/api/ai-models` ও `/api/models/openrouter` দুটোই ঠিক ৫টা দেয়)।
সমস্যা ক্লায়েন্টে: `useOpenRouterModels` এখনো `FALLBACK_CHAT_MODELS` দিয়ে
state শুরু করে, আর `compare` / `new` / `edit` পেজের **ডিফল্ট সিলেকশন**
`DEFAULT_MODEL_KEY` (`google/gemini-2.0-flash-001`) আর `FALLBACK_CHAT_MODELS[1]`
(`openai/gpt-4o-mini`) থেকে আসে — দুটোই merchant-active নয়। ওপরের দিকের
`gemini-2.0-flash-001` তো `DEPRECATED_MODEL_ALIASES`-এ আছে, অর্থাৎ সার্ভার
চুপচাপ একে `gemini-2.5-flash`-এ বদলে দেয় — পর্দায় এক মডেল, চলে আরেক মডেল।
প্রস্তাবিত Phase (হার্ডকড তালিকা সম্পূর্ণ বাদ + ডিফল্ট `tiers.*.modelId` থেকে)
ইউজারের অনুমোদনের অপেক্ষায়।

---

## Phase H — Configure প্যানেল পরিষ্কার, আর "Apply Changes" এখন ফাইনাল

ইউজারের অনুরোধ: Configure প্যানেলের "Max Output Tokens", "Context Window" আর
"Assigned Tier" — এই তিনটার কী দরকার; আর "Apply Changes" চাপলেই যেন সোজা
DB-তে চলে যায়, উপরের "Save" বাটনের দরকার না থাকে।

### সিদ্ধান্ত (ইউজার)

| প্রশ্ন | উত্তর |
|---|---|
| Assigned Tier dropdown | **বাদ** — credit হাতে বদলালে tier লেবেলটা মিথ্যা হয়ে যায় |
| হেডারের Save বাটন | **থাকবে** — Catalogue-র Credit ইনপুট, Merchant Active টগল আর USD→BDT রেট এখনো ওটার উপর নির্ভর করে |

দ্বিতীয় উত্তরটাই আসল সিদ্ধান্ত: হেডারের Save সরালে ওই তিনটা কন্ট্রোল নীরবে
সেভ হওয়া বন্ধ করে দিত (তিনটাই কেবল লোকাল state-এ লেখে — `handleUpdateCreditCost`,
`handleToggleMerchantActive`, `handleUpdateUsdToBdtRate`)। তাই Save থাকল,
আর Drawer-এর Apply আলাদাভাবে ফাইনাল হল।

### কী বদলাল

**`components/admin/ai-settings/ModelConfigSheet.tsx`**

| আগে | এখন |
|---|---|
| "Assigned Tier" Select (Economy 1 / Standard 3 / Premium 5) | বাদ |
| `handleTierChange` + `TIER_TO_MODEL_TIER` + `getCreditCostByTier` import | বাদ |
| "Max Output Tokens" ইনপুট | বাদ |
| "Context Window" ইনপুট | বাদ |
| `tierHint` প্যারাগ্রাফ | বদলে `creditHint` |
| `onSave: (m) => void` | `onSave: (m) => Promise<boolean>` |
| Apply চাপলেই প্যানেল বন্ধ | সেভ **সফল হলেই** বন্ধ; ব্যর্থ হলে খোলা থাকে |
| Apply বাটনে কোনো স্টেট নেই | সেভের সময় `Loader2` স্পিনার + "সেভ হচ্ছে…", Cancel-ও disabled |

⚠️ `tier`, `contextWindow`, `maxTokens` — তিনটাই `OpenRouterModelConfig`
ইন্টারফেসে **অটুট**। UI থেকে বাদ পড়েছে, ডেটা থেকে নয়। কারণ:

- `app/api/ai-models/route.ts:71-72` → merchant-দের পেলোডে `contextWindow: m.contextWindow || 128000`, `maxTokens: m.maxTokens || 4096`
- `lib/ai/openrouter-service.ts:434` → `contextLength: m.contextWindow || 128000`
- `components/chatbots/use-openrouter-models.ts:250` → `contextLength: m.contextWindow || m.contextLength`

অর্থাৎ OpenRouter যে ডিফল্ট দেয় (`fetch-models` লেখে: `item.context_length || 128000`,
`maxTokens: 4096`) সেটাই থেকে যায়, আর হাতে বদলানোর পথ বন্ধ — ইউজার ঠিক এটাই চেয়েছেন।

**`app/(admin)/admin/ai-settings/page.tsx`**

- `persistSettings(next, options?: { silentSuccess?: boolean })` — Drawer থেকে
  ডাকলে সাধারণ "সেভ হয়েছে" টোস্ট চাপা পড়ে, কারণ Drawer মডেলের নাম ধরে নিজের
  বার্তা (`toasts.configUpdated`) দেখায়। একই খবর দুইবার নয়।
- `handleUpdateModelConfig` এখন `async (m) => Promise<boolean>`:
  ১) পুরো তালিকায় মডেলটা বসায়, ২) `checkCatalog(updatedModels)` — Drawer-এর
  Merchant Active টগলটাও active সংখ্যা বদলাতে পারে, তাই একই গার্ড,
  ৩) `persistSettings(..., { silentSuccess: true })`, ৪) সফল হলে
  `toasts.configUpdated`।
- `handleSave` (হেডার) আগের মতোই আছে — `persistSettings(settings)`।

⚠️ ফলাফল: হেডারে অসেভ করা পরিবর্তন (যেমন Catalogue-র কোনো Credit) থাকা অবস্থায়
Drawer-এ Apply চাপলে সেটাও সঙ্গে চলে যায়, কারণ পুরো `settings` অবজেক্টটাই
পাঠানো হয়। এটা ডেটা-লস নয় (ওই মান তো সেভ হবেই ছিল), শুধু admin হয়তো আগে
ভাবতে পারেননি যে Drawer-এর Apply তাকেও সেভ করে দিচ্ছে।

**i18n (en/bn দুটোই)**

- বাদ: `configSheet.assignedTier`, `tierHint`, `tierEconomy`, `tierStandard`,
  `tierPremium`, `maxTokens`, `contextWindow`
- `creditParamsTitle` → **`creditTitle`**, মান "Credit Cost & Parameters" →
  "Credit Cost" (Parameters আর নেই, তাই নামটাও আর সত্যি নয়)
- যোগ: `creditHint`, `applying`
- `aiSettings.save` / `aiSettings.saving` **থাকল** — হেডারের বাটন তো থাকছেই

### Verification

- [x] `npx tsc --noEmit` — পরিষ্কার
- [x] i18n key parity **463 / 463**, `configSheet` দুই ভাষায় হুবহু একই আকৃতি
- [x] repo-wide grep — `creditParamsTitle`, `assignedTier`, `tierHint`, `tierEconomy`,
      `tierStandard`, `tierPremium`, `configSheet.maxTokens`, `configSheet.contextWindow`
      কোথাও আর অবশিষ্ট নেই
- [x] ESLint — ৩টা এরর, তিনটাই **pre-existing**। `git stash` করে HEAD-এ চালিয়ে
      প্রমাণ করা হয়েছে: HEAD-এও ঠিক একই ৩টা ছিল (`page.tsx` filter-reset effect
      ও initial-fetch effect, `ModelConfigSheet` prop→state effect)। নতুন কিছু যোগ হয়নি।
- [ ] Visual check — Drawer-এ এখন কেবল Pricing, Merchant Active, Credit — তিনটাই
- [ ] Visual check — Credit বদলে Apply চাপলে Catalogue-তে সঙ্গে সঙ্গে মান বদলায়, ড্রয়ার বন্ধ হয়
- [ ] Visual check — নিয়ম ভাঙার চেষ্টা (৫-এর নিচে নামানো) → এরর টোস্ট + ড্রয়ার **খোলা থাকে**
- [ ] Visual check — হেডারের Save আগের মতোই কাজ করে (Catalogue-র Credit ইনপুট, Merchant Active, USD রেট)

---

## Phase I — হেডারের তিনটা বাটনের বাগ: এক একটা করে সারানো

Phase H-এর পর হেডারের `Validate Status` / `Fetch OpenRouter Models` / `ReFetch`
— এই তিনটা বাটন পড়ে যে সমস্যাগুলো পাওয়া গেল, সেগুলোই এই পর্বে সারানো হয়েছে।
ক্রমটা ইচ্ছাকৃত: আগে ডেটা-ধ্বংসের পথ বন্ধ, তারপর রেস, তারপর UX।

### বাগ ১ — 🔴 `Validate Status` পুরো ক্যাটালগ মুছে দিতে পারত

`validate-models/route.ts` OpenRouter-এর উত্তরের উপর **কোনো যাচাই ছাড়াই**
`liveModelIds` বানাত। OpenRouter ২০০ ফেরত দিয়ে খালি বা অসম্পূর্ণ `data` দিলে
প্রতিটি মডেল deprecated হয়ে DB-তে লেখা হয়ে যেত — এক ক্লিকে merchant
ড্যাশবোর্ড শূন্য। আর ফেরানোর উপায়ও ছিল না: তখন `isMerchantActive`-ও জোর করে
`false` করা হত, অথচ UI deprecated মডেলের টগল বন্ধ রাখে।

**সমাধান:** লেখার আগে তিনটা প্রবেশদ্বার — খালি তালিকা, অসম্পূর্ণ তালিকা
(`liveModelIds.size < currentModels.length`), এবং সব মডেল একসাথে deprecated।
যেকোনোটায় ধরা পড়লে **কিছুই লেখা হয় না**, বরং `code` সহ 502 ফেরত যায়।
ক্লায়েন্ট কোড দেখে নিজের ভাষায় কারণটা বলে (`VALIDATE_ABORT_I18N`)।

এর সঙ্গে `isDeprecated → isMerchantActive: false` স্যানিটাইজারটা দুই জায়গা
থেকে (GET ও POST) তুলে দেওয়া হয়েছে। লুকানোর কাজটা `isActiveModel` একাই করে,
আর `isMerchantActive` ছিল admin-এর নিজের সিদ্ধান্ত — deprecation এখন
**উল্টানোযোগ্য**।

### বাগ ২ — 🔴 `Fetch OpenRouter Models` ক্যাটালগ থেকে মডেল নীরবে মুছে দিত

`topModels = filteredRaw.slice(0, 35)` — আর ওটাই পুরো ক্যাটালগ হয়ে যেত।
সাজানো বর্ণানুক্রমে হওয়ায় এটা নিয়মিত ঘটত: নতুন কয়েকটা `anthropic/…` ঢুকলেই
পিছন থেকে সমসংখ্যক `openai/…` বাদ পড়ে যেত। সাথে যেত তার credit, tier আর
Merchant Active। পরে মডেলটা আবার তালিকায় ফিরলে `isMerchantActive: true`
পেয়ে **নিজে থেকেই চালু** হয়ে যেত।

**সমাধান:** `carriedOver` — যে মডেলগুলো fresh লিস্টে নেই সেগুলো হুবহু আগের মতো
ধরে রাখা হয়। এখন এই route-এর কাজ কেবল **দাম হালনাগাদ করা আর নতুন মডেল যোগ করা**;
সত্যিই উঠে যাওয়া মডেল চিহ্নিত করার একমাত্র জায়গা `Validate Status`।
`?` টোস্টে জানানো হয় কতগুলো ধরে রাখা হয়েছে (`toasts.fetchSuccessKept`)।

### বাগ ৩ — 🟠 DB পড়তে ব্যর্থ হলে পেজ বানানো ডেটা দেখাত

GET-এর `catch` ব্লক `DEFAULT_AI_SETTINGS` ফেরত দিত **২০০ স্ট্যাটাসে**। ক্লায়েন্ট
"DB-র নিয়ম" আর "পড়তে ব্যর্থ হয়ে ডিফল্ট" — পার্থক্য করতেই পারত না; admin
স্বাভাবিক পেজ দেখে Save চেপে আসল নিয়মগুলো ডিফল্ট দিয়ে চাপা দিতেন।

**সমাধান:** ৫০০ + বার্তা। পেজে আলাদা এরর-স্ক্রিন ও Retry বাটন।

### বাগ ৪ — 🟠 কোনো mutual exclusion ছিল না

চারটা অপারেশন — Save, ReFetch, Fetch, Validate — সবগুলোই পুরো
`ai_credit_rules` লেখে বা তার উপর ভিত্তি করে সিদ্ধান্ত নেয়। অথচ প্রতিটি বাটন
কেবল **নিজের** লোডিং state দেখত। ফলে Save চলাকালীন Validate চাপা যেত, বা
Validate আর Fetch একসাথে — এবং last-writer-wins: Validate-এর deprecated করা
মডেল Save-এর পুরনো কপিতে আবার জীবিত হয়ে উঠত।

**সমাধান:** `busyRef` (`useRef<boolean>`) — state নয়, কারণ ক্লিক-হ্যান্ডলারের
ভেতরে state এখনো আগের রেন্ডারের মান ধরে রাখে, তাই দ্রুত দুইবার চাপলে গার্ডটা
ফাঁকা দিয়ে যেত। হেডারে `const busy = validating || fetching || saving || refreshing;`
— একটা চললে চারটাই বন্ধ।

⚠️ এর সঙ্গে যে বাগটা ধরা পড়ল: `handleValidateModels`-এর `finally`-তে
`busyRef.current = false` **লেখাই ছিল না** (সফল পথটা `return` দিয়ে শেষ হয়)।
একবার Validate চাপলে সব বাটন চিরতরে লক হয়ে যেত — পেজ রিলোড ছাড়া উপায় নেই।

### বাগ ৫ — 🟠 অসেভ করা সম্পাদনা নীরবে হারাত

ReFetch / Fetch / Validate — তিনটাই `settings`-কে DB-র মান দিয়ে প্রতিস্থাপন
করে। Catalogue-র Credit ইনপুটে লিখে (Save না চেপে) ওগুলোর যেকোনোটা চাপলে
লেখাটা কোনো সতর্কবার্তা ছাড়াই উবে যেত।

**সমাধান:** `savedSnapshot` (GET-এর উত্তরের JSON) বনাম `settings` মিলিয়ে
`isDirty`; আর `flushPendingEdits()` — তিনটা হ্যান্ডলারের শুরুতে ডাকা হয়,
পরিবর্তন থাকলে আগে সেভ করে। সেভ ব্যর্থ হলে অপারেশনটাই চলে না (কারণ টোস্টে
আগেই দেখা গেছে)। পাশাপাশি Save বাটন এখন `disabled={busy || !dirty}` — অর্থাৎ
**কিছু বদলানো না থাকলে সেভ বাটন নিষ্ক্রিয়**, আর বদল থাকলে হালকা রিং।

### বাগ ৬ — 🟠/🟡 আরও কয়েকটা ছোট জিনিস

| কী | আগে | এখন |
|---|---|---|
| `isManualOverride` client-merge | সার্ভারের উত্তরের উপর হাতে credit ফিরিয়ে আনা হত | সার্ভার নিজেই রক্ষা করে → merge তুলে দেওয়া; কেবল DB থেকে আবার পড়া হয় |
| `GET` export on `validate-models` | একটা GET যেটা DB-তে লেখে (crawler/prefetch-এ চলত) | মুছে দেওয়া |
| `revalidate: 3600` | এক ঘণ্টায় Fetch বারবার চাপলে হুবহু একই ক্যাশ — বাটনটা নিষ্ক্রিয় মনে হত | `300` (৫ মিনিট) |
| `quickSetup` যাচাই | fetch-এর পর যাচাই হত না | `validateModelCatalog` চলে, ফলাফল টোস্টে |
| Drawer-এর deprecation | Table-এ টগল বন্ধ, Drawer-এ খোলা | দুই জায়গায় একই নিয়ম + কারণ লেখা |
| Table-এর deprecated টগল | হার্ডকড `checked={false}` — admin-এর চালু রাখা সেটিং "বন্ধ" দেখাত | আসল মান দেখায়, কেবল নড়ানো যায় না |
| Drawer-এ Cancel → একই Model আবার খোলা | বাতিল করা মানটাই ফিরে আসত (`useEffect([model])` একই রেফারেন্সে চলে না) | খোলার মুহূর্ত ধরে ফর্ম নতুন করে বসে |
| Drawer সেভ চলাকালীন বন্ধ | বাইরে ক্লিক/Esc-এ বন্ধ হয়ে যেত, ফল দেখার আগেই | সেভ শেষ না হওয়া পর্যন্ত বন্ধ হয় না |
| `useCallback` (নতুন তিনটা) | React Compiler "memoization ধরে রাখা গেল না" বলে পুরো কম্পোনেন্ট অপ্টিমাইজ করা ছেড়ে দিত | প্লেইন ফাংশন — hook-dep কোথাও যায় না |

**i18n (en/bn দুটোই)** — যোগ: `loadErrorTitle`, `retry`, `busyHint`,
`unsavedHint`, `configSheet.deprecatedTitle`, `deprecatedSwitchHint`,
`deprecatedHint`, `toasts.fetchSuccessKept_one/_other`,
`toasts.validateAbortedEmpty`, `validateAbortedIncomplete`, `validateAbortedAll`

### Verification

- [x] `npx tsc --noEmit` — পরিষ্কার
- [x] i18n key parity **475 / 475**; ai-settings-এ ব্যবহৃত **116টি key**-ই দুই
      ভাষায় আছে (স্ক্রিপ্টে ব্যবহার-তালিকা বের করে যাচাই)
- [x] ESLint (client) — **2** এরর, দুটোই pre-existing (HEAD-এও একই দুইটা
      `react-hooks/set-state-in-effect`)। `ModelConfigSheet` HEAD-এর 1 error +
      4 warning → **0**.
- [x] ESLint (API routes) — **18**; HEAD-এ ছিল **21**। `no-explicit-any`
      বাড়েনি — নতুন `StoredModel` ইন্টারফেস ও `isStoredModel` type-guard
      দিয়ে উল্টে ৩টা কমেছে।
- [x] `validate-models`-এ কোনো GET caller নেই (repo-wide grep) — export মোছা নিরাপদ
- [ ] Visual — Validate চলাকালীন বাকি তিনটা বাটন নিষ্ক্রিয়
- [ ] Visual — Credit বদলে (Save না চেপে) ReFetch চাপলে মানটা হারায় না
- [ ] Visual — deprecated মডেলের Drawer-এ টগল বন্ধ + লাল নোটিস
- [ ] Visual — DB বন্ধ থাকলে এরর-স্ক্রিন + Retry (বানানো ডেটা নয়)
