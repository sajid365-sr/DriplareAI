// Shared types for the Model Comparison feature

export interface CompareChatMessage {
  id: string;
  role: "user" | "assistant";
  contentA?: string;
  contentB?: string;
  modelA?: string;
  modelB?: string;
  timestamp: Date;
}

export interface CompareSession {
  sessionId: string;
  title: string;
  platform: string;
  isActive: boolean;
  timestamp: string;
}
