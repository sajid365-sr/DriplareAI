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


## Phase C — Information architecture

The five tabs answer three real questions, and two of them are already answered
better elsewhere.

| Old tab | Where it goes | Why |
| --- | --- | --- |
| Analytics | `/dashboard/analytics` | the dashboard-wide page already exists |
| Chat | **Playground** | the page itself |
| Compare | **inside Playground** | comparing models only makes sense while configuring one |
| Settings | **inside Playground** | the agent's own settings, next to the agent |
| E-commerce | **Settings** section | it is agent configuration, not a peer of it |

Retired routes are deleted, not left as stubs, **except** where a redirect is the
only way an existing link keeps working. `/chat` → `/playground` is one; the
already-shipped `sources/`, `integrations/` and `activity/` stubs are the others.

### What must be moved before it is deleted

Two `_components` folders are shared, so deleting their route would delete a
feature that lives elsewhere:

| Folder | Imported by |
| --- | --- |
| `activity/_components` (7 files) | `inbox/_components/InboxLayout.tsx`, `inbox/_components/useInboxActions.ts`, `leads/page.tsx`, `components/crm/CustomerCrmDrawer.tsx` |
| `sources/_components` (11 files) | `knowledge-base/_components/ContentTrainingSection.tsx` |

They move to the page that owns them today (`inbox/`, `knowledge-base/`), and the
imports are updated in the four/five call sites listed above. Move first, delete
second, in that order.

### The sidebar becomes three items

Playground · [whatever the agent's other real surface is] · Settings — matching
the tabs that survive. The per-agent nav also needs the **mobile tab strip that
does not exist today**: both sidebars are `hidden md:flex` and neither
`app/(dashboard)/layout.tsx` nor `DashboardHeader` renders a mobile counterpart,
so on a phone the per-agent tabs are currently unreachable. The pattern to copy
already exists at
`chatbots/[chatbotId]/activity/_components/live-inbox-header.tsx` (a
`md:hidden` disclosure that lists its tabs).

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

Phases C–D also re-run the list above, plus:

- [ ] Locale diff is a pure insertion, line endings preserved, `en`/`bn` key
      parity holds (a key present in one file and absent in the other falls back
      to the English literal inside `t()`, so it fails silently, not loudly)

