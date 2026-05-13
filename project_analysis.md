# 🔍 Driplare AI — প্রজেক্ট সম্পূর্ণ বিশ্লেষণ ও গাইডলাইন

## 🌟 Project Overview
**Driplare AI** একটি অত্যাধুনিক **AI-driven Omnichannel Chatbot প্ল্যাটফর্ম**। এটি মূলত ছোট এবং মাঝারি পর্যায়ের ব্যবসায়ীদের (SMBs) জন্য ডিজাইন করা হয়েছে, যাতে তারা তাদের কাস্টমার সার্ভিস এবং সেলস অটোমেশনকে আরও স্মার্ট ও সাশ্রয়ী করতে পারে। 

### আমরা কী সেবা দিচ্ছি?
১. **Omnichannel Presence:** ব্যবসায়ী তার একটি চ্যাটবটকেই ফেসবুক মেসেঞ্জার, হোয়াটসঅ্যাপ, ইনস্টাগ্রাম এবং নিজস্ব ওয়েবসাইটে কানেক্ট করতে পারেন।
২. **AI Intelligence (RAG):** ব্যবসায়ী তার ব্যবসার তথ্য (যেমন: প্রাইস লিস্ট, সার্ভিস ডিটেইলস) PDF বা টেক্সট ফাইল আকারে আপলোড করলে চ্যাটবট সেই তথ্যের ভিত্তিতে গ্রাহকদের নিখুঁত উত্তর দিতে পারে।
৩. **Human-like Interaction:** লেটেস্ট LLM (Gemini/OpenAI) ব্যবহার করার ফলে চ্যাটবটগুলো অত্যন্ত সাবলীল এবং প্রফেশনালভাবে গ্রাহকদের সাথে কথা বলতে পারে।

### গ্রাহক কীভাবে উপকৃত হচ্ছে?
- **24/7 Support:** কোনো মানুষ ছাড়াই চ্যাটবট ২৪ ঘণ্টা কাস্টমারের প্রশ্নের উত্তর দিচ্ছে।
- **Cost Efficiency:** একজন কাস্টমার সাপোর্ট এজেন্টের চেয়ে অনেক কম খরচে AI সব চ্যাট হ্যান্ডেল করছে।
- **Increased Sales:** দ্রুত উত্তর পাওয়ার ফলে কাস্টমাররা সার্ভিস বা প্রোডাক্ট কেনার ব্যাপারে দ্রুত সিদ্ধান্ত নিতে পারছে।

## 💳 SaaS & Business Model
Driplare AI একটি **Subscription-based SaaS (Software as a Service)** মডেলে চলে। 

- **Tiered Pricing:** গ্রাহকরা তাদের ব্যবহারের ধরন অনুযায়ী ভিন্ন ভিন্ন প্ল্যান (Starter, Growth, Business, Enterprise) বেছে নিতে পারেন।
- **Message Quota System:** প্রতিটি প্ল্যানে নির্দিষ্ট সংখ্যক "AI Messages" বরাদ্দ থাকে। কোটা শেষ হলে গ্রাহকরা বাড়তি চার্জের বিনিময়ে সার্ভিস চালু রাখতে পারেন।
- **Platform Restrictions:** প্ল্যান অনুযায়ী চ্যাটবট সংখ্যা এবং প্ল্যাটফর্ম অ্যাক্সেস (যেমন: Starter-এ শুধু Facebook) নিয়ন্ত্রিত হয়।
- **Scalability:** গ্রাহকের ব্যবসা বাড়ার সাথে সাথে সে খুব সহজেই তার প্ল্যান আপগ্রেড করতে পারে।

---

## 📦 Tech Stack

| স্তর | প্রযুক্তি |
|------|-----------|
| **Framework** | Next.js 16.2.4 (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 + shadcn/ui |
| **Animation** | Framer Motion |
| **Auth** | Clerk (v7) |
| **Database** | PostgreSQL (Neon) via Prisma 5.22 + pgvector extension |
| **ORM** | Prisma (with Accelerate extension) |
| **LLM** | OpenRouter API (OpenAI SDK দিয়ে কল করা হয়) |
| **Embedding** | `openai/text-embedding-3-small` via OpenRouter |
| **Payment** | Stripe (USD) + UddoktaPay (BDT) |
| **Webhook** | Clerk + Stripe + UddoktaPay + Meta (Facebook) |
| **i18n** | i18next + react-i18next |
| **Forms** | react-hook-form + zod |
| **Charts** | recharts |
| **File Parsing** | mammoth (DOCX), pdf-parse (PDF), cheerio (web scraping) |
| **Toast** | sonner (Global Toaster implemented) |
| **State Management**| Zustand (for Global Modals/Confirmations) |

---

## 🗄️ Database স্কিমা (Prisma + PostgreSQL + pgvector)

### মডেলসমূহ:

| মডেল | কাজ |
|------|-----|
| **User** | ইউজার ডেটা — plan (free/pro), points, referral system |
| **Chatbot** | প্রতিটি চ্যাটবট — model, provider, temperature, systemPrompt, status |
| **Source** | Knowledge base এর ফাইল/টেক্সট/ওয়েবসাইট এন্ট্রি |
| **Chunk** | Source-এর ছোট ছোট অংশ + pgvector embedding |
| **ChatMessage** | প্রতিটি চ্যাট সেশনের মেসেজ |
| **ChatSession** | চ্যাট সেশন ট্র্যাকিং (sessionId, guestName, platform, isActive/Manual toggle) |
| **Integration** | Facebook/WhatsApp ইত্যাদি প্ল্যাটফর্ম কানেকশন + Health status (status, lastError) |
| **PaymentTransaction** | Payment রেকর্ড (Stripe/UddoktaPay) |
| **Referral** | রেফারেল সিস্টেম |

---

## 🔐 Authentication

- **Provider:** Clerk v7
- **Middleware:** `clerkMiddleware` দিয়ে প্রটেকশন। 
- **Strategy:** Dedicated `/sign-in` ও `/sign-up` পেজ (App Router compatible)
- **Middleware:** `clerkMiddleware` দিয়ে সব route protect করা
- **Public Routes:** `/`, `/sign-in`, `/sign-up`, `/pricing`, `/tutorial`, `/api/webhooks/*`
- **User Sync:** `getAndSyncUser()` — Clerk userId → Prisma User DB sync (migration-safe)
- **Webhook:** `/api/webhooks/clerk` — Clerk ইভেন্ট হ্যান্ডেল করার জন্য
- **Global Confirmation:** `ConfirmModal` সিস্টেম ইম্প্লিমেন্ট করা হয়েছে (Zustand + Shadcn Dialog), যা সব ডিলিট অপারেশনে পারমিশন নেওয়ার জন্য ব্যবহৃত হয়।

---

## 🤖 LLM ও Embedding (RAG Pipeline)

- **LLM Gateway:** OpenRouter (`https://openrouter.ai/api/v1`) — OpenAI SDK দিয়ে কল
- **Available Models:**
  - `gemini-2.5-flash-lite` (default, low-cost)
  - `gemini-2.0-flash-lite-001` (oldest, cheapest)
- **Embedding Model:** `openai/text-embedding-3-small` via OpenRouter
- **RAG Pipeline:**
  1. Text normalize → split → embed → pgvector-এ store
  2. Query embed → cosine distance (`<=>`) দিয়ে relevant chunk খোঁজো
  3. Context inject → LLM-এ পাঠাও
- **Accuracy:** Cosine distance threshold 0.65 এ সেট করা।

---

## 📚 Knowledge Base (Source Ingestion)

### সাপোর্টেড Source টাইপ:
| টাইপ | বিবরণ |
|------|--------|
| `file` | PDF (pdf-parse), DOCX (mammoth) |
| `text` | সরাসরি টেক্সট ইনপুট |
| `website` | URL scraping (cheerio + axios) |

### প্রক্রিয়া:
1. Text normalize (max 50,000 chars)
2. `RecursiveCharacterTextSplitter` দিয়ে chunk (800 chars, 120 overlap)
3. OpenRouter-এ embed → pgvector-এ store
4. Semantic search: cosine distance threshold 0.65, max 3,500 chars context

---

## 💰 Payment System

### দুটো গেটওয়ে:
| Gateway | Currency | প্যাকেজ |
|---------|----------|---------|
| **Stripe** | USD | Pro Monthly — $29 |
| **UddoktaPay** | BDT | Pro Monthly — ৳2,900 |

### Payment Flow:
- `/api/payments/checkout` → Stripe session তৈরি
- `/api/payments/uddoktapay` → UddoktaPay redirect
- Webhook → payment verify → user plan upgrade (`pro`) + 10,000 points

### প্ল্যান সিস্টেম:
- **Free:** 100 points (signup-এ দেওয়া হয়)
- **Pro:** 10,000 points (payment সম্পন্ন হলে)

---

## 🌐 Integrations (Social Media)

`Integration` মডেলে এগুলো store হয়:
- **Facebook** — connect/disconnect (config JSON-এ token/page_id)
- **Instagram** — coming soon
- **WhatsApp** — connect/disconnect
- **Custom API, Website, Webhook, Telegram, Slack** — listed

> ⚠️ **বর্তমান অবস্থা:** Integration UI আছে, connect/disconnect API আছে — কিন্তু প্রকৃত Meta API / WhatsApp Business API integration এখনও implemented নয়।

---

## 📁 Route Structure

```
app/
├── page.tsx                          # Landing page
├── (auth)/
│   ├── sign-in/                      # Clerk sign-in page
│   └── sign-up/                      # Clerk sign-up page
├── app/                              # Protected dashboard
│   ├── chatbots/
│   │   ├── page.tsx                  # Chatbot list
│   │   ├── new/                      # Create chatbot
│   │   └── [chatbotId]/
│   │       ├── edit/                 # Edit chatbot settings
│   │       ├── chat/                 # Test chatbot
│   │       ├── sources/              # Knowledge base management
│   │       ├── integrations/         # Platform integrations
│   │       ├── analytics/            # Usage analytics
│   │       ├── activity/             # Activity log
│   │       └── compare/              # Model comparison
│   ├── settings/                     # User settings
│   ├── usage/                        # Usage stats
│   └── payment/                      # Payment pages
├── api/
│   ├── chatbots/[chatbotId]/
│   │   ├── route.ts                  # CRUD chatbot
│   │   ├── chat/                     # Chat API (LLM call)
│   │   ├── sources/                  # Source CRUD + embedding
│   │   ├── integrations/             # Integration CRUD
│   │   ├── analytics/                # Analytics data
│   │   ├── messages/                 # Message history
│   │   └── compare/                  # Model comparison
│   ├── payments/
│   │   ├── checkout/                 # Stripe checkout
│   │   └── uddoktapay/               # BDT payment
│   ├── usage/                        # Usage data API
│   └── webhooks/
│       ├── clerk/                    # Clerk user events
│       ├── stripe/                   # Stripe payment events
│       └── uddoktapay/               # UddoktaPay events
```

---

## 🎨 Design System

- **Color Scheme:** Violet-based (`262° hsl`) — Light + Dark mode
- **Primary Color:** `hsl(262, 83%, 58%)` — Violet/Purple
- **Dark Mode:** Very dark violet (`260 50% 4%`)
- **Components:** shadcn/ui + custom components
- **Fonts:** Geist Sans + Geist Mono (Next.js built-in)
- **Animations:** Framer Motion (stagger, fade-in, slide-up)
- **Icons:** lucide-react v1.11

---

## ✅ সম্পন্ন করা হয়েছে (Recently Completed)

- **Library:** i18next + react-i18next
- **Languages:** সম্ভবত English + Bengali (Bangla support mention আছে)
- **Toggle:** `LanguageToggle` component আছে

---

## ⚙️ Environment Variables

| Variable | কাজ |
|----------|-----|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk auth |
| `CLERK_SECRET_KEY` | Clerk server auth |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook verify |
| `DATABASE_URL` | Neon PostgreSQL |
| `OPENROUTER_API_KEY` | LLM + Embedding |
| `STRIPE_SECRET_KEY` | Stripe payment |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client |
| `UDDOKTAPAY_HOSTED_URL` | BDT payment gateway |

---

## ✅ যা ভালোভাবে আছে

- ✅ App Router structure সঠিক
- ✅ Clerk auth + middleware সঠিকভাবে implemented
- ✅ RAG pipeline (chunk + embed + semantic search) কাজ করছে
- ✅ Dual payment gateway (USD + BDT) আছে
- ✅ Referral system schema আছে
- ✅ Dark/Light mode আছে
- ✅ i18n support আছে
- ✅ Knowledge base (file/text/website) সব টাইপ supported
- ✅ Facebook Meta API Integration করা আছে
 
 ---
 
 ## 🤖 n8n Hybrid Backend (Low-code Automation)
 
 ### আর্কিটেকচার:
 বর্তমানে প্ল্যাটফর্মটি একটি **Hybrid Architecture** অনুসরণ করছে। 
 - **Frontend (Next.js):** ইউজার ইন্টারফেস, অথেন্টিকেশন (Clerk), এবং পেমেন্ট ম্যানেজমেন্ট।
 - **Automation Backend (n8n):** জটিল প্ল্যাটফর্ম ইন্টিগ্রেশন এবং ফাইল ইনজেশন।
 
 ### n8n ব্যবহারের উদ্দেশ্য:
 1. **Dynamic Platform Routing:** একটি মাত্র n8n workflow দিয়ে হাজার হাজার চ্যাটবটের ফেসবুক/হোয়াটসঅ্যাপ মেসেজ হ্যান্ডেল করা (PostgreSQL Lookup এর মাধ্যমে)।
 2. **Advanced Knowledge Ingest:** ভারি ফাইল (Excel, CSV, Large PDF) পার্স করার কাজ n8n-এ অফলোড করা, যা নেক্সট জেএস সার্ভারের লোড কমায়।
 3. **Activity Synchronization:** n8n সরাসরি `ChatMessage` টেবিলে ডেটা ইনসার্ট করে ফ্রন্টএন্ডের সাথে সিঙ্কে থাকে।
 
 ### টেস্টিং এনভায়রনমেন্ট:
 - **n8n Facebook (Test):** কোড মডিফাই না করে আলাদা ভাবে n8n এর মাধ্যমে চ্যাট অটোমেশন পরীক্ষা করার জন্য তৈরি করা হয়েছে।
 - **n8n Source Ingest:** সরাসরি n8n-এ ফাইল পাঠিয়ে ভেক্টর এম্বেডিং করার জন্য একটি ডেডিকেটেড `N8nSourceUploader` কম্পোনেন্ট তৈরি করা হয়েছে।

## ⚠️ যা এখনও অসম্পূর্ণ / উন্নত করার সুযোগ আছে

- ⚠️ WhatsApp/Instagram/Website Widget — প্রকৃত Meta API integration নেই (UI আছে মাত্র)
- ⚠️ `CLERK_WEBHOOK_SECRET` — `.env`-এ empty
- ⚠️ শুধু 2টি LLM model available (আরও যোগ করা যায়)
- [x] **Functional Usage Dashboard:** ডাইনামিক ডেট ফিল্টারিং (২৪ ঘণ্টা, ৩০ দিন, কাস্টম) এবং মডুলার কম্পোনেন্ট আর্কিটেকচার।
- [x] **API-Level Plan Enforcement:** চ্যাটবট এবং ইন্টিগ্রেশন লিমিট (Starter: Facebook only) ব্যাকএন্ডে এনফোর্স করা হয়েছে।
- [x] **Subscription Management:** ইউজারদের জন্য পেমেন্ট পেজে প্ল্যান ক্যানসেল এবং অটোমেটিক ডাউনগ্রেড সুবিধা।
- [x] **Global Agent Rules:** `AGENTS.md` এর মাধ্যমে প্রজেক্টের ডিজাইন এবং কোডিং গাইডলাইন ফিক্সড করা হয়েছে।
- [x] **Payment Layout Redesign:** হোয়াইড লেআউট এবং হরিজন্টাল ট্যাব সিস্টেম।
- [x] **Global Toast System:** `sonner` এর মাধ্যমে সব অ্যাকশনে (Connect/Delete/Save) সুন্দর নোটিফিকেশন।
- [x] **Custom Confirm Modal:** ব্রাউজারের পপ-আপ সরিয়ে প্রফেশনাল মডাল উইন্ডো।
- [x] **Meta Health Tracking:** টোকেন এরর হ্যান্ডলিং এবং ইউজারকে প্রো-অ্যাক্টিভ নোটিফাই করা।
- [x] **Activity UI Redesign:** প্রিমিয়াম চ্যাট ইন্টারফেস এবং সেশন ম্যানেজমেন্ট।
- ⚠️ **Advanced Analytics:** চ্যাটবটের পারফরম্যান্স ও ইউজার সেন্টিমেন্ট অ্যানালাইসিস (Pending)।
- ⚠️ **Referral Logic:** স্কিমা আছে কিন্তু রিওয়ার্ড ডিস্ট্রিবিউশন লজিক বাকি।



---

### Cloudflare Tunnel Command:
`npx cloudflared tunnel --url http://localhost:3000`
`npx cloudflared tunnel --url http://127.0.0.1:3000`

