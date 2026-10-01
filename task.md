# Task — Messenger-স্টাইল Live Widget + সব-পেজে ভাসমান বাবল

Approved plan: `C:\Users\User\.claude\plans\vivid-crunching-spindle.md`

## সিদ্ধান্ত (User-approved, 2026-10-01)
| বিষয় | সিদ্ধান্ত |
|---|---|
| বাবলের স্কোপ | পুরো ড্যাশবোর্ড — Live Inbox আর Playground বাদে |
| টগল সেভ | localStorage (zustand persist) — স্কিমা/DB অপরিবর্তিত |
| Playground-এ টগল অন | উইজেট ইনলাইনই থাকবে, ডাবল বাবল নয় |
| ডিফল্ট | বন্ধ |

---

## ধাপ ১ — স্টোর ও হুক
- [x] `hooks/use-live-widget.ts` — `floating: Record<id, boolean>`, `lastChatbotId`,
      `useActiveChatbotId()`, `useHydrated()`, `useFloatingWidgetEnabled()`

## ধাপ ২ — শেল
- [x] `_providers/tester-provider.tsx` — `chatbotId` প্রপ; কথোপকথন এজেন্ট-আইডিসহ
      ধরা (derive, effect নয়)
- [x] `app/(dashboard)/layout.tsx` — `TesterProvider` + `LiveWidget`
- [x] `[chatbotId]/layout.tsx` — শুধু `BotProvider`
- [ ] ডিলিট: `_components/tester-bubble.tsx` ⚠️ ফাইলটা এখনো পড়ে আছে — এই সেশনে
      টুল-ক্লাসিফায়ার outage-এ ছিল, তাই `rm` চালানো যায়নি (নিচে "বাকি" দেখুন)

## ধাপ ৩ — Playground
- [x] `single-test.tsx` — পিল-ট্যাব বাদ, `Switch` টগল
- [ ] ডিলিট: `messenger-bubble.tsx`, `docked-chat.tsx` ⚠️ একই কারণ

## ধাপ ৪ — Messenger চেহারা
- [x] `app/globals.css` — messenger টোকেন (light + dark) + গ্রেডিয়েন্ট
- [x] `_components/chat-bubble.tsx` — নীল/ধূসর বাবল, গ্রুপ-অ্যাভাটার
- [x] `_components/chat-preview.tsx` — Messenger হেডার + pill কম্পোজার
- [x] `_components/live-widget.tsx` — ভাসমান লঞ্চার + প্যানেল
- [x] `components/layout/FloatingBubbles.tsx` — সাপোর্ট বাবলের অফসেট (`bottom-32`)

## ধাপ ৫ — i18n
- [x] `public/locales/{en,bn}/chatbots.json`

## ধাপ ৬ — ফোন-আকৃতি (ইউজারের ৩য় রিকোয়েস্ট, ২০২৬-১০-০১)
- [x] নতুন `_components/phone-frame.tsx` — ফোনের বডি + মোবাইল স্ট্যাটাস বার
      (ঘড়ি প্রতি মিনিটে আপডেট, signal / wifi / ব্যাটারি)
- [x] `single-test.tsx` — ফোন-অনুপাতে বসানো; অকেজো `pb-24` বাদ
- [x] `globals.css` — `--device-bezel` টোকেন (light: কাছাকাছি-কালো, dark: হালকা ধূসর)
- [x] `live-widget.tsx` — ভাসমান প্যানেলও এখন একই ফোন-ফ্রেমে (ইউজারের ৪র্থ রিকোয়েস্ট)

### সংশোধন — ইউজারের ফিডব্যাক (৪র্থ রিকোয়েস্ট)
| কী | আগে | এখন | কেন |
|---|---|---|---|
| ফোনের অনুপাত | `aspect-[9/19]` → ৪০০×৮৪৪ | **`aspect-[9/16]` → ৪০০×৭১১** | "height টা বেশি হয়ে গেছে" |
| অনুপাতের উৎস | দুই ফাইলে আলাদা লেখা | `PHONE_ASPECT` এক্সপোর্ট | দুই হোস্ট যাতে আলাদা না হয়ে যায় |
| ভাসমান প্যানেল | খালি প্যানেল ৪০০×৫৮০ | **একই ফোন-ফ্রেম**, বাইরে ৪১৬px | "floating bubble-ও মোবাইল মকআপের মতো হোক" |

- ⚠️ ভাসমান প্যানেলের বাইরের প্রস্থ **৪১৬px** — যাতে ৮px বেজেলের ভেতরে স্ক্রিনটা
  ঠিক ৪০০px হয়, Playground-এর সমান।
- ⚠️ ভাসমান ফ্রেমে `max-h-[calc(100dvh-8rem)]` — ৯:১৬ ফোন ~৭৪০px লম্বা, খাটো
  উইন্ডোতে সেটা স্ক্রিনের উপর দিয়ে উঠে নিজের হেডারই আড়াল করত। ক্ল্যাম্প হলে
  ফোনটা একটু খাটো-মোটা হয় — দৃশ্যমান থাকাই বড় কথা।

### সংশোধন ২ — ইউজারের ফিডব্যাক (৫ম রিকোয়েস্ট)
- [x] ড্যাশবোর্ড থেকে `FloatingBubbles` (WhatsApp + চ্যাট বাবল) সরানো —
      `app/(dashboard)/layout.tsx`। ⚠️ ফাইলটা **ডিলিট করা হয়নি**: ল্যান্ডিং পেজ
      (`app/(root)/page.tsx`) এখনো ওটা ব্যবহার করে।
- [x] "⚡ Test me!" টিজার বাদ (`live-widget.tsx`) + locale key দুটো থেকেই বাদ
- [x] লঞ্চার এখন কোণার একমাত্র জিনিস — মোড়ানো `flex flex-col` স্তূপটাও বাদ
- [x] ভাসমান প্যানেল চিকন-লম্বা: ৪১৬px → **৩৮০px**, `aspect-[9/16]` → **`aspect-[9/19]`**
      (`PHONE_ASPECT_FLOATING`), `max-h` 8rem → 7rem
- ℹ️ এখন কোণার হিসাব একটাই: বাবল আর টিজার ছিল বলেই `bottom-32`/`bottom-24`
      অফসেট লাগত; এখন লঞ্চার `bottom-6`, প্যানেল `bottom-24` — সংঘর্ষের সুযোগ নেই।

## ধাপ ৭ — যাচাই
- [ ] `npx tsc --noEmit` — ⚠️ চালানো হয়নি (classifier outage)
- [ ] `npm run lint` — ⚠️ চালানো হয়নি (একই কারণ)
- [ ] ব্রাউজারে হাতে যাচাই (টগল, অফসেট, Inbox, dark/bn) — ইউজারের

---

## বাকি (এই সেশনে করা যায়নি)
1. তিনটে মরা ফাইল মুছে ফেলা — `rm`/`Remove-Item` দুটোই ক্লাসিফায়ার outage-এ আটকেছে:
   - `_components/tester-bubble.tsx`
   - `playground/_components/single-test/messenger-bubble.tsx`
   - `playground/_components/single-test/docked-chat.tsx`
   এগুলো **কোথাও import হয় না** (grep করে দেখা হয়েছে), তাই আপাতত অক্ষতিকর।
2. `tsc` / `lint` — উপরের কারণেই।
