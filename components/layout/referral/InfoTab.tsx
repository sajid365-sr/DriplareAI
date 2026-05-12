"use client";

import { Zap, Users, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReferralData } from "./types";

interface InfoTabProps {
  data: ReferralData | null;
  loading: boolean;
  onClose: () => void;
}

export function InfoTab({ data, loading, onClose }: InfoTabProps) {
  const displayedReferrals = data?.referrals?.slice(0, 5) ?? [];

  return (
    <div className="p-5 space-y-6">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Your Referral Info</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-muted/40 border border-border p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Reward Earned</p>
          <div className="flex items-end gap-2 mt-2">
            <Zap className="w-5 h-5 text-amber-500 mb-1" />
            <span className="text-3xl font-bold">{data?.totalEarned ?? 0}</span>
            <span className="text-xs font-medium text-muted-foreground mb-1.5">msgs</span>
          </div>
        </div>
        <div className="rounded-xl bg-muted/40 border border-border p-5 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Total Referrals</p>
          <div className="flex items-end gap-2 mt-2">
            <Users className="w-5 h-5 text-primary mb-1" />
            <span className="text-3xl font-bold">{data?.totalReferrals ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Referral Table */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Recent Referrals (Latest 5)</p>
          <Link 
            href="/dashboard/settings/referrals" 
            onClick={onClose}
            className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
          >
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="grid grid-cols-3 text-xs font-bold text-muted-foreground bg-muted/60 px-4 py-3 border-b border-border">
            <span>Name</span>
            <span>Status</span>
            <span className="text-right">Reward</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">Loading...</div>
          ) : displayedReferrals.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-muted-foreground">No referrals yet.</div>
          ) : (
            displayedReferrals.map((r) => (
              <div key={r.id} className="grid grid-cols-3 text-sm px-4 py-3 border-b border-border last:border-0 items-center hover:bg-muted/30 transition-colors">
                <span className="font-semibold truncate text-foreground/90">{r.name}</span>
                <span>
                  {r.status === "subscribed" ? (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 font-semibold text-xs border border-emerald-500/20">Subscribed</span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-medium text-xs border border-border">Signed up</span>
                  )}
                </span>
                <span className="text-right font-medium text-muted-foreground">
                  {r.rewardEarned > 0 ? <span className="text-emerald-500 font-bold">+{r.rewardEarned} msgs</span> : "Waiting"}
                </span>
              </div>
            ))
          )}
        </div>
        <p className="text-[11px] font-medium text-muted-foreground mt-2 px-1">*Friend must subscribe to a paid plan for +500 messages reward.</p>
      </div>

      {/* Terms */}
      <div className="pt-2">
        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-4">Terms & Conditions</p>
        <div className="space-y-4">
          {[
            { title: "New users only", desc: "Referral program is exclusively for first-time REMOVED users." },
            { title: "Reward eligibility", desc: "You earn +500 messages when your friend subscribes to any paid plan." },
            { title: "Program flexibility", desc: "We may modify or discontinue this program at any time." },
            { title: "Appropriate sharing", desc: "Spam or misleading promotions may result in account penalties." },
            { title: "Quality control", desc: "Fraudulent activity may result in account suspension." },
          ].map((t) => (
            <div key={t.title} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <ArrowRight className="w-3 h-3 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/90">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
