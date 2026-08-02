# Task 07: Zero-Human-Touch AI Order Engine & Live Status Viewport

## Objective
Transform the Live Inbox's Right Panel from a manual form-entry UI into a real-time **Live AI Extraction Detector**. The system must automatically extract customer contact info, address, and product preferences directly from chat messages using LLM Tool Calling, pre-fill status cards in real time, and auto-dispatch orders to Neon DB and Courier APIs without requiring manual merchant clicks.

---

## 1. Right-Panel UI Refactoring (`Live AI Order Detector`)

Replace the legacy form inputs in `app/(dashboard)/dashboard/inbox/page.tsx` (Right Column) with a sleek viewport:

### A. Live Extraction Card (Real-Time State)
- **Customer Identity**: Display FB/IG Name & Platform Badge.
- **Extracted Contact Data**:
  - `Phone`: Show extracted phone number with a green badge (`✓ Extracted by AI`) OR `Pending AI Request` if not yet provided in chat.
  - `Address`: Show extracted delivery address/district OR `Not Provided`.
- **Detected Cart Items**:
  - Dynamically list products the customer expresses intent to buy along with calculated total amount (COD).
- **Order Lifecycle Status Badge**:
  - States: `Browsing` $\rightarrow$ `Details Captured by AI` $\rightarrow$ `Confirmed & Courier Dispatched (ORD-XXXX)`.
- **Action Controls**:
  - Single **`Override / Edit Order`** button (For manual human intervention if needed).

### B. Context & Intelligence Widgets
- **Conversation Summary**: AI-generated 2-line summary of the conversation history.
- **Internal Staff Notes**: Replace "Notes for customer" with "Internal Staff Notes" (for agent-only notes, e.g., "Customer requested delivery after 5 PM").
- **Clean-up**: Remove redundant "Activity List" widget to eliminate clutter.

---

## 2. Orders Tab Table Enhancements (`app/(dashboard)/dashboard/orders/page.tsx`)

Update the Orders table columns to support full social commerce operations:

- **Columns**:
  1. `ORDER ID` (e.g., `#ORD-9482`)
  2. `CUSTOMER` (Name + Phone Number)
  3. `ITEM DETAILS` (Product Title + Quantity)
  4. `AMOUNT` (Total price + Payment method e.g., `৳2,200 (COD)`)
  5. `COURIER & TRACKING` (Courier Name + Courier Tracking Code e.g., `STEAD-99128`)
  6. `STATUS` (`Processing`, `Shipped`, `Delivered`, `Returned`)
  7. `DATE & TIME` (Order Timestamp)
  8. `ACTION` (View Details / Invoice)

- **Header Buttons Logic**:
  - `Sync Courier Status`: Triggers backend API to update parcel statuses from Steadfast/Pathao APIs.
  - `Create Manual Order`: Opens a modal for manually creating offline/phone orders.

---

## 3. Backend & Extraction Workflow Requirements

1. **LLM Extraction JSON Schema**:
   - When processing incoming chat messages, n8n/AI Agent uses structured JSON parsing:
     `{ "phone": string, "address": string, "district": string, "product_items": [], "is_order_confirmed": boolean }`
2. **WebSocket / Real-Time Push**:
   - As soon as AI extracts phone or address, emit a WebSocket event to update the Right Panel UI without page reload.
3. **Auto-Dispatch Logic**:
   - When `is_order_confirmed == true`, run `Create_Order_Tool` $\rightarrow$ Save to Neon DB `orders` table $\rightarrow$ Trigger Courier API $\rightarrow$ Return Tracking Code to customer in chat.

---

## File Modification Checklist 📁
- [ ] `docs/tasks/07_ZERO_HUMAN_TOUCH_ORDER_ENGINE.md`
- [ ] `app/(dashboard)/dashboard/inbox/page.tsx` (Right panel UI redesign to Live AI Detector Viewport)
- [ ] `app/(dashboard)/dashboard/orders/page.tsx` (Table columns expansion & Tracking ID integration)