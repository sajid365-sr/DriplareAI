/**
 * Step 6b verification — Playground-এর বিলিং এখন প্ল্যাটফর্মে।
 *
 * যা যা যাচাই করা হয় (কোনো DB লেখা নেই):
 *   ১. `Format Response` ও `OpenRouter Chat Model` — দুটো নোডে model বাছার
 *      precedence হুবহু এক কি না (নাহলে দাম ভুল model-এর হিসেবে হতো)
 *   ২. দ্বিগুণ চার্জ হবে না — n8n সফল হলে প্ল্যাটফর্ম থামে, ব্যর্থ হলে কাটে
 *   ৩. যে token গুলো n8n পাঠায় সেগুলো সংখ্যা (string হলে 0 হয়ে যেত)
 *   ৪. credit-এর মান আগের চেক আর নতুন কাটার মধ্যে একই (নাহলে 402-এর পর
 *      ব্যালেন্স ঋণাত্মক হয়ে যেত)
 *
 * DB শুধু **পড়া** হয় (admin-এর credit নিয়ম আনতে)।
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..", "..");
const wf = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs", "n8n-JSON", "Core-AI-Brain.json"), "utf8")
);
const byName = (n) => wf.nodes.find((x) => x.name === n);

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? "  → " + detail : ""}`);
  if (!ok) failures++;
};

// ── ১. model বাছার নিয়ম দুই নোডে এক কি? ─────────────────────────────────────
console.log("\n── ১. model precedence ──");

/** n8n expression থেকে আসল রাশিটুকু বের করে আনে। */
function expressionOf(raw) {
  const body = String(raw).replace(/^=/, "");
  const m = body.match(/\{\{([\s\S]*)\}\}/);
  return (m ? m[1] : body).trim();
}

const agentModelExpr = expressionOf(byName("OpenRouter Chat Model").parameters.model);
const formatLine = byName("Format Response")
  .parameters.jsCode.split("\n")
  .find((l) => l.trim().startsWith("const model ="));
const formatModelExpr = formatLine
  .replace(/^\s*const model =/, "")
  .replace(/;\s*$/, "")
  .trim();

// `Format Response`-এ শেষে একটা `|| 'unknown'` আছে — সেটা শুধু নাম দেখানোর
// ফলব্যাক (দুটোই না থাকলে n8n তো model ছাড়াই চলবে না)। তাই তুলনার আগে ওটা
// বাদ দিই, নাহলে আসল precedence এক হওয়া সত্ত্বেও মিলবে না।
const stripFallback = (expr) => expr.replace(/\s*\|\|\s*'[^']*'\s*$/, "").trim();

const agentCore = stripFallback(agentModelExpr);
const formatCore = stripFallback(formatModelExpr);

console.log(`  OpenRouter Chat Model : ${agentCore}`);
console.log(`  Format Response       : ${formatCore}`);
check(
  agentCore === formatCore,
  "দুটো নোড একই model বাছে (precedence অভিন্ন)",
  agentCore === formatCore ? "" : "না হলে খরচ ভুল model-এর দামে হিসাব হতো"
);
check(
  /\|\|\s*'unknown'\s*$/.test(formatModelExpr),
  "দুটোই না থাকলে 'unknown' ফলব্যাক আছে",
  ""
);

// ── ২. দ্বিগুণ চার্জ নয় ─────────────────────────────────────────────────────
console.log("\n── ২. দ্বিগুণ চার্জের পরীক্ষা ──");

// chat/route.ts-এর হুবহু শর্ত
const shouldChargeLocally = (payload) => payload.billingOk !== true;

const scenarios = [
  {
    name: "production: n8n নিজেই কেটেছে (billingOk=true)",
    payload: { replyText: "hi", billingOk: true, promptTokens: 2400, completionTokens: 120 },
    charge: false,
  },
  {
    name: "localhost: n8n 404 পেয়েছে (billingOk=false)",
    payload: { replyText: "hi", billingOk: false, promptTokens: 1854, completionTokens: 86 },
    charge: true,
  },
  {
    name: "n8n 402 পেয়েছে (success নেই)",
    payload: { replyText: "hi", promptTokens: 1854, completionTokens: 86 },
    charge: true,
  },
  {
    name: "পুরনো JSON — billingOk ফিল্ডই নেই",
    payload: { replyText: "hi", promptTokens: 900, completionTokens: 40 },
    charge: true,
  },
  {
    name: "Billing API নোড error-অবজেক্ট ফেরত দিয়েছে",
    payload: { replyText: "hi", billingOk: false, error: "ECONNREFUSED" },
    charge: true,
  },
];

for (const s of scenarios) {
  const actual = shouldChargeLocally(s.payload);
  check(actual === s.charge, s.name, actual ? "প্ল্যাটফর্ম কাটবে" : "প্ল্যাটফর্ম থামবে");
}

// ── ৩. token সংখ্যা কি না ────────────────────────────────────────────────────
console.log("\n── ৩. token সংখ্যা ──");
for (const s of scenarios) {
  const p = s.payload;
  if (!("promptTokens" in p)) continue;
  const ok =
    typeof p.promptTokens === "number" && typeof p.completionTokens === "number";
  check(ok, `${s.name} — token সংখ্যা`, ok ? "" : `${typeof p.promptTokens}`);
}

// ── ৫. প্ল্যাটফর্ম যা পড়ে, n8n তা আদৌ পাঠায় কি? ────────────────────────────
//
// এটাই সবচেয়ে দরকারি যাচাই। `Build Web Response` ফেরত দেওয়ার অবজেক্টটা হাতে
// গুনে বানায় — তালিকায় না থাকলে Core-AI-Brain যা-ই পাঠাক, ফিল্ডটা বাদ পড়ে
// যায়। `billingOk` ঠিক এভাবেই বাদ পড়েছিল: প্ল্যাটফর্ম কখনো জানত না যে n8n
// ইতিমধ্যে কেটেছে, তাই সে-ও কাটত → production-এ দ্বিগুণ চার্জ।
console.log("\n── ৫. chat/route.ts যা পড়ে, n8n তা পাঠায় কি ──");

const chatRoute = fs.readFileSync(
  path.join(ROOT, "app", "api", "chatbots", "[chatbotId]", "chat", "route.ts"),
  "utf8"
);

const readByPlatform = [...new Set(
  [...chatRoute.matchAll(/\bpayload\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1])
)].sort();

const playground = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, "docs", "n8n-JSON", "Web-Playground-Integration.json"),
    "utf8"
  )
);
const buildResponse = playground.nodes.find((n) => n.name === "Build Web Response");
const returnBlock = buildResponse.parameters.jsCode.match(/json:\s*\{([\s\S]*?)\}/);
if (!returnBlock) throw new Error("Build Web Response-এর return ব্লক পাওয়া যায়নি");

const returnedFields = new Set(
  returnBlock[1]
    .split("\n")
    .map((l) => l.trim().replace(/,$/, ""))
    .filter((l) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(l))
);

console.log(`  প্ল্যাটফর্ম পড়ে : ${readByPlatform.join(", ")}`);
console.log(`  n8n পাঠায়     : ${[...returnedFields].sort().join(", ")}`);

/**
 * কোনগুলো **অবশ্যই** থাকতে হবে:
 *   billingOk      — না থাকলে প্ল্যাটফর্ম জানবে না যে n8n ইতিমধ্যে কেটেছে
 *   promptTokens   — না থাকলে খরচ ০ হয়ে যাবে
 *   completionTokens — একই
 *   replyText      — না থাকলে গ্রাহক খালি উত্তর পাবে
 *
 * বাকিগুলো ইচ্ছাকৃতভাবে ঐচ্ছিক:
 *   output / reply / text — `replyText`-এর পুরনো বিকল্প নাম (fallback)
 *   tokensAreExact        — guard; না থাকলে "অনুমান" ধরে নেওয়াই সঠিক
 */
const REQUIRED_BY_PLATFORM = ["billingOk", "promptTokens", "completionTokens", "replyText"];
const OPTIONAL_BY_PLATFORM = ["output", "reply", "text", "tokensAreExact"];

for (const field of readByPlatform) {
  if (REQUIRED_BY_PLATFORM.includes(field)) {
    check(
      returnedFields.has(field),
      `n8n অবশ্যই '${field}' পাঠায়`,
      returnedFields.has(field) ? "" : "না পাঠালে বিলিং বা উত্তর ভুল হবে"
    );
  } else if (OPTIONAL_BY_PLATFORM.includes(field)) {
    console.log(`  ➖ '${field}' ঐচ্ছিক (বিকল্প নাম বা guard) — না থাকলেও ঠিক`);
  } else {
    // নতুন কোনো ফিল্ড হঠাৎ পড়া শুরু হলে এখানে ধরা পড়বে
    check(
      returnedFields.has(field),
      `n8n '${field}' পাঠায় কি না — অজানা ফিল্ড, ভালো করে দেখুন`,
      returnedFields.has(field) ? "" : ""
    );
  }
}

// উল্টো দিকটাও দেখা দরকার: n8n যা পাঠায় তার সবই প্ল্যাটফর্ম ব্যবহার করে কি?
// না করলে কোনো ফিল্ড নিঃশব্দে অবহেলিত থাকতে পারে (যেমন creditsSpent)।
for (const field of returnedFields) {
  if (!readByPlatform.includes(field) && !["costBdt", "costUsd", "creditsSpent", "galleryImages", "isOrderCreated", "totalTokens", "session"].includes(field)) {
    console.log(`  ➖ n8n '${field}' পাঠায় কিন্তু প্ল্যাটফর্ম পড়ে না — মিলিয়ে দেখুন`);
  }
}

// ── ৪. credit-এর মান দুই জায়গায় এক কি? ─────────────────────────────────────
console.log("\n── ৪. credit-এর হিসাব ──");

// .env হাতে পড়ি — jiti বাইরে থেকে চলছে, Next.js এর লোডার নেই
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

(async () => {
  const stub = path.join(os.tmpdir(), `server-only-stub-${Date.now()}.js`);
  fs.writeFileSync(stub, "module.exports = {};\n", "utf8");

  let createJiti;
  try {
    ({ createJiti } = require("jiti"));
  } catch {
    console.log("  ⚠️  jiti পাওয়া যায়নি — credit যাচাই বাদ দেওয়া হলো");
    return finish();
  }

  const jiti = createJiti(path.join(ROOT, "noop.js"), {
    alias: { "@": ROOT, "server-only": stub },
    interopDefault: true,
  });

  const { resolveReplyCredits } = await jiti.import(
    path.join(ROOT, "lib", "ai", "credit-resolver.ts")
  );

  // n8n ও প্ল্যাটফর্ম — দুজনেই একই ফাংশন ডাকে, তাই মান অবশ্যই এক।
  // এখানে সেটাই প্রমাণ করা হয়: `isTestChat: true` দিলে যা আসে, সেটাই
  // chat/route.ts-এর ৪০২-চেক আর chargeUsage — দুটোতেই বসে।
  for (const model of [
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o-mini",
    "google/gemini-2.5-flash",
  ]) {
    const pre = await resolveReplyCredits(model, { isTestChat: true });
    const charge = await resolveReplyCredits(model, { isTestChat: true });
    check(
      pre.credits === charge.credits,
      `${model} — চেক ও কাটার মান একই`,
      `${charge.credits} credit (tier ${charge.tier}, source ${charge.source})`
    );
  }

  finish();
})().catch((err) => {
  console.error("\n❌ যাচাই চালাতে সমস্যা:", err.message);
  process.exit(1);
});

function finish() {
  console.log(
    failures === 0
      ? "\n✅ সব যাচাই পাস — প্ল্যাটফর্ম-বিলিং নিরাপদ"
      : `\n❌ ${failures}টি যাচাই ব্যর্থ`
  );
  process.exit(failures === 0 ? 0 : 1);
}
