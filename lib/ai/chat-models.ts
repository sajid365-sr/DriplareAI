import { type ModelTier } from "@/lib/domain/credit-config";

export type ChatModelConfig = {
  provider: string;
  model: string;
  label: string;
  openRouterModel: string;
  tier: ModelTier;       // credit tier: economy | standard | premium
  note?: string;
};

export const CHAT_MODELS: ChatModelConfig[] = [
  {
    provider: "gemini",
    model: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    openRouterModel: "google/gemini-2.5-flash-lite",
    tier: "economy",
    note: "Default low-cost model",
  },
  {
    provider: "gemini",
    model: "google/gemini-2.0-flash-lite-001",
    label: "Gemini 2.0 Flash Lite",
    openRouterModel: "google/gemini-2.0-flash-lite-001",
    tier: "economy",
    note: "Lowest cost, but older model",
  },
  {
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B Instruct",
    openRouterModel: "meta-llama/llama-3.3-70b-instruct",
    tier: "standard",
    note: "High performance open-source model",
  },
  {
    provider: "openrouter",
    model: "meta-llama/llama-3.1-8b-instruct",
    label: "Llama 3.1 8B Instruct",
    openRouterModel: "meta-llama/llama-3.1-8b-instruct",
    tier: "economy",
    note: "Fast and very cheap for simple tasks",
  },
  {
    provider: "openrouter",
    model: "google/gemma-2-9b-it",
    label: "Gemma 2 9B Instruct",
    openRouterModel: "google/gemma-2-9b-it",
    tier: "economy",
    note: "Excellent performance to cost ratio",
  },
  {
    provider: "openrouter",
    model: "qwen/qwen-2.5-72b-instruct",
    label: "Qwen 2.5 72B",
    openRouterModel: "qwen/qwen-2.5-72b-instruct",
    tier: "standard",
    note: "Powerful model with great reasoning",
  },
  {
    provider: "gemini",
    model: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    openRouterModel: "google/gemini-2.5-flash",
    tier: "standard",
    note: "Fast and versatile standard model",
  },
  {
    provider: "openrouter",
    model: "anthropic/claude-3-haiku",
    label: "Claude 3 Haiku",
    openRouterModel: "anthropic/claude-3-haiku",
    tier: "standard",
    note: "Fast and affordable Claude model",
  },
  {
    provider: "openrouter",
    model: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    openRouterModel: "openai/gpt-4o-mini",
    tier: "standard",
    note: "Fast, affordable, and smart ChatGPT model",
  },
  {
    provider: "openrouter",
    model: "openai/gpt-4o",
    label: "GPT-4o",
    openRouterModel: "openai/gpt-4o",
    tier: "premium",
    note: "High intelligence flagship ChatGPT model",
  },
  {
    provider: "openrouter",
    model: "deepseek/deepseek-chat",
    label: "DeepSeek V3",
    openRouterModel: "deepseek/deepseek-chat",
    tier: "economy",
    note: "Extremely affordable and highly capable",
  },
  {
    provider: "openrouter",
    model: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet",
    openRouterModel: "anthropic/claude-3.5-sonnet",
    tier: "premium",
    note: "Top-tier reasoning and coding performance",
  },
  {
    provider: "openrouter",
    model: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku",
    openRouterModel: "anthropic/claude-3.5-haiku",
    tier: "standard",
    note: "Fastest and most capable Haiku model",
  },
  {
    provider: "openrouter",
    model: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    openRouterModel: "deepseek/deepseek-r1",
    tier: "premium",
    note: "Powerful new reasoning and logic model",
  },
  {
    provider: "openrouter",
    model: "openai/o1-preview",
    label: "OpenAI o1 Preview",
    openRouterModel: "openai/o1-preview",
    tier: "premium",
    note: "Advanced complex problem solving",
  },
  {
    provider: "openrouter",
    model: "openai/o1-mini",
    label: "OpenAI o1 Mini",
    openRouterModel: "openai/o1-mini",
    tier: "premium",
    note: "Fast and smart reasoning for technical tasks",
  },
  {
    provider: "openrouter",
    model: "google/gemini-pro-1.5",
    label: "Gemini 1.5 Pro",
    openRouterModel: "google/gemini-pro-1.5",
    tier: "premium",
    note: "Massive context window and high reasoning",
  },
  {
    provider: "openrouter",
    model: "mistralai/mistral-large",
    label: "Mistral Large",
    openRouterModel: "mistralai/mistral-large",
    tier: "premium",
    note: "Flagship high-performance Mistral model",
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
