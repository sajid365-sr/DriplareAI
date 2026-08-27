# Implementation Plan — Live Chat Playground & OpenRouter Token Logging Fix

Chat Playground থেকে মেসেজ দিলে ডুপ্লিকেট চ্যানেল তৈরি (`Live Chat Playground` এবং `Web Test`), ডাবল ক্রেডিট ডিডাকশন এবং OpenRouter লগে অনাকাঙ্ক্ষিত ২য় এন্ট্রি ও টোকেন/খরচের অমিল দূর করার প্রযুক্তিগত পরিকল্পনা।

## Root Cause Analysis (সমস্যার মূল কারণ)

1. **ডুপ্লিকেট চ্যানেল ও ক্রেডিট ডিডাকশন (`Live Chat Playground` vs `Web Test`)**:
   - `app/api/chatbots/[chatbotId]/chat/route.ts` এন্ডপয়েন্টটি n8n-এ পাঠানোর সময় `platform: "web_test"` পাঠাচ্ছিল।
   - n8n `Core-AI-Brain` মেসেজ প্রসেস করার পর ডাটাবেজের `AIUsageLog` টেবিলে `channel: "web_test"` দিয়ে এন্ট্রি ইনসার্ট করছিল এবং ইউজার ক্রেডিট কাটছিল।
   - কিন্তু এর পরপরই Next.js এন্ডপয়েন্টটি ব্যাকএন্ডে পুনরায় `logAiUsage({ channel: "playground" })` কল করছিল।
   - **ফলাফল**: ১টি মেসেজের জন্য ২বার লগ রেকর্ড হচ্ছিল এবং ২বার ইউজার ক্রেডিট কাটা যাচ্ছিল।

2. **OpenRouter লগে ডাবল এন্ট্রি ও টোকেন/খরচের অমিল**:
   - n8n `Core-AI-Brain.json`-এ `AI Agent` নোডটি OpenRouter-এ আসল AI মেসেজ জেনারেট করছিল (যা আপনার লগে ১,৮৫৪ টোকেন ও $0.00703 খরচ দেখায়)।
   - এর পরপরই `Fetch OpenRouter Usage Payload` নামক একটি অতিরিক্ত HTTP Request নোড `max_tokens: 1` দিয়ে OpenRouter-এ ২য় একটি ডামি কল পাঠাচ্ছিল টোকেন কাউন্ট জানার উদ্দেশ্যে।
   - **ফলাফল**: OpenRouter-এ ২য় কলের নতুন বিল হচ্ছিল (৮৬১ ইনপুট টোকেন ও ১ আউটপুট টোকেন, $0.0026 খরচ) এবং ডাটাবেজে এই ২য় ডামি কলের ৮৬২ টোকেন সেভ হচ্ছিল, যা আসল ১,৮৫৪ টোকেন ও খরচের সাথে মিলছিল না।

---

## Proposed Changes

### 1. Next.js API Layer

#### [MODIFY] [route.ts](file:///c:/Users/User/Projects/DriplareAI/app/api/chatbots/%5BchatbotId%5D/chat/route.ts)
- n8n Webhook-এ পাঠানোর সময় `platform: "playground"` এবং `channel: "playground"` মেটাডাটা পাস করা।
- রেসপন্স পাওয়ার পর ডুপ্লিকেট `logAiUsage` কলটি সরিয়ে নেওয়া (কারণ n8n `Core-AI-Brain` ডাটাবেজ ইনসার্ট এবং ক্রেডিট ডিডাকশন একবারে সম্পন্ন করে)।

---

### 2. n8n Workflows

#### [MODIFY] [Core-AI-Brain.json](file:///c:/Users/User/Projects/DriplareAI/docs/n8n-JSON/Core-AI-Brain.json)
- `Fetch OpenRouter Usage Payload` নোডটি রিমুভ / বাইপাস করা যাতে OpenRouter-এ অনাকাঙ্ক্ষিত ২য় ডামি কল না যায়।
- `AI Agent` নোড সরাসরি `Format Response`-এ ডাটা পাঠাবে।
- `Format Response` কোড নোডে ইনপুট কনটেক্সট (System Prompt + Knowledge Context + User Message) এবং AI এর প্রাপ্ত উত্তর থেকে টোকেন মেট্রিক্স (Prompt & Completion Tokens) এবং OpenRouter প্রাইসিং ফর্মুলা অনুযায়ী খরচ (USD & BDT) নিখুঁতভাবে হিসাব করা।

#### [MODIFY] [Web-Playground-Integration.json](file:///c:/Users/User/Projects/DriplareAI/docs/n8n-JSON/Web-Playground-Integration.json)
- `Validate & Normalize Payload` ও `Build Brain Payload` নোডে ইনকামিং `channel` সঠিক ভাবে `playground` হিসেবে হ্যান্ডেল করা নিশ্চিত করা।

---

## Verification Plan

### Automated / API Verification
1. `npm run dev` চালু অবস্থায় Playground থেকে চ্যাট মেসেজ ট্রিগার করা।
2. n8n workflow execution ইতিহাস চেক করা।

### Manual Verification
1. **OpenRouter Console**: চেক করা যে ১টি মেসেজ পাঠালে OpenRouter Generation Logs-এ মাত্র ১টি এন্ট্রি তৈরি হয় (অনাকাঙ্ক্ষিত ২য় ডামি কল বন্ধ হয়েছে)।
2. **Admin Panel Cost Analytics**: Admin Panel-এর `Workspaces -> Cost Analytics` ট্যাবে গিয়ে চেক করা যে কেবল `Live Chat Playground` ফিল্টারে ১টি সঠিক এন্ট্রি ও সঠিক টোকেন সংখ্যা দেখাচ্ছে।
3. **Neon Database**: Neon DB-এর `billing.AIUsageLog` টেবিলে চেক করা যে `sessionId` এবং `channel` হিসেবে একমাত্র `playground` যুক্ত হয়েছে এবং ডুপ্লিকেট `web_test` বন্ধ হয়েছে।
