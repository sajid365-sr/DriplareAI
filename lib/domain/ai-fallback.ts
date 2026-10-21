/**
 * Builds the ordered list of models to try after the primary one fails.
 *
 * Pure on purpose: the live model catalogue is fetched elsewhere and passed in,
 * so the ordering rules can be tested without a database or a network call.
 *
 * Four rules, each of which exists because of a specific way the naive version
 * went wrong:
 *
 *   1. **Never the primary again.** A model that just failed with a retired id
 *      will fail identically on the retry.
 *   2. **Never a more expensive model.** Quietly upgrading a merchant to a
 *      pricier model because the cheap one was busy means their credit balance
 *      drains faster than the dashboard promised. Cheaper or equal only.
 *   3. **Spread across providers.** The whole point of a fallback chain is the
 *      case where a provider is down; two fallbacks that both belong to the
 *      failed provider's vendor add nothing.
 *   4. **Deterministic order.** The same catalogue and the same primary must
 *      always produce the same chain, otherwise an incident cannot be
 *      reproduced from the logs.
 */

import type { ModelTier } from "@/lib/domain/credit-config";

export interface FallbackCandidate {
  modelId: string;
  tier: ModelTier;
  /** Display name of the model's OpenRouter vendor, e.g. "OpenAI", "Google". */
  providerName?: string;
}

export interface FallbackChainInput {
  primaryModelId: string;
  /** The primary's tier. Without it, rule 2 cannot be applied and order is by tier only. */
  primaryTier?: ModelTier;
  candidates: FallbackCandidate[];
  maxFallbacks?: number;
}

/** Two is enough to survive a provider outage without making a slow reply slower. */
export const DEFAULT_MAX_FALLBACKS = 2;

const TIER_RANK: Record<ModelTier, number> = { economy: 0, standard: 1, premium: 2 };

export function buildFallbackChain({
  primaryModelId,
  primaryTier,
  candidates,
  maxFallbacks = DEFAULT_MAX_FALLBACKS,
}: FallbackChainInput): string[] {
  const primaryRank = primaryTier ? TIER_RANK[primaryTier] : null;
  const primaryProvider = candidates.find((candidate) => candidate.modelId === primaryModelId)?.providerName;

  const seen = new Set<string>([primaryModelId]);
  const scored: Array<{ modelId: string; costDistance: number; sameProvider: boolean; providerName?: string }> = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.modelId)) continue;

    const rank = TIER_RANK[candidate.tier];
    if (primaryRank !== null && rank > primaryRank) continue;

    seen.add(candidate.modelId);
    scored.push({
      modelId: candidate.modelId,
      // Lower is better.
      //
      // With a known primary tier: how much *cheaper* the candidate is, so 0
      // means "same tier" — the closest thing to the model the merchant chose.
      //
      // With an unknown primary tier the cost ceiling cannot be applied at all,
      // so the candidate's own tier rank is used instead. That orders the chain
      // cheapest-first rather than leaving it to alphabetical accident, which is
      // the safe way to be ignorant: the fallback may not be the ideal match,
      // but it will never be a surprise upgrade.
      costDistance: primaryRank === null ? rank : primaryRank - rank,
      sameProvider: primaryProvider !== undefined && candidate.providerName === primaryProvider,
      providerName: candidate.providerName,
    });
  }

  scored.sort(
    (a, b) =>
      a.costDistance - b.costDistance ||
      Number(a.sameProvider) - Number(b.sameProvider) ||
      a.modelId.localeCompare(b.modelId)
  );

  const chain: string[] = [];
  const usedProviders = new Set<string>(primaryProvider ? [primaryProvider] : []);

  // First pass — one model per provider, so no link in the chain shares a fate
  // with the one before it.
  for (const entry of scored) {
    if (chain.length >= maxFallbacks) break;
    if (entry.providerName && usedProviders.has(entry.providerName)) continue;

    chain.push(entry.modelId);
    if (entry.providerName) usedProviders.add(entry.providerName);
  }

  // Second pass — a same-provider retry beats no fallback at all, which is the
  // normal situation when the admin panel has only one vendor enabled.
  if (chain.length < maxFallbacks) {
    for (const entry of scored) {
      if (chain.length >= maxFallbacks) break;
      if (chain.includes(entry.modelId)) continue;

      chain.push(entry.modelId);
    }
  }

  return chain;
}

/** The full attempt order: primary first, then the chain. */
export function buildAttemptOrder(input: FallbackChainInput & { allowsFallback: boolean }): string[] {
  const { allowsFallback, ...chainInput } = input;
  return allowsFallback
    ? [chainInput.primaryModelId, ...buildFallbackChain(chainInput)]
    : [chainInput.primaryModelId];
}
