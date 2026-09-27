"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, FileText, CheckCircle2, Sparkles, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type WorkspaceDetailData } from "./WorkspaceOverviewTab";

interface BillingAndPlanTabProps {
  data: WorkspaceDetailData;
  onRefresh: () => void;
}

const PLANS = [
  { id: "starter", name: "Starter", price: "৳0/mo", credits: "500 credits/mo" },
  { id: "growth", name: "Growth", price: "৳2,990/mo", credits: "5,000 credits/mo" },
  { id: "pro", name: "Pro", price: "৳7,990/mo", credits: "15,000 credits/mo" },
  { id: "agency", name: "Agency", price: "৳14,990/mo", credits: "35,000 credits/mo" },
  { id: "enterprise", name: "Enterprise", price: "৳19,900/mo", credits: "100,000 credits/mo" },
];

export function BillingAndPlanTab({ data, onRefresh }: BillingAndPlanTabProps) {
  const { t } = useTranslation("admin");
  const [selectedPlan, setSelectedPlan] = useState(data.owner.plan.toLowerCase());
  const [planLoading, setPlanLoading] = useState(false);

  // Manual Invoice State
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceCurrency, setInvoiceCurrency] = useState("BDT");
  const [invoiceDesc, setInvoiceDesc] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  const handlePlanChange = async () => {
    if (selectedPlan === data.owner.plan.toLowerCase()) {
      toast.info("Selected plan is already active.");
      return;
    }

    setPlanLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${data.workspace.workspaceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "change_plan", plan: selectedPlan }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to update plan");

      toast.success(resData.message || `Plan changed to ${selectedPlan}`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceAmount || parseFloat(invoiceAmount) <= 0) {
      toast.error("Please enter a valid positive invoice amount");
      return;
    }

    setInvoiceLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${data.workspace.workspaceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual_invoice",
          amount: invoiceAmount,
          currency: invoiceCurrency,
          description: invoiceDesc,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to create invoice");

      toast.success(resData.message || "Invoice generated successfully!");
      setInvoiceAmount("");
      setInvoiceDesc("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create invoice");
    } finally {
      setInvoiceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Plan Management */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("workspaces.billing.planTitle", "Subscription Plan Management")}
            </CardTitle>
            <CardDescription>{t("workspaces.billing.planDesc", "Modify subscriber tier and credit allocations")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-primary/10 p-4 border border-primary/20">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Current Active Plan</p>
                <h4 className="text-lg font-bold capitalize text-primary mt-0.5">{data.owner.plan} Plan</h4>
              </div>
              <Badge className="bg-primary text-white capitalize">{data.owner.plan}</Badge>
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Select New Plan Tier
              </label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Select plan tier" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {PLANS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-semibold">{p.name}</span> — {p.price} ({p.credits})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handlePlanChange}
              disabled={planLoading || selectedPlan === data.owner.plan.toLowerCase()}
              className="w-full rounded-xl bg-brand-gradient text-white font-medium"
            >
              {planLoading ? "Updating Plan..." : "Apply Plan Change"}
            </Button>
          </CardContent>
        </Card>

        {/* Custom Manual Invoicing */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {t("workspaces.billing.invoiceTitle", "Custom Manual Invoicing")}
            </CardTitle>
            <CardDescription>{t("workspaces.billing.invoiceDesc", "Trigger manual payment transactions & receipts")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Amount</label>
                  <Input
                    type="number"
                    placeholder="e.g. 5000"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Currency</label>
                  <Select value={invoiceCurrency} onValueChange={setInvoiceCurrency}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="BDT">BDT (৳)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description / Notes</label>
                <Input
                  placeholder="e.g. Enterprise Custom Onboarding & Token Top-Up"
                  value={invoiceDesc}
                  onChange={(e) => setInvoiceDesc(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={invoiceLoading || !invoiceAmount}
                className="w-full rounded-xl"
                variant="outline"
              >
                <Send className="mr-2 h-4 w-4" />
                {invoiceLoading ? "Generating Invoice..." : "Generate Manual Invoice"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
