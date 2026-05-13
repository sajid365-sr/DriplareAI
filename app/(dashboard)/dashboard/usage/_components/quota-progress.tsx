"use client";

import { motion } from "framer-motion";

export function QuotaProgress({ data, isBn, included, pct }: any) {
  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm bg-gradient-to-r from-primary/5 to-transparent">
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-lg">{isBn ? "মেসেজ কোটা প্রগ্রেস" : "Plan Message Quota"}</div>
        <div className="text-sm font-bold">
          {data?.messagesUsedThisCycle ?? 0} <span className="text-muted-foreground font-medium text-xs">/ {included}</span>
        </div>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden mb-4 shadow-inner">
        <motion.div
          className={`h-full rounded-full shadow-sm ${pct >= 90
              ? "bg-gradient-to-r from-red-500 to-orange-500"
              : "bg-gradient-to-r from-primary to-violet-500"
            }`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
        <div className="flex items-center gap-2 italic">
          <span className={`w-2 h-2 rounded-full ${pct >= 90 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
          {data?.messagesRemaining} {isBn ? "টি মেসেজ বাকি" : "messages left"}
        </div>
        <div>{pct}% {isBn ? "ব্যবহৃত" : "consumed"}</div>
      </div>
    </div>
  );
}
