import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Clock, X, Loader2, ArrowDownCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ScheduledDowngradeBannerProps {
  plan: string;
  scheduledAt: string;
  onCancelDowngrade: () => void;
  onApplyImmediately: () => void;
  isCancelling: boolean;
  isApplying: boolean;
}

export function ScheduledDowngradeBanner({
  plan,
  scheduledAt,
  onCancelDowngrade,
  onApplyImmediately,
  isCancelling,
  isApplying,
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
      className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 shadow-sm dark:shadow-none"
    >
      <div className="flex items-start gap-3">
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
      </div>
      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-8 text-xs rounded-lg border-amber-500/30 text-foreground bg-background hover:bg-amber-500/10 shadow-sm"
          onClick={onCancelDowngrade}
          disabled={isCancelling || isApplying}
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
        <Button
          size="sm"
          variant="destructive"
          className="shrink-0 h-8 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-sm flex items-center gap-1"
          onClick={onApplyImmediately}
          disabled={isCancelling || isApplying}
        >
          {isApplying ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              <ArrowDownCircle className="w-3.5 h-3.5" />
              {t("scheduledDowngrade.applyNowBtn", "Downgrade Now")}
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
