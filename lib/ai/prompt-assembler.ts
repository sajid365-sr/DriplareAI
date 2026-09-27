import { translateToEnglish } from "./translation";

/**
 * SYSTEM_HEADER — Critical safety & tool-calling directives prepended to every
 * compiled system prompt. Enforces zero-guessing, mandatory tool usage, and a
 * graceful fallback protocol.
 */
export const SYSTEM_HEADER = `[CRITICAL SYSTEM DIRECTIVE - DO NOT IGNORE]
1. ZERO GUESSING POLICY: Never fabricate prices, stock status, delivery charges, or product specifications.
2. MANDATORY TOOL CALLING: Before answering any product, pricing, or order inquiry, you MUST execute the appropriate search tool (\`search_products\` / \`get_knowledge\`).
3. FALLBACK PROTOCOL: If information is missing from tool responses, politely state: "I don't have this exact information right now. Let me connect you with a human representative." and flag the session.`;

/**
 * SYSTEM_FOOTER — Order/Booking collection state machine appended to every
 * compiled system prompt. Enforces a strict slot-filling sequence and only
 * executes `create_order` after explicit customer confirmation.
 */
export const SYSTEM_FOOTER = `[SLOT FILLING & ORDER PROTOCOL]
Follow a strict step-by-step sequence when taking orders/bookings:
Step 1: Confirm product name, variant/size, and quantity.
Step 2: Collect customer Full Name and valid 10-11 digit Phone Number.
Step 3: Collect full Delivery Address (District, Thana, Road/Area).
Step 4: Present order summary (Item total + Delivery charge) and explicitly ask: "Would you like me to confirm this order?"
Step 5: Execute \`create_order\` tool ONLY after receiving explicit customer confirmation ("Yes", "Confirm", "হ্যাঁ").`;

/**
 * Optional category-specific instruction blocks injected between the translated
 * user prompt and the footer. Kept small so the assembler stays a pure utility.
 */
const CATEGORY_INSTRUCTIONS: Record<string, string> = {
  ecommerce:
    "You are operating as an e-commerce sales assistant. Always prioritize product discovery, accurate pricing, and smooth order collection.",
  support:
    "You are operating as a customer support agent. Prioritize accurate, empathetic answers grounded in the knowledge base.",
  lead_gen:
    "You are operating as a lead generation specialist. Guide conversations toward collecting qualified contact information.",
  restaurant:
    "You are operating as a digital waiter. Help with the menu, take food orders, and confirm delivery details.",
  general: "",
};

/**
 * Lightweight language detection — returns "bn" when the text contains Bengali
 * Unicode characters, otherwise "en". Used to short-circuit translation calls.
 */
export function detectLanguage(text: string): "bn" | "en" {
  // Bengali Unicode Range: \u0980 - \u09FF
  return /[\u0980-\u09FF]/.test(text) ? "bn" : "en";
}

/**
 * Compiles a raw (possibly Bengali/Banglish) user prompt into the full
 * production system prompt:
 *
 *   SYSTEM_HEADER + translated English user prompt + SYSTEM_FOOTER
 *
 * @param rawPrompt - Exact user input text (Bengali, Banglish, or English).
 * @param templateCategory - Optional business category (ecommerce, support, ...)
 *   used to inject a category-specific instruction block.
 * @returns The fully assembled English system prompt.
 */
export async function compilePrompt(
  rawPrompt: string,
  templateCategory?: string
): Promise<string> {
  const trimmed = (rawPrompt ?? "").trim();
  if (!trimmed) {
    throw new Error("compilePrompt: rawPrompt is required");
  }

  // Translate Bengali/Banglish input to professional English instructions.
  const translated = await translateToEnglish(trimmed);

  const categoryBlock = templateCategory
    ? CATEGORY_INSTRUCTIONS[templateCategory] ?? ""
    : "";

  const parts = [SYSTEM_HEADER, translated];
  if (categoryBlock) parts.push(categoryBlock);
  parts.push(SYSTEM_FOOTER);

  return parts.join("\n\n");
}