/**
 * Step 6 verification — simulate n8n's expression rendering for the new
 * `Billing API` node's jsonBody, then check the result against the Zod schema
 * declared in app/api/internal/ai-usage/route.ts.
 *
 * Why this matters: `Billing API` has onError=continueRegularOutput, so if an
 * expression renders wrong the request 400s and billing stops SILENTLY — every
 * reply succeeds but no credits are ever charged. That failure mode is
 * invisible in production, so it has to be caught here.
 *
 * Touches no database. Pure string/JSON logic.
 */
const { z } = require("zod");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const wf = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs", "n8n-JSON", "Core-AI-Brain.json"), "utf8")
);
const jsonBody = wf.nodes.find((n) => n.name === "Billing API").parameters.jsonBody;

// ── The schema, copied verbatim from the route ───────────────────────────────
const bodySchema = z.object({
  runId: z.string().min(1).max(128).optional(),
  userId: z.string().min(1).optional(),
  chatbotId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  channel: z.string().min(1).max(32).default("web"),
  modelId: z.string().min(1).max(200),
  promptTokens: z.number().int().min(0).default(0),
  completionTokens: z.number().int().min(0).default(0),
  llmCallCount: z.number().int().min(0).default(0),
  isTestChat: z.boolean().default(false),
  isFreeMessage: z.boolean().default(false),
  tokensAreExact: z.boolean().default(false),
  extra: z
    .object({ image: z.boolean().optional(), audioMinutes: z.number().min(0).optional() })
    .optional(),
});

// ── Minimal n8n expression evaluator ─────────────────────────────────────────
// Replaces every {{ ... }} with the value of `scope` for that exact expression
// source. Anything left unresolved is a hard error: an expression we did not
// account for is exactly the kind of thing that silently 400s in production.
function render(body, scope) {
  const unresolved = [];
  const out = body.replace(/\{\{([\s\S]*?)\}\}/g, (_, expr) => {
    const key = expr.trim();
    if (!(key in scope)) {
      unresolved.push(key);
      return "__UNRESOLVED__";
    }
    return String(scope[key]);
  });
  return { out, unresolved };
}

const template = jsonBody.startsWith("=") ? jsonBody.slice(1) : jsonBody;

// ── Scenarios ────────────────────────────────────────────────────────────────
const WHEN = "$('When Called by Platform').item.json";
const RESP = "$('Format Response').item.json";

// The channel expression is evaluated by n8n as a whole, so the lookup key is
// the full expression source, not its parts. The value is what n8n would
// resolve it to for that scenario.
const CHANNEL_EXPR = `${WHEN}.channel || ${WHEN}.platform || 'web'`;

const scenarios = [
  {
    name: "Web playground (channel পাঠায়)",
    scope: {
      "$execution.id": "4821",
      "$('Fetch Bot Config').item.json.userId": "user_37u0S4kWRW6nk9JiTDk78oHYjTg",
      [`${WHEN}.chatbotId`]: "cm_playground_bot",
      [`${WHEN}.sessionId`]: "sess_web_9f2a",
      [CHANNEL_EXPR]: "playground",
      [`${WHEN}.channel === 'playground'`]: true,
      [`${RESP}.model`]: "anthropic/claude-sonnet-4",
      [`${RESP}.promptTokens`]: 1854,
      [`${RESP}.completionTokens`]: 86,
    },
    expect: { channel: "playground", isTestChat: true, runId: "4821" },
  },
  {
    // Facebook/WhatsApp/Instagram integrations do NOT send `channel` — this is
    // the case that would silently log every social reply as "web".
    name: "Facebook (channel পাঠায় না — শুধু platform)",
    scope: {
      "$execution.id": "4822",
      "$('Fetch Bot Config').item.json.userId": "user_37u0S4kWRW6nk9JiTDk78oHYjTg",
      [`${WHEN}.chatbotId`]: "cm_fb_bot",
      [`${WHEN}.sessionId`]: "sess_fb_1c7d",
      [CHANNEL_EXPR]: "facebook",
      [`${WHEN}.channel === 'playground'`]: false,
      [`${RESP}.model`]: "openai/gpt-4o-mini",
      [`${RESP}.promptTokens`]: 2400,
      [`${RESP}.completionTokens`]: 120,
    },
    expect: { channel: "facebook", isTestChat: false },
  },
  {
    // Neither field present (e.g. a hand-triggered test run). Must not produce
    // "undefined" as a channel — the schema needs a real string.
    name: "দুটোই নেই → 'web'-এ fallback",
    scope: {
      "$execution.id": "4823",
      "$('Fetch Bot Config').item.json.userId": "user_37u0S4kWRW6nk9JiTDk78oHYjTg",
      [`${WHEN}.chatbotId`]: "cm_bot",
      [`${WHEN}.sessionId`]: "sess_x",
      [CHANNEL_EXPR]: "web",
      [`${WHEN}.channel === 'playground'`]: false,
      [`${RESP}.model`]: "google/gemini-2.5-flash-lite",
      [`${RESP}.promptTokens`]: 100,
      [`${RESP}.completionTokens`]: 10,
    },
    expect: { channel: "web", isTestChat: false },
  },
];

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? "  → " + detail : ""}`);
  if (!ok) failures++;
};

for (const s of scenarios) {
  console.log(`\n── ${s.name} ──`);
  const { out, unresolved } = render(template, s.scope);

  check(
    unresolved.length === 0,
    "সব expression রেন্ডার হয়েছে",
    unresolved.length ? "অজানা: " + unresolved.join(", ") : ""
  );
  if (unresolved.length) continue;

  let parsed;
  try {
    parsed = JSON.parse(out);
    check(true, "JSON বৈধ (n8n যেভাবে পাঠাবে)");
  } catch (e) {
    check(false, "JSON বৈধ", e.message);
    console.log(out);
    continue;
  }

  const result = bodySchema.safeParse(parsed);
  check(
    result.success,
    "Zod স্কিমা পাস করেছে",
    result.success ? "" : JSON.stringify(result.error.issues)
  );

  for (const [key, want] of Object.entries(s.expect)) {
    check(parsed[key] === want, `${key} === ${JSON.stringify(want)}`, `পেয়েছি ${JSON.stringify(parsed[key])}`);
  }

  // Types must survive: a string "1854" would fail z.number() and 400.
  for (const k of ["promptTokens", "completionTokens", "llmCallCount"]) {
    check(typeof parsed[k] === "number", `${k} সংখ্যা (string নয়)`, typeof parsed[k]);
  }
  for (const k of ["isTestChat", "isFreeMessage", "tokensAreExact"]) {
    check(typeof parsed[k] === "boolean", `${k} boolean`, typeof parsed[k]);
  }

  console.log("  রেন্ডার করা body:", JSON.stringify(parsed));
}

console.log(
  failures === 0
    ? "\n✅ সব যাচাই পাস — Step 6-এর body নিরাপদ"
    : `\n❌ ${failures}টি যাচাই ব্যর্থ`
);
process.exit(failures === 0 ? 0 : 1);
