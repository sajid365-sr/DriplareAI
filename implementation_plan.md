# Meta API (Facebook/WhatsApp/Instagram) Integration Plan

এই ধাপে আমরা Facebook Page-এর সাথে Chatbot কানেক্ট করার সম্পূর্ণ ফ্লো তৈরি করব এবং UI-কে আরও মডার্ন করব।

## User Review Required
> [!IMPORTANT]
> **Meta App Setup:** এই ইন্টিগ্রেশনটি কাজ করার জন্য আপনাকে [Meta for Developers](https://developers.facebook.com/) পোর্টালে একটি App তৈরি করতে হবে।
> আপনার প্রয়োজন হবে:
> 1. `FACEBOOK_APP_ID`
> 2. `FACEBOOK_APP_SECRET`
> এগুলো আমাদের `.env` ফাইলে যুক্ত করতে হবে। আপনি কি একটি Meta App তৈরি করেছেন? না করে থাকলে আমি গাইড করতে পারব।

## Proposed Changes

### 1. Environment Variables
- `.env` ফাইলে `NEXT_PUBLIC_FACEBOOK_APP_ID` এবং `FACEBOOK_APP_SECRET` যোগ করতে হবে।

### 2. Frontend UI Update (`Integrations` Page)
- **Modern Look:** কার্ডগুলোকে আরও প্রিমিয়াম লুক দেওয়া হবে (glassmorphism বা subtle gradient)।
- **Facebook Login Flow:** 
  - "Connect Facebook" বাটনে ক্লিক করলে Facebook SDK ব্যবহার করে লগইন পপআপ আসবে।
  - পারমিশন চাইবে: `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, এবং `pages_messaging`।
- **Page Selection Modal:**
  - লগইন সফল হলে ইউজারের সব Facebook Page-এর লিস্ট একটি সুন্দর Modal-এ দেখাবে।
  - ইউজার যে পেজে চ্যাটবট কানেক্ট করতে চায়, সেটা সিলেক্ট করে "Connect" বাটনে ক্লিক করবে।

#### [MODIFY] `app/app/chatbots/[chatbotId]/integrations/page.tsx`
- Facebook SDK লোড করার জন্য স্ক্রিপ্ট যোগ করা।
- UI/UX রিডিজাইন করা এবং Modal কম্পোনেন্ট তৈরি করা।

### 3. Backend API Routes
নতুন কিছু API রাউট তৈরি করতে হবে যা Facebook Graph API এর সাথে কথা বলবে।

#### [NEW] `app/api/chatbots/[chatbotId]/integrations/facebook/pages/route.ts`
- ফ্রন্টএন্ড থেকে পাওয়া User Access Token ব্যবহার করে Facebook থেকে পেজের লিস্ট এবং Page Access Token ফেচ করবে।

#### [NEW] `app/api/chatbots/[chatbotId]/integrations/facebook/connect/route.ts`
- ইউজার পেজ সিলেক্ট করার পর, এই রাউটটি সেই নির্দিষ্ট পেজের Webhook সাবস্ক্রাইব করবে।
- ডাটাবেসের `Integration` টেবিলে Page Access Token এবং Page ID সেভ করবে।

#### [MODIFY] `app/api/webhooks/meta/route.ts` (বা নতুন তৈরি করা)
- Facebook থেকে আসা মেসেজগুলো রিসিভ করার জন্য একটি Webhook Endpoint তৈরি করতে হবে।
- মেসেজ রিসিভ করে আমাদের LLM (Gemini) এর কাছে পাঠাবে এবং রিপ্লাই আবার Facebook-এ সেন্ড করবে।

## Verification Plan

### Manual Verification
1. `Integrations` পেজে গিয়ে "Connect Facebook" বাটনে ক্লিক করা।
2. Facebook লগইন পপআপ আসা এবং পারমিশন দেওয়া।
3. পেজের লিস্ট দেখা এবং একটি পেজ সিলেক্ট করা।
4. ডাটাবেসে চেক করা যে Page Access Token সেভ হয়েছে কি না।
5. Facebook পেজে মেসেজ দিয়ে চেক করা চ্যাটবট রিপ্লাই দিচ্ছে কি না (Webhook verification এর পর)।
