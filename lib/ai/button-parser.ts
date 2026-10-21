/**
 * Feature #12: Quick-reply Buttons (General)
 *
 * Detects and extracts `[BUTTONS: opt1, opt2, ...]` markers in AI messages,
 * producing clean display text and structured button options for rendering
 * tappable quick-reply pills on Messenger, WhatsApp, and the Live Inbox.
 */

export interface ParsedButtonsResult {
  cleanText: string;
  buttons: string[];
  hasButtons: boolean;
}

/**
 * Extracts options from `[BUTTONS: Small, Medium, Large, XL]` syntax.
 * Removes the marker from the text so customers and staff don't see raw markup.
 */
export function parseQuickReplyButtons(text?: string | null): ParsedButtonsResult {
  if (!text) {
    return { cleanText: "", buttons: [], hasButtons: false };
  }

  // Matches [BUTTONS: option1, option2, ...] case-insensitively
  const buttonPattern = /\[BUTTONS:\s*([^\]]+)\]/i;
  const match = text.match(buttonPattern);

  if (!match) {
    return { cleanText: text, buttons: [], hasButtons: false };
  }

  const rawOptions = match[1];
  const buttons = rawOptions
    .split(/[,|]/)
    .map((opt) => opt.trim())
    .filter((opt) => opt.length > 0 && opt.length <= 40);

  const cleanText = text.replace(buttonPattern, "").trim();

  return {
    cleanText,
    buttons,
    hasButtons: buttons.length > 0,
  };
}

/**
 * Helper to wrap options into the standard button syntax.
 */
export function formatButtonsMarker(options: string[]): string {
  const clean = options.map((o) => o.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  return `[BUTTONS: ${clean.join(", ")}]`;
}

