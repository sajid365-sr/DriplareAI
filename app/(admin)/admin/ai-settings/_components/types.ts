import { type OpenRouterModelConfig } from "@/components/admin/ai-settings/ModelConfigSheet";

export interface AISettingsData {
  quickSetup: {
    fastModel: string;
    smartModel: string;
    geniusModel: string;
  };
  models: OpenRouterModelConfig[];
  minCreditThreshold: number;
  defaultProvider: string;
  testChatMultiplier: number;
}

export const formatPriceWithBDT = (usdPrice: number) => {
  const bdtPrice = Math.round(usdPrice * 120);
  return `$${usdPrice.toFixed(2)} (৳${bdtPrice.toLocaleString()})`;
};
