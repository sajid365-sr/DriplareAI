"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, CheckCircle2, Sparkles, User, Mail, Phone } from "lucide-react";

/**
 * Contact Form Modal — DRIPLARE AI
 * ─────────────────────────────────────────────────────────────────────────────
 * প্ল্যাটফর্মে **একটিই** contact form, দুই entry point-এর জন্য:
 *  - Landing page → "Book a Live Demo" (`source: "demo"`)
 *  - Pricing page → Enterprise tier → "Contact us" (নেগোসিয়েটেড plan, ১৫.৫)
 *
 * আগে এটি কেবল demo-র জন্য বাঁধা ছিল, আর pricing page-এর Enterprise CTA
 * checkout-এ পাঠাত (একটি dead end — ওই tier-এর প্রকাশিত দামই নেই)। আলাদা একটি
 * second form না বানিয়ে এটিকেই সাধারণ করা হলো: দুটি form থাকলে একটির bug
 * অন্যটিতে লাগত না, আর `/api/contact`-এর validation দুই জায়গায় মিলিয়ে রাখতে হত।
 *
 * ⚠️ ফাইলের নাম ঐতিহাসিক (`BookDemoModal`) — ডেমোই এর প্রথম এবং প্রধান ব্যবহার।
 *
 * ⚠️ `keyRoot` পুরো path: `home.json`-এ ব্লকটি top-level (`bookModal`), কিন্তু
 *    `pricing.json`-এ সব key `pricing` wrapper-এর ভেতরে (`pricing.contactModal`)।
 *    তাই এখানে শুধু prefix নয়, wrapper-সহ path-টাই নেওয়া হয় — নইলে প্রতি
 *    caller-কে ভিন্ন আকারের নাম দিতে হত আর component-এ দুটি নিয়ম থাকত।
 */
interface BookDemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `/api/contact`-এ যাবে — admin panel-এ দেখা যায় কোন পথ থেকে এল। */
  source?: string;
  /** copy কোন namespace-এ আছে। */
  namespace?: string;
  /** ওই namespace-এর ভেতরে copy-ব্লকের path (trailing dot ছাড়া)। */
  keyRoot?: string;
  /**
   * admin-এর কাছে যাওয়া message-এর প্রথম লাইন।
   *
   * ⚠️ ইংরেজিতেই থাকে — এটি গ্রাহকের UI নয়, admin-এর inbox (কোডবেসের প্রচলিত
   *    নিয়ম: notification/message ইংরেজিতে)।
   */
  messageIntro?: string;
}

export default function BookDemoModal({
  open,
  onOpenChange,
  source = "demo",
  namespace = "home",
  keyRoot = "bookModal",
  messageIntro = "Demo booking request.",
}: BookDemoModalProps) {
  const { t } = useTranslation(namespace);
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
        messageIntro,
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
          source,
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
            {t(`${keyRoot}.title`)}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t(`${keyRoot}.subtitle`)}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3" data-testid="contact-form-success">
            {/* হার্ডকোড `emerald` নয় — `globals.css`-এর `--success` (Dark-এও আলাদা মান) */}
            <div className="w-14 h-14 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-lg">{t(`${keyRoot}.success`)}</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t(`${keyRoot}.successDesc`)}
            </p>
            <Button onClick={handleClose} className="mt-4 rounded-full w-full">
              {t(`${keyRoot}.close`, "Close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" /> {t(`${keyRoot}.name`)}
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
                <Mail className="w-3.5 h-3.5 text-muted-foreground" /> {t(`${keyRoot}.email`)}
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
                <Phone className="w-3.5 h-3.5 text-muted-foreground" /> {t(`${keyRoot}.phone`)}
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
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {t(`${keyRoot}.date`)}
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
              data-testid="contact-form-submit"
              className="w-full rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm h-11 mt-2"
            >
              {submitting ? t(`${keyRoot}.submitting`) : t(`${keyRoot}.submit`)}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
