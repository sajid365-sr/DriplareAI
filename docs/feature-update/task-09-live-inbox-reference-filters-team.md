# Task 09 — Live Inbox Filters, Search & Team Assignment

> **Status:** In progress  
> **Reference:** `docs/feature-update/task-01-inbox-ux.md` — Features #3, #4, and #5  
> **Goal:** Update Live Inbox filtering and search to match the supplied reference, with reliable team membership and conversation assignment.

## Scope and acceptance criteria

- Search by customer name, phone number, order number, session ID, and any message text. Search results must open the matching conversation and show the matching message context.
- Provide **Waiting**, **Unread**, **Open**, and **Done** views with distinct, persisted meaning:
  - **Waiting:** customer has sent a message and the team has not replied.
  - **Unread:** the conversation has not been read by an agent.
  - **Open:** work is still in progress.
  - **Done:** an agent can mark a conversation done and find it in this view.
- Rename **Snoozed** to **Later** in the Inbox UI; preserve the existing reminder behavior and due-time resurfacing.
- Use recognizable channel icons for the channel filter and channel options.
- Add **Mine** (assigned to the current user), **Everyone** (filter by assignee), and **Any** (date range) filters.
- Workspace owners can invite any email address, whether or not the invitee already has a Driplare account or workspace. New invitees remain pending until they sign up/log in with that email; existing accounts join immediately. Only active members can be assigned to a conversation.
- Assignment updates the conversation, displays its assignee, and notifies the assigned member.
- English and Bengali translations; responsive layout and dark/light theme support.

## Implementation order

### 0. Audit existing behavior

- [x] Existing Inbox tabs, search route, assignment modal/API, and team settings page inspected.
- [ ] Confirm the current read/seen data source and define persistence for read state and Done status before changing filters.
- [ ] Verify workspace member identity/invitation lifecycle and assignment authorization end to end.

### 1. Team members — Task 1 Feature #5

- [ ] Make invite/list/remove operations workspace-scoped and owner-authorized.
- [ ] Send an email invitation that works for invitees with or without an existing account/workspace.
- [ ] Link a pending invite to the authenticated user when they sign up/log in with the invited email; keep their existing workspaces unchanged.
- [ ] Ensure invited members have stable user IDs before assignment.
- [ ] Add useful pending/active/removed states and clear success/error feedback.
- [ ] Verify team settings navigation, localization, and responsive UI.

### 2. Assignment — Task 1 Feature #4

- [ ] Restrict assignment to active members of the chatbot's workspace (including the owner).
- [ ] Support assign, reassign, and unassign; persist the assignee and assignment time.
- [ ] Notify the assigned member and show the assignee in conversation/list UI.
- [ ] Add **Mine** and **Everyone → member** filters.

### 3. Inbox status filters and date range

- [ ] Implement **Waiting**, **Unread**, **Open**, and **Done** using explicit, consistent state rules.
- [ ] Add the Done action and persist it across refreshes.
- [ ] Rename the existing Snoozed view to **Later** without changing reminder behavior.
- [ ] Add **Any** date-range selection and filter conversations by their latest activity.

### 4. Search and channel controls

- [ ] Search customer name, phone, order number, session ID, and message content in one result set.
- [ ] Scope results to the active chatbot and preserve match snippets/highlighting.
- [ ] Update channel selector visuals and icon options to match the reference.
- [ ] Keep search and filter combinations predictable and URL/deep-link behavior intact.

### 5. Verification and tracking

- [ ] Add/update focused tests for search, statuses, assignment permissions, and date filters.
- [ ] Run project-required test, lint, type, and development-server checks; record any existing unrelated failures.
- [ ] Update `pending-features.md` and mark this task complete only after acceptance criteria pass.

## Audit findings

- The current search endpoint searches message text only; the UI separately filters a limited set of session fields. Name, phone, order ID, session ID, and message results are not yet unified server-side.
- Existing top tabs are All Contacts / Order Requests / Unreplied / Human Needed / Snoozed / Resolved / Archived, so the reference status model is not present.
- Assignment UI/API and a Team Settings page already exist, but the assignment route accepts an arbitrary user ID and does not verify workspace membership. Invites currently create a workspace-member row directly, so the member authentication lifecycle needs verification.
- Current session “unread” is inferred from the latest message role; there is no explicit agent read marker in the inspected `ChatSession` schema.
- The supplied reference uses platform icon chips and adds assignment/date filters absent from the current Inbox controls.

## Latest implementation update — 2026-10-23

- Moved conversation status tabs and channel icon filters into the Inbox sidebar, directly below search; the page header now contains only global status/notification controls.
- Added an additive migration for `ChatSession.isDone` and `ChatSession.lastReadAt`; it was applied successfully to the database configured by this development environment.
- `npx prisma validate`, focused ESLint, and `npx vitest run` pass (764 tests). Focused ESLint reports one existing image optimization warning.
- The Inbox route now loads in the development server and redirects unauthenticated users to sign-in as expected. Full TypeScript checking remains blocked by the unrelated syntax error in `CreditDerivationPanel.tsx:11`.
- Removed the inbox-only notifications/availability row so panels use that vertical space. Added sender-labeled latest-message previews to the conversation header and session list, and shortened the three-dot menu actions.
- Updated latest-message prefixes to `AI:`/no prefix for customers; added AI versus Person/You/team-member handling badges, per-chat Done/Later/Stop AI actions, and Done beside Later in the conversation toolbar. Applied brand colors to Messenger, WhatsApp, Instagram, and Web icons.
- Added assignment role badges (`You · Client` / `Teammate`), optional teammate context notes, configurable AI pause duration, and an automatic resume cron. Assignment notes now appear in the CRM panel under **Team Note**.
- Applied the additive assignment handoff SQL to the configured Neon database. Prisma Migrate cannot deploy against this existing database until its migration history is baselined (`P3005`); the schema change itself was applied successfully with `prisma db execute`.
- Removed the duplicate assignee chip from conversation cards and separated the assignee name (`You` or teammate) from the `Person` badge. Returned snoozed chats now show a `Back from later` badge in the sidebar.
- Replaced the fullscreen Later reminder modal with an anchored inline dropdown in both the conversation toolbar and sidebar actions.
- Kept the reminder popover within the conversation panel bounds and changed quick time presets to a compact vertical list with each due time aligned on the right.
- Renamed the reminder prompt to **Remind me later**, reduced presets to 30 minutes, 1 hour, and tomorrow, and added a custom duration input in minutes, hours, or days.
- Removed all preset reminder choices. The Later dropdown now offers only a manual duration or a specific date and time.
- Made the Any date filter right-align when controls wrap, constrained its popover to the viewport, and added outside-click/Escape dismissal.
