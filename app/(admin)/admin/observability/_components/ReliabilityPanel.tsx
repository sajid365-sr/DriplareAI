"use client";

import { AlertTriangle, Gauge, Info, ShieldQuestionMark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLatency, formatPercent } from "@/lib/domain/observability";
import type { ObservabilityReport } from "@/lib/domain/observability";

/**
 * Latency and fallback — the two reliability signals this log can actually support.
 *
 * ── What this panel deliberately does not claim ──────────────────────────────
 * There is no success rate here, and there is no error count. A call in which
 * every model failed writes no usage row at all (`lib/ai/gateway.ts` logs only
 * after a chain resolves), so failures are invisible to this table — a "success
 * rate" computed from it would be 100% by construction. What *is* measurable is
 * how often the first-choice model did not answer, which the `fallbackFrom`
 * column records, and that is what the right-hand side shows.
 *
 * ── On coverage ──────────────────────────────────────────────────────────────
 * Only calls made through the app gateway are timed. Customer replies arriving
 * via n8n carry no `latencyMs`, so on a live workspace the sample can be a small
 * fraction of the traffic. The coverage figure is therefore part of the panel,
 * not a footnote: a p95 over 43 of 9,812 calls describes the gateway, not the
 * product, and the reader is told which one they are looking at.
 */
export function ReliabilityPanel({ report }: { report: ObservabilityReport }) {
  const { t } = useTranslation("observability");

  const { latency, fallback } = report.totals;
  const fallbackRate = formatPercent(fallback.rate);

  const latencyRows = [
    {
      key: "p50",
      label: t("reliability.p50", "Median (p50)"),
      value: formatLatency(latency.p50Ms),
    },
    {
      key: "p95",
      label: t("reliability.p95", "Tail (p95)"),
      value: formatLatency(latency.p95Ms),
    },
    {
      key: "avg",
      label: t("reliability.avg", "Average"),
      value: formatLatency(latency.avgMs),
    },
    {
      key: "max",
      label: t("reliability.max", "Slowest"),
      value: formatLatency(latency.maxMs),
    },
  ];

  // Coverage is described in words as well as as a number, because "3%" alone
  // does not tell a reader that the figure below it is not about their traffic.
  const coveragePercent = formatPercent(latency.coverage);
  const isThinSample = latency.sampleCount > 0 && latency.coverage < 0.5;

  return (
    <Card className="border-border bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          {t("reliability.title", "Latency & Fallback")}
        </CardTitle>
        <CardDescription>
          {t(
            "reliability.description",
            "App-side measurements only. Customer replies handled by n8n are not timed and do not appear here.",
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6 lg:grid-cols-2">
        {/* ── Latency ─────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-chart-1" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("reliability.latencyHeading", "Response Latency")}
            </h3>
          </div>

          {latency.sampleCount === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t(
                "reliability.latencyNone",
                "No timed calls in this window. Every logged call came from a channel that does not report latency.",
              )}
            </p>
          ) : (
            <>
              <dl className="mt-4 divide-y divide-border/50">
                {latencyRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-4 py-2.5">
                    <dt className="text-sm text-muted-foreground">{row.label}</dt>
                    <dd className="tabular-nums text-sm font-medium text-foreground">
                      {row.value ?? "—"}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    isThinSample
                      ? "gap-1 border-warning/30 bg-warning/10 text-[11px] font-semibold text-warning"
                      : "border-border text-[11px] text-muted-foreground"
                  }
                >
                  {isThinSample && <AlertTriangle className="h-3 w-3" />}
                  {t("reliability.coverage", "{{percent}} of calls timed", {
                    percent: coveragePercent ?? "—",
                  })}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {t("reliability.sample", "{{measured}} measured of {{total}} logged", {
                    measured: latency.sampleCount.toLocaleString(),
                    total: latency.totalCount.toLocaleString(),
                  })}
                </span>
              </div>

              {report.latencySampleCapped && (
                <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="mt-0.5 h-3 w-3 shrink-0" />
                  {t(
                    "reliability.capped",
                    "The window holds more timed calls than this panel samples; the percentiles describe the most recent ones.",
                  )}
                </p>
              )}
            </>
          )}
        </section>

        {/* ── Fallback ────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2">
            <ShieldQuestionMark className="h-4 w-4 text-chart-3" />
            <h3 className="text-sm font-semibold text-foreground">
              {t("reliability.fallbackHeading", "Model Fallback Rate")}
            </h3>
          </div>

          <p className="mt-4 text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {fallbackRate ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {fallback.rate === null
              ? t("reliability.fallbackNoCalls", "No calls were logged in this window")
              : t("reliability.fallbackHint", "{{fallbackCount}} of {{total}} logged calls", {
                  fallbackCount: fallback.count.toLocaleString(),
                  total: fallback.total.toLocaleString(),
                })}
          </p>

          {/* The single most important sentence on this page: what the number
              above is NOT. Without it, a 2% fallback rate gets read as a 98%
              success rate, which the data cannot support. */}
          <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-border bg-muted/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {t(
              "reliability.fallbackNote",
              "This is not a success rate. A call where every model failed writes no usage row, so failures cannot be counted here — only calls that were rescued by a backup model. A rising rate means the first-choice model is struggling.",
            )}
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
