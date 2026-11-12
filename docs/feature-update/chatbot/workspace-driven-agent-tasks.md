# DRIPLARE AI — Workspace-Driven Agent Setup Tasks

> **সেকশন:** Chatbot / Agent Setup Decoupling from Business Category  
> **ভিত্তি:** Workspace-Centric Business Architecture  
> **নিয়ম:** একটি টাস্ক সম্পন্ন হলে `[x]` এবং 🟦 Done (✅) দিয়ে চিহ্নিত করা হবে (AGENTS.md §6 অনুযায়ী)।

---

## 📌 ওভারভিউ ও লক্ষ্য

বর্তমানে চ্যাটবট সেটআপে (Setup Wizard) মার্চেন্টকে পুনরায় ১০টি বিজনেস ক্যাটাগরি (E-Commerce, Healthcare, Travel ইত্যাদি) থেকে ক্যাটাগরি বাছাই করতে হতো। যেহেতু প্রতিটি Workspace-এর একটি নির্দিষ্ট Business Category আগেই নির্ধারিত থাকে (যেমন: Khidmah Pharma = Healthcare, Trendirect = E-Commerce), তাই চ্যাটবট লেভেলে এই ক্যাটাগরি বাছাইয়ের গ্রিড সম্পূর্ণ অপ্রয়োজনীয় এবং কনফিউজিং ছিল।

**বাস্তবায়িত লক্ষ্য:**
1. চ্যাটবটের ভেতর থেকে পুরানো "Choose your business category" গ্রিড সফলভাবে অপসারণ করা হয়েছে।
2. চ্যাটবট স্বয়ংক্রিয়ভাবে তার প্যারেন্ট Workspace-এর বিজনেস ক্যাটাগরি ও নাম অ্যাডাপ্ট করছে।
3. উইজার্ডে সরাসরি ওই ব্যবসার জন্য প্রাসঙ্গিক তথ্য ও Agent Role / Persona (যেমন: Sales, Support, Appointment Booking) কনফিগার করার সুবিধা যুক্ত করা হয়েছে।

---

## Phase 1 — Context & Category Auto-Inheritance

- [x] **Task 1.1** 🟦 Done — চ্যাটবটের Setup পেজ (`/dashboard/chatbots/[chatbotId]/setup`) এবং `chat-settings.tsx`-এ প্যারেন্ট Workspace-এর ক্যাটাগরি সরাসরি কন্টেক্সট/প্রপস হিসেবে পাস করা।
- [x] **Task 1.2** 🟦 Done — চ্যাটবট ক্রিয়েশন ও আপডেট API-তে বট মোড স্বয়ংক্রিয়ভাবে অ্যাক্টিভ ওয়ার্কস্পেসের ক্যাটাগরির সাথে কঠোরভাবে সিঙ্ক রাখা।

---

## Phase 2 — InlineWizard Refactor (Category Grid Replacement)

- [x] **Task 2.1** 🟦 Done — `components/chatbots/InlineWizard.tsx` থেকে ১০টি বিজনেসের ক্যাটাগরি সিলেকশন গ্রিড অপসারণ করা।
- [x] **Task 2.2** 🟦 Done — উইজার্ড হেডার ডিজাইন আপডেট: বর্তমান ওয়ার্কস্পেসের বিজনেস পরিচয় (যেমন: 🏥 *Khidmah Pharma • Healthcare / Clinic*) ব্যাজ আকারে দেখানো।
- [x] **Task 2.3** 🟦 Done — উইজার্ড সরাসরি অ্যাক্টিভ ওয়ার্কস্পেসের বিজনেসের স্টেপস (Fields Form) লোড করছে এবং ব্র্যান্ড নেম অটো-পপুলেট করছে।
- [x] **Task 2.4** 🟦 Done — One-Click AI সেটআপ মডাল বজায় রাখা এবং তা ওয়ার্কস্পেসের ক্যাটাগরি অনুযায়ী প্রম্পট জেনারেট করার উপযোগী করা।

---

## Phase 3 — Agent Persona & Role Integration

- [x] **Task 3.1** 🟦 Done — উইজার্ডের শুরুতে বটের রোল/পার্সোনা নির্বাচনের অপশন যুক্ত করা (যেমন: *Doctor Appointment & Serial Booking*, *Sales & Order Assistant*, *Customer Support & Order Tracking* ইত্যাদি)।
- [x] **Task 3.2** 🟦 Done — `lib/ai/wizard-schema.ts`-এ বটের পার্সোনা এবং ব্যবসার তথ্য সমন্বয় করে নিখুঁত সিস্টেম প্রম্পট কম্পাইল করা।

---

## Phase 4 — Localization & UI Polish

- [x] **Task 4.1** 🟦 Done — বাংলা ও ইংরেজি i18n ডিকশনারি (`chatbots.json`) আপডেট করা যাতে কোনো হার্ডকোডেড টেক্সট না থাকে।
- [x] **Task 4.2** 🟦 Done — ডার্ক মোড এবং মোবাইল রেসপন্সিভনেস নিশ্চিত করা।

---

## Phase 5 — Quality Assurance & Testing

- [x] **Task 5.1** 🟦 Done — TypeScript টাইপ ভেরিফিকেশন (`cmd /c npx tsc --noEmit`) — ০টি এরর নিশ্চিত করা।
- [x] **Task 5.2** 🟦 Done — Vitest টেস্ট স্যুট এক্সিকিউট করা (`cmd /c npx vitest run`) — সমস্ত ৭৬৫টি টেস্ট পাস নিশ্চিত করা।

---

_Updated: 2026-10-29 13:04:00_

