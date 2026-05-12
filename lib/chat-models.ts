export type ChatModelConfig = {
  provider: string;
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
  {
    provider: "openrouter",
    model: "llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    openRouterModel: "meta-llama/llama-3.3-70b-instruct",
    note: "High performance open-source model",
  },
  {
    provider: "openrouter",
    model: "llama-3.1-8b-instruct",
    label: "Llama 3.1 8B Instruct",
    openRouterModel: "meta-llama/llama-3.1-8b-instruct",
    note: "Fast and very cheap for simple tasks",
  },
  {
    provider: "openrouter",
    model: "gemma-2-9b-it",
    label: "Gemma 2 9B Instruct",
    openRouterModel: "google/gemma-2-9b-it",
    note: "Excellent performance to cost ratio",
  },
  {
    provider: "openrouter",
    model: "qwen-2.5-72b-instruct",
    label: "Qwen 2.5 72B",
    openRouterModel: "qwen/qwen-2.5-72b-instruct",
    note: "Powerful model with great reasoning",
  },
  {
    provider: "gemini",
    model: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    openRouterModel: "google/gemini-2.5-flash",
    note: "Fast and versatile standard model",
  },
  {
    provider: "openrouter",
    model: "claude-3-haiku",
    label: "Claude 3 Haiku",
    openRouterModel: "anthropic/claude-3-haiku",
    note: "Fast and affordable Claude model",
  },
  {
    provider: "openrouter",
    model: "gpt-4o-mini",
    label: "GPT-4o Mini",
    openRouterModel: "openai/gpt-4o-mini",
    note: "Fast, affordable, and smart ChatGPT model",
  },
  {
    provider: "openrouter",
    model: "gpt-4o",
    label: "GPT-4o",
    openRouterModel: "openai/gpt-4o",
    note: "High intelligence flagship ChatGPT model",
  },
  {
    provider: "openrouter",
    model: "deepseek-chat",
    label: "DeepSeek V3",
    openRouterModel: "deepseek/deepseek-chat",
    note: "Extremely affordable and highly capable",
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
