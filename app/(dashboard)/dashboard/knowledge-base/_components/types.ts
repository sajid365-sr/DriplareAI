/**
 * Shared types for the AI Training & Knowledge Engine.
 * Kept in one place so every KB section speaks the same shape.
 */

/** A connected AI agent / chatbot the knowledge is trained into. */
export type KBAgent = {
  id: string;
  name: string;
  workspaceId?: string | null;
};

/** The main navigation surfaces for shared business knowledge and agent setup. */
export type KBTabId = "business-profile" | "answers" | "sources" | "agent-instructions" | "content-training";

/** A direct question → answer pair. */
export type FAQItem = {
  id: string;
  question: string;
  answer: string;
  archived?: boolean;
};

/** A tone/persona example: what a customer says and how the AI should reply. */
export type SampleReply = {
  id: string;
  customerMessage: string;
  reply: string;
  archived?: boolean;
};

/** A RAG content source (file, pasted text, scraped website, or imported chat). */
export type ContentSource = {
  sourceId: string;
  type: "file" | "text" | "website";
  name: string;
  charCount: number;
  content?: string;
};

/** Props shared by every section — each is scoped to the active agent. */
export type KBSectionProps = {
  agentId: string;
  agentName: string;
  workspaceId?: string;
  initialScope?: "agent" | "workspace";
  scope?: KnowledgeScope;
  onWorkspaceKnowledgeChange?: () => void;
};

export type KnowledgeScope = "agent" | "workspace";

export type ContentTrainingSectionProps = Omit<KBSectionProps, "initialScope"> & {
  scope: KnowledgeScope;
  onWorkspaceSourcesChange?: (count: number) => void;
};
