import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/core/db";

// ══════════════════════════════════════════════════════════════════════════════
// Model Pricing — OpenRouter-এর আসল (লাইভ) দামের একমাত্র সূত্র
//
// আগে দাম কোডে হার্ডকড ছিল — সব মডেলের জন্য $3/$15। ফলে সস্তা মডেলে (যেমন
// `gemini-2.5-flash-lite`, আসল দাম $0.10/$0.40) খরচ ~৩০ গুণ বেশি দেখাত।
// এখন দাম আসে OpenRouter-এর `/api/v1/models` থেকে।
//
// তিন স্তরের cache — কোনো অবস্থাতেই crash করে না, আর hot path-এ অপেক্ষা করায় না:
//   ১. In-memory (৫ মিনিট) — প্রতি request-এ DB hit এড়ায়
//   ২. PlatformSetting    — restart-এ টেকে, সবার জন্য এক (`openrouter_pricing`)
//   ৩. কোডের fallback      — OpenRouter ডাউন হলেও খরচের গণনা থামে না
//
// মূলনীতি: snapshot পুরনো হলেও **সেটাই সঙ্গে সঙ্গে ফেরত দেওয়া হয়** এবং নতুন
// snapshot পটভূমিতে আনা হয় (stale-while-revalidate)। কেবল কোনো snapshot-ই না
// থাকলে অপেক্ষা করা হয়। তাই সাধারণ অবস্থায় চ্যাট request কোনো লেটেন্সি পায় না।
// ══════════════════════════════════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────────────────────────────────

/** একটি মডেলের দাম, USD per 1M token (OpenRouter per-token দেয়, আমরা per-1M রাখি)। */
export interface ModelPrice {
  modelId: string;
  promptPrice: number;
  completionPrice: number;
}

/**
 * দামটা কোথা থেকে এল:
 *  - `openrouter` = OpenRouter-এর আসল দাম (লাইভ বা cache করা)
 *  - `fallback`   = মডেলটি OpenRouter-এ পাওয়া যায়নি, তাই রক্ষণশীল অনুমান
 */
export type PricingSource = "openrouter" | "fallback";

export interface ResolvedModelPrice extends ModelPrice {
  source: PricingSource;
  /** snapshot কখন তোলা হয়েছিল (ISO string), না থাকলে `null` */
  asOf: string | null;
}

/** `openrouter_pricing` PlatformSetting-এ যা জমা থাকে। */
export interface PricingSnapshot {
  fetchedAt: string;
  /** modelId → per-1M-token দাম */
  models: Record<string, { prompt: number; completion: number }>;
}

export interface RefreshPricingResult {
  ok: boolean;
  modelCount: number;
  fetchedAt?: string;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SETTING_KEY = "openrouter_pricing";
const MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";

/** OpenRouter per-token দাম দেয়; আমরা per-1M রাখি (বাকি কোডের সাথে মিলিয়ে)। */
const TOKENS_PER_UNIT = 1_000_000;

/** In-memory cache কতক্ষণ বাঁচবে। */
const MEMORY_TTL_MS = 5 * 60 * 1000;

/** এর চেয়ে পুরনো snapshot থাকলে পটভূমিতে নতুন আনা হয়। */
const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** লাইভ fetch-এর সর্বোচ্চ অপেক্ষা। */
const FETCH_TIMEOUT_MS = 5_000;

/**
 * OpenRouter-এ মডেল না থাকলে বা কিছুই না পেলে এই দাম ধরা হয়।
 * ইচ্ছাকৃতভাবে মাঝারি-উচ্চ — যাতে খরচ কম দেখিয়ে লস ঢেকে না যায়।
 */
const FALLBACK_PRICE: ModelPrice = {
  modelId: "fallback",
  promptPrice: 0.15,
  completionPrice: 0.6,
};

// ─── Snapshot parsing (pure — unit-testable) ──────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * OpenRouter দাম per-token string হিসেবে দেয় (যেমন `"0.000003"`)।
 * এখানে সেটি per-1M number-এ বদলানো হয়। ভুল মান হলে `null`।
 */
function toPerMillion(raw: unknown): number | null {
  const value =
    typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : Number.NaN;

  if (!Number.isFinite(value) || value < 0) return null;

  // floating point ধুলো এড়াতে (0.000003 × 1e6 = 3.0000000000000004)
  return Number((value * TOKENS_PER_UNIT).toPrecision(12));
}

/**
 * `/api/v1/models`-এর response থেকে snapshot বানায়।
 * অচেনা আকার পেলে খালি snapshot ফেরত দেয় — throw করে না।
 */
export function parseOpenRouterModels(payload: unknown): PricingSnapshot {
  const models: PricingSnapshot["models"] = {};

  if (isRecord(payload) && Array.isArray(payload.data)) {
    for (const entry of payload.data) {
      if (!isRecord(entry)) continue;

      const id = entry.id;
      const pricing = entry.pricing;
      if (typeof id !== "string" || !isRecord(pricing)) continue;

      const prompt = toPerMillion(pricing.prompt);
      const completion = toPerMillion(pricing.completion);
      if (prompt === null || completion === null) continue;

      models[id] = { prompt, completion };
    }
  }

  return { fetchedAt: new Date().toISOString(), models };
}

/**
 * DB-র JSON value সত্যিই snapshot কি না যাচাই করে।
 * (PlatformSetting.value যেকোনো JSON হতে পারে — তাই অন্ধভাবে বিশ্বাস করা যায় না।)
 */
function isPricingSnapshot(value: unknown): value is PricingSnapshot {
  if (!isRecord(value)) return false;
  if (typeof value.fetchedAt !== "string") return false;
  if (!isRecord(value.models)) return false;

  for (const entry of Object.values(value.models)) {
    if (!isRecord(entry)) return false;
    if (typeof entry.prompt !== "number" || typeof entry.completion !== "number") return false;
  }
  return true;
}

// ─── Snapshot loading (memory → DB → live) ────────────────────────────────────

let memorySnapshot: PricingSnapshot | null = null;
let memoryLoadedAt = 0;
let refreshInFlight: Promise<PricingSnapshot | null> | null = null;

async function readSnapshotFromDb(): Promise<PricingSnapshot | null> {
  try {
    const setting = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
    const value = setting?.value;
    return isPricingSnapshot(value) ? value : null;
  } catch (error) {
    console.error("[MODEL_PRICING] DB snapshot read failed:", error);
    return null;
  }
}

async function writeSnapshotToDb(snapshot: PricingSnapshot): Promise<void> {
  // Prisma-র Json input-এ index signature লাগে; আমাদের interface-টা কড়াভাবে typed,
  // তাই cast করা হচ্ছে — shape নিজেরাই নিয়ন্ত্রণ করি, তাই এটা নিরাপদ।
  const value = snapshot as unknown as Prisma.InputJsonValue;

  try {
    await db.platformSetting.upsert({
      where: { key: SETTING_KEY },
      update: { value },
      create: { key: SETTING_KEY, value },
    });
  } catch (error) {
    // Cache লেখা ব্যর্থ হলেও দাম ব্যবহার করা চলবে — তাই এটা fatal নয়।
    console.error("[MODEL_PRICING] DB snapshot write failed:", error);
  }
}

/** OpenRouter থেকে টেনে আনে। ব্যর্থ হলে `null` (throw করে না)। */
async function fetchLiveSnapshot(): Promise<PricingSnapshot | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const response = await fetch(MODELS_ENDPOINT, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[MODEL_PRICING] OpenRouter responded ${response.status}`);
      return null;
    }

    const snapshot = parseOpenRouterModels(await response.json());
    if (Object.keys(snapshot.models).length === 0) {
      console.error("[MODEL_PRICING] OpenRouter returned no usable prices");
      return null;
    }
    return snapshot;
  } catch (error) {
    console.error("[MODEL_PRICING] Live fetch failed:", error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** একইসাথে একাধিক refresh যাতে না হয়। */
function refreshInBackground(): void {
  if (refreshInFlight) return;

  refreshInFlight = fetchLiveSnapshot()
    .then(async (snapshot) => {
      if (snapshot) {
        await writeSnapshotToDb(snapshot);
        memorySnapshot = snapshot;
        memoryLoadedAt = Date.now();
      }
      return snapshot;
    })
    .finally(() => {
      refreshInFlight = null;
    });
}

/**
 * ব্যবহারযোগ্য snapshot ফেরত দেয় (memory → DB → live)।
 * পুরনো snapshot থাকলে সেটাই দেয় এবং পটভূমিতে refresh শুরু করে।
 */
async function loadSnapshot(): Promise<PricingSnapshot | null> {
  const now = Date.now();

  if (memorySnapshot && now - memoryLoadedAt < MEMORY_TTL_MS) {
    return memorySnapshot;
  }

  const stored = await readSnapshotFromDb();
  const storedIsFresh =
    stored !== null && now - Date.parse(stored.fetchedAt) < SNAPSHOT_MAX_AGE_MS;

  if (storedIsFresh) {
    memorySnapshot = stored;
    memoryLoadedAt = now;
    return stored;
  }

  if (stored) {
    // পুরনো snapshot দিয়ে কাজ চালানো হবে; নতুনটা পটভূমিতে আসবে।
    memorySnapshot = stored;
    memoryLoadedAt = now;
    refreshInBackground();
    return stored;
  }

  // কিছুই নেই — এখানেই একমাত্র অপেক্ষা।
  const fresh = await fetchLiveSnapshot();
  if (fresh) {
    await writeSnapshotToDb(fresh);
    memorySnapshot = fresh;
    memoryLoadedAt = Date.now();
  }
  return fresh;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * একটি মডেলের দাম বের করে।
 *
 * @param modelId - OpenRouter model id (যেমন `"anthropic/claude-sonnet-4"`)
 *
 * @example
 * ```ts
 * const price = await resolveModelPrice("anthropic/claude-sonnet-4");
 * // { promptPrice: 3, completionPrice: 15, source: "openrouter", ... }
 * ```
 */
export async function resolveModelPrice(modelId: string): Promise<ResolvedModelPrice> {
  const snapshot = await loadSnapshot();
  const entry = snapshot?.models[modelId];

  if (entry) {
    return {
      modelId,
      promptPrice: entry.prompt,
      completionPrice: entry.completion,
      source: "openrouter",
      asOf: snapshot?.fetchedAt ?? null,
    };
  }

  return {
    ...FALLBACK_PRICE,
    modelId,
    source: "fallback",
    asOf: snapshot?.fetchedAt ?? null,
  };
}

/**
 * OpenRouter থেকে জোর করে নতুন দাম এনে cache-এ লেখে।
 * Admin panel-এর "Sync pricing" চাওয়া বা daily cron থেকে ডাকা হয়।
 */
export async function refreshPricingSnapshot(): Promise<RefreshPricingResult> {
  const snapshot = await fetchLiveSnapshot();

  if (!snapshot) {
    return { ok: false, modelCount: 0, error: "OpenRouter থেকে দাম আনা যায়নি" };
  }

  await writeSnapshotToDb(snapshot);
  memorySnapshot = snapshot;
  memoryLoadedAt = Date.now();

  return {
    ok: true,
    modelCount: Object.keys(snapshot.models).length,
    fetchedAt: snapshot.fetchedAt,
  };
}

/**
 * বর্তমানে ব্যবহৃত snapshot-টি (admin panel-এ দেখানোর জন্য)।
 * `fetchedAt: null` মানে OpenRouter থেকে কিছুই পাওয়া যায়নি।
 */
export async function getPricingSnapshotInfo(): Promise<{
  fetchedAt: string | null;
  modelCount: number;
  ageMs: number | null;
}> {
  const snapshot = await loadSnapshot();
  if (!snapshot) return { fetchedAt: null, modelCount: 0, ageMs: null };

  return {
    fetchedAt: snapshot.fetchedAt,
    modelCount: Object.keys(snapshot.models).length,
    ageMs: Date.now() - Date.parse(snapshot.fetchedAt),
  };
}

/** In-memory cache ফেলে দেয় (পরের কলে DB/live থেকে আবার পড়বে)। */
export function resetPricingMemoryCache(): void {
  memorySnapshot = null;
  memoryLoadedAt = 0;
}
