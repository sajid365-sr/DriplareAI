# Task 10: Repeat Customer Logic & Order History Link in Right Panel

## Objective
Support returning buyers (repeat customers) in the Live Inbox Right Panel (`app/(dashboard)/dashboard/inbox/page.tsx`). The panel must distinguish between the current in-progress order extraction and previous order history, rendering a "Recent Order Summary" with a direct link to filtered orders in the Orders tab.

---

## Implementation Details

### 1. Customer Context & History Lookup
- Fetch order counts and history for the active customer via `phone` or `customer_id`.
- If `orderCount > 1`:
  - Show a `Repeat Customer` / `VIP` badge in the header.
  - Pre-fill `Phone` and `Address` from the customer's previous profile records during AI extraction.

### 2. Right Panel Layout Segregation
- **Top Section**: Active/New Order Extraction (detecting current cart intent).
- **Bottom Section**: `Recent Order` widget showing the latest order ID, status, and total amount.
- **Action Link**: A `See All Orders (${count})` button that routes to `/dashboard/orders?search=${customerPhone}` or opens a customer order history drawer.

---

## Checklist 📁
- [ ] `docs/tasks/10_REPEAT_CUSTOMER_AND_ORDER_HISTORY.md`
- [ ] `app/(dashboard)/dashboard/inbox/page.tsx` (Add Repeat Customer Badge & Recent Order History widget)
- [ ] `app/(dashboard)/dashboard/orders/page.tsx` (Support URL search parameter filtering by customer phone/ID)