"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { StatsCards } from "./_components/StatsCards";
import { ActivityChart } from "./_components/ActivityChart";
import { PlatformDistribution } from "./_components/PlatformDistribution";
import { RecentSessions } from "./_components/RecentSessions";
import { Skeleton } from "@/components/ui/skeleton";

export default function Analytics() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation("analytics");

  useEffect(() => { 
    if (!chatbotId) return;
    setLoading(true);
    fetch(`/api/chatbots/${chatbotId}/analytics`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [chatbotId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded-md" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-muted-foreground p-8 text-center">{t("no_data")}</div>;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-1">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent"
        >
          {t("title")}
        </motion.h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      {/* Primary Stats */}
      <StatsCards data={data} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Main Chart */}
        <div className="lg:col-span-2">
          <ActivityChart data={data.timeline} />
        </div>

        {/* Platform Breakdown */}
        <div className="h-full">
          <PlatformDistribution data={data.platform_distribution || []} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity List */}
        <div className="lg:col-span-1">
          <RecentSessions sessions={data.recent_sessions || []} />
        </div>

        {/* Future expansion placeholder or detailed info */}
        <div className="lg:col-span-2 p-8 rounded-2xl border border-dashed border-border flex items-center justify-center bg-muted/5">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-muted-foreground">More insights coming soon...</p>
            <p className="text-xs text-muted-foreground/60">Advanced sentiment tracking and topic clustering are in development.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
