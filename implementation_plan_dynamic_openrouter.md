# Dynamic OpenRouter Model Architecture Implementation Plan

## লক্ষ্য

Hardcoded OpenRouter model ID-এর পরিবর্তে OpenRouter-এর live active model list ব্যবহার করা, trusted provider filtering বজায় রাখা, tier অনুযায়ী dynamic model assignment করা, এবং পুরোনো database record-কে নিরাপদ fallback সহ চালু রাখা।

## বাস্তবায়ন ধাপ

1. **Live OpenRouter service**
   - `lib/ai/openrouter-service.ts` তৈরি করা।
   - `https://openrouter.ai/api/v1/models` থেকে server-side fetch করা।
   - Next.js fetch cache ব্যবহার করে 12 ঘণ্টা পর্যন্ত cache রাখা।
   - শুধু `google/gemini-*`, `openai/gpt-*`, `anthropic/claude-*`, `meta-llama/llama-3.3-*` রাখা।
   - Model ID, provider, display label, context length, pricing/latency metadata-এর একটি client-safe contract দেওয়া।
   - Upstream failure হলে predictable empty/last-safe fallback behavior রাখা, যাতে request path ভেঙে না যায়।

2. **Dynamic tier resolution**
   - `lib/ai/chat-models.ts` থেকে static model ID catalog ও static tier IDs সরানো।
   - Fast, Smart, Genius-এর জন্য deterministic ranking/scoring rules তৈরি করা।
   - `getValidatedModelId(storedModelId: string): Promise<string>` যোগ করা।
   - Active list-এ থাকলে stored ID রাখা; invalid/deprecated হলে current Fast model ব্যবহার করা।
   - পুরোনো provider/model database shape এবং simple tier keys (`fast`, `smart`, `genius`) সমর্থন করা।
   - Credit tier/cost যেন dynamic model-এর ক্ষেত্রে central credit rules ভেঙে না দেয়, সে জন্য safe tier fallback ও cost strategy সংরক্ষণ করা।

3. **Models API contract**
   - `/api/models/openrouter` endpoint তৈরি করা।
   - Client components server-only service import না করে endpoint থেকে live filtered models নেবে।
   - Provider-grouped data ও dynamic tier selections response-এ দেওয়া।
   - Loading, empty, upstream error এবং stale/fallback state UI-তে প্রকাশ করা।

4. **UI model selection**
   - Chatbot create/edit forms, chat settings এবং compare playground-এর static `CHAT_MODELS` dependency সরানো।
   - Custom/Pro model dropdown-এ Google, OpenAI, Anthropic, Meta provider group দেখানো।
   - Existing database model live list-এ না থাকলেও label/value হারানো যাবে না; save বা runtime validation-এর সময় fallback হবে।
   - Simple tier cards dynamic tier model selection অনুসরণ করবে।

5. **Runtime এবং n8n compatibility**
   - Test chat route-এ n8n payload পাঠানোর আগে async model validation করা।
   - Compare route-এর উভয় model validate করা।
   - Chatbot create/update normalization-এ backward-compatible validation যোগ করা।
   - Credit check ও direct OpenRouter callers-এ model resolution একক helper-এর মাধ্যমে করা।
   - `Core-AI-Brain.json`-এর runtime payload contract যাচাই করা; workflow file-এ প্রয়োজনীয় expression/field change কেবল তখনই করা হবে যখন বর্তমান n8n node contract তা দাবি করে।

6. **Verification**
   - TypeScript compile, ESLint এবং production build চালানো।
   - Invalid legacy ID, live active ID, upstream failure, empty model list এবং UI loading state যাচাই করা।
   - Changed files-এর line references সহ Bengali walkthrough প্রস্তুত করা।

## Backward Compatibility Policy

- Existing database records migrate বা overwrite করা হবে না।
- Stored legacy model ID active থাকলে সেটিই ব্যবহার হবে।
- Deprecated/unknown ID runtime-এ Fast tier-এর active model-এ fallback করবে।
- API response-এ legacy provider/model fields বজায় থাকবে।
- Client UI live list-এ না থাকা stored selection-কে সাময়িকভাবে দেখাতে পারবে, কিন্তু execution-এর আগে validation বাধ্যতামূলক থাকবে।

## সম্ভাব্য সিদ্ধান্ত

- OpenRouter upstream metadata-তে latency সবসময় নির্ভরযোগ্য নাও হতে পারে; তাই Fast/Smart/Genius ranking provider ও model-family signals, context capability এবং pricing metadata-এর deterministic score দিয়ে হবে।
- Trusted provider filter-এর বাইরে থাকা পুরোনো model runtime-এ আর execute করা হবে না; Fast fallback ব্যবহার হবে।
- Translation, embeddings এবং product extraction-এর মতো non-chat utility calls-ও direct hardcoded model ব্যবহার করলে একই validation helper-এ আনা হবে, তবে embeddings endpoint-এর জন্য chat-model filter প্রযোজ্য করা হবে না।
