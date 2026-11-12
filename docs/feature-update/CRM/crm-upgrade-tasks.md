# DRIPLARE AI — CRM Full Upgrade Task List

> **শুরু:** ২৭ অক্টোবর ২০২৬  
> **লক্ষ্য:** DRIPLARE AI-কে পূর্ণাঙ্গ CRM Platform-এ রূপান্তর  
> **নিয়ম:** একটি task শেষ হলে ✅ দিয়ে চিহ্নিত করা হয়েছে।

---

## Phase 1 — Data Foundation (সর্বোচ্চ অগ্রাধিকার)

### 1.1 Prisma Schema — নতুন CRM models

- [x] **Task 1.1.1** — নতুন `crm` schema namespace তৈরি (`prisma/schema/crm.prisma`)। Models: `Contact`, `ContactIdentity`, `Deal`, `DealStageHistory`, `CrmTask`, `CrmActivity`, `ContactTagAssignment` ✅
- [x] **Task 1.1.2** — `merchant.prisma` এ `Order` model-এ nullable `contactId String?` field ও index যোগ ✅
- [x] **Task 1.1.3** — `base.prisma`-এ `crm` datasource schema register করা ✅
- [x] **Task 1.1.4** — Prisma migration / DB push সম্পন্ন (`npx prisma db push`) ✅

### 1.2 Data Lifecycle Fix

- [x] **Task 1.2.1** — `/app/api/user/delete/route.ts` — Contact cascade delete যোগ ✅
- [x] **Task 1.2.2** — `/app/api/user/export/route.ts` — Contact, Deal, Task data export-এ include করা ✅
- [x] **Task 1.2.3** — `CustomerProfile` workspaceId cleanup ও CRM Contact isolation ✅

### 1.3 Workspace-wide Contacts API

- [x] **Task 1.3.1** — `/app/api/crm/contacts/route.ts` — GET (workspace-wide, filter, paginate) + POST (create contact) endpoint ✅
- [x] **Task 1.3.2** — `/app/api/crm/contacts/[contactId]/route.ts` — GET, PATCH, DELETE ✅
- [x] **Task 1.3.3** — `/app/api/crm/contacts/[contactId]/timeline/route.ts` — unified activity timeline GET ✅
- [x] **Task 1.3.4** — `/app/api/crm/contacts/[contactId]/merge/route.ts` — duplicate merge POST ✅
- [x] **Task 1.3.5** — `/app/api/crm/contacts/import/route.ts` — CSV bulk import POST ✅

---

## Phase 2 — Daily Sales CRM (Core Workflow)

### 2.1 Sidebar Restructure

- [x] **Task 2.1.1** — `components/layout/Sidebar.tsx` — নতুন "CRM" collapsible group যোগ (Contacts, Deals & Pipeline, Tasks & Follow-ups) ✅
- [x] **Task 2.1.2** — "Leads & Customers" → "Contacts" rename ও i18n link ✅
- [x] **Task 2.1.3** — `/dashboard/leads` → `/dashboard/contacts` route-level redirect ✅

### 2.2 Contacts List Page (Leads Page Redesign)

- [x] **Task 2.2.1** — `/app/(dashboard)/dashboard/contacts/page.tsx` — নতুন page তৈরি (workspace-wide, Contact model) ✅
- [x] **Task 2.2.2** — Saved Views / Lifecycle stage tabs (New, Engaged, Qualified, Customer, Repeat, Lapsed) ✅
- [x] **Task 2.2.3** — Lifecycle stage column + filter + search + sort ✅
- [x] **Task 2.2.4** — View contact, deals & tasks counts ✅
- [x] **Task 2.2.5** — `Create Contact` modal dialog ✅
- [x] **Task 2.2.6** — CSV Export (Name, Phone, Email, Stage, Channel, Created) ✅

### 2.3 Contact 360 Profile Page

- [x] **Task 2.3.1** — `/app/(dashboard)/dashboard/contacts/[contactId]/page.tsx` — full profile page তৈরি ✅
- [x] **Task 2.3.2** — Overview tab: editable properties, phone, email, address, district, marketing & SMS consent switch ✅
- [x] **Task 2.3.3** — Timeline tab: CrmActivity unified feed ✅
- [x] **Task 2.3.4** — Quick action buttons: Open Live Chat, Create Deal, Add Task ✅
- [x] **Task 2.3.5** — Deals & Tasks tab: inline task completion ও deal list ✅
- [x] **Task 2.3.6** — Orders tab placeholder ✅

### 2.4 Deals & Pipeline

- [x] **Task 2.4.1** — `/app/api/crm/deals/route.ts` — GET (filter by stage/owner/contact) + POST ✅
- [x] **Task 2.4.2** — `/app/api/crm/deals/[dealId]/route.ts` — GET, PATCH ✅
- [x] **Task 2.4.3** — `/app/api/crm/deals/[dealId]/stage/route.ts` — PATCH (stage change → DealStageHistory + CrmActivity log) ✅
- [x] **Task 2.4.4** — `/app/(dashboard)/dashboard/deals/page.tsx` — Kanban board + Table view toggle ✅
- [x] **Task 2.4.5** — Deal card & Stage columns (New, Contacted, Qualified, Proposal, Negotiation, Won, Lost) ✅
- [x] **Task 2.4.6** — Create Deal modal form with contact auto-search ✅
- [x] **Task 2.4.7** — Stage change sheet with Lost reason tracking ✅

### 2.5 Tasks & Follow-ups

- [x] **Task 2.5.1** — `/app/api/crm/tasks/route.ts` — GET (filter by status/dueToday/overdue) + POST ✅
- [x] **Task 2.5.2** — `/app/api/crm/tasks/[taskId]/route.ts` — PATCH (complete, reassign) ✅
- [x] **Task 2.5.3** — `/app/(dashboard)/dashboard/tasks/page.tsx` — task list (All, Due Today, Overdue, Completed tabs) ✅
- [x] **Task 2.5.4** — Task quick-complete check button ✅
- [x] **Task 2.5.5** — Overdue count badge indicator ✅

---

## Phase 3 — Retention & Reporting

### 3.1 CRM Analytics

- [x] **Task 3.1.1** — `/app/api/analytics/crm/route.ts` — pipeline KPIs, funnel, won/lost, winRate, overdueTasks, stage breakdown ✅

### 3.2 CRM Automation Triggers & Actions

- [x] **Task 3.2.1** — `lib/automations/schema.ts` — নতুন CRM triggers (`contact.created`, `contact.lifecycle_changed`, `deal.created`, `deal.stage_changed`, `deal.won`, `deal.lost`, `task.overdue`, etc.) ✅
- [x] **Task 3.2.2** — `lib/automations/schema.ts` — নতুন CRM actions (`create_task`, `create_deal`, `update_lifecycle`, `update_deal_stage`, `send_internal_alert`) ✅

### 3.3 i18n — CRM Namespace

- [x] **Task 3.3.1** — `public/locales/en/crm.json` & `public/locales/bn/crm.json` — Contact & CRM labels ✅
- [x] **Task 3.3.2** — `public/locales/en/pipeline.json` & `public/locales/bn/pipeline.json` — Deals & Pipeline labels ✅

---

## Phase 4 — Advanced (পরবর্তী সংস্করণ)

### 4.1 Inventory Management
- [ ] **Task 4.1.1** — `ProductVariant` + `InventoryMovement` schema
- [ ] **Task 4.1.2** — Variant-level stock API

### 4.2 Company / Account (B2B)
- [ ] **Task 4.2.1** — `Company` model design + association

### 4.3 Public API & Webhooks
- [ ] **Task 4.3.1** — Public REST API & Webhooks

---

## Quality Status
- ✅ Database Schema Synced with Neon PostgreSQL (`crm` schema created)
- ✅ API Endpoints Tested & Verified
- ✅ Sidebar Navigation Reorganized
- ✅ Responsive UI with Dark & Light Mode Theme Support
