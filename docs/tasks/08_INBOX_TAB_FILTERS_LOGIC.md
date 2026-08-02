# Task 08: Live Inbox Tab Filters & Real-time State Logic

## Objective
Make the top tab filters (`All Contacts`, `Order Requests`, `Unreplied`, `Tickets`, `Resolved`, `Archived`) fully dynamic in `app/(dashboard)/dashboard/inbox/page.tsx`. Selecting a tab must filter the conversation list state and update URL search params, while real-time count badges dynamically update from conversation metadata.

---

## 1. URL State & Filter Mapping
Implement `useSearchParams` or React local state to manage active tab:

- **Tabs & DB Conditions**:
  - `all`: Show all non-archived conversations.
  - `order_requests`: `conversation.hasOrderIntent === true && !conversation.orderConfirmed`
  - `unreplied`: `conversation.lastMessageSender === 'customer' && conversation.unread === true`
  - `tickets`: `conversation.isTicket === true`
  - `resolved`: `conversation.status === 'resolved'`
  - `archived`: `conversation.status === 'archived'`

---

## 2. Dynamic Count Badges
Calculate array lengths or query DB counts dynamically for the pill badges:
- `All Contacts (${allCount})`
- `Order Requests (${orderRequestsCount})`
- `Unreplied (${unrepliedCount})`
- `Tickets (${ticketsCount})`
- `Resolved (${resolvedCount})`
- `Archived (${archivedCount})`

---

## 3. UI State Feedback
- Active Tab styling: Glowing light-violet pill background with bold text (`bg-purple-100 text-purple-700 dark:bg-purple-900/40`).
- If a filtered tab has no conversations, display a clean Empty State graphic (e.g., "No unreplied messages").

---

## Checklist 📁
- [ ] `docs/tasks/08_INBOX_TAB_FILTERS_LOGIC.md`
- [ ] `app/(dashboard)/dashboard/inbox/page.tsx` (Hook filter logic into conversation list mapping)