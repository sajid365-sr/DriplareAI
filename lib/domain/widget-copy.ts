import bnWidget from "@/public/locales/bn/widget.json";
import enWidget from "@/public/locales/en/widget.json";

/**
 * The strings a *visitor* reads inside the embedded widget.
 *
 * This is a different audience from every other locale file in the project.
 * `integrations.json` speaks to the merchant ("Copy the embed code above");
 * these speak to a shopper who has never heard of Driplare and is standing on
 * the merchant's own website. So the wording has to survive being read with no
 * context at all — and, like `ai-errors.json`, it must never mention credits,
 * billing or plans. A visitor learning that the business ran out of money is
 * the merchant's loss, not the visitor's problem.
 *
 * ⚠️ This module is imported by a **route handler**, not a React tree, because
 *    the widget is served as a plain script to pages that have no React,
 *    no i18next and no build step of ours. Both languages therefore travel
 *    inside the served script and the browser picks one — see
 *    `renderWidgetScript()` in `lib/widget/render-script.ts`.
 */
export interface WidgetCopy {
  launcherLabel: string;
  title: string;
  subtitle: string;
  welcome: string;
  placeholder: string;
  send: string;
  close: string;
  typing: string;
  error: string;
  poweredBy: string;
}

export type WidgetLanguage = "en" | "bn";

/**
 * Both languages, keyed by code. A `const`, not a function: the script renderer
 * needs the whole table at once, and nothing here depends on the request.
 */
export const WIDGET_COPY: Record<WidgetLanguage, WidgetCopy> = {
  en: enWidget,
  bn: bnWidget,
};

/**
 * Which language a visitor should read.
 *
 * The rule is deliberately one line and lives here so that the two places that
 * need it cannot drift apart:
 *
 *   - the **browser**, inside the served script, from `navigator.language`;
 *   - the **server**, validating the `lang` the widget sends with each message
 *     (it decides which language a refusal comes back in).
 *
 * The served script re-implements this exact predicate in plain JS — it has to,
 * since it runs on a page we do not build. `lib/widget/render-script.ts` carries
 * a comment pointing back here so the pair stays findable.
 *
 * `startsWith("bn")` rather than `=== "bn"` because real browser tags carry a
 * region: `bn-BD`, `bn-IN`. Anything unrecognised falls back to English, which
 * is the safer failure for a visitor we cannot read.
 */
export function pickWidgetLanguage(value: unknown): WidgetLanguage {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("bn") ? "bn" : "en";
}
