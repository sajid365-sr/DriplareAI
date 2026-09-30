# 19 — Agent Shell & Setup/Playground Split

## Objective

এজেন্ট-সেকশনের information architecture ঠিক করা। আজকের `/playground` পেজ আসলে
৯০% **কনফিগারেশন** — কিন্তু নামটা "Playground", অর্থাৎ ব্যবহারকারী যা আশা করেন
(খেলা/পরীক্ষা) তার চেয়ে ভিন্ন কাজ সেখানে হয়। আর টেস্টারটা ৩৬০px কলামে চাপা
পড়ে, অথচ সেটাই এই পেজের সবচেয়ে দরকারি অংশ।

নতুন গঠন:

| ট্যাব | কী থাকে |
|---|---|
| **Setup** | আজকের Playground — prompt, model, knowledge checklist (ফুল-উইথ) |
| **Playground** | টেস্টার (ডক করা প্যান বা ফ্লোটিং বাবল) + Compare |
| **Overview & Analytics** | অপরিবর্তিত |
| **Settings** | অপরিবর্তিত |

Compare এখন ২টা মডেলে হার্ডকোডেড — ২/৩/৪ হবে, এবং **Pro-only** (Starter-এ নয়)।

## কেন `[chatbotId]/layout.tsx`

পুরো কাজটার ভিত্তি একটাই আইডিয়া: **এজেন্ট-সেকশনের shell-টা layout-এ থাকবে**।

- আজ প্রতিটা পেজ নিজে `GET /api/chatbots/[id]` করে → ট্যাব বদলালেই লোডিং স্ক্রিন
- layout ট্যাব বদলালেও অটুট থাকে (Next.js App Router), তাই ওখানে তুললে ডেটাও অটুট
- টেস্টারের চ্যাট-সেশনও ওখানে → Setup-এর বাবল আর Playground-এর পেজ **একটাই**
  কথোপকথন দেখাবে, দুইটা আলাদা নয়
- ফলে Setup পুরো স্ক্রিন জুড়ে জায়গা পায়, আর টেস্টার সবসময় এক ক্লিক দূরে

---

## Phase R1 — শেল (providers + layout)

**লক্ষ্য: শূন্য দৃশ্যমান পরিবর্তন।** শুধু state আর fetch-এর জায়গা বদল।

- [x] `_providers/bot-provider.tsx` — `bot`, `userPlan`, `loading`, `saving`,
      `isDirty`, `saveSettings()`। `stableStringify`/`savableSnapshot` পেজ থেকে
      এখানে সরানো, কারণ dirty-হিসাবটা এখন এক জায়গায়।
- [x] `_providers/tester-provider.tsx` — `messages`, `input`, `sending`,
      `sendMessage()`, `reset()`। সেশন-আইডি এখানেই, তাই হোস্ট বদলালেও সেশন টেকে।
- [x] `[chatbotId]/layout.tsx` — দুটো provider দিয়ে children মোড়ানো
- [x] `playground/page.tsx` — নিজের state/fetch বাদ, provider থেকে পড়ে
      (৪১১ → ২২১ লাইন; পাশাপাশি ৫টা lint error + ২টা warning কমেছে)
- [x] `ChatPreview` — auto-scroll ভেতরে সরানো (`messagesEndRef` prop বাদ),
      `scrollIntoView` → নিজের কনটেইনারে `scrollTo` (বাইরের স্ক্রল আর নড়ে না)

### R1-এ যোগ হওয়া ছোট জিনিসগুলো

- `BotRecord` টাইপ — `bot: any` বদলে প্রকৃত ফিল্ডের তালিকা (`ChatPreview`-এর
  দুইটা `any`-ও এতে সরে গেছে)
- `ChatAttachment` — অ্যাটাচমেন্টের আকৃতি এখন `chat-bubble.tsx`-এ এক জায়গায়,
  তিন জায়গায় (ইনপুট বার → provider → বাবল) আলাদা করে লেখা নয়
- লোড-ব্যর্থতার টোস্ট আলাদা effect-এ — নইলে `t` dependency হয়ে ভাষা বদলালেই
  bot আবার fetch হত, আর সেভ-না-করা সম্পাদনা মুছে যেত
- দেরিতে আসা উত্তরে `cancelled` গার্ড — দ্রুত এজেন্ট বদলালে আগের ডেটা পরের
  জনের উপর বসবে না

### যা ইচ্ছাকৃতভাবে এখনো করা হয়নি

- ফ্লোটিং টেস্টার বাবল (`R2`)
- রুটের নাম বদল (`/setup` ↔ `/playground`) (`R2`)
- Setup পেজ সরলীকরণ (`R3`)

⚠️ **জানা সীমা:** layout এখন সব এজেন্ট-পেজের জন্য bot fetch করে, তাই
`/analytics` আর `/settings` আপাতত দুটো GET করে (নিজেরটা + layout-এর)। ওই দুই
পেজ provider-এ সরালে এটি ঠিক হবে — পরের ধাপে।

---

## Phase R2 — রুট ও নাম

- [x] `/chatbots/[id]/setup` — কনফিগ (আজকের `/playground`)
- [x] `/chatbots/[id]/playground` — টেস্টার (নতুন)
- [x] ফ্লোটিং টেস্টার বাবল — `/playground` আর `/playground/compare` ছাড়া সব
      এজেন্ট-পেজে
- [x] `bot-nav.ts` — Setup প্রথমে, তারপর Playground
- [x] `dashboardHeader.tsx` breadcrumb, `BotSwitcher` subPath, `ChatbotRow` (২),
      `create-agent-dialog`, `chat/page.tsx` redirect
- [x] `FloatingBubbles` — সাপোর্ট বাবলের সাথে সংঘর্ষ এড়ানো
- [x] locale: `bot.setup` + বাংলা/ইংরেজি

## Phase R3 — Setup পেজ

- [x] দুই-প্যান গ্রিড বাদ, ফুল-উইথ
- [x] dirty-aware Save ও সেভ-নোটিস provider থেকে
- [x] "Playground-এ পরখ করুন" লিংক

## Phase R4 — Playground পেজ

- [x] পুরো পেজ জুড়ে টেস্টার + "Docked / Bubble" টগল
- [x] সেশন ইতিহাস


### R2-এ যা বদলাল, ঠিক যা ভাবা ছিল না

- `ChatbotRow`-এর **প্রথম** লিংকটা বদলেছে (`/setup`), দ্বিতীয়টা নয়: সারিতে ক্লিক
  মানে "এই এজেন্ট নিয়ে কাজ শুরু করি" → Setup, আর ⋯ মেনুর "Open Playground"
  এখন সত্যিকার অর্থেই টেস্টারের পেজে নেয়।
- `/chat` redirect `/playground`-এই থাকে — "chat" মানে বটের সাথে কথা বলা, আর
  সেটা এখন ওই পেজটাই।
- `FloatingBubbles` (WhatsApp/সাপোর্ট) এজেন্ট-পেজে এক ধাপ উপরে সরে যায়
  (`bottom-24`), কারণ নিচের ডান কোণটা এখন টেস্টার-বাবলের।
- `_components/` এখন এজেন্ট-সেগমেন্টের শেয়ার্ড জায়গা (`chat-preview`,
  `chat-bubble`, `tester-bubble`), কারণ বাবলটা শেল থেকে আসে আর পেজটা ব্যবহার
  করে — কোনো একটা পেজের ভেতরে রাখলে অন্যটা ওই পেজের উপর নির্ভর করত।

## Phase R5 — Compare: ২ → ২/৩/৪ + Pro gate

- [ ] API: `providerA/B` → মডেলের অ্যারে
- [ ] `resolveCompareCredits(models[])` (credit-এর একটাই resolver)
- [ ] Pro gate UI: `LockedContent` + `LockedOverlay`
- [ ] পাঠানোর আগে খরচ দেখানো
- [ ] মোবাইলে ৪ কলামের সমাধান

## Phase R6 — polish

- [ ] Playground-এর স্ক্রলিং (blur / `scrollbar-thin` / isAtBottom)
- [ ] Readymade চিপ — ক্যাটেগরি-অনুযায়ী
- [ ] Wizard i18n (আগের P1)

---

## Verification

Phase R1:

- [x] `npx tsc --noEmit` — exit 0
- [x] `npm run build` — সফল
- [x] `npx eslint` — পরিবর্তিত ফাইলে **নতুন সমস্যা নেই**। আগের অবস্থার
      সাথে তুলনা: `playground/page.tsx` ৫ error + ২ warning → ০/০,
      `chat-preview.tsx` ২ error + ৩ warning → ০ error + ২ warning
      (বাকি দুটো `<img>`-এর warning আগে থেকেই আছে)
- [ ] হাতে দেখা: Setup ↔ Analytics ↔ Settings-এ যাওয়া-আসায় bot আর লোডিং স্ক্রিন
      ফিরে আসে না; টেস্টারের কথোপকথন ট্যাব বদলালেও থাকে
- [x] আলাদা কমিট, `feature/chatbot-creation-ux`-এ — **push নয়**
