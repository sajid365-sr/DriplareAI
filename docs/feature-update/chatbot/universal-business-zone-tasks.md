# DRIPLARE AI — Universal "Business Zone" & Dynamic Form Navigation Tasks

> **সেকশন:** Main Navigation & Data Records Overhaul  
> **ভিত্তি:** `docs/feature-update/chatbot/universal-records-ux-plan.md`  
> **নিয়ম:** একটি টাস্ক সম্পন্ন হলে `[x]` এবং 🟦 Done (✅) দিয়ে চিহ্নিত করা হবে (AGENTS.md §6 অনুযায়ী)।

---

## 📌 ওভারভিউ ও লক্ষ্য

1. **Universal Business Zone:** হার্ডকোডেড "E-Commerce Store" প্রিভিলেজ অপসারণ করে একটি সর্বজনীন "Business Zone" প্রতিষ্ঠা করা।
2. **ডায়নামিক মেনু আইটেমস:**
   - যদি `chatbotMode === 'ecommerce'` হয় $\rightarrow$ ই-কমার্স ড্রপডাউন (Products, Orders, Couriers, Discounts) প্রদর্শিত হবে।
   - যদি নন-ইকমার্স (Healthcare, Travel, Restaurant, Education, Real Estate, Custom) হয় $\rightarrow$ মার্চেন্টের তৈরি করা কাস্টম ফর্মগুলো (যেমন: `🩺 Doctor Serial`, `✈️ Tour Bookings`) সরাসরি সাইডবারে সাব-মেনু হিসেবে দৃশ্যমান হবে।
3. **জিরো নেস্টিং ডিরেক্ট এক্সেস:** সাইডবারের ফর্ম আইটেমে ক্লিক করলেই সরাসরি `/dashboard/records?schema={slug}`-এ ওপেন হবে।
4. **AI ইন্টেলিজেন্স ও নির্দেশনার স্বচ্ছতা:** রেকর্ডস পেজের শীর্ষে স্পষ্ট ব্যানার যা দেখাবে AI কোন ইনটেন্টে কাস্টমার থেকে কী কী প্রশ্ন করে ডাটা সংগ্রহ করবে।
5. **মার্চেন্ট কাস্টম ব্র্যান্ডিং:** মার্চেন্ট চাইলে সাইডবারের "Business Zone"-এর নাম নিজের মতো কাস্টমাইজ করতে পারবে।

---

## Phase 1 — Database & Data Foundation — 🟦 Done (✅)

- [x] **Task 1.1** — `prisma/schema/merchant.prisma`-এর `Chatbot` মডেলে `customBusinessZoneTitle String?` ফিল্ড যুক্ত করা 🟦
- [x] **Task 1.2** — Prisma schema ভ্যালিডেশন এবং ডেটাবেজ পুশ (`npx prisma db push`) 🟦
- [x] **Task 1.3** — Prisma Client রিজেনারেট করা (`npx prisma generate`) 🟦

---

## Phase 2 — API & Data Fetching for Sidebar — 🟦 Done (✅)

- [x] **Task 2.1** — `/api/chatbots/sidebar-context` এন্ডপয়েন্ট প্রস্তুত করা 🟦
- [x] **Task 2.2** — চ্যাটবটের `customBusinessZoneTitle` আপডেট করার জন্য PATCH/PUT হ্যান্ডলার নিশ্চিত করা 🟦

---

## Phase 3 — Main Sidebar "Business Zone" Implementation — 🟦 Done (✅)

- [x] **Task 3.1** — `components/layout/Sidebar.tsx`-এ "ecom" সেকশনকে "Business Zone"-এ রূপান্তর করা 🟦
- [x] **Task 3.2** — সক্রিয় চ্যাটবটের মোড (`chatbotMode`) অনুযায়ী ডায়নামিক ব্রাঞ্চিং (ইকমার্স / কাস্টম ফর্ম সাব-মেনু) 🟦
- [x] **Task 3.3** — কাস্টম ফর্ম মেনুর নিচে `+ Manage / Add Forms` বাটন যুক্ত করা 🟦
- [x] **Task 3.4** — লোকাল ডিকশনারি (`common.json`) আপডেট: দ্বি-ভাষিক অনুবাদ যোগ করা 🟦

---

## Phase 4 — Master Records Page & URL Schema Query Navigation — 🟦 Done (✅)

- [x] **Task 4.1** — `/dashboard/records` মাস্টার রুট তৈরি করা (স্বয়ংক্রিয় বট ও স্কিমা রিডাইরেক্ট) 🟦
- [x] **Task 4.2** — `?schema={slug}` কুয়েরি প্যারাম হ্যান্ডলিং সম্পন্ন করা 🟦
- [x] **Task 4.3** — সাইডবার ও ইউআরএল ম্যাপিং এর মাধ্যমে বট ন্যাভিগেশন নিশ্চিত করা 🟦

---

## Phase 5 — AI Intelligence & Workflow Transparency Banner — 🟦 Done (✅)

- [x] **Task 5.1** — `AiDirectiveBanner.tsx` কম্পোনেন্ট তৈরি করা 🟦
- [x] **Task 5.2** — ব্যানারে ট্রিগার ইনটেন্ট, ফিল্ড প্রশ্নমালা ও কনফার্মেশন প্রটোকল প্রদর্শন 🟦
- [x] **Task 5.3** — ওয়ান-ক্লিক `⚡ Test in Playground` এবং `📑 View System Directive` বাটন যুক্ত করা 🟦
- [x] **Task 5.4** — রেকর্ডস টেবিলে ফোন নম্বরের পাশে WhatsApp ও Direct Call অ্যাকশন যুক্ত করা 🟦

---

## Phase 6 — Merchant Branding & Section Customization — 🟦 Done (✅)

- [x] **Task 6.1** — রেকর্ডস পেজের হেডারে সেকশন নাম এডিট ও পেন্সিল বাটন যুক্ত করা 🟦
- [x] **Task 6.2** — সেভ করলে PATCH API কল হওয়া ও সাইডবার টাইটেল ডায়নামিক্যালি আপডেট হওয়া 🟦

---

## Phase 7 — Quality Assurance & Testing — 🟦 Done (✅)

- [x] **Task 7.1** — TypeScript টাইপ ভেরিফিকেশন (`npx tsc --noEmit`) — ০টি এরর পাস 🟦
- [x] **Task 7.2** — Vitest টেস্ট স্যুট এক্সিকিউট করা (৩৫/৩৫ টেস্ট ফাইল ও ৭৬৫টি টেস্ট পাস) 🟦
- [x] **Task 7.3** — ডার্ক ও লাইট মোড এবং মোবাইল রেসপন্সিভনেস নিশ্চিত করা 🟦

---

_Last Updated: 2026-10-28 21:25:00_

## Workspace category and global form navigation follow-up

- [x] Seed category-specific default tables for each new AI Agent and provision missing defaults for existing agents (Doctor Serial / Patient Records, Traveler Data / Tour Bookings, and equivalent category templates).
- [x] Render category tables from the active Workspace in the main sidebar, keep custom tables below them, and place **+ Manage Form** last.
- [x] Move the records and form manager experience to `/dashboard/records`; redirect legacy `/dashboard/chatbots/[chatbotId]/records` URLs there.
- [x] Verify with TypeScript, 765 Vitest tests, changed-file ESLint, and a successful dev page/API render.
