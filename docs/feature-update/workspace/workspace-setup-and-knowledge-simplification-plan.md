# Workspace Setup ও Business Knowledge সরলীকরণ পরিকল্পনা

> **স্ট্যাটাস:** Product direction অনুমোদিত; ধাপে ধাপে implementation চলছে।  
> **সম্পর্কিত:** `workspace-business-hierarchy-ux-plan.md`, `workspace-business-hierarchy-tasks.md`, `business-knowledge-and-onboarding-plan.md`  
> **লক্ষ্য:** একজন নতুন merchant-কে এক Workspace-এ একটি business setup করে অন্তত একটি AI Agent নিরাপদে live করতে সাহায্য করা—কম বিভ্রান্তি, স্পষ্ট অগ্রগতি, এবং business data-এর একটিই source of truth রেখে।

## ১. আগের মডেল থেকে বর্তমান মডেল

- **আগে:** Chatbot/AI Agent-ই ছিল business-এর কেন্দ্র; category, products, rules এবং knowledge agent-ভিত্তিক হওয়ায় একই business-এর একাধিক agent-এ data ও setup পুনরাবৃত্তি/অসামঞ্জস্যের ঝুঁকি ছিল।
- **এখন:** একটি Workspace একটি business ও একটি business type-এর মালিক। Business profile, shared rules/knowledge এবং operational data Workspace-এ থাকে; AI Agent পায় ওই Workspace-এর shared context, আর তার নিজস্ব থাকে role, দায়িত্ব, tone ও প্রয়োজনে সীমিত instruction। Platform-এ এক সময়ে নির্দিষ্ট channel-এর জন্য একটি Agent live থাকে।
- **বর্তমান UI সমস্যা:** Sidebar-এর Setup Guide dropdown-এর checklist আছে, কিন্তু এটি পূর্ণ onboarding destination নয়। Business Knowledge-এ Overview, FAQ, Sample Replies, Business Data, Content Training, Auto-Train এবং Rules আলাদা জায়গায় থাকায় একই তথ্য একাধিকবার লেখার মতো মনে হয়।
- **বর্তমান data ভিত্তি:** `Workspace.businessProfile`, `WorkspaceAISettings`, `WorkspaceKnowledgeItem`, `Source`/`Chunk` এবং Workspace-scoped Products/Orders/Offers/Courier models ইতিমধ্যে আছে। তাই প্রথম লক্ষ্য নতুন storage নয়—বর্তমান canonical data-কে পরিষ্কার UX ও এক retrieval flow-তে যুক্ত করা।

## ২. প্রস্তাবিত merchant journey

প্রথম Business signup শেষ হলে merchant সরাসরি `/dashboard/setup`-এ যাবে। Setup Guide Sidebar-এ Overview-এর ওপরে আলাদা, স্থায়ী **Setup** navigation item হবে; সেখানে completion count থাকবে। Setup page-ই হবে কাজের ক্রম, পরবর্তী action এবং progress-এর একক home।

| ধাপ | Merchant-এর কাজ | সম্পন্ন হওয়ার শর্ত | কাজের শেষে |
|---|---|---|---|
| **1. Business setup** | Business name/type, description, phone/email/address, website, hours; category অনুযায়ী products/services; delivery, payment, exchange/refund-এর প্রযোজ্য তথ্য | প্রয়োজনীয় profile ও business-type অনুযায়ী ন্যূনতম offering/operational info save | Setup page-এ ফেরা; এরপর Agent তৈরির CTA |
| **2. AI Agent** | Agent name ও role/template নির্বাচন; কী কাজ করবে, tone, handoff এবং প্রয়োজনীয় সীমা নির্ধারণ | অন্তত একটি Agent save; shared Business Knowledge-এ আলাদা করে তথ্য পুনরায় চাওয়া হবে না | Platform connect-এ যাওয়া |
| **3. Platform connect** | Facebook/WhatsApp/Web channel connect করে প্রথম Agent assign | অন্তত একটি channel connected এবং নির্দিষ্ট Agent-এ assigned | Test-এ যাওয়া |
| **4. Test** | Playground-এ suggested customer প্রশ্ন দিয়ে business facts, policies ও Agent আচরণ যাচাই | merchant অন্তত একটি test চালান এবং test result দেখা যায়; বাধ্যতামূলক pass/fail gate নয় | Live করার প্রস্তুতি |
| **5. Go Live** | কোন Agent/channel live হবে দেখে নিশ্চিত করা | Agent live এবং connected channel সক্রিয় | Setup complete; checklist থেকে ভবিষ্যৎ manage link |

Business type অনুযায়ী Step 1-এর fields বদলাবে; উদাহরণস্বরূপ, e-commerce-এ catalog ও delivery, clinic-এ services/appointments, restaurant-এ menu/booking। প্রয়োজনীয় field অসম্পূর্ণ থাকলে step-কে done দেখানো হবে না; optional তথ্যের কারণে merchant-কে আটকে রাখা হবে না।

### Setup navigation ও floating progress

- Sidebar-এ Setup আলাদা item হবে—dropdown checklist নয়। এতে progress (যেমন `2/5`) ও current state থাকবে।
- Setup page-এ পাঁচটি numbered card/row থাকবে। যেকোনো step-এ click করলে সরাসরি সংশ্লিষ্ট existing page/form-এ যাবে; Setup page-এ “কেন দরকার”, completion state এবং “Continue” action থাকবে।
- Setup flow-এর বাইরে dashboard page-এ থাকলে floating, compact progress bar থাকবে: `2/5`, বর্তমান/পরবর্তী step এবং Setup page-এ ফেরার link। এটি mobile-এ সংকুচিত, dismissible নয়; Setup page-এ নিজেই দেখাবে না।
- কাজ save হলে progress server-এর saved data থেকে update হবে—URL visit বা client-side tick থেকে নয়। “Back to Setup” link সংশ্লিষ্ট page-এ থাকবে।
- Go Live সম্পন্ন হলে floating bar সরবে; sidebar-এর Setup item থাকবে এবং completed guide পরে edit/reconnect করার জন্য খোলা যাবে।
- Business signup-এর পর redirect হবে শুধু প্রথম Workspace setup-এ। Personal signup, পরবর্তী login, Workspace switch—এগুলোর বিদ্যমান behavior অক্ষুণ্ণ থাকবে।

## ৩. Business Knowledge-কে তিনটি কাজের জায়গায় নামানো

**প্রস্তাবিত প্রধান navigation:**

1. **Business profile & policies** — Business Data ও Business Rules একত্রে। Profile/contact/hours, category-specific business details, delivery/payment/return/refund rules ও custom attributes থাকবে। Structured field-কে অগ্রাধিকার; প্রয়োজন হলে policy-র ব্যাখ্যামূলক text।
2. **Answers** — FAQ ও Sample Replies-এর বদলে একটি shared উত্তর-ব্যবস্থাপনা। Entry type `Question & answer` অথবা `Example response` হতে পারে; উভয়ই এক জায়গায় search/add/edit হবে। একই প্রশ্ন/উত্তরের duplicate মনে হলে save-এর আগে warning দেখানো যেতে পারে।
3. **Sources** — Text, URL ও সমর্থিত file upload একই Add Source flow-তে। Source-এর processing/index status এবং কোন content AI ব্যবহার করছে তা দেখা যাবে। “যেকোনো file type” upload-যোগ্য ধরে নেওয়া হবে না: parser সমর্থিত নয় এমন format স্পষ্টভাবে reject/ব্যাখ্যা করবে।

**Learn from Conversations** আলাদা স্থায়ী tab না হয়ে Answers/Sources-এর ভেতর review queue বা contextual action হবে। Conversation থেকে প্রস্তাবিত তথ্য merchant approve না করা পর্যন্ত shared knowledge-এ যাবে না। Overview একটি landing summary হতে পারে, কিন্তু প্রধান কাজের tab হিসেবে নয়। Agent Instructions থাকবে Agent-এর নিজস্ব settings-এ—Business Knowledge-এর tab হিসেবে নয়।

### তথ্যের সীমানা

- **Business profile & policies:** Business-এর স্থায়ী পরিচয় ও নিয়ম—নাম, category, description, যোগাযোগ, address, hours, delivery/payment/return policy।
- **Operational records:** Products, price/stock, offers, courier settings, orders ও custom business records তাদের বিদ্যমান canonical module/model-এই থাকবে। Business Knowledge থেকে summary ও Manage link থাকবে; দ্বিতীয় editable copy থাকবে না।
- **Answers:** Merchant-authored FAQ ও উদাহরণ response। একই বিষয় FAQ, reply এবং document-এ নকল না করতে সহজ search এবং duplicate warning।
- **Sources:** দীর্ঘ লেখা, URL ও নথি; এগুলো business profile বা live product/order record-এর বিকল্প নয়।
- **Agent:** Role, responsibilities, tone, escalation, permitted actions/forms; Workspace facts/rules এখানে copy করা হবে না।

## ৪. Centralized storage ও AI context plan

“Centralized” বলতে **Workspace-কে ownership, authorization ও retrieval boundary হিসেবে** বোঝানো হবে—সব ধরনের data-কে এক বিশাল table-এ রাখা নয়।

| তথ্য | একমাত্র canonical storage | AI কীভাবে ব্যবহার করবে |
|---|---|---|
| Business identity/profile | Workspace-এর profile ও category fields | trusted Workspace context-এ prompt-এ যোগ |
| Shared policies/rules | Workspace AI settings / structured policy fields | prompt assembler-এ shared rules; Agent instruction-এর আগে/উপরে প্রাধান্য |
| FAQ ও sample response | WorkspaceKnowledgeItem-এর একেকটি typed record | মূল record-এর সঙ্গে linked Source/Chunk embedding; একই record দ্বিতীয় জায়গায় copy নয় |
| Website, text, file knowledge | Source metadata Workspace-এ; binary existing file-storage service-এ; Chunk/embedding derived index | semantic retrieval; update/delete হলে source ও chunks sync/cleanup |
| Products, current prices/stock, offers, courier settings | বিদ্যমান Workspace-scoped operational models | structured, live lookup; volatile value-কে stale vector result দিয়ে উত্তর নয় |
| Orders/customer records | বিদ্যমান access-controlled transactional models | intent-specific authorized lookup/tool; RAG-এ ব্যক্তিগত record embed নয় |
| Role ও Agent-specific instruction | Chatbot/Agent record | prompt assembly-তে শুধু সংশ্লিষ্ট Agent-এর role/instruction |

**প্রস্তাবিত AI request flow:** authenticated channel → server-side Agent resolve → Agent-এর Workspace resolve → shared profile/rules + Agent role load → প্রশ্ন অনুযায়ী Workspace-scoped structured lookup অথবা Sources/Answers vector retrieval → context assemble → উত্তর। Client-provided `workspaceId` একা বিশ্বাস করা হবে না। সব retrieval/lookup-এ Workspace scope বাধ্যতামূলক; Agent বদলালেও shared facts একই থাকবে, কিন্তু role/instructions বদলাবে।

## ৫. বাস্তবায়নের ধাপ ও নিরাপত্তা

1. **UX/data contract চূড়ান্ত:** পাঁচ ধাপের completion rules, required বনাম optional fields, category-specific Step 1 এবং floating bar-এর completed-state আচরণ অনুমোদন।
2. **Setup hub:** `/dashboard/setup`, Sidebar top-level entry, business signup redirect, step links, saved-state progress endpoint ও responsive floating progress যোগ।
3. **Knowledge IA:** profile/policies একত্রে উপস্থাপন; FAQ/Sample Reply-কে Answers-এ; Text/URL/Files-কে Sources-এ; legacy tab URLs-কে উপযুক্ত নতুন section-এ redirect/translate।
4. **Canonical storage ও AI alignment:** বিদ্যমান model-ই পুনর্ব্যবহার; duplicate write path বন্ধ; Workspace access check, source linkage, indexing status, structured lookup ও Agent context assembly যাচাই। Schema migration কেবল প্রয়োজন প্রমাণিত হলে।
5. **Migration/acceptance:** বিদ্যমান FAQ, replies, rules ও sources অক্ষত রেখে UI-তে map করা; auto-merge/delete নয়। দুই ভিন্ন Workspace ও একই Workspace-এর দুই Agent দিয়ে isolation/shared-context পরীক্ষা; signup-to-live journey desktop/mobile ও বাংলা/ইংরেজিতে যাচাই।

## ৬. অনুমোদিত product direction

- Workspace-এর Business Profile হবে business facts-এর canonical source; common fields-এর সঙ্গে category অনুযায়ী suggested fields এবং merchant-defined custom fields থাকবে।
- Business Rules Workspace-level-এ shared থাকবে। একই policy বা business fact Agent setup-এ আবার চাওয়া হবে না।
- Agent setup role, responsibilities, permissions/handoff এবং প্রয়োজন হলে Agent-specific tone override-এ সীমিত থাকবে।
- Existing `Workspace.businessProfile` JSON ও `WorkspaceAISettings` পুনর্ব্যবহার হবে; প্রয়োজন প্রমাণিত না হলে schema migration যোগ করা হবে না।
- পুরোনো Agent wizard data বা prompt স্বয়ংক্রিয়ভাবে delete/overwrite করা হবে না। নতুন prompt generation-এ legacy business answers উপেক্ষা হবে; বিদ্যমান prompt migration/review আলাদা নিরাপদ ধাপ হিসেবে বিবেচিত হবে।
- FAQ/Sample Reply-কে typed Answers এবং Text/URL/File-কে Sources-এ রাখার বিদ্যমান IA সিদ্ধান্ত বজায় থাকবে; product/order/price-এর canonical record operational module-এই থাকবে।

## ৭. Implementation progress

- [x] Workspace profile category templates ও custom fields-এর server validation এবং shared Agent prompt context।
- [x] Business Profile-এর বাংলা/ইংরেজি helper text, placeholder ও typed custom field UI; “Describe your business” থেকে voice input অপসারণ।
- [x] Agent wizard ও one-click generator-কে business facts-এর বদলে Agent role/responsibility-তে সীমিত করা; পুরোনো stored answers অক্ষত রাখা।
- [ ] Full regression suite এবং authenticated browser visual acceptance।

## গ্রহণযোগ্যতার মানদণ্ড

- নতুন business signup-এর পর merchant Setup page-এ নামে এবং পাঁচ ধাপের কোনটি বাকি তা সবসময় বুঝতে পারে।
- Setup-এর বাইরে dashboard-এ progress দৃশ্যমান; কোনো step complete হয় কেবল সংশ্লিষ্ট data সত্যিই save/connected/live হলে।
- একই ব্যবসার FAQ, reply, policy বা document যোগ করার জন্য একাধিক পরস্পর-অস্পষ্ট tab লাগে না।
- Product/order/price-এর canonical record এক জায়গায় থাকে; Agent-রা Workspace থেকে প্রয়োজনমতো shared context পায়।
- Workspace isolation, role-specific instruction এবং Go Live-এর আগে test path বজায় থাকে।
