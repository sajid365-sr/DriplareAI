# 🎫 Task 05 — Support Ticket System

> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 8 rules apply to every item below.
> **Priority:** 🔴 HIGH
> **Pending Features from Analysis:** #33

---

## Scope Summary

Build a full support ticket lifecycle system. Currently the inbox has a "Tickets" filter tab (UI label only) but zero actual ticket management. This task implements the complete feature: creation, assignment, status tracking, SLA visibility, and resolution.

---

## Feature #33 — Full Support Ticket System

**VideoScript:** _"অভিযোগ, return, exchange, টাকা ফেরত, রাগী customer। Agent তর্ক করে না। চ্যাটটা আপনার টিমকে দেয়। কারণটা লিখে রাখে, notification পাঠায়। আর প্রতিটা সমস্যার জন্য খোলে একটা support ticket। কার দায়িত্বে আছে, কোন অবস্থায় আছে, কতদিন ধরে খোলা সব এক জায়গায়। যতক্ষণ না সমাধান হচ্ছে টিকিট খোলাই থাকে।"_

---

### 33a — Database Schema

**Files to Modify:**

- `prisma/schema/merchant.prisma` — Add `SupportTicket` model

```prisma
model SupportTicket {
  id            String   @id @default(cuid())
  ticketId      String   @unique @default(cuid())
  workspaceId   String
  sessionId     String   // linked chat session
  chatbotId     String

  // Classification
  type          String   // "complaint" | "return" | "exchange" | "refund" | "general"
  priority      String   @default("normal") // "low" | "normal" | "high" | "urgent"
  status        String   @default("open")   // "open" | "in_progress" | "waiting" | "resolved" | "closed"

  // Content
  subject       String
  description   String?  @db.Text
  aiSummary     String?  @db.Text  // AI-generated summary of the issue

  // Assignment
  assignedToUserId String?
  assignedAt    DateTime?

  // SLA
  openedAt      DateTime @default(now())
  resolvedAt    DateTime?
  closedAt      DateTime?
  slaDeadline   DateTime? // auto-set based on priority

  // Metadata
  tags          String[]
  internalNotes String?  @db.Text
  resolution    String?  @db.Text

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([workspaceId, status])
  @@index([sessionId])
  @@schema("chatbot")
}
```

**Completion:**

- [ ] Schema added and `npx prisma validate` passes

---

### 33b — API Routes

**Files to Create:**

- `app/api/support-tickets/route.ts` — GET (list with filters) + POST (create)
- `app/api/support-tickets/[ticketId]/route.ts` — GET (single) + PATCH (update status/assign) + DELETE
- `app/api/support-tickets/[ticketId]/notes/route.ts` — POST internal note
- `app/api/support-tickets/stats/route.ts` — GET: open count, avg resolution time, by-type breakdown

**Key Logic:**

- POST /support-tickets: auto-set `slaDeadline` based on priority (urgent: 4h, high: 24h, normal: 48h)
- PATCH: trigger notification to assignee on assignment change
- GET list: filter by `status`, `type`, `assignedToUserId`, `chatbotId`

**Completion:**

- [ ] All CRUD routes implemented
- [ ] Stats route implemented
- [ ] SLA deadline auto-set logic

---

### 33c — n8n / AI Auto-detection

**What to Build:**
When the AI detects a complaint/return/exchange intent in a customer message, it automatically:

1. Creates a support ticket with AI-generated subject + summary
2. Sets `isTicket = true` on the ChatSession
3. Disables AI responses for that session (human takeover)
4. Sends notification to the workspace

**Files to Modify:**

- n8n: Add complaint intent detection node → call ticket creation API
- `app/api/webhooks/` handlers: set `isTicket` flag

**Completion:**

- [ ] n8n: Intent detection → auto-ticket creation

---

### 33d — Ticket Management Page

> [!IMPORTANT]
> This is a NEW page. Follow Rule 4 — modular architecture from the start.

**Files to Create:**

```
app/(dashboard)/dashboard/support-tickets/
  page.tsx                                   ← Page shell
  _components/
    TicketHeader.tsx                          ← Page header + stats bar
    TicketFilters.tsx                         ← Status / type / priority filters
    TicketTable.tsx                           ← Table view of all tickets
    TicketCard.tsx                            ← Individual ticket row
    TicketDetailSheet.tsx                     ← Side sheet with full ticket details
    TicketStatusBadge.tsx                     ← Status color badge
    TicketPriorityBadge.tsx                   ← Priority badge
    TicketSLACountdown.tsx                    ← Time remaining until SLA breach
    CreateTicketModal.tsx                     ← Manual ticket creation
    InternalNoteEditor.tsx                    ← Add internal notes
    TicketTimeline.tsx                        ← Status history timeline
    types.ts
    index.ts
```

**Ticket Status Pipeline (UI):**

```
Open → In Progress → Waiting (for customer) → Resolved → Closed
```

**SLA Countdown Colors:**

- Green: > 50% time remaining
- Yellow: 25–50% remaining
- Red: < 25% remaining or breached

**Completion:**

- [ ] All component files created (modular)
- [ ] Ticket table with sorting + filtering
- [ ] TicketDetailSheet with full lifecycle
- [ ] SLA countdown visible
- [ ] Manual ticket creation modal

---

### 33e — Inbox Integration

**What to Build:**

- The existing "Tickets" filter tab in the inbox now correctly shows sessions with open tickets
- A "View Ticket" link in the conversation panel opens the relevant ticket detail sheet
- Sessions with tickets show a ticket badge on their session card

**Files to Modify:**

- `app/(dashboard)/dashboard/inbox/_components/session-list.tsx` — Ticket badge on card
- `app/(dashboard)/dashboard/inbox/_components/conversation-panel.tsx` — "View Ticket" button
- `app/(dashboard)/dashboard/inbox/_components/useInboxSessionFilters.ts` — Fix ticket filter to use actual DB flag

**Completion:**

- [ ] Ticket badge on session card
- [ ] "View Ticket" deep link from inbox
- [ ] Inbox ticket filter uses real DB data

---

### 33f — Dashboard Sidebar Navigation

**Files to Modify:**

- `app/(dashboard)/layout.tsx` or sidebar component — Add "Support Tickets" nav item with open count badge

**Completion:**

- [ ] Sidebar link added with open ticket count badge

---

### 33g — i18n

**Files to Create:**

- `public/locales/en/support-tickets.json` — New namespace with all ticket-related strings
- `public/locales/bn/support-tickets.json` — Full Bengali translations

**Sample Keys:**

```json
{
  "title": "Support Tickets",
  "status": {
    "open": "Open",
    "in_progress": "In Progress",
    "waiting": "Waiting",
    "resolved": "Resolved",
    "closed": "Closed"
  },
  "priority": {
    "low": "Low",
    "normal": "Normal",
    "high": "High",
    "urgent": "Urgent"
  },
  "sla": {
    "breached": "SLA Breached",
    "remaining": "{{time}} remaining"
  }
}
```

**Completion:**

- [ ] en + bn locale files created

---

### Full Completion Checklist for Feature #33

- [ ] Schema: `SupportTicket` model added + validated
- [ ] API: All CRUD + stats routes
- [ ] n8n: Auto-ticket creation on complaint detection
- [ ] UI: Full ticket management page (modular components)
- [ ] UI: Inbox integration (badge, link, filter fix)
- [ ] UI: Sidebar nav link with badge
- [ ] i18n: en + bn (new namespace)
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

_Task file: `task-05-support-tickets.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`_
