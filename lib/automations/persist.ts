import "server-only";

import { Prisma } from "@prisma/client";
import {
  DEFAULT_FREQUENCY_CAP,
  DEFAULT_QUIET_HOURS,
  type AutomationWriteData,
  type Trigger,
} from "./schema";

/**
 * The one place a validated rule becomes a database write.
 *
 * `POST` and `PATCH` must produce byte-identical payloads for the same input —
 * if they drift, a rule silently changes shape when it is edited, which shows
 * up much later as an automation that behaves differently after a rename. Both
 * routes therefore build their data here.
 */

/**
 * Prisma will not accept plain `null` for a nullable `Json` column — it cannot
 * tell "JSON null" from "SQL NULL" and makes the caller say which.
 */
export function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/** Clear a nullable Json column back to SQL NULL. */
export const CLEARED = Prisma.DbNull;

/**
 * Everything in the trigger except its `type`, which is stored in its own
 * column. Keeping the discriminant out of the blob means the two can never
 * disagree — a mismatch would make `loadEngineRules` rebuild a trigger that
 * does not match the row's `triggerType`.
 */
export function triggerConfigOf(trigger: Trigger): Prisma.InputJsonValue {
  const { type: _type, ...rest } = trigger;
  return json(rest);
}

/**
 * Column values shared by insert and update. Extracted so the two paths cannot
 * drift: `toCreateData` only adds `workspaceId` on top.
 */
function columnsOf(input: AutomationWriteData) {
  return {
    chatbotId: input.chatbotId || null,
    name: input.name,
    description: input.description || null,
    kind: input.kind,
    status: input.status,
    priority: input.priority,
    stopOnMatch: input.stopOnMatch,
    matchMode: input.matchMode,
    triggerType: input.trigger.type,
    triggerConfig: triggerConfigOf(input.trigger),
    conditions: json(input.conditions),
    actions: json(input.actions),
    graph: input.graph ? json(input.graph) : CLEARED,
    // `PATCH` replaces the whole rule, so an omitted policy means "none" rather
    // than "leave whatever was there". Writing the resolved defaults keeps the
    // stored column complete, so a rule read straight from the database — by
    // the engine, or by a future export — never has to re-derive them.
    quietHours: json(input.quietHours ?? DEFAULT_QUIET_HOURS),
    frequencyCap: json(input.frequencyCap ?? DEFAULT_FREQUENCY_CAP),
  };
}

/**
 * Map validated input onto columns for an insert.
 *
 * `workspaceId` is deliberately the one field taken from the resolved scope
 * rather than the request body, so a client cannot write a rule into somebody
 * else's workspace.
 */
export function toCreateData(
  input: AutomationWriteData,
  workspaceId: string
): Prisma.AutomationUncheckedCreateInput {
  return { workspaceId, ...columnsOf(input) };
}

/** The same values for an update — identical by construction. */
export function toUpdateData(
  input: AutomationWriteData
): Prisma.AutomationUncheckedUpdateInput {
  return columnsOf(input);
}
