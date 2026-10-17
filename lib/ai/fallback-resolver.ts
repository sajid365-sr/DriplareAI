import "server-only";

import { buildAttemptOrder, type FallbackCandidate } from "@/lib/domain/ai-fallback";
import { EMBEDDING_MODEL_ID, getTaskPolicy, type AITask } from "@/lib/domain/ai-task";
import type { ModelTier } from "@/lib/domain/credit-config";
import { getDefaultResolvedModel, getLiveChatModels } from "@/lib/ai/chat-models";

/**
 * Turns "call this model" into "try these models, in this order".
 *
 * The ordering rules live in `lib/domain/ai-fallback.ts`; this module only
 * supplies them with the live catalogue, and with the two decisions that need
 * the database: which model a task should use by default, and which tier it
 * belongs to (the tier is what stops a fallback from being a silent upgrade).
 */

export interface PrimaryModel {
  modelId: string;
  /**
   * `undefined` when the catalogue does not recognise the id — a merchant
   * pinned to a model the admin has since disabled, for instance. The fallback
   * builder then orders cheapest-first instead of guessing a ceiling.
   */
  tier?: ModelTier;
}

/**
 * ⚠️ A catalogue outage must never stop an AI call. The fallback chain is an
 *    optimisation for a bad day; the primary model still deserves its attempt
 *    on a worse one. `getTrustedOpenRouterModels` already degrades to a
 *    hard-coded list, so this catch is the second line of defence.
 */
async function readCandidates(): Promise<FallbackCandidate[]> {
  try {
    const models = await getLiveChatModels();

    return models.map((model) => ({
      modelId: model.openRouterModel,
      tier: model.tier,
      providerName: model.providerName,
    }));
  } catch (error) {
    console.error("[AI_FALLBACK] catalogue unavailable, staying on the primary model", error);
    return [];
  }
}

/**
 * The model to try first.
 *
 * Embeddings are fixed by `EMBEDDING_MODEL_ID` — the caller cannot choose one,
 * because the knowledge base was written with that model and a different one
 * would not be comparable to it. Everything else defaults to the admin's Smart
 * tier, which is what the dashboard already calls "default".
 */
export async function resolvePrimaryModel(task: AITask, requestedModel?: string | null): Promise<PrimaryModel> {
  const explicit = requestedModel?.trim();
  if (explicit) {
    const known = (await readCandidates()).find((candidate) => candidate.modelId === explicit);
    return { modelId: explicit, tier: known?.tier };
  }

  if (task === "embedding") {
    return { modelId: EMBEDDING_MODEL_ID };
  }

  const fallback = await getDefaultResolvedModel();
  return { modelId: fallback.modelId, tier: fallback.tier };
}

export interface AttemptOrderInput {
  task: AITask;
  primaryModelId: string;
  primaryTier?: ModelTier;
}

/**
 * The full list of models to try, primary first.
 *
 * Skips the catalogue read entirely for tasks that forbid fallback, so an
 * embedding batch does not pay for a list it will never use.
 */
export async function resolveAttemptOrder({ task, primaryModelId, primaryTier }: AttemptOrderInput): Promise<string[]> {
  const policy = getTaskPolicy(task);

  if (!policy.allowsModelFallback) {
    return [primaryModelId];
  }

  return buildAttemptOrder({
    primaryModelId,
    primaryTier,
    candidates: await readCandidates(),
    allowsFallback: true,
  });
}
