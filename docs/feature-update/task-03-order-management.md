# 📦 Task 03 — Order Management

> **Master Rules Reference:** [`MASTER_TASK.md`](./MASTER_TASK.md) — All 8 rules apply to every item below.
> **Priority:** 🟡 MEDIUM-HIGH
> **Pending Features from Analysis:** #19, #20, #21, #22, #23, #24, #25, #26, #27

---

## Scope Summary

Complete the order lifecycle: AI-driven order modification, automated parcel dispatch pipeline, real-time courier sync, professional delivery notifications, post-delivery review requests, customer risk profiling, COD collection tracking, and structured cancellation reason tracking.

---

## 🟦 Feature #19 — AI-driven Order Modification (Pre-confirm)

**VideoScript:** _"ঠিকানা, ফোন নম্বর, আরেকটা product যোগ, সংখ্যা কম বেশি... Agent নিজেই করে দেয় আর নতুন bill পাঠিয়ে দেয়।"_

### What to Build

When a customer requests to modify their pending order through chat (before it's confirmed by the team), the AI understands the change request, updates the order in the DB, and sends a new bill to the chat.

### Files to Create/Modify

- `app/api/internal/orders/modify/route.ts` — POST: AI-triggered order modification
- n8n: Add order modification intent detection node → call modify API → send new bill
- `app/(dashboard)/dashboard/orders/_components/OrderSheet.tsx` — Show modification history
- `public/locales/en/orders.json` — Modification keys
- `public/locales/bn/orders.json` — Bengali

### Completion Checklist

- [ ] API: Order modify endpoint (pre-confirm only)
- [ ] n8n: Modification intent → update → new bill
- [ ] UI: Modification history in OrderSheet
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## 🟦 Feature #20 — Post-confirm Order Change Request Routing

**VideoScript:** _"confirm হয়ে যাওয়ার পরে হলে? Agent অনুরোধটা লিখিয়ে নিয়ে chatটা আপনার teamকে দেয়।"_

### What to Build

After an order is confirmed, if the customer asks to change anything, the AI collects the change request as a structured note, flags the conversation as a ticket, and assigns it to the team with the request written clearly.

### Files to Create/Modify

- n8n: Post-confirm order change intent → create note → set `isTicket = true` → assign to workspace
- `prisma/schema/merchant.prisma` — Add `changeRequests Json?` to `Order`
- `app/(dashboard)/dashboard/orders/_components/ChangeRequestBadge.tsx`
- `public/locales/en/orders.json` — Change request keys
- `public/locales/bn/orders.json` — Bengali

### Completion Checklist

- [x] Schema: `changeRequests` field added
- [x] n8n: Post-confirm intent detection + ticket creation
- [x] UI: Change request indicator in order list
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #21 — Automated Parcel Booking (One-click)

**VideoScript:** _"আপনার কাজ শুধু একটা click, parcel book। এর পরের সব ধাপ পুরোপুরি automatic।"_

### What to Build

A "Book Parcel" button on each approved order that triggers the full courier booking workflow: validates data → calls courier API → saves tracking ID → updates order status — all in one click.

### Files to Create/Modify

- `app/api/orders/book-parcel/route.ts` — POST: one-click courier booking
- `lib/services/courier-dispatch.ts` — Unified dispatch service (Steadfast / Pathao / RedX)
- `app/(dashboard)/dashboard/orders/_components/BookParcelButton.tsx` — CTA button with loading state
- `app/(dashboard)/dashboard/orders/_components/OrderSheet.tsx` — Add book parcel section
- `public/locales/en/orders.json` — Booking keys
- `public/locales/bn/orders.json` — Bengali

### Completion Checklist

- [x] Service: Unified courier dispatch wrapper
- [x] API: One-click booking route
- [x] UI: BookParcelButton with loading/success states
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #22 — Real-time Parcel Status Auto-sync

**VideoScript:** _"Parcel status কখন বদলালো, system নিজেই জেনে যায়।"_

### What to Build

A cron job that periodically polls all active courier tracking IDs and updates the order status in the DB automatically. Also triggers customer notifications on status change.

### Files to Create/Modify

- `app/api/cron/courier-status-sync/route.ts` — Cron: poll courier APIs for status updates
- `lib/services/courier-poll.ts` — Per-courier status polling logic
- `vercel.json` — Add cron schedule (e.g., every 30 min)
- `app/(dashboard)/dashboard/orders/_components/OrdersTable.tsx` — Show "last synced" timestamp
- `public/locales/en/orders.json` — Sync status keys
- `public/locales/bn/orders.json` — Bengali

### Completion Checklist

- [x] Cron: Courier status sync job
- [x] Service: Polling logic for Steadfast / Pathao / RedX
- [x] UI: Last-synced indicator
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #23 — Automated Customer Delivery Notifications

**VideoScript:** _"Courier হস্তান্তর থেকে শুরু করে delivery দিন customerকে মনে করিয়ে দেওয়া পর্যন্ত প্রতিটা update inbox চলে যায়, tracking link সহ। আর এগুলো কোনো সাদামাটা text message না। সুন্দর করে সাজানো professional update।"_

### What to Build

When an order's courier status changes (Dispatched → In Transit → Out for Delivery → Delivered), the system automatically sends a beautifully formatted message to the customer's chat with the tracking link.

### Files to Create/Modify

- `lib/services/delivery-notifications.ts` — Template-based notification sender
- `app/api/cron/courier-status-sync/route.ts` — Trigger notifications on status change
- `lib/templates/delivery-notification-templates.ts` — Message templates per status
- `public/locales/en/orders.json` — Notification template keys
- `public/locales/bn/orders.json` — Bengali message templates

### Notification Templates (per status)

| Status           | Template                                                                            |
| ---------------- | ----------------------------------------------------------------------------------- |
| Dispatched       | "📦 Your parcel #{trackingId} has been handed over to {courierName}. Track: {link}" |
| Out for Delivery | "🚚 Great news! Your order is out for delivery today. Please be available."         |
| Delivered        | "✅ Your order has been delivered! We hope you love it. [Review Request]"           |

### Completion Checklist

- [x] Service: Notification sender (per status)
- [x] Templates: All status message templates
- [x] Cron: Trigger on status change event
- [x] i18n: en + bn notification templates
- [x] TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #24 — Post-delivery Review Request

**VideoScript:** _"Delivery পরে customer অভিজ্ঞতা জানতে চেয়ে review অনুরোধও যায় নিজে থেকেই।"_

### What to Build

24 hours after an order is marked as "Delivered", the system automatically sends a review request message to the customer's chat.

### Files to Create/Modify

- `app/api/cron/delivery-review-request/route.ts` — Cron: find delivered orders within 24h window → send review request
- `prisma/schema/merchant.prisma` — Add `reviewRequestSentAt DateTime?` to `Order`
- `lib/services/delivery-notifications.ts` — Add review request method
- `public/locales/en/orders.json` — Review request template keys
- `public/locales/bn/orders.json` — Bengali

### Completion Checklist

- [x] Schema: `reviewRequestSentAt` field
- [x] Cron: 24h post-delivery review job
- [x] Service: Review request message sender
- [x] i18n: en + bn keys
- [x] TypeScript clean ✓
- [x] Committed to `feature-update`

---

## 🟦 Feature #25 — Customer Delivery Risk Profiling

**VideoScript:** _"parcel পাঠানোর আগে customerকে চিনে নিন। ফোন নম্বর ধরে তার পুরো record। আগে কয়টা order নিয়েছেন, কয়টা ফেরত দিয়েছেন, কয়টা বাতিল করেছেন। সাথে courier কাছে তার delivery record।"_

### What to Build

A risk score panel shown before dispatching a parcel. Looks up the customer's phone number and shows: total orders, returns, cancellations, and a risk level badge (Low / Medium / High).

### Files to Create/Modify

- `app/api/crm/risk-profile/route.ts` — GET: phone → risk score + history
- `lib/domain/customer-risk.ts` — Risk scoring algorithm
- `app/(dashboard)/dashboard/orders/_components/CustomerRiskPanel.tsx` — Risk display in OrderSheet
- `app/(dashboard)/dashboard/orders/_components/OrderSheet.tsx` — Embed risk panel before dispatch
- `public/locales/en/orders.json` — Risk profile keys
- `public/locales/bn/orders.json` — Bengali

### Risk Score Formula

```
returnRate = (returns / totalOrders) * 100
cancelRate = (cancellations / totalOrders) * 100
riskScore:
  LOW    → returnRate < 10% && cancelRate < 15%
  MEDIUM → returnRate 10–25% || cancelRate 15–30%
  HIGH   → returnRate > 25% || cancelRate > 30%
```

### Completion Checklist

- [x] API: Risk profile endpoint
- [x] Domain: Risk scoring logic
- [x] UI: CustomerRiskPanel with badge
- [x] i18n: en + bn keys
- [x] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [x] Committed to `feature-update`

---

## Feature #26 — COD Collection Tracking

**VideoScript:** _"Delivery পরে টাকা বাকি না হাতে এসেছে সেটাও আলাদা করে।"_

### What to Build

For Cash-on-Delivery orders, track whether payment has been collected after delivery. Add a "COD Collected" toggle and separate the COD pending vs collected amounts in the orders dashboard.

### Files to Create/Modify

- `prisma/schema/merchant.prisma` — Add `codCollected Boolean @default(false)`, `codCollectedAt DateTime?` to `Order`
- `app/api/orders/[id]/cod-collect/route.ts` — PATCH: mark COD as collected
- `app/(dashboard)/dashboard/orders/_components/PaymentBadge.tsx` — Show COD collected state
- `app/(dashboard)/dashboard/orders/_components/OrderSheet.tsx` — COD collection section
- `app/(dashboard)/dashboard/overview/page.tsx` — COD summary stats
- `public/locales/en/orders.json` — COD keys
- `public/locales/bn/orders.json` — Bengali

### Completion Checklist

- [ ] Schema: `codCollected` and `codCollectedAt` fields
- [ ] API: COD collection PATCH route
- [ ] UI: COD status in orders table and sheet
- [ ] UI: COD summary in overview dashboard
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

## Feature #27 — Return/Damage/Cancellation Reason Tracking

**VideoScript:** _"Return, damage, বাতিলের কারণ সব হিসাবে থাকে।"_

### What to Build

When an order is cancelled, returned, or marked as damaged, require a structured reason to be selected (from a predefined list) and optionally add a free-text note. Show reason analytics on the dashboard.

### Files to Create/Modify

- `prisma/schema/merchant.prisma` — Add `cancellationReason String?`, `returnReason String?`, `damageNote String?` to `Order`
- `app/(dashboard)/dashboard/orders/_components/CancellationReasonModal.tsx` — Reason picker modal
- `app/api/orders/[id]/route.ts` — PATCH: include reason in status update
- `app/(dashboard)/dashboard/overview/page.tsx` — Cancellation reason breakdown chart
- `public/locales/en/orders.json` — Reason keys
- `public/locales/bn/orders.json` — Bengali

### Predefined Reason Categories

- Customer request / Changed mind
- Product out of stock
- Wrong item
- Delivery failed (customer unavailable)
- Damaged in transit
- Fraud / fake order
- Other (free text)

### Completion Checklist

- [ ] Schema: Reason fields added
- [ ] API: Reason captured on status update
- [ ] UI: CancellationReasonModal
- [ ] UI: Reason breakdown in analytics
- [ ] i18n: en + bn keys
- [ ] Responsive ✓ | Dark mode ✓ | TypeScript clean ✓
- [ ] Committed to `feature-update`

---

_Task file: `task-03-order-management.md` | Branch: `feature-update` | Master rules: `MASTER_TASK.md`_
