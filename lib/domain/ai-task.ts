/**
 * The vocabulary of AI work, and the rules that differ per kind of work.
 *
 * Every gateway call must name its task, because the right behaviour is not the
 * same for all of them — the important one being embeddings, where falling back
 * to a different model would corrupt retrieval instead of saving it (see
 * `AI_TASK_POLICY`).
 *
 * This module is deliberately pure: no database, no `server-only`, no network.
 * The rules live here so they can be unit-tested, and so route handlers and the
 * gateway read the same table instead of each deciding for itself.
 */

export type AITask =
  /** A conversational reply — the playground/dashboard test chat today. */
  | "chat"
  /** Vector embedding for RAG (saving chunks and retrieving context). */
  | "embedding"
  /** Rewriting a merchant's prompt for them. */
  | "enhance_prompt"
  /** Translating a prompt between Bengali and English. */
  | "translate"
  /** Comparing a draft answer against the knowledge base. */
  | "compare"
  /** Turning pasted product text into structured catalogue rows. */
  | "text_ingest"
  /** Extracting products from an uploaded document. */
  | "product_extract"
  /** Auto-training: generating Q&A pairs from ingested sources. */
  | "auto_train"
  /** Vision-based product matching from uploaded customer images. */
  | "image_search";

export interface AITaskPolicy {
  /**
   * Whether a failed model may be swapped for another one.
   *
   * `false` only where a different model would change the meaning of the
   * output rather than just its quality — today that means embeddings alone.
   */
  allowsModelFallback: boolean;

  /**
   * Whether this task deducts credits from the merchant.
   *
   * ⚠️ Being `false` does **not** mean the work is free — it means the platform
   *    pays OpenRouter and never bills the merchant for it. That is a revenue
   *    leak, not a design choice, and it is why the quota floor in
   *    `lib/domain/ai-quota.ts` applies to every task and not just charged ones.
   */
  isCharged: boolean;

  /**
   * The value these calls used to write into `AIUsageLog.channel`, before
   * `task` existed as its own column. Kept so historical rows stay comparable
   * with new ones when building cost analytics.
   */
  legacyChannel: string;
}

/**
 * The one embedding model. It lives beside the rule that protects it, because
 * the rule is *about* this exact string: every chunk already in the database was
 * embedded with this model, and vectors from any other model are not comparable
 * to them. Changing this constant silently invalidates the whole knowledge base.
 *
 * Used for both saving chunks and retrieving RAG context — those two must never
 * diverge, or retrieval starts scoring against a different space than the one
 * the chunks were written in.
 */
export const EMBEDDING_MODEL_ID = "google/gemini-embedding-001";

/**
 * ⚠️ `embedding` must never fall back to another model.
 *
 * Vectors from a different model live in a different space, so cosine
 * similarity between them is meaningless — retrieval would keep returning 200
 * rows of confident nonsense instead of failing, and the AI would answer from
 * the wrong context with no error anywhere to explain it. A loud failure the
 * merchant can see is strictly better than silent retrieval corruption, so
 * embeddings retry the same model and then give up.
 */
export const AI_TASK_POLICY: Record<AITask, AITaskPolicy> = {
  chat: { allowsModelFallback: true, isCharged: true, legacyChannel: "chat" },
  embedding: { allowsModelFallback: false, isCharged: false, legacyChannel: "auto_train" },
  enhance_prompt: { allowsModelFallback: true, isCharged: false, legacyChannel: "enhance_prompt" },
  translate: { allowsModelFallback: true, isCharged: false, legacyChannel: "translate" },
  // ⚠️ The one non-embedding task that forbids fallback. A comparison is only
  //    meaningful if each answer really came from the model it is labelled with,
  //    and a fallback would swap the model behind the label — the merchant would
  //    read "GPT-4o" above text GPT-4o never wrote, and choose their model on a
  //    false reading. A failed model must stay failed here.
  compare: { allowsModelFallback: false, isCharged: false, legacyChannel: "compare" },
  text_ingest: { allowsModelFallback: true, isCharged: false, legacyChannel: "text_ingest" },
  product_extract: { allowsModelFallback: true, isCharged: false, legacyChannel: "product_extract" },
  auto_train: { allowsModelFallback: true, isCharged: false, legacyChannel: "auto_train" },
  image_search: { allowsModelFallback: true, isCharged: false, legacyChannel: "image_search" },
};

export const AI_TASKS = Object.keys(AI_TASK_POLICY) as AITask[];

export function getTaskPolicy(task: AITask): AITaskPolicy {
  return AI_TASK_POLICY[task];
}

/** Narrowing helper for values that arrive from outside the type system (routes, n8n). */
export function isAITask(value: unknown): value is AITask {
  return typeof value === "string" && value in AI_TASK_POLICY;
}
