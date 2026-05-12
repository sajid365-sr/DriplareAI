"use client";

import { motion } from "framer-motion";
import { Search, Calendar, CheckCircle2, Clock } from "lucide-react";

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
    >
      <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg">Referral History</h3>
          <p className="text-sm text-muted-foreground">Detailed logs of all your referred friends and rewards.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search friends..." 
            className="pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none transition-all w-full sm:w-[240px]"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-6 py-4">Friend</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4 text-right">Reward</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {history.length > 0 ? (
              history.map((entry) => (
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
                        Subscribed
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-bold">
                        <Clock className="w-3.5 h-3.5" />
                        Joined
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
                      {entry.reward > 0 ? `+${entry.reward}` : "Pending"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm italic">
                  No referrals found yet. Share your link to start earning!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
