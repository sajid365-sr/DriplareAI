"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  HelpCircle,
  Loader2,
  RefreshCw,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DerivationPreview, DerivationRow } from "@/lib/ai/derivation-types";

/**
 * Derive credits from price.
 *
 * Every model's credit cost used to be typed in by hand, and the live catalogue
 * had drifted into an inverted ladder — `openai/gpt-4o` cost ৳1.638 a reply and
 * was charged 3 credits, while `meta-llama/llama-3.3-70b-instruct` cost ৳0.0625
 * and was charged 5. This panel computes each model's credits from the price
 * OpenRouter already reports, shows the admin the whole diff, and writes nothing
 * until they press Apply.
 *
 * ── Two things this panel deliberately does not do ──────────────────────────
 * 1. It does not re-derive while the admin types. A number that moves on its own
 *    is the complaint this whole task exists to answer, so recalculating is an
 *    explicit action with a visible "inputs changed" marker.
 * 2. It does not send credit figures to the server. The panel posts a target, a
 *    token estimate and the ids it confirms; `lib/ai/credit-plan.ts` recomputes
 *    the plan from the catalogue. A stale tab can therefore not write a number
 *    that was never derived.
 */

interface CreditDerivationPanelProps {
  /**
   * Called after a successful apply. The catalogue below still holds the old
   * credit numbers, so the page has to re-read the settings row.
   */
  onApplied: () => void | Promise<void>;
  /** True while another settings operation (save / fetch / validate) is running. */
  disabled?: boolean;
  /**
   * True when the catalogue below has edits that are not saved yet.
   *
   * Apply writes `models[].credits` in the database and then the page re-reads
   * it, which would discard those edits — the admin would watch their typed
   * numbers vanish. So Apply is held until they are saved. Neither ordering
   * works: flushing first writes the pre-derivation numbers, and flushing after
   * overwrites the numbers Apply just derived.
   */
  dirty?: boolean;
}

/** The verdict → badge styling. `unchanged` is the quiet one on purpose. */
const VERDICT_STYLE: Record<
  DerivationRow["verdict"],
  { className: string; dot: string }
> = {
  unchanged: { className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
  within_threshold: { className: "bg-primary/10 text-primary", dot: "bg-primary" },
  needs_review: { className: "bg-warning/10 text-warning", dot: "bg-warning" },
};

export function CreditDerivationPanel({
  onApplied,
  disabled = false,
  dirty = false,
}: CreditDerivationPanelProps) {
  const { t } = useTranslation("admin");

  const [preview, setPreview] = useState<DerivationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  /** modelIds the admin accepted despite crossing the review threshold. */
  const [confirmed, setConfirmed] = useState<string[]>([]);

  // Inputs are strings so a half-typed number does not get parsed into the field.
  const [target, setTarget] = useState("");
  const [promptTokens, setPromptTokens] = useState("");
  const [completionTokens, setCompletionTokens] = useState("");

  const loadPreview = useCallback(
    async (params?: { target: string; prompt: string; completion: string }) => {
      setLoading(true);
      setError(null);

      try {
        const query = new URLSearchParams();
        if (params?.target.trim()) query.set("targetBdtPerCredit", params.target.trim());
        if (params?.prompt.trim()) query.set("promptTokens", params.prompt.trim());
        if (params?.completion.trim()) query.set("completionTokens", params.completion.trim());

        const response = await fetch(
          `/api/admin/ai-settings/derivation${query.size > 0 ? `?${query}` : ""}`,
          { cache: "no-store" }
        );
        const body = (await response.json()) as {
          preview?: DerivationPreview;
          error?: string;
        };

        if (!response.ok || !body.preview) {
          throw new Error(body.error ?? t("aiSettings.derivation.loadError"));
        }

        setPreview(body.preview);
        // The server sanitises and may fall back, so the fields show what was
        // actually used rather than what was typed.
        setTarget(String(body.preview.targetBdtPerCredit));
        setPromptTokens(String(body.preview.expectedTokens.prompt));
        setCompletionTokens(String(body.preview.expectedTokens.completion));
        // A new plan means the previous confirmations were about different rows.
        setConfirmed([]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("aiSettings.derivation.loadError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  /** True when the fields no longer describe the plan on screen. */
  const inputsChanged = useMemo(() => {
    if (!preview) return false;
    return (
      Number(target) !== preview.targetBdtPerCredit ||
      Number(promptTokens) !== preview.expectedTokens.prompt ||
      Number(completionTokens) !== preview.expectedTokens.completion
    );
  }, [preview, target, promptTokens, completionTokens]);

  const rowsToApply = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter(
      (row) =>
        !row.priceUnknown &&
        row.currentCredits !== row.proposedCredits &&
        (row.appliesByDefault || confirmed.includes(row.modelId))
    );
  }, [preview, confirmed]);

  /** Rows that would change but are waiting for a tick. */
  const awaitingConfirm = useMemo(
    () =>
      (preview?.rows ?? []).filter(
        (row) =>
          !row.priceUnknown &&
          !row.appliesByDefault &&
          row.currentCredits !== row.proposedCredits &&
          !confirmed.includes(row.modelId)
      ),
    [preview, confirmed]
  );

  const toggleConfirmed = (modelId: string) =>
    setConfirmed((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );

  /**
   * Confirms every row that is waiting.
   *
   * ⚠️ This exists because of a measurement, not a preference. Against the live
   *    catalogue on 2026-10-14 **all 27** real rows crossed the 20% line — the
   *    hand-typed numbers had drifted so far that every one of them was a large
   *    move. Requiring 27 individual ticks did not add 27 moments of
   *    deliberation; it meant nobody would ever press Apply, and would go back
   *    to typing credits by hand, which is the defect this panel replaces.
   *
   *    The safety property is kept: a large move still cannot be written without
   *    a deliberate act that names the count. It is one act instead of 27.
   */
  const confirmAllAwaiting = () => setConfirmed(awaitingConfirm.map((row) => row.modelId));

  const handleApply = async () => {
    setApplying(true);
    try {
      const response = await fetch("/api/admin/ai-settings/derivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetBdtPerCredit: Number(target),
          expectedTokens: {
            prompt: Number(promptTokens),
            completion: Number(completionTokens),
          },
          confirm: confirmed,
        }),
      });
      const body = (await response.json()) as {
        applied?: number;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        // The one failure the admin can act on: the settings row does not exist
        // yet, so there is nothing for Apply to write onto.
        toast.error(
          body.code === "no_settings_row"
            ? t("aiSettings.derivation.noSettingsRow")
            : (body.error ?? t("aiSettings.derivation.applyError"))
        );
        return;
      }

      toast.success(t("aiSettings.derivation.applySuccess", { count: body.applied ?? 0 }));
      // Re-read from disk rather than patching local state: the credits the panel
      // just wrote are now the source the catalogue table must agree with.
      await onApplied();
      await loadPreview({ target, prompt: promptTokens, completion: completionTokens });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("aiSettings.derivation.applyError"));
    } finally {
      setApplying(false);
    }
  };

  const busy = disabled || applying;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="w-full rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs space-y-5"
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            {t("aiSettings.derivation.title")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            {t("aiSettings.derivation.sub")}
          </p>
        </div>
      </div>

      {/* ── Inputs ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label
            htmlFor="derivation-target"
            className="text-xs font-semibold text-foreground"
          >
            {t("aiSettings.derivation.targetLabel")}
          </label>
          <Input
            id="derivation-target"
            type="number"
            min="0.001"
            max="10"
            step="0.001"
            value={target}
            disabled={busy || loading}
            onChange={(event) => setTarget(event.target.value)}
            className="h-9 rounded-xl font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="derivation-prompt-tokens"
            className="text-xs font-semibold text-foreground"
          >
            {t("aiSettings.derivation.promptTokensLabel")}
          </label>
          <Input
            id="derivation-prompt-tokens"
            type="number"
            min="0"
            step="50"
            value={promptTokens}
            disabled={busy || loading}
            onChange={(event) => setPromptTokens(event.target.value)}
            className="h-9 rounded-xl font-mono text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="derivation-completion-tokens"
            className="text-xs font-semibold text-foreground"
          >
            {t("aiSettings.derivation.completionTokensLabel")}
          </label>
          <Input
            id="derivation-completion-tokens"
            type="number"
            min="0"
            step="50"
            value={completionTokens}
            disabled={busy || loading}
            onChange={(event) => setCompletionTokens(event.target.value)}
            className="h-9 rounded-xl font-mono text-sm"
          />
        </div>

        <div className="flex items-end">
          <Button
            size="sm"
            variant={inputsChanged ? "default" : "outline"}
            disabled={busy || loading || !inputsChanged}
            onClick={() =>
              loadPreview({ target, prompt: promptTokens, completion: completionTokens })
            }
            className="h-9 w-full rounded-xl gap-2 text-xs sm:text-sm justify-center"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            {t("aiSettings.derivation.recalculate")}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("aiSettings.derivation.targetHint")}
        {" · "}
        {t("aiSettings.derivation.tokensHint")}
      </p>

      {/* ── The "your inputs moved" marker ── */}
      {inputsChanged && (
        <p className="flex items-center gap-1.5 text-[11px] text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {t("aiSettings.derivation.staleInputs")}
        </p>
      )}

      {loading && !preview ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("aiSettings.derivation.loading")}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">
          {error}
        </div>
      ) : preview ? (
        <>
          {/* ── Summary chips ── */}
          <div className="flex flex-wrap gap-2">
            <SummaryChip label={t("aiSettings.derivation.summary.total")} value={preview.summary.total} />
            <SummaryChip
              label={t("aiSettings.derivation.summary.toUpdate")}
              value={preview.summary.withinThreshold}
              tone="primary"
            />
            <SummaryChip
              label={t("aiSettings.derivation.summary.needsReview")}
              value={preview.summary.needsReview}
              tone={preview.summary.needsReview > 0 ? "warning" : undefined}
            />
            {preview.summary.priceUnknown > 0 && (
              <SummaryChip
                label={t("aiSettings.derivation.summary.unquoted")}
                value={preview.summary.priceUnknown}
                tone="warning"
              />
            )}
            {preview.summary.priceDrift > 0 && (
              <SummaryChip
                label={t("aiSettings.derivation.summary.stalePrices")}
                value={preview.summary.priceDrift}
              />
            )}
          </div>

          {/* ── What the allowances cost at this target ── */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-foreground">
                {t("aiSettings.derivation.allowance.title")}
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {t("aiSettings.derivation.allowance.sub")}
              </p>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {preview.allowances.map((allowance) => (
                <div
                  key={allowance.planKey}
                  className="rounded-lg border border-border/60 bg-card p-3 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground capitalize">
                      {allowance.planKey}
                    </span>
                    {allowance.economics.netProfitBdt !== null &&
                      allowance.economics.netProfitBdt < 0 && (
                        <Badge variant="destructive" className="gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {t("aiSettings.derivation.allowance.loss")}
                        </Badge>
                      )}
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {allowance.includedCredits.toLocaleString()}
                    {" × ৳"}
                    {preview.targetBdtPerCredit}
                    {" = ৳"}
                    {allowance.economics.costBdt.toLocaleString()}
                  </p>
                  <p className="text-[11px]">
                    {allowance.economics.netMarginPercent === null ? (
                      <span className="text-muted-foreground">
                        {t("aiSettings.derivation.allowance.negotiated")}
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "font-bold",
                          allowance.economics.netMarginPercent < 0
                            ? "text-destructive"
                            : "text-success"
                        )}
                      >
                        {t("aiSettings.derivation.allowance.margin", {
                          margin: allowance.economics.netMarginPercent,
                        })}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── The diff ── */}
          <div className="w-full rounded-xl border border-border/60 overflow-hidden">
            {/* The live catalogue holds 30+ models, so the diff is taller than a
                screen. Capping it keeps the action bar — the thing the admin
                actually needs to reach — in view. */}
            <div className="overflow-x-auto overflow-y-auto max-h-[30rem]">
              <Table className="min-w-[52rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("aiSettings.derivation.table.model")}</TableHead>
                    <TableHead className="text-right">
                      {t("aiSettings.derivation.table.cost")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("aiSettings.derivation.table.current")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("aiSettings.derivation.table.proposed")}
                    </TableHead>
                    <TableHead>{t("aiSettings.derivation.table.status")}</TableHead>
                    <TableHead className="w-24 text-center">
                      {t("aiSettings.derivation.table.confirm")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => {
                    const style = VERDICT_STYLE[row.verdict];
                    // A row only needs a tick when it would actually move and is
                    // not already covered by the default threshold.
                    const needsTick =
                      !row.priceUnknown &&
                      !row.appliesByDefault &&
                      row.currentCredits !== row.proposedCredits;

                    return (
                      <TableRow key={row.modelId}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-foreground">
                              {row.name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {row.modelId}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {row.tier && (
                                <span className="text-[10px] text-muted-foreground">
                                  {row.tier}
                                </span>
                              )}
                              {!row.isMerchantActive && (
                                <span className="text-[10px] text-muted-foreground">
                                  · {t("aiSettings.derivation.table.inactive")}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-right align-top">
                          <div className="flex flex-col gap-0.5 items-end">
                            <span className="text-xs font-mono">৳{row.costBdt.toFixed(4)}</span>
                            {row.priceSource === "fallback" ? (
                              <span className="flex items-center gap-1 text-[10px] text-warning">
                                <HelpCircle className="h-3 w-3" />
                                {t("aiSettings.derivation.source.fallback")}
                              </span>
                            ) : row.priceDrift ? (
                              <span
                                className="text-[10px] text-muted-foreground"
                                title={t("aiSettings.derivation.source.driftHint", {
                                  stored: row.storedPrice.prompt,
                                  live: row.livePrice.prompt,
                                })}
                              >
                                {t("aiSettings.derivation.source.drift")}
                              </span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">
                                {t("aiSettings.derivation.source.openrouter")}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right align-top">
                          <span className="text-xs font-mono text-muted-foreground">
                            {row.currentCredits ?? "—"}
                          </span>
                        </TableCell>

                        <TableCell className="text-right align-top">
                          <span
                            className={cn(
                              "text-xs font-mono font-bold",
                              row.currentCredits !== row.proposedCredits && !row.priceUnknown
                                ? "text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {row.priceUnknown ? "—" : row.proposedCredits}
                          </span>
                        </TableCell>

                        <TableCell className="align-top">
                          {row.priceUnknown ? (
                            <Badge className="gap-1 bg-warning/10 text-warning">
                              <AlertTriangle className="h-3 w-3" />
                              {t("aiSettings.derivation.verdict.priceUnknown")}
                            </Badge>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-4xl px-2 py-0.5 text-[11px] font-medium",
                                style.className
                              )}
                            >
                              <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                              {t(`aiSettings.derivation.verdict.${row.verdict}`)}
                            </span>
                          )}
                        </TableCell>

                        <TableCell className="text-center align-top">
                          {needsTick ? (
                            <Checkbox
                              checked={confirmed.includes(row.modelId)}
                              disabled={busy}
                              onCheckedChange={() => toggleConfirmed(row.modelId)}
                              aria-label={t("aiSettings.derivation.table.confirmAria", {
                                name: row.name,
                              })}
                            />
                          ) : row.priceUnknown ? (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          ) : (
                            <CheckCircle2 className="mx-auto h-4 w-4 text-success/60" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Action bar ── */}
          <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex flex-col gap-1 sm:mr-auto">
              <p className="text-[11px] text-muted-foreground">
                {t("aiSettings.derivation.pricingAsOf", {
                  when: preview.pricingFetchedAt
                    ? new Date(preview.pricingFetchedAt).toLocaleString()
                    : t("aiSettings.derivation.pricingNever"),
                })}
              </p>
              {awaitingConfirm.length > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {t("aiSettings.derivation.awaitingConfirm", { count: awaitingConfirm.length })}
                </p>
              )}
              {dirty && (
                <p className="flex items-center gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {t("aiSettings.derivation.saveFirst")}
                </p>
              )}
            </div>

            {awaitingConfirm.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={confirmAllAwaiting}
                disabled={busy}
                className="h-9 w-full rounded-xl gap-2 text-xs sm:text-sm justify-center sm:w-auto"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("aiSettings.derivation.confirmAll", { count: awaitingConfirm.length })}
              </Button>
            )}

            <Button
              size="sm"
              onClick={handleApply}
              disabled={busy || dirty || rowsToApply.length === 0}
              className="rounded-xl gap-2 text-xs sm:text-sm h-9 bg-brand-gradient text-primary-foreground hover:opacity-90 font-medium shadow-xs w-full sm:w-auto justify-center"
            >
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4" />
              )}
              {applying
                ? t("aiSettings.derivation.applying")
                : rowsToApply.length > 0
                  ? t("aiSettings.derivation.apply", { count: rowsToApply.length })
                  : awaitingConfirm.length > 0
                    ? t("aiSettings.derivation.applyWaiting", { count: awaitingConfirm.length })
                    : t("aiSettings.derivation.applyNone")}
            </Button>
          </div>
        </>
      ) : null}
    </motion.div>
  );
}

/** One "12 to update" pill. */
function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "primary" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-4xl border border-border/60 px-2.5 py-1 text-[11px]",
        tone === "primary" && "border-primary/30 bg-primary/5 text-primary",
        tone === "warning" && "border-warning/30 bg-warning/5 text-warning",
        !tone && "bg-muted/40 text-muted-foreground"
      )}
    >
      {label}
      <span className="font-bold text-foreground">{value}</span>
    </span>
  );
}
