# Workspace AI Rules & Agent Setup Tasks

> **ভিত্তি:** `docs/feature-update/workspace/workspace-AI-guideline.md`  
> **অগ্রগতি:** ধাপে ধাপে বাস্তবায়ন চলছে। যাচাই না হওয়া কাজ Done করা যাবে না।

## Phase A — Audit ও contract

- [x] 🟦 Existing Workspace/Agent AI settings schema, Setup tabs, Knowledge Base scope ও RAG path পর্যালোচনা।
- [x] 🟦 Playground, website widget ও model-compare prompt entry point চিহ্নিত।
- [x] 🟦 Existing workspace access pattern: owner এবং active member; member role-এ admin/agent/viewer শনাক্ত।
- [x] 🟦 Rules JSON contract ও owner/admin write, active-member read permission নির্ধারণ।

## Phase B — Persistence ও API

- [x] 🟦 `WorkspaceAISettings`-কে Workspace-এর সঙ্গে relational, `app_auth`-scoped model করা; additive migration খসড়া তৈরি।
- [x] 🟦 `GET`/`PATCH /api/workspaces/[workspaceId]/ai-settings` তৈরি; Zod validation ও role authorization যোগ।
- [x] 🟦 Empty settings ও legacy Workspace-less chatbot fallback সমর্থন।

## Phase C — Runtime prompt assembly

- [x] 🟦 Shared assembler-এ Workspace rules এবং agent prompt একত্র করা।
- [x] 🟦 Playground, website widget ও compare request-এ একই assembler ব্যবহার; live n8n workflow-তেও settings read করা।
- [x] 🟦 Workspace rules ছাড়া আগের আচরণ বজায় রাখা; RAG context-কে reference data হিসেবে আলাদা করা।

## Phase D — UI ও guided setup

- [x] 🟦 Workspace Knowledge Base-এ Company AI Rules structured form/tab যোগ।
- [x] 🟦 `Add Custom` দিয়ে সর্বোচ্চ ২০টি custom rule level ও instruction যোগ, সম্পাদনা ও সরানোর সুবিধা যোগ।
- [x] 🟦 System Prompt tab-এ inherited rules read-only preview যোগ।
- [x] 🟦 Generate Prompt-এর পর AI Model tab খোলা; model/credit তথ্য ও Continue action যোগ।
- [x] 🟦 English/Bengali localization, responsive/theme tokens, keyboard tab roles ও saved/loading/error states যোগ।

## Phase E — Release readiness

- [x] 🟦 Prisma schema validation ও client generation সম্পন্ন; additive Workspace AI migration configured Neon database-এ সফলভাবে প্রয়োগ হয়েছে।
- [ ] Authorization, prompt precedence, rule propagation, missing settings ও legacy chatbot behavior যাচাই।
- [ ] Setup navigation, pending changes ও save behavior যাচাই।
- [x] 🟦 TypeScript source check (stale `.next/dev/types` বাদ দিয়ে) সফল; locale ও n8n workflow JSON parse সফল।
