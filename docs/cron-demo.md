# Driplare — Cron Jobs (সব scheduled কাজের একক তালিকা)

> **শেষ হালনাগাদ:** ২০২৬-১১-১২ — Workspace conversation learning worker cron যুক্ত
> **উদ্দেশ্য:** প্রোডাকশনে কোন scheduled কাজ চলা **দরকার**, কোনটি কোথায় schedule করতে হবে, আর কোনটি এখনো করা **যায় না** — সব এক জায়গায়।
>
> **সূত্র:** কোডবেস অডিট + Vercel Cron docs (usage-and-pricing, ২০২৬-০৭-১৫ যাচাইকৃত — এখন শুধু ইতিহাসের জন্য, §১)
>
> **বর্তমান অবস্থা:** Development deployment Vercel-এ চলছে; কোনো cron scheduler সক্রিয় নেই। Hostinger VPS-এ যাওয়ার পর crontab সক্রিয় করতে হবে। নির্ধারিত route-গুলো middleware-এ allowlisted, কিন্তু নিজের `CRON_SECRET` যাচাই করে।

## Cron job কী, এবং development-এ কীভাবে test করবেন

**Cron job** হলো নির্দিষ্ট সময় বা বিরতিতে স্বয়ংক্রিয়ভাবে চালানো scheduled কাজ। এই project-এ ছয়টি cron job আছে—এগুলো application-এর প্রয়োজনীয় কাজ, কিন্তু schedule নিষ্ক্রিয় থাকলে নিজে থেকে চলবে না।

Vercel-এ development চলাকালে cron scheduler বন্ধ থাকলেও app-এর সাধারণ feature test করা যায়। পাঁচটি scheduled task নিজে থেকে চলবে না। তবে Conversation Learning test করার জন্য Vercel-এ authenticated status polling প্রতিবার একটি bounded worker batch চালায়—browser-এ Learn from Conversations পেজ খোলা থাকলে job এগোবে; পেজ বন্ধ করলে আবার খুলে status poll শুরু হলে processing চলবে। এতে cron schedule চালু হয় না। অন্য cron কাজ manually test করতে authorized `CRON_SECRET` দিয়ে সংশ্লিষ্ট `/api/cron/<job>` route-এ **একবারের request** পাঠানো যায়; তবে route অনুযায়ী বাস্তব database update, email বা automation হতে পারে—শুধু বুঝে ও নিরাপদ test data দিয়ে চালাবেন।

এই পর্যায়ে কোনো Vercel বা VPS schedule সক্রিয় নেই। সব schedule-এর source file ও activation নির্দেশনা রাখা আছে; Hostinger VPS-এ migration-এর পর §৪ অনুসরণ করে চালু করবেন।

### 🗓️ সিদ্ধান্ত (২০২৬-১০-১৩): Scheduler = Hostinger VPS, Vercel Cron নয়

প্রোডাকশন **Hostinger VPS**-এ ডেপ্লয় করার পরিকল্পনা আছে, তাই Vercel Cron ব্যবহার করা হচ্ছে না। `vercel.json`-এ কোনো cron schedule নেই এবং VPS-এর schedule-গুলোও migration-এর আগে নিষ্ক্রিয় থাকবে।

নতুন ফাইল (এই সিদ্ধান্তের বাস্তবায়ন):

| ফাইল | কী |
|---|---|
| [`scripts/cron/run-cron.sh`](../scripts/cron/run-cron.sh) | Job runner — endpoint কল করে, retry করে, ব্যর্থতা স্পষ্টভাবে জানায় |
| [`scripts/cron/crontab.example`](../scripts/cron/crontab.example) | পূর্ণ crontab — ৪টি দৈনিক, ১টি প্রতি ১০ মিনিট, ১টি প্রতি মিনিট; সব schedule default-এ নিষ্ক্রিয় |
| [`scripts/cron/cron.env.example`](../scripts/cron/cron.env.example) | `BASE_URL` + `CRON_SECRET` টেমপ্লেট |

👉 Hostinger VPS-এ যাওয়ার পরে কীভাবে সক্রিয় করবেন: **§৪ — VPS-এ cron চালানো** (নিচে)।
👉 Vercel-এর নিয়মগুলো (§১) প্রোডাকশনে আর ব্যবহৃত হয় না, তবে ভবিষ্যতে Vercel-এ ফিরলে বা **Pro**-তে গেলে দরকার হবে বলে রাখা হলো।

---

## ১. Vercel plan-এর নিয়ম (ℹ️ ইতিহাস — প্রোডাকশনে আর প্রযোজ্য নয়)

অনেকে ভাবেন "Hobby-তে cron সংখ্যা কম" — **সেটি ভুল**।

| | Cron সংখ্যা | সর্বনিম্ন interval | সময়ের নির্ভুলতা |
|---|---|---|---|
| **Hobby** | **১০০** | **দিনে একবার** | ঘণ্টা হিসেবে (±৫৯ মিনিট) |
| **Pro** | ১০০ | প্রতি মিনিট | প্রতি মিনিট |
| **Enterprise** | ১০০ | প্রতি মিনিট | প্রতি মিনিট |

**আসল সীমাটি frequency-তে, সংখ্যায় নয়:**

- Hobby-তে `*/10 * * * *` (প্রতি ১০ মিনিট) বা `0 * * * *` (প্রতি ঘণ্টা) দিলে deploy **পুরোপুরি ফেল করে** — error: *"Hobby accounts are limited to daily cron jobs. This cron expression would run more than once per day."*
- Hobby-তে `0 3 * * *` লেখা থাকলে কাজটি **০৩:০০ থেকে ০৩:৫৯-এর মধ্যে যেকোনো সময়** চলে। ঠিক ৩টায় নয়।
  - ✅ ভালো দিক: `0 0`, `0 1`, `0 2`, `0 3` — এগুলো একে অপরের ঘণ্টায় ঢোকে না, তাই ক্রম ঠিক থাকে।

> 💡 তাই **দৈনিক** যত খুশি cron রাখা যায় (১০০ পর্যন্ত)। সমস্যা শুধু **প্রতি ১০ মিনিটে** চালাতে হলে।

---

## ২. পূর্ণ তালিকা — কী আছে, কী দরকার

| # | Route | কী করে | দরকারি schedule | `vercel.json`-এ এখন? | Auth |
|---|---|---|---|---|---|
| ১ | `/api/cron/process-downgrades` | সময় হওয়া plan downgrade কার্যকর করে | দৈনিক `0 0 * * *` | ❌ নেই | `CRON_SECRET` — না থাকলে **500** |
| ২ | `/api/cron/reset-credits` | মাসিক credit reset | দৈনিক `0 1 * * *` | ❌ নেই | `CRON_SECRET` — না থাকলে **500** |
| ৩ | `/api/cron/usage-alerts` | usage threshold scan + ৬ মাসের পুরনো alert মুছে ফেলা | দৈনিক `0 2 * * *` | ❌ নেই | `CRON_SECRET` — না থাকলে **503** |
| ৪ | `/api/cron/webhook-cleanup` | ৭ দিনের বেশি পুরনো `WebhookDelivery` row মুছে ফেলা | দৈনিক `0 3 * * *` | ❌ নেই | `CRON_SECRET` — না থাকলে **500** |
| ৫ | `/api/cron/run-automations` | scheduled broadcast পাঠানো + `session.idle` trigger | **প্রতি ১০ মিনিট `*/10 * * * *`** | ❌ নেই | `CRON_SECRET` — না থাকলে **503** |
| ৬ | `/api/cron/process-conversation-learning` | Queued Workspace learning jobs-এর একটি resumable batch process করে | প্রতি মিনিট `* * * * *` | ❌ নেই | `CRON_SECRET` — না থাকলে **503** |

> 📌 **বর্তমানে কোনো scheduler চালু নেই।** VPS-এ যাওয়ার পর আসল সময়সূচি VPS crontab-এ থাকবে ([`scripts/cron/crontab.example`](../scripts/cron/crontab.example)) — **§৪** দেখুন।

### প্রতিটির বিস্তারিত

**১. `process-downgrades`** — যে customer plan বাতিল করেছেন কিন্তু cycle শেষ হয়নি, তাঁর downgrade সময় হলে কার্যকর হয়। না চললে বাতিল করা customer-ও পুরনো plan পেতে থাকেন (**সরাসরি আয় হারানো**)।

**২. `reset-credits`** — মাসিক credit reset, top-up credit roll over সহ। না চললে merchant-দের credit balance কখনো রিফ্রেশ হয় না, যদিও তাঁরা পেমেন্ট করেছেন।

**৩. `usage-alerts`** — real-time hook মূল পথ, কিন্তু balance ঠিক শেষ হয়ে গেলে deduction আগেই `402`-এ থেমে যায়, তাই ১০০% ছোঁয়ার ঠিক পরে কোনো alert-ই যায় না। এই cron সেই ফাঁক পূরণ করে (ব্যর্থ email-ও পরের দিন আবার চেষ্টা হয়)।
> `usage-alerts`-এও এখন `CRON_SECRET` বাধ্যতামূলক; middleware allowlist-এর পর কোনো scheduled route-ই unauthenticated চলে না।

**৪. `webhook-cleanup`** *(TASK-07-এ যোগ করা)* — `chatbot.WebhookDelivery` table-এ প্রতি inbound মেসেজে ১টি row জমে। Meta ~৭ দিন পর retry করা বন্ধ করে, তাই তার পুরনো row নিছক বোঝা — dedupe index ধীরে ধীরে ভারী করে। না চললে table অসীম বাড়বে (কিছু ভাঙবে না, কিন্তু index ভারী হবে)।

**৫. `run-automations`** — সময়-ভিত্তিক automation-এর একমাত্র চালক। তিনটি কাজ: due broadcast শুরু করা, চলমান broadcast-এর queue এগিয়ে নেওয়া, আর `session.idle` (customer চুপ হয়ে গেলে follow-up — সবচেয়ে বেশি চাওয়া automation) fire করা।
> ❌ **Vercel-এ এটি কখনো চলেনি।** `*/10 * * * *` Hobby-তে deploy ফেল করাত এন্ট্রিটি সরানো হয়েছিল। ✅ **VPS-এর crontab-এ প্রতি ১০ মিনিটে চলবে** ([`crontab.example`](../scripts/cron/crontab.example))। মেসেজ-ভিত্তিক automation (`message.received`, `keyword.match`) এতে **প্রভাবিত হয় না** — ওগুলো n8n-এর `Automation Gate` দিয়ে চলে।

---

## ৩. Cron operational risks and deployment verification

### সমস্যা ১ — Clerk matcher: code fix complete; production check pending

**বর্তমান অবস্থা (২০২৬-১১-১২):** নির্ধারিত ছয়টি cron route `proxy.ts`-এ আলাদাভাবে allowlisted, এবং route handlers-এ mandatory `CRON_SECRET` validation আছে। নিচের discovery note পুরোনো; production/VPS-এ একটি real scheduled request দিয়ে এখনও যাচাই করতে হবে।

**ঐতিহাসিক আবিষ্কার:** cron routes public matcher-এ না থাকায় Clerk request redirect করত। কোনোদিন `/api/cron/(.*)` wildcard allowlist করবেন না—এতে অন্য manual cron endpoints-ও Clerk auth এড়িয়ে যাবে।

`proxy.ts`-এর `isPublicRoute`-এ `/api/cron/(.*)` **নেই**, অথচ `proxy.ts`-ই এই repo-র একমাত্র middleware। matcher `'/(api|trpc)(.*)'` — তাই প্রতিটি `/api/cron/*` request Clerk-এর `auth.protect()`-এ আটকে যায়। **কোনো scheduler-ই Clerk session পাঠায় না** — Vercel Cron হোক বা VPS-এর `curl`, দুটোই শুধু `Authorization: Bearer <CRON_SECRET>` পাঠায়। অর্থাৎ **সcheduler বদলালেও এই ব্লকার একই থাকে** — এটি TASK-07-এর সাথে যোগ করা `webhook-cleanup`-সহ সব cron-কে অচল করে রাখবে।

**একই class-এর বাগ আগে এই repo-তেই ধরা পড়েছিল** — মূল `task.md`:

> **২. `proxy.ts` — দ্বিতীয় লুকানো ব্লকার।** `/api/automations/evaluate` `isPublicRoute`-এ ছিল না। ডিপ্লয় করলেও Clerk-এর `auth.protect()` n8n-কে sign-in-এ পাঠিয়ে দিত।

**যাচাই করুন (৩০ সেকেন্ডেই বোঝা যায়):**
```bash
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/usage-alerts
```
`200` = ঠিক আছে ✅ · **`307`/`302` = Clerk আটকে দিচ্ছে** ❌ (এটিই এই সমস্যা) · `401` = secret ভুল · `500` = `CRON_SECRET` সেট করা নেই।

> 💡 Vercel-এ থাকলে বদলে যাচাই করবেন: Project → **Cron Jobs** → প্রতিটি এন্ট্রির last-run status — ব্যর্থ দেখালে বা invocation-ই না থাকলে সমস্যা নিশ্চিত।
> ⚠️ `curl`-এ **`-L` ব্যবহার করবেন না**। redirect অনুসরণ করলে sign-in পেজের `200` আসবে, আর আপনি ভাববেন job চলছে।

**বাস্তবায়ন** (`docs/Architecture-Update/task.md` → **TASK-22**): নির্ধারিত ছয়টি cron route `proxy.ts`-এ আলাদাভাবে allowlisted; broad wildcard নয়।
Routes: `process-downgrades`, `reset-credits`, `usage-alerts`, `webhook-cleanup`, `run-automations`, and `process-conversation-learning`. নিচের পুরোনো wildcardটি শুধু anti-example।
```ts
// পুরোনো broad wildcard pattern — ব্যবহার করবেন না।
                   // each route guards itself with `Authorization: Bearer $CRON_SECRET`
```
সব scheduled handler mandatory `CRON_SECRET` constant-time যাচাই করে। অন্য/manual `/api/cron/*` endpoint-গুলো ইচ্ছাকৃতভাবে Clerk-protected রয়েছে।

### সমস্যা ২ — `run-automations`-এর কোনো clock নেই ✅ **সমাধান হয়েছে**

সমস্যা ছিল: `*/10 * * * *` Vercel-এর Hobby plan-এ deploy ফেলে, তাই এন্ট্রিটি সরানো হয়েছিল → সময়-ভিত্তিক automation (`session.idle`, broadcast) সম্পূর্ণ নিষ্ক্রিয় ছিল।

**পরিকল্পিত সমাধান:** Hostinger VPS-এ যাওয়ার পর crontab-এর `*/10 * * * *` schedule সক্রিয় হবে — 👉 **§৪ — VPS-এ cron চালানো** (নিচে)।

ভবিষ্যতের জন্য পথগুলো (এখন দরকার নেই, তবে ইতিহাস):

| পথ | কী | সুবিধা | অসুবিধা |
|---|---|---|---|
| ~~**ক**~~ | Vercel **Pro** plan → `*/10 * * * *` এন্ট্রি ফিরিয়ে আনা | সবচেয়ে সহজ, কোড অপরিবর্তিত | মাসিক খরচ |
| ~~**খ**~~ | External scheduler (cron-job.org, GitHub Actions) দিয়ে প্রতি ১০ মিনিটে POST | Hobby-তেই চলে | আরেকটি জায়গায় config |
| **গ** | **VPS-এর crontab** (`scripts/cron/crontab.example`) | VPS-এ সব একসাথে, কোনো অতিরিক্ত খরচ বা সীমা নেই | VPS-এ migration না হওয়া পর্যন্ত নিষ্ক্রিয় |

---

## ৪. VPS-এ cron চালানো

### যা যা লাগবে

তিনটি ফাইল repo-তে আগেই আছে:

| ফাইল | কোথায় বসবে | কী |
|---|---|---|
| `scripts/cron/run-cron.sh` | যেমন আছে (`/opt/driplare/scripts/cron/`) | Runner — কোন job, কতবার retry, ব্যর্থতা কীভাবে জানাবে |
| `scripts/cron/cron.env.example` | `/etc/driplare/cron.env` (chmod **600**) | `BASE_URL` + `CRON_SECRET` |
| `scripts/cron/crontab.example` | `crontab -u <user>` হিসাবে install | সময়সূচি |

### ধাপে ধাপে

**১. স্ক্রিপ্ট বসান**
```bash
sudo install -d -m 755 /opt/driplare/scripts
sudo cp -r scripts/cron /opt/driplare/scripts/cron
sudo chmod +x /opt/driplare/scripts/cron/run-cron.sh
```

**২. Secret ফাইল বানান**
```bash
sudo install -d -m 750 /etc/driplare
sudo install -m 600 scripts/cron/cron.env.example /etc/driplare/cron.env
sudo -e /etc/driplare/cron.env     # BASE_URL ও CRON_SECRET বসান
```
> `CRON_SECRET` অবশ্যই **অ্যাপের `CRON_SECRET`-এর সাথে হুবহু এক** হতে হবে (Vercel/VPS-এর environment-এ যেটি আছে)। না মিললে প্রতিটি job `401` ফেরবে।
> নতুন secret বানাতে: `openssl rand -hex 32`

`BASE_URL` কী হবে:

| অ্যাপ কোথায় চলছে | `BASE_URL` |
|---|---|
| এই VPS-এই (Coolify/nginx, একই machine) | `http://127.0.0.1:3000` — অথবা Coolify-র দেওয়া internal container address |
| এই VPS-এ, বাইরে থেকে অ্যাক্সেসযোগ্য | `https://your-domain.example` |
| এখনো Vercel-এ | Vercel domain |

> 💡 অ্যাপ যদি এই VPS-এই চলে, `127.0.0.1` ব্যবহার করলে request ইন্টারনেটে যায় না — দ্রুত, এবং বাইরে থেকে কেউ ওই path-এ হানা দিতে পারে না।

**৩. install করার আগে হাতে যাচাই করুন**
```bash
sudo -u <app-user> \
  CRON_ENV_FILE=/etc/driplare/cron.env \
  /opt/driplare/scripts/cron/run-cron.sh --list

# একটি job চালিয়ে দেখুন — অস্থায়ী নয়, আসল কাজটি করবে:
sudo -u <app-user> \
  CRON_ENV_FILE=/etc/driplare/cron.env \
  /opt/driplare/scripts/cron/run-cron.sh usage-alerts
```
প্রত্যাশিত: `[INFO] usage-alerts OK {"success":true,...}`

**৪. Hostinger VPS-এ যাওয়ার পরে schedule সক্রিয় করে crontab install করুন**

`scripts/cron/crontab.example` থেকে ছয়টি schedule line copy করুন—প্রতিটি line-এ cron expression-এর আগে থাকা `# ` সরিয়ে—এবং VPS-এর app user-এর crontab-এ যোগ করুন। `DISABLED` comment-গুলো crontab-এ যোগ করার দরকার নেই। তারপর:

```bash
sudo crontab -u <app-user> -e
sudo crontab -u <app-user> -l      # ছয়টি active schedule আছে কি না যাচাই
```

`crontab -l`-এ schedule line-গুলো `#` দিয়ে শুরু হওয়া চলবে না। `vercel.json`-এ cron যোগ করবেন না; একসঙ্গে একটিমাত্র scheduler রাখুন।

**৫. প্রমাণ দেখুন** (এটি বাদ দেবেন না — cron-এর সবচেয়ে সাধারণ বাগ হলো "কিছুই হচ্ছে না কিন্তু কেউ দেখছে না")
```bash
sudo tail -f /var/log/driplare-cron.log
sudo journalctl -u cron --since "10 min ago"   # cron নিজে ঠিক চলছে কি না
```
প্রতি ১০ মিনিটে `run-automations OK` লাইন আসা উচিত।

### ⛔ যে ভুলগুলো এখানে সবচেয়ে বেশি হয়

| ভুল | ফল | সমাধান |
|---|---|---|
| `CRON_SECRET` না মিললে | প্রতিটি job `401`, নীরব ব্যর্থতা | লগে `UNAUTHORIZED (401)` দেখবেন — এটিই একমাত্র ইঙ্গিত |
| নির্ধারিত route-এর matcher `proxy.ts`-এ না থাকা | ওই job **redirect** পায়, handler চলে না | লগে `REDIRECTED (HTTP 307)` — স্ক্রিপ্টটি সেটিই বলে দেবে |
| crontab-এ relative path | job আদৌ চলে না | সব path absolute (উদাহরণে তাই আছে) |
| সার্ভারের timezone UTC, কিন্তু সময় ভেবেছেন Dhaka | "midnight" job **সকাল ৬টায়** চলে | `CRON_TZ=Asia/Dhaka` (উদাহরণে আছে), অথবা সার্ভার UTC রাখলে schedule ৬ ঘণ্টা পিছিয়ে দিন |
| একই job দুই জায়গা থেকে (VPS + Vercel) | দুবার চলে — `run-automations` customer-কে দুটি একই নুডজ পাঠাতে পারে | `vercel.json`-এ cron যোগ করবেন না; VPS crontab-ই একমাত্র scheduler রাখুন |

---

## ৫. সাধারণ তথ্য

### নতুন cron যোগ করার নিয়ম

1. `proxy.ts`-এর `isPublicRoute`-এ শুধু নির্দিষ্ট route allowlist করুন; `/api/cron/(.*)` wildcard যোগ করবেন না।
2. Route বানান `app/api/cron/<name>/route.ts`-এ, `GET` দিয়ে (cron সবসময় `GET` পাঠায়)।
3. কোনো লজিক পুনরায় লিখবেন না — বিদ্যমান route থেকে function নিন।
4. `CRON_SECRET` guard যোগ করুন (উপরের #১/#২/#৪-এর মতো, `500` ফেরত দিয়ে **fail-closed**)।
5. `run-cron.sh`-এর `KNOWN_JOBS` তালিকায় নামটি যোগ করুন — নাহলে স্ক্রিপ্ট সেটি চিনবে না।
6. `crontab.example` ও VPS-এর আসল crontab — **দুই জায়গাতেই** এন্ট্রি দিন। শূন্য মিনিট এড়িয়ে একটি ফাঁকা hour বেছে নিন (একই সময়ে সব job একসাথে চালাবেন না)।
7. **⛔ ভুলে যাবেন না:** `proxy.ts`-এর `isPublicRoute`-এ নির্দিষ্ট route যোগ করুন — mandatory `CRON_SECRET` guard ছাড়া public করবেন না।
8. এই ফাইলের §২ তালিকা হালনাগাদ করুন।

### হাতে চালিয়ে পরীক্ষা করা

পছন্দের উপায় — **আসল runner দিয়েই** (VPS-এ যেটি চলবে):

```bash
CRON_ENV_FILE=/etc/driplare/cron.env /opt/driplare/scripts/cron/run-cron.sh reset-credits
```
`[INFO] reset-credits OK {...}` → ঠিক আছে। কোনো `ERROR` লাইন → উপরের §৪-এর টেবিল দেখুন।

শুধু endpoint-টি যাচাই করতে চাইলে:
```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  http://127.0.0.1:3000/api/cron/reset-credits
```

প্রত্যাশিত: `200` + `{"success":true,...}`।
`401` → secret ভুল। `500`/`503` → `CRON_SECRET` সেট করা নেই। `307` → ওই route-এর matcher অনুপস্থিত।
⚠️ `-L` দেবেন না — redirect অনুসরণ করলে sign-in পেজের `200` আসবে।

### সময় কেন এই ক্রমে

`0 0` → `0 1` → `0 2` → `0 3`: downgrade → credit reset → alert → cleanup। প্রথম তিনটি রাতের শুরুতে (merchant-দের কাছে সবচেয়ে কম দৃশ্যমান সময়), আর cleanup সবার শেষে যাতে অন্য কাজের সাথে প্রতিযোগিতা না করে।

---

## ৬. ⚠️ ইউজারের করণীয় চেকলিস্ট (VPS)

**VPS-এ যাওয়ার আগে**
- [ ] অ্যাপের environment-এ `CRON_SECRET` সেট করা আছে (না থাকলে #১, #২, #৪ cron `500` ফেরবে; `run-automations` `503`)

**VPS-এ বসানোর সময়**
- [ ] `/etc/driplare/cron.env` তৈরি, **chmod 600**, এবং `CRON_SECRET` অ্যাপেরটার সাথে **হুবহু** এক
- [ ] `BASE_URL` ঠিক আছে — অ্যাপ একই VPS-এ হলে `http://127.0.0.1:3000`
- [ ] `run-cron.sh --list` চলে (৬টি scheduled job নাম দেখায়)
- [ ] হাতে একটি job চালিয়ে `200` পাওয়া গেছে (যেমন `usage-alerts`)
- [ ] crontab install করা হয়েছে — `crontab -l` দিয়ে যাচাই
- [ ] `CRON_TZ=Asia/Dhaka` কাজ করছে, অথবা সময়সূচি ৬ ঘণ্টা পিছিয়ে দেওয়া হয়েছে

**Cron route deployment acceptance**
- [ ] নির্ধারিত ছয়টি route `proxy.ts`-এ allowlisted এবং সবগুলোতে mandatory `CRON_SECRET` guard আছে
- [ ] ভুল/অনুপস্থিত secret `401`/`503` দেয়; `CRON_SECRET` constant-time comparison-এ যাচাই হয়

**সবশেষে**
- [ ] `/var/log/driplare-cron.log`-এ প্রথম `OK` লাইন এসেছে (এবং logrotate বসানো হয়েছে)
- [ ] `vercel.json` থেকে `crons` ব্লক মুছে ফেলা হয়েছে — **একই job দুই জায়গা থেকে চললে `run-automations` customer-কে দুইবার নুডজ পাঠাতে পারে**

---

## ৭. তালিকার বাইরে (তৈরি হয়নি, ভবিষ্যতে দরকার হতে পারে)

| Route | কী | কোথায় আলোচিত |
|---|---|---|
| `/api/cron/openrouter-sync` | OpenRouter-এর real cost/balance sync — খরচ ও balance পর্যবেক্ষণ | `docs/cost-analytics/implementation_plan.md` |

> ⚠️ এগুলো **এখনো কোডে নেই** — শুধু পরিকল্পনা। বানালে §৫-এর "নতুন cron যোগ করার নিয়ম"-এর ৮টি ধাপ মানতে হবে।
