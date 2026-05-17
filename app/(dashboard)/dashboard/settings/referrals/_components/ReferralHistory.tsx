"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Calendar, CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ReferralEntry {
  id: string;
  name: string;
  email: string;
  date: string;
  status: "Joined" | "Subscribed";
  reward: number;
}

interface ReferralHistoryProps {
  history: ReferralEntry[];
}

export function ReferralHistory({ history }: ReferralHistoryProps) {
  const [search, setSearch] = useState("");
  const { t } = useTranslation("settings");

  const filteredHistory = history.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
    >
      <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg">{t("referrals.history.title", "Referral History")}</h3>
          <p className="text-sm text-muted-foreground">{t("referrals.history.subtitle", "Detailed logs of all your referred friends and rewards.")}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder={t("referrals.history.search", "Search friends...")} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none transition-all w-full sm:w-[240px]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-4">{t("referrals.history.cols.friend", "Friend")}</th>
              <th className="px-6 py-4">{t("referrals.history.cols.status", "Status")}</th>
              <th className="px-6 py-4">{t("referrals.history.cols.date", "Date")}</th>
              <th className="px-6 py-4 text-right">{t("referrals.history.cols.reward", "Reward")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{entry.name}</span>
                      <span className="text-[11px] text-muted-foreground">{entry.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {entry.status === "Subscribed" ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-[11px] font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("referrals.history.status.subscribed", "Subscribed")}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        {t("referrals.history.status.joined", "Joined")}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5" />
                      {entry.date}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-sm ${entry.reward > 0 ? "text-primary" : "text-muted-foreground"}`}>
                      {entry.reward > 0 ? `+${entry.reward}` : t("referrals.history.status.pending", "Pending")}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm italic">
                  {t("referrals.history.empty", "No referrals found yet. Share your link to start earning!")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
