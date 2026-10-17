# TASK-26 — Multimodal: ছবি ও ভয়েস সব চ্যানেলে

> **সূত্র:** [`Multimodal-Audit.md`](../n8n-JSON/Multimodal-Audit.md) (২০২৬-১০-১৩) · [`task.md`](./task.md)
> **তৈরি:** ২০২৬-১০-১৭ · **অডিট:** ২০২৬-১০-১৩
> **অবস্থা:** 🔄 **চলছে**
> **এই ফাইল কেন আলাদা:** অডিটটি একটি গবেষণা-নোট, আর `task.md`-এ এই কাজের **নিজস্ব কোনো টাস্ক নম্বর ছিল না** (অডিট থেকে কেবল TASK-23 জন্মেছিল, যা SQL injection)। এখানে সিদ্ধান্ত, সাব-টাস্ক ও অগ্রগতি এক জায়গায় রাখা হলো।

---

## ০. যে নিয়মগুলো এখানেও প্রযোজ্য

[`task.md`](./task.md) §০-এর নিয়ম অপরিবর্তিত। এই ফাইলের জন্য বিশেষভাবে:

| # | নিয়ম |
|---|---|
| ১ | 🚫 **DB-তে যেকোনো লেখার আগে ইউজারের অনুমতি** — এই টাস্কে **কোনো DDL বা schema পরিবর্তন নেই** |
| ২ | 👤 **n8n workflow ইউজার নিজে import করবেন** — AI শুধু JSON ফাইল তৈরি/আপডেট করবে এবং বলবে কোনটি import করতে হবে |
| ৩ | 🇧🇩 ইউজারের সাথে **বাংলায়**; কোড কমেন্ট **ইংরেজিতে**; বাংলায় technical শব্দ (Webhook, Token, Credit, Cloudinary, MIME) **ইংরেজিতেই** |
| ৪ | 🔒 **কোনো credential, API key বা token কোথাও লিখবে না** — n8n-এর env var-এর নামই যথেষ্ট |
| ৫ | 🌓 UI বদলালে **dark ও light দুই theme-এ** যাচাই |
| ৬ | 📊 **মাপা সংখ্যা দিয়ে দাবি** — খরচের প্রতিটি সংখ্যার সূত্র §৫-এ |

---

## ১. এক নজরে

| বিষয় | সিদ্ধান্ত / অবস্থা | তারিখ |
|---|---|---|
| **লক্ষ্য** | Facebook · WhatsApp · Instagram — তিন চ্যানেলেই গ্রাহক **টেক্সট / ছবি / ভয়েস** তিনভাবেই AI-র সাথে কথা বলতে পারবেন | ২০২৬-১০-১৭ |
| **ইনবাউন্ড media সংরক্ষণ** | ✅ **হ্যাঁ** — গ্রাহকের ছবি/অডিও আমাদের **Cloudinary**-তে রাখা হবে, যাতে পুরনো চ্যাটেও দেখা যায় | ২০২৬-১০-১৭ |
| **Gemini tier** | 🔴 **Paid** — free tier গ্রাহকের ডেটা Google-এর মডেল উন্নয়নে ব্যবহার করে | ২০২৬-১০-১৭ |
| **Inbox-এ কী জমবে** | ✅ আসল `userMessage` + স্থায়ী `mediaUrl` + `mediaType` | ২০২৬-১০-১৭ |
| **Video/File** | ✅ নীরবে বাদ নয় — সদয় উত্তর | ২০২৬-১০-১৭ |
| **Website Widget-এ media** | ⬜ **এই টাস্কের বাইরে** — `/api/widget/[key]` এখনো text-only | — |
| **ছবি দেখে প্রোডাক্ট মেলা** | ⬜ ভবিষ্যতের গবেষণা (অডিট §৬) | — |

---

## ২. আজকের অবস্থা — চ্যানেল ম্যাট্রিক্স

n8n JSON পড়ে **যাচাই করা**, অডিটের দাবি নয়:

| চ্যানেল | ছবি | ভয়েস | ভিডিও / ফাইল |
|---|---|---|---|
| **Facebook Messenger** | ✅ চলে (Gemini Vision) | 🔴 **পথ আছে, কিন্তু `audio/mp4` Gemini-তে অসমর্থিত → কোনো উত্তরই যায় না** | 🔴 নীরবে বাদ |
| **Instagram** | ✅ চলে | 🔴 একই | 🔴 নীরবে বাদ |
| **WhatsApp** | 🔴 `mediaType` সবসময় `'text'` — বট বলে "বর্ণনা করে লিখুন" | 🔴 একই | 🟡 "unsupported" টেক্সট |
| **Dashboard Playground** | ✅ চলে | ✅ চলে | — |
| **Website Widget** | 🔴 **শুধু টেক্সট** | 🔴 | — |

> 📌 **BD-র জন্য এটাই সবচেয়ে বড় ক্ষতি।** বাংলাদেশের e-commerce চ্যাটে ভয়েস নোট আর প্রোডাক্টের ছবি সবচেয়ে স্বাভাবিক ইনপুট — ঠিক সেখানেই বট আজ কাজ করে না।

---

## ৩. চারটি কাঠামোগত ফাঁক

| # | ফাঁক | ফল |
|---|---|---|
| ১ | কোনো media node-এ **`onError` নেই** | একটি ধাপ ফেল করলেই **পুরো execution মরে**, গ্রাহক নীরব |
| ২ | **`Gemini Transcribe`-এ credential নেই** (`$env.GOOGLE_GEMINI_API_KEY`) | পাশের `Gemini Vision` credential ব্যবহার করে, অথচ এটা করে না — নীরব ব্যর্থতার ঝুঁকি |
| ৩ | **Download node-এ timeout/size limit নেই** (ডিফল্ট ৩০০s); web-এর `mediaUrl` ব্রাউজার থেকে আসে | SSRF + ঝুলে থাকা execution |
| ৪ | **Billing `extra` কখনো পাঠানো হয় না** | ছবি/ভয়েসের খরচ হচ্ছে, credit কাটছে না |

⚠️ ৪ নম্বরটা আসলে **ইতিমধ্যেই অর্ধেক বানানো**: [`credit-config.ts:86-87`](../../lib/domain/credit-config.ts#L86-L87)-এ `image_message: 5` ও `audio_per_minute: 5` আছে, আর [`charge-usage.ts:122-127`](../../lib/ai/charge-usage.ts#L122-L127) সেগুলো যোগ করে। কেবল n8n সেটা পাঠায় না।

---

## ৪. সাব-টাস্ক

| # | কাজ | ফাইল | অবস্থা |
|---|---|---|---|
| **২৬.১** | Core Brain-এর media পথ **ভাঙা-প্রতিরোধী** | `Core-AI-Brain.json` | ✅ |
| **২৬.২** | **WhatsApp**-এ ছবি ও ভয়েস চালু | `WhatsApp-Integration.json` + ৪টি caller | ✅ |
| **২৬.৩** | ইনবাউন্ড ছবি/অডিও **Cloudinary-তে সংরক্ষণ** | `Core-AI-Brain.json` | ✅ |
| **২৬.৪** | Media **billing** + বাংলা টোকেন estimate | `Core-AI-Brain.json` | ✅ |
| **২৬.৫** | Video/File-এ সদয় উত্তর + Web **SSRF allow-list** | FB · IG · Web JSON | ✅ |
| **২৬.৬** | Inbox delivery বাগ (IG/WA নীরব ব্যর্থতা) + echo ডুপ্লিকেট | `lib/services/inbox-delivery.ts` · দুই route · FB/IG JSON | ✅ |
| **২৬.৭** | গার্ড টেস্ট + ডকুমেন্টেশন | `lib/n8n/workflow-drift.test.ts` | ✅ |

### ক্রম কেন এমন

**২৬.১ → ২৬.২ → ২৬.৩** — কারণ ২৬.১ ছাড়া বাকি সবকিছুই একটি ব্যর্থতায় নীরবে মরে যাবে। আর ২৬.৩-এর আগে WhatsApp চালু না হলে সবচেয়ে বড় চ্যানেলটাই বাদ থাকবে।

---

### ২৬.১ — Core Brain-এর media পথ ভাঙা-প্রতিরোধী

**কেন প্রথম:** সবচেয়ে কম কাজে সবচেয়ে বড় ক্ষতি বাঁচায় — অডিটের সমস্যা #৩, #৪, #৫, #১১ একসাথে মিটে যায়।

**অবস্থা: ✅ সম্পন্ন (২০২৬-১০-১৭)** — ৩৭ → ৪০ node; `npm test` (drift guard) পাস।

| ধাপ | কী |
|---|---|
| ক | সব media node-এ `onError: continueErrorOutput`, আর সেই error-output একটি নতুন **`Media Failed`** node-এ → `Merge Media` |
| খ | নতুন **`Normalize Audio Type`** — `audio/mp4` → `audio/m4a`, `audio/mpeg` → `audio/mp3`, `; codecs=opus` কেটে ফেলা; `audioBytes` গণনা; size limit |
| গ | নতুন **`Audio Supported?`** (IF) — সমর্থিত হলে `Gemini Transcribe`, নাহলে সোজা `Set Audio Message`-এ fallback |
| ঘ | `Download Image`/`Download Audio`-এ `timeout: 15000` |
| ঙ | `Set Image Message` / `Set Audio Message`-এ `userMessage` ধরে রাখা + খালি মানে fallback |
| চ | `Gemini Transcribe`-এ `Gemini API Key` credential, `$env` বাদ |

**যে নিয়মে fallback লেখা হবে:** গ্রাহক যেটুকু পাঠিয়েছেন সেটি হারানো যাবে না, আর AI-কে বলা হবে *কী করতে হবে* ("ভদ্রভাবে বলুন ছবিটা বর্ণনা করতে বা নাম লিখতে") — শুধু "বোঝা যায়নি" নয়।

### ২৬.২ — WhatsApp-এ ছবি ও ভয়েস

**অবস্থা: ✅ সম্পন্ন (২০২৬-১০-১৭)** — নতুন `Image Auth?` / `Audio Auth?` শাখা, চার caller-এ `mediaAuthHeader`।

| ধাপ | কী |
|---|---|
| ক | `Normalize WhatsApp Payload` — `image` → `mediaType='image'` + `mediaId` + caption; `audio`/`voice` → `mediaType='audio'` + `mediaId` |
| খ | `Build Brain Payload` — token দিয়ে `GET graph.facebook.com/v20.0/{mediaId}?fields=url,mime_type` → `mediaUrl` + `mediaAuthHeader` |
| গ | `Core-AI-Brain`-এ `Image Auth?` / `Audio Auth?` (IF) + `Download Image (Auth)` / `Download Audio (Auth)` |
| ঘ | `Execute Core AI Brain`-এ নতুন ইনপুট `mediaAuthHeader` — **চারটি caller-এই** (drift test একই key-set দাবি করে) |

⚠️ **কেন দুটি আলাদা download node (অডিটের ক-২), ক-১ নয়:** অডিট `this.helpers.httpRequest` দিয়ে binary নামানোর কথা বলেছিল, কিন্তু সেটি **এখান থেকে যাচাই করা সম্ভব নয়**। খালি `Authorization:` header পাঠালে Meta CDN ৪০০ দিতে পারে — তাই শর্তসাপেক্ষ পথই একমাত্র নিশ্চিত।

⚠️ **যা মেনে নিতে হবে:** WhatsApp access token Core Brain-এর execution data-তে দেখা যাবে। এটা নতুন ঝুঁকি নয় (`Fetch Integration Secrets` আগেই একই instance-এ token দেখায় — আগের নাম `Decrypt Integration Secrets`), কিন্তু লেখা থাকুক।

### ২৬.৩ — ইনবাউন্ড media সংরক্ষণ

**অবস্থা: ✅ সম্পন্ন (২০২৬-১০-১৭ · n8n Credential-এ রূপান্তর ২০২৬-১০-১৮)** — ৪৯ node; multipart upload, ব্যর্থতাও গ্রাহকের উত্তর আটকায় না।

**সমস্যা:** Meta-র URL স্থায়ী নয় — Messenger-এর signed CDN link কয়েক ঘণ্টায়, WhatsApp-এর lookaside link ~৫ মিনিটে মেয়াদোত্তীর্ণ। তাই পুরনো চ্যাটে ছবি দেখাতে হলে **নিজেদের সংরক্ষণ করতে হবে**।

| ধাপ | কী |
|---|---|
| ক | `Cloudinary Config` (Set) — cloud name ও folder-env (গোপন নয়) |
| খ | `Upload Image to Cloudinary` / `Upload Audio to Cloudinary` (HTTP Request, multipart) — **Basic Auth credential**, Cloudinary Upload API signature ছাড়াই এটা নেয় |
| গ | `Merge Image Upload` / `Merge Audio Upload` (Code) — Cloudinary response থেকে `secure_url` তুলে মূল item-এ ফিরিয়ে দেয় (নইলে পরের Gemini node-এর base64 হারিয়ে যেত) |
| ঘ | `Save Chat History` — `content` = আসল `userMessage`, `mediaUrl` = Cloudinary `secure_url`, `mediaType` |
| ঙ | আপলোড ব্যর্থ হলে fallback: `content` = enriched `resolvedMessage`, `mediaUrl` = null (agent অন্তত বর্ণনাটা দেখবেন) |

**⚠️ কেন env variable নয়:** Code node কখনো n8n credential পড়তে পারে না, আর hosted n8n-এ env var যোগ করার UI (External Secrets) Enterprise-only। তাই HTTP Request node + `httpBasicAuth` credential — যা Community edition-এও কাজ করে। ⚠️ **signature ছাড়া Basic Auth দিলে `timestamp`/`signature` পাঠানো হয় না**, শুধু `file` + `folder`।

**⚠️ কেন base64, binary নয়:** n8n-এ binary এক node হাতবদল করলেই হারিয়ে যায় (`Code in JavaScript`-এর পরে)। Cloudinary data-URI ফিল্ড হিসেবে নিলে সমস্যাটাই থাকে না — আর `Gemini Vision`/`Transcribe`-এর JSON body-ও ইতিমধ্যেই base64 ব্যবহার করে।

**🔴 খরচ — সৎভাবে:** Cloudinary free tier ≈ ২৫ credit/মাস (স্টোরেজ + ব্যান্ডউইথ মিলিয়ে)।

| ধরন | আকার | ২,০০০ media/দিনে |
|---|---|---|
| সংকুচিত ছবি | ~২০০ KB | ~৪০০ MB/দিন |
| ভয়েস নোট (৩০s) | ~৬০ KB | — |
| **মাসিক (মিশ্র)** | | **~৮–১২ GB** |

অর্থাৎ free tier **কয়েক দিনেই শেষ**। তাই §৬-এর retention সিদ্ধান্তটি এই সাব-টাস্কেরই অংশ।

### ২৬.৪ — Media billing

**অবস্থা: ✅ সম্পন্ন (২০২৬-১০-১৭)** — `extra.image` / `extra.audioMinutes` শুধু Gemini সত্যিই কাজ করলে যায়।

| ধাপ | কী |
|---|---|
| ক | `Format Response` — `isImage`, `audioMinutes` (= `audioBytes × 8 / 16000 / 60`) বের করা |
| খ | `Billing API` — `"extra": { "image": …, "audioMinutes": … }` |
| গ | টোকেন estimate বাংলা-aware: `bnChars/1.7 + otherChars/3.8` |
| ঘ | `llmCallCount` — media থাকলে **২** (OpenRouter + Gemini)। যাচাই করেছি: [`cost-calculator.ts`](../../lib/ai/cost-calculator.ts) এই সংখ্যা খরচের গণনায় ব্যবহারই করে না, তাই এটি কেবল analytics |

### ২৬.৫ — Video/File ও SSRF

**অবস্থা: ✅ সম্পন্ন (২০২৬-১০-১৭)** — অসমর্থিত attachment আর নীরবে হারায় না; web hook এখন শুধু `https://res.cloudinary.com` ফেচ করে।

| ধাপ | কী |
|---|---|
| ক | FB/IG `Normalize * Payload` — video/sticker/file এলে `return []` নয়, সদয় বার্তা |
| খ | Web `Validate & Normalize Payload` — `mediaUrl`-এর host allow-list (Cloudinary)। ব্রাউজারই একমাত্র অবিশ্বস্ত উৎস, তাই সীমাটা এখানেই |

### ২৬.৬ — Inbox delivery বাগ

🔴 **নতুন পাওয়া — অডিটে নেই**

**অবস্থা: ✅ সম্পন্ন (২০২৬-১০-১৭)** — নতুন `lib/services/inbox-delivery.ts`; দুই route একই path ব্যবহার করে; echo INSERT-এ ৬০-সেকেন্ডের guard।

| # | বাগ | প্রমাণ |
|---|---|---|
| ১ | IG ও WhatsApp-এ মার্চেন্টের উত্তর **কখনো পৌঁছায় না** | [`send-message/route.ts:78`](../../app/api/inbox/send-message/route.ts#L78) — পুরো delivery block `if (platform === "facebook")`-এর ভেতরে; `metaDelivered`/`metaError` UI-তে **কোথাও পড়া হয় না** (grep শূন্য) |
| ২ | পাঠানো ছবি inbox-এ **দুবার** দেখায় | route নিজে `ChatMessage` লেখে, তারপর echo webhook `Log Echo Message` আরেকটি লেখে |

**সমাধান ১ (✅):** উভয় route এখন [`deliverInboxMessage`](../../lib/services/inbox-delivery.ts) ডাকে, যেটি ভেতরে [`deliverOutbound`](../../lib/services/outbound.ts) ব্যবহার করে — Facebook · Instagram · WhatsApp, ২৪-ঘণ্টার messaging window, এবং সঠিক recipient id। ⚠️ আসল UI [`api/chatbots/[chatbotId]/messages`](../../app/api/chatbots/[chatbotId]/messages/route.ts) ব্যবহার করত — সেটিও একই বাগে ছিল, তাই দুটোই সরানো হয়েছে। উত্তর না পৌঁছালে response-এ `delivery.delivered: false` + `skipReason` যায়, আর Live Inbox এখন তা toast-এ দেখায় (আগে নীরব ছিল)।

**সমাধান ২ (✅):** `Log Echo Message`-এর `INSERT` এখন `INSERT … SELECT … WHERE NOT EXISTS` — একই session-এ dashboard-এর পাঠানো `sentByHuman` বার্তা ৬০ সেকেন্ডের ভেতরে থাকলে echo row লেখা হয় না। সরাসরি Messenger/Instagram থেকে পাঠানো reply-এর echo আগের মতোই লেখা হবে (`UPDATE ChatSession` অংশ অপরিবর্তিত)।

⚠️ **জানা সীমা:** echo যদি API response-এর আগেই পৌঁছে যায় (বিরল race), তবে দুটি row হতে পারে — একটি Cloudinary URL নিয়ে (dashboard), একটি Meta CDN URL নিয়ে (echo)। এই দিকটা বেছে নেওয়া হয়েছে কারণ উল্টো দিকে বেছে নিলে সরাসরি Messenger থেকে পাঠানো বার্তা inbox-এ হারিয়ে যেত।

### ২৬.৭ — গার্ড

**অবস্থা: ✅ সম্পন্ন (২০২৬-১০-১৭)** — drift test ১৯ → **৩৫**; `npm test` ৭১৪ পাস।

[`lib/n8n/workflow-drift.test.ts`](../../lib/n8n/workflow-drift.test.ts)-এ নতুন guard:

- **`MEDIA_STEPS`** (১০টি node) — প্রতিটির উপস্থিতি, `onError: continueErrorOutput`, এবং error-output সত্যিই `Media Failed`-এ যায় কি
- **`MEDIA_EDGES`** (১২টি edge) — `Code in JavaScript → … → Merge Media → Embed Query` চেইন অটুট কি
- **`Media Router`-এর output ক্রম** — 0 = text, 1 = image, 2 = audio (ক্রম বদলালে ছবি অডিও-পথে যাবে)
- **চার caller-ই `mediaAuthHeader` পাঠায় কি** — WhatsApp-এর token ছাড়া অথেনটিকেটেড download ব্যর্থ হয়
- **WhatsApp normalizer** — `mediaType` সেট হলে একই শাখায় `mediaId`-ও সেট হয় কি না (নাহলে প্রতিটি ছবি `Media Failed`-এ যাবে)
- **FB/IG `Log Echo Message`** — `WHERE NOT EXISTS` guard টিকে আছে কি (২৬.৬-এর ডুপ্লিকেট ফিরে আসা আটকায়)

---

## ৫. খরচের হিসাব — সূত্রসহ

**Gemini 2.5 Flash, paid tier** ([Google pricing](https://ai.google.dev/gemini-api/docs/pricing), ২০২৬-০৯-১৮ হালনাগাদ):

| ইনপুট | দাম / ১M টোকেন |
|---|---|
| টেক্সট · ছবি · ভিডিও | $0.30 |
| **অডিও** | **$1.00** |
| আউটপুট | $2.50 |

৳১২০/$ ধরে ([`credit-config.ts:109`](../../lib/domain/credit-config.ts#L109) fallback):

| কী | টোকেন | খরচ |
|---|---|---|
| একটি ছবি (≤৩৮৪px ≈ ২৫৮ + ~১০০ out) | ~৩৬০ | ~$0.00035 ≈ **৳০.০৪** |
| ১ মিনিটের ভয়েস (৩২ টোকেন/সেকেন্ড) | ~২,০৪০ | ~$0.0022 ≈ **৳০.২৭** |

**মার্জিন — BD Starter (৳৯৯৯ / ১৫,০০০ credit = ৳০.০৬৬/credit):**

| অ্যাকশন | আমরা নিই | খরচ | মার্জিন |
|---|---|---|---|
| `image_message: 5` | ৳০.৩৩ | ৳০.০৪ | **৮x** ✅ |
| `audio_per_minute: 5` | ৳০.৩৩ | ৳০.২৭ | **১.২x** ⚠️ |

> ⚠️ **`audio_per_minute`-এর মার্জিন প্রায় শূন্য।** ছোট clip-এ সমস্যা নেই (`Math.ceil` মিনিমাম ১ মিনিট ধরে), কিন্তু লম্বা ভয়েসে লাভ থাকে না — আর WhatsApp-এর Meta ফি চালু হলে **ঋণাত্মক** হয়ে যাবে। ৮–১০ করা উচিত কি না, সেটি §৭-এর সিদ্ধান্ত।

**স্কেল (১০০ merchant × ২০ media/দিন = ২,০০০/দিন):**

| মিশ্রণ | দৈনিক | মাসিক |
|---|---|---|
| সব ছবি | $0.70 | ~$21 |
| অর্ধেক ছবি, অর্ধেক ৩০s ভয়েস | $1.50 | ~$45 |
| সব ১-মিনিট ভয়েস | $4.40 | ~$132 |

credit থেকে আসে ১০,০০০ credit/দিন ≈ ৳৬৬৬/দিন ≈ **৳২০,০০০/মাস**। অর্থাৎ **খরচ কভার হয়**।

### সস্তা করার পথ (ভবিষ্যতের)

| পথ | ফল | সতর্কতা |
|---|---|---|
| **Flash-Lite** শুধু Vision/Transcribe-এ | ~৩x সস্তা | Bengali অডিওতে নিজে পরীক্ষা করতে হবে; model-id env/সেটিংসে রাখা উচিত |
| ছবি ≤৩৮৪px-এ নামিয়ে পাঠানো | ইমেজ টোকেন ৪x কম | **সুপারিশ নয়** — লেবেল/দামের লেখা পড়া কঠিন হয় |
| VPS-এ নিজের Whisper | প্রতি কলে $0 | CPU-তে ধীর, Bengali নির্ভুলতা কম, ops বোঝা |

---

## ৬. ইনবাউন্ড media সংরক্ষণ — খরচ ও সীমা

**ভালো দিক:** Meta নিজেই inbound media ধরে রাখে, তাই **fetch-এর জন্য কোনো স্টোরেজ খরচ নেই** — শুধু ধরে রাখলে খরচ।

| সংখ্যা | মান |
|---|---|
| Meta-র URL আয়ু | Messenger/IG: কয়েক ঘণ্টা · WhatsApp: ~৫ মিনিট |
| আমাদের সংরক্ষণ | Cloudinary, `driplare/{env}/chatbots/{chatbotId}/inbox` |
| অনুমিত প্রবৃদ্ধি | ~৮–১২ GB/মাস (১০০ merchant) |
| Cloudinary free tier | ~২৫ credit/মাস → **কয়েক দিনেই শেষ** |

**🔴 এই টাস্কে যা করা হচ্ছে, আর যা এখনো নয়:** সংরক্ষণ হবে, কিন্তু **retention নীতি এখনো ঠিক হয়নি**। অপশন:

| অপশন | অর্থ | ফল |
|---|---|---|
| ক | সব রাখা | খরচ চিরকাল বাড়ে |
| খ | **৯০ দিন পর স্বয়ংক্রিয় মুছে ফেলা** (cron) | খরচ স্থির, পুরনো চ্যাটে ছবি হারায় |
| গ | শুধু thumbnail রাখা | সস্তা, কিন্তু গ্রাহক কী পাঠিয়েছিলেন তার বিবরণ হারায় |

**সুপারিশ: খ** — ৯০ দিন চ্যাট ইতিহাসের জন্য যথেষ্ট, আর খরচ অনুমানযোগ্য। বাস্তবায়ন আলাদা cron (TASK-22-এর পরে)।

⚠️ **গোপনীয়তা:** গ্রাহকের ছবি এখন আমাদের কাছে জমা থাকবে। তাই প্রাইভেসি পলিসিতে "ছবি ও ভয়েস বার্তা প্রক্রিয়াকরণ ও সংরক্ষণ" যোগ করতে হবে — এটি কোডের কাজ নয়।

---

## ৭. সিদ্ধান্তের লগ

| # | সিদ্ধান্ত | কারণ | তারিখ |
|---|---|---|---|
| ১ | WhatsApp media = **URL + শর্তসাপেক্ষ auth header** | base64 পাঠালে ১৩ MB পর্যন্ত sub-workflow-এ যেত | ২০২৬-১০-১৭ |
| ২ | auth = **IF + আলাদা download node** (অডিটের ক-২) | ক-১-এর helper আচরণ এখান থেকে যাচাই করা যায় না | ২০২৬-১০-১৭ |
| ৩ | ভয়েস credit = **byte size → `audioMinutes`** | নতুন credit key লাগে না | ২০২৬-১০-১৭ |
| ৪ | Inbox = **আসল `userMessage` + স্থায়ী `mediaUrl`** | ২৬.৩-এর পর URL স্থায়ী, তাই অডিটের সুপারিশ এখন সঠিক | ২০২৬-১০-১৭ |
| ৫ | Video/File = **সদয় উত্তর** | নীরব বাদ পড়ার চেয়ে ভালো | ২০২৬-১০-১৭ |
| ৬ | ইনবাউন্ড media **সংরক্ষণ করব** | ইউজারের নির্দেশ (২০২৬-১০-১৭): পুরনো চ্যাটে ছবি দেখা যেতে হবে | ২০২৬-১০-১৭ |
| ৭ | Gemini = **paid tier** | free tier গ্রাহকের ডেটা ট্রেনিংয়ে ব্যবহার করে + RPM সীমা | ২০২৬-১০-১৭ |
| ৮ | `audio_per_minute` **৫-ই থাকুক** | ১.২x মার্জিন কম হলেও এখনো পজিটিভ; WhatsApp ফি চালু হলে পুনর্বিবেচনা | ২০২৬-১০-১৭ |

---

## ৮. যাচাইয়ের পরিকল্পনা

| # | কী | কীভাবে |
|---|---|---|
| ১ | `audio/mp4` normalization | Messenger-এর ভয়েস নোট → execution মরে না, transcript আসে |
| ২ | অসমর্থিত MIME | ইচ্ছাকৃতভাবে `application/octet-stream` → সদয় বার্তা |
| ৩ | `onError` পথ | অচল `mediaUrl` → reply আসে |
| ৪ | WhatsApp end-to-end | আসল ছবি + ভয়েস নোট |
| ৫ | Cloudinary সংরক্ষণ | ছবি পাঠানোর পর `ChatMessage.mediaUrl` খুললে ছবি দেখা যায়, দিন পরে আবার |
| ৬ | Billing `extra` | media reply-এর credit text reply-এর চেয়ে ৫ বেশি |
| ৭ | SSRF | `mediaUrl = http://169.254.169.254/` browser থেকে পাঠালে বাদ পড়ে |
| ৮ | Timeout | ধীর URL ১৫ সেকেন্ডে ছাড়ে |
| ৯ | **প্রতিটি JSON** | `node -e "require('./…')"` + `npm test` (drift guard) |

---

## ৯. যা ইউজারের হাতে

| # | কাজ | কেন |
|---|---|---|
| ১ | **৫টি workflow import** — Core-AI-Brain · WhatsApp · Facebook · Instagram · Web-Playground | n8n-এ JSON সরাসরি বদলানো যায় না |
| ২ | n8n-এ **Basic Auth credential** তৈরি — নাম `Cloudinary Upload`, username = API Key, password = API Secret | upload node-গুলো এটি ব্যবহার করে (env var লাগে না) |
| ২ক | `Cloudinary Config` node-এ **cloud name** বসানো | placeholder `REPLACE_WITH_CLOUDINARY_CLOUD_NAME` আছে |
| ২খ | FB · IG · WA তিন adapter-এ **`Fetch Integration Secrets`** node-এ Header Auth credential বেছে নেওয়া — নাম `Driplare Internal`, header `x-n8n-secret`, মান = Vercel-এর `N8N_CALLBACK_SECRET` | ২০২৬-১০-১৮ থেকে decrypt Code node নয়, অ্যাপের `/api/internal/integration-secrets` থেকে আসে (§ [`integration-token-encryption.md`](../integration-token-encryption.md) §১.২) |
| ৩ | Gemini API key-তে **billing চালু** | paid tier |
| ৪ | Cloudinary-তে **retention** সিদ্ধান্ত (§৬) | খরচ |
| ৫ | প্রাইভেসি পলিসিতে media সংরক্ষণ যোগ | আইনি |
| ৬ | হাতে পরীক্ষা — FB-তে ছবি, IG-তে ভয়েস, WhatsApp-এ দুটোই | শেষ প্রমাণ |

---

## ১০. অগ্রগতির লগ

| তারিখ | কী |
|---|---|
| ২০২৬-১০-১৩ | অডিট সম্পন্ন (`Multimodal-Audit.md`) — ১২টি সমস্যা চিহ্নিত |
| ২০২৬-১০-১৭ | টাস্ক নম্বরহীন অবস্থা থেকে **TASK-26** তৈরি; দুইটি নতুন বাগ পাওয়া গেল (inbox delivery, echo duplicate); ইনবাউন্ড media সংরক্ষণের সিদ্ধান্ত |
| ২০২৬-১০-১৭ | **২৬.১ ✅** — `Core-AI-Brain.json`-এ ৩টি নতুন node (`Normalize Audio Type`, `Audio Supported?`, `Media Failed`), ৫টি node-এ `continueErrorOutput` + timeout, `Gemini Transcribe`-এ credential ও `$env` বাদ, image/audio বার্তায় caption সংরক্ষণ + খালি-উত্তরের fallback |
| ২০২৬-১০-১৭ | **২৬.২ ✅** — WhatsApp normalizer এখন `mediaType: image/audio` + `mediaId` পাঠায়; `Build Brain Payload` token দিয়ে `GET /{mediaId}` করে `mediaUrl`+`mediaAuthHeader` দেয়; Core Brain-এ `Image Auth?`/`Audio Auth?` + আলাদা auth-download node; ৪টি caller-এ একই new input (drift test পাস) |
| ২০২৬-১০-১৭ | **২৬.৩ ✅** — `Upload Image/Audio to Cloudinary` (signed multipart, base64 data-URI), `Merge Media` এখন Code node যা `content`/`mediaUrl`/`mediaType` ঠিক করে, `Save Chat History`-এ `mediaUrl`/`mediaType` কলাম |
| ২০২৬-১০-১৭ | **২৬.৪ ✅** — `Format Response` বাংলা-aware টোকেন estimate (`bn/1.7 + rest/3.8`), `Billing API`-তে `extra` + সঠিক `llmCallCount` (media থাকলে ২) |
| ২০২৬-১০-১৭ | **২৬.৫ ✅** — FB/IG normalizer-এ video/sticker/file-এর সদয় নির্দেশ; Web `Validate & Normalize Payload`-এ https + `res.cloudinary.com` allow-list |
| ২০২৬-১০-১৭ | **২৬.৬ ✅** — নতুন `lib/services/inbox-delivery.ts`; দুই inbox route এখন Facebook · Instagram · WhatsApp-এ একই path দিয়ে পাঠায়, ব্যর্থ হলে `delivery` object-এ কারণ ফেরে আর Live Inbox toast দেখায়; `Log Echo Message`-এ ৬০-সেকেন্ডের `NOT EXISTS` guard (ডুপ্লিকেট বন্ধ) |
| ২০২৬-১০-১৭ | **২৬.৭ ✅** — drift guard ১৯ → ৩৫ টেস্ট: media node/edge chain, `Media Router`-এর output ক্রম, চার caller-এর `mediaAuthHeader`, WhatsApp `mediaId` pairing, FB/IG echo guard। `npx tsc --noEmit` পরিষ্কার, `npm test` **৭১৪ পাস** (২৯ ফাইল) |
| ২০২৬-১০-১৮ | **Cloudinary upload → n8n Credential** — hosted n8n-এ env var দেওয়া যায় না, তাই upload Code node দুটিকে HTTP Request + `httpBasicAuth` credential-এ সরানো হলো (Cloudinary Upload API signature ছাড়াই Basic Auth নেয়)। নতুন `Cloudinary Config` Set node (cloud name), `Merge Image/Audio Upload` Code node → Gemini-র base64 অটুট। Guard ৩৫ → **৩৮ টেস্ট** |
| ২০২৬-১০-১৮ | **Integration secrets → অ্যাপের endpoint** — `require('crypto')` task runner-এ নিষিদ্ধ, আর Code node credential পড়তে পারে না; তাই `Decrypt Integration Secrets` বাদ দিয়ে `Fetch Integration Secrets` (HTTP Request, `httpHeaderAuth`)। নতুন `POST /api/internal/integration-secrets` (Zod + `x-n8n-secret` + rate limit + `no-store`); `Fetch Integration`-এর SQL এখন ciphertext পড়ে না। n8n-এ কোনো env লাগে না — কেবল Header Auth credential। Guard ৩৮ → **৪১** (মোট suite ৭২০ পাস) |
