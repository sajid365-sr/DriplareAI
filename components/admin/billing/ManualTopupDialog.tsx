"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Search, Coins } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FoundUser {
  userId: string;
  name: string;
  email: string;
  picture: string | null;
  creditsBalance: number;
  plan: string;
}

interface ManualTopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────────
export function ManualTopupDialog({
  open,
  onOpenChange,
  onSuccess,
}: ManualTopupDialogProps) {
  const { t } = useTranslation("admin");

  // Search state
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);

  // Form state
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset dialog state on close
  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setSearchEmail("");
      setFoundUser(null);
      setAmount("");
      setReason("");
    }
    onOpenChange(val);
  };

  // Search user by email
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
        toast.error(t("billing.topup.userNotFound"));
      } else {
        setFoundUser(user);
      }
    } catch {
      toast.error(t("billing.topup.searchError"));
    } finally {
      setSearching(false);
    }
  };

  // Submit top-up
  const handleSubmit = async () => {
    if (!foundUser) return;
    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error(t("billing.topup.invalidAmount"));
      return;
    }
    if (reason.trim().length < 10) {
      toast.error(t("billing.topup.reasonTooShort"));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: foundUser.userId,
          amount: parsedAmount,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");

      toast.success(
        t("billing.topup.success", {
          name: data.user.name,
          amount: parsedAmount,
          balance: data.newBalance,
        })
      );
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("billing.topup.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl border border-primary/15 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Coins className="h-4 w-4" />
            </span>
            {t("billing.topup.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("billing.topup.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ── User Search ── */}
          <div className="space-y-1.5">
            <Label htmlFor="topup-email" className="text-xs font-medium">
              {t("billing.topup.emailLabel")}
            </Label>
            <div className="flex gap-2">
              <Input
                id="topup-email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder={t("billing.topup.emailPlaceholder")}
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

          {/* ── Found User Card ── */}
          {foundUser && (
            <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3">
              <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                <AvatarImage src={foundUser.picture ?? undefined} alt={foundUser.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {foundUser.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{foundUser.name}</p>
                <p className="truncate text-xs text-muted-foreground">{foundUser.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-primary">
                  {foundUser.creditsBalance.toLocaleString()}
                </p>
                <p className="text-[10px] text-muted-foreground">credits</p>
              </div>
            </div>
          )}

          {/* ── Amount ── */}
          <div className="space-y-1.5">
            <Label htmlFor="topup-amount" className="text-xs font-medium">
              {t("billing.topup.amountLabel")}
            </Label>
            <Input
              id="topup-amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={t("billing.topup.amountPlaceholder")}
              className="rounded-xl"
              disabled={!foundUser}
            />
          </div>

          {/* ── Reason ── */}
          <div className="space-y-1.5">
            <Label htmlFor="topup-reason" className="text-xs font-medium">
              {t("billing.topup.reasonLabel")}
            </Label>
            <Textarea
              id="topup-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("billing.topup.reasonPlaceholder")}
              className="rounded-xl min-h-[80px] resize-none"
              disabled={!foundUser}
            />
            <p className="text-[10px] text-muted-foreground">
              {t("billing.topup.reasonHint")}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="rounded-xl"
          >
            {t("billing.topup.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !foundUser || !amount || reason.trim().length < 10}
            className="rounded-xl bg-brand-gradient text-primary-foreground hover:opacity-90"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("billing.topup.submitting")}
              </>
            ) : (
              t("billing.topup.submit")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
