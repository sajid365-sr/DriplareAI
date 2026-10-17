import { OTHER_TASK, type ObservabilityTask } from "@/lib/domain/observability";

/**
 * Display names for the task buckets.
 *
 * Technical terms stay in English in both languages, as the project's
 * translation rules require — a Bengali merchant reading "Embedding" should see
 * the word they will meet in every other tool, not a transliteration of it. Only
 * the two bucket names that are genuinely prose (`chat`, and the catch-all) are
 * offered a Bengali form.
 */
export const TASK_LABELS: Record<ObservabilityTask, { key: string; fallback: string }> = {
  chat: { key: "task.chat", fallback: "Chat" },
  embedding: { key: "task.embedding", fallback: "Embedding" },
  enhance_prompt: { key: "task.enhancePrompt", fallback: "Prompt Enhancer" },
  translate: { key: "task.translate", fallback: "Translate" },
  compare: { key: "task.compare", fallback: "Model Compare" },
  text_ingest: { key: "task.textIngest", fallback: "Text Ingest" },
  product_extract: { key: "task.productExtract", fallback: "Product Extract" },
  auto_train: { key: "task.autoTrain", fallback: "Auto-Train" },
  [OTHER_TASK]: { key: "task.other", fallback: "Unclassified" },
};

/** Translation key and fallback for one task bucket. */
export function taskLabel(task: ObservabilityTask): { key: string; fallback: string } {
  return TASK_LABELS[task] ?? TASK_LABELS[OTHER_TASK];
}
