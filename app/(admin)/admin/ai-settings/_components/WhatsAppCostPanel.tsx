"use client";

import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AlertTriangle, MessageCircle, Power } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  DEFAULT_WHATSAPP_FEE_BDT_PER_MESSAGE,
  WHATSAPP_FEE_BDT_MAX,
  WHATSAPP_FREE_MESSAGES_MAX,
} from "@/lib/domain/credit-config";
import { getPlansForRegion, isPaidPlan, resolveLocalStr } from "@/lib/domain/plan-config";
import { bdtPerCreditFrom, whatsappSurchargeCredits } from "@/lib/domain/whatsapp-cost";
import { cn } from "@/lib/utils";

/**
 * WhatsApp channel cost (TASK-15·8).
 *
 * Since 2026-10-01 Meta bills service messages — the AI's own replies on
 * WhatsApp — after 1,000 per phone number per month. That cost is folded into
 * credits rather than invoiced separately: a merchant already has a fixed plan
 * price, so a second bill for the same conversation would be re-opening a closed
 * contract.
 *
 * ── Why this panel leads with "off" ─────────────────────────────────────────
 * The fee defaults to `0`, which means the surcharge is dormant. That is
 * deliberate, not unfinished: two things must be checked before enabling it.
 *   1. In Meta Business Suite, that the WhatsApp **credit line belongs to us**.
 *      If it belongs to the merchant, they already pay Meta directly and
 *      charging them again would be a double charge.
 *   2. The real per-message rate from our own rate card — third-party figures
 *      are stale.
 * Until both hold, deploying this code changes nothing, and one number turns it
 * on. The panel says so on screen rather than in a commit message.
 *
 * ── Why the panel computes an estimate instead of stating one ───────────────
 * The cost of a reply in credits depends on the plan's ৳-per-credit, which is
 * `price ÷ includedCredits`. Hard-coding "≈ 9 credits" would go stale the first
 * time a price changed, and stale-but-confident is exactly the failure mode the
 * `CreditDerivationPanel` above this one exists to fix.
 */

interface WhatsAppCostPanelProps {
  /** Free messages per phone number per calendar month (Meta's own allowance). */
  freeMessages: number;
  /** Meta's service-message fee per message in BDT. `0` = surcharge off. */
  feeBdtPerMessage: number;
  onFreeMessagesChange: (value: number) => void;
  onFeeBdtPerMessageChange: (value: number) => void;
  /** True while another settings operation (save / fetch / validate) is running. */
  disabled?: boolean;
}

export function WhatsAppCostPanel({
  freeMessages,
  feeBdtPerMessage,
  onFreeMessagesChange,
  onFeeBdtPerMessageChange,
  disabled = false,
}: WhatsAppCostPanelProps) {
  const { t, i18n } = useTranslation("admin");

  const isOff = feeBdtPerMessage <= 0;

  /**
   * Credits one WhatsApp reply costs once the free tier is exhausted, per paid
   * BD plan — computed from the *code defaults* in `plan-config.ts`.
   *
   * ⚠️ The caveat is shown on screen, not hidden: `/admin/pricing` can override
   *    any plan's price, and the charge path reads the overridden value. This
   *    figure is therefore an estimate for the default catalogue, which is the
   *    honest thing to label it as.
   *
   * ⚠️ `messagesBeforeThisOne: freeMessages` is the *first* billable message —
   *    i.e. the smallest non-zero surcharge. Passing `0` here would report 0
   *    credits for every plan, which is the one answer that is never useful.
   */
  const estimates = getPlansForRegion("bd")
    .filter((plan) => isPaidPlan(plan.key))
    .map((plan) => ({
      key: plan.key,
      // `plan.name` is region-localised (`string | { en, bn }`), so it is resolved
      // through the same helper every other surface uses rather than indexed by
      // hand — that is how a plan name once ended up undefined on one surface only.
      name: resolveLocalStr(plan.name, i18n.language),
      price: plan.price,
      credits: whatsappSurchargeCredits({
        messagesBeforeThisOne: freeMessages,
        feePerMessageBdt: feeBdtPerMessage,
        bdtPerCredit: bdtPerCreditFrom(plan.price, plan.includedCredits),
      }),
    }));

  // Same shape as the USD → BDT rate field in the catalogue toolbar: the draft is
  // text so "0.5" on the way to "0.54" and a transient "" can both exist without
  // the parent rejecting them mid-keystroke.
  const handleFreeMessages = (raw: string) => {
    const parsed = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0) return;
    onFreeMessagesChange(Math.floor(parsed));
  };

  const handleFee = (raw: string) => {
    const parsed = Number(raw);
    // `0` must be accepted — it is the value that turns the surcharge off, so
    // rejecting it would make the safe state unreachable from the UI.
    if (raw.trim() === "" || !Number.isFinite(parsed) || parsed < 0) return;
    onFeeBdtPerMessageChange(parsed);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.09 }}
      className="w-full rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs space-y-5"
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-bold text-foreground">
              {t("aiSettings.whatsapp.title")}
            </h3>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-4xl border px-2 py-0.5 text-[11px] font-medium",
                isOff
                  ? "border-border/60 bg-muted/40 text-muted-foreground"
                  : "border-primary/30 bg-primary/5 text-primary"
              )}
            >
              <Power className="h-3 w-3" />
              {isOff ? t("aiSettings.whatsapp.statusOff") : t("aiSettings.whatsapp.statusActive")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-3xl">
            {t("aiSettings.whatsapp.sub")}
          </p>
        </div>
      </div>

      {/* ── Inputs ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label
            htmlFor="whatsapp-free-messages"
            className="text-xs font-semibold text-foreground"
          >
            {t("aiSettings.whatsapp.freeLabel")}
          </label>
          <Input
            id="whatsapp-free-messages"
            type="number"
            inputMode="numeric"
            min={0}
            max={WHATSAPP_FREE_MESSAGES_MAX}
            step={100}
            value={String(freeMessages)}
            disabled={disabled}
            onChange={(event) => handleFreeMessages(event.target.value)}
            className="h-9 rounded-xl font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            {t("aiSettings.whatsapp.freeHint")}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="whatsapp-fee" className="text-xs font-semibold text-foreground">
            {t("aiSettings.whatsapp.feeLabel")}
          </label>
          <Input
            id="whatsapp-fee"
            type="number"
            inputMode="decimal"
            min={0}
            max={WHATSAPP_FEE_BDT_MAX}
            step={0.01}
            value={String(feeBdtPerMessage)}
            disabled={disabled}
            onChange={(event) => handleFee(event.target.value)}
            className="h-9 rounded-xl font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            {t("aiSettings.whatsapp.feeHint", { max: WHATSAPP_FEE_BDT_MAX })}
          </p>
        </div>

        {/* ── Estimate ── */}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold text-foreground">
            {t("aiSettings.whatsapp.estimateTitle")}
          </span>
          {isOff ? (
            <p className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              {t("aiSettings.whatsapp.estimateOff")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {estimates.map((estimate) => (
                <span
                  key={estimate.key}
                  className="inline-flex items-center gap-1 rounded-4xl border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground"
                  title={t("aiSettings.whatsapp.estimateTooltip", {
                    price: estimate.price,
                  })}
                >
                  {estimate.name}
                  <span className="font-bold text-foreground">{estimate.credits}</span>
                  {t("aiSettings.whatsapp.estimateUnit")}
                </span>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            {t("aiSettings.whatsapp.estimateCaveat")}
          </p>
        </div>
      </div>

      {/* ── The two things that must be true before this is switched on ──
          Shown as a warning only while it is off: once the fee is set the admin
          has already made the call, and repeating it would be noise. */}
      {isOff ? (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
            {t("aiSettings.whatsapp.prereqTitle")}
          </p>
          <ul className="ms-5 list-disc space-y-1 text-[11px] text-muted-foreground">
            <li>{t("aiSettings.whatsapp.prereqCreditLine")}</li>
            <li>{t("aiSettings.whatsapp.prereqRate")}</li>
          </ul>
        </div>
      ) : (
        <p className="flex items-start gap-1.5 text-[11px] text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          {t("aiSettings.whatsapp.savingWarning", { fee: feeBdtPerMessage })}
        </p>
      )}

      {/* The default state is easy to mistake for "not implemented", so it is
          stated outright. */}
      <p className="text-[11px] text-muted-foreground">
        {t("aiSettings.whatsapp.offNote", {
          defaultFee: DEFAULT_WHATSAPP_FEE_BDT_PER_MESSAGE,
        })}
      </p>
    </motion.div>
  );
}
