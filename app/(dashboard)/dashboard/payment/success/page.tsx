"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useTranslation } from "react-i18next";

function SuccessContent() {
  const { fetchNotifications } = useNotifications();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const invoiceId = params.get("invoice_id");
  const gateway = params.get("gateway") || "stripe";
  const [plan, setPlan] = useState("pro");
  const [status, setStatus] = useState("checking");
  const router = useRouter();
  const attempts = useRef(0);
  const { t } = useTranslation("payment");

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      if (stopped || attempts.current >= 20) {
        if (!stopped) setStatus("timeout");
        return;
      }
      attempts.current += 1;
      try {
        let paid = false;
        let pName = "pro";
        if (gateway === "uddoktapay") {
          const r = await fetch("/api/payments/uddoktapay/verify", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoice_id: invoiceId })
          });
          const data = await r.json();
          paid = data.payment_status === "paid";
          pName = data.plan || "pro";
        } else {
          const r = await fetch(`/api/payments/checkout/status/${sessionId}`);
          const data = await r.json();
          paid = data.payment_status === "paid";
          pName = data.plan || "pro";
          if (data.status === "expired") { setStatus("expired"); return; }
        }
        
        if (paid) {
          setPlan(pName);
          setStatus("paid");
          fetchNotifications(); // Instant refresh
          router.refresh();
          return;
        }
        setTimeout(poll, 3000);
      } catch {
        setTimeout(poll, 3000);
      }
    };
    poll();
    return () => { stopped = true; };
  }, [sessionId, invoiceId, gateway, router]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="max-w-xl w-full p-1 rounded-3xl bg-gradient-to-br from-primary/20 via-border to-purple-500/20 shadow-2xl"
    >
      <div className="bg-card/80 backdrop-blur-xl rounded-[22px] p-10 text-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -ml-16 -mb-16" />

        {status === "checking" && (
          <div className="py-10 space-y-4">
            <div className="relative w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 animate-spin text-primary opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t("success.verifying", "Verifying Payment")}</h2>
              <p className="text-muted-foreground mt-2 max-w-[280px] mx-auto text-sm">
                {t("success.verifyingDesc", "Securely confirming your transaction. This will only take a moment.")}
              </p>
            </div>
          </div>
        )}

        {status === "paid" && (
          <div className="py-6 space-y-6">
            <div className="relative inline-flex items-center justify-center">
              <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse" />
              <CheckCircle2 className="w-20 h-20 text-emerald-500 relative z-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                {t("success.welcome", "Welcome to")} <span className="text-primary capitalize">{plan}</span>
                <Sparkles className="w-8 h-8 inline-block ml-2 text-primary animate-bounce" />
              </h2>
              <p className="text-lg text-muted-foreground font-medium">
                {t("success.confirmed", "Payment confirmed. Your account is now upgraded.")}
              </p>
            </div>

            <div className="pt-6 flex flex-col gap-3 max-w-[280px] mx-auto">
              <Button 
                size="lg"
                className="w-full h-12 rounded-2xl font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                onClick={() => router.push("/dashboard/payment/history")}
              >
                {t("success.btnHistory", "View Billing History")}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => router.push("/dashboard")}
              >
                {t("success.btnDashboard", "Back to Dashboard")}
              </Button>
            </div>
          </div>
        )}

        {(status === "expired" || status === "timeout" || status === "error") && (
          <div className="py-8 space-y-6">
            <XCircle className="w-20 h-20 text-destructive mx-auto opacity-80" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {status === "expired" ? t("success.sessionExpired", "Session Expired") : status === "timeout" ? t("success.delayed", "Processing Delayed") : t("success.failed", "Transaction Failed")}
              </h2>
              <p className="text-muted-foreground text-sm max-w-[300px] mx-auto">
                {status === "timeout" 
                  ? t("success.timeoutDesc", "We're still waiting for the bank confirmation. Please refresh this page in a minute.") 
                  : t("success.failedDesc", "We couldn't verify your payment. If money was deducted, please contact support.")}
              </p>
            </div>
            <div className="pt-4 flex flex-col gap-3 max-w-[240px] mx-auto">
              <Button 
                variant="outline"
                className="rounded-xl h-11 border-border/60 hover:bg-muted"
                onClick={() => router.push("/dashboard/payment")}
              >
                {t("success.btnReturn", "Return to Pricing")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function PaymentSuccess() {
  const { t } = useTranslation("payment");

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Suspense fallback={<div>{t("success.loading", "Loading...")}</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
