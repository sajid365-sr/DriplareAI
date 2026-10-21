# Driplare AI — Meta Business Suite Chrome Extension (Manifest V3)

এই Chrome Extension-টি ব্যবহার করে সরাসরি **Meta Business Suite** (`business.facebook.com`) এর ভেতর থেকেই Driplare AI নিয়ন্ত্রণ করা যায়।

---

## 🌟 সুবিধাসমূহ (Features)

1. **AI এক ক্লিকে Pause/Resume:** মেটা ইনবক্সে গ্রাহকের সাথে কথা বলার সময় প্রয়োজন অনুযায়ী AI চালু বা বন্ধ রাখা।
2. **AI Moderator Assistant:** ইনবক্সের কথোপকথনের ইনস্ট্যান্ট সারসংক্ষেপ (Summary) ও ১-ক্লিকে বেস্ট রিপ্লাই সাজেশন।
3. **টিম মেম্বার অ্যাসাইনমেন্ট:** Business Suite-এর ভেতরেই চ্যাটটি দলের নির্দিষ্ট সদস্যকে অ্যাসাইন করা।
4. **সহজ কানেকশন:** Driplare AI ড্যাশবোর্ড থেকে API কী সেট করে সরাসরি কানেক্ট করা।

---

## 🚀 কীভাবে ইনস্টল ও টেস্ট করবেন (Installation Guide)

1. গুগল ক্রোম ব্রাউজার ওপেন করুন এবং এড্রেসবারে লিখুন: `chrome://extensions`
2. উপরে ডান কোণে **"Developer mode"** টগলটি অন করুন।
3. **"Load unpacked"** বাটনে ক্লিক করুন।
4. এই ফোল্ডারটি সিলেক্ট করুন: `docs/feature-update/chrome-extension/`
5. এক্সটেনশনটি লোড হয়ে যাবে।
6. মেটা বিজনেস স্যুট ওপেন করুন: `https://business.facebook.com/latest/inbox/`
7. নিচে ডান কোণে Driplare AI Copilot ফ্লোটিং বাটন দেখতে পাবেন!

---

## 📂 ফাইল স্ট্রাকচার

- `manifest.json`: Manifest V3 কনফিগারেশন ও পারমিশন
- `background.js`: ব্যাকগ্রাউন্ড সার্ভিস ওয়ার্কার (API প্রক্সি ও স্টোরেজ ম্যানেজমেন্ট)
- `content.js`: Meta Business Suite পেজে ফ্লোটিং সাইডবার ডক ইনজেক্ট করার স্ক্রিপ্ট
- `sidebar.css`: ড্রিপ্লেয়ার এর সিগনেচার ভায়োলেট থিম স্টাইল
- `popup.html`: এক্সটেনশন টুলবার পপআপ (API URL ও টোকেন কনফিগারেশন)

