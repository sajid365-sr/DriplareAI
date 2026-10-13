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
| n8n-এ read | DB থেকে plaintext | নতুন `Decrypt Integration Secrets` Code node decrypt করে |

**কেন Prisma `$extends`:** `db.integration.*` প্রায় ৪০টি জায়গা থেকে লেখা/পড়া হয়। প্রতিটি call site-এ হাত দিলে দুটি নীরব বিপদ থাকে — একটি write site বাদ পড়লে ওই token চিরতরে plaintext থেকে যায়, আর একটি read site বাদ পড়লে live channel ciphertext-কে access token ভেবে Meta-কে পাঠায়। hook একবারে দুটোই ঢাকে।

**কেন কিছু field encrypt করা হয়নি:** `pageId`, `phoneNumberId`, `instagramAccountId`, `wabaId`, `connectionSource` — এগুলো n8n-এর SQL `WHERE` clause-এ ব্যবহৃত হয় (`i.config->>'pageId' = '...'`), যা শুধু plaintext-এ match করে। এগুলো identity/lookup key, secret নয়।

---

## ⚠️ ক্রম (order) — এটাই সবচেয়ে গুরুত্বপূর্ণ

n8n token **অ্যাপের API দিয়ে নয়, সরাসরি Postgres থেকে** পড়ে। তাই কোনো row `v1:...` হয়ে গেলে যে workflow-তে decrypt step নেই, সেটি ciphertext-কে token ভেবে Meta-কে পাঠাবে এবং ওই channel-এর **প্রতিটি reply ব্যর্থ হবে**।

সঠিক ক্রম:

```
১. n8n-এ decrypt node + env var        ← এখন (কিছুই ভাঙবে না, নিচে ব্যাখ্যা আছে)
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

নতুন node-এর নাম **`Decrypt Integration Secrets`**। পুরোনো workflow-তে `$('Fetch Integration')` যেখানেই ছিল (FB-তে ১১টি, IG-তে ১৮টি, WA-তে ১০টি reference) সেগুলো স্বয়ংক্রিয়ভাবে নতুন node-এর দিকে ঘুরিয়ে দেওয়া হয়েছে — নইলে ওরা ciphertext পেত।

### ১.২ দুটি environment variable

n8n-এর environment-এ যোগ করুন (`.env` বা Docker compose):

```bash
# Code node-এ require('crypto') চালু করার জন্য
NODE_FUNCTION_ALLOW_BUILTIN=crypto

# Vercel-এর INTEGRATION_ENCRYPTION_KEY-এর হুবহু একই মান
INTEGRATION_ENCRYPTION_KEY="<Vercel-এর মানটি এখানেও বসান>"
```

> **Task Runner সতর্কতা:** নতুন n8n version-এ Code node আলাদা process-এ (task runner) চলে। তখন `NODE_FUNCTION_ALLOW_BUILTIN` main container-এর env থেকে না পড়ে `/etc/n8n-task-runners.json`-এর `env-overrides` থেকে পড়তে পারে। যদি নিচের test-এ `require is not defined` আসে, ওই ফাইলে দেখুন অথবা n8n issue [#28639](https://github.com/n8n-io/n8n/issues/28639) অনুযায়ী patched JSON mount করুন।

### ১.৩ node-টি import করার আগেই যাচাই করুন

n8n editor-এ একটি **নতুন খালি Code node** খুলে নিচের কোডটি পেস্ট করে **Execute** করুন। এতে বোঝা যাবে `require` ও key দুটোই ঠিক আছে কি না:

```javascript
const crypto = require('crypto');                 // ← এখানে fail করলে ১.২ দেখুন
const key = Buffer.from($env.INTEGRATION_ENCRYPTION_KEY, 'base64');
if (key.length !== 32) throw new Error('key must be 32 bytes, got ' + key.length);

// নমুনা মান — শুধু এই test-এর জন্য। Production key ভিন্ন।
const sample = 'v1:tgl7NwGk4JpZQkMl:HYF3TEHfKUJPsUqxHcRDzA==:iHlQX7lViZMZ6yf79nNSd+aMhaXR6jugma0+qOXXiXWqVP9bKyyEZ0Y=';
const [ , ivB64, tagB64, dataB64 ] = sample.split(':');
const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'), { authTagLength: 16 });
d.setAuthTag(Buffer.from(tagB64, 'base64'));
const out = Buffer.concat([d.update(Buffer.from(dataB64, 'base64')), d.final()]).toString('utf8');

return [{ json: { decrypted: out } }];
```

⚠️ উপরের `sample` শুধু **এই test-এর জন্য** বানানো। এটি decrypt করতে n8n-এর key হতে হবে:

```
AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=
```

এই sample key-এর fingerprint: **`630dcd29`** — n8n-এ sample key দিয়ে চালালে boot log-এও একই মান দেখা উচিত।

অর্থাৎ ১.৩ চালানোর সময় **সাময়িকভাবে** `INTEGRATION_ENCRYPTION_KEY`-তে এই sample key দিন, `decrypted` হিসেবে `EAAG_test_token_for_n8n_node_verification` দেখতে পাবেন, তারপর **আসল key ফিরিয়ে দিন**। `decrypted` মানটি মিললেই প্রমাণ — n8n ও অ্যাপ একই format-এ কথা বলছে।

> **কেন fingerprint দরকার:** প্রতিটি boot-এ অ্যাপ production log-এ key-এর ৮-অক্ষরের fingerprint ছাপে (`[env-audit] INTEGRATION_ENCRYPTION_KEY loaded (fingerprint 630dcd29)`). ভবিষ্যতে decryption error এলে প্রথম প্রশ্ন — "দুই পাশে কি একই key?" — এই fingerprint মিলিয়ে দেখলেই উত্তর পাওয়া যায়, key কখনো log-এ যেতে হয় না।

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

## যে path-টি বেছে নেওয়া হয়নি

task.md-এ দুটি path ছিল। **পথ ক** (n8n নিজে decrypt করে) বেছে নেওয়া হয়েছে, কারণ এতে critical path-এ কোনো নতুন network hop যোগ হয় না — প্রতিটি AI reply-তে ইতিমধ্যে ১১টি serial hop আছে।

**পথ খ** (n8n অ্যাপের internal API থেকে token আনে) latency বাড়ায়: n8n (Bangladesh) → Vercel → আবার ফেরত, প্রতি reply-তে ~২৩০ms বেশি। তবে এতে key শুধু এক জায়গায় (Vercel) থাকে। যদি task-runner সীমাবদ্ধতার কারণে path ক কাজ না করে, path খ-এ যাওয়া যাবে — তখন `x-n8n-secret` দিয়ে guarded `/api/internal/integration-config` route যোগ করতে হবে।

---

## ফাইল ম্যাপ

| ফাইল | ভূমিকা |
|---|---|
| [lib/core/crypto.ts](../lib/core/crypto.ts) | `encryptSecret` / `decryptSecret`, dual-read, `SECRET_CONFIG_KEYS` |
| [lib/core/db-encryption.ts](../lib/core/db-encryption.ts) | Prisma `$extends` query hook (write-এ encrypt, read-এ decrypt) |
| [lib/core/db.ts](../lib/core/db.ts) | hook টি shared client-এ যুক্ত; `createBasePrismaClient()` export |
| [instrumentation.ts](../instrumentation.ts) | boot-এ key audit + fingerprint |
| [scripts/encrypt-integration-secrets.ts](../scripts/encrypt-integration-secrets.ts) | backfill (`--apply` ছাড়া কিছুই লেখে না) |
| [.env.example](../.env.example) | `INTEGRATION_ENCRYPTION_KEY` template |

---

## ভবিষ্যতের জন্য

- নতুন কোনো integration field যদি secret হয়, **[`SECRET_CONFIG_KEYS`](../lib/core/crypto.ts)-এ নামটি যোগ করতে হবে** — না যোগালে সেটি নীরবে plaintext-এ লেখা হবে।
- Key rotate করতে হলে: `v1:` → `v2:` format যোগ করে dual-read চালু রাখতে হবে, তারপর দুটি key দিয়ে একবার re-encrypt।
- `$transaction` client-এ Prisma extension প্রযোজ্য হয় না। এখন `tx.integration` কোথাও নেই; ভবিষ্যতে যোগ করলে **নিজে encrypt করতে হবে**, নইলে token plaintext-এ যাবে।
