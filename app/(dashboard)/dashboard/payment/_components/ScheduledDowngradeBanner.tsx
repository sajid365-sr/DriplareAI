import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Clock, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ScheduledDowngradeBannerProps {
  plan: string;
  scheduledAt: string;
  onCancelDowngrade: () => void;
  isCancelling: boolean;
}

export function ScheduledDowngradeBanner({
  plan,
  scheduledAt,
  onCancelDowngrade,
  isCancelling,
}: ScheduledDowngradeBannerProps) {
  const { t, i18n } = useTranslation("payment");
  const isBn = i18n.language === "bn";

  const formattedDate = new Date(scheduledAt).toLocaleDateString(
    isBn ? "bn-BD" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm dark:shadow-none"
    >
      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {t("scheduledDowngrade.bannerTitle")}
        </p>
        <p
          className="text-xs text-muted-foreground mt-0.5"
          dangerouslySetInnerHTML={{
            __html: t("scheduledDowngrade.bannerDesc", {
              plan: plan.toUpperCase(),
              date: formattedDate,
            }),
          }}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 h-8 text-xs rounded-lg border-amber-500/30 text-foreground bg-background hover:bg-amber-500/10 shadow-sm"
        onClick={onCancelDowngrade}
        disabled={isCancelling}
      >
        {isCancelling ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <X className="w-3 h-3 mr-1" />
            {t("scheduledDowngrade.cancelBtn")}
          </>
        )}
      </Button>
    </motion.div>
  );
}
