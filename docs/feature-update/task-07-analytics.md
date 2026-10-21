# 📊 Task 07 — Analytics & Reporting

> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 8 rules apply to every item below.
> **Priority:** ⚫ MEDIUM-LOW
> **Pending Features from Analysis:** #38, #39, #40, #41

---

## Scope Summary

Build a unified business dashboard that gives merchants a complete daily picture: message volume, AI vs human handling, order source breakdown, per-reply cost transparency, and a list of interested-but-didn't-order customers.

---

## Feature #38 — Unified Business Dashboard

**VideoScript:** _"পুরো ব্যবসার হিসাব এক জায়গায়। আজ কী হলো, গতকাল কী হয়েছিল, কতগুলো কথা, কতগুলো order, AI কতটা সামলাল, কতবার মানুষ লাগলো।"_

### What to Build

A comprehensive overview page that shows today's and yesterday's key metrics in a single view:

- Total conversations (new + active)
- Total orders placed
- AI handled % vs human handled %
- Revenue (COD + confirmed orders)
- Active leads
- Unanswered tickets

> [!IMPORTANT]
> The current `/dashboard/overview/page.tsx` is likely a single-file page. **Check if it is monolithic** before modifying (Rule 4). If it has no `_components/` folder, refactor it first.

### Files to Create/Modify

- `app/(dashboard)/dashboard/overview/page.tsx` — Refactor if monolithic
- `app/(dashboard)/dashboard/overview/_components/` (create if missing):
  - `OverviewHeader.tsx` — Date range selector + greeting
  - `KpiGrid.tsx` — Top stats cards (conversations, orders, revenue, AI%, leads)
  - `KpiCard.tsx` — Individual metric card with trend arrow
  - `ActivityTimeline.tsx` — Hourly activity chart (messages + orders)
  - `AiVsHumanChart.tsx` — Pie/donut chart
  - `TopProductsPanel.tsx` — Best-selling products today
  - `RecentOrdersList.tsx` — Last 5 orders
  - `ActiveTicketsBanner.tsx` — Open ticket count alert
- `app/api/analytics/overview/route.ts` — Extend with missing metrics
- `public/locales/en/overview.json` — Extend with new keys
- `public/locales/bn/overview.json` — Bengali

### Key Metrics to Show

| Metric              | Data Source                                          |
| ------------------- | ---------------------------------------------------- |
| Conversations today | `ChatSession.createdAt`                              |
| New sessions        | Count where `createdAt` = today                      |
| AI handled %        | Sessions where `isActive = true` until end           |
| Human escalations   | Sessions where `isActive` toggled to `false`         |
| Orders placed       | `Order.createdAt` = today                            |
| Revenue (confirmed) | Sum of `Order.totalAmount` where `status = approved` |
| Active leads        | `ChatSession.leadStatus` in `[priority, follow_up]`  |
| Open tickets        | `SupportTicket.status = open`                        |

### Completion Checklist

- [ ] Page: Refactor overview if monolithic (Rule 4)
- [ ] API: Extended analytics overview route
- [ ] UI: All dashboard components (modular)
- [ ] UI: Today vs Yesterday comparison arrows
- [ ] i18n: en + bn keys (extend existing namespace)
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #39 — Order Source Breakdown

**VideoScript:** _"কোন order agent নিল, কোনটা product page থেকে এলো, কোনটা আপনার টিম নিল।"_

### What to Build

Tag every order with its source at creation time, and show a breakdown chart in the analytics/overview page showing the distribution of order sources.

### Files to Create/Modify

- `prisma/schema/merchant.prisma` — Add `source String @default("ai_agent")` to `Order`
  - Values: `"ai_agent"` | `"product_page"` | `"team_manual"` | `"website"` | `"broadcast"`
- `app/api/orders/route.ts` — Set `source` on order creation
- `app/api/internal/orders/route.ts` — Set source for AI-created orders
- `app/api/p/[productId]/order/route.ts` — Set `"product_page"` as source
- `app/(dashboard)/dashboard/overview/_components/OrderSourceChart.tsx` — Donut chart
- `app/(dashboard)/dashboard/orders/_components/OrdersTable.tsx` — Add "Source" column
- `public/locales/en/orders.json` — Source label keys
- `public/locales/bn/orders.json` — Bengali

### Source Labels

| Value          | English Label | Bengali Label    |
| -------------- | ------------- | ---------------- |
| `ai_agent`     | AI Agent      | AI Agent         |
| `product_page` | Product Page  | Product Page     |
| `team_manual`  | Team (Manual) | টিম (ম্যানুয়াল) |
| `website`      | Website       | ওয়েবসাইট        |
| `broadcast`    | Broadcast     | Broadcast        |

### Completion Checklist

- [ ] Schema: `source` field added to `Order`
- [ ] All order creation paths set correct source
- [ ] UI: OrderSourceChart in overview
- [ ] UI: Source column in orders table
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #40 — Interested-but-Didn't-Order List

**VideoScript:** _"যারা আগ্রহ দেখিয়েও order করেননি তাদের আলাদা একটা তালিকা।"_

### What to Build

A dedicated section (in the Leads page or Overview) that lists customers who showed purchase intent (AI detected product interest, price inquiries) but never completed an order. Includes a quick-action to re-engage them.

### Files to Create/Modify

- `app/api/leads/interested-not-ordered/route.ts` — GET: sessions with product intent but no orders
- `app/(dashboard)/dashboard/leads/_components/InterestedNotOrderedList.tsx` — New section
- `app/(dashboard)/dashboard/leads/_components/InterestedLeadCard.tsx` — Card with product interest summary + re-engage button
- `public/locales/en/leads.json` — List keys
- `public/locales/bn/leads.json` — Bengali

### Detection Logic

A customer is "interested but not ordered" if:

1. `ChatSession.aiExtractionData.orderStatus === "browsing"` AND
2. The session has no linked `Order` AND
3. Last activity was within the past 7 days AND
4. `leadStatus !== 'won'` AND `leadStatus !== 'lost'`

### UI Design

```
🎯 Interested — Haven't Ordered Yet (24)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Avatar] Rahim Khan                    3 days ago
         Interested in: Black T-Shirt (M), Blue Jeans (32)
         Platform: Messenger
         [Re-engage]  [Mark as Lost]

[Avatar] Fatima Begum                  5 days ago
         Interested in: Summer Dress (L)
         Platform: WhatsApp
         [Re-engage]  [Mark as Lost]
```

### Completion Checklist

- [ ] API: Interested-not-ordered query
- [ ] UI: InterestedNotOrderedList + InterestedLeadCard
- [ ] Re-engage button → trigger AI follow-up message
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #41 — Per-reply AI Cost Breakdown

**VideoScript:** _"কোন উত্তরে কত পয়সা কাটল, billing page প্রতিটা লাইন ধরে লেখা।"_

### What to Build

The Usage/Billing page should show an itemized cost breakdown: each AI response with its timestamp, the session it came from, the model used, and the credit cost.

> [!IMPORTANT]
> The current `/dashboard/usage/page.tsx` and `/dashboard/payment/page.tsx` pages need to be checked for monolithic architecture (Rule 4) before modifying.

### Files to Create/Modify

- `prisma/schema/billing.prisma` — Add `sessionId String?`, `messagePreview String?` to `UsageRecord` (or equivalent)
- `app/api/usage/detailed/route.ts` — GET: paginated per-reply usage log
- `app/(dashboard)/dashboard/usage/_components/` (create if missing):
  - `UsageHeader.tsx` — Date range selector + total cost summary
  - `UsageItemizedTable.tsx` — Per-reply table
  - `UsageRow.tsx` — Single row: time, session, model, cost
  - `UsageSummaryCards.tsx` — Total today / this month / lifetime
  - `UsageCostChart.tsx` — Daily cost bar chart
- `public/locales/en/usage.json` — New namespace (or extend existing)
- `public/locales/bn/usage.json` — Bengali

### Table Columns

| Column   | Description                   |
| -------- | ----------------------------- |
| Time     | Timestamp of the AI reply     |
| Customer | Session title / platform      |
| Model    | e.g., `gemini-2.5-flash-lite` |
| Cost     | `0.05৳` or in paisa           |
| Type     | Message / Comment / Broadcast |

### Cost Display

- Show in paisa (পয়সা) not taka for small amounts (per VideoScript: "পাঁচ থেকে বিশ পয়সা")
- Show running monthly total in taka
- Color: green if under budget, yellow at 75%, red at 90%

### Completion Checklist

- [ ] Schema: Extended usage record with session context
- [ ] API: Detailed itemized usage route (paginated)
- [ ] Page: Refactor usage page if monolithic (Rule 4)
- [ ] UI: All usage components (modular)
- [ ] UI: Per-reply table with cost in paisa
- [ ] i18n: en + bn (new or extended namespace)
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

_Task file: `task-07-analytics.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`_
