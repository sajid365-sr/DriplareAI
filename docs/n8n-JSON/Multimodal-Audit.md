# Multimodal Audit — ছবি ও Voice কীভাবে হ্যান্ডল হয়

> **অবস্থা:** 🔒 **স্থগিত** — [`docs/Architecture-Update/task.md`](../Architecture-Update/task.md)-এর বাকি টাস্কগুলো শেষ হওয়ার পরে হাতে নেওয়া হবে। এখন শুধু সংরক্ষণ করা হলো যাতে গবেষণাটি হারিয়ে না যায়।
> **অডিটের তারিখ:** ২০২৬-১০-১৩
> **মূল ফাইল:** [`Core-AI-Brain.json`](./Core-AI-Brain.json) — ৩৩টি node
> **সহায়ক ফাইল:** [`Facebook-Integration.json`](./Facebook-Integration.json) · [`Instagram-Integration.json`](./Instagram-Integration.json) · [`WhatsApp-Integration.json`](./WhatsApp-Integration.json) · [`Web-Playground-Integration.json`](./Web-Playground-Integration.json)

**প্রশ্ন ছিল:** কোনো customer প্রোডাক্টের ছবি বা voice পাঠালে AI সেটা কীভাবে হ্যান্ডল করে, খরচ কেমন হয়, বর্তমান সিস্টেম ঠিক আছে কি না, এবং কীভাবে উন্নত করা যায়।

**এক লাইনে উত্তর:** ছবি ও voice-এর **পাইপলাইন তৈরি হয়ে বসে আছে**, কিন্তু (১) WhatsApp-এ সেটি **কখনো চালু হয় না**, (২) যে channel-এ চলে সেখানে এর **খরচ merchant-এর কাছ থেকে নেওয়া হয় না**, (৩) MIME type-এর একটি ভুলে Messenger-এর voice note **পুরো execution মেরে ফেলে**, এবং (৪) সবচেয়ে দামি multimodal ফিচার — **ছবি দেখে প্রোডাক্ট মেলানো** — একেবারেই নেই।

---

## ০. এক নজরে — তীব্রতা অনুযায়ী

| # | সমস্যা | Severity |
|---|---|---|
| ১ | **WhatsApp-এ multimodal সম্পূর্ণ বন্ধ** — ছবি/voice পাঠালে bot বলে "টাইপ করুন" | 🔴 Critical |
| ২ | **Media-র খরচ কখনো charge হয় না** — প্ল্যাটফর্মে পুরো billing কাঠামো আছে, n8n পাঠায় না | 🔴 Critical |
| ৩ | **Messenger voice note প্রায় নিশ্চিতভাবে ভাঙবে** — `audio/mp4` Gemini-র সমর্থিত তালিকায় নেই | 🔴 Critical |
| ৪ | **Media-র কোনো node-এ `onError` নেই** — ৩ নম্বরের সাথে মিলে customer **কোনো উত্তরই পায় না** | 🔴 Critical |
| ৫ | **`Gemini Transcribe`-এ credential বসানো নেই** — Vision-এ আছে, Transcribe-এ `$env` | 🔴 High |
| ৬ | **`Download Image`/`Download Audio`-এ timeout বা size limit নেই** — n8n-এর default timeout **৩০০ সেকেন্ড**, আর URL আসতে পারে browser থেকে | 🔴 High |
| ৭ | **ছবি দেখে প্রোডাক্ট মেলানোর কোনো ব্যবস্থা নেই** — Vision শুধু OCR + বর্ণনা করে, তারপর নাম দিয়ে `ILIKE` খোঁজে | 🟠 High *(ফিচার ঘাটতি)* |
| ৮ | **FB/IG-তে video / sticker / file নীরবে বাদ পড়ে** — `return []`, customer কিছুই পায় না | 🟠 High |
| ৯ | **Inbox-এ AI-র বর্ণনা customer-এর লেখা হিসেবে জমা হয়** — `Save Chat History` enriched text সেভ করে | 🟡 Medium |
| ১০ | **টোকেন estimate `/3.8` ইংরেজির জন্য** — বাংলা ~১.৫–২ chars/token, তাই BD-তে ২–৩x কম চার্জ | 🟡 Medium |
| ১১ | **`Set Audio Message` transcript ফাঁকা হলে `resolvedMessage = ''`** | 🟡 Medium |
| ১২ | `Media Router`-এ video/file branch নেই (এখন inert — unknown type Text-এ পড়ে) | 🟢 Low |

**যেটি ঠিক আছে:** ফ্লো-এর গঠন, node-এর নামকরণ, `Merge Media`-এ তিনটি branch একসাথে মেলানো, Vision-এর credential ব্যবস্থা (Header Auth), memory-তে enriched text সেভ করা — এসব সঠিক নকশা। সমস্যা মূলত কনফিগারেশন ও অসম্পূর্ণতা, ভিত্তি নয়।

---

## ১. আজকের ফ্লো (যেভাবে কাজ করে)

```
When Called by Platform
        ↓
Fetch Bot Config → Ensure Session → Automation Gate → Gate Decision → Gate Reply?
                                                                          │ false
                                                                          ↓
                                                                     Media Router
                    ┌──────────────────────┬──────────────────────┬──────────────┐
                 (Text)                 (Image)                (Audio)        (—)
                    ↓                      ↓                      ↓
             Text Message          Download Image          Download Audio
                    │                      ↓                      ↓
                    │            Code in JavaScript        Gemini Transcribe
                    │            (base64)                          ↓
                    │                      ↓                 Set Audio Message
                    │              Gemini Vision                   │
                    │                      ↓                      │
                    │            Set Image Message                │
                    └──────────────────────┴──────────────────────┘
                                           ↓
                                      Merge Media  (noOp)
                                           ↓
                            Embed Query → RAG Search → Build Context
                                           ↓
                                       AI Agent   ← OpenRouter Chat Model
                                           │       ← Postgres Chat Memory (২০)
                                           │       ← Product Lookup / Create Order
                                           ↓
              Format Response → Order Created Check → Save Chat History
                                           ↓
                            Billing API → Return to Platform
```

### Node-ভিত্তিক বিবরণ (যাচাইকৃত)

| Node | type | কী করে |
|---|---|---|
| `Media Router` | switch | `mediaType` দেখে ৩ ভাগে ভাগ করে। **Text** = `notEquals image` **AND** `notEquals audio` (তাই `video`/`file`/unknown সব Text-এ পড়ে) |
| `Text Message` | set | `resolvedMessage = userMessage` |
| `Download Image` | httpRequest | `$('When Called by Platform').item.json.mediaUrl` — `responseFormat: file`। **timeout নেই** (n8n default ৩০০s) |
| `Code in JavaScript` | code | `getBinaryDataBuffer(0,'data')` → base64; `mimeType = $binary.data.mimeType \|\| 'image/jpeg'` |
| `Gemini Vision` | httpRequest | `gemini-2.5-flash:generateContent`, `inline_data`, **Header Auth credential**। Prompt: *"Extract all readable text (OCR) and list the key visual attributes (product type, colour, brand)... Be concise."* |
| `Set Image Message` | set | `resolvedMessage = userMessage + "\n[Image content]: " + <vision text>` |
| `Download Audio` | httpRequest | `mediaUrl`, `responseFormat: file`। **timeout নেই** |
| `Gemini Transcribe` | httpRequest | একই URL, কিন্তু header `x-goog-api-key: ={{ $env.GOOGLE_GEMINI_API_KEY }}` — **কোনো credential নেই**। Body: `JSON.stringify($binary.data.mimeType)` / `JSON.stringify($binary.data.data)` |
| `Set Audio Message` | set | `resolvedMessage = <transcript>` — **`userMessage` বাদ পড়ে**, আর transcript ফাঁকা হলে `''` |
| `Merge Media` | noOp | তিনটি branch একত্র করে — পরের সব node `$('Merge Media').item.json.resolvedMessage` পড়ে |

### Channel workflow থেকে ডেটা আসে যেভাবে *(মূল কারণ এখানেই)*

| Channel | `mediaType` | `mediaUrl` |
|---|---|---|
| **Facebook** | `att.type === 'image'` → `'image'`; `'audio'` → `'audio'`; **নইলে `'text'`** | `att.payload.url` |
| **Instagram** | হুবহু Facebook-এর মতো | `att.payload.url` |
| **WhatsApp** | **সবসময় `'text'`** (hardcoded) | **সবসময় `''`** |
| **Web Playground** | browser থেকে আসে (`body.mediaType`) | browser থেকে আসে (`body.mediaUrl`) — শুধু non-empty কি না দেখা হয় |

WhatsApp-এর কোডে কারণ লেখাই আছে:

```js
// NOTE: WhatsApp inbound media arrives as an ID that needs a token-authenticated
// GET /{mediaId} + download. The generic Core Brain download is unauthenticated,
// so media is handled as a graceful text fallback here (see Setup Notes).
let mediaType = 'text';
let mediaUrl = '';
```

---

## ২. Channel অনুযায়ী বাস্তব অবস্থা

| Channel | ছবি | Voice / Audio | Video · Sticker · File |
|---|---|---|---|
| **Facebook Messenger** | ✅ সত্যিকারের (Gemini Vision) | ⚠️ পথ আছে, কিন্তু MIME-এ আটকাবে → **উত্তর নেই** | ❌ **নীরবে বাদ** (`return []`) |
| **Instagram** | ✅ সত্যিকারের | ⚠️ একই | ❌ **নীরবে বাদ** |
| **WhatsApp** | ❌ placeholder text | ❌ placeholder text | ⚠️ *"unsupported message type"* text |
| **Web Playground / Widget** | ✅ সত্যিকারের | ✅ সত্যিকারের | — (browser যা পাঠায়) |

**যা সত্যিই customer দেখে:**

- **WhatsApp-এ ছবি পাঠালে** → bot বলে *"একটু বর্ণনা করে লিখুন বা টেক্সটে পাঠান"*
- **WhatsApp-এ voice পাঠালে** → bot বলে *"আপনার প্রশ্নটা টাইপ করুন"*
- **Messenger-এ voice পাঠালে** → Telegram/WhatsApp voice note সাধারণত `audio/mp4` বা `audio/ogg`; `audio/mp4` Gemini-র সমর্থিত তালিকায় **নেই** → Gemini 400 → `Gemini Transcribe`-এ `onError` নেই → **পুরো execution থেমে যায়** → customer **কোনো উত্তরই পায় না**
- **Messenger-এ video পাঠালে** → `return []` → কিছুই হয় না

> 📌 **BD-র জন্য এটাই সবচেয়ে বড় ক্ষতি।** বাংলাদেশের e-commerce chat-এ voice note ও প্রোডাক্টের ছবি সবচেয়ে স্বাভাবিক ইনপুট। ঠিক সেখানেই bot কাজ করে না।

---

## ৩. খরচ — এখন কত লাগে, কত নেওয়া হয়

### Gemini API-র আসল খরচ *(সর্বশেষ যাচাইকৃত rate থেকে, আনুমানিক — প্রয়োগের আগে Google-এর page-এ মিলিয়ে নেবেন)*

| ইনপুট | টোকেন | আনুমানিক খরচ |
|---|---|---|
| ছবি (সাধারণ প্রোডাক্ট ছবি, ≤ ৩৮৪px = ২৫৮ টোকেন; বড় হলে tile-এ ভাগ হয়) | ~২৫৮–১,০০০ | ~$০.০০০০৮–০.০০০৩ |
| Voice — **প্রতি সেকেন্ডে ৩২ টোকেন** (∴ ১ মিনিট = ১,৯২০) | ৩২/সেকেন্ড | ১ মিনিট ≈ **$০.০০০৬** ইনপুট + transcript আউটপুট |

> অর্থাৎ media-র খরচ **খুবই কম** — একটি ছবি $০.০০১-এর অনেক নিচে।

### প্ল্যাটফর্মের credit ব্যবস্থা *(তৈরি হয়ে বসে আছে)*

[`lib/domain/credit-config.ts:86-87`](../../lib/domain/credit-config.ts#L86-L87):

```ts
// Multimedia add-ons (added on top of reply cost)
image_message:    5,  // ছবি পাঠালে reply cost-এর উপরে এই cost যোগ হবে
audio_per_minute: 5,  // voice message-এর প্রতি মিনিটে এই cost যোগ হবে
```

[`lib/ai/charge-usage.ts:110-120`](../../lib/ai/charge-usage.ts#L110-L120) — যোগ করার কোডও লেখা আছে:

```ts
let credits = reply.credits;
// Multimedia add-on — reply-এর খরচের উপরে যোগ হয়
if (input.extra?.image) { credits += getActionCredits("image_message"); }
if (input.extra?.audioMinutes && input.extra.audioMinutes > 0) {
  credits += Math.ceil(input.extra.audioMinutes) * getActionCredits("audio_per_minute");
}
```

[`app/api/internal/ai-usage/route.ts`](../../app/api/internal/ai-usage/route.ts)-এর zod schema-তে `extra` গ্রহণ করার ব্যবস্থাও আছে।

### ❌ কিন্তু `Billing API` node কখনো `extra` পাঠায় না

[`Core-AI-Brain.json`](./Core-AI-Brain.json)-এর `Billing API` node-এর body:

```json
{
  "runId": "...", "userId": "...", "chatbotId": "...", "sessionId": "...",
  "channel": "...", "modelId": "...",
  "promptTokens": ..., "completionTokens": ...,
  "llmCallCount": 1,
  "isTestChat": ...,
  "isFreeMessage": false,
  "tokensAreExact": false
}
```

— `extra` নেই। আর `llmCallCount` **hardcoded 1** (অথচ media এলে সত্যিই ২টি LLM call হয় — OpenRouter + Gemini)।

**ফল:** প্রতিটি ছবি ও voice message-এ প্ল্যাটফর্ম Gemini-র বিল নিজে দেয়, merchant-এর কাছ থেকে নেয় না। credit-এর মূল্য (BD Starter: ৳৯৯৯ / ১৫,০০০ credit ≈ **৳০.০৬৭ প্রতি credit**) ধরে দেখলে:

| | Gemini খরচ | নেওয়া উচিত ছিল | এখন নেওয়া হয় |
|---|---|---|---|
| ছবি | ~$০.০০০২ | ৫ credit ≈ ৳০.৩৩ | **০** |
| Voice ১ মিনিট | ~$০.০০১ | ৫ credit ≈ ৳০.৩৩ | **০** |

অর্থাৎ media মেসেজে margin ১০x+ — শুধু সেটি আদায় হচ্ছে না।

---

## ৪. সমস্যার বিস্তারিত

### 🔴 ১ — WhatsApp-এ multimodal সম্পূর্ণ বন্ধ

**কোথায়:** [`WhatsApp-Integration.json`](./WhatsApp-Integration.json) → `Normalize WhatsApp Payload`

`mediaType` ও `mediaUrl` কখনো সেট হয় না, বদলে placeholder text বসে। ফলে Core Brain-এর `Media Router` সবসময় Text branch-এ যায়, আর `Gemini Transcribe`/`Gemini Vision` **কখনো একবারও চলে না** — দুটো node তৈরি হয়ে বসে আছে, শুধু caller ডেটা পাঠায় না।

**কারণ (কোডেই লেখা):** WhatsApp inbound media আসে `mediaId` হিসেবে; token-দিয়ে `GET /{mediaId}` করে তারপর URL পান, এবং সেই URL-ও token ছাড়া download হয় না। কিন্তু Core Brain-এর `Download Image`/`Download Audio` **unauthenticated**।

### 🔴 ২ — Media-র খরচ কখনো charge হয় না

উপরে §৩ দেখুন। সমাধান প্রায় এক লাইনের কাজ, কিন্তু পুরো revenue leak।

### 🔴 ৩ — `audio/mp4` Gemini-র তালিকায় নেই

Gemini audio-র সমর্থিত MIME type (যাচাইকৃত): `audio/wav` · `audio/mp3` · `audio/aiff` · `audio/aac` · `audio/ogg` · `audio/flac` · `audio/mpeg` · `audio/m4a` · `audio/l16` · `audio/opus` · `audio/alaw` · `audio/mulaw` · `audio/webm`

**`audio/mp4` নেই।** অথচ Messenger-এর voice clip ও অনেক আপলোড `audio/mp4` বা `audio/x-m4a` আসে। কারণটি সুস্পষ্ট — `audio/mp4` আর `audio/m4a` আসলে একই container, শুধু label আলাদা। একটি mapping দিয়েই মিটে যায়।

### 🔴 ৪ — কোনো media node-এ `onError` নেই

`Download Image` · `Code in JavaScript` · `Gemini Vision` · `Set Image Message` · `Download Audio` · `Gemini Transcribe` · `Set Audio Message` — **একটিতেও `onError` সেট করা নেই**।

অর্থাৎ ৩ নম্বর সমস্যাটি ঘটলে: node ব্যর্থ → branch থেমে যায় → `Merge Media`-এ কিছু পৌঁছায় না → `Embed Query`/`AI Agent` চলে না → `Format Response`/`Save Chat History`/`Billing API` চলে না → **customer কিছুই পায় না, chat history-তেও কিছু জমা হয় না, বিলও হয় না** (অর্থাৎ কোনো ট্রেসই থাকে না)।

তুলনা করে দেখুন — `Save Chat History` ও `Billing API`-তে `onError: continueRegularOutput` দেওয়া আছে, কারণ কেউ ভেবেছে। media-র পথে সেটি ভুলে যাওয়া হয়েছে।

### 🔴 ৫ — `Gemini Transcribe`-এ credential নেই

| Node | কীভাবে key যায় |
|---|---|
| `Gemini Vision` | `authentication: genericCredentialType` + `httpHeaderAuth` ✅ |
| `Gemini Transcribe` | header `x-goog-api-key: ={{ $env.GOOGLE_GEMINI_API_KEY }}` ❌ |
| `Embed Query` | `genericCredentialType` + `httpHeaderAuth` ✅ |

দুটি সমস্যা: (ক) `N8N_BLOCK_ENV_ACCESS_IN_NODE=true` করলে (production-এ সাধারণ security posture) এই node সাথে সাথে ভাঙে — `x-goog-api-key: undefined` → 401/403; (খ) **key rotate করতে হলে দুই জায়গায়** হাত দিতে হয়, আর একটি বাদ পড়লে সেটি নীরব ব্যর্থতা। একটি credential-এ আনা উচিত।

### 🔴 ৬ — Download node-এ কোনো সীমা নেই

```json
"url": "={{ $('When Called by Platform').item.json.mediaUrl }}",
"options": { "response": { "responseFormat": "file" } }
```

| ঝুঁকি | কারণ |
|---|---|
| **Timeout** | `options.timeout` নেই → n8n-এর default **৩০০ সেকেন্ড**। একটি ধীর URL পুরো execution ৫ মিনিট আটকে রাখবে |
| **Size** | কোনো সীমা নেই → একটি বড় ফাইল n8n-এর memory খেয়ে ফেলবে |
| **SSRF** | URL কোনো allow-list-এ যাচাই হয় না। `Web-Playground-Integration.json`-এর `Validate & Normalize Payload` শুধু `mediaUrl` non-empty কি না দেখে — **host যাচাই করে না**, আর payload আসে browser থেকে |

অর্থাৎ web widget দিয়ে কেউ `mediaUrl = "http://169.254.169.254/..."` বা একটি internal address পাঠাতে পারে। *(n8n এই URL-টি fetch করবে — এটাই classic SSRF প্যাটার্ন।)*

### 🟠 ৭ — ছবি দেখে প্রোডাক্ট মেলানোর ব্যবস্থা নেই *(ফিচার ঘাটতি)*

`Gemini Vision`-এর prompt:

> *"Extract all readable text (OCR) and list the key visual attributes (product type, colour, brand) in this image. Be concise."*

তারপর `Set Image Message` সেটি `resolvedMessage`-এর সাথে জোড়ে, আর `Product Lookup` tool চলে:

```sql
WHERE "name" ILIKE '%' || '<AI-র বলা নাম>' || '%'
```

অর্থাৎ **ছবির বর্ণনা থেকে বাংলা/ইংরেজি নাম বানিয়ে সেটি `Product.name`-এর সাথে আংশিক মিল খোঁজে** — customer যদি প্রোডাক্টের ছবি পাঠিয়ে জিজ্ঞেস করে *"এটার দাম কত?"*, সঠিক উত্তর আসার সম্ভাবনা কম, কারণ "লাল সুতি শার্ট"-এর সাথে catalog-এর `name` হুবহু মিলবে না।

উপরন্তু: কোনো দাম/availability information ওই vision output-এ **নেই** — অর্থাৎ AI-কে ছবির সাথে প্রোডাক্ট-তথ্য দিতে হলে **ছবি → প্রোডাক্ট** মেলানোই একমাত্র পথ, বর্ণনা → নাম-মেলা নয়।

এটিই multimodal-এর সবচেয়ে মূল্যবান ব্যবহার, আর এখানেই কিছুই নেই। *(সমাধানের দিক §৬-এ, তবে এটি একটি আলাদা ফিচার — যাচাই সাপেক্ষ।)*

### 🟠 ৮ — FB/IG-তে video / sticker / file নীরবে বাদ

```js
const att = msg.attachments && msg.attachments[0];
if (att && att.type === 'image') { ... }
else if (att && att.type === 'audio') { ... }

if (!userMessage && mediaType === 'text') return [];
```

`att.type === 'video'` / `'file'` / `'sticker'` হলে `mediaType` `'text'`-ই থাকে, আর `msg.text` না থাকলে `return []` → **কোনো node-ই চলে না, customer কিছুই পায় না**। Bot জানতেও পারে না যে একটি মেসেজ এসেছিল (dedupe ledger-এ token key লেখা হয়, কিন্তু reply নেই)।

### 🟡 ৯ — Inbox-এ AI-র বর্ণনা customer-এর লেখা হিসেবে জমা হয়

`Save Chat History`:

```sql
... 'user', '{{ $('Merge Media').item.json.resolvedMessage.replace(/'/g, "''") }}', ...
```

`resolvedMessage` **enriched** — অর্থাৎ DB-তে customer-এর মেসেজ হিসেবে জমা হয়:

- `[Image content]: Suger-free chocolate bar, red packaging, brand "XYZ"...`
- অথবা voice-এর ক্ষেত্রে কেবল transcript (আসল অডিওর কোনো চিহ্নই না)

ফল: merchant Inbox-এ দেখবেন customer নাকি এই লেখাটা টাইপ করেছে। `ChatSession.lastMessage`-ও তাই AI-র reply থেকে লেখা। Handover হলে human agent একটি **AI-নির্মিত বর্ণনা** পড়বেন, যেটি ভুলও হতে পারে — অথচ সেটি customer-এর কথা হিসেবে উপস্থাপিত।

### 🟡 ১০ — টোকেন estimate ইংরেজির জন্য ক্যালিব্রেটেড

`Format Response`:

```js
const promptTokens = Math.ceil(fullInputStr.length / 3.8) + 1350;
const completionTokens = Math.ceil(raw.length / 3.7);
```

`/3.8` chars-per-token — ইংরেজি টেক্সটের জন্য ঠিক। **বাংলার জন্য সাধারণত ১.৫–২ chars/token** (বাংলা Unicode-এ একটি অক্ষরেই প্রায়ই একাধিক টোকেন লাগে)। অর্থাৎ BD market-এ — যেটি আপনার মূল market — প্রতি reply-তে **২–৩x কম** টোকেন রিপোর্ট হচ্ছে।

(কোডের কমেন্টেই স্বীকার করা আছে: *"character-based ESTIMATE — only a fallback... Step 7 (exact reconciler) replaces this with n8n's own metadata.tracing counts."*)

### 🟡 ১১ — `Set Audio Message` transcript ফাঁকা হলে খালি মেসেজ

```js
resolvedMessage = {{ $json.candidates?.[0]?.content?.parts?.[0]?.text || '' }}
```

Gemini safety filter-এ আটকালে বা transcript ফাঁকা এলে `resolvedMessage = ''` → AI Agent **কিছুর উত্তর দেয় না**, অথচ customer একটি voice note পাঠিয়েছিল। এছাড়া `userMessage` পুরোপুরি বাদ পড়ে — audio-এর সাথে caption থাকলে সেটি হারায়।

### 🟢 ১২ — `Media Router`-এ video/file branch নেই

`Text` branch = `mediaType notEquals 'image'` **AND** `notEquals 'audio'`. তাই ভবিষ্যতে `mediaType='video'` পাঠানো হলে সেটি **Text** branch-এ পড়বে (নিরীহ, কারণ `resolvedMessage = userMessage`)। কিন্তু ধরুন কেউ `mediaType='video'` + ফাঁকা `userMessage` পাঠায় → AI খালি মেসেজ পায়। তখন `onError`/fallback কিছুই নেই।

---

## ৫. করণীয় — ধাপে ধাপে

> প্রতিটি ধাপ আলাদাভাবে করা ও যাচাই করা যায়। ক্রমটি "সবচেয়ে বেশি লাভ ÷ সবচেয়ে কম ঝুঁকি" অনুযায়ী সাজানো।

### ধাপ ১ — media পথকে ভাঙা-প্রতিরোধী করা *(সবচেয়ে জরুরি, সবচেয়ে কম কাজ)*

**১.১ — MIME normalization + সমর্থিত-নয় হলে graceful fallback**

`Download Audio` ও `Gemini Transcribe`-এর মাঝে একটি নতুন Code node (`Normalize Audio Type`):

```js
// Gemini accepts these audio MIME types; `audio/mp4` is NOT among them, and
// that is exactly what Messenger voice notes usually arrive as. `audio/mp4`
// and `audio/m4a` are the same container with different labels.
const MAP = {
  'audio/mp4': 'audio/m4a',
  'audio/x-m4a': 'audio/m4a',
  'audio/m4a': 'audio/m4a',
  'audio/oga': 'audio/ogg',
  'application/ogg': 'audio/ogg',
  'audio/mpeg': 'audio/mp3',
  'audio/x-wav': 'audio/wav',
};
const SUPPORTED = ['audio/wav','audio/mp3','audio/aiff','audio/aac','audio/ogg',
  'audio/flac','audio/mpeg','audio/m4a','audio/l16','audio/opus','audio/alaw',
  'audio/mulaw','audio/webm'];
// If the declared type is unsupported, fall back to the container we can infer.
let mimeType = String($binary.data.mimeType || '').split(';')[0].trim().toLowerCase();
mimeType = MAP[mimeType] || mimeType;
return [{ json: { ...$input.item.json, audioMimeType: mimeType, audioSupported: SUPPORTED.includes(mimeType) } }];
```

তারপর `Gemini Transcribe`-এর আগে একটি IF (`Audio Supported?`) — সমর্থিত না হলে সরাসরি `Set Audio Message`-এ গিয়ে একটি সদয় fallback বার্তা।

**১.২ — প্রতিটি media node-এ `onError: continueRegularOutput` + খালি-মানে fallback**

`Set Image Message` / `Set Audio Message`-এ মান ফাঁকা হলে placeholder দিন, যেমন:

```
"resolvedMessage": "={{ ($('When Called by Platform').item.json.userMessage || '') + '\n[Customer sent an image. It could not be read — politely ask them to describe it or type the product name.]' }}"
```

**১.৩ — Download node-এ timeout ও size limit**

`options.timeout = 15000` (১৫ সেকেন্ড), এবং ডাউনলোডের পর size > ~১০ MB হলে বাদ (`Gemini`-র inline limit ২০ MB, কিন্তু নিরাপদ থাকা ভালো)।

**🎁 লাভ:** সব channel-এ media আর কখনো "নীরব মৃত্যু" ঘটাবে না। এটি একা করলেই #৩, #৪, #১১ মিটে যায়।

### ধাপ ২ — WhatsApp media চালু করা

**নকশার সিদ্ধান্ত** (§৭-এ ইউজারের কাছে আছে) — দুইটি পথ:

**পথ ক — URL pass-through + ঐচ্ছিক auth header** *(সুপারিশ)*

WhatsApp workflow-এ আগে token দিয়ে `GET https://graph.facebook.com/v20.0/{mediaId}` → `{ url, mime_type }` পান, তারপর payload-এ পাঠান:

```
mediaType = 'image' | 'audio'
mediaUrl  = <lookaside URL>
mediaMimeType = <mime_type>
mediaAuthHeader = "Bearer <whatsapp access token>"
```

`mediaAuthHeader` না থাকলে (FB/IG/Web) header-ই যাবে না — অর্থাৎ আগের আচরণ অপরিবর্তিত।

⚠️ n8n-এর `httpRequest` node-এ "শর্তসাপেক্ষে header বাদ দেওয়া" সহজ নয় (খালি value দিলে `Authorization:` ফাঁকা header-ই যায়, যা কিছু CDN-এ ৪০০ দিতে পারে)। তাই দুটি উপায়:
- **(ক-১)** `Download Image`/`Download Audio` node-টিকে একটি **Code node**-এ বদলে দেওয়া, যেটি `this.helpers.httpRequest({ url, headers: auth ? { Authorization: auth } : {}, timeout: 15000 })` দিয়ে নিজেই নামায় ও base64 বানায় → এতে `Code in JavaScript` node-টিও merge হয়ে যায় (৩ node → ১), timeout/branch সব একসাথে। *(⚠️ `this.helpers.httpRequest`-এ binary/arraybuffer ফেরানোর সঠিক option প্রয়োগের সময় যাচাই করে নিতে হবে।)*
- **(ক-২)** একটি IF (`Has Media Auth?`) + দুটি download node (auth ও no-auth)। নিশ্চিত কাজ করে, কিন্তু node বাড়ে (প্রতি media type-এ +২)।

**পথ খ — WhatsApp workflow-এই download + base64**

WhatsApp workflow-এ download করে `mediaBase64` পাঠানো। তাহলে Core Brain-এর unauthenticated download-ই লাগে না। কিন্তু Core Brain-এ "inline media আছে কি না" দেখে download skip করার branch যোগ করতে হয় (+ IF), আর web playground public webhook দিয়ে কেউ সরাসরি base64 নিয়ে আসতে পারে — সেটিও সীমিত করা লাগবে।

> **সুপারিশ: পথ ক (ক-১)** — Core Brain-এর আকার প্রায় অপরিবর্তিত থাকে, token যেখানে আছে সেখানেই ব্যবহৃত হয়, আর timeout/size guard বিনামূল্যে পাওয়া যায়।

**সঙ্গে লাগবে — SSRF allow-list:** web widget-এর `mediaUrl` browser থেকে আসে, তাই `Validate Media URL` node-এ host যাচাই করুন:

```
lookaside.fbsbx.com, *.fbcdn.net, scontent.*.fbcdn.net, *.cdninstagram.com,
graph.facebook.com, এছাড়া নিজের storage domain
```

তালিকার বাইরে হলে media বাদ, সাথে `console.error`।

### ধাপ ৩ — Media-র billing চালু করা

**৩.১ — `Format Response`**-এ media তথ্য বের করুন:

```js
const mediaType = String($('When Called by Platform').item.json.mediaType || 'text');
const isImage = mediaType === 'image';
// Duration cannot be read directly; estimate from size at ~16 kbps for the
// opus/ogg voice notes WhatsApp and Messenger produce. The platform ceils this,
// so a 20-second clip bills as one minute — the configured minimum.
const audioBytes = Number($('Merge Media').item.json.audioBytes || 0);
const audioMinutes = mediaType === 'audio'
  ? Math.max(0.1, (audioBytes * 8) / 16000 / 60)
  : 0;
```

**৩.২ — `Billing API`** body-তে যোগ করুন:

```json
"llmCallCount": {{ ... }},
"extra": { "image": true, "audioMinutes": 0.4 }
```

⚠️ `llmCallCount` এখন hardcoded `1`। Media এলে সত্যিই দুটি LLM call হয় (OpenRouter + Gemini)। **তবে Gemini-র খরচ OpenRouter-এর pricing-এ নেই** — তাই `llmCallCount` বাড়ালে সেটি cost analytics-এ ভুলভাবে গুণ হতে পারে। **প্রয়োগের আগে [`lib/ai/charge-usage.ts`](../../lib/ai/charge-usage.ts) ও cost calculator-এ `llmCallCount`-এর প্রকৃত অর্থ যাচাই করে নিতে হবে।** Gemini-র খরচ পুনরুদ্ধারের আসল ব্যবস্থা `extra` — সেটিই উদ্দেশ্য।

⚠️ `extra` যোগ করতে n8n-এর JSON-এ শর্তসাপেক্ষ field দরকার (text message-এ `image: false` বা `audioMinutes: 0` পাঠানোই ভালো — platform-এর কোড `> 0` দেখে)।

### ধাপ ৪ — বাংলা-aware টোকেন estimate (বা exact করতে যাওয়া)

```js
// Bengali codepoints tokenise far denser than Latin: roughly 1.5–2 characters
// per token against ~3.8 for English. Estimating the whole string at the
// English rate systematically under-reports cost in the primary BD market.
const bnChars = (fullInputStr.match(/[ঀ-৿]/g) || []).length;
const otherChars = fullInputStr.length - bnChars;
const promptTokens = Math.ceil(otherChars / 3.8 + bnChars / 1.7) + 1350;
```

⚠️ এটি এখনো একটি **estimate**। কোডের কমেন্টে যে "Step 7 — exact reconciler" (n8n-এর `metadata.tracing` থেকে আসল token) লেখা আছে, সেটিই আসল সমাধান — সম্ভব কি না তা আলাদা করে যাচাই করা উচিত। না হলে অন্তত উপরের correction দিয়ে ২–৩x ভুল কমানো যায়।

### ধাপ ৫ — `Gemini Transcribe`-এ credential বসানো

`Gemini Vision`-এর মতোই `genericCredentialType` + `httpHeaderAuth` ব্যবহার করুন, একই "Gemini API Key" credential। এরপর `$env.GOOGLE_GEMINI_API_KEY` আর কোথাও লাগবে না।

### ধাপ ৬ — `Set Audio Message`-এ `userMessage` ধরে রাখা ও খালি-মানে fallback

```js
resolvedMessage = (userMessage ? userMessage + '\n' : '') + (transcript || '[Voice message could not be transcribed — politely ask the customer to type it.]')
```

### ধাপ ৭ — FB/IG-তে video/file-এর ব্যবস্থা

`Normalize FB/IG Payload`-এ শেষ `return []`-এর বদলে একটি **সদয় reply** দিন (mediaType `'text'`, সাথে একটি বার্তা: *"ভিডিও/ফাইলটি এখনো পড়তে পারি না — ছবি বা টেক্সটে পাঠান"*)। নীরব বাদ পড়ার চেয়ে একটি পরিষ্কার উত্তর অনেক ভালো।

এর সাথে `Media Router`-এ ভবিষ্যতের জন্য `video` branch যোগ করার দরকার নেই — Text branch-এ পড়াই এখন নিরাপদ।

### ধাপ ৮ — Inbox-এ কী দেখাবে *(সিদ্ধান্ত দরকার)*

`Save Chat History`-এ `resolvedMessage`-এর বদলে **আসল `userMessage`** সেভ করা যায় এবং media তথ্য আলাদা field-এ রাখা যায়। তবে enriched text রাখার একটি সুবিধাও আছে — handover হলে human agent দেখতে পান customer কী পাঠিয়েছিলেন। **এটি ইউজারের সিদ্ধান্ত** (§৭)।

---

## ৬. ভবিষ্যতের ফিচার — ছবি দেখে প্রোডাক্ট মেলা

BD-র e-commerce chat-এ *"এই ছবিটার দাম কত?"* সবচেয়ে স্বাভাবিক প্রশ্নগুলোর একটি। এখনকার পথ (Vision → বর্ণনা → `ILIKE` নাম-মেলা) দিয়ে এটি কার্যকরভাবে হয় না।

**দিক (যাচাই করা হয়নি):** প্ল্যাটফর্মে `chatbot.Chunk` টেবিলে pgvector আছে, আর `ecommerce.Product`-এ `imageUrl`/`imageUrls` আছে। প্রোডাক্টের ছবিকে ভেক্টর করে রাখলে আসা ছবিকেও ভেক্টর করে `<=>` দিয়ে মেলানো যেত — তারপর দাম/stock সরাসরি AI-কে দেওয়া।

⚠️ **অবশ্যই যাচাই করতে হবে:** `gemini-embedding-001` (যেটি এখন `Embed Query`-তে ব্যবহৃত) **text-only** — ছবির ভেক্টর দেয় না। cross-modal image→image মেলানোর জন্য আলাদা মডেল লাগবে (Vertex-এর multimodal embedding বা অন্য কিছু)। তাই এটি একটি **আলাদা গবেষণার বিষয়**, এই অডিটের সিদ্ধান্ত নয়।

---

## ৭. যে সিদ্ধান্তগুলো নিতে হবে

| # | সিদ্ধান্ত | অপশন | সুপারিশ |
|---|---|---|---|
| ১ | WhatsApp media-র নকশা | (ক) URL + ঐচ্ছিক auth header · (খ) WhatsApp workflow-এই download + base64 | **ক** |
| ২ | Auth header কীভাবে যোগ হবে | (ক-১) download node → Code node (৩→১ node) · (ক-২) IF + দুটি download node | **ক-১** *(প্রয়োগে option যাচাই সাপেক্ষ)* |
| ৩ | Voice-এর credit কীভাবে | (ক) byte size থেকে `audioMinutes` · (খ) flat per-voice credit (নতুন `audio_message` key) | **ক** *(যদি ছোট clip-এ ৫ credit minimum গ্রহণযোগ্য হয়)*; নইলে খ |
| ৪ | Inbox-এ কী জমা হবে | (ক) enriched `resolvedMessage` (এখন যেমন) · (খ) আসল `userMessage` + আলাদা media field | **খ** — তবে handover-এর UX দেখে |
| ৫ | Video/file-এর reply | (ক) সদয় বার্তা · (খ) এখন যেমন (নীরব বাদ) | **ক** |

⚠️ সিদ্ধান্ত ৩-এ **(খ)** বেছে নিলে [`lib/domain/credit-config.ts`](../../lib/domain/credit-config.ts)-এ একটি নতুন key যোগ হবে। credit-এর **একমাত্র source of truth** ওটিই — অন্য কোথাও hardcode করা যাবে না।

---

## ৮. যাচাইয়ের পরিকল্পনা

| # | কী যাচাই | কীভাবে |
|---|---|---|
| ১ | `audio/mp4` normalization | একটি `audio/mp4` ফাইল দিয়ে `audio/m4a`-তে map হচ্ছে কি না, আর Gemini 200 দেয় কি না |
| ২ | সমর্থিত-নয় MIME → fallback | ইচ্ছাকৃতভাবে `application/octet-stream` দিলে execution না মরে সদয় বার্তা আসে |
| ৩ | `onError` পথ | একটি অচল `mediaUrl` দিলে ৪টি media node-এর যেকোনোটিতে ব্যর্থ হলেও reply আসে |
| ৪ | WhatsApp media end-to-end | আসল WhatsApp voice note + ছবি — মূল লক্ষ্য |
| ৫ | Billing `extra` পৌঁছাচ্ছে | একটি media reply-এর পর `AIUsageLog`-এ credit-এর পরিমাণ text reply-এর চেয়ে ৫ বেশি |
| ৬ | `audioMinutes` যথার্থতা | ৩০ সেকেন্ডের clip → `audioMinutes ≈ ০.৫` → platform ceil → ৫ credit |
| ৭ | SSRF guard | `mediaUrl = http://169.254.169.254/` পাঠালে বাদ পড়ে |
| ৮ | টোকেন estimate | একটি বাংলা reply-তে estimate বনাম OpenRouter-এর আসল token — শতাংশ তফাত লিখে রাখা |
| ৯ | Volume limits | ১০ MB-এর বেশি ফাইল বাদ পড়ে |
| ১০ | Timeout | ধীর URL ১৫ সেকেন্ডে ছেড়ে দেয় (আগে ৩০০s) |

---

## ৯. সংশ্লিষ্ট কিন্তু Multimodal নয়

এই অডিট করতে গিয়ে পাওয়া দুটি পৃথক বিষয় — এখানে লিপিবদ্ধ করা হলো যাতে হারিয়ে না যায়, কিন্তু **এগুলো multimodal কাজের অংশ নয়।**

### ৯.১ — `Automation-Gate.json` আর দরকার নেই ✅

[`Automation-Gate.json`](./Automation-Gate.json)-এর ৫টি node (`Automation Gate`, `Gate Decision`, `Gate Reply?`, `Gate Return`, `Gate Setup (বাংলা)`) — প্রতিটির `jsCode`/`parameters` [`Core-AI-Brain.json`](./Core-AI-Brain.json)-এর সাথে **হুবহু মিলেছে**; শুধু `id` ও `position` আলাদা।

Core Brain-এ wiring-ও সম্পূর্ণ ও সঠিক (যাচাইকৃত):

```
Ensure Session → Automation Gate → Gate Decision → Gate Reply?
                                                       ├── true  → Gate Return
                                                       └── false → Media Router
```

**বরং file-টি এখন ক্ষতিকর:** ওর নিজের `connections` ব্লকে `Gate Reply?`-এর শুধু **true** branch আছে — `Automation Gate → Gate Decision` link ও false → `Media Router` branch **নেই**। কেউ আবার import করলে dangling reference পাবে।

**করণীয়:** `Automation-Gate.json` মুছে ফেলা। ⚠️ তবে [`Automation-Gate-Setup.md`](./Automation-Gate-Setup.md) (১৮ KB) Core Brain-এর sticky note থেকে reference করা — JSON মুছলে ওই ডকটিও একসাথে মুছতে হবে, নয়তো "গাইড আছে" বলে ভুল পথে পাঠাবে।

### ৯.২ — `$fromAI()` মান escaping ছাড়া SQL-এ ⚠️ *(নিরাপত্তা)*

`Product Lookup` ও `Create Order` — দুটিই `n8n-nodes-base.postgresTool`, `executeQuery` operation, আর `$fromAI()`-এর মান **সরাসরি SQL-এ interpolated**, single quote দিয়ে মোড়া:

```sql
-- Create Order
... '{{ $fromAI('customer_name', 'customer full name', 'string') }}', ...
```

`customer_name`-এ কেউ `x', 'y', 'z` লিখলে quote ভেঙে যায়। **অর্থাৎ prompt injection শুধু একটি চ্যাট মেসেজ দিয়েই সম্ভব** — শত্রুকে কোনো API-তে হাত দিতে হবে না, কেবল bot-কে একটি বাক্য লিখতে হবে।

তুলনা: `Save Chat History`-তে একই ফাইলে `.replace(/'/g, "''")` করা হয়েছে — অর্থাৎ ঝুঁকিটি জানা ছিল, কিন্তু tool node-দুটোতে প্রয়োগ করা হয়নি।

**সংযোগ:** [`TASK-09`](../Architecture-Update/task.md#task-09--order-validation-layer)-এর **পথ খ** (Next.js-এ validation API, n8n সরাসরি INSERT করবে না) বেছে নিলে `Create Order`-এর injection **আপনাআপনি মিটে যায়** — কারণ INSERT-ই আর n8n-এ থাকবে না। কিন্তু `Product Lookup` (একটি SELECT) TASK-09-এর আওতায় পড়ে না, তাই সেটির জন্য আলাদা ব্যবস্থা লাগবে (escaping, অথবা query parameter)।

> 💡 **সুপারিশ:** এটি multimodal-এর সাথে না মিলিয়ে **আলাদা একটি নিরাপত্তা টাস্ক** হিসেবে [`task.md`](../Architecture-Update/task.md)-এ যোগ করা উচিত — কারণ এটি আজই কাজে লাগানো যায়, multimodal-এর জন্য অপেক্ষা করার দরকার নেই।

### ৯.৩ — `Automation Gate` ব্যর্থ হলে নীরবে fail-open

`Automation Gate`-এ `onError: continueRegularOutput` + `alwaysOutputData: true`। API `401`/`404`/timeout দিলে `Gate Decision` `gate.action || "continue"` পড়ে → `skipAi = false` → **AI চলে যায়**।

Customer-এর দৃষ্টিতে এটি নিরাপদ default (উত্তর পাওয়া বন্ধ হয় না)। কিন্তু **merchant-এর automation নীরবে কাজ করা বন্ধ করে দেয়** — "handoff to human" বা "pause AI" মানা হয় না, আর কোথাও কিছু দেখা যায় না (`console.error`-ও নেই)। [`TASK-11`](../Architecture-Update/task.md#task-11--automation-gate-ও-billing-api-critical-path-থেকে-সরানো) এই node-টি নিয়েই কাজ করবে, তাই **সেই টাস্কে এটি যোগ করা উচিত।**

### ৯.৪ — `RAG Search`-এ `ORDER BY ... LIMIT 5`, কোনো threshold নেই

`ORDER BY embedding <=> '[...]'::vector LIMIT 5` — অর্থাৎ সবচেয়ে কাছের ৫টি chunk **সবসময়** ফেরত আসে, তা মিল যত খারাপই হোক। অপ্রাসঙ্গিক জ্ঞান প্রম্পটে ঢুকে AI-কে বিভ্রান্ত করতে পারে (বিশেষত ছবির বর্ণনা দিয়ে খোঁজার সময়, যখন মিল স্বাভাবিকভাবেই দুর্বল)। `<=>` একটি distance — একটি threshold যোগ করা যুক্তিসঙ্গত হবে। *(এটি TASK-13/observability-র সাথে মেলে, multimodal-এর সাথে নয়।)*

---

## ১০. রেফারেন্স — Gemini-র সীমা (যাচাইকৃত)

| বিষয় | মান |
|---|---|
| Vision ও Transcribe মডেল | `gemini-2.5-flash` |
| Embedding মডেল | `gemini-embedding-001` *(text-only)* |
| Inline request-এর সর্বোচ্চ আকার | ২০ MB (base64 সহ) |
| Audio-র দাম | **৩২ টোকেন / সেকেন্ড** → ১ মিনিট = ১,৯২০ টোকেন |
| Audio downsampling | ১৬ Kbps |
| **সমর্থিত audio MIME** | `audio/wav` · `audio/mp3` · `audio/aiff` · `audio/aac` · `audio/ogg` · `audio/flac` · `audio/mpeg` · `audio/m4a` · `audio/l16` · `audio/opus` · `audio/alaw` · `audio/mulaw` · `audio/webm` |
| **`audio/mp4`** | ❌ **সমর্থিত নয়** ← Messenger voice note-এর সাধারণ type |
| ছবি | ≤ ৩৮৪px = ~২৫৮ টোকেন; বড় হলে ৭৬৮px tile-এ ভাগ হয় |
| ভিডিও | সমর্থিত (frame sampling), কিন্তু এই ফ্লো-তে কোথাও ব্যবহৃত হয় না |

### যাচাইকৃত ফাইল ও লাইন

| দাবি | প্রমাণ |
|---|---|
| `extra.image` / `extra.audioMinutes` সাপোর্ট করে | [`lib/ai/charge-usage.ts`](../../lib/ai/charge-usage.ts) · [`app/api/internal/ai-usage/route.ts`](../../app/api/internal/ai-usage/route.ts) |
| Credit rate ৫ ও ৫ | [`lib/domain/credit-config.ts:86-87`](../../lib/domain/credit-config.ts#L86-L87) |
| Credit-এর মূল্য | [`lib/domain/plan-config.ts`](../../lib/domain/plan-config.ts) — BD Starter ৳৯৯৯ / ১৫,০০০ credit |
| USD→BDT fallback ১২০ | [`lib/domain/credit-config.ts:109`](../../lib/domain/credit-config.ts#L109) |
| WhatsApp কখনো media পাঠায় না | [`WhatsApp-Integration.json`](./WhatsApp-Integration.json) → `Normalize WhatsApp Payload` |
| FB/IG video বাদ দেয় | [`Facebook-Integration.json`](./Facebook-Integration.json) · [`Instagram-Integration.json`](./Instagram-Integration.json) → `Normalize * Payload` |
| Transcribe-এ credential নেই | [`Core-AI-Brain.json`](./Core-AI-Brain.json) → `Gemini Transcribe` |
| কোনো media node-এ `onError` নেই | একই ফাইল — ৭টি node-এর যাচাইকৃত parameters |
| Billing API `extra` পাঠায় না | একই ফাইল → `Billing API` |
| `Media Router`-এ video branch নেই | একই ফাইল → `Media Router` |
| টোকেন estimate `/3.8` | একই ফাইল → `Format Response` |
| `$fromAI` escaping ছাড়া | একই ফাইল → `Product Lookup`, `Create Order` |
| `Save Chat History`-এ escaping *আছে* | একই ফাইল → `Save Chat History` |
| Automation-Gate redundant | [`Automation-Gate.json`](./Automation-Gate.json) বনাম Core-AI-Brain — node-ভিত্তিক তুলনা |
| `llmCallCount: 1` hardcoded | [`Core-AI-Brain.json`](./Core-AI-Brain.json) → `Billing API` |

---

*এই ফাইলটি একটি অডিট ও পরিকল্পনা — কোনো কোড বা JSON এখনো বদলানো হয়নি। কাজ শুরু করার আগে [`task.md`](../Architecture-Update/task.md)-এর নিয়ম অনুযায়ী বাংলায় Implementation Plan বানিয়ে অনুমোদন নিতে হবে, এবং n8n workflow **ইউজার নিজে import করবেন**।*
