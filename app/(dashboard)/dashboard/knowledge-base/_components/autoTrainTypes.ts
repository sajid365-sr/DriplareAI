/**
 * Client-safe shared types for the Auto-Train Engine UI.
 * Mirrors the server-side draft shape in `lib/ai/auto-train.ts` without importing
 * that (server-only) module into client components.
 */

export type AutoTrainDrafts = {
  faqs: Array<{ question: string; answer: string }>;
  sampleReplies: Array<{ customerMessage: string; reply: string }>;
  content: Array<{ title: string; content: string }>;
};
