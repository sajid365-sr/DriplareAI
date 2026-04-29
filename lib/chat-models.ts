export type ChatModelConfig = {
  provider: "gemini";
  model: string;
  label: string;
  openRouterModel: string;
  note?: string;
};

export const CHAT_MODELS: ChatModelConfig[] = [
  {
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    openRouterModel: "google/gemini-2.5-flash-lite",
    note: "Default low-cost model",
  },
  {
    provider: "gemini",
    model: "gemini-2.0-flash-lite-001",
    label: "Gemini 2.0 Flash Lite",
    openRouterModel: "google/gemini-2.0-flash-lite-001",
    note: "Lowest cost, but older model",
  },
];

export const DEFAULT_CHAT_MODEL = CHAT_MODELS[0];

export function normalizeChatModel(provider?: string, model?: string) {
  return (
    CHAT_MODELS.find(
      (candidate) =>
        candidate.provider === provider && candidate.model === model
    ) || DEFAULT_CHAT_MODEL
  );
}

export function getOpenRouterModel(provider: string, model: string) {
  return normalizeChatModel(provider, model).openRouterModel;
}
