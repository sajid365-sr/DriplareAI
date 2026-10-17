# Integration Token Encryption at Rest — Rollout Guide

> **টাস্ক:** TASK-08 · **তারিখ:** ২০২৬-১০-১৩
> **মূল প্রশ্ন:** `Integration.config`-এ রাখা `pageToken`, `accessToken`, `instagramAccessToken` DB-তে **plaintext**-এ পড়ে আছে। একটি `DATABASE_URL` leak মানে সব merchant-এর Facebook Page hijack।

---

## কী বদলালো

| স্তর | আগে | এখন |
|---|---|---|
| DB-তে token | `EAAG...` (plaintext) | `v1:<iv>:<authTag>:<ciphertext>` (AES-256-GCM) |
| অ্যাপে write | সরাসরি সংরক্ষণ | Prisma `$extends` hook স্বয়ংক্রিয়ভাবে encrypt করে |
| অ্যাপে read | সরাসরি পাঠ | hook স্বয়ংক্রিয়ভাবে decrypt করে |
| n8n-এ read | DB থেকে plaintext | অ্যাপের `/api/internal/integration-secrets` থেকে decrypted config আসে (২০২৬-১০-১৮) |

**কেন Prisma `$extends`:** `db.integration.*` প্রায় ৪০টি জায়গা থেকে লেখা/পড়া হয়। প্রতিটি call site-এ হাত দিলে দুটি নীরব বিপদ থাকে — একটি write site বাদ পড়লে ওই token চিরতরে plaintext থেকে যায়, আর একটি read site বাদ পড়লে live channel ciphertext-কে access token ভেবে Meta-কে পাঠায়। hook একবারে দুটোই ঢাকে।

**কেন কিছু field encrypt করা হয়নি:** `pageId`, `phoneNumberId`, `instagramAccountId`, `wabaId`, `connectionSource` — এগুলো n8n-এর SQL `WHERE` clause-এ ব্যবহৃত হয় (`i.config->>'pageId' = '...'`), যা শুধু plaintext-এ match করে। এগুলো identity/lookup key, secret নয়।

---

## ⚠️ ক্রম (order) — এটাই সবচেয়ে গুরুত্বপূর্ণ

n8n token **অ্যাপের API দিয়ে নয়, সরাসরি Postgres থেকে** পড়ে। তাই কোনো row `v1:...` হয়ে গেলে যে workflow-তে decrypt step নেই, সেটি ciphertext-কে token ভেবে Meta-কে পাঠাবে এবং ওই channel-এর **প্রতিটি reply ব্যর্থ হবে**।

সঠিক ক্রম:

```
১. n8n-এ `Fetch Integration Secrets` node + Header Auth credential   ← এখন (কিছুই ভাঙবে না, নিচে ব্যাখ্যা আছে)
২. অ্যাপ deploy (Vercel)
৩. backfill script চালানো             ← DB-তে লেখে, অনুমতি নিয়ে
৪. দুই-তিনটি live test message
```

২. Deploy করুন। এই deploy-এর পর **নতুন** connect করা channel থেকে যাওয়া token `v1:...` হিসেবে সংরক্ষিত হবে। পুরোনো row-গুলো এখনো plaintext — dual-read থাকায় সেগুলোও আগের মতোই ঠিকঠাক কাজ করবে।

---

## ধাপ ১ — n8n (আপনাকে করতে হবে)

### ১.১ কোন workflow import করবেন

এই তিনটি ফাইল আপডেট হয়েছে — n8n-এ **পুরোনো version replace করে** import করুন:

| ফাইল | কী যোগ হলো |
|---|---|
| [docs/n8n-JSON/Facebook-Integration.json](./n8n-JSON/Facebook-Integration.json) | `Fetch Integration` ও `Guard Active`-এর মাঝে নতুন Code node |
| [docs/n8n-JSON/Instagram-Integration.json](./n8n-JSON/Instagram-Integration.json) | একই |
| [docs/n8n-JSON/WhatsApp-Integration.json](./n8n-JSON/WhatsApp-Integration.json) | একই |

`Core-AI-Brain.json` **ছোঁয়া হয়নি** — ওই workflow কোনো Integration token পড়ে না।

নতুন node-এর নাম **`Fetch Integration Secrets`** (২০২৬-১০-১৮-এর আগে ছিল `Decrypt Integration Secrets`)। পুরোনো workflow-তে `$('Fetch Integration')` যেখানেই ছিল (FB-তে ১১টি, IG-তে ১৮টি, WA-তে ১০টি reference) সেগুলো স্বয়ংক্রিয়ভাবে নতুন node-এর দিকে ঘুরিয়ে দেওয়া হয়েছে — নইলে ওরা ciphertext পেত।

### ১.২ n8n-এ কোনো environment variable লাগে না (২০২৬-১০-১৮)

> **কী বদলালো:** আগে decryption হতো n8n-এর **Code node**-এ, তাই `NODE_FUNCTION_ALLOW_BUILTIN=crypto` আর `INTEGRATION_ENCRYPTION_KEY` — দুটোই n8n-এর env-এ লাগত। **এখন আর লাগে না।**

| আগে | এখন |
|---|---|
| `Decrypt Integration Secrets` (Code node) নিজে key দিয়ে খুলত | `Fetch Integration Secrets` (HTTP Request) **অ্যাপকে জিজ্ঞেস করে** |
| n8n-এ `crypto` module + key — দুটোই লাগত | শুধু একটি **Header Auth credential** |

**কেন বদলাতে হলো:** hosted Community n8n-এ env variable যোগ করার উপায় নেই, আর task runner `require('crypto')` নিষিদ্ধ রাখে। Code node কখনো n8n credential পড়তে পারে না — তাই key পৌঁছানোর দ্বিতীয় কোনো পথ ছিল না। key তো অ্যাপের কাছেই আছে, তাই **খোলার কাজটা অ্যাপে** রাখা হলো (`POST /api/internal/integration-secrets`)।

**একবারের সেটআপ — Header Auth credential:**

n8n → Credentials → **Create New** → **Header Auth**

| Field | মান |
|---|---|
| Name | `Driplare Internal` |
| Header Name | `x-n8n-secret` |
| Header Value | Vercel-এর `N8N_CALLBACK_SECRET`-এর হুবহু একই মান |

তারপর তিনটি adapter-এ **`Fetch Integration Secrets`** node খুলে এই credential-টি বেছে নিন।

> ⚠️ `N8N_CALLBACK_SECRET` **আগেই** Vercel-এ আছে — `/api/internal/ai-quota`, `ai-usage`, `orders` দের ব্যবহার করে। তাই নতুন কোনো secret বানাতে বা Vercel-এ কিছু যোগ করতে হবে না।

> **ইতিহাস:** task runner-এ কী error আসত এবং কেন env যোগ করলেও সমাধান হতো না — সেটি [`task.md`](./Architecture-Update/task.md)-এর ২০২৬-১০-১৮ লগে লেখা আছে।

### ১.৩ যাচাই

> ⚠️ **প্রথম শর্ত: অ্যাপ deploy হয়েছে কি না।** শুধু JSON import করলে চলবে না — route-টি Vercel-এ পৌঁছাতে হবে।

১. `Fetch Integration Secrets` node-টি খুলে credential টিক আছে কি দেখুন
২. একটি পরীক্ষামূলক মেসেজ পাঠান
৩. node-এর output-এ `pageAccessToken` / `accessToken` (plaintext) দেখা যাবে — এটাই প্রত্যাশিত
৪. `Guard Active`-এ `connected: true` পেলে পরের ধাপ চলবে

**কিছু ভুল হলে:**

| Output | কারণ |
|---|---|
| `401 Unauthorized` | credential-এর মান `N8N_CALLBACK_SECRET`-এর সাথে মেলেনি |
| `404 Integration not found` | `integrationId` ভুল — `Fetch Integration`-এর SQL ঠিক আছে কি দেখুন |
| `500 Server misconfigured` | Vercel-এ `N8N_CALLBACK_SECRET` সেট করা নেই |
| `Response is not valid JSON` (নতুন) | deployment-এ route-টি নেই (পুরোনো build) — plain HTML ফিরছিল, তাই node এখন JSON দাবি করে |
| HTML output | আগের আচরণ, এখন আর হবে না — উপরের JSON-বাধাই ধরে ফেলবে |

> **আগের নমুনা-key পরীক্ষাটি বাদ:** ওটি `require('crypto')`-এর উপর নির্ভরশীল ছিল, যা hosted n8n-এ চলে না — তাই আর প্রযোজ্য নয়। key মিলছে কি না দেখতে এখন অ্যাপের boot log-এর fingerprint (`[env-audit] INTEGRATION_ENCRYPTION_KEY loaded (fingerprint …)`) ব্যবহার করুন।

---

## ধাপ ২ — অ্যাপ deploy

১. Vercel-এ `INTEGRATION_ENCRYPTION_KEY` যোগ করুন (নতুন key বানাতে):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

২. Deploy করুন। এই deploy-এর পর **নতুন** connect করা channel থেকে যাওয়া token `v1:...` হিসেবে সংরক্ষিত হবে। পুরোনো row-গুলো এখনো plaintext — এবং dual-read দুটি ঠিকঠাক কাজ করবে।
---

## ধাপ ৩ — Backfill (DB-তে লেখে)

প্রথমে **শুধু দেখুন**, কিছুই লেখা হবে না:

```bash
npm run secrets:audit
```

এটি প্রতিটি row scan করে জানাবে কোন field এখনো plaintext। **২০২৬-১০-১৩ তারিখে চালানো read-only probe অনুযায়ী বর্তমান অবস্থা:**

| Platform | Chatbot | Plaintext secret |
|---|---|---|
| facebook | `cmohv4dda0008mltgjaj4ank2` | `pageToken`, `userAccessTokenLongLived` |
| facebook | `cmuhdomc1000104jmiorudond` | `pageToken`, `userAccessTokenLongLived` |
| instagram / website / tiktok / webhook | — | কোনো secret নেই |

অর্থাৎ backfill **মাত্র ২টি row** বদলাবে, দুটোই Facebook। WhatsApp/Instagram integration এখনো কেউ connect করেনি।

সবুজ সংকেত পেলে (ধাপ ১ ও ২ সম্পন্ন):

```bash
npm run secrets:encrypt
```

Script-টি কখনো token প্রিন্ট করে না — শুধু field-এর নাম ও length, যাতে অস্বাভাবিক কিছু চোখে পড়ে।

---

## ধাপ ৪ — যাচাই

১. Facebook, WhatsApp, Instagram-এ একটি করে test message পাঠিয়ে reply পাওয়া যায় কি না দেখুন।
২. DB-তে grep করে নিশ্চিত হোন plaintext আর নেই:

```sql
SELECT "chatbotId", platform, left(config->>'pageToken', 3) AS token_prefix
FROM "chatbot"."Integration" WHERE config->>'pageToken' IS NOT NULL;
-- প্রতিটির জন্য token_prefix = 'v1:' হওয়া উচিত
```

৩. `npm run secrets:audit` আবার চালান — "0 to encrypt" দেখানো উচিত।

---

## Rollback

| পরিস্থিতি | করণীয় |
|---|---|
| n8n node কাজ করছে না | পুরোনো workflow ফিরিয়ে import করুন, backfill **করবেন না** — কিছুই encrypt হয়নি, তাই সব আগের মতো |
| Backfill-এর পর channel বন্ধ | DB backup থেকে row restore করুন, অথবা functional key দিয়ে `decryptSecret()` চালিয়ে plaintext লিখুন |
| Key হারিয়ে গেছে | Encrypted row আর পড়া যাবে না — encrypted column-এ **key backup ছাড়া কোনো recovery নেই**। Vercel ও n8n-এর env backup রাখুন |

> ⚠️ **`INTEGRATION_ENCRYPTION_KEY` হারানো = সব encrypted token হারানো।** এই key-টি password manager-এ রাখুন।

---

## যে path-টি শেষে বেছে নিতে হয়েছে

task.md-এ দুটি path ছিল। **পথ ক** (n8n নিজে decrypt করে) আগে বেছে নেওয়া হয়েছিল, কারণ এতে কোনো নতুন network hop থাকে না। কিন্তু ২০২৬-১০-১৮-এ দেখা গেল **পথ ক hosted Community n8n-এ চালানোই সম্ভব নয়** — task runner `require('crypto')` নিষিদ্ধ করে, আর env variable যোগ করার উপায় নেই (বিস্তারিত §১.২)।

তাই **পথ খ**-এই যেতে হয়েছে: n8n অ্যাপের internal API থেকে token আনে (`POST /api/internal/integration-secrets`, আগের নকশায় নাম ছিল `integration-config`)। মূল্য: প্রতি reply-তে একটি HTTPS hop (n8n → Vercel, একই region থেকে ~১০–২০ms), আর অ্যাপ বন্ধ থাকলে webhook ব্যর্থ হয়। বিনিময়ে key শুধু Vercel-এ থাকে — n8n-এ কোনো secret, env বা crypto module লাগে না।

---

## ফাইল ম্যাপ

| ফাইল | ভূমিকা |
|---|---|
| [lib/core/crypto.ts](../lib/core/crypto.ts) | `encryptSecret` / `decryptSecret`, dual-read, `SECRET_CONFIG_KEYS` |
| [lib/core/db-encryption.ts](../lib/core/db-encryption.ts) | Prisma `$extends` query hook (write-এ encrypt, read-এ decrypt) |
| [lib/core/db.ts](../lib/core/db.ts) | hook টি shared client-এ যুক্ত; `createBasePrismaClient()` export |
| [instrumentation.ts](../instrumentation.ts) | boot-এ key audit + fingerprint |
| [scripts/encrypt-integration-secrets.ts](../scripts/encrypt-integration-secrets.ts) | backfill (`--apply` ছাড়া কিছুই লেখে না) |
| [app/api/internal/integration-secrets/route.ts](../app/api/internal/integration-secrets/route.ts) | n8n-কে decrypted config দেয় (`x-n8n-secret` guarded, `no-store`) |
| [.env.example](../.env.example) | `INTEGRATION_ENCRYPTION_KEY` template |

---

## ভবিষ্যতের জন্য

- নতুন কোনো integration field যদি secret হয়, **[`SECRET_CONFIG_KEYS`](../lib/core/crypto.ts)-এ নামটি যোগ করতে হবে** — না যোগালে সেটি নীরবে plaintext-এ লেখা হবে।
- Key rotate করতে হলে: `v1:` → `v2:` format যোগ করে dual-read চালু রাখতে হবে, তারপর দুটি key দিয়ে একবার re-encrypt।
- `$transaction` client-এ Prisma extension প্রযোজ্য হয় না। এখন `tx.integration` কোথাও নেই; ভবিষ্যতে যোগ করলে **নিজে encrypt করতে হবে**, নইলে token plaintext-এ যাবে।
