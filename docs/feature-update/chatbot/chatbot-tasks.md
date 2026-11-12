# DRIPLARE AI — Universal Chatbot Setup & Custom Entity Engine Tasks

> **সেকশন:** Dashboard → Chatbot Quick Setup & Dynamic Custom Data Engine  
> **ভিত্তি:** `docs/feature-update/chatbot/chatbot-setup-improvement-plan.md`  
> **নিয়ম:** একটি টাস্ক সম্পন্ন হলে `[x]` এবং 🟦 Done (✅) দিয়ে চিহ্নিত করা হয়েছে (AGENTS.md §6 অনুযায়ী)।  

---

## 📌 প্রজেক্ট ওভারভিউ ও লক্ষ্য
1. **Dynamic Tool Routing:** ই-কমার্সের জন্য RAG + Product Lookup + Create Order + Product Cards; নন-ইকমার্সের জন্য RAG + Universal Data Capture (`save_custom_data`)।
2. **Custom Entity Engine (No-Code Database Builder):** মার্চেন্টরা ড্যাশবোর্ড থেকে নিজস্ব ডাটা মডেল (যেমন Table Booking, Tour Booking, Patient Appointment) ডিফাইন করবে এবং AI কাস্টমারের কাছ থেকে ডাটা নিয়ে তা সেভ করবে।
3. **Dynamic Sandwich Model:** হার্ডকোডেড ই-কমার্স ফুটার ও হেডার সরিয়ে ইন্ডাস্ট্রি-ভিত্তিক পলিসি ও স্লট-ফিলিং স্টেট মেশিন।
4. **Blank Canvas / "Custom / Other" Mode:** প্রিসেটের বাইরে যেকোনো ব্যবসার জন্য ১-ক্লিকে AI প্রম্পট জেনারেটর।

---

## Phase 1 — Data Foundation & Prisma Schema — 🟦 Done (✅)

### 1.1 Prisma Schema Models (`prisma/schema/merchant.prisma`)
- [x] **Task 1.1.1** — `CustomTableSchema` মডেল তৈরি (`id`, `chatbotId`, `workspaceId`, `name`, `slug`, `description`, `fields` [Json], `createdAt`, `updatedAt`) 🟦
- [x] **Task 1.1.2** — `CustomRecord` মডেল তৈরি (`id`, `schemaId`, `chatbotId`, `sessionId`, `customerName`, `customerPhone`, `data` [Json], `status`, `notes`, `createdAt`, `updatedAt`) 🟦
- [x] **Task 1.1.3** — `Chatbot` মডেলে `customSchemas CustomTableSchema[]` এবং `customRecords CustomRecord[]` রিলেশন যুক্ত করা 🟦
- [x] **Task 1.1.4** — Prisma schema ভ্যালিডেশন এবং ডেটাবেজ পুশ (`npx prisma db push` — Neon DB pooler synced) 🟦

### 1.2 Custom Entity REST APIs
- [x] **Task 1.2.1** — `/app/api/chatbots/[chatbotId]/custom-schemas/route.ts` — GET (লিস্ট) ও POST (নতুন স্কিমা/কলাম তৈরি) 🟦
- [x] **Task 1.2.2** — `/app/api/chatbots/[chatbotId]/custom-schemas/[schemaId]/route.ts` — GET, PUT (ফিল্ড আপডেট), DELETE 🟦
- [x] **Task 1.2.3** — `/app/api/chatbots/[chatbotId]/custom-records/route.ts` — GET (ফিল্টার, পেজিনেশন, স্কিমা-ভিত্তিক কুয়েরি) 🟦
- [x] **Task 1.2.4** — `/app/api/chatbots/[chatbotId]/custom-records/[recordId]/route.ts` — PATCH (স্ট্যাটাস/নোট আপডেট), DELETE 🟦
- [x] **Task 1.2.5** — `/app/api/internal/custom-records/route.ts` — n8n এবং AI Agent-এর জন্য সিকিউরড (`x-n8n-secret`) ডাটা ইনজেশন POST এন্ডপয়েন্ট 🟦

> **Tracking Data (Phase 1):**  
> • Models: `CustomTableSchema`, `CustomRecord` in `prisma/schema/merchant.prisma` (`@@schema("chatbot")`)  
> • Zod schemas & types: `lib/domain/custom-entity.ts`  
> • Verification: Prisma generate v7.8.0 & Neon Postgres schema sync completed.

---

## Phase 2 — Dynamic Prompt Engine & Wizard Schema Fixes — 🟦 Done (✅)

### 2.1 Missing Travel & Category Schema Update (`lib/ai/wizard-schema.ts`)
- [x] **Task 2.1.1** — `travel` ক্যাটাগরি কনফিগ যোগ করা (গন্তব্য, ভ্রমণের ধরন, দলের আকার, বাজেট রেঞ্জ, ইত্যাদি) 🟦
- [x] **Task 2.1.2** — `custom` (Blank Canvas) উইজার্ড কনফিগ তৈরি (মৌলিক পরিচিতি, লক্ষ্য ও কথা বলার স্টাইল) 🟦
- [x] **Task 2.1.3** — উইজার্ডের প্রশ্নগুলো থেকে আইটেম-লেভেলের জটিল প্রশ্ন সরিয়ে শুধুমাত্র ব্যবসায়িক পলিসি ও রুলস (ডেলিভারি এরিয়া, অগ্রিম পেমেন্ট, রিফান্ড পলিসি)-এ সীমাবদ্ধ করা 🟦

### 2.2 Category-Aware Sandwich Engine (`lib/ai/prompt-assembler.ts`)
- [x] **Task 2.2.1** — ডায়নামিক হেডার ফাংশন `getCategoryHeader(category)` তৈরি (মেডিকেল ডিসক্লেইমার, ট্রাভেল ফেক রেট গার্ড ইত্যাদি) 🟦
- [x] **Task 2.2.2** — ডায়নামিক স্লট-ফিলিং ফুটার `getCategoryFooter(category, customSchemas)` তৈরি (ই-কমার্স, ট্রাভেল, হেলথকেয়ার, এডুকেশন, রেস্টুরেন্ট, রিয়েল এস্টেট) 🟦
- [x] **Task 2.2.3** — `compilePrompt()` ফাংশনে ক্যাটাগরি এবং বটের বিদ্যমান `CustomTableSchema`-এর ফিল্ডগুলো প্রম্পটে স্বয়ংক্রিয়ভাবে ইনজেক্ট করার লজিক যুক্ত করা 🟦
- [x] **Task 2.2.4** — AI-assisted One-Click Prompt Generator API `/app/api/chatbots/generate-custom-prompt/route.ts` তৈরি 🟦

> **Tracking Data (Phase 2):**  
> • Categories in `lib/ai/wizard-schema.ts`: `ecommerce`, `travel`, `restaurant`, `healthcare`, `education`, `real_estate`, `lead_gen`, `support`, `custom`, `general`.  
> • Assembler in `lib/ai/prompt-assembler.ts`: exports `getCategoryHeader`, `getCategoryFooter`, `getCategoryInstructions`, `compilePrompt` (with custom schema injection support).  
> • Dynamic prompt compilation updated in `app/api/chatbots/wizard-compile/route.ts` and `app/api/chatbots/[chatbotId]/chat/route.ts`.

---

## Phase 3 — n8n Core-AI-Brain Upgrade & Tool Routing — 🟦 Done (✅)

### 3.1 n8n Workflow Tool Architecture (`docs/n8n-JSON/Core-AI-Brain.json`)
- [x] **Task 3.1.1** — `save_custom_data` HTTP Request Tool নোড তৈরি (`POST /api/internal/custom-records` কল করার জন্য) 🟦
- [x] **Task 3.1.2** — `AI Agent` নোডের সিস্টেম প্রম্পটে ডায়নামিক কন্ডিশন যোগ করা:
  * যদি `chatbotMode === 'ecommerce'` হয় $\rightarrow$ `Product Lookup`, `Create Order`, ও `Product Cards` সক্রিয় হবে।
  * সবার জন্য (ই-কমার্স সহ) $\rightarrow$ `RAG Search` (Knowledge Base) সক্রিয় থাকবে।
  * যদি কাস্টম স্কিমা থাকে $\rightarrow$ `save_custom_data` টুল সক্রিয় থাকবে। 🟦
- [x] **Task 3.1.3** — `Format Response` কোড নোডে কাস্টম ডাটা সেভ রেসিপ্ট হ্যান্ডলিং যোগ করা 🟦
- [x] **Task 3.1.4** — আপডেট করা JSON n8n-এ টেস্ট করা ও রিপোজিটরির `docs/n8n-JSON/Core-AI-Brain.json`-এ আপডেট সিঙ্ক করা 🟦

> **Tracking Data (Phase 3):**  
> • Node: `Save Custom Data` (httpRequestTool, ID: `78b4a391-e412-4c8d-9a81-d419b45e8f23`)  
> • Target URL: `https://driplare-ai.vercel.app/api/internal/custom-records`  
> • Headers: `x-n8n-secret`, Auth: `httpHeaderAuth`  
> • Connection: Wired into `AI Agent` as an `ai_tool`.  
> • Contract verified via Vitest workflow drift validation.

---

## Phase 4 — Chatbot Setup UI/UX Enhancements — 🟦 Done (✅)

### 4.1 Inline Wizard Visual Redesign (`components/chatbots/InlineWizard.tsx`)
- [x] **Task 4.1.1** — ক্যাটাগরি কার্ডে বাস্তবসম্মত কাস্টমার কুয়েরি ব্যাজ যোগ করা (যেমন: ট্রাভেলের নিচে *"সাজেক ট্যুর প্যাকেজ কত?"*) 🟦
- [x] **Task 4.1.2** — `✨ Custom / Create from Scratch` প্রমিনেন্ট কার্ড যুক্ত করা 🟦
- [x] **Task 4.1.3** — কাস্টম কার্ডে ১-ক্লিকে AI প্রম্পট জেনারেশন ইনপুট মডাল/বক্স যোগ করা (`Dialog`, `handleOneClickAiGenerate`) 🟦
- [x] **Task 4.1.4** — প্রতিটি উইজার্ড ফিল্ডে অপশনাল স্কিপ এবং ক্লিয়ার হেল্পার টেক্সট যোগ করা 🟦

### 4.2 System Prompt Guide Update (`components/chatbots/SystemPromptGuide.tsx`)
- [x] **Task 4.2.1** — ইন্ডাস্ট্রি-ভিত্তিক গাইডলাইন ট্যাব/সুইচার যোগ করা (E-commerce, Healthcare, Travel, Education, Custom) 🟦
- [x] **Task 4.2.2** — "কী লিখবেন বনাম কী নলেজবেসে আপলোড করবেন" অংশটি আরও স্পষ্ট ও আকর্ষণীয় করা 🟦
- [x] **Task 4.2.3** — সমস্ত টেক্সট এবং লোকালস সিঙ্ক করা (`public/locales/{en|bn}/common.json` & `chatbots.json`) 🟦

### 4.3 Setup Categories & Wizard Dual-Language Localization (i18n) — 🟦 Done (✅)
- [x] **Task 4.3.1** — `public/locales/en/chatbots.json` এবং `public/locales/bn/chatbots.json`-এ সম্পূর্ণ `"wizard"` ট্রান্সলেশন সেকশন যুক্ত করা 🟦
- [x] **Task 4.3.2** — `components/chatbots/wizard-field-control.tsx`-এ `renderFieldControl`-কে `isBn` সাপোর্টেড করা 🟦
- [x] **Task 4.3.3** — `components/chatbots/InlineWizard.tsx`-এ `useTranslation("chatbots")` ইন্টিগ্রেশন এবং `CATEGORY_SAMPLE_QUERIES`-কে ইংরেজি ও বাংলা উভয় ভাষায় ডায়নামিক করা 🟦
- [x] **Task 4.3.4** — ক্যাটাগরি কার্ডের টাইটেল ও সাবটাইটেল ভাষা পরিবর্তনের সাথে স্বয়ংক্রিয়ভাবে রেন্ডার হওয়া (`isBn ? cfg.titleBn : cfg.title`) 🟦
- [x] **Task 4.3.5** — উইজার্ডের স্টেপ কাউন্টার, ন্যাভিগেশন বাটন, ফর্ম লেবেল এবং ১-ক্লিক AI মডাল ডায়ালগ সম্পূর্ণ দ্বি-ভাষিক করা 🟦

> **Tracking Data (Phase 4.3):**  
> • Files updated: `public/locales/{en|bn}/chatbots.json`, `components/chatbots/InlineWizard.tsx`, `components/chatbots/wizard-field-control.tsx`.  
> • Verification: TypeScript zero error (`tsc --noEmit`), Vitest 35/35 suites (765 tests) passed.

---

## Phase 5 — Merchant Custom Data & Records Dashboard — 🟦 Done (✅)

### 5.1 Custom Records Page (`app/(dashboard)/dashboard/chatbots/[chatbotId]/records/`)
- [x] **Task 5.1.1** — `/dashboard/chatbots/[chatbotId]/records/page.tsx` তৈরি (Airtable / Notion স্টাইল ডাটা গ্রিড) 🟦
- [x] **Task 5.1.2** — স্কিমা-ভিত্তিক ট্যাব সুইচার (যেমন: "Table Bookings", "Patient Appointments") 🟦
- [x] **Task 5.1.3** — ডাটা ফিল্টারিং, সার্চ এবং স্ট্যাটাস পরিবর্তন (Pending $\rightarrow$ Confirmed $\rightarrow$ Completed $\rightarrow$ Cancelled) 🟦
- [x] **Task 5.1.4** — CSV / Excel ডাউনলোড ক্লায়েন্ট-সাইড এক্সপোর্ট ফিচার 🟦
- [x] **Task 5.1.5** — "Manage Columns / New Schema" মডাল ডায়ালগ (`SchemaManagerModal.tsx` with 5 1-click industry templates) 🟦
- [x] **Task 5.1.6** — সাইডবারে অথবা চ্যাটবট সাব-নেভিগেশনে "Data Records" লিংক যুক্ত করা (`components/layout/bot-nav.ts`, `components/layout/dashboardHeader.tsx`) 🟦
- [x] **Task 5.1.7** — কাস্টম ফর্ম এডিটিং অপশন যুক্ত করা (`SchemaManagerModal.tsx` Edit Pencil বাটন, `PUT /api/chatbots/[id]/custom-schemas/[schemaId]`, কলাম/ফিল্ড ও ড্রপডাউন অপশন আপডেট) 🟦

> **Tracking Data (Phase 5):**  
> • Main Page: `app/(dashboard)/dashboard/chatbots/[chatbotId]/records/page.tsx`  
> • Records Table Grid: `app/(dashboard)/dashboard/chatbots/[chatbotId]/records/_components/RecordsTable.tsx`  
> • Schema Manager Drawer: `app/(dashboard)/dashboard/chatbots/[chatbotId]/records/_components/SchemaManagerModal.tsx`  
> • Nav Items: Added to `components/layout/bot-nav.ts` with icon `Table2` and route `/dashboard/chatbots/${chatbotId}/records`.

---

## Phase 6 — Quality Assurance & Testing — 🟦 Done (✅)

- [x] **Task 6.1** — Vitest টেস্ট স্যুট এক্সিকিউট করা (`npx vitest run`) — **35/35 Test Files Passed, 765/765 Tests Passed** 🟦
- [x] **Task 6.2** — ESLint চেকিং (`npm run lint`) — Clean on all new/modified files 🟦
- [x] **Task 6.3** — TypeScript টাইপ ভেরিফিকেশন (`npx tsc --noEmit`) — **0 Errors across entire codebase** 🟦
- [x] **Task 6.4** — Development Server রান ও মোবাইল/ডেস্কটপ রেসপন্সিভনেস এবং ডার্ক/লাইট মোড চেক 🟦

---

*Last Updated: 2026-10-28 17:30:00 (Setup Dual-Language Localization Verified & Complete)*

