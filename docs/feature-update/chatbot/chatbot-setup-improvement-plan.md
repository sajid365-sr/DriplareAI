# Chatbot Setup & Universal Multi-Industry CRM Architecture Plan

**Project:** DriplareAI  
**Section:** Dashboard → Chatbot Quick Setup & Dynamic Entity Engine  
**Status:** Approved Architectural Specification  
**Target Backend:** Next.js (App Router), Prisma (Neon Postgres), n8n Core-AI-Brain  

---

## 1. Executive Summary & Vision

DriplareAI is transitioning from an e-commerce-only bot assistant to a **Universal Multi-Channel AI Business CRM**. 

While e-commerce remains a primary use-case with dedicated catalog search and order creation, businesses across diverse industries (Healthcare, Tour & Travel, Real Estate, Restaurants, Education, Consulting, Legal, Agency, etc.) require the same AI-driven automation. 

This plan addresses:
1. **Dynamic Tool Routing:** Universal Knowledge Base (RAG) for *all* chatbots, with industry-specific tool attachments (E-commerce tools for shops; Universal Data Capture for service/custom businesses).
2. **Custom Entity & Table Engine (No-Code Database Builder):** Merchants can define custom data models/columns (e.g. Table Bookings, Tour Leads, Patient Appointments) directly from their dashboard. The AI Agent automatically collects this information and records it into an interactive table view.
3. **Category-Aware Dynamic Sandwich Model:** Clean separation between system directives (Header), merchant business rules (Body), and conversational slot-filling protocols (Footer).
4. **Blank Canvas ("Custom / Other Business") Mode:** For niche businesses, an AI-assisted one-click prompt generator eliminates rigid dropdown constraints.
5. **Wizard Policy vs. Knowledge Base Separation:** Removing catalog micromanagement from the wizard, delegating menus, prices, and catalogs to the Knowledge Base (RAG).

---

## 2. Problem Analysis & Core Architectural Bottlenecks

### 2.1 The Hardcoded E-commerce Sandwich Problem (`lib/ai/prompt-assembler.ts`)
* Currently, `SYSTEM_HEADER` and `SYSTEM_FOOTER` enforce e-commerce order rules (`search_products`, variant, size, and `create_order`) on **every single chatbot**, regardless of business type.
* When a non-ecommerce bot (e.g., Clinic or Travel) receives inquiries, the AI hallucinated stock checks, product variants, and carts.

### 2.2 The n8n Tool Coupling Bottleneck (`docs/n8n-JSON/Core-AI-Brain.json`)
* The n8n `AI Agent` node hardwires `Product Lookup` (Postgres query on `ecommerce.Product`) and `Create Order` (HTTP POST to `/api/internal/orders`).
* The system message in n8n enforces `=== PRODUCT CARDS === [CARDS]` and `=== ORDER CARD TAPS ===`.
* For a clinic or travel agency, this caused the bot to search the product database, fail, and output *"Sorry, this product is out of stock!"*.

### 2.3 The Missing Data Persistence for Non-Ecommerce Businesses
* A restaurant bot needs table bookings; a travel agency bot needs tour inquiries with dates and person counts; a clinic bot needs patient appointment requests.
* Previously, the platform lacked dynamic database tables to store arbitrary structured merchant data.

---

## 3. Core Architectural Solutions

### 3.1 Universal Knowledge Base + Dynamic Tool Routing

Knowledge Base (RAG) is **fundamental to ALL businesses**, including e-commerce (for return policies, shipping rules, brand story, FAQs, warranties). 

The n8n workflow routes tools based on `chatbotMode`:

```
                           [Incoming Message + chatbotMode]
                                          │
                                          ▼
                         [Universal RAG Search (Vector DB)]
                                          │
                                          ▼
                               [Evaluate chatbotMode]
                                          │
                ┌─────────────────────────┴─────────────────────────┐
                ▼                                                   ▼
       [Mode: "ecommerce"]                               [Mode: Non-Ecommerce / Custom]
   • RAG Knowledge Base                              • RAG Knowledge Base
   • Product Lookup (Postgres)                       • Universal Data Capture (save_custom_data)
   • Create Order (/api/internal/orders)             • Lead Capture (save_lead)
   • Product Cards Carousel ([CARDS])
```

### 3.2 Custom Entity Engine (Dynamic Schema & Table Builder)

Rather than executing dangerous dynamic DDL (`CREATE TABLE`), DriplareAI implements the **JSONB Entity-Attribute-Value (EAV)** pattern via Neon Postgres & Prisma:

#### Prisma Schema Additions (`prisma/schema/crm.prisma` or `merchant.prisma`):

```prisma
// Definition of merchant-configured custom data models
model CustomTableSchema {
  id          String   @id @default(cuid())
  chatbotId   String
  workspaceId String?
  name        String   // e.g., "Tour Booking", "Table Reservation", "Doctor Appointment"
  slug        String   // e.g., "tour_booking", "table_reservation"
  description String?
  fields      Json     // Array of FieldDef: [{ key: "travelers", label: "Number of Travelers", type: "number", required: true }]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  records     CustomRecord[]
  chatbot     Chatbot  @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)

  @@unique([chatbotId, slug])
  @@index([chatbotId])
}

// Stored records submitted by AI Agent tool calling
model CustomRecord {
  id            String   @id @default(cuid())
  schemaId      String
  chatbotId     String
  sessionId     String?
  customerName  String?
  customerPhone String?
  data          Json     // Key-value payload matching schema fields
  status        String   @default("pending") // "pending" | "confirmed" | "cancelled" | "completed"
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  schema        CustomTableSchema @relation(fields: [schemaId], references: [id], onDelete: Cascade)
  chatbot       Chatbot           @relation(fields: [chatbotId], references: [chatbotId], onDelete: Cascade)

  @@index([schemaId])
  @@index([chatbotId])
}
```

#### Universal Tool Calling Mechanism:
* **Tool Name:** `save_custom_data`
* **HTTP Endpoint:** `POST /api/internal/custom-records` (Secured with `x-n8n-secret`)
* **Prompt Injection:** When schemas exist for a bot, the prompt compiler automatically appends:
  ```text
  [CUSTOM DATA COLLECTION PROTOCOL]
  You have the following intake forms available for this business:
  - Form: "tour_booking" (Fields: destination, travelers_count, travel_date, customer_phone, customer_name)
  When the customer provides the required details, confirm the summary with them. Upon explicit confirmation, execute the `save_custom_data` tool with the schema slug and field payload.
  ```

### 3.3 Dynamic Sandwich Model & Industry State Machines

The prompt compiler dynamically selects Header, Body, and Footer based on category:

| Category | Policy Header Focus | State Machine Footer Focus | Primary Action |
|:---|:---|:---|:---|
| **E-commerce** | Zero guessing on price/stock; mandatory Product Lookup & RAG. | Variant $\rightarrow$ Name/Phone $\rightarrow$ Full Address $\rightarrow$ Summary $\rightarrow$ Confirmation. | `create_order` |
| **Tour & Travel** | Authentic package & seasonal pricing; mandatory RAG consultation. | Destination $\rightarrow$ Travelers Count $\rightarrow$ Travel Date $\rightarrow$ Departure City $\rightarrow$ Phone. | `save_custom_data` (tour_booking) |
| **Healthcare** | **Medical Disclaimer:** Never diagnose or suggest medicines; hospital referral. | Department/Doctor $\rightarrow$ Patient Name & Age $\rightarrow$ Phone $\rightarrow$ Preferred Date/Time. | `save_custom_data` (appointment) |
| **Education** | Accurate course fee and schedule; distinguish online vs offline. | Course Name $\rightarrow$ Student/Parent Name $\rightarrow$ Phone $\rightarrow$ Batch/Time preference. | `save_custom_data` (admission_inquiry) |
| **Real Estate** | Budget & location verification; invite for physical site visit. | Property Type $\rightarrow$ Budget Range $\rightarrow$ Preferred Area $\rightarrow$ Phone $\rightarrow$ Visit Date. | `save_custom_data` (site_visit) |
| **Restaurant** | Dietary & allergen alert; delivery area boundaries. | Dine-in vs Takeaway $\rightarrow$ Guest Count/Items $\rightarrow$ Time/Address $\rightarrow$ Phone. | `save_custom_data` (table/order) |
| **Custom / General** | Grounded strictly in Knowledge Base; polite human handoff. | Inquiry details $\rightarrow$ Customer Name $\rightarrow$ Phone/Email. | `save_custom_data` / `save_lead` |

### 3.4 Blank Canvas & AI-Assisted Setup ("Create from Scratch")

* Added as a first-class card in `InlineWizard.tsx`: `✨ Custom / Create from Scratch (কাস্টম ব্যবসা)`.
* Eliminates rigid predefined questions.
* Features a **One-Click AI Generator**: The merchant describes their business in 1–2 lines (in Bangla, Banglish, or English); a specialized LLM service compiles a tailored prompt and automatically suggests suitable Custom Table Schema fields.

### 3.5 Separation of Wizard Policy vs. Knowledge Base

* **Wizard Schema Focus:** Business operational policies (opening hours, delivery zones, refund terms, booking advance policies).
* **Knowledge Base Focus:** Actual product catalogs, restaurant menus, doctor schedules, course syllabi, hotel packages (uploaded via PDF, DOCX, TXT, or Google Sheets).
* Prevents merchants from being forced into predefined menu/product dropdowns that do not match their inventory.

---

## 4. UI/UX & Merchant Journey Enhancements

1. **Dashboard Custom Data Grid (`/dashboard/chatbots/[id]/records`):**
   * Airtable/Notion-style interactive data grid.
   * View entries per schema tab (e.g. "Table Reservations", "Appointments").
   * Filter, search by phone/name, change status (Pending $\rightarrow$ Confirmed $\rightarrow$ Done).
   * One-click Export to CSV / Excel.

2. **Visual Category Selection Grid (`InlineWizard.tsx`):**
   * Added `travel` category and `custom` blank canvas card.
   * Sample customer query badges under each category (e.g. *"সাজেক ট্যুর প্যাকেজ কত?"*, *"ডাক্তার অ্যাপয়েন্টমেন্ট বুকিং"*).

3. **Schema Field Builder Modal:**
   * Simple UI for merchants to add fields: Field Label, Field Key, Type (`Text`, `Number`, `Date`, `Phone`, `Select`), Required toggle.
   * Pre-built schema templates for each category.

4. **Testing Architecture Preservation:**
   * Keeps the setup page clean and uncluttered.
   * Testing continues to leverage the persistent `LiveWidget` corner bubble and dedicated `/playground` page, avoiding redundant widget panels.

---

## 5. Implementation Roadmap

### Phase 1: Dynamic Prompt Assembler & Travel Schema
- [ ] Add `travel` category configuration to `lib/ai/wizard-schema.ts`.
- [ ] Refactor `lib/ai/prompt-assembler.ts`:
  - `getCategoryHeader(category)`
  - `getCategoryFooter(category)`
  - `getCategoryInstructions(category)`
- [ ] Support dynamic injection of active `CustomTableSchema` intake fields into the prompt.

### Phase 2: Prisma Models & Internal API for Custom Records
- [ ] Add `CustomTableSchema` and `CustomRecord` models to `prisma/schema/merchant.prisma`.
- [ ] Run `npx prisma db push` / migrations.
- [ ] Create API routes:
  - `GET / POST / PUT / DELETE /api/chatbots/[chatbotId]/custom-schemas`
  - `GET / PATCH / DELETE /api/chatbots/[chatbotId]/custom-records`
  - `POST /api/internal/custom-records` (for n8n webhook ingestion with `x-n8n-secret` header auth).

### Phase 3: n8n Core-AI-Brain Tool Routing Upgrade
- [ ] Add `save_custom_data` HTTP Request Tool node in `Core-AI-Brain.json`.
- [ ] Update `AI Agent` system prompt expression in n8n:
  - Conditional inclusion of `Product Lookup` and `Product Cards` ONLY when `chatbotMode === 'ecommerce'`.
  - Always include `RAG Search` (Knowledge Base) for ALL modes.
  - Enable `save_custom_data` tool for custom schemas and booking inquiries.

### Phase 4: UI Enhancements (Wizard & Custom Mode)
- [ ] Update `InlineWizard.tsx`:
  - Visual category cards with query badges.
  - Add `custom` (Blank Canvas) card.
  - Integrate AI-assisted prompt generator for custom mode.
- [ ] Update `SystemPromptGuide.tsx`:
  - Multi-industry guideline examples.
  - Clear guidance on Knowledge Base vs. System Prompt.

### Phase 5: Merchant Records Dashboard View
- [ ] Build `/dashboard/chatbots/[chatbotId]/records` page:
  - Tab selector for each `CustomTableSchema`.
  - Interactive data table (TanStack Table or standard Shadcn UI table).
  - Status change dropdown and CSV download button.
  - "New Schema / Manage Columns" modal.

---

## 6. Testing & Quality Verification Checklist

Before deploying each phase, run the mandatory project verification:
1. `npx vitest run` — Ensure prompt compiler, credit calculation, and translation utilities pass.
2. `npx next lint` — Zero ESLint warnings or errors.
3. `npx tsc --noEmit` — Strict TypeScript validation (zero `any` types).
4. `npm run dev` — Verify UI responsiveness across Dark and Light modes using CSS variables.

---

*Document updated & verified: 2026-10-28*
*Document updated & verified: 2026-10-28*
