# Task 18: Playground Restructure

Branch: `feature/chatbot-creation-ux` (same branch as
[17_CHATBOT_CREATION_UX.md](17_CHATBOT_CREATION_UX.md); nothing is pushed to `dev`)

## Objective

`/dashboard/chatbots/[id]/chat` is the page a merchant lands on after creating an
agent, and it is called three different things in three places:

| Where | What it says |
| --- | --- |
| URL | `/…/chat` |
| Sidebar | "Chat" |
| Breadcrumb | "Playground" |
| H1 | "Chat Playground" |

Underneath sits a second problem: the per-agent sidebar offers five tabs
(Analytics, Chat, Compare, Settings, plus routes that only redirect), and four of
them are either duplicates of a dashboard-wide page or a redirect stub.

Three phases, strictly in order. Phase A is already done and is recorded in
[17](17_CHATBOT_CREATION_UX.md#phase-3e--the-gate-moved-from-the-model-to-the-mode)
as Phase 3e, because it was plan gating rather than navigation.

## Phase A — Simple/Pro gating ✅ (done, see task 17 §Phase 3e)

The plan fence moved off individual models and onto the mode. Starter gets Simple
(Guided) only; every paid plan gets Simple + Pro over every model the admin has
left Merchant Active. `allowedPlans` and its admin UI are gone end to end.

## Phase B — One name: Playground ✅

The route was renamed and every surface now agrees.

| File | Change |
| --- | --- |
| `…/[chatbotId]/chat/` | → `…/[chatbotId]/playground/` (folder rename) |
| `…/[chatbotId]/chat/page.tsx` | → `…/playground/page.tsx`, plus the H1/copy |
| `components/layout/Sidebar.tsx` | `botItems`: label and href |
| `components/layout/dashboardHeader.tsx` | `TAB_LABELS` — was hardcoded English, now `TAB_LABEL_KEYS` → `bot.*` |
| `components/dashboard/BotSwitcher.tsx` | default `subPath` |
| `components/layout/FloatingBubbles.tsx` | the `includes("/chat")` check |
| `components/chatbots/create-agent-dialog.tsx`, `…/ChatbotRow.tsx` (×2), `compare-header.tsx` | the four `router.push("…/chat")` call sites |
| `public/locales/{en,bn}/common.json` | `bot.chat` |
| `…/[chatbotId]/chat/page.tsx` (redirect) | **new** — `/chat` → `/playground`, so old links and bookmarks still land |

`dashboardHeader`'s tabs were the last place a label was decided in code rather
than in a locale file, so the breadcrumb read "Playground" in English for a BD
merchant whose sidebar said "চ্যাট" — two names for the same page, one of them
untranslatable. The key map is what removes that class of bug rather than this
instance of it.

**Do NOT rename `/api/chatbots/[chatbotId]/chat`.** The n8n workflows call the
route by path (`docs/n8n-JSON/`), and those JSONs are imported by hand on the VPS
— renaming it would break live Facebook/WhatsApp replies with no compile error
anywhere to warn us. The UI route and the API route are allowed to disagree about
this word; the reason is written at the route.

### Rename mechanics

`playground/` already existed (holding a temporary one-line re-export while the
move was pending), so **`mv chat playground` would have nested the old folder
inside the new one** — `playground/chat/`. The sequence actually used was:

```sh
cd "app/(dashboard)/dashboard/chatbots/[chatbotId]"
mkdir -p playground/_components
git mv chat/_components/* playground/_components/
rmdir chat/_components
rm playground/page.tsx                       # drop the temporary re-export
git mv chat/page.tsx playground/page.tsx
# then write the redirect stub into a new chat/page.tsx
```

The temporary re-export existed so `/playground` never 404'd at any point during
the move; it was removed the moment the real page could take its place.


## Phase C — Information architecture ✅

### The plan's premise was wrong, and that changed the answer

This section originally said Analytics moves to `/dashboard/analytics`, "the
dashboard-wide page already exists". **There is no `/dashboard/analytics`.** What
exists is `/dashboard/overview`, which is *account*-level — its own page, its own
`/api/analytics/overview`, no per-agent filter anywhere. So the per-agent
Analytics page was not a duplicate of anything; deleting it would have removed a
feature and called it tidying.

The original complaint was five tabs where some were duplicates or redirects.
Measured against the code, the duplicates were Compare (same job as configuring a
model) and the retired redirects — not Analytics. So Analytics keeps its own tab.

| Old tab | What it actually was | Where it went |
| --- | --- | --- |
| Playground | the page | stays, now first in the nav |
| Analytics | a real page (93 lines, 4 components, `/api/chatbots/[id]/analytics`) | **stays as its own tab** |
| Compare | a real page (342 lines) | `/playground/compare` |
| Settings | a real page (128 lines: name, avatar, delete) | stays, now last |
| E-commerce | a real page (446 lines) that **nothing linked to** | folded into Settings |
| `edit/` | a real page (294 lines) that **nothing linked to** | deleted |
| `activity/`, `sources/`, `integrations/` | already redirect stubs | kept as redirects |

The per-agent nav is now three items, and it is **defined once** in
`components/layout/bot-nav.ts` — the sidebar and the mobile strip both read it, so
they cannot drift. Compare is deliberately not in it.

### Deleted, and why each was safe

- **`edit/`** — an early one-shot prototype: name + model + source upload in a
  single submit. Playground owns name/model, Knowledge Base owns training, and it
  uploaded through the very components the Sources page used. Unreachable from
  anywhere in the product.
- **`e-commerce/`** — reachable only by typing the URL. Its form now lives at
  `settings/_components/EcommerceSection.tsx` and renders inside the agent's
  Settings page. **The API route `/api/chatbots/[chatbotId]/e-commerce` is
  untouched** — that is the data address n8n sees; only the UI address moved.

Two Save buttons on the Settings page is deliberate: the e-commerce section writes
to a different resource (`POST …/e-commerce`) than the name/avatar card
(`PUT …/chatbots/[id]`). One button for both would re-send courier keys to change
a name, and would report one failure for two writes.

### Kept: the redirect stubs

`chat/`, `compare/`, `activity/`, `sources/`, `integrations/` are each a
20-line redirect. They were kept because deleting a redirect cannot fix anything —
it only turns a working bookmark into a 404. `/compare` now points at
`/playground/compare`.

### What had to move before anything could be deleted

Both `_components` folders were shared, so deleting their route would have deleted
a feature that lives elsewhere. Moved first, imports updated after:

| Folder | Moved to | Call sites updated |
| --- | --- | --- |
| `activity/_components` (7 files) | `inbox/_components/` | `InboxLayout.tsx`, `useInboxActions.ts`, `leads/page.tsx`, `components/crm/CustomerCrmDrawer.tsx` |
| `sources/_components` (11 files) | `knowledge-base/_components/` | `ContentTrainingSection.tsx` |

Every internal import in both folders was already relative (`./message-bubble`,
`../chat-history/…`), so the moves needed no edits inside the folders themselves —
only the 11 external import lines.

### Compare needed an entry point, or it became the bug just deleted

Removing Compare from the sidebar left `/playground/compare` with no link to it —
exactly the orphaned-page situation that let `edit/` and `e-commerce/` rot. So the
Playground header gained a "Compare models" button (`data-testid="open-compare"`),
which Phase D can restyle into whatever the two-pane layout calls for.

### The breadcrumb, and why `/playground/compare` shows "Playground"

`DashboardHeader` derives the tab from the **first** segment after `chatbotId`, so
`/playground/compare` lights up Playground and reads "Playground" in the
breadcrumb. That is correct: Compare is inside Playground now, not a peer of it.

`TAB_LABEL_KEYS` was cut from nine entries to the three that can actually render.
A redirect never renders, so the other six could never be looked up; an unlisted
segment falls back to the raw segment text, which is what makes a genuinely new
route visible. The six now-dead `bot.*` keys were removed from both `common.json`
files. (`bot.liveChat` was already dead before this task and was left alone.)

### The mobile strip, and the bigger gap behind it

`BotTabStrip` (`md:hidden`) now renders in `app/(dashboard)/layout.tsx` on agent
pages. Both sidebars are `hidden md:flex`, so before this a phone had **no way at
all** to reach Analytics, Playground or Settings from an agent page.

It is a scrollable pill row rather than the dropdown in `live-inbox-header.tsx`
(which this plan originally said to copy): three items fit on a phone, and a row
is one tap where a dropdown is two. It reuses the `KBTabs` visual language.

⚠️ **Not fixed, and bigger than this phase:** the *main* dashboard nav is also
unreachable on mobile. `DashboardHeader` has no hamburger and `FloatingBubbles` is
only support widgets — so on a phone there is no route to Overview, Inbox, Agents,
Knowledge Base or Settings either. That needs a mobile drawer in the header, which
is its own piece of work and is not part of the Playground restructure.

### Dead code found while moving

`chat-history-tab.tsx`, `sources-summary-card.tsx` and the four files under
`chat-history/` are exported but imported by nothing. They were already
unreachable before this phase — the Knowledge Base has four tabs (FAQs, Sample
Replies, Content Training, Auto-Train) and none of them is chat history, so the
Facebook chat-history ingestion UI has no surface at all.

They were **moved rather than deleted**, because unlike `edit/` this is real,
working functionality that lost its page: either it gets re-attached to the
Knowledge Base's Content Training tab, or it is deleted on purpose. That is a
product decision, not a cleanup, so it is left open.

## Phase C.5 — The four follow-ups ✅

The open questions Phase C left behind, decided by the product owner.

### 1. The chat-history code was deleted

Decision: **not needed, delete it.** `tabs/chat-history-tab.tsx`,
`chat-history/{chat-history-uploader,csv-template-card,fb-conversation-picker,fb-download-guide}.tsx`
and `sources-summary-card.tsx` — six files, all gone.

Verified dead before deleting: `ChatHistoryTab` was imported by nothing, and the
four files under `chat-history/` were imported only by `ChatHistoryTab`. So the
whole branch was reachable from nowhere, not just unused. The Knowledge Base's
`index.ts` barrel did not reference any of them, so nothing else needed editing.

### 2. Mobile navigation

Both sidebars were `hidden md:flex` and `DashboardHeader` had no hamburger, so on
a phone **the entire app nav was unreachable** — Overview, Inbox, Leads, Products,
Orders, Couriers, Discounts, AI Agents, Knowledge Base, Automations, Platforms,
Usage, Settings, Billing. Phase C fixed only the per-agent tabs (`BotTabStrip`);
this is the layer above.

The drawer does **not** re-declare the nav list. It renders `<Sidebar mobile />` —
the same component, same arrays, same active logic — inside a slide-in panel:

| Piece | What it does |
| --- | --- |
| `Sidebar` gained a `mobile` prop | swaps the `hidden md:flex fixed top-16 w-60` shell for `flex h-full w-full`, hides the collapse toggle, and forces `effectiveCollapsed = false` |
| `components/layout/MobileNavDrawer.tsx` | backdrop + spring slide-in, Escape to close, `role="dialog"` `aria-modal` |
| `dashboardHeader` gained `onOpenNav` | an `md:hidden` hamburger at the far left |
| `app/(dashboard)/layout.tsx` | owns `navOpen`, and closes it on every pathname change |

Two decisions worth recording:

- **`effectiveCollapsed = false` in the drawer.** Sub-pages auto-collapse the
  desktop sidebar, so without this the drawer would open on `/dashboard/settings`
  as a column of unlabelled icons.
- **The bot sidebar is not rendered in the drawer.** `BotTabStrip` already covers
  those three tabs on mobile, and showing them twice is noise.

The drawer renders a **second** `Sidebar`, so its `data-testid` is
`sidebar-main-mobile` rather than `sidebar-main` — otherwise at mobile width two
elements would carry the same test id, since the desktop one is still in the DOM
(hidden by CSS, not unmounted).

### 3. `bot.liveChat` was deleted

Confirmed dead: defined in both `common.json` files, referenced by no code.

### 4. E-commerce removed from the agent entirely

Decision: **remove it completely, along with its API.**

The two halves of `EcommerceSection` had different answers, which is why this
needed asking rather than obeying:

| Part | Was it duplicated elsewhere? |
| --- | --- |
| Delivery courier (Steadfast, Pathao) | **Yes** — `/dashboard/settings/couriers` is richer (adds RedX, Pathao username/password/store ID) and is the one the live order pipeline actually calls |
| Google Sheet URL | **No** — nothing else set it |

And the sheet URL could not simply be dropped: the live n8n brain reads it.
`docs/n8n-JSON/Core-AI-Brain.json` line 35 joins `ecommerce."EcommerceConfig"`
and selects `ec."productSheetUrl", ec."productSheetName"`. Deleting it with no
destination would have silently disabled product lookup for every merchant — no
error anywhere.

Removed: `settings/_components/EcommerceSection.tsx`,
`app/api/chatbots/[chatbotId]/e-commerce/route.ts`, the `ecommerce.*` locale keys
both files, and the section from the Settings page.

⚠️ **Deliberately NOT removed, and this matters:**

- `prisma/schema/merchant.prisma` still declares `EcommerceConfig` and the
  `Chatbot.ecommerceConfig` relation. The n8n query joins that table — dropping
  it would turn a working `LEFT JOIN` into a hard SQL error, and the n8n JSONs
  are imported by hand on the VPS, so the fix would not be a deploy away.
- `EcommerceConfig`'s other columns (order sheet, courier keys) were already
  write-only — nothing in the app or n8n read them. With the API gone they simply
  stop being written. Existing rows keep their data.
- `prisma db push` was not run, per the standing rule: it would drop the live
  `n8n_chat_histories` chat-memory table.

Net effect on production: the sheet URLs already stored keep working (n8n still
reads them); merchants simply have no UI to change them any more.

### Found while building the drawer: a second, dead sidebar

`components/sidebar.tsx` (lowercase) is imported by nothing. It is an early
prototype with its own mobile mechanism (`isMobile` via a resize listener, a
`fixed inset-0 z-40` backdrop, a floating open button) and its own nav list —
whose first entry points at `/dashboard/billing`, a route that does not exist.

It was **not** deleted here, because it is outside this phase's scope and
deleting a 200-line component unasked is not cleanup. But it is a trap: it looks
like the thing to import when you want a mobile sidebar, and its stale nav list
is exactly the drift this project keeps having to fix. It should go, or be
adopted deliberately — not sit there half-alive.

### Verification — Phase C.5

- [x] `npx tsc --noEmit` — exit 0 (first run flagged the deleted route in the
      stale generated `.next/types/validator.ts`; `npm run build` regenerates it)
- [x] `npm run build` — compiled successfully, 102/102 pages, and the route list
      no longer contains `/api/chatbots/[chatbotId]/e-commerce`
- [x] `npx eslint` on every changed file — no new problems
- [ ] Manual: at 375px the hamburger opens the drawer, a tap on a link
      navigates and closes it, Escape closes it, and the per-agent tab strip
      still shows on agent pages
- [ ] Manual: `/dashboard/chatbots/<id>/settings` shows avatar, name, ID and the
      danger zone, and nothing else


## Phase D — The page itself ✅

Two panes: configuration on the left, a live tester on the right, so a change can
be tried without leaving the page. Five sub-phases, D1–D5.

### D1 — Two panes, and the tester runs saved settings

`xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]`, with the
right pane `xl:sticky xl:top-0 h-[calc(100dvh-9rem)]`.

Three decisions worth recording:

- **`minmax(0,1fr)`, not `1fr`.** A grid item's default `min-width: auto` lets the
  longest unbreakable content (the model list) push the track wider and squeeze the
  right pane. Without the `minmax(0,…)` the two-pane layout silently degrades to
  one-and-a-bit panes.
- **Breakpoint `xl`, not `lg`.** On an agent page the two sidebars take 448px, so at
  1280px the left column is ~450px — workable but tight; `2xl` gives the pane its
  full 420px. Below `xl` the right pane is `hidden` and the tester is the floating
  widget again (`xl:hidden`), which is the same CSS-only duplication the Sidebar and
  `BotTabStrip` already use.
- **Two live `ChatPreview` instances.** Both are mounted; only one is displayable.
  Each therefore gets its **own** end-ref (`messagesEndRef` for the widget,
  `paneMessagesEndRef` for the pane) — one shared ref would attach to whichever
  rendered last and leave the other pane unscrolled. `scrollIntoView` on a
  `display:none` element is a harmless no-op, so the same effect can call both, and
  `block: "nearest"` keeps it from yanking the outer `main` scroller.

The tester reads model, temperature and prompt **from the database** — the chat API
has no idea what is sitting unsaved in the browser. So a merchant could change a
setting, hit the tester, see the old behaviour and conclude the change did nothing.
The notice strip (`data-testid="saved-settings-notice"`) states this, and turns
`border-warning/40 bg-warning/10` exactly when the page is dirty — the moment it
actually matters.

### D2 — Dirty-aware Save

The button was always enabled and always read "Save Changes", so every visit looked
like it had unsaved work. Now:

| State | Look |
| --- | --- |
| clean | `bg-muted text-muted-foreground`, `disabled`, check icon, "Saved" |
| dirty | `bg-brand-gradient`, enabled, save icon, "Save Changes" |

Dirtiness is `stableStringify(savableSnapshot(bot)) !== baseline`, where `baseline`
is set on load and again **only on a successful save** — a failed save leaves the
page dirty, which is correct, because the database still holds the old row.

Two subtleties:

- **`stableStringify` sorts object keys.** Plain `JSON.stringify` compares key
  *order*, and `wizardData` nested objects arrive from the API and from the wizard
  with orders that need not match. Without sorting, the page reads "unsaved" the
  instant it loads and the button is perpetually enabled — the exact bug being fixed.
- **`savableSnapshot` lists the fields `saveSettings` actually sends**, rather than
  the whole `bot`. `_count`, `createdAt` and friends never change, and anything added
  to `bot` later would otherwise mark the page dirty for free.

### D3 — Remaining hardcoded palette colours

`ChatbotRow.tsx` (the table carried over from Phase B) plus three files this phase
turned up: `SystemPromptGuide.tsx`, `BotSwitcher.tsx`, `MetricsBar.tsx`,
`analytics/StatsCards.tsx`, `analytics/RecentSessions.tsx`,
`playground/chat-bubble.tsx`, `playground/compare/*`.

The avatar gradient is now `bg-brand-gradient` rather than `from-violet-500
to-fuchsia-500` — the same violet→indigo ramp as the rest of the product, instead of a
second gradient that happened to look similar.

**Kept deliberately:** the platform brand colours in `RecentSessions.tsx`'s
`getPlatformIcon` (Facebook `#1877F2`, WhatsApp `#25D366`, Telegram sky) and the
`text-blue-600`/`text-green-600` classes beside them. Those are third-party marks,
not our theme — tokenising them would make a Facebook logo stop looking like one.
The reasoning is written at the function so a future sweep does not "fix" it.

### Two latent bugs fixed in passing

- **`analytics/StatsCards.tsx`** — the bottom accent was
  `via-${s.color.split('-')[1]}-500/20`, a *dynamically constructed* Tailwind class.
  Tailwind v4 scans source text, so that class was never generated and the accent had
  never rendered. It is now a static `bg-gradient-to-r from-transparent via-primary/20
  to-transparent`.
- **`chat-preview.tsx`** — the training badge was written
  `t(key, "default", { count })`. i18next's string-default overload treats a third
  argument as `count` itself (`if (args[2]) ret.count = args[2]`), so `count` became an
  object and `{{count}}` rendered `[object Object]`. The options form
  (`t(key, { count, defaultValue })`) is the correct one and is what `setup-checklist.tsx`
  already used.

### D4 — i18n: Playground

`playground/page.tsx`, `chat-preview.tsx` and `chat-settings.tsx` are now fully
translated. `chat-settings.tsx` held ~20 `isBn ? "বাংলা" : "English"` ternaries —
copy decided in code, invisible to the locale files and unreachable by any
translation pass. They are gone; every string is a `t()` key with the English text as
its inline default.

Two things deliberately **not** translated:

- **The quick-test chips' `text` field.** Only the chip `labelKey` is translated. The
  `text` is the prompt actually sent to the bot, so translating it would mean the
  Bengali UI tests with different questions than the English UI — the language
  setting would quietly change the experiment.
- **The tier names Fast / Smart / Genius.** Product tier names, kept English in both
  locales per AGENTS.md §4's technical-term rule, the same way "Starter" and "Growth"
  are. Only their descriptions are translated.

Also fixed: `chat_test.config.system_prompt` held Bengali text in the **English**
file, so the tab label rendered Bengali for every English user. It now reads
"System Prompt (Bot Identity & Role)".

### D5 — i18n: agent Settings

`settings/page.tsx` was entirely hardcoded English — including the delete-confirmation
body, which is the one string a merchant reads before destroying data. It is now on
the existing `bot_settings.*` keys, which already existed in both locales, so this was
a zero-regression conversion rather than new copy.

### One more dead file

`components/sidebar.tsx` (lowercase) — the prototype Phase C.5 found and flagged. It
is imported by nothing, its first nav link points at `/dashboard/billing`, a route
that does not exist, and it is exactly the shape of thing someone imports by mistake
when they want a mobile sidebar. The decision is to delete it.

### Verification — Phase D

- [x] `components/sidebar.tsx` deleted (`git rm -f`) and nothing else imports it
- [x] `npx tsc --noEmit` — exit 0
- [x] `npm run build` — compiled successfully, 102/102 static pages
- [x] `npx eslint` on every changed file, compared per-file against `git show HEAD:`
      copies — no new problems (24 errors / 16 warnings both before and after; the
      one error this phase introduced, a `react-hooks/set-state-in-effect` in
      `app/(dashboard)/layout.tsx`, was fixed by deriving `navOpen` from the
      pathname instead of setting it from an effect)
- [x] Both `chatbots.json` files parse, `en`/`bn` key parity holds (343/343),
      `common.json` too (95/95), CRLF preserved with zero lone LF
- [x] A separate commit on `feature/chatbot-creation-ux` — **never pushed**
- [ ] Manual: at `xl` the pane is sticky and scrolls independently; below `xl` the
      floating widget takes over and only one tester is ever visible
- [ ] Manual: change a setting → notice turns amber, Save turns into the gradient,
      tester still answers with the old settings; save → both revert; reload → clean


## Verification (per phase)

Phase B:

- [x] `npx tsc --noEmit` — exit 0
- [x] `npx eslint` on every changed file, compared against `git show HEAD:`
      copies — zero new problems, and `chat-settings.tsx` lost three warnings
      (the dead `Slider` import and the `sliderNum` helper it fed)
- [x] `npm run build` — compiled, 102/102 static pages, route list contains both
      `/dashboard/chatbots/[chatbotId]/playground` and `…/chat`
- [x] A separate commit per phase on `feature/chatbot-creation-ux` — **never
      pushed**
- [ ] Manual: old `/chat` links redirect, sidebar and breadcrumb both read
      "Playground", mobile tab strip reachable at 375px

Phase C:

- [x] `npx tsc --noEmit` — exit 0. The first run after deleting `e-commerce/` and
      `edit/` reported two errors, both in the *generated* `.next/types/validator.ts`
      pointing at the deleted page modules; `npm run build` regenerates that file
      and the next `tsc` run was clean. Stale generated types, not a real error.
- [x] `npx eslint` on every changed file, compared per-file against `git show HEAD:`
      copies — zero new problems, net **−3 warnings**: `Sidebar.tsx` 4err/4warn →
      4err/3warn (four now-unused lucide icon imports removed), and
      `e-commerce/page.tsx` 0err/2warn → `EcommerceSection.tsx` 0err/0warn (the
      unused `Toggle` helper). All 18 moved files: identical lint results.
- [x] `npm run build` — compiled successfully; the route list contains
      `/dashboard/chatbots/[chatbotId]/{playground,playground/compare,analytics,settings,compare,chat,activity,sources,integrations}`
      and **no** `/e-commerce` or `/edit`
- [x] A separate commit per phase on `feature/chatbot-creation-ux` — **never pushed**

Per-file comparison, not per-folder: `inbox/_components` holds 14 files against
`activity/_components`' 7, and `knowledge-base/_components` 26 against `sources`'
11, so folder totals move for reasons that have nothing to do with the move.

Locale check (applies to C–D):

- [x] Both `common.json` files and both `chatbots.json` files parse; `en`/`bn` key
      parity holds; the CRLF endings of `common.json`/`chatbots.json` are preserved
      (`admin.json` is LF — the two conventions coexist and a blanket rewrite would
      produce a whole-file diff)
- [ ] Manual: old link redirects (`/chat`, `/compare`, `/activity`, `/sources`,
      `/integrations`) all land on their new page

