# DRIPLARE AI — "Business Zone" & Dynamic Form Navigation Architecture

> **মূল লক্ষ্য:** সাইডবারে হার্ডকোডেড "E-Commerce" প্রিভিলেজ দূর করে একটি সর্বজনীন **"Business Zone"** প্রতিষ্ঠা করা — যেখানে ই-কমার্সের ক্ষেত্রে তাদের শপ মেনু আসবে এবং অন্যান্য ব্যবসার ক্ষেত্রে তাদের তৈরি করা কাস্টম ফর্মগুলো (Doctor Serial, Tour Bookings, Table Reservations) সরাসরি সাব-মেনু হিসেবে দৃশ্যমান হবে।

---

## ১. নতুন সাইডবার আর্কিটেকচার (The "Business Zone" Concept)

```
[সবার জন্য ইউনিভার্সাল মেইন সাইডবার]
├── Main Operations (Overview, Live Inbox)
├── CRM (Contacts, Deals, Tasks)
│
├── 🏢 BUSINESS NAME  <── [Universal Anchor for EVERY Merchant]
│   ├── [যদি E-Commerce হয়]:
│   │   ├── 📦 Products
│   │   ├── 🛍️ Orders
│   │   ├── 🚚 Courier Settings
│   │   └── 🏷️ Discounts & Coupons
│   │
│   ├── [যদি Healthcare / Clinic হয়]:
│   │   ├── 🩺 Doctor Serial          ──► (/dashboard/records?schema=doctor_serial)
│   │   ├── 🏥 Lab Test Booking        ──► (/dashboard/records?schema=lab_tests)
│   │   └── ➕ Manage Business Data    ──► (Open all form page)
│   │
│   ├── [যদি Tour & Travel হয়]:
│   │   ├── ✈️ Tour Bookings           ──► (/dashboard/records?schema=tour_bookings)
│   │   ├── 🏨 Hotel Inquiries         ──► (/dashboard/records?schema=hotel_inquiries)
│   │   └── ➕ Manage Business Data
│   │
│   └── [যদি Restaurant হয়]:
│       ├── 🍽️ Table Reservations      ──► (/dashboard/records?schema=table_reservation)
│       ├── 🥡 Takeaway Orders         ──► (/dashboard/records?schema=takeaway_orders)
│       └── ➕ Manage Business Data
│
├── Automations (Rules, Broadcasts, Templates)
└── AI Engine & Automations (AI Agents, Knowledge Base, Platforms)
```

---

## ২. মূল সুবিধাসমূহ

1. **জিরো নেস্টিং (Zero Nesting):** মার্চেন্ট ড্যাশবোর্ডে এসেই সাইডবারে সরাসরি তার কাস্টম ফর্মগুলোর তালিকা দেখতে পাবে এবং এক ক্লিকেই সেই টেবিলে চলে যেতে পারবে।
2. **মার্চেন্ট কাস্টম ব্র্যান্ডিং:** মার্চেন্ট চাইলে "Business Zone"-এর নাম নিজের ক্লিনিক বা প্রতিষ্ঠানের নাম দিয়ে পরিবর্তন করতে পারবে।
3. **AI ট্রান্সপারেন্সি কার্ড:** রেকর্ডস পেজের শীর্ষে স্পষ্ট ব্যানার থাকবে যা দেখাবে AI কোন ইনটেন্টে কাস্টমার থেকে এই ফর্মের ডাটা সংগ্রহ করবে।
