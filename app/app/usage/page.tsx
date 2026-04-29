"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Sparkles, MessageSquare, Bot, Zap } from "lucide-react";

function Stat({ icon: Icon, label, value, delay = 0 }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="p-6 rounded-2xl border border-border bg-card">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </motion.div>
  );
}

export default function Usage() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  
  useEffect(() => { 
    fetch("/api/usage").then(r => r.json()).then(setData).catch(() => {});
  }, []);
  
  const remaining = data ? data.points - data.points_used : 0;
  const pct = data ? Math.min(100, Math.round(((data.points - data.points_used) / data.points) * 100)) : 0;
  
  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">{t("sidebar.usage", "Usage")}</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Sparkles} label="Points remaining" value={remaining} />
        <Stat icon={Zap} label="Points used" value={data?.points_used ?? 0} delay={0.05} />
        <Stat icon={MessageSquare} label="Messages" value={data?.messages_total ?? 0} delay={0.1} />
        <Stat icon={Bot} label="Chatbots" value={data?.chatbots_total ?? 0} delay={0.15} />
      </div>
      <div className="p-6 rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Quota</div>
          <div className="text-sm text-muted-foreground">{remaining} / {data?.points ?? 100}</div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-gradient-to-r from-primary to-fuchsia-500" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
        </div>
        <div className="text-xs text-muted-foreground mt-2">Free plan resets monthly. Upgrade to Pro for more.</div>
      </div>
    </div>
  );
}
