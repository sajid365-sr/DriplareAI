"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReferralSectionProps {
  referralCode: string | null;
}

export function ReferralSection({ referralCode }: ReferralSectionProps) {
  const [copied, setCopied] = useState(false);

  if (!referralCode) return null;

  const copyReferral = () => {
    navigator.clipboard.writeText(`${typeof window !== "undefined" ? window.location.origin : ""}?ref=${referralCode}`);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
      className="p-6 rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Gift className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Refer & Earn</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Share your referral link. Earn rewards when friends sign up.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-muted text-sm px-4 py-2.5 rounded-xl font-mono truncate">
          {typeof window !== "undefined" ? window.location.origin : ""}?ref={referralCode}
        </code>
        <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={copyReferral}>
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>
    </motion.div>
  );
}
