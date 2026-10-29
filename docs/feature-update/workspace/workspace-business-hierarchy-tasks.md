# DRIPLARE AI — Workspace-Centric Architecture & Hierarchy Tasks

> **সেকশন:** Workspace Category, 1-to-1 Channel Binding & Hierarchical Knowledge  
> **ভিত্তি:** `docs/feature-update/workspace/workspace-business-hierarchy-ux-plan.md`  
> **নিয়ম:** একটি টাস্ক সম্পন্ন হলে `[x]` এবং 🟦 Done (✅) দিয়ে চিহ্নিত করা হবে (AGENTS.md §6 অনুযায়ী)।

---

## 📌 ওভারভিউ ও লক্ষ্য

1. **Workspace Business Category:** ওয়ার্কস্পেস টেবিলে `category` যুক্ত করা এবং ওয়ার্কস্পেস তৈরি/এডিট মোডালে ক্যাটাগরি পিকার প্রদান করা।
2. **Workspace-Centric Business Zone সাইডবার:** সাইডবারকে অ্যাক্টিভ ওয়ার্কস্পেসের ক্যাটাগরি অনুযায়ী স্থির এবং স্বয়ংক্রিয়ভাবে অ্যাডাপ্ট করা।
3. **1-to-1 Channel Binding:** প্রতিটি ফেসবুক পেজ/হোয়াটসঅ্যাপ নম্বরে একটি সময়ে মাত্র ১টি সক্রিয় বট বাইন্ড করা এবং কনফ্লিক্ট মুক্ত রাখা।
4. **Hierarchical Knowledge Base:** নলেজবেসে গ্লোবাল ওয়ার্কস্পেস ফাইল এবং বট-স্পেসিফিক ফাইলের ডুয়েল সাপোর্ট নিশ্চিত করা।
5. **RAG & Search Alignment:** এআই কুয়েরির সময় গ্লোবাল ও বট নলেজের কম্বাইন্ড রিটার্ন নিশ্চিত করা।

---

## Phase 1 — Database Schema & Data Foundation

- [x] **Task 1.1** 🟦 Done — `prisma/schema/` এ `Workspace` মডেলে `category` ফিল্ড (`String @default("ecommerce")`) এবং `customBusinessTitle` যোগ করা।
- [x] **Task 1.2** 🟦 Done — `Source` মডেলে `isGlobal Boolean @default(false)` ফিল্ড যোগ করা যাতে ওয়ার্কস্পেস-ব্যাপী নলেজ ট্র্যাক করা যায়।
- [x] **Task 1.3** 🟦 Done — Prisma ডেটাবেজ পুশ (`npx prisma db push`) এবং ক্লায়েন্ট রিজেনারেশন (`npx prisma generate`) সম্পন্ন করা।

---

## Phase 2 — Workspace Management & Category Selection UI

- [x] **Task 2.1** 🟦 Done — ওয়ার্কস্পেস ক্রিয়েশন ও এডিট মোডালে (`WorkspaceSwitcher.tsx` বা সংশ্লিষ্ট কম্পোনেন্টে) সুন্দর বিজনেস ক্যাটাগরি সিলেক্টর (E-Commerce, Healthcare, Travel, Restaurant, Custom ইত্যাদি) যুক্ত করা।
- [x] **Task 2.2** 🟦 Done — `/api/workspaces` এর POST ও PATCH রুটে `category` এবং `customBusinessTitle` সেভ করার হ্যান্ডলার আপডেট করা।
- [x] **Task 2.3** 🟦 Done — অ্যাক্টিভ ওয়ার্কস্পেসের ক্যাটাগরি রিট্রিভ করার জন্য ওয়ার্কস্পেস কন্টেক্সট বা হুক আপডেট করা।

---

## Phase 3 — Sidebar Alignment with Workspace Category

- [x] **Task 3.1** 🟦 Done — `components/layout/Sidebar.tsx`-এ বটের পরিবর্তে সরাসরি `activeWorkspace.category` থেকে "Business Zone" নির্ধারণ করা।
- [x] **Task 3.2** 🟦 Done — যদি ওয়ার্কস্পেস `ecommerce` হয় $\rightarrow$ Products, Orders, Couriers, Discounts মেনু রেন্ডার করা।
- [x] **Task 3.3** 🟦 Done — যদি ওয়ার্কস্পেস নন-ইকমার্স (Healthcare, Travel ইত্যাদি) হয় $\rightarrow$ সেই ওয়ার্কস্পেসের কাস্টম ফর্ম ও ডাটা রেকর্ডস সাব-মেনু রেন্ডার করা।

---

## Phase 4 — 1-to-1 Channel Binding Architecture

- [x] **Task 4.1** 🟦 Done — ইন্টিগ্রেশন লেভেলে (যেমন Facebook Page Connect) পেজ প্রতি সর্বোচ্চ ১টি বট অ্যাসাইনমেন্ট গার্ড নিশ্চিত করা।
- [x] **Task 4.2** 🟦 Done — চ্যাটবট তালিকা পেজে (`/dashboard/chatbots`) প্রতিটি বটের পাশে স্পষ্ট চ্যানেল ব্যাজ প্রদর্শন করা (যেমন: 🟢 Connected: *Trendirect FB Page* বা ⚪ Standby)।
- [x] **Task 4.3** 🟦 Done — চ্যানেলে এক ক্লিকে অ্যাসাইনড বট পরিবর্তন (1-Click Agent Swap) করার UI/ড্রপডাউন নিশ্চিত করা।

---

## Phase 5 — Hierarchical Knowledge Base (Workspace + Bot)

- [x] **Task 5.1** 🟦 Done — `/dashboard/knowledge-base` পেজে দুটি ট্যাব বা সেকশন তৈরি করা:
  - 🏢 *Company Wide Knowledge (Shared with all agents)*
  - 🤖 *Agent Specific Knowledge*
- [x] **Task 5.2** 🟦 Done — সোর্স আপলোড API (`/api/chatbots/[id]/sources` বা গ্লোবাল রুট)-এ `isGlobal: true` দিয়ে আপলোড করার সুবিধা প্রদান করা।
- [x] **Task 5.3** 🟦 Done — RAG সার্চ রুটে কিউরি করার সময় `workspaceId` এর গ্লোবাল সোর্স এবং বর্তমান বটের নিজস্ব সোর্স মিলিয়ে কনটেক্সট প্রিপেয়ার করা।

---

## Phase 6 — Quality Assurance & Testing

- [x] **Task 6.1** 🟦 Done — TypeScript টাইপ ভেরিফিকেশন (`npx tsc --noEmit`) — ০টি এরর নিশ্চিত করা।
- [x] **Task 6.2** 🟦 Done — Vitest টেস্ট স্যুট এক্সিকিউট করা (`npx vitest run`) — সমস্ত টেস্ট পাস নিশ্চিত করা।
- [x] **Task 6.3** 🟦 Done — ডার্ক/লাইট মোড এবং মোবাইল রেসপন্সিভনেস রিভিউ করা।

> **QA note:** `npx next lint` Next.js 16-এ আর সমর্থিত নয়। `npm run lint` পুরো repository-তে বিদ্যমান lint error দেখায়; এই feature-এর পরিবর্তিত ফাইলগুলোতে ESLint error নেই (একটি `<img>` optimization warning আছে)।

---

_Created: 2026-10-28 22:42:00_

**Task 5.1 follow-up:** Workspace Knowledge Base now uses the same FAQs, Sample Replies, Content Training, and Auto-Train Engine tabs as Agent-Specific Knowledge. Content Training uses the Add Content drawer (Files/Text/Website) instead of a direct workspace textarea.

