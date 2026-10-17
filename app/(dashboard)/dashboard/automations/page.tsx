"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { AutomationPreset } from "@/lib/automations/presets";

import {
  AutomationGateBanner,
  AutomationList,
  AutomationStatsBar,
  AutomationsHeader,
  ConfirmDeleteDialog,
  RuleBuilderSheet,
  TemplateGallery,
  TestRunDialog,
  type Automation,
  type AutomationAgent,
  type AutomationsPayload,
} from "./_components";

/**
 * The Automations tab: the rules list, its builder, and the two dialogs that
 * hang off a single rule.
 *
 * Filtering is server-side (`/api/automations` takes `q` and `chatbotId`), so
 * this component holds only the state the API needs and the state the dialogs
 * own. Search is debounced because every keystroke would otherwise be a query
 * against a JSON-column table.
 *
 * The page-level counters come from the API's `totals` rather than from the
 * rendered list — a KPI that changed as you typed in the search box would be
 * worse than no KPI at all.
 */

const SEARCH_DEBOUNCE_MS = 300;

export default function AutomationsPage() {
  const { t } = useTranslation("automations");

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [gateLastSeenAt, setGateLastSeenAt] = useState<string | null>(null);
  const [totals, setTotals] = useState<AutomationsPayload["totals"]>({
    activeRules: 0,
    runsToday: 0,
    sentToday: 0,
  });

  const [agents, setAgents] = useState<AutomationAgent[]>([]);
  const [channelsByAgent, setChannelsByAgent] = useState<Record<string, string[]>>({});
  const [tags, setTags] = useState<{ tagId: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<{ templateId: string; name: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chatbotId, setChatbotId] = useState<string | null>(null);

  /** `null` = the builder is closed. `automation` null inside = creating. */
  const [builder, setBuilder] = useState<{
    automation: Automation | null;
    preset: AutomationPreset | null;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null);
  const [testing, setTesting] = useState<Automation | null>(null);

  // The skeleton is for the first paint only. Showing it again on every
  // debounced keystroke makes the grid flash while the merchant is reading it.
  const loadedOnce = useRef(false);

  // ── Bootstrap: everything the builder needs, fetched once ────────────────
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const [botResponse, integrationResponse, tagResponse, templateResponse] = await Promise.all([
          fetch("/api/chatbots"),
          fetch("/api/integrations"),
          fetch("/api/automations/tags"),
          fetch("/api/automations/templates"),
        ]);

        if (cancelled) return;

        const bots = await botResponse.json();
        if (Array.isArray(bots)) {
          setAgents(
            bots.map((bot: { chatbotId: string; name: string }) => ({
              id: bot.chatbotId,
              name: bot.name,
            }))
          );
        }

        const integrationData = await integrationResponse.json();
        if (Array.isArray(integrationData?.integrations)) {
          const byAgent: Record<string, string[]> = {};
          for (const integration of integrationData.integrations as {
            chatbotId?: string;
            platform?: string;
            connected?: boolean;
          }[]) {
            // A disconnected integration must not make its channel look
            // available — the builder hides triggers per channel, and offering
            // a comment trigger for a page that was never connected is exactly
            // the "rule that can never fire" this guards against.
            if (!integration.chatbotId || !integration.platform || !integration.connected) continue;
            const existing = byAgent[integration.chatbotId] ?? [];
            if (!existing.includes(integration.platform)) existing.push(integration.platform);
            byAgent[integration.chatbotId] = existing;
          }
          setChannelsByAgent(byAgent);
        }

        const tagData = await tagResponse.json();
        if (Array.isArray(tagData?.tags)) {
          setTags(
            (tagData.tags as { tagId: string; name: string }[]).map((tag) => ({
              tagId: tag.tagId,
              name: tag.name,
            }))
          );
        }

        const templateData = await templateResponse.json();
        if (Array.isArray(templateData?.templates)) {
          setTemplates(
            (templateData.templates as { templateId: string; name: string }[]).map((template) => ({
              templateId: template.templateId,
              name: template.name,
            }))
          );
        }
      } catch {
        // The builder degrades gracefully without agents, tags and templates —
        // the rules list itself is loaded separately and still works.
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Debounce the search box ───────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Load the rules ────────────────────────────────────────────────────────
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!loadedOnce.current) setLoading(true);

      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      if (chatbotId) params.set("chatbotId", chatbotId);

      try {
        const response = await fetch(`/api/automations?${params.toString()}`, { signal });
        const data = (await response.json()) as AutomationsPayload;
        if (!response.ok) {
          toast.error(t("toast.loadFailed", "Could not load your rules."));
          return;
        }
        setAutomations(data.automations);
        setGateLastSeenAt(data.gateLastSeenAt);
        if (data.totals) setTotals(data.totals);
        loadedOnce.current = true;
      } catch (error) {
        // An abort is the debounce working as intended, not a failure.
        if ((error as { name?: string })?.name === "AbortError") return;
        toast.error(t("toast.loadFailed", "Could not load your rules."));
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, chatbotId, t]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // ── Per-rule actions ──────────────────────────────────────────────────────

  /** Replace one rule in place, keeping the list order the API gave us. */
  function replace(updated: Automation) {
    setAutomations((current) =>
      current.map((item) =>
        item.automationId === updated.automationId ? { ...item, ...updated } : item
      )
    );
  }

  async function toggle(automation: Automation) {
    const next = automation.status === "active" ? "paused" : "active";
    setBusyId(automation.automationId);
    try {
      const response = await fetch(`/api/automations/${automation.automationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        toast.error(t("toast.saveFailed", "Could not save the rule."));
        return;
      }
      replace({ ...automation, status: next });
      toast.success(
        next === "active" ? t("toast.enabled", "Rule enabled.") : t("toast.disabled", "Rule paused.")
      );
    } catch {
      toast.error(t("toast.saveFailed", "Could not save the rule."));
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(automation: Automation) {
    setBusyId(automation.automationId);
    try {
      const response = await fetch(`/api/automations/${automation.automationId}/duplicate`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error ?? t("toast.saveFailed", "Could not save the rule."));
        return;
      }
      // The clone is a draft, so it belongs at the top where the merchant can
      // see it and open it — not wherever priority would have sorted it.
      setAutomations((current) => [data.automation as Automation, ...current]);
      toast.success(t("toast.duplicated", "Rule duplicated."));
    } catch {
      toast.error(t("toast.saveFailed", "Could not save the rule."));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    setBusyId(target.automationId);
    try {
      const response = await fetch(`/api/automations/${target.automationId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error(t("toast.deleteFailed", "Could not delete the rule."));
        return;
      }
      setAutomations((current) =>
        current.filter((item) => item.automationId !== target.automationId)
      );
      setTotals((current) => ({
        ...current,
        activeRules: Math.max(0, current.activeRules - (target.status === "active" ? 1 : 0)),
      }));
      toast.success(t("toast.deleted", "Rule deleted."));
      setPendingDelete(null);
    } catch {
      toast.error(t("toast.deleteFailed", "Could not delete the rule."));
    } finally {
      setBusyId(null);
    }
  }

  function handleSaved(automation: Automation) {
    const existing = automations.some((item) => item.automationId === automation.automationId);

    if (existing) {
      replace(automation);
    } else {
      // A new rule sorts first among its priority peers (`createdAt desc`), so
      // prepending matches what the next fetch will return.
      setAutomations((current) => [automation, ...current]);
    }

    // A save can change which rules are active and how many runs are counted,
    // and it can move a rule if its priority changed. Reconciling with the
    // server is cheaper to trust than re-deriving all of that here.
    void load();
  }

  // The gallery is for an empty workspace, and an empty *filter* is not an
  // empty workspace — showing starter templates because a search matched
  // nothing would look like the search had failed.
  const showGallery =
    !loading && automations.length === 0 && !debouncedSearch.trim() && !chatbotId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <AutomationsHeader onCreate={() => setBuilder({ automation: null, preset: null })} />

      <AutomationGateBanner gateLastSeenAt={gateLastSeenAt} activeRuleCount={totals.activeRules} />

      <AutomationStatsBar
        stats={{
          activeRules: totals.activeRules,
          runsToday: totals.runsToday,
          sentToday: totals.sentToday,
          loaded: !loading,
        }}
      />

      <AutomationList
        automations={automations}
        agents={agents}
        loading={loading}
        busyId={busyId}
        search={search}
        onSearchChange={setSearch}
        chatbotId={chatbotId}
        onChatbotChange={setChatbotId}
        onEdit={(automation) => setBuilder({ automation, preset: null })}
        onTest={setTesting}
        onDuplicate={duplicate}
        onToggle={toggle}
        onDelete={setPendingDelete}
      />

      {showGallery && (
        <TemplateGallery
          channels={Array.from(new Set(Object.values(channelsByAgent).flat()))}
          busy={false}
          onUse={(preset) => setBuilder({ automation: null, preset })}
        />
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      {builder && (
        <RuleBuilderSheet
          // Remounting per target is what resets the form — see the note in
          // the builder itself.
          key={builder.automation?.automationId ?? builder.preset?.id ?? "new"}
          open
          onOpenChange={(open) => {
            if (!open) setBuilder(null);
          }}
          automation={builder.automation}
          preset={builder.preset}
          agents={agents}
          channelsByAgent={channelsByAgent}
          tags={tags}
          templates={templates}
          onSaved={handleSaved}
        />
      )}

      <TestRunDialog
        key={testing?.automationId ?? "no-test"}
        automation={testing}
        open={testing !== null}
        onOpenChange={(open) => {
          if (!open) setTesting(null);
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        title={t("confirm.deleteTitle", "Delete this rule?")}
        body={t(
          "confirm.deleteBody",
          '"{{name}}" will stop firing immediately. Its run history is kept for the activity log.',
          { name: pendingDelete?.name ?? "" }
        )}
        busy={busyId === pendingDelete?.automationId}
        testId="automation-delete-confirm"
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </motion.div>
  );
}
