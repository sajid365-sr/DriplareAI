# Comprehensive Task: Driplare AI Navigation, Sub-module Globalisation & Routing Cleanup

## Execution Safety Rule ⚠️
Ensure you are operating strictly on the `feature/ui-layout-overhaul` branch.
If not, execute: `git checkout feature/ui-layout-overhaul` before making any modifications.

---

## Technical Context & Scope
We are unifying Driplare AI into a Social Commerce OS. The main sidebar now hosts global links for `Live Inbox`, `Orders`, `Products`, `Leads`, `Knowledge Base`, `Automations`, and `Integrations`. 

We need to properly handle:
1. **Multi-Bot Scope** in global pages (`Knowledge Base` and `Integrations`).
2. **Deprecating duplicate routes** (e.g., removing the legacy Activity tab from inside specific Chatbots and redirecting to `/dashboard/inbox`).
3. **Micro UI polish** for sidebars and card spacing.

---

## Phase 1: Global Knowledge Base Page Refactoring (`/dashboard/knowledge-base`)

### 1.1 UI & Layout Requirements
- **Top Filter Bar**:
  - Add a **Bot Filter Dropdown** at the top right of the Knowledge Base header.
  - Options: `All Chatbots` (default) + list of user's active chatbots (e.g., `Driplare Inbox`, `Sales Bot 2`).
  - Selecting a chatbot filters the document/source list dynamically.
- **Data Table / Source List Card**:
  - Add an **"Assigned Bot" Badge** column to every knowledge source row/card.
  - Badge style: Soft purple pill background with chatbot name and icon.
- **Add New Source Modal / Button**:
  - Clicking "Add Knowledge Source" opens a modal.
  - Require a dropdown field: `Select Target Chatbot` (Default: Currently active or first bot).
  - When uploaded, the source is tagged with `botId` in Neon Postgres / Vector DB.

---

## Phase 2: Global Integrations Page Refactoring (`/dashboard/integrations`)

### 2.1 UI & Layout Requirements
- **Integration Cards (Facebook, Instagram, WhatsApp, Web Widget)**:
  - Each integration card must display connected accounts and their assigned bot.
  - Example: Under Facebook Messenger card $\rightarrow$ Shows connected Page: `Baby Mart` $\rightarrow$ Badge: `Assigned to: Driplare Inbox`.
- **Connect / Re-assign Flow**:
  - Add a quick action dropdown on connected pages/numbers: `Change Assigned Bot`.
  - Allow merchants to map specific Facebook Pages or WhatsApp numbers to specific Chatbots easily.

---

## Phase 3: Chatbot Internal Routes Cleanup (`/dashboard/chatbots/[id]`)

### 3.1 Deprecate & Redirect Legacy Activity Tab
- Remove `/dashboard/chatbots/[id]/activity` page or add a server-side redirect:
  - If a user navigates to `/dashboard/chatbots/[id]/activity`, automatically redirect (`redirect('/dashboard/inbox')`) to the new 3-column Live Inbox.

### 3.2 Update Chatbot Internal Sub-Navigation Bar
Update the internal tab header when viewing a specific bot (`/dashboard/chatbots/[id]`):
- **Tab 1: Overview & Analytics** (Metrics specific to this bot: Chat count, Handed-off chats, Token consumption).
- **Tab 2: Playground** (Interactive chat canvas to test this bot's system prompts in real time).
- **Tab 3: Settings** (System Prompts, AI Model selection like GPT-4o / Claude 3.5, Temperature, Tone).
- **Tab 4: Knowledge Base** (A shortcut view that embeds or links to `/dashboard/knowledge-base?botId=[id]`).

---

## Phase 4: UI Micro-Polishing & CSS Fixes

### 4.1 Sidebar Scrollbar Removal (`components/layout/sidebar.tsx`)
- The left sidebar currently shows an ugly native browser scrollbar.
- Add Tailwind utility class to hide scrollbars while keeping vertical scroll functionality:
  - Class: `no-scrollbar` or `[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`
- Ensure active link states (e.g., `/dashboard/knowledge-base`) highlight correctly with glowing violet background (`bg-purple-100 dark:bg-purple-900/30 text-purple-600`).

### 4.2 Card Spacing & Alignment Fixes
- **Products Catalog (`app/(dashboard)/dashboard/products/page.tsx`)**:
  - Add `pb-8` margin to the bottom container to prevent floating action widgets or system overlays (like Windows/OS alerts) from covering product card footers.
- **Header Breadcrumbs**:
  - Ensure the top navigation bar displays clear context breadcrumbs (e.g., `Commerce OS > Knowledge Base`).

---

## File Modification Checklist 📁
- [ ] `components/layout/sidebar.tsx` (Scrollbar hide fix & active link highlights)
- [ ] `app/(dashboard)/dashboard/knowledge-base/page.tsx` (Bot Selector filter + Assigned Bot Badges)
- [ ] `app/(dashboard)/dashboard/integrations/page.tsx` (Channel-to-Bot Mapping UI)
- [ ] `app/(dashboard)/dashboard/chatbots/[id]/activity/page.tsx` (Redirect to `/dashboard/inbox`)
- [ ] `app/(dashboard)/dashboard/chatbots/[id]/layout.tsx` (Updated sub-nav tabs: Overview, Playground, Settings, Knowledge)
- [ ] `app/(dashboard)/dashboard/products/page.tsx` (Bottom padding spacing tweak)

Please implement these changes step-by-step and test the local build upon completion.