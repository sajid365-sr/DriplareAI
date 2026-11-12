/**
 * Client-safe shared types for the Auto-Train Engine UI.
 * Mirrors the server-side draft shape in `lib/ai/auto-train.ts` without importing
 * that (server-only) module into client components.
 */

export type AutoTrainDrafts = {
  faqs: Array<{ question: string; answer: string; evidence?: AutoTrainEvidence; duplicateOf?: string }>;
  sampleReplies: Array<{ customerMessage: string; reply: string; evidence?: AutoTrainEvidence; duplicateOf?: string }>;
  content: Array<{ title: string; content: string; evidence?: AutoTrainEvidence; duplicateOf?: string }>;
  answers?: Array<{ context: string; answer: string; evidence?: AutoTrainEvidence; duplicateOf?: string }>;
  runId?: string;
};

export type AutoTrainEvidence = {
  platform: string;
  label: string;
  quote: string;
  agentName?: string;
};

export type ConversationFetchMode = "recent" | "date_range" | "all_available";

export type ConversationSourceOptions = {
  mode: ConversationFetchMode;
  count: number;
  fromDate?: string;
  toDate?: string;
};
