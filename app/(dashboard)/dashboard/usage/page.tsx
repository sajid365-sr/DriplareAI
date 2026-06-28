"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { subDays, subHours } from "date-fns";
import { DateRange } from "react-day-picker";
import { useRegion } from "@/components/region-provider";

import { Info } from "lucide-react";
import { 
  Popover, PopoverContent, PopoverTrigger 
} from "@/components/ui/popover";
import { cn } from "@/lib/core/utils";

// Components
import { StatCards } from "./_components/stat-cards";
import { UsageHistory } from "./_components/usage-history";
import { UsagePerAgent } from "./_components/usage-per-agent";
import { AgentPerformance } from "./_components/agent-performance";
import { QuotaProgress } from "./_components/quota-progress";
import { DateRangePicker } from "./_components/date-range-picker";

export default function Usage() {
  const { t, i18n } = useTranslation(["overview", "common"]);
  const { region } = useRegion();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  // Date Filtering States
  const [rangeType, setRangeType] = useState<string>("billing");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 14),
    to: new Date(),
  });

  useEffect(() => {
    setLoading(true);
    let url = "/api/usage";

    if (rangeType !== "billing") {
      const params = new URLSearchParams();
      if (dateRange?.from) params.set("from", dateRange.from.toISOString());
      if (dateRange?.to) params.set("to", dateRange.to.toISOString());
      url += `?${params.toString()}`;
    }

    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .catch(() => { })
      .finally(() => {
        setLoading(false);
        setInitialLoading(false);
      });
  }, [rangeType, dateRange]);

  const handleRangeChange = (type: string) => {
    setRangeType(type);
    const now = new Date();

    if (type === "24h") {
      setDateRange({ from: subHours(now, 24), to: now });
    } else if (type === "7d") {
      setDateRange({ from: subDays(now, 7), to: now });
    } else if (type === "30d") {
      setDateRange({ from: subDays(now, 30), to: now });
    } else if (type === "all") {
      setDateRange({ from: new Date(2020, 0, 1), to: now });
    } else if (type === "billing") {
      setDateRange(undefined);
    }
  };

  const isBn = i18n.language === "bn";
  const sym = data?.currencySymbol || (region === "bd" ? "৳" : "$");
  const included = data?.includedCreditsTotal ?? 500;
  const pct = data ? Math.min(100, Math.round((data.creditsUsedThisCycle / (included || 1)) * 100)) : 0;

  if (initialLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <div className="animate-pulse text-muted-foreground font-bold text-sm tracking-wide">
          {t("usage.loading", "FETCHING USAGE DATA...")}
        </div>
      </div>
    );
  }

  const pieData = data?.agentUsage?.filter((a: any) => a.usedMessages > 0).map((a: any) => ({
    name: a.name,
    value: a.usedMessages,
  })) || [];

  return (
    <div className={cn("space-y-8 max-w-6xl pb-10 transition-opacity duration-300", loading && "opacity-50 pointer-events-none")}>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
          <div className="bg-card p-4 rounded-2xl shadow-2xl border border-border flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-xs font-bold text-muted-foreground">{isBn ? "আপডেট হচ্ছে..." : "Updating..."}</span>
          </div>
        </div>
      )}

      {/* Header & Date Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("usage.title", "Usage Dashboard")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium flex items-center gap-1.5">
            {t("usage.subtitle", "Monitor your AI message consumption and agent performance.")}
            <Popover>
              <PopoverTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors cursor-help" />
              </PopoverTrigger>
              <PopoverContent className="text-[11px] p-3 max-w-[250px] leading-relaxed">
                <p className="font-bold mb-1 text-primary">{t("usage.cycleTitle", "What is Billing Cycle?")}</p>
                {t("usage.cycleDesc", "Your monthly subscription period. It typically starts from the date you purchase a plan and lasts for one month. Your message quota is renewed within this cycle.")}
              </PopoverContent>
            </Popover>
          </p>
        </div>

        <DateRangePicker 
          rangeType={rangeType}
          dateRange={dateRange}
          onRangeChange={handleRangeChange}
          onDateRangeSelect={setDateRange}
          isBn={isBn}
          data={data}
        />
      </div>

      {/* Statistics Grid */}
      <StatCards 
        data={data}
        t={t}
        i18n={i18n}
        sym={sym}
        included={included}
      />

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UsageHistory 
          data={data}
          t={t}
          rangeType={rangeType}
        />

        <UsagePerAgent 
          data={data}
          t={t}
          pieData={pieData}
        />
      </div>

      {/* Detailed Table Section */}
      <AgentPerformance 
        data={data}
        t={t}
      />

      {/* Plan Progress Bar */}
      <QuotaProgress 
        data={data}
        t={t}
        included={included}
        pct={pct}
      />
    </div>
  );
}
