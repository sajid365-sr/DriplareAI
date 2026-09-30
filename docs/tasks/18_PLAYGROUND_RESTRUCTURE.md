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


## Phase D — The page itself

Two panes: configuration on the left, a live tester on the right, so a change can
be tried without leaving the page.

- Save becomes **dirty-aware** — the button reflects whether anything changed,
  instead of being always-enabled
- The remaining hardcoded palette colours and the hardcoded Bengali string
  (`⚡ আমাকে টেস্ট করুন!`, `playground/page.tsx:209`) are removed; all copy goes
  through `chatbots.json`
- Settings and E-Commerce tabs get their i18n pass

### Carried over from Phase B — hardcoded colours in `ChatbotRow.tsx`

Phase B was naming only, so these were deliberately left alone rather than swept
into a rename commit. They need tokens from `globals.css`, not a palette class:

| Line | Colour | Should be |
| --- | --- | --- |
| 100 | `to-fuchsia-500` on the avatar gradient | `--primary` → `--accent`, or drop to one token |
| 170 | `bg-amber-500/10 text-amber-600` (Paused badge) | `--warning` |
| 175 | `bg-emerald-500/10 text-emerald-600` (Active badge) | `--success` |
| 186–187 | `focus:text-emerald-700` / `focus:text-amber-700` | the same tokens |
| 229 | `text-violet-500` (Open Playground icon) | `--primary` |
| 239 | `text-sky-500` (Analytics icon) | `--info` |

The platform brand colours in `PLATFORM_ICONS` (Facebook `#1877F2`, WhatsApp
`#25D366`, …) are **not** part of this — they are third-party marks and must stay
as they are.

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

