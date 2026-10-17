# Task — Automations ট্যাব: Audit + Research + Full-Stack বাস্তবায়ন

Approved plan: `C:\Users\User\.claude\plans\nifty-rolling-quasar.md`

## সারসংক্ষেপ
`/dashboard/automations` আগে সম্পূর্ণ mock ছিল (৩টি হার্ডকোড কার্ড, `onClick`-হীন CTA)। এখন এটি
একটি বাস্তব **Hybrid Rule + Flow** automation ইঞ্জিন — Rules · Broadcasts · Templates · Activity Log,
যা n8n Core-AI-Brain-এর `Automation Gate` হয়ে ফায়ার করে।

## সিদ্ধান্ত (User-approved)
| বিষয় | সিদ্ধান্ত |
|---|---|
| কোর মডেল | Hybrid — সরল Rule list + অপশনাল Flow canvas |
| V1 পরিবার | Conversation starters · Social engagement · E-commerce & orders · Inbox operations |
| Sidebar IA | আলাদা collapsible গ্রুপ (Rules/Broadcasts/Templates/Activity) |
| রানটাইম | নিয়ম TypeScript-এ মূল্যায়িত, ফায়ার n8n-এ |
| স্কোপ বাদ (V2) | Team/Agent মডেল, SLA assignment, WhatsApp template submission API |
| ডিপ্লয় | ইউজার নিজে করবেন। এই সেশনে শুধু লোকাল কোড ঠিক করা হয়েছে |
| Cron | `vercel.json` থেকে `run-automations` এন্ট্রি সরানো হয়েছে (Hobby plan ঝুঁকি) |

---

## ধাপ ও অগ্রগতি

| ধাপ | কাজ | অবস্থা |
|---|---|---|
| ০ | `prisma migrate diff` দিয়ে ডিফ যাচাই | ✅ **কোনো `DROP TABLE` নেই** — `n8n_chat_histories` অক্ষত |
| ১ | `prisma/schema/automation.prisma` + `base.prisma` schemas অ্যারে | ✅ **টেবিল ৭টি DB-তে আগেই আছে — `db push` লাগে না** |
| ২ | `lib/automations/*` — zod স্কিমা + pure engine + presets | ✅ |
| ২ক | `lib/services/outbound.ts` — চ্যানেল-নিরপেক্ষ ডেলিভারি | ✅ প্ল্যানে ছিল না |
| ৩ | `/api/automations` CRUD + `/evaluate` + templates + broadcasts + activity + tags | ✅ |
| ৪ | Rules লিস্ট UI + i18n | ✅ |
| ৫ | Rule builder sheet + dry-run | ✅ |
| ৬ | Templates ও Broadcasts পেজ + API | ✅ |
| ৭ | Activity Log পেজ | ✅ + এই সেশনে banner সংশোধন |
| ৮ | Sidebar গ্রুপ + MobileNavDrawer + common.json + i18n রেজিস্ট্রেশন | ✅ |
| ৯ | Core-AI-Brain-এ `Automation Gate` নোড + ইমপোর্ট গাইড | ✅ ডেলিভারেবল প্রস্তুত — **n8n-এ ইমপোর্ট ইউজারের কাজ** |
| ১০ | `muteAiOnHandover` / `directMessagingAiEnabled` সত্যিকারভাবে প্রয়োগ | ✅ |
| ১১ | Flow canvas (`@xyflow/react`) — অনুমোদন সাপেক্ষে | ⬜ শুরু হয়নি (নতুন dependency) |
| ১২ | `POST /api/cron/run-automations` | ✅ রুট আছে · ⏸️ `vercel.json` cron এন্ট্রি সরানো |

---

## এই সেশনের কাজ (৪০৪ ব্লকার সমাধান)

**১. প্রথম কারণ: রুটটি কমিটই হয়নি।** `app/api/automations/evaluate` untracked ছিল, তাই Vercel-এ
কখনো ডিপ্লয় হয়নি — তাই Next.js-এর নিজের "Page not found" HTML ফিরত আসত। Activity-তে row না
আসার কারণও এটাই ছিল: গেট কখনো ইঞ্জিনে পৌঁছাত না। (ইউজার পরে পুশ করেছেন — রুট এখন লাইভ।)

**২. `proxy.ts` — দ্বিতীয় লুকানো ব্লকার।** `/api/automations/evaluate` `isPublicRoute`-এ ছিল না।
ডিপ্লয় করলেও Clerk-এর `auth.protect()` n8n-কে sign-in-এ পাঠিয়ে দিত। যোগ করা হয়েছে।

**৩. টাইপচেকে ১৫টি error — build-ই ফেল করত।** সবই একই কারণ: base-ui-র `Select`
`onValueChange`-এ `string | null` দেয়, state গুলো `string`। ৭টি ফাইলে null-safe করা হয়েছে।
`npx tsc --noEmit` এখন **exit 0**।

**৪. Activity পেজের মিথ্যা বার্তা।** `runEvent` (`run.ts:98`) কোনো rule না থাকলে `emptyResult`
ফেরায় এবং **কোনো run row লেখে না** — তাই `gateLastSeenAt` সবসময় `null` → banner ভুল করে
"Automation Gate সংযুক্ত নয়" দেখাত, অথচ গেট ঠিকঠাক ডাকছিল। এখন `/api/automations/activity`
`activeRuleCount` ফেরায়, আর banner তিনটি অবস্থা আলাদা করতে পারে:
rule নেই → *"এখনো কোনো সক্রিয় Automation নেই"*; rule আছে কিন্তু ডাক পড়েনি → *"Gate সংযুক্ত নয়"*।

**৫. `vercel.json`** — `*/10 * * * *` cron এন্ট্রি সরানো (ইউজারের সিদ্ধান্ত)। এটা না সরালে
Hobby plan-এ পুরো ডিপ্লয় ফেল করার ঝুঁকি ছিল। গেটের কাজে এটার দরকার নেই।

---

## ডোমেইন ফিক্স — আসল কারণ (এই সেশনের মূল কাজ)

**n8n-এর দুইটো নোডই ভুল ডোমেইনে তাক করা ছিল।** `Core-AI-Brain.json`-এর `Billing API` আর
`Automation Gate` — দুটোই `https://www.driplare.com/...`। কিন্তু **`driplare.com` ওই Vercel
প্রজেক্টে যোগই করা নেই**; ওখানে মার্কেটিং সাইট আছে, আর ওই হোস্টে প্রতিটি `/api` রুট ৪০৪ দেয়।

| রুট | `www.driplare.com` | `driplare-ai.vercel.app` |
|---|---|---|
| `/api/automations/evaluate` | 404 | **401** (রুট আছে) |
| `/api/internal/ai-usage` | 404 | **401** (রুট আছে) |
| `/sign-in` | 500 | 200 |

**কেন এতদিন ধরা পড়েনি:** `Automation Gate` নোডে `onError: continueRegularOutput` বসানো, তাই
৪০৪ চুপচাপ গিলে ফেলা হয় — `Gate Decision` `action` খালি পায় → `"continue"` → AI স্বাভাবিকভাবে
উত্তর দিয়ে দেয়। ফলে "AI উত্তর আসছে" দেখে মনে হয় সব ঠিক, অথচ Activity Log খালি।

> 💡 **আসল প্রমাণ উল্টো দিকে:** কোনো rule মিললে `Gate Reply?`-এর true শাখা সোজা `Gate Return`-এ
> যায় — AI Agent চলে-ই না। তাই AI-র উত্তর মানেই গেট কিছু বলেনি (বা পৌঁছায়নি)। আর n8n-এর রিপ্লাই
> localhost-এ ফেরত আসে কারণ সেটা উল্টো দিকের কল (নিজের মেশিনই বাইরে ডাকে) — গেট হলো VPS থেকে
> আসা inbound কল, তাই ওখানে টানেল ছাড়া উপায় নেই।

**যা বদলানো হয়েছে — সব `driplare-ai.vercel.app`-এ:**

| ফাইল | কী বদলেছে |
|---|---|
| `docs/n8n-JSON/Core-AI-Brain.json` | Billing API URL · Automation Gate URL · Gate timeout `5000`→`10000` · দুটো sticky note |
| `docs/n8n-JSON/Automation-Gate.json` | Gate URL · timeout · sticky note |
| `docs/cost-analytics/step6-core-ai-brain.js` | **লাইভ জেনারেটর** — না ঠিকলে একবার চালালেই বিলিং URL ফিরে যেত |
| `docs/n8n-JSON/Automation-Gate-Setup.md` | §২-তে ডোমেইন স্পষ্ট · §৭খ · §৮-এর ভুল ৪০৪ ব্যাখ্যা বাদ · নতুন "AI উত্তর আসছে" বাক্স |
| `lib/services/mail.ts`, `lib/services/usage-alerts.ts`, `hooks/integrations/useWebsiteIntegration.ts` | `driplare.com` ফলব্যাক → `driplare-ai.vercel.app` |

**কে ছোঁয়া হয়নি (ইচ্ছাকৃত):** `docs/JSON Backup/*` ও `docs/cost-analytics/task.md` — ঐতিহাসিক
স্ন্যাপশট/লগ। `support@driplare.com` জাতীয় **ইমেইল ঠিকানা** ও `BRAND_TAGLINE` — ওগুলো হোস্টিং
নয়, ব্র্যান্ড পরিচয়, আর ইমেইল ডোমেইন হিসেবে এখনো বৈধ।

**⚠️ আলাদা করে দেখা দরকার (সাইড-ইফেক্ট):** `Billing API`-ও ওই ভুল ডোমেইনে তাক করা ছিল।
Playground-এ প্ল্যাটফর্মের ব্যাকআপ আছে ([chat/route.ts:176](app/api/chatbots/[chatbotId]/chat/route.ts#L176)),
তাই credit কাটে। কিন্তু **Facebook/WhatsApp/Instagram-এ প্ল্যাটফর্ম পথে থাকে না** — ওখানে
`POST /api/internal/ai-usage`-ই একমাত্র চার্জিং পথ, আর কোনো reconciler cron নেই। ডোমেইন ফিক্সে
এটাও ঠিক হওয়া উচিত, তবু একটা FB/WA মেসেজ দিয়ে ব্যালেন্স মিলিয়ে দেখা দরকার।

---

## লোকাল টেস্টের শর্ত (গুরুত্বপূর্ণ)

1. **n8n থেকে `localhost:3000`-এ পৌঁছানো যায় না** — n8n চলে VPS-এ। টানেল লাগবে:
   `cloudflared tunnel --url http://localhost:3000`, তারপর Gate নোডের URL = টানেলের ঠিকানা।
2. **অন্তত একটা সক্রিয় Rule লাগবে** — নইলে ইঞ্জিন কোনো row লেখেই না, Activity খালি থাকবে।
3. `.env`-এর `AUTOMATION_INTERNAL_SECRET` = n8n Header Auth credential — হুবহু এক হতে হবে।
   (লোকাল `.env`-এ ভিন্ন মান থাকলে টানেলে ৪০১ আসবে।)
4. ⚠️ **"AI উত্তর আসছে" দেখে গেট কাজ করছে মনে করবেন না।** গেটের `onError:
   continueRegularOutput` ৪০৪/টাইমআউট চুপচাপ গিলে ফেলে, আর AI আগের মতোই উত্তর দেয়।
   আসল প্রমাণ দুটো: (ক) Activity Log-এ row, (খ) ক্যানড উত্তর এলে AI Agent পুরো এড়িয়ে যাওয়া
   (`Gate Reply?` true → `Gate Return`, AI চলে না)।
5. **Gate timeout `5000` → `10000`** করা হয়েছে। Vercel cold start + Neon connection ৫ সেকেন্ড
   ছাড়িয়ে যায়, আর টাইমআউটও ওই একইভাবে গিলে ফেলা হয়।

---

## ডেটাবেস নিরাপত্তা (মেমোরি নিয়ম)
`n8n_chat_histories` Prisma-বহির্ভূত (n8n বানায়)। এই সেশনে চালানো ডিফ:
```
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema --script
```
আউটপুট: শুধু একটি `ALTER TABLE "chatbot"."Chunk" ... SET DEFAULT` — **কোনো `DROP TABLE` নেই**।

---

## যাচাইয়ের অবস্থা
- [x] `npx tsc --noEmit` — **exit 0** (আগে ১৫টি error)
- [x] `npx prisma validate` — valid 🚀
- [x] locale JSON (৪টি) — সব parse হচ্ছে
- [x] `prisma migrate diff` — কোনো `DROP TABLE` নেই
- [x] automation টেবিল ৭টি DB-তে আছে (আলাদা ডিফ দিয়ে নিশ্চিত)
- [x] `docs/n8n-JSON/{Core-AI-Brain,Automation-Gate}.json` — `JSON.parse` দুটোই OK
- [x] সব লাইভ URL `driplare-ai.vercel.app`-এ (বাকি `driplare.com` শুধু ব্যাখ্যা/ইমেইল/লগে)
- [ ] `npm run build` — চালানো হয়নি (dev server পোর্ট ৩০০০-এ চলছে; next.config নিজেই নিষেধ করে)
- [ ] `npm run lint` — ৬টি error, কিন্তু **একই rule আগে থেকেই deployed কোডে আছে** (knowledge-base,
      inbox) → build আটকায় না। তবু পরিষ্কার করা উচিত
- [ ] n8n-এ আপডেটেড JSON রি-ইমপোর্ট + এন্ড-টু-এন্ড টেস্ট — ইউজারের
- [ ] অন্তত একটা সক্রিয় Rule বানানো — ইউজারের (নইলে Activity খালি থাকবে, এটা by design)
- [ ] ব্রাউজারে হাতে যাচাই — ইউজারের

### lint-এ পড়ে থাকা ৬টি error
| ফাইল | নিয়ম | মন্তব্য |
|---|---|---|
| `automation-card.tsx:154`, `trigger-picker.tsx:154` | `Cannot create components during render` | `iconFor()` একটি static ম্যাপ থেকে stable কম্পোনেন্ট দেয় — আসলে নিরীহ, রুলটি প্রমাণ করতে পারছে না |
| `activity/page.tsx`, `broadcasts/page.tsx`, `page.tsx`, `templates/page.tsx` | `set-state-in-effect` | fetch-on-mount প্যাটার্ন; আগের কোডেও একই |

---

## প্ল্যান-বহির্ভূত আবিষ্কার (নথিবদ্ধ)
1. **আউটবাউন্ড WhatsApp/Instagram পথ নেই** — inbox send routes Graph API-র `me/messages` হার্ডকোড করে
   (শুধু Facebook)। AI-র রিপ্লাই যায় কারণ সেটা n8n পাঠায়। এজন্যই `lib/services/outbound.ts`।
2. **sessionId কনভেনশন:** `fb_<psid>` · `fbc_<commentId>` · `ig_<igsid>` · `wa_<phone>` · `web_<id>`।
   `fbc_` সেশনে DM করা যায় না।
3. **`chargeUsage` টোকেন-নিরপেক্ষ** — `resolveReplyCredits(modelId)` ফ্ল্যাট per-reply credit দেয়।
   তাই Gate-এর short-circuit পথে `billingOk: true` পাঠানো আবশ্যক।
4. **`{{name}}` Gate পথে ফাঁকা আসে** — Gate payload পাঠায় না। `ChatSession.aiExtractionData` থেকে
   ভরাট করা সম্ভব, কিন্তু V1-এ সীমাবদ্ধতা হিসেবে নথিবদ্ধ।
5. **লোকাল টেস্টে টানেল লাগে** — n8n VPS-এ, `localhost` ওখান থেকে পৌঁছায় না।

---

## বাকি (আগের টাস্ক থেকে)
তিনটি মরা ফাইল এখনো পড়ে আছে; কোথাও import হয় না, তাই অক্ষতিকর:
`_components/tester-bubble.tsx`, `playground/_components/single-test/messenger-bubble.tsx`,
`playground/_components/single-test/docked-chat.tsx`

**ব্রডার নোট (এই টাস্কের বাইরে):** `lib/domain/plan-downgrade.ts` ও `lib/core/region.ts`-এ
বাংলা কমেন্ট আছে — AGENTS.md §১ অনুযায়ী কোড কমেন্ট ইংরেজি হওয়া উচিত। ওই ফাইলগুলো এই টাস্কে
আপডেট হয়নি, তাই এখনো ঠিক করা হয়নি।
