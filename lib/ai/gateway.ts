import "server-only";

import type OpenAI from "openai";

import { AIError, isAIError, type AIErrorCode } from "@/lib/ai/ai-error";
import { resolveAttemptOrder, resolvePrimaryModel } from "@/lib/ai/fallback-resolver";
import { getOpenRouterClient } from "@/lib/ai/openrouter-client";
import { assertAIQuota } from "@/lib/ai/quota-guard";
import { logAiUsage } from "@/lib/ai/usage-logger";
import {
  runModelChain,
  type AttemptResult,
  type ModelUsage,
} from "@/lib/domain/ai-attempt-loop";
import { DEFAULT_RETRY_POLICY, type AttemptFailure, type RetryPolicy } from "@/lib/domain/ai-retry";
import { EMBEDDING_MODEL_ID, getTaskPolicy, type AITask } from "@/lib/domain/ai-task";

// ══════════════════════════════════════════════════════════════════════════════
// AI Gateway — the one door to OpenRouter
// ══════════════════════════════════════════════════════════════════════════════
//
// Every AI call the Next.js app makes comes through here, so four things happen
// in one place instead of being re-derived — or forgotten — at each of the call
// sites:
//
//   ১. **Quota**    — the balance is read *before* anything is spent.
//   ২. **Fallback** — a failed model is followed by a different one, chosen by
//                     `lib/domain/ai-fallback.ts` rather than by hand.
//   ৩. **Retry**    — 429/5xx/network are waited out inside a wall-clock budget.
//   ৪. **Logging**  — task, latency, and whether a fallback happened, so
//                     TASK-14's cost analysis has something real to read.
//
// This file is the **wiring**: it reads the database, talks to OpenRouter, and
// writes the ledger. The rules it wires together live in `lib/domain/`, which is
// why they can be tested without a database or a network — including the model
// chain itself, in `lib/domain/ai-attempt-loop.ts`.
//
// ── What this file deliberately does **not** do ──────────────────────────────
//
//   • **It does not deduct credits.** `chargeUsage()` remains the only thing
//     that moves a balance, and its callers are unchanged. Two writers to one
//     balance is how a reply gets billed twice, and the n8n path already bills
//     through `POST /api/internal/ai-usage`. The gateway *reads* the balance to
//     decide whether to proceed; it never writes it.
//
//   • **It cannot protect the customer-facing reply.** That reply is generated
//     inside n8n with n8n's own OpenRouter credential and never passes through
//     this file. Closing that half is TASK-10 Part B and needs a workflow change.
// ══════════════════════════════════════════════════════════════════════════════

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;

export type { ModelUsage };

export interface CallModelResult {
  text: string;
  /** The model that actually answered. */
  model: string;
  /** The model tried first — differs from `model` when a fallback happened. */
  fallbackFrom: string | null;
  usage: ModelUsage;
  latencyMs: number;
  /** Every model tried, in order, including a repeat after a retry. */
  tried: string[];
}

export interface ChatProviderRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  timeoutMs: number;
}

export type ChatProvider = (request: ChatProviderRequest) => Promise<AttemptResult<string>>;

export type EmbeddingProvider = (request: {
  model: string;
  input: string | string[];
  timeoutMs: number;
}) => Promise<AttemptResult<number[][]>>;

export interface CallModelInput {
  task: AITask;
  messages: ChatMessage[];
  /** Where the customer came from. Defaults to the task's legacy channel. */
  channel?: string;
  sessionId?: string;
  userId?: string | null;
  chatbotId?: string | null;
  workspaceId?: string | null;
  /** Primary model. Defaults to the task's own default. */
  model?: string | null;
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for a JSON object response. */
  json?: boolean;
  isFreeMessage?: boolean;
  isTestChat?: boolean;
  runId?: string;
  /** Total wall clock this call may consume, sleeps included. */
  budgetMs?: number;
  retry?: Partial<RetryPolicy>;
  /** Skips the ledger write — for the inner calls of a batch logged once at the end. */
  skipLogging?: boolean;
  /** Skips the quota gate — for the inner calls of a batch already gated at the top. */
  skipQuota?: boolean;
  /** Test seam. Replaces the network call, leaving every rule above intact. */
  callProvider?: ChatProvider;
}

// ─── Provider adapters ────────────────────────────────────────────────────────
//
// Everything that knows the shape of an OpenRouter error, or of an OpenRouter
// response, is confined to this section. Above it, failures are the four
// categories `ai-retry.ts` understands.

/**
 * Rough token count, used only when the provider omits its usage block.
 *
 * The alternative is writing a zero-token row, which is worse than an estimate:
 * it does not merely lack precision, it actively reports "this call was free"
 * and drags every average in TASK-14's cost analysis towards zero. Four
 * characters per token is the usual English rule of thumb and is the same
 * estimate the pre-gateway code used.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * `Retry-After` may be a number of seconds or an HTTP date, and the header is
 * reachable either through a `get()` accessor or as a plain property depending
 * on which fetch implementation the SDK used. Both are handled. A nonsense value
 * is discarded rather than trusted — a provider that answers "wait 10 years"
 * must not park the caller — and so is a value so large it can only be a bug.
 */
function parseRetryAfterMs(headers: unknown): number | null {
  if (!headers || typeof headers !== "object") return null;

  const source = headers as { get?: (name: string) => string | null } & Record<string, unknown>;
  const raw =
    typeof source.get === "function" ? source.get("retry-after") : (source["retry-after"] ?? source["Retry-After"]);

  if (typeof raw !== "string" && typeof raw !== "number") return null;

  const asNumber = Number(raw);
  const ms = Number.isFinite(asNumber) ? asNumber * 1000 : Date.parse(String(raw)) - Date.now();

  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.min(ms, DEFAULT_RETRY_POLICY.maxDelayMs * 4);
}

/** Turns whatever the SDK threw into one of the failure shapes the planner knows. */
function toAttemptFailure(error: unknown): AttemptFailure {
  if (typeof error === "object" && error !== null) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      return { kind: "http", status, retryAfterMs: parseRetryAfterMs((error as { headers?: unknown }).headers) };
    }
  }

  return { kind: "network" };
}

const defaultChatProvider: ChatProvider = async ({ model, messages, temperature, maxTokens, json, timeoutMs }) => {
  try {
    const client = getOpenRouterClient();

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    };

    const completion = await client.chat.completions.create(params, { timeout: timeoutMs, maxRetries: 0 });

    const text = completion.choices[0]?.message?.content ?? "";
    // An empty completion reaches the customer as silence, so it is a failure
    // worth another model rather than a successful answer.
    if (!text.trim()) return { kind: "empty" };

    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? estimateTokens(messages.map((m) => (typeof m.content === "string" ? m.content : "")).join(" "));
    const completionTokens = usage?.completion_tokens ?? estimateTokens(text);

    return {
      kind: "success",
      value: text,
      promptTokens,
      completionTokens,
      totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
    };
  } catch (error) {
    return toAttemptFailure(error);
  }
};

const defaultEmbeddingProvider: EmbeddingProvider = async ({ model, input, timeoutMs }) => {
  try {
    const client = getOpenRouterClient();
    const response = await client.embeddings.create({ model, input }, { timeout: timeoutMs, maxRetries: 0 });

    const vectors = response.data.map((item) => item.embedding);
    if (vectors.length === 0) return { kind: "empty" };

    const usage = response.usage;
    const promptTokens = usage?.prompt_tokens ?? estimateTokens(Array.isArray(input) ? input.join(" ") : input);

    return {
      kind: "success",
      value: vectors,
      promptTokens,
      completionTokens: 0,
      totalTokens: usage?.total_tokens ?? promptTokens,
    };
  } catch (error) {
    return toAttemptFailure(error);
  }
};

// ─── Shared plumbing ──────────────────────────────────────────────────────────

function retryPolicy(input: { budgetMs?: number; retry?: Partial<RetryPolicy> }): RetryPolicy {
  return {
    ...DEFAULT_RETRY_POLICY,
    ...(input.retry ?? {}),
    ...(input.budgetMs !== undefined ? { budgetMs: input.budgetMs } : {}),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * A single chat-shaped AI call, with quota, fallback, retry and logging.
 *
 * @example
 * ```ts
 * const { text, model, fallbackFrom } = await callModel({
 *   task: "enhance_prompt",
 *   chatbotId,
 *   messages: [{ role: "user", content: prompt }],
 * });
 * ```
 */
export async function callModel(input: CallModelInput): Promise<CallModelResult> {
  const provider = input.callProvider ?? defaultChatProvider;
  const policy = retryPolicy(input);

  // The model is resolved **before** the quota check so a billed task is checked
  // against the real price of the model it will actually call, rather than
  // against zero.
  const primary = await resolvePrimaryModel(input.task, input.model);

  if (!input.skipQuota) {
    await assertAIQuota({
      task: input.task,
      userId: input.userId,
      chatbotId: input.chatbotId,
      workspaceId: input.workspaceId,
      modelId: primary.modelId,
      isTestChat: input.isTestChat,
      isFreeMessage: input.isFreeMessage,
    });
  }

  const order = await resolveAttemptOrder({
    task: input.task,
    primaryModelId: primary.modelId,
    primaryTier: primary.tier,
  });

  const startedAt = Date.now();

  const result = await runModelChain<string>({
    task: input.task,
    order,
    policy,
    startedAt,
    attempt: (model, timeoutMs) =>
      provider({
        model,
        messages: input.messages,
        temperature: input.temperature,
        maxTokens: input.maxTokens,
        json: input.json,
        timeoutMs,
      }),
  });

  const latencyMs = Date.now() - startedAt;
  const fallbackFrom = result.model === primary.modelId ? null : primary.modelId;

  if (!input.skipLogging) {
    // Fire-and-forget, matching the rest of the codebase: the logger swallows
    // its own errors, so a logging outage can never fail a reply.
    void logAiUsage({
      task: input.task,
      channel: input.channel?.trim() || getTaskPolicy(input.task).legacyChannel,
      userId: input.userId ?? undefined,
      chatbotId: input.chatbotId ?? undefined,
      workspaceId: input.workspaceId ?? undefined,
      sessionId: input.sessionId ?? undefined,
      modelId: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      latencyMs,
      fallbackFrom,
      isTestChat: input.isTestChat,
      isFreeMessage: input.isFreeMessage,
      runId: input.runId,
    });
  }

  return {
    text: result.value,
    model: result.model,
    fallbackFrom,
    usage: result.usage,
    latencyMs,
    tried: result.tried,
  };
}

export interface CallEmbeddingsInput {
  input: string | string[];
  userId?: string | null;
  chatbotId?: string | null;
  workspaceId?: string | null;
  channel?: string;
  isFreeMessage?: boolean;
  budgetMs?: number;
  retry?: Partial<RetryPolicy>;
  skipLogging?: boolean;
  skipQuota?: boolean;
  /** Test seam. */
  callProvider?: EmbeddingProvider;
}

export interface CallEmbeddingsResult {
  vectors: number[][];
  model: string;
  usage: ModelUsage;
  latencyMs: number;
  tried: string[];
}

/**
 * Embeddings, which are a separate entry point for one reason: the model is not
 * a choice.
 *
 * `EMBEDDING_MODEL_ID` is fixed and `AI_TASK_POLICY.embedding` forbids model
 * fallback, so the chain is always a single model. Vectors from any other model
 * would not be comparable to the chunks already stored, and retrieval would
 * return confident nonsense instead of an error. Retrying the *same* model is
 * still worthwhile — a 429 or a dropped socket is transient.
 */
export async function callEmbeddings(input: CallEmbeddingsInput): Promise<CallEmbeddingsResult> {
  const provider = input.callProvider ?? defaultEmbeddingProvider;
  const policy = retryPolicy(input);

  if (!input.skipQuota) {
    await assertAIQuota({
      task: "embedding",
      userId: input.userId,
      chatbotId: input.chatbotId,
      workspaceId: input.workspaceId,
      isFreeMessage: input.isFreeMessage,
    });
  }

  const order = await resolveAttemptOrder({ task: "embedding", primaryModelId: EMBEDDING_MODEL_ID });
  const startedAt = Date.now();

  const result = await runModelChain<number[][]>({
    task: "embedding",
    order,
    policy,
    startedAt,
    attempt: (model, timeoutMs) => provider({ model, input: input.input, timeoutMs }),
  });

  const latencyMs = Date.now() - startedAt;

  if (!input.skipLogging) {
    void logAiUsage({
      task: "embedding",
      channel: input.channel?.trim() || getTaskPolicy("embedding").legacyChannel,
      userId: input.userId ?? undefined,
      chatbotId: input.chatbotId ?? undefined,
      workspaceId: input.workspaceId ?? undefined,
      modelId: result.model,
      promptTokens: result.usage.promptTokens,
      completionTokens: 0,
      latencyMs,
      isFreeMessage: input.isFreeMessage,
    });
  }

  return {
    vectors: result.value,
    model: result.model,
    usage: result.usage,
    latencyMs,
    tried: result.tried,
  };
}

/**
 * Re-throws a gateway failure as itself, or wraps anything else. Callers use
 * this so a route can turn `error.code` into a status and a translation without
 * ever having to know how the failure was produced.
 */
export function toGatewayError(error: unknown): AIError {
  if (isAIError(error)) return error;
  return new AIError("all_models_failed", error instanceof Error ? error.message : "Unknown AI failure");
}
