/**
 * Step 6d — credit-এর মান সব জায়গায় সত্যিই এক কি না, তার যাচাই।
 *
 * ── কেন দরকার ────────────────────────────────────────────────────────────────
 * গ্রাহকের অভিযোগ ছিল: ড্যাশবোর্ডের কার্ডে Genius = ৫ credit, অথচ কাটা হচ্ছে
 * ১০। কারণ ছিল চারটি —
 *   ১. `use-openrouter-models.ts` ক্লায়েন্টে হার্ডকড 1 / 3 / 5 বসাত
 *   ২. `buildDynamicTierMap` admin-এর quickSetup উপেক্ষা করে নিজের তালিকা
 *      থেকে মডেল বাছত
 *   ৩. DB-র `testChatMultiplier = 2` গোপনে সব দ্বিগুণ করত
 *   ৪. credit-এর মান ৫ মিনিটের in-memory cache-এ বন্দি থাকত। Next.js-এ
 *      route handler-প্রতি আলাদা module instance হয়, তাই admin save করার
 *      পরে ডাকা reset কেবল নিজের bundle-এ কাজ করত — `/api/ai-models` পুরনো
 *      গুণক নিয়ে বসে থাকত, আর ড্যাশবোর্ডে নতুন credit × পুরনো গুণক = ২/৬/১০
 *      দেখাত। (উপরন্তু `/api/ai-models`-এ `dynamic` না থাকায় production-এ
 *      মানগুলো build-time-এ জমাট বাঁধত।)
 *
 * এই স্ক্রিপ্টটি প্রমাণ করে চারটিই মেরামত হয়েছে — অর্থাৎ এখন
 * **কার্ডে যা দেখা যায় = যা কাটা হয়**।
 *
 * DB শুধু **পড়া** হয়। কোনো লেখা নেই।
 *
 * চালানো:  node docs/cost-analytics/step6d-verify-credit-consistency.js
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const ROOT = path.join(__dirname, "..", "..");

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? "  → " + detail : ""}`);
  if (!ok) failures++;
};

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * মন্তব্য বাদ দিয়ে শুধু কোড।
 *
 * ⚠️ দরকার — কারণ এই ফাইলগুলোর ব্যাখ্যাতেই পুরনো নামগুলো লেখা থাকে
 *    ("আগে `credits: 1` হার্ডকড ছিল", "`resetCreditRulesCache()` সরানো
 *    হয়েছে")। ওগুলো কোড বলে ধরা পড়লে মিথ্যা ব্যর্থতা আসে। একবার হয়েছিল।
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

// ── ১. গুণকের default আর admin-এর default ────────────────────────────────────
console.log("\n── ১. টেস্ট-চ্যাট গুণকের default ──");

const creditConfig = read("lib/domain/credit-config.ts");
const multiplierLine = creditConfig.match(/test_chat_multiplier:\s*(\d+)/);
check(
  multiplierLine && multiplierLine[1] === "1",
  "credit-config.ts → test_chat_multiplier = 1",
  multiplierLine ? `পাওয়া গেছে ${multiplierLine[1]}` : "লাইনটাই পাওয়া যায়নি"
);
check(
  !/test_chat_multiplier:\s*2/.test(creditConfig),
  "কোথাও পুরনো ২ টা পড়ে নেই"
);

const adminRoute = read("app/api/admin/ai-settings/route.ts");
const adminDefault = adminRoute.match(/testChatMultiplier:\s*(\d+)/);
check(
  adminDefault && adminDefault[1] === "1",
  "admin ai-settings route → DEFAULT testChatMultiplier = 1",
  adminDefault ? `পাওয়া গেছে ${adminDefault[1]}` : "পাওয়া যায়নি"
);

// ── ২. ক্লায়েন্টে আর হার্ডকড credit নেই ──────────────────────────────────────
console.log("\n── ২. ক্লায়েন্টের হার্ডকড ──");

const hook = read("components/chatbots/use-openrouter-models.ts");

// সংখ্যা লেখা থাকতে পারে একমাত্র দুটো **pre-fetch** ব্লকে:
//   FALLBACK_CHAT_MODELS — নেটওয়ার্ক ফেল করলে দেখানোর মডেল-তালিকা
//   PLACEHOLDER_TIERS    — fetch শেষ হওয়ার আগের কার্ড
// দুটোই সার্ভারের উত্তর এসে পড়লেই বদলে যায়। এর বাইরে কোনো `credits: <সংখ্যা>`
// থাকা মানে আবার কেউ হার্ডকড করে ফেলেছে — সেটাই ধরা হয়।
//
// ⚠️ regex দিয়ে ব্লক কাটা যায় না — একটা `];`-এ শেষ হওয়া ব্লকের জন্য
//    অলস `[\s\S]*?` পরের `};` পর্যন্ত গিয়ে দুটো ব্লকই গিলে ফেলে। তাই
//    লাইন ধরে ধরে ব্লকের শেষ খোঁজা হয়।
function stripBlock(src, name) {
  const lines = src.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(`export const ${name}`));
  check(start !== -1, `${name} ব্লকটি পাওয়া গেছে`);

  if (start === -1) return src;

  const end = lines.findIndex((l, i) => i > start && /^[\]};]+;?$/.test(l.trim()));
  if (end === -1) return src;

  return [...lines.slice(0, start), ...lines.slice(end + 1)].join("\n");
}

let hookWithoutPlaceholders = stripBlock(hook, "FALLBACK_CHAT_MODELS");
hookWithoutPlaceholders = stripBlock(hookWithoutPlaceholders, "PLACEHOLDER_TIERS");

// মন্তব্যও বাদ দিই — "আগে এখানে হার্ডকড `credits: 1` ছিল" লেখা একটা
// মন্তব্য যেন কোড বলে ভুল না হয় (একবার হয়েছিল)।
const codeOnly = stripComments(hookWithoutPlaceholders);

const hardcoded = [...codeOnly.matchAll(/credits:\s*-?\d+/g)].map((m) => m[0]);
check(
  hardcoded.length === 0,
  "সার্ভারের ডেটা থেকে tiers বানানোর সময় কোনো হার্ডকড credit নেই",
  hardcoded.length ? `পাওয়া গেছে: ${hardcoded.join(", ")}` : ""
);
check(
  hookWithoutPlaceholders.includes("effectiveCredits"),
  "ক্লায়েন্ট effectiveCredits (গুণকসহ মান) ব্যবহার করে",
  ""
);
check(
  hookWithoutPlaceholders.includes("found.credits"),
  "tiers বাদ পড়লে মডেলের নিজের credit থেকে হিসাব হয়, বানানো সংখ্যা নয়",
  ""
);

const chatSettings = read(
  "app/(dashboard)/dashboard/chatbots/[chatbotId]/chat/_components/chat-settings.tsx"
);
const effectiveUses = (chatSettings.match(/tiers\.\w+\.effectiveCredits/g) || []).length;
check(
  effectiveUses === 3,
  "ড্যাশবোর্ডের তিনটি কার্ডই effectiveCredits দেখায়",
  `${effectiveUses}টি পাওয়া গেছে`
);
check(
  !/tiers\.\w+\.credits\b/.test(chatSettings),
  "কোনো কার্ড base credit দেখায় না (যা কাটা হয় তার চেয়ে কম)",
  ""
);

// ── ৩. admin panel-এর কার্ডগুলোও আর হার্ডকড নয় ───────────────────────────────
console.log("\n── ৩. admin preset কার্ড ──");

const presets = read("app/(admin)/admin/ai-settings/_components/QuickSetupPresets.tsx");
check(
  !/Fixed \d+ Credit/.test(presets),
  "কার্ডে আর 'Fixed N Credit' লেখা নেই",
  ""
);
check(
  presets.includes("onUpdateCreditCost"),
  "প্রতিটি কার্ডের credit এখন সম্পাদনাযোগ্য",
  ""
);
check(
  /model\.credits \* multiplier/.test(presets) || presets.includes("Math.round(model.credits * multiplier)"),
  "কার্ডে গুণকসহ effective credit দেখানো হয়",
  ""
);

const catalogTable = read(
  "app/(admin)/admin/ai-settings/_components/ModelCatalogTable.tsx"
);
check(
  !/Preset \(\d+ Cr\)/.test(catalogTable),
  "catalogue-এর preset badge-ও আর হার্ডকড নয়",
  ""
);

// ── ৪. আসল হিসাব — DB + আসল কোড ─────────────────────────────────────────────
console.log("\n── ৪. tiers বনাম আসল deduction ──");

(async () => {
  const stub = path.join(os.tmpdir(), `server-only-stub-${Date.now()}.js`);
  fs.writeFileSync(stub, "module.exports = {};\n", "utf8");

  const nextCacheStub = path.join(os.tmpdir(), `next-cache-stub-${Date.now()}.js`);
  fs.writeFileSync(
    nextCacheStub,
    "module.exports = { unstable_cache: (fn) => fn, revalidatePath: () => {}, revalidateTag: () => {} };\n",
    "utf8"
  );

  const { createJiti } = require("jiti");
  const jiti = createJiti(path.join(ROOT, "noop.js"), {
    alias: { "@": ROOT, "server-only": stub, "next/cache": nextCacheStub },
    interopDefault: true,
  });

  const { db } = await jiti.import(path.join(ROOT, "lib", "core", "db.ts"));
  const { getDynamicTierMap } = await jiti.import(
    path.join(ROOT, "lib", "ai", "chat-models.ts")
  );
  const { resolveReplyCredits } = await jiti.import(
    path.join(ROOT, "lib", "ai", "credit-resolver.ts")
  );

  const setting = await db.platformSetting.findUnique({ where: { key: "ai_credit_rules" } });
  const value = setting.value;
  const quickSetup = value.quickSetup;
  const multiplier = value.testChatMultiplier;

  console.log(`  DB testChatMultiplier : ${multiplier}`);
  console.log(`  DB quickSetup         : fast=${quickSetup.fastModel}, smart=${quickSetup.smartModel}, genius=${quickSetup.geniusModel}`);

  check(multiplier === 1, "DB-তেও গুণক এখন ১", `পাওয়া গেছে ${multiplier}`);

  const tiers = await getDynamicTierMap();
  const catalog = new Map(value.models.map((m) => [m.id, m]));

  console.log("\n  tier   │ মডেল                        │ base │ কার্ডে │ কাটে │ মেলে");
  console.log("  ───────┼─────────────────────────────┼──────┼────────┼──────┼─────");

  for (const key of ["fast", "smart", "genius"]) {
    const tier = tiers[key];
    const presetId = quickSetup[`${key}Model`];

    // কার্ডে এই মডেলটাই দেখানো হচ্ছে কি? (admin যা বাছেছেন)
    const isPreset = tier.modelId === presetId;
    check(
      isPreset,
      `${key}: admin-এর বাছা মডেলই ব্যবহৃত হয়`,
      isPreset ? tier.modelId : `হয়েছে ${tier.modelId}, admin বাছেছেন ${presetId}`
    );

    // বিল যা কাটবে — হুবহু যে ফাংশন বিলে চলে
    const billed = await resolveReplyCredits(tier.modelId, { isTestChat: true });

    const baseMatch = billed.baseCredits === tier.credits;
    const effectiveMatch = billed.credits === tier.effectiveCredits;

    check(baseMatch, `${key}: base credit মেলে`, `${tier.credits} = ${billed.baseCredits}`);
    check(
      effectiveMatch,
      `${key}: কার্ডে দেখানো মান = কাটার মান`,
      `${tier.effectiveCredits} = ${billed.credits}`
    );

    console.log(
      `  ${key.padEnd(6)} │ ${tier.modelId.padEnd(27)} │ ${String(tier.credits).padStart(4)} │ ${String(tier.effectiveCredits).padStart(6)} │ ${String(billed.credits).padStart(4)} │ ${baseMatch && effectiveMatch ? "✅" : "❌"}`
    );

    // catalogue-তেও একই মডেল থাকা উচিত, নাহলে admin panel-এ কার্ডটা খালি দেখাবে
    const inCatalog = catalog.has(tier.modelId);
    check(
      inCatalog,
      `${key}: মডেলটি admin catalogue-তেও আছে`,
      inCatalog ? "" : "নইলে admin panel-এ ওই কার্ডে credit দেখানো যাবে না"
    );
  }

  // ── ৫. n8n যে মডেল ব্যবহার করবে সেটাও একই কি ───────────────────────────────
  console.log("\n── ৫. n8n-এর model বনাম tiers ──");
  console.log(
    "  n8n 'OpenRouter Chat Model' মডেলটা প্ল্যাটফর্ম থেকে পায় — অর্থাৎ\n" +
    "  resolveModelConfig(...) যা ফেরত দেয়। তাই ওই ফাংশনের ফল tiers-এর\n" +
    "  সাথে মিললেই প্রমাণ হয় যে বিল আর উত্তর একই মডেলের।"
  );

  const { resolveModelConfig } = await jiti.import(
    path.join(ROOT, "lib", "ai", "chat-models.ts")
  );

  for (const key of ["fast", "smart", "genius"]) {
    const resolved = await resolveModelConfig("simple", key);
    check(
      resolved.modelId === tiers[key].modelId,
      `${key}: n8n যে মডেল পায় = কার্ডের মডেল`,
      resolved.modelId
    );
  }

  // ── ৬. cache-জনিত পুরনো মান আর ফিরতে পারবে না ──────────────────────────────
  console.log("\n── ৬. cache ও HTTP-স্তরের সুরক্ষা ──");
  console.log(
    "  কারণ: admin panel-এ ১/৩/৫ সেভ করার পরেও ড্যাশবোর্ড ২/৬/১০ দেখাচ্ছিল।\n" +
    "  সেটা হয়েছিল কারণ credit-এর মান ৫ মিনিটের in-memory cache-এ বন্দি ছিল,\n" +
    "  আর Next.js-এ route handler-প্রতি আলাদা module instance থাকায় admin\n" +
    "  save-এর reset কেবল নিজের bundle-এ কাজ করত।"
  );

  const resolverSrc = stripComments(read("lib/ai/credit-resolver.ts"));
  check(
    !/let memoryRules|MEMORY_TTL_MS|resetCreditRulesCache/.test(resolverSrc),
    "credit-resolver-এ কোনো cache নেই — প্রতিবার DB থেকেই পড়ে",
    ""
  );
  check(
    /findUnique/.test(resolverSrc),
    "getCreditRules() সত্যিই DB পড়ে",
    ""
  );

  const serviceSrc = stripComments(read("lib/ai/openrouter-service.ts"));
  check(
    !/let presetsCache|PRESETS_TTL_MS|resetQuickSetupPresetsCache/.test(serviceSrc),
    "openrouter-service-এর preset cache-ও সরানো হয়েছে",
    ""
  );
  check(
    /export async function getQuickSetupPresets/.test(serviceSrc),
    "getQuickSetupPresets() এখনো আছে (প্রতিবার DB পড়ে)",
    ""
  );

  // ⚠️ `CACHE` ছাড়া অন্য TTL cache-ও যেন ফিরে না আসে — model-pricing.ts-এর
  //    snapshot cache বৈধ (ওটা OpenRouter-এর HTTP কল বাঁচায়, admin setting নয়)।
  check(
    /getCachedOpenRouterModels|unstable_cache/.test(serviceSrc),
    "OpenRouter-এর আসল catalogue কল এখনো cache-এ আছে (খরচ বাড়ে না)",
    ""
  );

  const aiModelsRoute = stripComments(read("app/api/ai-models/route.ts"));
  check(
    /export const dynamic = "force-dynamic"/.test(aiModelsRoute),
    "/api/ai-models → force-dynamic (production build-এ জমাট বাঁধবে না)",
    ""
  );
  check(
    /no-store/.test(aiModelsRoute),
    "/api/ai-models → Cache-Control: no-store (ব্রাউজার পুরনো উত্তর ধরে না)",
    ""
  );

  const openrouterRoute = stripComments(read("app/api/models/openrouter/route.ts"));
  check(
    /no-store/.test(openrouterRoute),
    "/api/models/openrouter → Cache-Control: no-store",
    ""
  );

  check(
    /cache:\s*"no-store"/.test(hook),
    "ক্লায়েন্ট fetch-এ cache: no-store",
    ""
  );

  const fetchModelsRoute = stripComments(read("app/api/admin/ai-settings/fetch-models/route.ts"));
  check(
    !/testChatMultiplier:\s*existingValue\.testChatMultiplier \?\? 2/.test(fetchModelsRoute),
    "fetch-models-এ হার্ডকড `?? 2` আর নেই",
    ""
  );
  check(
    /testChatMultiplier: existingValue\.testChatMultiplier \?\? 1/.test(fetchModelsRoute),
    "fetch-models-এর fallback এখন ১",
    ""
  );
  check(
    /previousCredits/.test(fetchModelsRoute),
    "Fetch Models চাপলে admin-এর বসানো credit মুছে যায় না",
    ""
  );

  console.log(
    failures === 0
      ? "\n✅ সব যাচাই পাস — কার্ডে যা দেখা যায়, ঠিক তাই কাটা হয়"
      : `\n❌ ${failures}টি যাচাই ব্যর্থ`
  );
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error("\n❌ যাচাই চালাতে সমস্যা:", err.message);
  process.exit(1);
});
