"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, X, Mail, User, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (data: { name: string; email: string; role: string }) => Promise<void>;
}

export const InviteMemberModal = ({
  isOpen,
  onClose,
  onInvite,
}: InviteMemberModalProps) => {
  const { t } = useTranslation("settings");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    try {
      setLoading(true);
      await onInvite({ name, email, role });
      setName("");
      setEmail("");
      setRole("agent");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-foreground">
                  {t("team.inviteModal.title")}
                </h3>
                <p className="text-[11.5px] text-muted-foreground">
                  {t("team.inviteModal.description")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <Label className="text-[12px] font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                {t("team.inviteModal.nameLabel")}
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("team.inviteModal.namePlaceholder")}
                className="bg-muted/40"
              />
            </div>

            <div>
              <Label className="text-[12px] font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                {t("team.inviteModal.emailLabel")} *
              </Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("team.inviteModal.emailPlaceholder")}
                className="bg-muted/40"
              />
            </div>

            <div>
              <Label className="text-[12px] font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                {t("team.inviteModal.roleLabel")}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(["agent", "admin", "viewer"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-2 px-3 rounded-xl border text-[12px] font-semibold capitalize transition-all ${
                      role === r
                        ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {t(`team.roles.${r}`, r)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={loading}
              >
                {t("team.inviteModal.cancelBtn")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={loading || !email}
                className="gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t("team.inviteModal.submitBtn")}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
