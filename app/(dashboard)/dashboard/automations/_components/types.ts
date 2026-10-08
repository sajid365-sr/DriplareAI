import type { AutomationAction, AutomationCondition, Trigger } from "@/lib/automations/schema";

/** Mirrors `AutomationDto` — the shape `/api/automations` returns. */
export interface Automation {
  automationId: string;
  chatbotId: string | null;
  name: string;
  description: string | null;
  kind: string;
  status: string;
  priority: number;
  stopOnMatch: boolean;
  matchMode: "all" | "any";
  trigger: Trigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  graph: { nodes: unknown[]; edges: unknown[] } | null;
  quietHours: { enabled: boolean; from: string; to: string; timezone: string };
  frequencyCap: { enabled: boolean; perContact: number; perWindowHours: number };
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  runs: { runsToday: number; sentToday: number; runsTotal: number; lastRunAt: string | null };
}

export interface AutomationsPayload {
  automations: Automation[];
  /**
   * When the engine last evaluated anything in this workspace. `null` means the
   * n8n `Automation Gate` has never called in, which is the single most likely
   * reason a merchant sees "nothing happens".
   */
  gateLastSeenAt: string | null;
  /**
   * Page-level counters, correct regardless of what the list below is filtered
   * to — see the note in `GET /api/automations`.
   */
  totals: { activeRules: number; runsToday: number; sentToday: number };
}

export interface AutomationAgent {
  id: string;
  name: string;
}

/** The three states a rule can be in, and how each one should look. */
export type StatusTone = "active" | "draft" | "paused" | "neutral" | "danger";

export interface StatusMeta {
  tone: StatusTone;
  labelKey: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  active: { tone: "active", labelKey: "status.active" },
  draft: { tone: "draft", labelKey: "status.draft" },
  paused: { tone: "paused", labelKey: "status.paused" },
  sending: { tone: "draft", labelKey: "status.sending" },
  scheduled: { tone: "draft", labelKey: "status.scheduled" },
  // `sent` is the good outcome in both places it appears — a finished broadcast
  // and a run whose reply reached the customer — so it is toned as success, not
  // as the neutral "nothing to see here".
  sent: { tone: "active", labelKey: "status.sent" },
  matched: { tone: "draft", labelKey: "status.matched" },
  skipped: { tone: "neutral", labelKey: "status.skipped" },
  failed: { tone: "danger", labelKey: "status.failed" },
  waiting: { tone: "paused", labelKey: "status.waiting" },
};

/**
 * Status pill classes, expressed only in theme tokens.
 *
 * The page this replaces hard-coded `bg-emerald-500/15 text-emerald-400`, which
 * ignores the merchant's theme entirely. `--success`, `--muted`, `--primary`
 * and `--destructive` already exist in `globals.css`, so nothing new is needed.
 */
export const STATUS_CLASSES: Record<StatusTone, string> = {
  active: "bg-success/15 text-success border-success/30",
  draft: "bg-primary/10 text-primary border-primary/25",
  paused: "bg-muted text-muted-foreground border-border",
  neutral: "bg-muted text-muted-foreground border-border",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { tone: "neutral", labelKey: `status.${status}` };
}
