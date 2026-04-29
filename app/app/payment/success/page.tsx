"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const invoiceId = params.get("invoice_id");
  const gateway = params.get("gateway") || "stripe";
  const [status, setStatus] = useState(() =>
    !sessionId && !invoiceId ? "error" : "checking"
  );
  const router = useRouter();
  const attempts = useRef(0);

  useEffect(() => {
    if (!sessionId && !invoiceId) {
      return;
    }
    let stopped = false;
    
    const poll = async () => {
      if (stopped || attempts.current >= 8) {
        if (!stopped) setStatus("timeout");
        return;
      }
      attempts.current += 1;
      try {
        let paid = false;
        if (gateway === "uddoktapay" && invoiceId) {
          const r = await fetch("/api/payments/uddoktapay/verify", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invoice_id: invoiceId })
          });
          const data = await r.json();
          paid = data.payment_status === "paid";
        } else {
          const r = await fetch(`/api/payments/checkout/status/${sessionId}`);
          const data = await r.json();
          paid = data.payment_status === "paid";
          if (data.status === "expired") { setStatus("expired"); return; }
        }
        
        if (paid) {
          setStatus("paid");
          router.refresh();
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { stopped = true; };
  }, [sessionId, invoiceId, gateway, router]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center p-8 rounded-2xl border border-border bg-card" data-testid="payment-success-card">
      {status === "checking" && (
        <>
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <h2 className="text-xl font-semibold">Verifying your payment…</h2>
          <p className="text-sm text-muted-foreground mt-1">Hang tight, we&apos;re confirming with the gateway.</p>
        </>
      )}
      {status === "paid" && (
        <>
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-2xl font-bold tracking-tight">Welcome to Pro <Sparkles className="w-5 h-5 inline text-primary" /></h2>
          <p className="text-sm text-muted-foreground mt-1">Payment confirmed. Your plan is upgraded.</p>
          <Button className="mt-6 rounded-full" onClick={() => router.push("/app/chatbots")} data-testid="success-go">Go to dashboard</Button>
        </>
      )}
      {(status === "expired" || status === "timeout" || status === "error") && (
        <>
          <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-semibold">{status === "expired" ? "Session expired" : status === "timeout" ? "Still processing" : "Something went wrong"}</h2>
          <p className="text-sm text-muted-foreground mt-1">{status === "timeout" ? "Refresh in a moment to confirm your plan." : "Please try again."}</p>
          <Button className="mt-6 rounded-full" variant="outline" onClick={() => router.push("/app/payment")} data-testid="success-retry">Back to billing</Button>
        </>
      )}
    </motion.div>
  );
}

export default function PaymentSuccess() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Suspense fallback={<div>Loading...</div>}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
