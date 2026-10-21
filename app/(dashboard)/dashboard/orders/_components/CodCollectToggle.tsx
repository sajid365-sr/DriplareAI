"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface CodCollectToggleProps {
  orderId: string;
  initialCollected: boolean;
  collectedAt?: string | null;
  onToggle?: () => void;
}

/** Toggle button to mark COD as collected or uncollected (Feature #26). */
export function CodCollectToggle({
  orderId,
  initialCollected,
  collectedAt,
  onToggle,
}: CodCollectToggleProps) {
  const { t } = useTranslation("orders");
  const [collected, setCollected] = useState(initialCollected);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/cod-collect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collected: !collected }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };

      if (res.ok && data.success) {
        const next = !collected;
        setCollected(next);
        toast.success(
          next
            ? t("cod.markedCollected", "COD marked as collected ✅")
            : t("cod.markedUncollected", "COD collection mark removed")
        );
        onToggle?.();
      } else {
        toast.error(data.error ?? t("cod.toggleError", "Failed to update COD status"));
      }
    } catch {
      toast.error(t("cod.toggleError", "Failed to update COD status"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3"
    >
      <Button
        type="button"
        variant={collected ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
        className={`h-8 gap-1.5 text-xs font-semibold cursor-pointer ${
          collected
            ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm"
            : "border-border text-muted-foreground"
        }`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : collected ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : (
          <Clock className="w-3.5 h-3.5" />
        )}
        {collected
          ? t("cod.collected", "COD Collected")
          : t("cod.markAsCollected", "Mark as Collected")}
      </Button>
      {collected && collectedAt && (
        <span className="text-[10px] text-muted-foreground font-mono">
          {new Date(collectedAt).toLocaleDateString()}
        </span>
      )}
    </motion.div>
  );
}

