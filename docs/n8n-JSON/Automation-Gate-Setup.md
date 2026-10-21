# Automation Gate — n8n ইনস্টল গাইড

> এই ফাইলটা হাতে ইমপোর্ট করার জন্য। কোনো কোড ডিপ্লয় হলেও n8n নিজে থেকে আপডেট হয় না — নিচের ধাপগুলো শেষ না করলে **rule সেভ হবে কিন্তু কখনো ফায়ার করবে না**, আর কোনো এররও দেখাবে না।

---

## ১. এটা কী করে

আগে প্রতিটি ইনকামিং মেসেজ মানে একটা পুরো RAG + LLM round trip — টাকা খরচ হয়, দেরি হয়।

`Automation Gate` নোডটা `Ensure Session`-এর ঠিক পরে বসে প্ল্যাটফর্মের automation engine-কে জিজ্ঞেস করে:

> "এই মেসেজের জন্য কি কোনো rule-এর ক্যানড উত্তর আছে?"

উত্তর তিনরকম:

| engine-এর উত্তর | Gate কী করে | খরচ |
|---|---|---|
| `action = "reply"` (আর `continueWithAi = false`) | ক্যানড মেসেজটাই কাস্টমারকে যায়, **AI Agent পুরো এড়িয়ে যাওয়া হয়** | **০ credit** |
| `muteAi = true` (`pause_ai` / `handoff_to_human`) | কোনো rule কথা বলে না — AI-ও থামে (human ধরেছে) | ০ credit |
| বাকি সব (`continue`, `continueWithAi = true`) | আজকের স্বাভাবিক পথ — RAG → AI Agent | আগের মতোই |

মূল লাভ: keyword-ভিত্তিক সাধারণ প্রশ্ন ("দাম কত", "ডেলিভারি চার্জ") AI ছাড়াই সাথে সাথে উত্তর পায়।

---

## ২. আগে যা করতে হবে (প্ল্যাটফর্মের দিকে)

> 🌐 **প্ল্যাটফর্ম অ্যাপের ডোমেইন: `https://driplare-ai.vercel.app`**
>
> `www.driplare.com`-এ এই অ্যাপটি **নেই** — ওখানে মার্কেটিং সাইট আছে, আর ওই হোস্টে **প্রতিটি `/api` রুট ৪০৪** দেয় (`/api/internal/ai-usage`-ও)। driplare.com ডোমেইনটি Vercel প্রজেক্টে যোগই করা নেই। তাই n8n-এর সব নোড `driplare-ai.vercel.app`-এ তাক করা।

`app/api/automations/evaluate/route.ts` একটি shared secret দিয়ে সুরক্ষিত। Vercel project **`driplare-ai`** → Settings → Environment Variables-এ যোগ করুন:

```
AUTOMATION_INTERNAL_SECRET = <যেকোনো লম্বা random string>
```

```bash
# random মান বানাতে
openssl rand -hex 32
```

⚠️ এই ভেরিয়েবল সেট না থাকলে endpoint **সবসময় 401 দেয়** (ইচ্ছাকৃত — যে endpoint merchant-এর হয়ে মেসেজ পাঠাতে পারে, সেটা খোলা রাখা বিপজ্জনক)।

---

## ৩. Credential বানান (n8n-এর দিকে)

n8n UI → **Credentials → New → Header Auth**

| Field | Value |
|---|---|
| Name | `x-driplare-internal` |
| Value | উপরের `AUTOMATION_INTERNAL_SECRET`-এর **হুবহু** একই মান |

> ⚠️ বিদ্যমান `x-n8n-secret` credential-টা এখানে **কাজ করবে না** — ওটা `N8N_CALLBACK_SECRET`, সম্পূর্ণ আলাদা।

---

## ৪. নোডগুলো ইমপোর্ট করুন

`docs/n8n-JSON/Automation-Gate.json` — দুভাবে করা যায়:

**উপায় ক — paste (সুপারিশকৃত):** ফাইলটা টেক্সট এডিটরে খুলে পুরো কনটেন্ট কপি করুন → Core-AI-Brain ওয়ার্কফ্লো canvas-এ `Ctrl+V`।

**উপায় খ — import:** n8n → Workflows → Import from File → ফাইলটা বেছে নিন → নতুন ওয়ার্কফ্লো হিসেবে খুলবে → সব নোড select করে কপি → Core-AI-Brain-এ paste করুন।

পেস্ট করার পর ৪টি নোড যোগ হবে: `Automation Gate`, `Gate Decision`, `Gate Reply?`, `Gate Return` — সাথে একটে বাংলা sticky note।

তারপর `Automation Gate` নোড খুলে **Credential** ড্রপডাউনে ৩ নম্বর ধাপের credential-টা select করুন।

---

## ৫. কানেকশন বদলান — ১টি কাট, ৩টি জোড়

Core-AI-Brain-এ এখন আছে: `Ensure Session → Media Router`।

```
কাটুন : Ensure Session  →  Media Router

জোড়ান : Ensure Session       →  Automation Gate
জোড়ান : Gate Reply? (true)   →  Gate Return
জোড়ান : Gate Reply? (false)  →  Media Router
```

`Gate Reply?` একটি IF নোড — উপরের আউটপুট `true`, নিচেরটা `false`।

> ⚠️ `Gate Return` এবং `Return to Platform` দুটো **আলাদা** নোড, একটার জায়গায় অন্যটা নয়। `Return to Platform` ভেতরে `$('Format Response')` ও `$('Billing API')` রেফারেন্স করে — short-circuit পথে ওই নোড দুটো চলে না, তাই ওখানে গেলে n8n "Referenced node is unexecuted" ত্রুটি দেবে। এজন্যই আলাদা `Gate Return`।

---

## ৬. `Format Response` নোডের ছোট পরিবর্তন

এই ধাপটা `continueWithAi` ("এটা বলো, **তারপর** AI চালাও") কাজ করার জন্য দরকার। না করলে ওই কনফিগে merchant-এর ক্যানড মেসেজটা চুপচাপ হারিয়ে যাবে।

`Format Response` নোড খুলুন। দুটি পরিবর্তন:

**ক.** `const replyText = raw.replace(...)` — কে `let replyText = raw.replace(...)` করুন (`const` → `let`)।

**খ.** `return [{` লাইনের **ঠিক আগে** বসান:

```js
// A rule asked to speak before the agent does ("send this, then let the AI
// carry on"). The Gate already rendered the text; prepending it here is what
// makes that combination work — without it the canned message would be
// silently dropped, because the reply the customer sees is this one.
// try/catch because this workflow can also be run without the Gate present
// (older import), and `$(...)` throws on an unexecuted node.
let gateText = "";
try {
  gateText = $("Gate Decision").item.json.gateText || "";
} catch (err) {
  gateText = "";
}
if (gateText) replyText = gateText + "\n\n" + replyText;
```

---

## ৭. যাচাই করুন

### ৭ক. আগে অন্তত একটা Rule বানান — নইলে কিছুই দেখবেন না

⚠️ **এটাই সবচেয়ে বেশি ভুল বোঝাবুঝি হয়।** কোনো সক্রিয় Rule না থাকলে ইঞ্জিন কিছুই লেখে না: `runEvent` (`lib/automations/run.ts`) Rule-এর তালিকা খালি পেলে সাথে সাথেই ফিরে আসে, কোনো `AutomationRun` row তৈরি হয় না। ফলে Activity Log খালি থাকবে — **অথচ Gate ঠিকঠাক ডাকছিল**।

তাই আগে `/dashboard/automations` → **Create Rule** → ধরুন Trigger `keyword.match`, keyword `দাম` → সেভ করে **Active** করুন। তারপর মেসেজ পাঠান।

> Activity পেজ এখন এই অবস্থাটা নিজেই বলে দেয়: Rule না থাকলে *"এখনো কোনো সক্রিয় Automation নেই"* নোট দেখাবে। আর Rule থাকা সত্ত্বেও কিছু না এলে *"Automation Gate সংযুক্ত নয়"* banner — তখনই কানেকশন বা credential-এর দিকে তাকাবেন।

### ৭খ. localhost থেকে টেস্ট করছেন?

n8n আপনার VPS-এ চলে, আর আপনার `localhost:3000` ওখান থেকে পৌঁছানো **যায় না**। তাই Gate নোডে সরাসরি `http://localhost:3000/...` বসালে `ECONNREFUSED` আসবে। একটা টানেল দরকার:

```bash
cloudflared tunnel --url http://localhost:3000
# অথবা
ngrok http 3000
```

যে URL পাবেন (যেমন `https://xxxx.trycloudflare.com`), সেটি Gate নোডের URL ঘরে বসান:

```
https://xxxx.trycloudflare.com/api/automations/evaluate
```

> টানেল বন্ধ করলে Gate-ও থেমে যাবে — n8n দিক থেকে টাইমআউট দেখাবে। টেস্ট শেষে URL আবার `https://driplare-ai.vercel.app/api/automations/evaluate`-এ ফিরিয়ে দিন।
>
> এছাড়া `.env`-এর `AUTOMATION_INTERNAL_SECRET` আর n8n-এর Header Auth credential — দুটোর মান হুবহু এক থাকতে হবে (লোকাল `.env` আলাদা হলে ৪০১ আসবে)।

### ৭গ. চেকলিস্ট

1. **Gate সক্রিয় কি?** Playground / Facebook থেকে একটা মেসেজ পাঠান → `/dashboard/automations/activity` খুলুন → একটি `run` row দেখা উচিত।
2. **credit বাঁচছে কি?** একটি keyword rule বানান (trigger `keyword.match`, keyword `দাম`) → সেই মেসেজটি পাঠান → ক্যানড উত্তর সাথে সাথে আসছে, কিন্তু `AIUsageLog`-এ ওই মেসেজের জন্য **কোনো খরচ নেই**।
3. **AI পথ ভাঙেনি তো?** এমন একটা মেসেজ পাঠান যা কোনো rule-এ মেলে না → আগের মতোই AI উত্তর দিচ্ছে।
4. **দুই শাখাই কাজ করছে?** `Gate Reply?` নোডের output-এ ক্লিক করে দুবার পরীক্ষা করুন — একবার rule মেলে (true), একবার না মেলে (false)।

---

## ৮. সমস্যা হলে

| লক্ষণ | কারণ |
|---|---|
| Activity Log-এ কিছুই আসে না | প্রথমে দেখুন কোনো সক্রিয় Rule আছে কি না — না থাকলে কোনো row লেখাই হয় না (৭ক দেখুন)। Rule থাকা সত্ত্বেও খালি হলে: `Ensure Session → Automation Gate` কানেকশন নেই, বা `AUTOMATION_INTERNAL_SECRET` সেট করা নেই |
| 404, আর বডিতে Next.js-এর "Page not found" HTML | রুটটি **ওই ডিপ্লয়মেন্টে** নেই। Gate নোডের URL ঘরে `https://driplare-ai.vercel.app/api/automations/evaluate` বসানো আছে কি না দেখুন — `www.driplare.com` থাকলে নিশ্চিতভাবে ৪০৪ আসবে, কারণ ওখানে অ্যাপটাই নেই |
| Activity Log খালি, **অথচ AI স্বাভাবিক উত্তর দিচ্ছে** | এটাই সবচেয়ে ধোঁকাবাজ লক্ষণ — মনে হবে সব ঠিক আছে। আসলে উল্টো: নিচের বাক্সটি দেখুন |
| `ECONNREFUSED`, বা নোড টাইমআউট | n8n VPS থেকে আপনার লোকাল মেশিনে পৌঁছাতে পারছে না — টানেল লাগবে (৭খ) |
| n8n-এ `401 Unauthorized` | Header Auth credential-এর মান প্ল্যাটফর্মের সাথে মিলছে না, বা credential select করা হয়নি |
| AI কোনো উত্তরই দিচ্ছে না | `Gate Reply?`-এর দুটো শাখা উল্টো জোড়া লেগেছে — `true` → `Gate Return`, `false` → `Media Router` |
| ক্যানড উত্তর আসছে কিন্তু Activity-তে `matched` কেন? | rule ঠিকই ফায়ার করেছে; `matched` মানে side-effect হয়েছে, মেসেজ যায়নি |
| `Referenced node is unexecuted` | ভুল করে `Gate Return`-এর বদলে `Return to Platform`-এ জোড়া লেগেছে (ধাপ ৫ দেখুন) |

### ⚠️ "AI উত্তর আসছে" — এটা Gate কাজ করার প্রমাণ নয়, বরং উল্টোটা

`Automation Gate` নোডে `onError: continueRegularOutput` বসানো আছে। তাই গেট যখনই ব্যর্থ হয় —
৪০৪, টাইমআউট, DNS — ওয়ার্কফ্লো **থামে না**: error অবজেক্টটাই `Gate Decision`-এ যায়, ওখানে
`gate.action` খালি পড়ে `"continue"` হয়, আর AI স্বাভাবিকভাবে উত্তর দিয়ে দেয়।

আর উল্টো দিকটা খেয়াল করুন: **কোনো rule মিললে AI Agent চলে-ই না** — `Gate Reply?`-এর true
শাখা সোজা `Gate Return`-এ যায়। তাই AI-র উত্তর মানে গেট কিছু বলেনি।

| যা দেখছেন | আসলে মানে |
|---|---|
| AI-র স্বাভাবিক উত্তর এল | গেট `continue` বলেছে — **অথবা গেট পৌঁছায়ইনি** |
| ক্যানড উত্তর সাথে সাথে এল, AI ভাবল না | গেট কাজ করছে ✓ |
| Activity Log-এ row এল | গেট ইঞ্জিনে পৌঁছেছে ✓ |

রুট সত্যিই সেখানে আছে কি না — এক লাইনে:

```bash
# 401 = রুট আছে (শুধু secret header বাকি) · 404 = এই ডিপ্লয়মেন্টে রুটটাই নেই
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://driplare-ai.vercel.app/api/automations/evaluate
```

`401` এলেই ঠিক আছে — Gate নোডের URL এটাই হওয়া উচিত। `404` এলে ডোমেইন ভুল।

> 💡 লোকাল ডেভেলপমেন্টে n8n (VPS) আপনার `localhost:3000`-এ পৌঁছাতে পারে না — টানেল লাগবে (৭খ)। কিন্তু **AI রিপ্লাই ফেরত আসে**, কারণ সেটা উল্টো দিকের কল: আপনার মেশিনই বাইরে ডাকে, আর খোলা socket-এ উত্তর ফেরে। এই অসমতার কারণেই বিলিং credit প্ল্যাটফর্মের দিকে সরানো হয়েছিল (`chat/route.ts`), কিন্তু Gate-কে তো **উত্তর দেওয়ার আগে** জিজ্ঞেস করতে হয় — তাই ওখানে টানেল ছাড়া উপায় নেই।

---

## ৯. V1-এর সীমাবদ্ধতা (জেনে রাখুন)

- **`{{name}}`-এর মতো variable খালি আসবে।** Gate শুধু `chatbotId`/`sessionId`/`message` পাঠায়; কাস্টমারের নাম-ফোন তখনো পড়া হয় না। ক্যানড মেসেজে `{{name}}` লিখলে সেটা ফাঁকা render হবে।
- **শুধু মেসেজ-ভিত্তিক trigger।** `order.created`, `session.idle`, `cart.abandoned` — এগুলো Gate দিয়ে যায় না, Cron (`/api/cron/run-automations`, প্রতি ১০ মিনিটে) এবং সার্ভার-সাইড থেকেই চলে।
- **ইমেজ/অডিওতে keyword মেলে না।** Gate `Media Router`-এর আগে বসে, তাই OCR/transcript তখনো হয়নি — শুধু ক্যাপশন টেক্সট মেলানো যায়।
- **`send_template` অ্যাকশন এখনো wire করা হয়নি** — WhatsApp approved template পাঠানোর অংশ বাকি।
- **সময়-ভিত্তিক ট্রিগার আপাতত নিষ্ক্রিয়।** `/api/cron/run-automations` রুটটি কোডে আছে, কিন্তু `vercel.json` থেকে cron-এন্ট্রিটি সরিয়ে রাখা হয়েছে — `*/10 * * * *` শিডিউল Vercel-এর Hobby plan-এ অনুমোদিত নয় (Hobby-তে দিনে একবারই চলে), আর ওটা থাকলে পুরো ডিপ্লয় ফেল করার ঝুঁকি ছিল। Pro plan নিলে এন্ট্রিটি ফিরিয়ে দেওয়া যাবে। মেসেজ-ভিত্তিক অটোমেশন (`message.received`, `keyword.match`) এতে প্রভাবিত হয় না — ওগুলো Gate দিয়েই চলে।
