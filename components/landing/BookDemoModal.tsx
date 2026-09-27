"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, CheckCircle2, Sparkles, User, Mail, Phone } from "lucide-react";

interface BookDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BookDemoModal({ open, onOpenChange }: BookDemoModalProps) {
  const { t } = useTranslation("home");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    datetime: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const message = [
        "Demo booking request.",
        formData.datetime ? `Preferred time: ${formData.datetime}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          message,
          source: "demo",
        }),
      });

      if (!res.ok) {
        throw new Error("Submission failed");
      }

      setSubmitted(true);
      setFormData({ name: "", email: "", phone: "", datetime: "" });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] rounded-3xl border-border bg-card shadow-2xl p-6">
        <DialogHeader className="space-y-2 text-center sm:text-left">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-1">
            <Sparkles className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {t("bookModal.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("bookModal.subtitle")}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-lg">{t("bookModal.success")}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t("bookModal.successDesc")}
            </p>
            <Button onClick={handleClose} className="mt-4 rounded-full w-full">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> {t("bookModal.name")}
              </Label>
              <Input
                required
                type="text"
                placeholder="e.g. Tanvir Ahmed"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="rounded-xl border-border/80 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {t("bookModal.email")}
              </Label>
              <Input
                required
                type="email"
                placeholder="name@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="rounded-xl border-border/80 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {t("bookModal.phone")}
              </Label>
              <Input
                required
                type="tel"
                placeholder="+8801700000000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="rounded-xl border-border/80 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {t("bookModal.date")}
              </Label>
              <Input
                required
                type="datetime-local"
                value={formData.datetime}
                onChange={(e) => setFormData({ ...formData, datetime: e.target.value })}
                className="rounded-xl border-border/80 text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-primary hover:bg-primary/90 text-white font-medium text-sm h-11 mt-2"
            >
              {submitting ? t("bookModal.submitting") : t("bookModal.submit")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
