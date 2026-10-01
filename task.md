# Task — Courier Setup: Settings → `/dashboard/couriers`

Approved plan: `C:\Users\User\.claude\plans\woolly-sniffing-kernighan.md`

## সিদ্ধান্ত (User-approved, 2026-10-01)
| বিষয় | সিদ্ধান্ত |
|---|---|
| নতুন রুট | `/dashboard/couriers` (সাইডবারের E-Commerce Store গ্রুপেই থাকবে) |
| পুরনো রুট | `/dashboard/settings/couriers` — সম্পূর্ণ ডিলিট, redirect নেই |
| Settings ট্যাব | সাব-নেভিগেশন থেকে "Courier API" বাদ |
| API রুট | `/api/settings/couriers` → `/api/couriers` (ইউজারের পছন্দ) |
| ফিচার | অপরিবর্তিত — একই ১১টি ফিল্ড, একই `CourierConfig` মডেল |

---

## ধাপ ১ — i18n namespace ✅
- [x] `public/locales/en/couriers.json`
- [x] `public/locales/bn/couriers.json`
- [x] `lib/core/i18n.ts` — import + `resources` এন্ট্রি (static import, নইলে namespace খালি)

## ধাপ ২ — নতুন পেজ ✅
- [x] `dashboard/couriers/_components/types.ts` — `CourierForm`
- [x] `dashboard/couriers/_components/couriers-config.ts` — provider metadata (declarative)
- [x] `dashboard/couriers/_components/SecretField.tsx` — eye-toggle input
- [x] `dashboard/couriers/_components/CourierProviderCard.tsx` — generic card
- [x] `dashboard/couriers/page.tsx` — thin page + header + form

## ধাপ ৩ — API মুভ ✅
- [x] `app/api/couriers/route.ts` (লজিক অপরিবর্তিত)
- [x] `app/api/settings/` ফোল্ডার ডিলিট (couriers ছাড়া কিছু ছিল না)

## ধাপ ৪ — নেভিগেশন ✅
- [x] `components/layout/Sidebar.tsx` — লিংক + `isEcomActive`
- [x] `app/(dashboard)/dashboard/settings/layout.tsx` — ট্যাব + `Truck` import বাদ

## ধাপ ৫ — ডিলিট ✅
- [x] `app/(dashboard)/dashboard/settings/couriers/` ফোল্ডার

## ধাপ ৬ — যাচাই ⏳ (চালানো হয়নি)
- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] dev server-এ `/dashboard/couriers` → load/save
- [ ] `/dashboard/settings/couriers` → 404
- [ ] bn + en, light + dark, mobile drawer

### ⚠️ কেন চালানো হয়নি
এই সেশনে `Bash`/`PowerShell` classifier বারবার outage-এ পড়েছে
("deepseek-v4-flash is temporarily unavailable")। সাধারণ read-only কমান্ড
(`echo`, `rm -rf` একবার) কখনো পার হয়েছে, কিন্তু `tsc` / `npm run lint`
প্রতিবার আটকেছে — ১০+ বার চেষ্টা করা হয়েছে। তাই উপরের ধাপগুলো **সত্যিই
চালানো হয়নি**, এবং "সফল" লেখা হয়নি।

কোড-লেভেলে যা নিজে যাচাই করা গেছে (read-only টুল দিয়ে):
- `settings/couriers` ও `api/settings` ফোল্ডার সত্যিই মুছে গেছে (Glob)
- কোডবেসে পুরনো path-এর আর কোনো রেফারেন্স নেই — শুধু historical docs আর এই ফাইল
- `i18n.ts`-এ en/bn দুই জায়গায়ই `couriers` namespace register হয়েছে
- `Input` ও `Switch` দুটোই props spread করে, তাই `id`/`aria-label`/`onCheckedChange` পৌঁছাবে

### আচরণগত পার্থক্য (কোড বদল নয়)
`app/(dashboard)/layout.tsx`-এর `isSubPage` `/dashboard/settings` প্রিফিক্স দেখে sidebar
auto-collapse করে। নতুন রুট ওই প্রিফিক্সের বাইরে, তাই sidebar এখন খোলা থাকবে —
Products/Orders/Discounts-এর মতোই।
