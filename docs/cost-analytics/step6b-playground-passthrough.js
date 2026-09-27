/**
 * Step 6b — Playground-এর উত্তর প্ল্যাটফর্ম পর্যন্ত পৌঁছানোর সময় যেন
 * বিলিং-তথ্য হারিয়ে না যায়।
 *
 * ── কেন দরকার ────────────────────────────────────────────────────────────────
 * `Build Web Response` নোডটি Next.js-কে ফেরত দেওয়ার অবজেক্টটি **হাতে গুনে**
 * বানায় — Core-AI-Brain যা-ই পাঠাক, ওই তালিকায় না থাকলে বাদ পড়ে যায়।
 * `billingOk` ওই তালিকায় ছিল না।
 *
 * ফলাফল হলে কী হতো: `chat/route.ts` কখনোই জানত না যে n8n ইতিমধ্যে credit
 * কেটেছে, তাই সে-ও কাটত → **production-এ প্রতিটি Playground reply-তে
 * দ্বিগুণ চার্জ**, আর গ্রাহকের ব্যালেন্স দ্বিগুণ দ্রুত শেষ হতো।
 *
 * Idempotent: দুবার চালালে দ্বিতীয়বার কিছুই বদলায় না।
 */
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "n8n-JSON", "Web-Playground-Integration.json");
const wf = JSON.parse(fs.readFileSync(FILE, "utf8"));
const node = wf.nodes.find((n) => n.name === "Build Web Response");
if (!node) throw new Error("Build Web Response নোড পাওয়া যায়নি");

const log = [];
const step = (m) => log.push(m);
let code = node.parameters.jsCode;

// ── ১. হেডার কমেন্টে নতুন ফিল্ড দুটো লিখে দিই ────────────────────────────────
const OLD_SHAPE =
  "// Response shape: { replyText, galleryImages, isOrderCreated, promptTokens, completionTokens, totalTokens, costUsd, costBdt, session }";
const NEW_SHAPE =
  "// Response shape: { replyText, galleryImages, isOrderCreated, promptTokens, completionTokens, totalTokens, costUsd, costBdt, creditsSpent, billingOk, session }";
if (code.includes(OLD_SHAPE)) {
  code = code.replace(OLD_SHAPE, NEW_SHAPE);
  step("হেডার কমেন্টে creditsSpent ও billingOk যোগ");
} else if (!code.includes(NEW_SHAPE)) {
  throw new Error("Response shape কমেন্টটা খুঁজে পাওয়া যায়নি — ফাইল কি বদলে গেছে?");
}

// ── ২. মানগুলো বের করা ───────────────────────────────────────────────────────
const ANCHOR = "const costBdt = (!hadError && brainOutput.costBdt) || 0;";
const ADDED = `${ANCHOR}

// n8n নিজেই কি credit কেটেছে? — এটাই দ্বিগুণ চার্জ আটকায়। Core-AI-Brain-এর
// 'Billing API' সফল হলে true আসে, আর তখন Next.js আর কাটে না।
// (এখানে false মানে "n8n পারেনি" — যেমন Next.js লোকালহোস্টে চলার সময়, যখন
//  n8n প্ল্যাটফর্মের URL-এ পৌঁছাতেই পারে না।)
const creditsSpent = (!hadError && brainOutput.creditsSpent) || 0;
const billingOk = (!hadError && brainOutput.billingOk === true) || false;`;

if (!code.includes("const billingOk =")) {
  if (!code.includes(ANCHOR)) throw new Error("costBdt লাইনটা পাওয়া যায়নি");
  code = code.replace(ANCHOR, ADDED);
  step("creditsSpent ও billingOk বের করার লাইন যোগ");
} else {
  step("creditsSpent ও billingOk আগেই ছিল — কিছু বদলাইনি");
}

// ── ৩. উত্তরের অবজেক্টে বসানো ────────────────────────────────────────────────
const RETURN_OLD = "    costBdt,\n    session\n";
const RETURN_NEW = "    costBdt,\n    creditsSpent,\n    billingOk,\n    session\n";
if (code.includes(RETURN_OLD)) {
  code = code.replace(RETURN_OLD, RETURN_NEW);
  step("return করা JSON-এ creditsSpent ও billingOk যোগ");
} else if (!code.includes(RETURN_NEW)) {
  throw new Error("return ব্লকের অবজেক্টটা চেনা যাচ্ছে না");
}

node.parameters.jsCode = code;

// ── ৪. যাচাই — syntax ও দুটো ফিল্ড আদৌ ফেরত যাচ্ছে কি না ─────────────────────
const vm = require("vm");
new vm.Script("(async function(){\n" + code + "\n})");
step("Code নোডের JS syntax বৈধ");

for (const field of ["creditsSpent", "billingOk"]) {
  if (!new RegExp(`\\b${field},`).test(code) && !code.includes(field)) {
    throw new Error(`${field} কোথাও নেই`);
  }
}

fs.writeFileSync(FILE, JSON.stringify(wf, null, 2) + "\n", "utf8");
console.log(log.map((l, i) => `${i + 1}. ${l}`).join("\n"));
console.log(`\nনোড সংখ্যা: ${wf.nodes.length}`);
