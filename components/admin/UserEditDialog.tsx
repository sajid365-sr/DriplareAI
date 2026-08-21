"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLAN_KEYS, USER_ROLES } from "@/lib/domain/admin-schemas";

export type AdminUserRow = {
  userId: string;
  email: string;
  name: string;
  picture?: string | null;
  plan: string;
  role: string;
  region: string;
  creditsBalance: number;
  includedCredits: number;
  _count: { chatbots: number; workspaces: number };
};

type UserEditDialogProps = {
  user: AdminUserRow | null;
  open: boolean;
  canManageRoles: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function UserEditDialog({
  user,
  open,
  canManageRoles,
  onOpenChange,
  onSaved,
}: UserEditDialogProps) {
  const { t } = useTranslation("admin");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    plan: "starter",
    role: "user",
    region: "bd",
    creditsBalance: 0,
    includedCredits: 0,
  });

  useEffect(() => {
    if (user) {
      setForm({
        plan: user.plan,
        role: user.role,
        region: user.region,
        creditsBalance: user.creditsBalance,
        includedCredits: user.includedCredits,
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Update failed");
      }
      toast.success(t("users.saved"));
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("users.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle>{user.name}</DialogTitle>
              <DialogDescription>{user.email}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>{t("users.fields.plan")}</Label>
                <Select value={form.plan} onValueChange={(v) => setForm((f) => ({ ...f, plan: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_KEYS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canManageRoles && (
                <div className="grid gap-2">
                  <Label>{t("users.fields.role")}</Label>
                  <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2">
                <Label>{t("users.fields.region")}</Label>
                <Select value={form.region} onValueChange={(v) => setForm((f) => ({ ...f, region: v }))}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bd">BD</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>{t("users.fields.creditsBalance")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.creditsBalance}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, creditsBalance: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="rounded-xl"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("users.fields.includedCredits")}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.includedCredits}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, includedCredits: parseInt(e.target.value, 10) || 0 }))
                    }
                    className="rounded-xl"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t("users.meta", {
                  chatbots: user._count.chatbots,
                  workspaces: user._count.workspaces,
                })}
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
                {t("users.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="rounded-full bg-brand-gradient">
                {saving ? t("users.saving") : t("users.save")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
