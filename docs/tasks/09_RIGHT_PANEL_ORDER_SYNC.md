# Task 09: Sync Right Panel (Live AI Detector) with Active Order State

## Objective
When an order (manual override or AI-generated) exists for the current active conversation, the Right Panel in `app/(dashboard)/dashboard/inbox/page.tsx` must dynamically transform to display active order details (Order ID, Customer Phone, Address, Product details, and Courier Tracking) instead of remaining in "Browsing / Pending AI Request" state.

---

## Implementation Details

### 1. Active Order Query / Context Hook
- Fetch the latest active order associated with the active `conversation.id` or `customer.id`.
- If `activeOrder` exists:
  - Update `AI Extraction Status` badge to `🟢 Order Confirmed (${activeOrder.id})`.
  - Display `activeOrder.phone` and `activeOrder.address` in Extracted Contact Data.
  - Display ordered items (e.g., `${productName} x${qty}`) under `Detected Cart Items`.
  - Display Courier name & Tracking code if available.

### 2. Post-Override Dispatch Flow
- When submitting the `Override / Edit Order` modal:
  1. Save order to Neon DB `orders` table.
  2. Associate `order_id` with current conversation context.
  3. Instantly re-fetch/update right panel state.
  4. (Optional) Append an order confirmation system message into the chat payload.

---

## File Checklist 📁
- [ ] `docs/tasks/09_RIGHT_PANEL_ORDER_SYNC.md`
- [ ] `app/(dashboard)/dashboard/inbox/page.tsx` (Update Right Panel state to check active order)