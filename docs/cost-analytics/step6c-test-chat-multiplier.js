/**
 * Step 6c — টেস্ট চ্যাটের গুণক ২ → ১।
 *
 * ── কেন ──────────────────────────────────────────────────────────────────────
 * ড্যাশবোর্ডে Genius কার্ডে "৫ credit" লেখা ছিল, কিন্তু প্রতি reply-তে ১০ কাটা
 * হত — কারণ ড্যাশবোর্ডের টেস্ট চ্যাটে `testChatMultiplier` (তখন ২) প্রয়োগ
 * হত, অথচ কার্ডে base credit দেখানো হত। গ্রাহক যা দেখত, তার দ্বিগুণ কাটা
 * হচ্ছে — এটাই অভিযোগের কারণ।
 *
 * এখন ১ করা হয়: টেস্ট চ্যাট আর আসল গ্রাহকের reply-এর খরচ সমান। ভবিষ্যতে
 * চাইলে `/admin/ai-settings` → "Test Chat Multiplier" থেকেই বদলানো যাবে,
 * আর ড্যাশবোর্ড কার্ডে `effectiveCredits` (গুণকসহ) দেখানো হয় — তাই আর
 * কখনো "কার্ডে এক, কাটে আরেক" হবে না।
 *
 * ⚠️ এই স্ক্রিপ্ট `ai_credit_rules`-এর **শুধু** `testChatMultiplier` বদলায়।
 *    মডেল, credit মান, quickSetup — বাকি সব হুবহু অপরিবর্তিত থাকে।
 *
 * Idempotent: দুবার চালালে দ্বিতীয়বার কিছুই বদলায় না।
 *
 * চালানো:  node docs/cost-analytics/step6c-test-chat-multiplier.js
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..", "..");
const TARGET = 1;

(async () => {
  const stub = path.join(os.tmpdir(), `server-only-stub-${Date.now()}.js`);
  fs.writeFileSync(stub, "module.exports = {};\n", "utf8");

  const { createJiti } = require("jiti");
  const jiti = createJiti(path.join(ROOT, "noop.js"), {
    alias: { "@": ROOT, "server-only": stub },
    interopDefault: true,
  });

  const { db } = await jiti.import(path.join(ROOT, "lib", "core", "db.ts"));

  const before = await db.platformSetting.findUnique({ where: { key: "ai_credit_rules" } });
  if (!before) {
    console.error("❌ ai_credit_rules সেটিংটাই নেই — আগে /admin/ai-settings থেকে সেভ করুন।");
    process.exit(1);
  }

  const value = before.value;
  const current = typeof value.testChatMultiplier === "number" ? value.testChatMultiplier : null;

  console.log(`আগে : testChatMultiplier = ${current ?? "(নেই)"}`);
  console.log(`পরে : testChatMultiplier = ${TARGET}`);

  if (current === TARGET) {
    console.log("\n✅ আগেই ১ ছিল — কিছু বদলানো হয়নি।");
    return;
  }

  // শুধু এই একটা কী বদলাই। বাকি সব (models, quickSetup, minCreditThreshold…)
  // হুবহু আগের অবজেক্টটাই থেকে যায়।
  const updated = { ...value, testChatMultiplier: TARGET, updatedAt: new Date().toISOString() };

  await db.platformSetting.update({
    where: { key: "ai_credit_rules" },
    data: { value: updated },
  });

  // ── যাচাই: সত্যিই লেখা হয়েছে কি, আর বাকি সব অটুট আছে কি ────────────────────
  const after = await db.platformSetting.findUnique({ where: { key: "ai_credit_rules" } });
  const afterValue = after.value;

  const changedKeys = Object.keys({ ...value, ...afterValue }).filter(
    (k) => JSON.stringify(value[k]) !== JSON.stringify(afterValue[k])
  );

  console.log(`\nযাচাই:`);
  console.log(`  testChatMultiplier : ${afterValue.testChatMultiplier}`);
  console.log(`  মডেল সংখ্যা        : ${Array.isArray(afterValue.models) ? afterValue.models.length : "?"}`);
  console.log(`  বদলানো কী         : ${changedKeys.join(", ") || "(কিছু না)"}`);

  const ok =
    afterValue.testChatMultiplier === TARGET &&
    JSON.stringify(afterValue.models) === JSON.stringify(value.models) &&
    JSON.stringify(afterValue.quickSetup) === JSON.stringify(value.quickSetup);

  console.log(ok ? "\n✅ গুণক ১ — বাকি সেটিংস অপরিবর্তিত" : "\n❌ কিছু একটা বদলে গেছে, ভালো করে দেখুন");
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error("\n❌ স্ক্রিপ্ট চালাতে সমস্যা:", err.message);
  process.exit(1);
});
