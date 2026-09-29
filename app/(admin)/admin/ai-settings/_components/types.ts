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
  /** USD → BDT rate, editable from the catalogue toolbar. */
  usdToBdtRate: number;
}

/**
 * Previews an OpenRouter USD token price in BDT.
 *
 * The rate is passed in rather than imported: it is admin-editable, and every
 * caller already holds the live value from the settings payload — so the table,
 * the combobox and the toolbar header can never drift onto different rates.
 */
export const formatPriceWithBDT = (usdPrice: number, usdToBdtRate: number) => {
  const bdtPrice = Math.round(usdPrice * usdToBdtRate);
  return `$${usdPrice.toFixed(2)} (৳${bdtPrice.toLocaleString()})`;
};

/**
 * ফিল্টার ও সাজানোর জন্য একটি মডেলের "দাম" — prompt ও completion-এর গড়, প্রতি 1M token-এ।
 *
 * ⚠️ এটাই কোডবেসের প্রচলিত হিসাব। `fetch-models` route tier ঠিক করার সময় ঠিক
 *    এই গড়টাই (`avgCostPerM`) ব্যবহার করে। তাই দাম দিয়ে সাজালে আর tier-এর
 *    ক্রমে সাজালে কখনো পরস্পরবিরোধী উত্তর আসবে না।
 */
export const blendedPricePerM = (model: {
  promptPrice: number;
  completionPrice: number;
}) => (model.promptPrice + model.completionPrice) / 2;
