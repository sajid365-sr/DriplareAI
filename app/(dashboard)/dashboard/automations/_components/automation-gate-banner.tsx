"use client";

import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";

/**
 * "Nothing is happening" is by far the most common automation complaint, and
 * the cause is almost always the same: the `Automation Gate` node is a file the
 * merchant pastes into n8n by hand, so a perfectly configured rule list can sit
 * there firing nothing at all.
 *
 * There is a second cause that looks identical from the outside, though. The
 * engine records a run only once it has rules to evaluate — with none, it
 * returns before writing anything — so a workspace that has not written a rule
 * yet also has no timestamp. Reporting that as "the gate is not connected"
 * would send a merchant chasing a connection problem they do not have, which is
 * why the two states are separated below.
 */
export function AutomationGateBanner({
  gateLastSeenAt,
  activeRuleCount,
  /**
   * Render the "nothing can fire yet" note when there are no active rules. The
   * Activity Log turns this on: an empty log there is indistinguishable from a
   * broken gate unless something on the page says which one it is. The Rules
   * page leaves it off, because its own empty state already asks the merchant to
   * create one.
   */
  explainNoRules = false,
}: {
  gateLastSeenAt: string | null;
  activeRuleCount: number;
  explainNoRules?: boolean;
}) {
  const { t } = useTranslation("automations");

  if (gateLastSeenAt) return null;

  if (activeRuleCount === 0) {
    if (!explainNoRules) return null;

    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 p-3.5"
        data-testid="automation-no-rules-note"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-bold text-foreground">
            {t("gate.noRulesTitle", "No active automations yet")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              "gate.noRulesBody",
              "This log fills up once a rule can fire. Create your first automation, then send a test message — the connection is not the problem here."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5 dark:border-primary/30 dark:bg-primary/10"
      data-testid="automation-gate-banner"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs font-bold text-foreground">
          {t("gate.title", "Automation Gate is not connected")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            "gate.body",
            "No incoming message has ever reached the engine. The Gate node has to be imported into your n8n Core-AI-Brain workflow by hand — until then rules are saved but never fire."
          )}
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          {t(
            "gate.hint",
            "Copy the node from docs/n8n-JSON and import it in n8n, then send a test message."
          )}
        </p>
      </div>
    </div>
  );
}
