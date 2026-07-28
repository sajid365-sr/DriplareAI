# ল্যান্ডিং পেজ আপডেট — ইমপ্লিমেন্টেশন প্ল্যান

> **Status:** ✅ সব প্রশ্নের উত্তর পাওয়া গেছে — কার্যকর করার জন্য প্রস্তুত।

## সংক্ষিপ্ত বিবরণ

ডকুমেন্ট `docs/markdown/Landing Page Structure & Content.md` অনুযায়ী বর্তমান ল্যান্ডিং পেজ (`app/(root)/page.tsx`) সম্পূর্ণভাবে আপডেট করা হবে। বর্তমান পেজে শুধু Hero + Features + CTA আছে। নতুন ডিজাইনে ৭টি সেকশন যোগ হবে।

---

## নতুন সেকশন স্ট্রাকচার (ডকুমেন্ট অনুযায়ী)

| # | সেকশন | বিবরণ | Reference |
|---|-------|---------|-----------|
| 1 | **Hero** | AI Sales Agent ভিজুয়াল + Watch Demo (/tutorial) + Book Live Demo (Modal) + ৩ দিনের ফ্রি ট্রায়াল ব্যাজ | lazychat.io |
| 2 | **How it Works / Live Demo** | Autoplay HTML `<video>` (`/public/Assets/AIAgentDemo.mp4`) — সেলস এজেন্ট সেলস ক্লোজ করছে + অর্ডার লিস্টিং | probahoai.com |
| 3 | **What our Agent Can Do** | Key Features গ্রিড | lazychat.io/#features |
| 4 | **Supported Channels** | Facebook, WhatsApp, Instagram, Telegram ইত্যাদি চ্যানেল লোগো/আইকন | — |
| 5 | **Before & After** | চ্যাটবট ইন্টিগ্রেশনের আগে ও পরের তুলনা | usenodi.com |
| 6 | **Pricing Preview** | মূল্য তালিকা প্রিভিউ কার্ড + `/pricing` লিংক | usenodi.com |
| 7 | **FAQ** | কমন প্রশ্নের উত্তর (Accordion) | — |

---

## ✅ কনফার্মড সিদ্ধান্তসমূহ

| বিষয় | সিদ্ধান্ত |
|-------|----------|
| **Demo ভিডিও** | HTML `<video>` ট্যাগ, autoplay, loop, muted, src: `/public/Assets/AIAgentDemo.mp4` |
| **Watch Demo বাটন** | `/tutorial` পেজে redirect করবে |
| **Pricing সেকশন** | Preview কার্ড + `/pricing` পেজের লিংক |
| **Hero ডানপাশের ভিজুয়াল** | বর্তমান চ্যাট মকআপ থেকে পরিবর্তন করে Modern Animated AI Agent ভিজুয়াল যোগ করা হবে |

### 💡 Book Live Demo — প্রস্তাবনা (Option B)

1. **Option B — ইন-সাইট Booking Modal (প্রস্তাবিত):** "Book Live Demo" বাটন ক্লিক করলে একটি ইন-সাইট Modal খুলবে যেখানে নাম, ইমেইল, ফোন নম্বর ও সময় চাওয়া হবে। এটি সেভ থাকবে বা ইমেইল নোটিফিকেশন পাঠাবে। ব্যবহারকারী সাইটের বাইরে যাবে না, UX বজায় থাকবে।

---

## প্রস্তাবিত পরিবর্তন

---

### Section 1: Hero (আপডেট)

#### [MODIFY] [page.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/app/%28root%29/page.tsx)

**পরিবর্তন:**
- Hero ডানপাশের চ্যাট মকআপ **পরিবর্তন করা হবে** → Animated AI Agent ভিজুয়াল (CSS + Framer Motion)
- **৩টি CTA বাটন:**
  - `Start Free` → `/sign-up` (primary, বড়)
  - `Watch Demo` → `/tutorial` (outline)
  - `Book Live Demo` → Modal খুলবে (secondary)
- Hero-তে "৩ দিনের ফ্রি ট্রায়াল" ব্যাজ যোগ হবে

---

### Section 2: How it Works / Live Demo (নতুন)

#### [NEW] [components/landing/DemoSection.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/components/landing/DemoSection.tsx)

**বিবরণ:**
- HTML `<video>` ট্যাগ ব্যবহার করে `/public/Assets/AIAgentDemo.mp4` লোড করা হবে
- `autoPlay`, `loop`, `muted`, `playsInline` — পেজ লোড হলেই স্মুথ প্লে হবে
- ভিডিওর চারপাশে সুন্দর border & glow shadow frame
- probahoai.com reference স্টাইল

---

### Section 3: What our Agent Can Do (আপডেট)

#### [NEW] [components/landing/FeaturesSection.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/components/landing/FeaturesSection.tsx)

**বিবরণ:**
- Lazychat.io/#features স্টাইলে ফিচার কার্ডসমূহ রিডিজাইন
- Interactive hover effects ও Framer Motion

---

### Section 4: Our Supported Channels (নতুন)

#### [NEW] [components/landing/ChannelsSection.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/components/landing/ChannelsSection.tsx)

**বিবরণ:**
- Facebook, WhatsApp, Instagram, Telegram, TikTok, Website লোগো
- Infinite animated marquee / grid view

---

### Section 5: Before & After (নতুন)

#### [NEW] [components/landing/BeforeAfterSection.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/components/landing/BeforeAfterSection.tsx)

**বিবরণ:**
- "আগে" (ম্যানুয়াল রিপ্লাই, স্লো, কাস্টমার ড্রপ) vs "পরে" (ইনস্ট্যান্ট AI রিপ্লাই, ২৪/৭ সেলস ক্লোজিং)
- usenodi.com reference ডিজাইন

---

### Section 6: Pricing Preview (নতুন)

#### [NEW] [components/landing/PricingPreviewSection.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/components/landing/PricingPreviewSection.tsx)

**বিবরণ:**
- প্রাইসিং কার্ড প্রিভিউ (Starter, Growth, Pro)
- "See all plans & features →" বাটন, যা `/pricing` পেজে নিয়ে যাবে

---

### Section 7: FAQ (নতুন)

#### [NEW] [components/landing/FAQSection.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/components/landing/FAQSection.tsx)

**বিবরণ:**
- Accordion আকারে সবচেয়ে কমন প্রশ্ন উত্তর
- i18n সাপোর্ট (EN + BN)

---

### Book Live Demo Modal (নতুন)

#### [NEW] [components/landing/BookDemoModal.tsx](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/components/landing/BookDemoModal.tsx)

**বিবরণ:**
- Shadcn `Dialog` ব্যবহার করে ফর্ম (নাম, ইমেইল, ফোন, মেসেজ)

---

### Translation Files

#### [MODIFY] [home.json (EN)](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/public/locales/en/home.json)
#### [MODIFY] [home.json (BN)](file:///d:/Sajid%20Sorker/Programming/Projects/DriplareAI/public/locales/bn/home.json)

---

## Verification Plan

### Automated
- Build check: `npm run build`

### Manual
- Desktop + Mobile responsive layout
- Dark / Light mode UI
- English & Bengali language toggle test
- HTML5 Video playback verification (`/public/Assets/AIAgentDemo.mp4`)
