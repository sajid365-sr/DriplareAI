# Workspace AI Rules & Agent Setup Improvement Plan

> **স্ট্যাটাস:** বাস্তবায়ন চলছে  
> **Scope:** Workspace-জুড়ে প্রযোজ্য AI নির্দেশনা, prompt assembly, এবং Chatbot Setup-এর guided flow।  
> **সম্পর্কিত কাজ:** `docs/feature-update/workspace/workspace-business-hierarchy-tasks.md`, `docs/feature-update/chatbot/workspace-driven-agent-tasks.md`

## 1. লক্ষ্য ও বর্তমান অবস্থা

এই পরিবর্তনের লক্ষ্য:

1. প্রতিটি Workspace-এর জন্য এক জায়গায় কোম্পানির AI নির্দেশনা রাখা।
2. Workspace নির্দেশনা প্রতিটি agent-এর উত্তরে প্রয়োগ করা, কিন্তু agent তৈরির সময় আলাদা কপি করে stale হয়ে যাওয়া ঠেকানো।
3. Agent-এর নিজস্ব পরিচয়, ভূমিকা ও কাজকে Workspace-এর সাধারণ নিয়ম থেকে আলাদা রাখা।
4. Prompt তৈরি করার পর ব্যবহারকারীকে AI Model ধাপটি স্পষ্টভাবে দেখিয়ে তারপর System Prompt review-তে নেওয়া।

Repository-তে ইতিমধ্যে Workspace ও agent-ভিত্তিক knowledge scope এবং Setup-এর তিনটি tab আছে:

- Workspace-এর shared knowledge `/dashboard/knowledge-base`-এ পরিচালিত হয়। Workspace sources `workspaceId` ও `isGlobal` দিয়ে আলাদা করা এবং RAG-এ Workspace context-এর সঙ্গে অনুসন্ধান করা হয়।
- Setup-এর tab-গুলো `app/(dashboard)/dashboard/chatbots/[chatbotId]/setup/_components/chat-settings.tsx`-এ আছে। `handleWizardGenerated` বর্তমানে prompt তৈরি হলে সরাসরি `prompt` tab খোলে।
- `prisma/schema/workspaceAi.prisma`-এ `WorkspaceAISettings` ও `AgentAISettings` model আগে থেকেই সংজ্ঞায়িত। `Workspace` model `app_auth` schema-তে, আর Chatbot-এর prompt ও wizard data `chatbot` schema-তে রয়েছে।
- Agent-এর নিজস্ব prompt-এর জন্য Chatbot-এ `systemPrompt`, `systemPromptRaw`, `compiledPrompt` ও `wizardData` field রয়েছে। `AgentAISettings` model-টির runtime ব্যবহার এই পরিকল্পনা লেখার সময় পাওয়া যায়নি; বাস্তবায়নের আগে পুনরায় যাচাই করতে হবে।

অতএব, নতুন সমান্তরাল Setup page, model selector, Agent prompt table বা Workspace Knowledge Base তৈরি করা এই কাজের লক্ষ্য নয়। আগে থেকে থাকা মডেল ও UI-কে কাজে লাগিয়ে প্রয়োজনীয় ফাঁকগুলো পূরণ করতে হবে।

## 2. Prompt ও নিয়মের স্থাপত্য

```text
Platform safety and tool constraints
        ↓
Workspace AI Rules (সকল agent-এর জন্য প্রযোজ্য)
        ↓
Agent identity, role, task and channel behavior
        ↓
Retrieved Workspace and agent knowledge (তথ্যসূত্র, নির্দেশনা নয়)
```

### Workspace AI Rules

Workspace-স্তরের নিয়মে ব্যবসার brand voice, ভাষানীতি, সবার জন্য প্রযোজ্য policy এবং নিষিদ্ধ/সীমাবদ্ধ আচরণ থাকবে। এগুলো Workspace-এ একবার সংরক্ষিত হবে এবং প্রতিটি AI request-এর prompt compile করার সময় পড়া হবে। ফলে কোনো agent-এর কাছে নিয়মের snapshot কপি থাকবে না; Workspace-এর আপডেট পরবর্তী request থেকেই প্রযোজ্য হবে।

### Agent prompt

Agent-এর পরিচয়, নির্দিষ্ট ভূমিকা, কাজ, conversation flow ও channel-নির্দিষ্ট আচরণ বর্তমান Chatbot prompt/wizard data-তেই থাকবে। Agent-নির্দিষ্ট নির্দেশনা Workspace-এর বাধ্যতামূলক policy বা platform safety/tool constraints বাতিল করতে পারবে না। এই scope-এ `AgentAISettings`-এ কপি, default merge বা `overridesJson` দিয়ে global rule override করা হবে না। Model-টির ব্যবহার না থাকলে সেটি সরানো হবে কি না আলাদা schema cleanup সিদ্ধান্ত; এই feature-এর সঙ্গে নীরবে drop করা যাবে না।

### Knowledge Base ও RAG

Workspace FAQ, sample reply, policy document, product/service তথ্য এবং agent-specific reference আগের মতো Knowledge Base/RAG-এ থাকবে। এগুলো উত্তরকে তথ্য দিয়ে সাহায্য করবে; কিন্তু RAG retrieval অনিশ্চিত হওয়ায় অপরিহার্য global behavior rule-এর একমাত্র storage হবে না। Retrieved text-কে reference data হিসেবে delimit করতে হবে এবং তার ভেতরের instruction-কে system rule হিসেবে মানতে বলা যাবে না।

### Prompt assembly order

একটি shared server-side prompt assembler ব্যবহার করতে হবে, যাতে live chat, playground/test, compare বা অন্য AI entry point একই Workspace rule পায়। চূড়ান্ত system input-এ:

1. platform safety ও enabled tool-এর সীমাবদ্ধতা অক্ষুণ্ণ থাকবে;
2. Workspace rules যোগ হবে;
3. agent-এর compiled/raw prompt ও role যোগ হবে;
4. retrieved knowledge আলাদা, স্পষ্ট reference section-এ থাকবে।

একই rule একাধিক স্তরে থাকলে platform safety/tool constraints সর্বোচ্চ অগ্রাধিকার পাবে। তার পরে Workspace-এর বাধ্যতামূলক policy, তারপর agent-এর অতিরিক্ত নির্দেশনা। Conflict থাকলে assembler-এর আচরণ ও section labeling prompt template-এ স্পষ্ট করতে হবে। User/customer message বা retrieved content যেন trusted instruction হিসেবে prompt-এ মিশে না যায়।

## 3. ডেটা মডেল ও migration নীতি

`prisma/schema/workspaceAi.prisma`-এর বিদ্যমান `WorkspaceAISettings`-কেই Workspace rules-এর canonical persistence হিসেবে যাচাই করে ব্যবহার করতে হবে। প্রস্তাবিত দিক:

- এক Workspace-এ সর্বোচ্চ একটি settings record; `workspaceId` unique থাকবে।
- `WorkspaceAISettings.workspaceId`-কে `Workspace.workspaceId`-এর সঙ্গে relation দিতে হবে এবং `Workspace` model-এ বিপরীত relation যোগ করতে হবে। Workspace মুছে গেলে settings-ও cascade-এ মুছবে।
- Model-টি `Workspace`-এর সঙ্গে একই `app_auth` database schema-তে রাখতে হবে (`@@schema("app_auth")`)।
- `corePrompt` হবে merchant-এর ঐচ্ছিক freeform company instruction; `rulesJson` হবে Zod-validated structured rules (brand voice, language policy, policies, boundaries)। একই তথ্য দুই field-এ duplicate করে contradictory source of truth বানানো যাবে না। Empty/default behavior, JSON shape এবং validation limits নির্দিষ্ট করতে হবে।
- Existing rows ও prompt data পর্যালোচনা করে migration/backfill লাগবে কি না স্থির করতে হবে। Empty settings-এর জন্য প্রতিটি Workspace-এ row বাধ্যতামূলক করা হবে কি lazily upsert হবে—একটি consistent strategy বেছে নিতে হবে।
- `AgentAISettings`-এর runtime ব্যবহার ও production data audit না করে model বাদ বা field rename করা যাবে না। `Chatbot`-এর existing prompt fields-কে agent layer হিসেবে ব্যবহার করলে অতিরিক্ত table বা duplicate copy তৈরি হবে না।

Schema পরিবর্তন হলে project-এর multi-file Prisma config অনুযায়ী schema validate/generate করতে হবে এবং migration পদ্ধতি `docs/` ও deployment workflow-এর সঙ্গে মিলিয়ে নিতে হবে। শুধু feature document দেখে `prisma migrate dev` বা `db push` চালানো যাবে না; migration strategy বাস্তব environment অনুযায়ী নির্ধারিত হবে।

## 4. Backend ও authorization

### Workspace settings API

বাস্তব route convention অনুসরণ করে endpoint হবে:

```text
/api/workspaces/[workspaceId]/ai-settings
GET   — বর্তমান Workspace rules পড়া
PATCH — rules validate করে update/upsert করা
```

`DELETE` endpoint ডিফল্টভাবে যোগ করা হবে না। Rules মুছে ফেলার বদলে স্পষ্ট empty/default state save করা যাবে, যাতে ভুল click-এ সব agent-এর global behavior হঠাৎ হারিয়ে না যায়।

প্রতি request-এ Clerk authentication, Workspace membership এবং role যাচাই করতে হবে। Owner ও `admin` সদস্য edit করতে পারবে; active member-রা read-only preview পাবে। `agent` ও `viewer`-এর product permission ভিন্ন হলে বিদ্যমান Workspace policy-এর সঙ্গে মিলিয়ে final matrix নির্ধারণ করতে হবে। Record lookup/update অবশ্যই authenticated Workspace-এর `workspaceId` দিয়ে scope করতে হবে। Unknown Workspace ও unauthorized access-এর response বিদ্যমান API convention মেনে চলবে।

Request/response-এর runtime Zod validation, string/array size limits, malformed JSON handling, no-store behavior যেখানে দরকার, এবং safe error response নির্দিষ্ট করতে হবে। Authorization শুধু UI-তে লুকিয়ে রাখলে হবে না; server route-এ enforce করতে হবে।

### Runtime inheritance ও coverage

- Workspace settings প্রতি AI request-এ সংশ্লিষ্ট Chatbot-এর `workspaceId` থেকে পড়তে হবে; agent create/update hook-এ copy করা যাবে না।
- Workspace ছাড়া legacy Chatbot থাকলে আগের prompt behavior চালু থাকবে এবং request ব্যর্থ হবে না। Workspace settings না থাকলেও একইভাবে empty rules ধরে চলবে।
- Shared prompt assembly live chat-এর পাশাপাশি playground/test এবং একই prompt ব্যবহারকারী অন্যান্য API-তেও প্রয়োগ করতে হবে। প্রতিটি call site audit করে coverage নথিভুক্ত করতে হবে।
- Cache ব্যবহার করলে key-তে Workspace settings-এর `updatedAt`/version রাখতে হবে, যেন rule update-এর পর পুরোনো prompt চলতে না থাকে। Cache না থাকলে অপ্রয়োজনীয় prompt পুনর্গঠন/DB fetch এড়াতে request lifecycle-এর মধ্যে একবার load করতে হবে।

## 5. Merchant UI ও Setup journey

### Company AI Rules কোথায় সম্পাদনা হবে

মূল navigation হবে বিদ্যমান `/dashboard/knowledge-base`-এর **Workspace** scope-এ নতুন `Company AI Rules` tab। এটি structured settings form দেখাবে; FAQ, Content Training বা RAG source upload-এর বিকল্প হবে না। এতে merchant তার shared knowledge এবং সব agent-এর জন্য বাধ্যতামূলক AI behavior একই Workspace surface-এ খুঁজে পাবে, কিন্তু দুই ধরনের data আলাদা থাকবে।

Tab-এ brand voice, ভাষা ও customer address style, universal business policies, prohibited/limited advice, optional additional instruction এবং merchant-defined custom level/instruction-এর পরিষ্কার field থাকবে। Custom level-এ merchant নিজের label ও instruction যোগ/সরাতে পারবে। Save state, validation, empty state, loading/error state এবং owner/admin বনাম read-only member state থাকবে। ভাষা-নির্ভর UI text `public/locales/en/knowledge-base.json` ও `public/locales/bn/knowledge-base.json`-এ থাকবে।

### Agent Setup-এ inheritance preview

System Prompt tab-এ `Company AI Rules — Inherited from Workspace` নামে collapsed/read-only preview দেখাতে হবে। এখানে effective Workspace rules-এর সারাংশ, last updated তথ্য এবং অনুমতি থাকলে Knowledge Base-এর Company AI Rules tab-এ যাওয়ার link থাকবে। Agent prompt editor কেবল agent-specific layer সম্পাদনা করবে। Preview-কে merged prompt-এর editable text হিসেবে উপস্থাপন করা যাবে না—না হলে merchant global ও agent নিয়মের সীমা গুলিয়ে ফেলবে।

### Guided Setup flow

বিদ্যমান তিনটি tab-ই ব্যবহার করতে হবে:

```text
Quick Setup  →  AI Model  →  System Prompt
```

- `handleWizardGenerated` prompt/wizard state update করার পর `setActiveTab("model")` করবে; prompt review tab-এ সরাসরি যাবে না। Toast text i18n dictionary-তে যোগ হবে।
- AI Model tab-এ বর্তমান নির্বাচিত model/tier, model/provider (যেখানে প্রযোজ্য), এবং প্রকৃত configuration থেকে পাওয়া প্রতি-reply credit cost স্পষ্ট দেখাতে হবে। দাম বা credit hardcode করা যাবে না।
- AI Model tab-এ `Continue to Review Prompt` button যোগ হবে; এটি `prompt` tab খুলবে এবং unsaved selection বাতিল করবে না।
- Prompt tab-এ Workspace rules-এর read-only preview ও agent prompt থাকবে। পেজের বিদ্যমান Save Changes button-ই pending settings save করবে; আলাদা model-save API যোগ করার আগে বর্তমান `useBot` save/select flow যাচাই করতে হবে।
- Tab navigation সরাসরি ব্যবহারযোগ্য থাকবে—guided flow যেন model বা prompt tab-এ manual navigation আটকে না দেয়। Mobile-এ tab label/progress বোঝা, keyboard navigation, focus state এবং unsaved change feedback নিশ্চিত করতে হবে।

## 6. বাস্তবায়নের ধাপ

### Phase A — Audit ও contract

- [ ] `WorkspaceAISettings` ও `AgentAISettings`-এর schema-ব্যবহার, migration history এবং production data যাচাই।
- [ ] সব AI request path ও prompt assembly call site তালিকাভুক্ত করা।
- [ ] Workspace membership role policy এবং rules JSON schema/size limit স্থির করা।
- [ ] Final prompt precedence ও legacy workspace-less Chatbot behavior নথিভুক্ত করা।

### Phase B — Persistence ও API

- [ ] বিদ্যমান `WorkspaceAISettings` model-কে Workspace relation/schema mapping/defaults দিয়ে সঠিক করা; কেবল প্রয়োজন হলে migration তৈরি করা।
- [ ] Clerk + Workspace membership authorization-সহ `GET`/`PATCH /api/workspaces/[workspaceId]/ai-settings` তৈরি/আপডেট করা।
- [ ] Zod validation, upsert, empty settings, safe errors සහ role access enforce করা।

### Phase C — Runtime prompt assembly

- [ ] Shared server-side assembler-এ Workspace rules এবং Chatbot-এর agent prompt একত্র করা।
- [ ] Live chat, playground/test, compare ও অন্যান্য সংশ্লিষ্ট call site-এ একই assembler যুক্ত করা।
- [ ] RAG context আলাদা reference data হিসেবে সীমাবদ্ধ করা; legacy Chatbot ও missing settings fallback রাখা।

### Phase D — UI ও guided setup

- [ ] Workspace Knowledge Base-এ Company AI Rules tab ও structured form যোগ করা।
- [ ] Read-only Workspace rules preview System Prompt tab-এ যোগ করা।
- [ ] Generate Prompt-এর পর Model tab খোলা, model/credit information দেখানো এবং Continue CTA যোগ করা।
- [ ] English/Bengali translation, loading/error/empty/saved states, responsive/dark/light theme ও accessible navigation সম্পন্ন করা।

### Phase E — Release readiness

- [ ] Schema migration/rollback ও legacy behavior পর্যালোচনা।
- [ ] Authorization, prompt precedence, global update propagation, missing settings, legacy Chatbot, Setup tab navigation ও unsaved save behavior যাচাই।
- [ ] Feature-এর task file-এ আলাদা checklist যোগ করে সম্পন্ন কাজ চিহ্নিত করা।

## 7. যাচাইয়ের মানদণ্ড

কাজ সম্পন্ন বলার আগে নিশ্চিত করতে হবে:

1. Workspace-এ rules save/update করলে বিদ্যমান সব agent-এর পরবর্তী AI request-এ নতুন rules প্রযোজ্য হয়; কোনো agent settings snapshot লাগে না।
2. Agent prompt Workspace mandatory rule বা platform/tool safety override করতে পারে না। RAG-এ থাকা instruction-সদৃশ text trusted system policy হিসেবে গণ্য হয় না।
3. Workspace owner/admin write করতে পারে; non-member access পায় না; unauthorized member write করতে পারে না।
4. কোনো Workspace rules row না থাকলে বা legacy Chatbot workspace ছাড়া থাকলে বর্তমান আচরণ ভাঙে না।
5. Generate Prompt-এর পর AI Model tab দৃশ্যমান হয়; বর্তমান tier/model ও বাস্তব credit cost বোঝা যায়; Continue Prompt review খোলে; Save Changes pending edit সংরক্ষণ করে।
6. বাংলা/ইংরেজি, mobile/desktop এবং dark/light mode-এ UI ব্যবহারযোগ্য থাকে।

---

**গুরুত্বপূর্ণ:** এই নথি implementation plan। কোনো phase বাস্তবায়িত ও যাচাই না হওয়া পর্যন্ত task-কে Done চিহ্নিত করা যাবে না।
