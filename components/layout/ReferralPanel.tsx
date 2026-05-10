"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { ReferralData } from "./referral/types";
import { ReferTab } from "./referral/ReferTab";
import { InfoTab } from "./referral/InfoTab";

interface ReferralPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ReferralPanel({ open, onClose }: ReferralPanelProps) {
  const [tab, setTab] = useState<"refer" | "info">("refer");
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/referral")
        .then(r => r.json())
        .then(setData)
        .catch(() => toast.error("Failed to load referral data"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const referralLink = data?.referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/sign-up?ref=${data.referralCode}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="w-full max-w-[500px] max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            >
              {/* Header Tabs */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
                <div className="flex gap-1.5 bg-muted p-1 rounded-xl">
                  {(["refer", "info"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {t === "refer" ? "Refer" : "Info"}
                    </button>
                  ))}
                </div>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 scrollbar-thin pb-4">
                {tab === "refer" && (
                  <ReferTab
                    data={data}
                    loading={loading}
                    copied={copied}
                    copyLink={copyLink}
                    referralLink={referralLink}
                  />
                )}
                {tab === "info" && (
                  <InfoTab
                    data={data}
                    loading={loading}
                    onClose={onClose}
                  />
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
