import type { TFunction } from "i18next";

import { ACTION_CATALOG, TRIGGER_CATALOG } from "@/lib/automations/catalog";
import type { AutomationAction, Trigger } from "@/lib/automations/schema";

/**
 * Turn a rule into the one line the card shows: "what starts it → what it does".
 *
 * The catalog already holds the icon and the family; the label comes from the
 * locale, keyed by type. Nothing here is hard-coded English, so the same
 * function serves both languages.
 */

export function triggerLabel(t: TFunction, trigger: Trigger): string {
  return t(`triggers.${trigger.type}.label`, TRIGGER_CATALOG[trigger.type]?.type ?? trigger.type);
}

export function triggerIcon(trigger: Trigger): string {
  return TRIGGER_CATALOG[trigger.type]?.icon ?? "Zap";
}

export function actionLabel(t: TFunction, action: AutomationAction): string {
  return t(`actions.${action.type}.label`, ACTION_CATALOG[action.type]?.type ?? action.type);
}

export function actionIcon(action: AutomationAction): string {
  return ACTION_CATALOG[action.type]?.icon ?? "Zap";
}

/**
 * A short piece of evidence under the trigger — the keywords being watched, or
 * how long "idle" means. Without it two keyword rules look identical on the
 * list and the merchant has to open each one to tell them apart.
 */
export function triggerDetail(trigger: Trigger, isBn: boolean): string | null {
  switch (trigger.type) {
    case "keyword.match":
      return trigger.keywords.length > 0 ? trigger.keywords.slice(0, 4).join(", ") : null;
    case "comment.created":
      return trigger.keywords.length > 0 ? trigger.keywords.slice(0, 4).join(", ") : null;
    case "session.idle":
      return isBn ? `${trigger.idleMinutes} মিনিট` : `${trigger.idleMinutes} min`;
    case "cart.abandoned":
      return isBn ? `${trigger.afterMinutes} মিনিট পর` : `after ${trigger.afterMinutes} min`;
    case "order.status_changed":
      return trigger.statuses.length > 0 ? trigger.statuses.join(", ") : null;
    case "lead.status_changed":
      return trigger.statuses.length > 0 ? trigger.statuses.join(", ") : null;
    case "sentiment.changed":
      return trigger.values.length > 0 ? trigger.values.join(", ") : null;
    default:
      return null;
  }
}

/**
 * The first line of a message action, so the card shows what the customer would
 * actually read rather than just "Send a message".
 */
export function actionPreview(action: AutomationAction): string | null {
  const body =
    action.type === "send_text" || action.type === "send_quick_replies"
      ? action.body
      : action.type === "send_media"
        ? action.caption
        : action.type === "add_note"
          ? action.text
          : action.type === "notify_merchant"
            ? action.message
            : action.type === "send_email"
              ? action.body
              : action.type === "handoff_to_human"
                ? action.note
                : null;

  if (!body) return null;
  return body.replace(/\s+/g, " ").trim().slice(0, 90);
}
