/**
 * Step 6 — Core-AI-Brain billing rework.
 *
 * Before: `Log Chat & Billing` wrote an AIUsageLog row itself, with a hardcoded
 *         channel 'web' and a hardcoded creditsDeducted = 15 — and it never
 *         touched the user's balance. Cost was computed in `Format Response`
 *         with a crude char-count estimate multiplied by a hardcoded $3/$15.
 *
 * After:  `Save Chat History` only persists the conversation. All billing goes
 *         to POST https://driplare-ai.vercel.app/api/internal/ai-usage, which is
 *         the single source of truth for price (live OpenRouter) and credits
 *         (admin-adjustable rules).
 *
 * Idempotent: re-running this script on an already-migrated file is a no-op.
 */
const fs = require("fs");
const path = require("path");

// __dirname is docs/cost-analytics, so ".." lands on docs/
const FILE = path.join(__dirname, "..", "n8n-JSON", "Core-AI-Brain.json");
const wf = JSON.parse(fs.readFileSync(FILE, "utf8"));
const byName = (n) => wf.nodes.find((x) => x.name === n);

const log = [];
const step = (msg) => log.push(msg);

// ── 1. Format Response: drop cost math, keep token estimate ──────────────────
const formatResponse = byName("Format Response");
formatResponse.parameters.jsCode = `const rawOutput = $('AI Agent').item.json || {};

const raw = String(rawOutput.output || rawOutput.replyText || rawOutput.text || '');
const imgs = [];
const re = /\\[IMG\\]\\s*(\\S+)/g;
let m;
while ((m = re.exec(raw)) !== null) imgs.push(m[1]);
const replyText = raw.replace(/\\[IMG\\]\\s*\\S+/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();

// কোন model সত্যিই ব্যবহার হয়েছে — 'OpenRouter Chat Model' নোডে হুবহু এই একই
// precedence (প্ল্যাটফর্ম যা পাঠায়, নাহয় bot-এর সেট করা model)। শুধু bot-এর
// মান নিলে ভুল হতো: DB-তে deprecated model থাকলে resolveModelConfig সেটা
// অন্য model-এ নামায়, কিন্তু খরচ তখনো পুরনো model-এর দামে হিসাব হতো।
const model = $('When Called by Platform').item.json.model || $('Fetch Bot Config').item.json.model || 'unknown';

// Token count is a character-based ESTIMATE — it is only a fallback for the
// billing API. The platform recomputes cost from live OpenRouter prices, and
// Step 7 (exact reconciler) replaces this with n8n's own metadata.tracing
// counts. We do NOT compute cost here anymore: price must have exactly one
// source of truth, and a hardcoded rate is what made the old numbers wrong.
const systemPromptStr = String($('Fetch Bot Config').item.json.systemPrompt || '');
const knowledgeCtxStr = String($('Build Context').item.json.knowledgeContext || '');
const userMsgStr = String($('Merge Media').item.json.resolvedMessage || '');
const fullInputStr = systemPromptStr + '\\n' + knowledgeCtxStr + '\\n' + userMsgStr;

const promptTokens = Math.ceil(fullInputStr.length / 3.8) + 1350;
const completionTokens = Math.ceil(raw.length / 3.7);
const totalTokens = promptTokens + completionTokens;

return [{
  json: {
    replyText: replyText,
    galleryImages: imgs,
    promptTokens: promptTokens,
    completionTokens: completionTokens,
    totalTokens: totalTokens,
    tokensAreExact: false,
    model: model,
    timestamp: new Date().toISOString()
  }
}];`;
step("Format Response: costUsd/costBdt calculation সরানো হয়েছে, tokensAreExact: false যোগ হয়েছে");

// ── 2. Log Chat & Billing → Save Chat History (SQL-only, no billing) ─────────
const PLATFORM = "$('When Called by Platform').item.json";
const BOT = "$('Fetch Bot Config').item.json";
const RESP = "$('Format Response').item.json";

const logNode = byName("Save Chat History") || byName("Log Chat & Billing");
if (!logNode) throw new Error("Save Chat History / Log Chat & Billing — কোনোটিই পাওয়া যায়নি");
logNode.name = "Save Chat History";
logNode.parameters.query = `UPDATE "chatbot"."ChatSession" SET "lastMessage" = '{{ ${RESP}.replyText.replace(/'/g, "''").slice(0, 500) }}', "updatedAt" = NOW() WHERE "chatbotId" = '{{ ${PLATFORM}.chatbotId }}' AND "sessionId" = '{{ ${PLATFORM}.sessionId }}';

INSERT INTO "chatbot"."ChatMessage" ("id","chatbotId","userId","sessionId","role","content","timestamp")
VALUES (gen_random_uuid()::text, '{{ ${PLATFORM}.chatbotId }}', '{{ ${BOT}.userId }}', '{{ ${PLATFORM}.sessionId }}', 'user', '{{ $('Merge Media').item.json.resolvedMessage.replace(/'/g, "''") }}', NOW() - INTERVAL '1 second'), (gen_random_uuid()::text, '{{ ${PLATFORM}.chatbotId }}', '{{ ${BOT}.userId }}', '{{ ${PLATFORM}.sessionId }}', 'assistant', '{{ ${RESP}.replyText.replace(/'/g, "''") }}', NOW());`;

// A failing history write must never kill the customer's reply. This is the
// exact failure that silently broke every reply from 2026-08-26 to 2026-09-27.
logNode.onError = "continueRegularOutput";
step("Log Chat & Billing → Save Chat History: AIUsageLog INSERT মুছে ফেলা হয়েছে (credit কাটাও হতো না, শুধু ভুয়া লগ হতো); onError=continueRegularOutput যোগ হয়েছে");

// ── 3. New Billing API node ──────────────────────────────────────────────────
const saveHistory = logNode; // renamed in place
const billingPos = [saveHistory.position[0] + 220, saveHistory.position[1]];

// Channel: the web playground sends `channel`; FB/WA/IG integrations only send
// `platform`. Fall back so a Facebook reply is logged as "facebook", not "web".
const CHANNEL = `{{ ${PLATFORM}.channel || ${PLATFORM}.platform || 'web' }}`;

const billingApi = {
  parameters: {
    method: "POST",
    // The platform app's own domain. NOT www.driplare.com: that host serves the
    // marketing site, where every /api route answers 404 — and because the node
    // is onError: continueRegularOutput, those 404s are swallowed and replies
    // keep working, so the breakage is invisible until someone checks credits.
    url: "https://driplare-ai.vercel.app/api/internal/ai-usage",
    // Header Auth credential, NOT `{{ $env.N8N_CALLBACK_SECRET }}`.
    // n8n Community has no UI for environment variables — those live on the
    // server (docker-compose / .env), which this deployment has no access to.
    // A credential is created in n8n's own UI and works on the free tier. The
    // two Gemini nodes in this very workflow already use this pattern.
    authentication: "genericCredentialType",
    genericAuthType: "httpHeaderAuth",
    sendBody: true,
    specifyBody: "json",
    jsonBody: `={
  "runId": "{{ $execution.id }}",
  "userId": "{{ ${BOT}.userId }}",
  "chatbotId": "{{ ${PLATFORM}.chatbotId }}",
  "sessionId": "{{ ${PLATFORM}.sessionId }}",
  "channel": "${CHANNEL}",
  "modelId": "{{ ${RESP}.model }}",
  "promptTokens": {{ ${RESP}.promptTokens }},
  "completionTokens": {{ ${RESP}.completionTokens }},
  "llmCallCount": 1,
  "isTestChat": {{ ${PLATFORM}.channel === 'playground' }},
  "isFreeMessage": false,
  "tokensAreExact": false
}`,
    options: {
      timeout: 8000,
    },
  },
  // NO `credentials` block on purpose. An exported workflow carries real
  // credential ids, and inventing one (`driplarePlatformSecret`) makes n8n show
  // "Credential not found" — which blocks activation. Leaving it off means the
  // node imports with an empty credential dropdown that the user fills in once.
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: billingPos,
  // Every other node in this workflow carries a UUID; a hand-written string id
  // is the kind of thing n8n's import validation can trip over.
  id: "6f1a4c2e-9d38-4b57-8c41-2ad0e7b93f16",
  name: "Billing API",
  // Critical: a billing outage must not become a reply outage. The customer
  // already has their answer by now; if the platform is unreachable we log and
  // move on. Step 7's reconciler picks up any run that was never billed.
  //
  // ⚠️ Flip side: this makes a misconfigured credential INVISIBLE — every reply
  // succeeds and no credits are ever charged. After importing, send one test
  // message and confirm the balance actually moved. If it did not, open this
  // node's execution and read the error; do not assume it is fine.
  onError: "continueRegularOutput",
  alwaysOutputData: true,
};

const existingBilling = byName("Billing API");
if (existingBilling) {
  Object.assign(existingBilling, billingApi);
  // Object.assign only overwrites keys, it does not remove them — the bogus
  // credential id from the first revision has to be deleted explicitly.
  delete existingBilling.credentials;
  step("Billing API: ইতিমধ্যে ছিল — নতুন সংজ্ঞায় হালনাগাদ করা হয়েছে");
} else {
  wf.nodes.push(billingApi);
  step(`Billing API: নতুন HTTP Request node যোগ হয়েছে → POST /api/internal/ai-usage (runId = $execution.id, channel = ${CHANNEL})`);
}

// ── 4. Rewire the chain ─────────────────────────────────────────────────────
wf.connections["Order Created Check"] = {
  main: [[{ node: "Save Chat History", type: "main", index: 0 }]],
};
wf.connections["Save Chat History"] = {
  main: [[{ node: "Billing API", type: "main", index: 0 }]],
};
wf.connections["Billing API"] = {
  main: [[{ node: "Return to Platform", type: "main", index: 0 }]],
};
delete wf.connections["Log Chat & Billing"];
step("Connections: Order Created Check → Save Chat History → Billing API → Return to Platform");

// ── 5. Return to Platform: cost/credits now come from the billing response ──
const returnNode = byName("Return to Platform");
const assignments = returnNode.parameters.assignments.assignments;
const setOrAdd = (id, name, type, value) => {
  const found = assignments.find((a) => a.name === name);
  if (found) {
    found.type = type;
    found.value = value;
  } else {
    assignments.push({ id, name, type, value });
  }
};

setOrAdd("out-cost-usd", "costUsd", "number", `={{ $('Billing API').item.json.costUsd || 0 }}`);
setOrAdd("out-cost-bdt", "costBdt", "number", `={{ $('Billing API').item.json.costBdt || 0 }}`);
setOrAdd("out-credits", "creditsSpent", "number", `={{ $('Billing API').item.json.creditsSpent || 0 }}`);
setOrAdd("out-billing-ok", "billingOk", "boolean", `={{ $('Billing API').item.json.success === true }}`);
setOrAdd("out-total-tok", "totalTokens", "number", `={{ ${RESP}.totalTokens }}`);
step("Return to Platform: costUsd/costBdt এখন Billing API-র উত্তর থেকে; creditsSpent ও billingOk যোগ হয়েছে");

// ── 6. Sticky note — document the new env var ───────────────────────────────
const sticky = wf.nodes.find((n) => n.type === "n8n-nodes-base.stickyNote");
sticky.parameters.content = `Core AI Brain — billing via platform API (v7)

ONE-TIME SETUP (n8n UI, no server access needed):
  Credentials → New → "Header Auth"
    Name  : x-n8n-secret
    Value : (Vercel project "driplare-ai"-এর N8N_CALLBACK_SECRET মান)
  তারপর "Billing API" নোডের Credential ড্রপডাউনে
  credential-টা select করুন — খালি রাখলে নোড চলবে না।

  ⚠️ এটা না করলে "Billing API" 401 পাবে আর প্রতিটি
  reply-তে credit কাটা চুপচাপ বন্ধ থাকবে — reply ঠিকই
  আসবে, তাই ভুল ধরা পড়বে না। ইমপোর্টের পর একটা টেস্ট
  মেসেজ দিয়ে ব্যালেন্স সত্যিই কমছে কি না দেখে নিন।

CHAIN: ... → Save Chat History → Billing API → Return to Platform
Billing API → POST https://driplare-ai.vercel.app/api/internal/ai-usage
  (এটাই প্ল্যাটফর্ম অ্যাপের ডোমেইন। www.driplare.com-এ
   অ্যাপটি নেই — ওখানে সব /api রুট ৪০৪ দেয়।)

This node is the ONLY place credits are deducted now. It also
writes the AIUsageLog. runId = $execution.id makes retries
idempotent — the same run can never be charged twice.

Cost is NOT computed here. Prices come from live OpenRouter
data on the platform side, so there is nothing to keep in sync.`;
sticky.parameters.width = 580;
sticky.parameters.height = 660;
step("Setup Notes sticky note: N8N_CALLBACK_SECRET নির্দেশনা যোগ হয়েছে");

// ── 7. A warning note about manual test runs ────────────────────────────────
// The trigger is an executeWorkflowTrigger: with no caller there is no input
// data, so executing a step by hand in the editor invents `undefined` values
// and ends in a foreign-key error. That error says nothing about the workflow,
// but it is easy to mistake for a real bug.
const manualNoteName = "⚠️ ম্যানুয়ালি চালাবেন না";
const manualNote = {
  parameters: {
    content: `এডিটরে "Execute step" চেপে এই workflow চালাবেন না।

"যখন প্ল্যাটফর্ম থেকে ডাকা হয়" একটি executeWorkflowTrigger —
বাইরে থেকে ডাকা না হলে এর কোনো ইনপুট ডেটা থাকে না।
তাই হাতে চালালে chatbotId = undefined হয়ে
"ChatSession_chatbotId_fkey" ত্রুটি আসে।

ওই ত্রুটি workflow-এর সমস্যা নয়। টেস্ট করতে হলে
Playground / Facebook / WhatsApp থেকে মেসেজ পাঠান।`,
    height: 250,
    width: 580,
  },
  type: "n8n-nodes-base.stickyNote",
  typeVersion: 1,
  position: [-160, 800],
  id: "7c93b5d1-84e2-4f6a-9b17-3e5ac82f0d94",
  name: manualNoteName,
};
if (!byName(manualNoteName)) {
  wf.nodes.push(manualNote);
  step("সতর্কীকরণ sticky note যোগ: ম্যানুয়াল রানের বিভ্রান্তি এড়াতে");
}

// ── Write ───────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, JSON.stringify(wf, null, 2) + "\n", "utf8");
console.log(log.map((l, i) => `${i + 1}. ${l}`).join("\n"));
console.log(`\nনোড সংখ্যা: ${wf.nodes.length}`);
