"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Coins, PlusCircle, MinusCircle, History, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type WorkspaceDetailData } from "./WorkspaceOverviewTab";

interface CreditTransactionItem {
  id: string;
  action_type: string;
  model_tier?: string | null;
  credits_spent: number;
  createdAt: string;
  metadata?: any;
}

interface CreditLedgerTabProps {
  data: WorkspaceDetailData;
  creditTransactions: CreditTransactionItem[];
  onRefresh: () => void;
}

export function CreditLedgerTab({ data, creditTransactions, onRefresh }: CreditLedgerTabProps) {
  const { t } = useTranslation("admin");

  // Adjustment Form State
  const [adjustmentType, setAdjustmentType] = useState<"topup" | "deduct">("topup");
  const [amount, setAmount] = useState("");
  const [auditNote, setAuditNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid credit amount greater than 0");
      return;
    }

    if (!auditNote.trim()) {
      toast.error("Mandatory Audit Note / Reason is required for compliance logging.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/workspaces/${data.workspace.workspaceId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust_credits",
          type: adjustmentType,
          amount: numAmount,
          auditNote: auditNote.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to adjust credits");

      toast.success(resData.message || "Credits adjusted successfully!");
      setAmount("");
      setAuditNote("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust credits");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Credit Balance Summary & Manual Adjustment Form */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Balance Card */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              {t("workspaces.ledger.balanceTitle", "Credit Balance")}
            </CardTitle>
            <CardDescription>{t("workspaces.ledger.balanceDesc", "Active token credits balance")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-5 text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Available Balance</p>
              <h3 className="mt-2 text-3xl font-extrabold text-primary">
                {data.owner.creditsBalance.toLocaleString()}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Included in Plan: {data.owner.includedCredits.toLocaleString()}
              </p>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground pt-2">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span>Used This Cycle</span>
                <span className="font-semibold text-foreground">{data.owner.creditsUsedThisCycle.toLocaleString()} credits</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adjustment Form Card */}
        <Card className="border-primary/10 bg-card/60 backdrop-blur-xl md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" />
              {t("workspaces.ledger.adjustTitle", "Manual Credit Top-Up / Deduction")}
            </CardTitle>
            <CardDescription>{t("workspaces.ledger.adjustDesc", "Admin override with required compliance audit notes")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdjustCredits} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Adjustment Type</label>
                  <Select value={adjustmentType} onValueChange={(val: "topup" | "deduct") => setAdjustmentType(val)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="topup">
                        <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                          <PlusCircle className="h-3.5 w-3.5" /> Top-Up (+ Add)
                        </span>
                      </SelectItem>
                      <SelectItem value="deduct">
                        <span className="flex items-center gap-1.5 text-rose-500 font-semibold">
                          <MinusCircle className="h-3.5 w-3.5" /> Deduct (- Remove)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Credit Amount</label>
                  <Input
                    type="number"
                    placeholder="e.g. 1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                  <span>Mandatory Audit Note / Reason</span>
                  <span className="text-[10px] text-rose-500 font-semibold">* Required</span>
                </label>
                <Input
                  placeholder="e.g. Refund for platform downtime ticket #4920"
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  className="rounded-xl border-amber-500/30 focus:border-amber-500"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !amount || !auditNote.trim()}
                className="w-full rounded-xl bg-brand-gradient text-white font-medium"
              >
                {loading ? "Processing..." : `Confirm ${adjustmentType === "topup" ? "Top-Up" : "Deduction"}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Credit Transactions History Table */}
      <Card className="border-primary/10 bg-card/60 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            {t("workspaces.ledger.historyTitle", "Credit Audit Ledger History")} ({creditTransactions.length})
          </CardTitle>
          <CardDescription>{t("workspaces.ledger.historyDesc", "Comprehensive log of all credit deductions and manual adjustments")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!creditTransactions.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No credit transactions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-primary/10 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Action Type</th>
                    <th className="px-4 py-3">Model / Tier</th>
                    <th className="px-4 py-3">Credits</th>
                    <th className="px-4 py-3">Audit Note / Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {creditTransactions.map((tx) => {
                    const isPositive = tx.credits_spent < 0 || tx.action_type === "admin_topup";
                    const displayCredits = Math.abs(tx.credits_spent);
                    const auditNoteText = tx.metadata?.auditNote || tx.metadata?.reason || null;

                    return (
                      <tr key={tx.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize text-[11px]">
                            {tx.action_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {tx.model_tier || tx.metadata?.model || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold text-xs ${isPositive ? "text-emerald-500" : "text-rose-500"}`}>
                            {isPositive ? `+${displayCredits}` : `-${displayCredits}`} credits
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                          {auditNoteText ? (
                            <span className="text-foreground font-medium flex items-center gap-1">
                              <FileText className="h-3 w-3 text-amber-500 shrink-0" />
                              {auditNoteText}
                            </span>
                          ) : (
                            tx.metadata ? JSON.stringify(tx.metadata) : "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
