/**
 * Every failure the AI gateway can report, as one typed error.
 *
 * Why a single class carrying a `code` instead of one subclass per failure: the
 * callers are route handlers and n8n callbacks, and every one of them needs the
 * same three things — an HTTP status, a stable string to look a translation up
 * by, and whether retrying could ever help. With subclasses each caller would
 * have to narrow a union before it could read the status; here `error.code` is
 * enough to switch on, and the message is never shown to a customer.
 *
 * The `isAIError` helper checks a brand property rather than using `instanceof`,
 * because `instanceof` compares class identity — and a Next.js server can hold
 * two copies of the same module in one process (route handlers get their own
 * bundle), which would make a re-thrown error fail its own check.
 */

export type AIErrorCode =
  /** No `OPENROUTER_API_KEY` in the environment — nothing can be called at all. */
  | "not_configured"
  /** The owner's credits ran out. The call was never made, so nothing was spent. */
  | "quota_exceeded"
  /** An admin suspended the workspace. */
  | "workspace_suspended"
  /**
   * OpenRouter answered 402 for every model. This is an account-level failure,
   * not a model-level one: the platform's own OpenRouter balance is gone, so
   * every workspace is about to stop at once. Needs a human, not a retry.
   */
  | "provider_out_of_credit"
  /** Every model in the chain refused with a rate limit. */
  | "rate_limited"
  /** Every model failed for any other reason — retired id, 5xx, network. */
  | "all_models_failed";

const HTTP_STATUS: Record<AIErrorCode, number> = {
  not_configured: 503,
  quota_exceeded: 402,
  workspace_suspended: 403,
  provider_out_of_credit: 503,
  rate_limited: 429,
  all_models_failed: 502,
};

/**
 * Codes that mean "the platform itself is broken" rather than "this merchant
 * cannot do this". Only these should page an admin — a merchant out of credits
 * is a normal Tuesday, an exhausted OpenRouter balance is an outage.
 */
const OPERATIONAL_CODES: readonly AIErrorCode[] = ["not_configured", "provider_out_of_credit"];

export interface AIErrorDetails {
  task?: string;
  /** The model that was being called when the failure was final. */
  model?: string;
  /** Model ids tried, in order. For the logs and the admin UI — never a customer. */
  tried?: string[];
  attempts?: number;
  latencyMs?: number;
}

export class AIError extends Error {
  /** Brand read by `isAIError`. Survives every bundling and re-export path. */
  readonly isAIError = true as const;

  readonly code: AIErrorCode;
  readonly status: number;
  readonly details: AIErrorDetails;

  constructor(code: AIErrorCode, message: string, details: AIErrorDetails = {}) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.details = details;
  }

  /** True when a human has to fix something outside this request. */
  get isOperational(): boolean {
    return OPERATIONAL_CODES.includes(this.code);
  }
}

export function isAIError(error: unknown): error is AIError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { isAIError?: unknown }).isAIError === true &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

/** Keeps the reason in the logs while never letting a stack trace reach a customer. */
export function toAIError(error: unknown, fallbackCode: AIErrorCode = "all_models_failed"): AIError {
  if (isAIError(error)) return error;
  return new AIError(fallbackCode, error instanceof Error ? error.message : "Unknown AI failure");
}
