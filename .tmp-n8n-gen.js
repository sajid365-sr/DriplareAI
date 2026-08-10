/* eslint-disable */
// Throwaway generator for the 5 modular n8n workflow JSON files.
// Serializes JS objects via JSON.stringify -> guaranteed-valid JSON + correct escaping.
const fs = require("fs");
const path = require("path");

const OUT = "c:/Users/User/Projects/DriplareAI/docs/n8n-JSON";
fs.mkdirSync(OUT, { recursive: true });

// ── Shared credential blocks (real IDs from the user's existing workflows) ──
const PG    = { postgres: { id: "3Aiu7UNMUMPB6aNu", name: "Postgres account" } };
const OR    = { openRouterApi: { id: "jhNy5RPc2l0zAQry", name: "OpenRouter account" } };
const GEM   = { googlePalmApi: { id: "GSuBFeT3qsXKR0hv", name: "Google Gemini(PaLM) Api account" } };
const FIRE  = { firecrawlApi: { id: "rbGOL6ScKjrEVLPs", name: "Firecrawl account" } };

const wf = (name, nodes, connections, extra = {}) => ({
  name,
  nodes,
  pinData: {},
  connections,
  active: false,
  settings: { executionOrder: "v1" },
  tags: [],
  meta: { templateCredsSetupCompleted: true },
  ...extra,
});

const t = (targets, type = "main", index = 0) =>
  targets.map((n) => ({ node: n, type, index }));

// ===========================================================================
// 1) CORE-AI-BRAIN  (central Execute-Workflow sub-workflow)
// ===========================================================================
const CORE_SYSTEM =
  `={{ $('Fetch Bot Config').item.json.systemPrompt + "\\n\\n=== KNOWLEDGE BASE CONTEXT ===\\nUse ONLY the retrieved context below to answer general questions (FAQs, policies, delivery, company info). If the answer is not here and it is not a product or order task, tell the customer you will connect them with a human agent.\\n\\n" + ($json.knowledgeContext || "(no relevant knowledge found)") + "\\n\\n=== LANGUAGE RULES ===\\n1. Detect the customer language (English, Bangla, or Banglish) and ALWAYS reply in that same language and script.\\n2. Never refuse to speak Bangla. Keep product names, sizes and IDs in their original script.\\n\\n=== TONE & FORMATTING ===\\n1. Be friendly, natural and human. Greet only in the first message of a conversation.\\n2. Use clean spacing, bullet points and relevant emojis.\\n3. When you show a product image, put the image URL on its OWN line prefixed with '[IMG] '. These lines are turned into an image gallery and removed from the visible reply text.\\n\\n=== TOOLS ===\\n1. 'Product Lookup' - call FIRST for ANY product question (name, price, stock, size, colour, material, availability). Never guess product data.\\n2. 'Create Order' - call ONLY after the customer has confirmed items, quantity, name, phone and full delivery address. Never invent missing details; ask for them first." }}`;

const coreNodes = [
  {
    parameters: {
      content:
        "## Core AI Brain (Sub-Workflow)\n" +
        "Called by every platform handler via **Execute Workflow**.\n\n" +
        "**Input** (passthrough): `chatbotId, sessionId, platform, userMessage, mediaType, mediaUrl, customerInfo`\n" +
        "**Output**: `replyText, galleryImages[], isOrderCreated`\n\n" +
        "### Setup\n" +
        "1. Set env var `GOOGLE_GEMINI_API_KEY` (used by Embed / Vision / Transcribe HTTP nodes).\n" +
        "2. Copy this workflow's ID into each platform handler's *Execute Core AI Brain* node.\n" +
        "3. RAG is scoped per-tenant: `chatbotId` column OR `metadata->>'chatbotId'` (mirrors lib/ai/rag.ts getContext).",
      height: 320,
      width: 460,
    },
    id: "core-note",
    name: "Setup Notes",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [-1360, 40],
  },
  {
    parameters: { inputSource: "passthrough" },
    id: "core-trigger",
    name: "When Called by Platform",
    type: "n8n-nodes-base.executeWorkflowTrigger",
    typeVersion: 1.1,
    position: [-1360, 460],
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `SELECT
  c."chatbotId",
  c."userId",
  c."model",
  c."systemPrompt",
  c."temperature",
  c."maxTokens",
  c."chatbotMode",
  u."plan",
  u."creditsBalance",
  ec."productSheetUrl",
  ec."productSheetName"
FROM "Chatbot" c
JOIN "User" u ON c."userId" = u."userId"
LEFT JOIN "EcommerceConfig" ec ON ec."chatbotId" = c."chatbotId"
WHERE c."chatbotId" = '{{ $('When Called by Platform').item.json.chatbotId }}'
LIMIT 1;`,
      options: {},
    },
    id: "core-fetch-config",
    name: "Fetch Bot Config",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [-1140, 460],
    credentials: PG,
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `INSERT INTO "ChatSession" ("id","chatbotId","sessionId","platform","isActive","createdAt","updatedAt")
VALUES (
  gen_random_uuid()::text,
  '{{ $('When Called by Platform').item.json.chatbotId }}',
  '{{ $('When Called by Platform').item.json.sessionId }}',
  '{{ $('When Called by Platform').item.json.platform || 'web' }}',
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("chatbotId","sessionId") DO UPDATE SET "updatedAt" = NOW();`,
      options: {},
    },
    id: "core-ensure-session",
    name: "Ensure Session",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [-920, 460],
    credentials: PG,
  },
  {
    parameters: {
      rules: {
        values: [
          {
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
              conditions: [
                {
                  id: "mr-text",
                  leftValue: "={{ $('When Called by Platform').item.json.mediaType }}",
                  rightValue: "image",
                  operator: { type: "string", operation: "notEquals" },
                },
                {
                  id: "mr-text2",
                  leftValue: "={{ $('When Called by Platform').item.json.mediaType }}",
                  rightValue: "audio",
                  operator: { type: "string", operation: "notEquals" },
                },
              ],
              combinator: "and",
            },
            renameOutput: true,
            outputKey: "Text",
          },
          {
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
              conditions: [
                {
                  id: "mr-image",
                  leftValue: "={{ $('When Called by Platform').item.json.mediaType }}",
                  rightValue: "image",
                  operator: { type: "string", operation: "equals" },
                },
              ],
              combinator: "and",
            },
            renameOutput: true,
            outputKey: "Image",
          },
          {
            conditions: {
              options: { caseSensitive: true, leftValue: "", typeValidation: "loose", version: 2 },
              conditions: [
                {
                  id: "mr-audio",
                  leftValue: "={{ $('When Called by Platform').item.json.mediaType }}",
                  rightValue: "audio",
                  operator: { type: "string", operation: "equals" },
                },
              ],
              combinator: "and",
            },
            renameOutput: true,
            outputKey: "Audio",
          },
        ],
      },
      options: {},
    },
    id: "core-media-router",
    name: "Media Router",
    type: "n8n-nodes-base.switch",
    typeVersion: 3.4,
    position: [-700, 460],
  },
  // Text branch
  {
    parameters: {
      assignments: {
        assignments: [
          {
            id: "rm-text",
            name: "resolvedMessage",
            type: "string",
            value: "={{ $('When Called by Platform').item.json.userMessage }}",
          },
        ],
      },
      options: {},
    },
    id: "core-text-msg",
    name: "Text Message",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [-460, 300],
  },
  // Image branch
  {
    parameters: {
      url: "={{ $('When Called by Platform').item.json.mediaUrl }}",
      options: { response: { response: { responseFormat: "file", outputPropertyName: "data" } } },
    },
    id: "core-dl-image",
    name: "Download Image",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [-460, 460],
  },
  {
    parameters: {
      method: "POST",
      url: "=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "x-goog-api-key", value: "={{ $env.GOOGLE_GEMINI_API_KEY }}" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "contents": [ { "parts": [ { "text": "Extract all readable text (OCR) and list the key visual attributes (product type, colour, brand) in this image. Be concise." }, { "inline_data": { "mime_type": {{ JSON.stringify($binary.data.mimeType) }}, "data": {{ JSON.stringify($binary.data.data) }} } } ] } ] }',
      options: {},
    },
    id: "core-vision",
    name: "Gemini Vision",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [-260, 460],
  },
  {
    parameters: {
      assignments: {
        assignments: [
          {
            id: "rm-image",
            name: "resolvedMessage",
            type: "string",
            value:
              "={{ ($('When Called by Platform').item.json.userMessage || '') + '\\n[Image content]: ' + ($json.candidates?.[0]?.content?.parts?.[0]?.text || '') }}",
          },
        ],
      },
      options: {},
    },
    id: "core-set-image",
    name: "Set Image Message",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [-60, 460],
  },
  // Audio branch
  {
    parameters: {
      url: "={{ $('When Called by Platform').item.json.mediaUrl }}",
      options: { response: { response: { responseFormat: "file", outputPropertyName: "data" } } },
    },
    id: "core-dl-audio",
    name: "Download Audio",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [-460, 640],
  },
  {
    parameters: {
      method: "POST",
      url: "=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "x-goog-api-key", value: "={{ $env.GOOGLE_GEMINI_API_KEY }}" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "contents": [ { "parts": [ { "text": "Transcribe this audio to text verbatim. Return only the transcript." }, { "inline_data": { "mime_type": {{ JSON.stringify($binary.data.mimeType) }}, "data": {{ JSON.stringify($binary.data.data) }} } } ] } ] }',
      options: {},
    },
    id: "core-transcribe",
    name: "Gemini Transcribe",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [-260, 640],
  },
  {
    parameters: {
      assignments: {
        assignments: [
          {
            id: "rm-audio",
            name: "resolvedMessage",
            type: "string",
            value: "={{ $json.candidates?.[0]?.content?.parts?.[0]?.text || '' }}",
          },
        ],
      },
      options: {},
    },
    id: "core-set-audio",
    name: "Set Audio Message",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [-60, 640],
  },
  // Converge
  {
    parameters: {},
    id: "core-merge-media",
    name: "Merge Media",
    type: "n8n-nodes-base.noOp",
    typeVersion: 1,
    position: [180, 460],
  },
  {
    parameters: {
      method: "POST",
      url: "=https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "x-goog-api-key", value: "={{ $env.GOOGLE_GEMINI_API_KEY }}" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "model": "models/gemini-embedding-001", "content": { "parts": [ { "text": {{ JSON.stringify($(\'Merge Media\').item.json.resolvedMessage) }} } ] } }',
      options: {},
    },
    id: "core-embed",
    name: "Embed Query",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [400, 460],
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `SELECT content
FROM "Chunk"
WHERE embedding IS NOT NULL
  AND (
    "chatbotId" = '{{ $('When Called by Platform').item.json.chatbotId }}'
    OR metadata->>'chatbotId' = '{{ $('When Called by Platform').item.json.chatbotId }}'
  )
ORDER BY embedding <=> '[{{ $json.embedding.values.join(',') }}]'::vector
LIMIT 5;`,
      options: {},
    },
    id: "core-rag",
    name: "RAG Search",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [620, 460],
    credentials: PG,
  },
  {
    parameters: {
      jsCode:
        "const rows = $input.all();\n" +
        "const ctx = rows.map(r => r.json.content).filter(Boolean).join('\\n\\n---\\n\\n');\n" +
        "return [{ json: { knowledgeContext: ctx, resolvedMessage: $('Merge Media').item.json.resolvedMessage } }];",
    },
    id: "core-build-context",
    name: "Build Context",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [840, 460],
  },
  {
    parameters: {
      promptType: "define",
      text: "={{ $json.resolvedMessage }}",
      options: { systemMessage: CORE_SYSTEM },
    },
    id: "core-agent",
    name: "AI Agent",
    type: "@n8n/n8n-nodes-langchain.agent",
    typeVersion: 1.7,
    position: [1060, 460],
  },
  {
    parameters: {
      model: "={{ $('Fetch Bot Config').item.json.model }}",
      options: {
        maxTokens: "={{ $('Fetch Bot Config').item.json.maxTokens }}",
        temperature: "={{ $('Fetch Bot Config').item.json.temperature }}",
      },
    },
    id: "core-openrouter",
    name: "OpenRouter Chat Model",
    type: "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
    typeVersion: 1,
    position: [900, 720],
    credentials: OR,
  },
  {
    parameters: {
      sessionIdType: "customKey",
      sessionKey: "={{ $('When Called by Platform').item.json.sessionId }}",
      contextWindowLength: 20,
    },
    id: "core-memory",
    name: "Postgres Chat Memory",
    type: "@n8n/n8n-nodes-langchain.memoryPostgresChat",
    typeVersion: 1.3,
    position: [1060, 720],
    credentials: PG,
  },
  {
    parameters: {
      descriptionType: "manual",
      toolDescription:
        "Look up LIVE product catalogue info (name, price, stock, colours, sizes, description, images) for this store. ALWAYS call before answering any product question.",
      operation: "executeQuery",
      query:
        `SELECT "productId","name","description","price","currency","stock","variants","imageUrl","imageUrls"
FROM "Product"
WHERE "chatbotId" = '{{ $('When Called by Platform').item.json.chatbotId }}'
  AND "isActive" = true
  AND (
    "name" ILIKE '%' || '{{ $fromAI('product_name', 'the product name or keyword the customer asked about', 'string') }}' || '%'
    OR "description" ILIKE '%' || '{{ $fromAI('product_name', 'the product name or keyword the customer asked about', 'string') }}' || '%'
  )
LIMIT 10;`,
      options: {},
    },
    id: "core-tool-product",
    name: "Product Lookup",
    type: "n8n-nodes-base.postgresTool",
    typeVersion: 2.6,
    position: [1220, 720],
    credentials: PG,
  },
  {
    parameters: {
      descriptionType: "manual",
      toolDescription:
        "Create a confirmed customer order. Call ONLY when items, quantity, customer name, phone and full delivery address are all known and confirmed.",
      operation: "executeQuery",
      query:
        `INSERT INTO "Order" ("id","orderId","chatbotId","sessionId","customerName","customerPhone","deliveryAddress","district","items","totalAmount","paymentMethod","paymentStatus","status","createdAt","updatedAt")
VALUES (
  gen_random_uuid()::text,
  'ORD-' || upper(substring(md5(random()::text) from 1 for 6)),
  '{{ $('When Called by Platform').item.json.chatbotId }}',
  '{{ $('When Called by Platform').item.json.sessionId }}',
  '{{ $fromAI('customer_name', 'customer full name', 'string') }}',
  '{{ $fromAI('customer_phone', 'customer phone number', 'string') }}',
  '{{ $fromAI('delivery_address', 'full delivery address', 'string') }}',
  '{{ $fromAI('district', 'district or city, empty string if unknown', 'string') }}',
  '{{ $fromAI('items_json', 'a JSON array string of ordered items, each an object with name, qty and price', 'string') }}'::jsonb,
  {{ $fromAI('total_amount', 'the total order amount as a number', 'number') }},
  'COD',
  'pending',
  'Processing',
  NOW(),
  NOW()
)
RETURNING "orderId";`,
      options: {},
    },
    id: "core-tool-order",
    name: "Create Order",
    type: "n8n-nodes-base.postgresTool",
    typeVersion: 2.6,
    position: [1380, 720],
    credentials: PG,
  },
  {
    parameters: {
      jsCode:
        "const raw = String($json.output || '');\n" +
        "const imgs = [];\n" +
        "const re = /\\[IMG\\]\\s*(\\S+)/g;\n" +
        "let m;\n" +
        "while ((m = re.exec(raw)) !== null) { imgs.push(m[1]); }\n" +
        "const replyText = raw.replace(/\\[IMG\\]\\s*\\S+/g, '').replace(/\\n{3,}/g, '\\n\\n').trim();\n" +
        "return [{ json: { replyText, galleryImages: imgs } }];",
    },
    id: "core-format",
    name: "Format Response",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [1280, 460],
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `SELECT EXISTS(
  SELECT 1 FROM "Order"
  WHERE "chatbotId" = '{{ $('When Called by Platform').item.json.chatbotId }}'
    AND "sessionId" = '{{ $('When Called by Platform').item.json.sessionId }}'
    AND "createdAt" > NOW() - INTERVAL '2 minutes'
) AS "isOrderCreated";`,
      options: {},
    },
    id: "core-order-check",
    name: "Order Created Check",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [1500, 460],
    credentials: PG,
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `UPDATE "ChatSession"
SET "lastMessage" = '{{ $('Format Response').item.json.replyText.replace(/'/g, "''").slice(0, 500) }}',
    "updatedAt" = NOW()
WHERE "chatbotId" = '{{ $('When Called by Platform').item.json.chatbotId }}'
  AND "sessionId" = '{{ $('When Called by Platform').item.json.sessionId }}';

INSERT INTO "ChatMessage" ("id","chatbotId","userId","sessionId","role","content","timestamp")
VALUES
  (gen_random_uuid()::text, '{{ $('When Called by Platform').item.json.chatbotId }}', '{{ $('Fetch Bot Config').item.json.userId }}', '{{ $('When Called by Platform').item.json.sessionId }}', 'user', '{{ $('Merge Media').item.json.resolvedMessage.replace(/'/g, "''") }}', NOW() - INTERVAL '1 second'),
  (gen_random_uuid()::text, '{{ $('When Called by Platform').item.json.chatbotId }}', '{{ $('Fetch Bot Config').item.json.userId }}', '{{ $('When Called by Platform').item.json.sessionId }}', 'assistant', '{{ $('Format Response').item.json.replyText.replace(/'/g, "''") }}', NOW());

UPDATE "User"
SET "creditsBalance" = CASE WHEN "plan" = 'enterprise' THEN "creditsBalance" ELSE GREATEST(0, "creditsBalance" - 15) END,
    "creditsUsedThisCycle" = CASE WHEN "plan" = 'enterprise' THEN "creditsUsedThisCycle" ELSE "creditsUsedThisCycle" + 15 END
WHERE "userId" = '{{ $('Fetch Bot Config').item.json.userId }}';`,
      options: {},
    },
    id: "core-log",
    name: "Log Chat & Billing",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [1720, 460],
    credentials: PG,
  },
  {
    parameters: {
      assignments: {
        assignments: [
          { id: "out-reply", name: "replyText", type: "string", value: "={{ $('Format Response').item.json.replyText }}" },
          { id: "out-gallery", name: "galleryImages", type: "array", value: "={{ $('Format Response').item.json.galleryImages }}" },
          { id: "out-order", name: "isOrderCreated", type: "boolean", value: "={{ $('Order Created Check').item.json.isOrderCreated }}" },
        ],
      },
      options: {},
    },
    id: "core-return",
    name: "Return to Platform",
    type: "n8n-nodes-base.set",
    typeVersion: 3.4,
    position: [1940, 460],
  },
];

const coreConnections = {
  "When Called by Platform": { main: [t(["Fetch Bot Config"])] },
  "Fetch Bot Config": { main: [t(["Ensure Session"])] },
  "Ensure Session": { main: [t(["Media Router"])] },
  "Media Router": {
    main: [t(["Text Message"]), t(["Download Image"]), t(["Download Audio"])],
  },
  "Text Message": { main: [t(["Merge Media"])] },
  "Download Image": { main: [t(["Gemini Vision"])] },
  "Gemini Vision": { main: [t(["Set Image Message"])] },
  "Set Image Message": { main: [t(["Merge Media"])] },
  "Download Audio": { main: [t(["Gemini Transcribe"])] },
  "Gemini Transcribe": { main: [t(["Set Audio Message"])] },
  "Set Audio Message": { main: [t(["Merge Media"])] },
  "Merge Media": { main: [t(["Embed Query"])] },
  "Embed Query": { main: [t(["RAG Search"])] },
  "RAG Search": { main: [t(["Build Context"])] },
  "Build Context": { main: [t(["AI Agent"])] },
  "AI Agent": { main: [t(["Format Response"])] },
  "Format Response": { main: [t(["Order Created Check"])] },
  "Order Created Check": { main: [t(["Log Chat & Billing"])] },
  "Log Chat & Billing": { main: [t(["Return to Platform"])] },
  "OpenRouter Chat Model": { ai_languageModel: [t(["AI Agent"], "ai_languageModel")] },
  "Postgres Chat Memory": { ai_memory: [t(["AI Agent"], "ai_memory")] },
  "Product Lookup": { ai_tool: [t(["AI Agent"], "ai_tool")] },
  "Create Order": { ai_tool: [t(["AI Agent"], "ai_tool")] },
};

fs.writeFileSync(
  path.join(OUT, "Core-AI-Brain.json"),
  JSON.stringify(wf("Core-AI-Brain", coreNodes, coreConnections), null, 2)
);

// ===========================================================================
// SHARED HELPERS FOR PLATFORM HANDLERS (lightweight — they call Core Brain)
// ===========================================================================
// Resource locator pointing at the Core AI Brain sub-workflow. The user pastes
// the real workflow ID once after importing Core-AI-Brain.json.
const CORE_RL = {
  __rl: true,
  mode: "list",
  value: "REPLACE_WITH_CORE_AI_BRAIN_WORKFLOW_ID",
  cachedResultName: "Core-AI-Brain",
};

const execCore = (idp, pos) => ({
  parameters: { source: "database", workflowId: CORE_RL, options: { waitForSubWorkflow: true } },
  id: idp + "-exec",
  name: "Execute Core AI Brain",
  type: "n8n-nodes-base.executeWorkflow",
  typeVersion: 1.2,
  position: pos,
});

// Meta webhook GET-verification + POST-ack trio (shared by FB / WA / IG).
const metaVerifyNodes = (idp, path, token, bx, by) => {
  const P = (dx, dy) => [bx + dx, by + dy];
  return [
    {
      parameters: { multipleMethods: true, path, responseMode: "responseNode", options: {} },
      id: idp + "-webhook",
      name: "Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2.1,
      position: P(0, 0),
      webhookId: path,
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 1 },
          conditions: [
            { id: "v-mode", leftValue: "={{ $json.query['hub.mode'] }}", rightValue: "subscribe", operator: { type: "string", operation: "equals" } },
            { id: "v-token", leftValue: "={{ $json.query['hub.verify_token'] }}", rightValue: token, operator: { type: "string", operation: "equals" } },
          ],
          combinator: "and",
        },
        options: {},
      },
      id: idp + "-verify",
      name: "If Webhook Verify",
      type: "n8n-nodes-base.if",
      typeVersion: 2,
      position: P(220, -140),
    },
    {
      parameters: { respondWith: "text", responseBody: "={{ $json.query['hub.challenge'] }}", options: { responseCode: 200 } },
      id: idp + "-challenge",
      name: "Return hub.challenge",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: P(440, -140),
    },
    {
      parameters: { respondWith: "text", responseBody: "EVENT_RECEIVED", options: { responseCode: 200 } },
      id: idp + "-ack",
      name: "Respond 200 to Meta",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.1,
      position: P(220, 140),
    },
  ];
};

// A Set node that shapes the Core Brain input contract from prior nodes.
const brainPayloadNode = (idp, platform, normNode, senderField, pos) => ({
  parameters: {
    assignments: {
      assignments: [
        { id: "bp-cb", name: "chatbotId", type: "string", value: "={{ $('Fetch Integration').item.json.chatbotId }}" },
        { id: "bp-sid", name: "sessionId", type: "string", value: "={{ $('" + normNode + "').item.json.sessionId }}" },
        { id: "bp-plat", name: "platform", type: "string", value: platform },
        { id: "bp-msg", name: "userMessage", type: "string", value: "={{ $('" + normNode + "').item.json.userMessage }}" },
        { id: "bp-mt", name: "mediaType", type: "string", value: "={{ $('" + normNode + "').item.json.mediaType }}" },
        { id: "bp-mu", name: "mediaUrl", type: "string", value: "={{ $('" + normNode + "').item.json.mediaUrl }}" },
        { id: "bp-ci", name: "customerInfo", type: "object", value: "={{ { \"name\": \"\", \"platformUserId\": $('" + normNode + "').item.json." + senderField + " } }}" },
      ],
    },
    options: {},
  },
  id: idp + "-payload",
  name: "Build Brain Payload",
  type: "n8n-nodes-base.set",
  typeVersion: 3.4,
  position: pos,
});

// Guard: Integration row exists (postgres emits no item if not) AND connected.
const guardNode = (idp, pos) => ({
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 1 },
      conditions: [
        { id: "g-conn", leftValue: "={{ $('Fetch Integration').item.json.connected }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } },
        { id: "g-cb", leftValue: "={{ $('Fetch Integration').item.json.chatbotId }}", rightValue: "", operator: { type: "string", operation: "exists", singleValue: true } },
      ],
      combinator: "and",
    },
    options: {},
  },
  id: idp + "-guard",
  name: "Guard Active",
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position: pos,
});

const setupNote = (idp, text, pos, w = 420, h = 300) => ({
  parameters: { content: text, height: h, width: w },
  id: idp + "-note",
  name: "Setup Notes",
  type: "n8n-nodes-base.stickyNote",
  typeVersion: 1,
  position: pos,
});

// ===========================================================================
// 2) FACEBOOK INTEGRATION  (Messenger DMs + Page comments)
// ===========================================================================
const fbNormalize = [
  "const body = $json.body || $json;",
  "const entry = body && body.entry && body.entry[0];",
  "if (!entry) return [];",
  "const pageId = entry.id;",
  "const messaging = entry.messaging && entry.messaging[0];",
  "const change = entry.changes && entry.changes[0];",
  "",
  "// ── Messenger direct message ──",
  "if (messaging) {",
  "  const msg = messaging.message || {};",
  "  if (msg.is_echo) return [];",
  "  const senderId = messaging.sender && messaging.sender.id;",
  "  if (!senderId) return [];",
  "  let userMessage = msg.text || '';",
  "  let mediaType = 'text';",
  "  let mediaUrl = '';",
  "  const att = msg.attachments && msg.attachments[0];",
  "  if (att && att.type === 'image') { mediaType = 'image'; mediaUrl = (att.payload && att.payload.url) || ''; }",
  "  else if (att && att.type === 'audio') { mediaType = 'audio'; mediaUrl = (att.payload && att.payload.url) || ''; }",
  "  if (!userMessage && mediaType === 'text') return [];",
  "  return [{ json: { pageId, senderId, isComment: false, commentId: '', sessionId: 'fb_' + senderId, userMessage, mediaType, mediaUrl } }];",
  "}",
  "",
  "// ── Page feed comment ──",
  "if (change && change.field === 'feed' && change.value && change.value.item === 'comment' && change.value.verb === 'add') {",
  "  const v = change.value;",
  "  const fromId = (v.from && v.from.id) || '';",
  "  if (!fromId || fromId === pageId) return [];",
  "  if (!v.message) return [];",
  "  return [{ json: { pageId, senderId: fromId, isComment: true, commentId: v.comment_id || '', sessionId: 'fbc_' + (v.comment_id || fromId), userMessage: v.message, mediaType: 'text', mediaUrl: '' } }];",
  "}",
  "",
  "return [];",
].join("\n");

const fbNodes = [
  setupNote(
    "fb",
    "## Facebook Integration (lightweight handler)\n" +
      "Verifies Meta webhook, resolves `pageId → chatbotId`, calls **Core AI Brain**, then sends the reply.\n\n" +
      "### Setup\n" +
      "1. Open **Execute Core AI Brain** and select the imported *Core-AI-Brain* workflow.\n" +
      "2. Meta webhook Verify Token: `driplare_n8n_facebook_secret_2026`.\n" +
      "3. Subscribe the Page to `messages`, `messaging_postbacks`, `feed`.\n" +
      "4. Integration.config must hold `pageId` + `pageAccessToken`.",
    [-1360, -60],
    440,
    280
  ),
  ...metaVerifyNodes("fb", "driplare-facebook", "driplare_n8n_facebook_secret_2026", -1360, 460),
  {
    parameters: { jsCode: fbNormalize },
    id: "fb-normalize",
    name: "Normalize FB Payload",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-1060, 600],
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `SELECT
  c."chatbotId",
  i."connected",
  i."status",
  i.config->>'pageId' AS "pageId",
  i.config->>'pageAccessToken' AS "pageAccessToken"
FROM "Integration" i
JOIN "Chatbot" c ON i."chatbotId" = c."chatbotId"
WHERE i.platform = 'facebook'
  AND i."connected" = true
  AND i.config->>'pageId' = '{{ $('Normalize FB Payload').item.json.pageId }}'
LIMIT 1;`,
      options: {},
    },
    id: "fb-fetch",
    name: "Fetch Integration",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [-840, 600],
    credentials: PG,
  },
  guardNode("fb", [-620, 600]),
  brainPayloadNode("fb", "facebook", "Normalize FB Payload", "senderId", [-400, 600]),
  execCore("fb", [-180, 600]),
  {
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: "", typeValidation: "strict", version: 1 },
        conditions: [
          { id: "rt-comment", leftValue: "={{ $('Normalize FB Payload').item.json.isComment }}", rightValue: true, operator: { type: "boolean", operation: "true", singleValue: true } },
        ],
        combinator: "and",
      },
      options: {},
    },
    id: "fb-route",
    name: "Route Reply Type",
    type: "n8n-nodes-base.if",
    typeVersion: 2,
    position: [40, 600],
  },
  {
    parameters: {
      method: "POST",
      url: "={{ 'https://graph.facebook.com/v20.0/' + $('Normalize FB Payload').item.json.commentId + '/comments?access_token=' + $('Fetch Integration').item.json.pageAccessToken }}",
      sendBody: true,
      specifyBody: "json",
      jsonBody: '={ "message": {{ JSON.stringify($(\'Execute Core AI Brain\').item.json.replyText) }} }',
      options: {},
    },
    id: "fb-send-comment",
    name: "Send Comment Reply",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [260, 440],
    continueOnFail: true,
  },
  {
    parameters: {
      method: "POST",
      url: "={{ 'https://graph.facebook.com/v20.0/' + $('Fetch Integration').item.json.pageId + '/messages?access_token=' + $('Fetch Integration').item.json.pageAccessToken }}",
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "recipient": { "id": {{ JSON.stringify($(\'Normalize FB Payload\').item.json.senderId) }} }, "messaging_type": "RESPONSE", "message": { "text": {{ JSON.stringify($(\'Execute Core AI Brain\').item.json.replyText) }} } }',
      options: {},
    },
    id: "fb-send-text",
    name: "Send DM Text",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [260, 640],
    continueOnFail: true,
  },
  {
    parameters: { fieldToSplitOut: "galleryImages", options: {} },
    id: "fb-split",
    name: "Split Gallery",
    type: "n8n-nodes-base.splitOut",
    typeVersion: 1,
    position: [260, 800],
  },
  {
    parameters: {
      method: "POST",
      url: "={{ 'https://graph.facebook.com/v20.0/' + $('Fetch Integration').item.json.pageId + '/messages?access_token=' + $('Fetch Integration').item.json.pageAccessToken }}",
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "recipient": { "id": {{ JSON.stringify($(\'Normalize FB Payload\').item.json.senderId) }} }, "message": { "attachment": { "type": "image", "payload": { "url": {{ JSON.stringify($json.galleryImages) }}, "is_reusable": false } } } }',
      options: {},
    },
    id: "fb-send-image",
    name: "Send DM Image",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [480, 800],
    continueOnFail: true,
  },
];

const fbConnections = {
  Webhook: { main: [t(["If Webhook Verify"]), t(["Respond 200 to Meta", "Normalize FB Payload"])] },
  "If Webhook Verify": { main: [t(["Return hub.challenge"])] },
  "Normalize FB Payload": { main: [t(["Fetch Integration"])] },
  "Fetch Integration": { main: [t(["Guard Active"])] },
  "Guard Active": { main: [t(["Build Brain Payload"])] },
  "Build Brain Payload": { main: [t(["Execute Core AI Brain"])] },
  "Execute Core AI Brain": { main: [t(["Route Reply Type"])] },
  "Route Reply Type": { main: [t(["Send Comment Reply"]), t(["Send DM Text", "Split Gallery"])] },
  "Split Gallery": { main: [t(["Send DM Image"])] },
};

fs.writeFileSync(
  path.join(OUT, "Facebook-Integration.json"),
  JSON.stringify(wf("Facebook-Integration", fbNodes, fbConnections), null, 2)
);

// ===========================================================================
// 3) WHATSAPP INTEGRATION  (WhatsApp Cloud API)
// ===========================================================================
const waNormalize = [
  "const body = $json.body || $json;",
  "const entry = body && body.entry && body.entry[0];",
  "const change = entry && entry.changes && entry.changes[0];",
  "const value = change && change.value;",
  "if (!value) return [];",
  "const msg = value.messages && value.messages[0];",
  "if (!msg) return []; // delivery/read status callbacks — ignore",
  "const phoneNumberId = value.metadata && value.metadata.phone_number_id;",
  "const from = msg.from;",
  "if (!from || !phoneNumberId) return [];",
  "const profileName = (value.contacts && value.contacts[0] && value.contacts[0].profile && value.contacts[0].profile.name) || '';",
  "",
  "let userMessage = '';",
  "// NOTE: WhatsApp inbound media arrives as an ID that needs a token-authenticated",
  "// GET /{mediaId} + download. The generic Core Brain download is unauthenticated,",
  "// so media is handled as a graceful text fallback here (see Setup Notes).",
  "let mediaType = 'text';",
  "let mediaUrl = '';",
  "if (msg.type === 'text') {",
  "  userMessage = (msg.text && msg.text.body) || '';",
  "} else if (msg.type === 'image') {",
  "  const caption = (msg.image && msg.image.caption) || '';",
  "  userMessage = (caption ? caption + ' ' : '') + '[Customer sent an image on WhatsApp. Politely ask them to describe it or send details as text.]';",
  "} else if (msg.type === 'audio' || msg.type === 'voice') {",
  "  userMessage = '[Customer sent a voice message on WhatsApp. Politely ask them to type their question.]';",
  "} else if (msg.type === 'button' || msg.type === 'interactive') {",
  "  userMessage = (msg.button && msg.button.text) || (msg.interactive && msg.interactive.button_reply && msg.interactive.button_reply.title) || (msg.interactive && msg.interactive.list_reply && msg.interactive.list_reply.title) || '';",
  "} else {",
  "  userMessage = '[Customer sent an unsupported message type. Ask them to send text.]';",
  "}",
  "if (!userMessage) return [];",
  "return [{ json: { phoneNumberId, from, sessionId: 'wa_' + from, userMessage, mediaType, mediaUrl, profileName } }];",
].join("\n");

const waNodes = [
  setupNote(
    "wa",
    "## WhatsApp Integration (lightweight handler)\n" +
      "Verifies Meta webhook, resolves `phone_number_id → chatbotId`, calls **Core AI Brain**, sends via WhatsApp Cloud API.\n\n" +
      "### Setup\n" +
      "1. Open **Execute Core AI Brain** and select the imported *Core-AI-Brain* workflow.\n" +
      "2. Verify Token: `driplare_n8n_whatsapp_secret_2026`.\n" +
      "3. Integration.config must hold `phoneNumberId` + `accessToken`.\n\n" +
      "### Known limitation\n" +
      "Inbound WhatsApp media (image/voice) is a token-gated media ID, not a public URL, so it is handled as a **text fallback**. Full media needs a `GET /{mediaId}` + authenticated download step.",
    [-1360, -80],
    460,
    340
  ),
  ...metaVerifyNodes("wa", "driplare-whatsapp", "driplare_n8n_whatsapp_secret_2026", -1360, 460),
  {
    parameters: { jsCode: waNormalize },
    id: "wa-normalize",
    name: "Normalize WhatsApp Payload",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-1060, 600],
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `SELECT
  c."chatbotId",
  i."connected",
  i."status",
  i.config->>'phoneNumberId' AS "phoneNumberId",
  i.config->>'accessToken' AS "accessToken",
  i.config->>'wabaId' AS "wabaId"
FROM "Integration" i
JOIN "Chatbot" c ON i."chatbotId" = c."chatbotId"
WHERE i.platform = 'whatsapp'
  AND i."connected" = true
  AND i.config->>'phoneNumberId' = '{{ $('Normalize WhatsApp Payload').item.json.phoneNumberId }}'
LIMIT 1;`,
      options: {},
    },
    id: "wa-fetch",
    name: "Fetch Integration",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [-840, 600],
    credentials: PG,
  },
  guardNode("wa", [-620, 600]),
  brainPayloadNode("wa", "whatsapp", "Normalize WhatsApp Payload", "from", [-400, 600]),
  execCore("wa", [-180, 600]),
  {
    parameters: {
      method: "POST",
      url: "={{ 'https://graph.facebook.com/v20.0/' + $('Fetch Integration').item.json.phoneNumberId + '/messages' }}",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Authorization", value: "={{ 'Bearer ' + $('Fetch Integration').item.json.accessToken }}" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "messaging_product": "whatsapp", "recipient_type": "individual", "to": {{ JSON.stringify($(\'Normalize WhatsApp Payload\').item.json.from) }}, "type": "text", "text": { "preview_url": true, "body": {{ JSON.stringify($(\'Execute Core AI Brain\').item.json.replyText) }} } }',
      options: {},
    },
    id: "wa-send-text",
    name: "Send WhatsApp Text",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [40, 520],
    continueOnFail: true,
  },
  {
    parameters: { fieldToSplitOut: "galleryImages", options: {} },
    id: "wa-split",
    name: "Split Gallery",
    type: "n8n-nodes-base.splitOut",
    typeVersion: 1,
    position: [40, 720],
  },
  {
    parameters: {
      method: "POST",
      url: "={{ 'https://graph.facebook.com/v20.0/' + $('Fetch Integration').item.json.phoneNumberId + '/messages' }}",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Authorization", value: "={{ 'Bearer ' + $('Fetch Integration').item.json.accessToken }}" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "messaging_product": "whatsapp", "recipient_type": "individual", "to": {{ JSON.stringify($(\'Normalize WhatsApp Payload\').item.json.from) }}, "type": "image", "image": { "link": {{ JSON.stringify($json.galleryImages) }} } }',
      options: {},
    },
    id: "wa-send-image",
    name: "Send WhatsApp Image",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [260, 720],
    continueOnFail: true,
  },
];

const waConnections = {
  Webhook: { main: [t(["If Webhook Verify"]), t(["Respond 200 to Meta", "Normalize WhatsApp Payload"])] },
  "If Webhook Verify": { main: [t(["Return hub.challenge"])] },
  "Normalize WhatsApp Payload": { main: [t(["Fetch Integration"])] },
  "Fetch Integration": { main: [t(["Guard Active"])] },
  "Guard Active": { main: [t(["Build Brain Payload"])] },
  "Build Brain Payload": { main: [t(["Execute Core AI Brain"])] },
  "Execute Core AI Brain": { main: [t(["Send WhatsApp Text", "Split Gallery"])] },
  "Split Gallery": { main: [t(["Send WhatsApp Image"])] },
};

fs.writeFileSync(
  path.join(OUT, "WhatsApp-Integration.json"),
  JSON.stringify(wf("WhatsApp-Integration", waNodes, waConnections), null, 2)
);

// ===========================================================================
// 4) INSTAGRAM INTEGRATION  (IG Messaging + Comments)
// ===========================================================================
const igNormalize = [
  "const meta = $json.body || $json;",
  "const entry = meta && meta.entry && meta.entry[0];",
  "if (!entry) return [];",
  "const messaging = entry.messaging && entry.messaging[0];",
  "const changeValue = entry.changes && entry.changes[0] && entry.changes[0].value;",
  "",
  "const instagramAccountId = entry.id || (messaging && messaging.recipient && messaging.recipient.id) || (changeValue && changeValue.recipient && changeValue.recipient.id);",
  "const senderId = (messaging && messaging.sender && messaging.sender.id) || (changeValue && changeValue.sender && changeValue.sender.id) || (changeValue && changeValue.from && changeValue.from.id);",
  "",
  "const msg = (messaging && messaging.message) || {};",
  "let userMessage = msg.text || (changeValue && changeValue.message && changeValue.message.text) || (changeValue && changeValue.text) || '';",
  "let mediaType = 'text';",
  "let mediaUrl = '';",
  "const att = msg.attachments && msg.attachments[0];",
  "if (att && att.type === 'image') { mediaType = 'image'; mediaUrl = (att.payload && att.payload.url) || ''; }",
  "else if (att && att.type === 'audio') { mediaType = 'audio'; mediaUrl = (att.payload && att.payload.url) || ''; }",
  "",
  "const isEcho = Boolean(msg.is_echo || (changeValue && changeValue.message && changeValue.message.is_echo));",
  "const isDeleted = Boolean(msg.is_deleted);",
  "if (!instagramAccountId || !senderId || isEcho || isDeleted) return [];",
  "if (!userMessage && mediaType === 'text') return [];",
  "return [{ json: { instagramAccountId, senderId, sessionId: 'ig_' + senderId, userMessage, mediaType, mediaUrl } }];",
].join("\n");

const igNodes = [
  setupNote(
    "ig",
    "## Instagram Integration (lightweight handler)\n" +
      "Verifies Meta webhook, resolves `instagramAccountId → chatbotId`, calls **Core AI Brain**, sends via IG Graph API.\n\n" +
      "### Setup\n" +
      "1. Open **Execute Core AI Brain** and select the imported *Core-AI-Brain* workflow.\n" +
      "2. Verify Token: `driplare_n8n_instagram_secret_2026`.\n" +
      "3. Integration.config holds `instagramAccountId`, `connectionSource`, and either\n" +
      "   `instagramAccessToken` (instagram_login) or `pageId` + `pageAccessToken` (facebook_login).",
    [-1360, -80],
    460,
    320
  ),
  ...metaVerifyNodes("ig", "driplare-instagram", "driplare_n8n_instagram_secret_2026", -1360, 460),
  {
    parameters: { jsCode: igNormalize },
    id: "ig-normalize",
    name: "Normalize Instagram Payload",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-1060, 600],
  },
  {
    parameters: {
      operation: "executeQuery",
      query:
        `SELECT
  c."chatbotId",
  i."connected",
  i."status",
  i.config->>'connectionSource' AS "connectionSource",
  i.config->>'pageId' AS "pageId",
  i.config->>'pageAccessToken' AS "pageAccessToken",
  i.config->>'instagramAccessToken' AS "instagramAccessToken",
  i.config->>'instagramAccountId' AS "instagramAccountId"
FROM "Integration" i
JOIN "Chatbot" c ON i."chatbotId" = c."chatbotId"
WHERE i.platform = 'instagram'
  AND i."connected" = true
  AND i.config->>'instagramAccountId' = '{{ $('Normalize Instagram Payload').item.json.instagramAccountId }}'
LIMIT 1;`,
      options: {},
    },
    id: "ig-fetch",
    name: "Fetch Integration",
    type: "n8n-nodes-base.postgres",
    typeVersion: 2,
    position: [-840, 600],
    credentials: PG,
  },
  guardNode("ig", [-620, 600]),
  brainPayloadNode("ig", "instagram", "Normalize Instagram Payload", "senderId", [-400, 600]),
  execCore("ig", [-180, 600]),
  {
    parameters: {
      method: "POST",
      url: "={{ $('Fetch Integration').item.json.connectionSource === 'instagram_login' ? 'https://graph.instagram.com/v20.0/' + $('Fetch Integration').item.json.instagramAccountId + '/messages' : 'https://graph.facebook.com/v20.0/' + $('Fetch Integration').item.json.pageId + '/messages?access_token=' + $('Fetch Integration').item.json.pageAccessToken }}",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Authorization", value: "={{ $('Fetch Integration').item.json.connectionSource === 'instagram_login' ? 'Bearer ' + $('Fetch Integration').item.json.instagramAccessToken : '' }}" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "recipient": { "id": {{ JSON.stringify($(\'Normalize Instagram Payload\').item.json.senderId) }} }, "message": { "text": {{ JSON.stringify($(\'Execute Core AI Brain\').item.json.replyText) }} } }',
      options: {},
    },
    id: "ig-send-text",
    name: "Send Instagram Text",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [40, 520],
    continueOnFail: true,
  },
  {
    parameters: { fieldToSplitOut: "galleryImages", options: {} },
    id: "ig-split",
    name: "Split Gallery",
    type: "n8n-nodes-base.splitOut",
    typeVersion: 1,
    position: [40, 720],
  },
  {
    parameters: {
      method: "POST",
      url: "={{ $('Fetch Integration').item.json.connectionSource === 'instagram_login' ? 'https://graph.instagram.com/v20.0/' + $('Fetch Integration').item.json.instagramAccountId + '/messages' : 'https://graph.facebook.com/v20.0/' + $('Fetch Integration').item.json.pageId + '/messages?access_token=' + $('Fetch Integration').item.json.pageAccessToken }}",
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: "Authorization", value: "={{ $('Fetch Integration').item.json.connectionSource === 'instagram_login' ? 'Bearer ' + $('Fetch Integration').item.json.instagramAccessToken : '' }}" },
          { name: "Content-Type", value: "application/json" },
        ],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        '={ "recipient": { "id": {{ JSON.stringify($(\'Normalize Instagram Payload\').item.json.senderId) }} }, "message": { "attachment": { "type": "image", "payload": { "url": {{ JSON.stringify($json.galleryImages) }} } } } }',
      options: {},
    },
    id: "ig-send-image",
    name: "Send Instagram Image",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [260, 720],
    continueOnFail: true,
  },
];

const igConnections = {
  Webhook: { main: [t(["If Webhook Verify"]), t(["Respond 200 to Meta", "Normalize Instagram Payload"])] },
  "If Webhook Verify": { main: [t(["Return hub.challenge"])] },
  "Normalize Instagram Payload": { main: [t(["Fetch Integration"])] },
  "Fetch Integration": { main: [t(["Guard Active"])] },
  "Guard Active": { main: [t(["Build Brain Payload"])] },
  "Build Brain Payload": { main: [t(["Execute Core AI Brain"])] },
  "Execute Core AI Brain": { main: [t(["Send Instagram Text", "Split Gallery"])] },
  "Split Gallery": { main: [t(["Send Instagram Image"])] },
};

fs.writeFileSync(
  path.join(OUT, "Instagram-Integration.json"),
  JSON.stringify(wf("Instagram-Integration", igNodes, igConnections), null, 2)
);

// ===========================================================================
// 5) SOURCE-FILE-UPLOAD  (reuse the proven ingestion template, add metadata.type)
// ===========================================================================
const srcPath = "c:/Users/User/Projects/DriplareAI/docs/n8n JSON/Source file upload (DriplareAI).json";
const src = JSON.parse(fs.readFileSync(srcPath, "utf8"));
src.name = "Source-File-Upload";
const convNode = src.nodes.find((n) => n.name === "Convert to Documents");
if (convNode && convNode.parameters && convNode.parameters.options && convNode.parameters.options.metadata) {
  const mv = convNode.parameters.options.metadata.metadataValues;
  if (!mv.some((m) => m.name === "type")) {
    mv.push({ name: "type", value: "={{ $('Generate IDs').item.json.type }}" });
  }
}
// Drop instance-specific keys so the file imports cleanly anywhere.
delete src.id;
delete src.versionId;
if (src.meta) delete src.meta.instanceId;
src.meta = { ...(src.meta || {}), templateCredsSetupCompleted: true };
fs.writeFileSync(path.join(OUT, "Source-File-Upload.json"), JSON.stringify(src, null, 2));

console.log("Generated:");
console.log("  Core-AI-Brain.json       ", coreNodes.length, "nodes");
console.log("  Facebook-Integration.json", fbNodes.length, "nodes");
console.log("  WhatsApp-Integration.json", waNodes.length, "nodes");
console.log("  Instagram-Integration.json", igNodes.length, "nodes");
console.log("  Source-File-Upload.json  ", src.nodes.length, "nodes");
