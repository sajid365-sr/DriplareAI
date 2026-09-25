"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { FileText, Loader2, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPlansForRegion, resolveLocalStr } from "@/lib/domain/plan-config";
import type { Region } from "@/lib/core/region";
import { cn } from "@/lib/utils";

/**
 * Admin Create Invoice Dialog
 * ─────────────────────────────────────────────────────────────────────────────
 * Merchant নিজে upgrade/top-up করতে না পারলে admin তার জন্য একটি **payable
 * invoice** তৈরি করেন। Merchant email-এ একটি link পান → নিজের dashboard-এর
 * invoice page-এ গিয়ে gateway দিয়ে পরিশোধ করেন → webhook এলে credit/plan
 * স্বয়ংক্রিয়ভাবে যোগ হয় (`applyPaymentGrant`)।
 *
 * কেন সরাসরি credit না দিয়ে invoice: এতে টাকার হিসাব (revenue) সঠিক থাকে।
 * শুধু goodwill/compensation-এর জন্য credit দিতে হয়, সেটি `ManualTopupDialog`
 * (Grant Credits) করে — ওখানে কোনো invoice বা revenue নেই।
 */

/** Invoice page-এ login দরকার হয়, তাই workspace থেকেও ব্যবহারযোগ্য। */
export interface InvoiceUser {
  userId: string;
  name: string;
  email: string;
  picture: string | null;
  creditsBalance: number;
  plan: string;
  region: Region;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Workspace page থেকে দিলে user search আর লাগে না। */
  presetUser?: InvoiceUser;
}

type InvoiceKind = "credits" | "plan";

/**
 * Invoice সবসময় **BDT**-তে — কারণ অনলাইন payment এখন শুধু বাংলাদেশের
 * (UddoktaPay)। USD invoice তৈরি করা মানে merchant-এর হাতে এমন link দেওয়া
 * যা সে কখনো পরিশোধ করতে পারবে না, তাই সেই অপশনটি বাদ দেওয়া হয়েছে।
 */
const INVOICE_CURRENCY = "bdt" as const;

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  presetUser,
}: CreateInvoiceDialogProps) {
  const { t, i18n } = useTranslation("admin");
  const lang = i18n.language?.startsWith("bn") ? "bn" : "en";

  // ── User selection ───────────────────────────────────────────────────────────
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<InvoiceUser | null>(presetUser ?? null);

  // ── Invoice form ─────────────────────────────────────────────────────────────
  const [kind, setKind] = useState<InvoiceKind>("credits");
  const [amount, setAmount] = useState("");
  const [creditsToGrant, setCreditsToGrant] = useState("");
  const [plan, setPlan] = useState("");
  const [description, setDescription] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Plan তালিকা সর্বদা BD-র — অনলাইনে কেনা যায় শুধু এই plan-গুলোই।
  const region: Region = "bd";
  const plans = useMemo(() => getPlansForRegion(region), [region]);

  /**
   * `presetUser` একটি object literal — parent প্রতিবার render হলে নতুন identity
   * পায়। এটিকে সরাসরি effect-এর dependency করলে parent-এর যেকোনো re-render-এ
   * admin-এর লেখা form (amount, description) মুছে যেত। তাই ref-এ ধরে শুধু
   * dialog **খোলার মুহূর্তে** একবার reset করা হয়।
   */
  const presetRef = useRef(presetUser);

  useEffect(() => {
    presetRef.current = presetUser;
  }, [presetUser]);

  // Dialog খোলার সময় presetUser (থাকলে) বসানো হয়
  useEffect(() => {
    if (!open) return;

    const preset = presetRef.current;
    setFoundUser(preset ?? null);
    setSearchEmail("");
    setKind("credits");
    setAmount("");
    setCreditsToGrant("");
    setPlan("");
    setDescription("");
    setSendEmail(true);
  }, [open]);

  if (!open) return null;

  const parsedAmount = Number(amount);
  const parsedCredits = creditsToGrant ? parseInt(creditsToGrant, 10) : null;

  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const creditsValid = kind !== "credits" || (parsedCredits !== null && parsedCredits > 0);
  const planValid = kind !== "plan" || plan.length > 0;
  const canSubmit =
    !!foundUser && amountValid && creditsValid && planValid && description.trim().length >= 3 && !submitting;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    try {
      const res = await fetch(
        `/api/admin/users?search=${encodeURIComponent(searchEmail.trim())}&limit=1`
      );
      if (!res.ok) throw new Error();

      const data = await res.json();
      const user = data.users?.[0];
      if (!user) {
        toast.error(t("billing.invoice.userNotFound"));
      } else {
        setFoundUser(user);
      }
    } catch {
      toast.error(t("billing.invoice.searchError"));
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !foundUser) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_invoice",
          userId: foundUser.userId,
          kind,
          amount: parsedAmount,
          currency: INVOICE_CURRENCY,
          description: description.trim(),
          ...(kind === "credits" && parsedCredits ? { creditsToGrant: parsedCredits } : {}),
          ...(kind === "plan" && plan ? { plan } : {}),
          sendEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t("billing.invoice.error"));

      toast.success(
        data.invoice?.emailSent
          ? t("billing.invoice.successEmailed", { invoice: data.invoice.invoiceNumber })
          : t("billing.invoice.success", { invoice: data.invoice.invoiceNumber })
      );
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("billing.invoice.error"));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border border-primary/15 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            {t("billing.invoice.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("billing.invoice.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* ── Merchant search (workspace page-এ preset হলে hidden) ── */}
          {!presetUser && (
            <div className="space-y-1.5">
              <Label htmlFor="invoice-email" className="text-xs font-medium">
                {t("billing.invoice.emailLabel")}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="invoice-email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder={t("billing.invoice.emailPlaceholder")}
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSearch}
                  disabled={searching || !searchEmail.trim()}
                  className="shrink-0 rounded-xl"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Selected merchant ── */}
          {foundUser && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                <AvatarImage src={foundUser.picture ?? undefined} alt={foundUser.name} />
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {foundUser.name ? foundUser.name.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{foundUser.name}</p>
                <p className="truncate text-xs text-muted-foreground">{foundUser.email}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold capitalize text-primary">{foundUser.plan}</p>
                <p className="text-[10px] text-muted-foreground">
                  {foundUser.creditsBalance.toLocaleString()} {t("billing.invoice.creditsSuffix")}
                </p>
              </div>
            </div>
          )}

          {/* ── What the invoice is for ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t("billing.invoice.kindLabel")}</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["credits", "plan"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  disabled={!foundUser}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-xs font-medium transition-all disabled:opacity-50",
                    kind === option
                      ? "border-primary bg-primary/10 text-primary shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {t(`billing.invoice.kinds.${option}`)}
                </button>
              ))}
            </div>
          </div>

          {/* ── Plan selector (plan invoice হলে) ── */}
          {kind === "plan" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t("billing.invoice.planLabel")}</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value ?? "")} disabled={!foundUser}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={t("billing.invoice.planPlaceholder")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {plans.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {resolveLocalStr(p.name, lang)} — {resolveLocalStr(p.priceLabel, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Credits to grant (credit invoice হলে) ── */}
          {kind === "credits" && (
            <div className="space-y-1.5">
              <Label htmlFor="invoice-credits" className="text-xs font-medium">
                {t("billing.invoice.creditsLabel")}
              </Label>
              <Input
                id="invoice-credits"
                type="number"
                min={1}
                value={creditsToGrant}
                onChange={(e) => setCreditsToGrant(e.target.value)}
                placeholder={t("billing.invoice.creditsPlaceholder")}
                className="rounded-xl"
                disabled={!foundUser}
              />
              <p className="text-[10px] text-muted-foreground">
                {t("billing.invoice.creditsHint")}
              </p>
            </div>
          )}

          {/* ── Amount — currency সবসময় BDT ── */}
          <div className="space-y-1.5">
            <Label htmlFor="invoice-amount" className="text-xs font-medium">
              {t("billing.invoice.amountLabel")}
            </Label>
            <Input
              id="invoice-amount"
              type="number"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("billing.invoice.amountPlaceholder")}
              className="rounded-xl"
              disabled={!foundUser}
            />
            <p className="text-[10px] text-muted-foreground">
              {t("billing.invoice.currencyHint", {
                gateway: t("billing.invoice.gatewayBdt"),
              })}
            </p>
          </div>

          {/* ── Description (PDF + email দুই জায়গাতেই যায়) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="invoice-description" className="text-xs font-medium">
              {t("billing.invoice.descriptionLabel")}
            </Label>
            <Textarea
              id="invoice-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("billing.invoice.descriptionPlaceholder")}
              className="min-h-[70px] resize-none rounded-xl"
              disabled={!foundUser}
            />
            <p className="text-[10px] text-muted-foreground">
              {t("billing.invoice.descriptionHint")}
            </p>
          </div>

          {/* ── Email toggle ── */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium">{t("billing.invoice.sendEmailLabel")}</p>
              <p className="text-[10px] text-muted-foreground">
                {t("billing.invoice.sendEmailHint")}
              </p>
            </div>
            <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            {t("billing.invoice.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-xl bg-brand-gradient text-primary-foreground hover:opacity-90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("billing.invoice.submitting")}
              </>
            ) : (
              t("billing.invoice.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
