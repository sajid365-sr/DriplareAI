# Task 05: Driplare AI - Complete Social Commerce OS Overhaul (LazyChat + RepliBee)

## Objective
Transform Driplare AI from a standalone chatbot management system into a full-fledged Social Commerce Operating System by unifying LazyChat's Omnichannel Live Inbox with RepliBee's Low-Friction E-Commerce, Order Engine, and Lead Management.

---

## Visual & UI Reference Mapping 🖼️
- **Live Inbox 3-Column Architecture**: `docs/ui-references/LazyChat Inbox.png`
- **Dashboard Sidebar & Store Structure**: `docs/ui-references/RepliBee 1.png`
- **Catalog & Product Management**: `docs/ui-references/RepliBee 2.png`
- **Store Settings & Automation Navigation**: `docs/ui-references/RepliBee 3.png`
- **Automation Triggers & Keyword Config**: `docs/ui-references/RepliBee 4.png`

---

## Architecture Blueprint & Navigation Structure

### 1. Primary Left Sidebar Restructuring (`components/layout/sidebar.tsx`)
Group sidebar links into 3 logical functional blocks:

#### A. Main Operations (Daily Commerce Workflow)
- **Dashboard / Overview**: High-level metrics (Sales, Message Volume, AI Success Rate).
- **Live Inbox (`/dashboard/inbox`)**: 3-column LazyChat-style real-time chat window replacing the legacy Activity tab.
- **Orders (`/dashboard/orders`)**: Order lifecycle table, status filter, and courier tracking integrations (Steadfast/Pathao).
- **Products / Catalog (`/dashboard/products`)**: Hybrid inventory system (FB Post Sync, Text Context Prompt, Sheet/Manual CSV).
- **Leads & Customers (`/dashboard/leads`)**: Customer profiles, automated tags (`High Prospect`, `Risky`), and contact export.

#### B. AI Engine & Automations
- **AI Agents (`/dashboard/chatbots`)**: Bot management, model selection, system prompts, and tone configuration.
- **Knowledge Base (`/dashboard/chatbots/[id]/sources`)**: RAG document parsing (PDF, Web Scraping, Text).
- **Automations (`/dashboard/automations`)**: Comment-to-DM triggers, keyword auto-replies, and workflow rules.
- **Integrations (`/dashboard/integrations`)**: Meta API (FB Messenger, Instagram DM) and WhatsApp API connection status.

#### C. Account & Settings
- **Usage & Analytics (`/dashboard/usage`)**: Token usage meters and quota limits.
- **Settings & Billing (`/dashboard/settings`)**: Plan upgrades, payout gateways (Stripe/UddoktaPay), and team management.

---

### 2. Live Inbox Page Refactoring (`app/(dashboard)/dashboard/inbox/page.tsx`)
Implement a responsive 3-column grid layout inspired by `docs/ui-references/LazyChat Inbox.png`:

#### Left Column: Conversation Filter & Session List
- Channel toggle tabs: `All`, `Facebook`, `Instagram`, `WhatsApp`.
- Filter chips: `Unread`, `Follow-up`, `High Prospect`, `Human Handled`.
- Session cards displaying customer avatar, name, snippet of last message, channel icon, and real-time status pill (`AI Active` vs `Human Control`).

#### Middle Column: Main Conversation Window & Handoff Control
- **Header Bar**: Customer identity, social profile link, assigned agent name, and a prominent **`Stop AI / Take Control` Switch Toggle**.
  - Clicking this toggle updates `conversations.is_ai_active` boolean in Neon Postgres.
- **Message Feed**: Message bubble history with clear sender attribution (`Replied by Driplare AI` vs `Human Agent`).
- **Real-Time Engine**: Socket.io / Pusher client integration to render new incoming webhooks instantly without page reloads.
- **Composer**: Text area with quick canned response picker, attachment uploader, and manual reply button.

#### Right Column: CRM & Embedded Quick Order Creator
- **Customer Card**: Name, phone number, address, and AI-generated chat summary.
- **Quick Order Creation Form**:
  - Fields: Customer Name, Phone, Delivery Address, Product Dropdown, Delivery Charge (Inside/Outside Dhaka).
  - Primary Button: **`Create Order & Send Tracking`**.
  - On Submit: Inserts entry into Neon DB `orders` table and triggers courier API webhook.

---

### 3. Low-Friction E-Commerce Engine (`app/(dashboard)/dashboard/products/page.tsx`)
Mitigate merchant onboarding friction using a 3-tab flexible catalog strategy:

- **Tab 1: Facebook Page Post Auto-Sync (Primary)**
  - Action: "Sync Products from Facebook Page".
  - Mechanism: n8n workflow fetches last 50 FB posts via Meta Graph API, uses LLM vision/text parser to extract Product Title, Price, Description, and Images directly into Neon DB.
- **Tab 2: Unstructured Text / Prompt Context (Simple Mode)**
  - A simple textarea allowing merchants to paste plain text notes (e.g., product lists, delivery policies). Stored directly in pgvector for RAG retrieval without forced DB table entry.
- **Tab 3: Manual & Sheet Import (Advanced Mode)**
  - Custom form for explicit product variants (Size, Color, Weight, Stock Quantity) + CSV / Google Sheet import.

---

### 4. Database & n8n Integration Points

#### Database Schema Alignment
- Extend Neon Postgres schema using Prisma:
  - `Conversation`: Store `isAiActive`, `leadTag`, `platform`, `customerId`.
  - `Product`: Store `title`, `price`, `stockQuantity`, `embedding` (pgvector).
  - `Order`: Store `conversationId`, `customerPhone`, `deliveryAddress`, `courierTrackingCode`, `status`.

#### n8n Router Logic
- Webhook receives Facebook/WhatsApp message $\rightarrow$ Queries Neon DB for `isAiActive`.
- If `isAiActive == true`: Runs AI Agent with `Product_Search` and `Order_Creation` tools.
- If `isAiActive == false`: Saves message to DB and sends a Webhook event to Next.js (`/api/realtime-event`) to push a real-time WebSocket update to the Live Inbox.