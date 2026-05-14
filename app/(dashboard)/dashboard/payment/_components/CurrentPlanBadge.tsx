import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CurrentPlanBadgeProps {
  currentPlan: string;
  canCancelToStarter: boolean;
  handleDowngradeClick: (plan: string) => void;
  loadingDowngradePlan: string | null;
  loadingPlan: string | null;
  planIcon: any;
}

export function CurrentPlanBadge({
  currentPlan,
  canCancelToStarter,
  handleDowngradeClick,
  loadingDowngradePlan,
  loadingPlan,
  planIcon: Icon,
}: CurrentPlanBadgeProps) {
  const { t } = useTranslation("payment");

  return (
    <div className="flex items-center justify-end gap-3">
      {canCancelToStarter && (
        <Button
          variant="outline"
          onClick={() => handleDowngradeClick("starter")}
          disabled={!!loadingDowngradePlan || !!loadingPlan}
          className="group relative overflow-hidden text-destructive/80 hover:text-destructive border-destructive/20 hover:border-destructive/40 bg-destructive/5 hover:bg-destructive/10 text-xs font-semibold px-4 rounded-xl h-10 transition-all duration-300 shadow-sm hover:shadow-md"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-destructive/0 via-destructive/5 to-destructive/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
          {loadingDowngradePlan === "starter" ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin relative z-10" />
          ) : (
            <X className="w-3.5 h-3.5 mr-1.5 opacity-70 group-hover:opacity-100 transition-opacity relative z-10" />
          )}
          <span className="relative z-10">{t("cancelSubscription", "Cancel Subscription")}</span>
        </Button>
      )}
      <div className="flex items-center gap-3 p-1.5 pr-4 rounded-2xl bg-muted/30 border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("currentPlan")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 cursor-default">
            <Icon className="w-3.5 h-3.5" />
            <span className="font-bold capitalize text-sm tracking-tight">
              {currentPlan}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
