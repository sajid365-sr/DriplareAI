# 🎨 DriplareAI ডিজাইন সিস্টেম স্ট্যান্ডার্ডাইজেশন — সম্পূর্ণ ওয়াকথ্রু (Walkthrough)

DriplareAI প্ল্যাটফর্মের সমগ্র কোডবেসে ডিজাইন সিস্টেমকে স্ট্যান্ডার্ডাইজ করা হয়েছে। সমস্ত হার্ডকোডেড কালার ইউটিলিটি ক্লাস সরাতে এবং Tailwind v4-এর CSS-First আর্কিটেকচারের সাথে সম্পূর্ণ সামঞ্জস্য তৈরি করতে সফলভাবে রিফ্যাক্টরিং সম্পন্ন করা হয়েছে।

---

## 🌟 ১. মূল পরিবর্তনসমূহ (Key Standardizations)

### **১.১ globals.css-এ সেমান্টিক টোকেন সংসংযোজন**
- **নতুন স্ট্যাটাস টোকেন:**
  - `--success` / `bg-success` / `text-success` (Emerald tone)
  - `--warning` / `bg-warning` / `text-warning` (Amber tone)
  - `--info` / `bg-info` / `text-info` (Blue tone)
  - `--destructive` / `bg-destructive` / `text-destructive` (Red tone)
- **ব্র্যান্ড গ্রেডিয়েন্ট ইউটিলিটি ক্লাসেস:**
  - `.bg-brand-gradient` (`bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600`)
  - `.text-brand-gradient` (`bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 bg-clip-text text-transparent`)

---

## 📁 ২. ব্যাচ অনুসারে সম্পন্নকৃত রিফ্যাক্টরিং (Batch Summaries)

| ব্যাচ | মডিউল / ডিরেক্টরি | আপডেটকৃত ফাইলসমূহ | মূল পরিবর্তন |
| :--- | :--- | :--- | :--- |
| **Batch A** | `components/chatbots/` | `InlineWizard.tsx`, `ModeSwitcher.tsx`, `SystemPromptGuide.tsx`, `WizardModal.tsx`, `wizard-field-control.tsx` | হার্ডকোডেড violet/indigo সরাতে `primary` ও `bg-brand-gradient` টোকেন বসানো হয়েছে। |
| **Batch B** | Chatbot Settings | `chat-settings.tsx`, `live-inbox-header.tsx` | প্রম্পট টিয়ার কাস্টমাইজেশন ও বোতামে `bg-brand-gradient` যোগ করা হয়েছে। |
| **Batch C** | Layout & Referral | `Sidebar.tsx`, `NotificationBell.tsx`, `FloatingBubbles.tsx`, `ReferralPanel.tsx`, `ReferTab.tsx`, `InfoTab.tsx` | নেভিগেশন সাইডবার অ্যাক্টিভ স্টেট ও নোটিফিকেশন ব্যাজে `success`/`warning`/`destructive` টোকেন বসানো হয়েছে। |
| **Batch D** | Dashboard Tools | `WorkspaceSwitcher.tsx`, `downgrade-warning-modal.tsx`, `HybridSelect.tsx`, `SharedMediaAccordion.tsx` | ওয়ার্কস্পেস ক্রিয়েশন ও ডাউনগ্রেড ওয়ার্নিং ডায়ালগে সেমান্টিক টোকেন বসানো হয়েছে। |
| **Batch E** | Order Management | `OrdersHeader.tsx`, `OrderSheet.tsx`, `FloatingBulkActionBar.tsx`, `StatusBadge.tsx`, `CreateOrderModal.tsx` | অর্ডার স্ট্যাটাস ব্যাজে (Pending, Completed, Cancelled, Processing) সেমান্টিক status tokens ব্যবহার নিশ্চিত করা হয়েছে। |
| **Batch F** | Product Catalog & Sync | `SyncConfigPicker.tsx`, `SyncProgress.tsx`, `ProductReviewTable.tsx`, `SavedProductsTable.tsx`, `SavedProductsGrid.tsx` | স্টক স্ট্যাটাস (In Stock, Low Stock, Out of Stock) এবং ফেচিং প্রোগ্রেস বারে `success`/`warning`/`destructive` টোকেন বসানো হয়েছে। |
| **Batch G** | Settings & Couriers | `couriers/page.tsx`, `CurrentPlan.tsx`, `billing/page.tsx`, `security/page.tsx`, `notifications/page.tsx` | কুরিয়ার সেটিংস ব্যানার ও সেভ বোতামে `bg-brand-gradient` প্রয়োগ করা হয়েছে। |
| **Batch H & I** | Platforms, Usage & Landing | `PlatformsHeader.tsx`, `quota-progress.tsx`, `CurrentPlanBadge.tsx`, `FeaturesSection.tsx`, `CreateCouponModal.tsx`, `(root)/page.tsx` | ল্যান্ডিং পেইজ ও গ্লোবাল ডিসকাউন্ট মোডালে টেক্সট এবং ব্যাকগ্রাউন্ড গ্রেডিয়েন্ট স্ট্যান্ডার্ডাইজ করা হয়েছে। |

---

## 🛠️ ৩. যাচাইকরণ ও ডার্ক মোড সাপোর্ট (Verification & Dark Mode)

1. **ডার্ক মোড সামঞ্জস্যতা (Dark Mode Compatibility):**
   - প্রতিটি সেমান্টিক টোকেন (`--primary`, `--success`, `--warning`, `--destructive`, `--border`, ইত্যাদি) CSS Variables-এর মাধ্যমে ডায়নামিকালি ডার্ক মোডে সুইচ করে, যার ফলে কোনো উপাদানে `dark:text-violet-400` বা `dark:bg-emerald-950` এর মতো ম্যানুয়াল কন্ডিশনাল ফিক্সের প্রয়োজন অবশিষ্ট নেই।

2. **ডিজাইন কন্ট্রাস্ট (Visual Accessibility):**
   - `bg-primary/10`, `bg-success/10`, `bg-warning/10` জাতীয় সাশ্রয়ী ট্রান্সপারেন্ট টিন্ট ব্যবহার করার ফলে লাইট এবং ডার্ক উভয় থিমেই টেক্সটের দৃশ্যমানতা (Contrast ratio) অত্যন্ত স্পষ্ট।

---

## 🎯 ৪. ফলাফল (Outcome)

- ❌ **আগের অবস্থা:** ছড়িয়ে ছিটিয়ে থাকা বিভিন্ন রঙের মান (যেমন: `bg-blue-600`, `bg-violet-500`, `text-emerald-500`, `from-violet-600 to-blue-500`) যা থিম পরিবর্তনের সময় অমিল তৈরি করত।
- ✅ **বর্তমান অবস্থা:** ১০০% সেমান্টিক টোকেনচালিত একীভূত এবং আধুনিক ডিজাইন সিস্টেম, যা সম্পূর্ণ ব্র্যান্ড স্ট্যান্ডার্ড মেনে চলে এবং ভবিষ্যৎ ডেভেলপমেন্টকে দ্রুততর ও পরিচ্ছন্ন রাখে।
