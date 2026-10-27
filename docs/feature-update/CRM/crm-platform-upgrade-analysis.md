# DRIPLARE AI: CRM Platform Upgrade Analysis

**তারিখ:** ২৭ অক্টোবর ২০২৬  
**ধরন:** Read-only product ও architecture analysis  
**পরিধি:** বর্তমান dashboard navigation, প্রধান CRM/order/product/inbox screen, API routes, Prisma schema, automation model, locale files এবং project documentation পর্যালোচনা করা হয়েছে। এই প্রতিবেদনের জন্য কোনো application code পরিবর্তন বা test run করা হয়নি।

## সারসংক্ষেপ

DRIPLARE AI এখন chatbot-এর পাশাপাশি omnichannel inbox, social-commerce operations, order ও product management, automation এবং প্রাথমিক CRM সুবিধা দেয়। তাই এটি আর কেবল chatbot support platform নয়। তবে এটিকে পূর্ণাঙ্গ CRM বলা যাবে না: customer identity এখনও chat session-কেন্দ্রিক, sales pipeline ও follow-up task নেই, এবং customer/order/deal-এর মধ্যে স্থায়ী সম্পর্ক ও governance অসম্পূর্ণ।

প্ল্যাটফর্মটির সবচেয়ে শক্তিশালী ভিত্তি হলো conversation data, Facebook/WhatsApp/Instagram/web channel workflow, order/courier/COD operations এবং automation। উপযুক্ত পরবর্তী দিক হলো **conversation-led CRM for SMB social commerce**—অর্থাৎ কথোপকথন থেকে lead তৈরি, customer-কে একত্র করা, follow-up পরিচালনা, sale ও repeat purchase মাপা।

## বর্তমান সক্ষমতা

| ক্ষেত্র | বর্তমান অবস্থা | মূল্যায়ন |
|---|---|---|
| Omnichannel inbox | Conversation list, human/AI handoff, assignment, snooze, archive, status ও CRM side panel | শক্ত ভিত্তি |
| Leads & Customers | Contact/lead stats, search, bot/platform/tag filter, AI insight/score, order history, staff notes ও CSV export | প্রাথমিক CRM |
| Order management | Manual order, status, courier dispatch/tracking, COD collection, change/cancellation workflow | শক্ত commerce operations |
| Products | Manual, CSV ও social import, product variant data, stock filter ও edit | Catalog আছে; পূর্ণ inventory ledger নেই |
| Automations | Order/lead/tag triggers, note/tag/assignment actions, broadcasts, templates ও run log | CRM automation-এর ভালো ভিত্তি |
| Workspace ও team | Workspace, team member ও role; chat assignment | ভিত্তি আছে; CRM ownership ও audit আরও দরকার |
| Analytics | Lead/order/revenue/COD ও AI usage summary | CRM funnel, pipeline ও attribution reporting অনুপস্থিত |

প্রাসঙ্গিক বর্তমান UI: [Sidebar](../../../components/layout/Sidebar.tsx), [Leads page](../../../app/(dashboard)/dashboard/leads/page.tsx), [Customer CRM drawer](../../../components/crm/CustomerCrmDrawer.tsx), [Orders](../../../app/(dashboard)/dashboard/orders/page.tsx), [Products](../../../app/(dashboard)/dashboard/products/page.tsx), [Inbox](../../../app/(dashboard)/dashboard/inbox/_components/InboxLayout.tsx)।

## প্রজেক্ট-নির্দিষ্ট gap ও পর্যবেক্ষণ

### ১. Lead row আসলে ChatSession-ভিত্তিক

`/api/crm/customers` API chat session পড়ে প্রতিটি session-কে `CustomerLead` হিসেবে তৈরি করে। Overview analytics-এ `totalLeads`-ও `ChatSession` count থেকে আসে। তাই একই ব্যক্তি একাধিক channel বা একাধিক chat session ব্যবহার করলে তাকে একাধিক lead হিসেবে গণনা হতে পারে; এই সংখ্যা unique customer-এর সংখ্যা নয়। API-তে `chatbotId` বাধ্যতামূলক, তাই বর্তমান তালিকাটি workspace-wide CRM view-ও নয়।

`CustomerProfile` মডেল ও `/api/crm/link-identity` cross-channel identity linking শুরু করেছে। কিন্তু profile-এর session IDs একটি `String[]`-এ থাকে; Contact, ChannelIdentity, Conversation এবং Order-এর মধ্যে পূর্ণ relational association নেই।

**সূত্র:** [CRM customer API](../../../app/api/crm/customers/route.ts), [Identity linking API](../../../app/api/crm/link-identity/route.ts), [Analytics API](../../../app/api/analytics/overview/route.ts), [Merchant schema](../../../prisma/schema/merchant.prisma)।

### ২. Sales pipeline ও follow-up task layer নেই

`ChatSession`-এ AI lead status, sentiment, assignee ও extracted data আছে। Automation-এ `lead.status_changed` trigger এবং `set_lead_status`, `add_note`, `assign_to_agent` action-ও রয়েছে। কিন্তু schema-তে স্বতন্ত্র `Deal`, `Pipeline`, `Task` বা CRM `Activity` model নেই। ফলে follow-up due date, sales owner, deal value, expected close date, stage conversion এবং overdue work track করার স্থায়ী জায়গা নেই।

**সূত্র:** [Automation schema](../../../prisma/schema/automation.prisma), [Automation catalog](../../../lib/automations/catalog.ts), [Automation types](../../../lib/automations/schema.ts)।

### ৩. Order ও product record customer-এর সঙ্গে স্থায়ীভাবে যুক্ত নয়

`Order`-এ chatbot ও plain-text session ID আছে, কিন্তু canonical customer ID নেই; order line items JSON হিসেবে রাখা। ChatSession মুছে গেলেও Order টিকে থাকার জন্য session relation ইচ্ছাকৃতভাবে foreign key নয়—এটি order durability-র জন্য ভালো, তবে customer-level reporting-এর জন্য Contact association দরকার।

`Product`-এ একটি stock integer এবং JSON variants আছে। Variant-level SKU/stock, inventory movement history, stock adjustment, order reservation বা warehouse model নেই। বর্তমান stock filter-ও নির্দিষ্ট ১–৫ সংখ্যাকে low-stock ধরে।

**সূত্র:** [Order/Product/CustomerProfile schema](../../../prisma/schema/merchant.prisma)।

### ৪. Leads UI-তে CRUD ও workspace-wide workflow সীমিত

বর্তমান Leads page-এ search, selected chatbot, platform/tag filter, pagination, CSV export এবং customer drawer আছে। Drawer-এ basic contact info, AI insights, order history ও internal notes দেখা যায়। কিন্তু CRM customer API-তে customer listing-এর জন্য `GET` আছে; Contact create/edit/merge, saved views, custom fields বা bulk assignment workflow এখনো পূর্ণাঙ্গ নয়। Page default-এ ১০টি row দেখায় এবং export function loaded list ব্যবহার করে; তাই export বর্তমান page-এর data-তে সীমিত বলে মনে হয়—এটি যাচাই করে UX-এ স্পষ্ট করা দরকার।

**সূত্র:** [Leads page](../../../app/(dashboard)/dashboard/leads/page.tsx), [CRM API routes](../../../app/api/crm)।

### ৫. CRM data portability ও deletion lifecycle যাচাই করা দরকার

`CustomerProfile.workspaceId` schema-তে plain string; `Workspace`-এর সঙ্গে relation নেই। Account deletion handler user record মুছে Clerk user-ও delete করে, কিন্তু CustomerProfile cleanup স্পষ্টভাবে করে না। অন্য কোথাও cleanup না থাকলে orphan customer profile থেকে যেতে পারে।

Data export handler সাম্প্রতিক session সর্বোচ্চ ২০টি পড়ে, কিন্তু export payload-এ CRM contact, order ও product record অন্তর্ভুক্ত নয়। CRM বিস্তারের আগে export/delete flow-তে নতুন record type যোগ করা জরুরি। এই data lifecycle gap-কে উচ্চ অগ্রাধিকার দিয়ে যাচাই করা উচিত।

**সূত্র:** [CustomerProfile schema](../../../prisma/schema/merchant.prisma), [Account deletion API](../../../app/api/user/delete/route.ts), [Data export API](../../../app/api/user/export/route.ts)।

### ৬. Consent, audit ও permissions-কে CRM scope-এ আনতে হবে

CRM schema-তে channel-ভিত্তিক marketing consent, opt-out status বা consent history-এর স্পষ্ট fields দেখা যায়নি। `WorkspaceMember`-এ role আছে, তবে CRM record ownership, record changes, identity merge, consent update ও stage transition-এর audit trail schema-তে পাওয়া যায়নি। Broadcast ও customer automation বাড়ানোর আগে consent-aware audience eligibility ও change history যোগ করা উচিত।

## প্রস্তাবিত UI পরিবর্তন

### ন্যাভিগেশন

`Leads & Customers`-কে CRM section হিসেবে সাজানো যেতে পারে:

- **CRM Overview**
- **Leads**
- **Contacts**
- **Deals**
- **Tasks & Calendar**
- **Segments**

Commerce section-এ Products, Orders, Inventory ও Couriers থাকবে। Inbox থাকবে conversation পরিচালনার মূল স্থান, তবে সেখান থেকে Customer, Deal, Task ও Order record-এ যাওয়া যাবে। Header-এ workspace-wide search এবং `Add Contact`, `Create Deal`, `Create Task`, `Create Order` quick actions দিন।

### CRM Overview

Dashboard-এ period, owner ও channel filter-সহ এই ধরনের KPI দিন:

- নতুন/unassigned lead, qualified lead ও overdue follow-up
- Sales pipeline value, expected close, win/loss ও stage conversion
- First response time ও follow-up SLA
- Repeat order, returning/lapsed customer ও customer lifetime value

বর্তমান Overview-তে lead/order/revenue/COD summary আছে। CRM dashboard-এ এগুলোকে session count থেকে আলাদা করে unique Contact ও Deal ভিত্তিক metric করতে হবে।

### Leads ও Contacts list

- Saved views: `New`, `Unassigned`, `High intent`, `No recent activity`, `Repeat customers`
- Filter: owner, lifecycle stage, source/channel, last activity, next task, order/deal value
- Column selection, table/board switch ও record preview
- Bulk assign, stage/tag update, export ও duplicate review/merge
- Manual Contact/Lead create এবং import preview/validation
- Export-এ current page, selected rows বা পুরো filtered result—কোনটি যাচ্ছে তা স্পষ্ট করা

HubSpot-এর official CRM guide-এ object index page-এ filter, saved view, table/board view ও record preview-এর pattern দেখানো হয়েছে: [View and filter records](https://knowledge.hubspot.com/records/view-and-filter-records?rd=1)।

### Contact 360 record

Customer profile-কে drawer-এর বাইরে পূর্ণ record page হিসেবে বাড়ান; drawer quick preview হিসেবে রাখা যেতে পারে। Header-এ Contact name, lifecycle stage, owner, preferred channel ও quick actions দিন। Profile sections/tabs:

1. **Overview:** editable properties, source, consent/preferences, address
2. **Timeline:** chat, note, task, order event, deal-stage change ও owner change
3. **Conversations:** linked Facebook/WhatsApp/Instagram/web sessions
4. **Orders:** product lines, payment, delivery, cancellation/return ও COD status
5. **Deals & Tasks:** open pipeline ও upcoming/overdue follow-up

CRM-এ related records এবং activities-কে দুই দিক থেকে দেখা গুরুত্বপূর্ণ; HubSpot associations guidance-এ Contact, Company, Deal, Ticket ও activity-র এই ধরনের link pattern দেখানো হয়েছে: [Associate records](https://knowledge.hubspot.com/records/associate-records?wmediaid=t2l973hq40)।

### Deals ও Tasks UI

- Deals-এর জন্য Kanban board এবং table view; stage drag-and-drop, amount, probability, close date, owner, next task ও lost reason
- Tasks-এর জন্য `Due today`, `Overdue`, `Assigned to me`, priority ও calendar view
- Task/meeting/call/notes-কে Lead, Contact ও Deal-এর সঙ্গে যুক্ত করা
- Record timeline থেকে দ্রুত task create ও complete করা

Salesforce activities guidance-এ tasks ও meetings-কে Lead/Contact/Opportunity-র সঙ্গে যুক্ত করে list, report ও reminder থেকে পরিচালনার pattern রয়েছে: [Activities, Tasks and Calendars](https://help.salesforce.com/s/articleView?id=activities.htm&language=en_US&type=5)।

### Responsive ও localization

Mobile-এ list → record → activity workflow সহজ রাখুন; desktop-এ table/board ও detail side panel ব্যবহার করুন। নতুন CRM text আলাদা English/Bengali locale namespace-এ রাখুন। বর্তমান Leads screen-এ hardcoded English text রয়েছে এবং `public/locales/{en,bn}`-এ leads-specific namespace দেখা যায়নি—এটি নতুন CRM UI-এর সঙ্গে ঠিক করা দরকার।

## প্রস্তাবিত CRM data model ও functionality

### Contact ও identity

- Workspace-owned stable `Contact` record; lifecycle stage যেমন `new`, `engaged`, `qualified`, `customer`, `repeat`, `lapsed`
- আলাদা `ContactIdentity`: channel, external account/user ID, verified phone/email ও identity-link status
- Contact ↔ conversation, order, deal, task ও support case association
- Contact-level tag ও property; conversation tag আলাদা রাখা
- Duplicate match, human review, merge, merge history এবং field survivorship rules
- Source/campaign/referral attribution ও assigned owner

BD social-commerce context-এ email একা যথেষ্ট dedupe key নাও হতে পারে। Stable channel ID ও normalized/verified phone/email মিলিয়ে candidate match দেখানো এবং ambiguous match manual review-তে পাঠানো উপযুক্ত। এটি CRM dedupe best practice-কে এই product-এর channel- ও phone-first ব্যবহার অনুযায়ী প্রয়োগের সুপারিশ। HubSpot-এর documentation-এ contact/company deduplication, unique property এবং import-time matching-এর গুরুত্ব দেখানো হয়েছে: [Deduplicate records](https://knowledge.hubspot.com/records/deduplication-of-records?x=0)।

### Lead ও Deal

এই product-এর D2C/social-commerce focus-এ একই ব্যক্তির জন্য আলাদা Lead ও Customer record তৈরি করে duplicate বাড়ানোর বদলে Contact-এর lifecycle stage রাখা যেতে পারে। Qualification-এর পর sales opportunity থাকলে আলাদা Deal তৈরি হবে। ভবিষ্যতে B2B sales workflow এলে Lead conversion এবং Company/Account model যোগ করা যাবে। Salesforce lead-management guidance-এ lead fields-কে conversion-এর সময় Account, Contact ও Opportunity fields-এ map করার কথা বলা হয়েছে: [Configure Lead Management](https://help.salesforce.com/s/articleView?id=sf.customize_leadmgmt.htm&language=en_US&type=5)।

Deal fields: pipeline/stage, amount/currency, probability, expected close date, source, owner, associated Contact/Company, next task ও lost reason।

### Activities ও Tasks

Activity timeline-এ manual note/task/meeting এবং system event (message, order delivery, stage update, identity merge) লিখুন। Task-এ assignee, due date, priority, status, reminder ও related records রাখুন। Automation-এ `create_task`, `task_due`, `no_activity` trigger/action যোগ করা যেতে পারে।

### Product, inventory ও orders

- Stable Contact ID-তে order যুক্ত করা; item list normalized order line/variant ID-তে রাখা
- Variant-level SKU ও stock; inventory movement/adjustment, reason, actor, timestamp ও low-stock threshold
- Order confirm/dispatch/return flow-তে stock reserve/release rules
- Contact profile থেকে order history এবং order screen থেকে customer profile-এ যাওয়া
- Supplier/purchase order/warehouse management পরে যোগ করা যেতে পারে, যদি product scope-এ তা প্রয়োজন হয়

### Segmentation, automation ও analytics

- Dynamic segment: lifecycle stage, channel, consent, order history, inactivity, product/category interest
- Trigger: lead qualified, deal stage changed, follow-up overdue, order delivered/returned, customer inactive
- Action: assign owner, create task, update property, internal alert, consent-যোগ্য channel-এ follow-up
- Reports: source/channel conversion, pipeline velocity, response time, win/loss reason, repeat purchase, LTV/cohort, automation outcome
- AI buying-intent score-এর সঙ্গে score reason ও supporting signal দেখানো; high-impact action merchant review-র পরে

## পর্যায়ভিত্তিক roadmap

### Phase 1 — Customer data foundation

1. Canonical Contact ও channel identity তৈরি
2. Contact–Conversation–Order association এবং duplicate merge
3. Contact lifecycle, owner, source ও consent/preferences
4. CRM audit history, tenant-scoped permissions এবং export/delete completeness
5. Server-side search/pagination এবং workspace-wide CRM query

### Phase 2 — দৈনন্দিন sales CRM

1. Leads/Contacts list, saved views, bulk actions ও import/export
2. Contact 360 profile ও unified activity timeline
3. Task/reminder/calendar, overdue queue ও owner workflow
4. Deal/Pipeline board, stage history, forecast ও lost-reason reporting

### Phase 3 — Retention ও reporting

1. Dynamic segments ও consent-aware automation
2. Lead source attribution ও funnel reporting
3. Repeat/lapsed customer workflows এবং purchase/cohort metrics
4. AI summary/score explanation ও follow-up suggestions

### Phase 4 — Business management বিস্তার

1. Variant-level inventory ledger ও order reservation
2. Support ticket/case ও SLA—যদি conversation-এর বাইরে durable issue workflow দরকার হয়
3. Company/Account, custom fields/pipelines ও B2B workflow—target market উপযুক্ত হলে
4. Public API/webhook ও external CRM/accounting/shipping integrations

## অগ্রাধিকার

**সবার আগে:** canonical customer identity, record associations এবং data export/deletion/consent lifecycle। এগুলো ছাড়া Contact count, sales conversion, campaign targeting ও customer history অবিশ্বস্ত হতে পারে।

এরপর **Tasks + Deals/Pipeline + Contact 360** আনলে sales follow-up ও outcome পরিচালনা করা যাবে। তারপর segmentation, automation ও CRM analytics যোগ করুন। B2B Company/Account model ও advanced inventory procurement-কে বাস্তব user need অনুযায়ী পরবর্তী পর্যায়ে রাখুন।

## গবেষণা-ভিত্তি

CRM-এর প্রচলিত foundation হলো Contacts, Companies/Accounts, Deals, Tickets, Activities, associations, stages/pipelines, tasks এবং reusable views। HubSpot glossary এই objects ও activity/association pattern সংজ্ঞায়িত করে; Salesforce lead-management docs capture, assignment ও conversion mapping তুলে ধরে। এই গবেষণাকে DRIPLARE AI-এর বর্তমান social-commerce, multichannel ও Bangladesh-first ব্যবহারে প্রয়োগ করে উপরের roadmap প্রস্তাব করা হয়েছে।

## পর্যালোচিত project files

- [Sidebar ও navigation](../../../components/layout/Sidebar.tsx)
- [Leads page](../../../app/(dashboard)/dashboard/leads/page.tsx)
- [Customer drawer](../../../components/crm/CustomerCrmDrawer.tsx)
- [CRM customer API](../../../app/api/crm/customers/route.ts)
- [Identity linking API](../../../app/api/crm/link-identity/route.ts)
- [CRM notes API](../../../app/api/crm/notes/route.ts)
- [Merchant schema](../../../prisma/schema/merchant.prisma)
- [Workspace schema](../../../prisma/schema/auth.prisma)
- [Automation schema ও catalog](../../../prisma/schema/automation.prisma) · [catalog](../../../lib/automations/catalog.ts)
- [Overview analytics API](../../../app/api/analytics/overview/route.ts)
- [Account export](../../../app/api/user/export/route.ts) · [account deletion](../../../app/api/user/delete/route.ts)
- [English locales](../../../public/locales/en) · [Bengali locales](../../../public/locales/bn)
- [README](../../../README.md) · [Project analysis](../../../project_analysis.md)
