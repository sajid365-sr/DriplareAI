"use client";

import { motion } from "framer-motion";
import { Copy, Check, Gift, Users, MessageSquare, Mail, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReferralData } from "./types";

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface ReferTabProps {
  data: ReferralData | null;
  loading: boolean;
  copied: boolean;
  copyLink: () => void;
  referralLink: string;
}

export function ReferTab({ data, loading, copied, copyLink, referralLink }: ReferTabProps) {
  const progressPct = Math.min(100, ((data?.totalReferrals ?? 0) / 5) * 100);

  return (
    <div className="p-5 space-y-6">
      {/* Hero Card */}
      <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-primary via-violet-700 to-fuchsia-600 p-6 text-white shadow-md">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }}
        />
        <div className="relative z-10">
          <Gift className="w-8 h-8 mb-3 opacity-90" />
          <h2 className="text-2xl font-bold">Refer your friends</h2>
          <p className="text-sm text-white/80 mt-1">Earn +500 free AI messages per referral</p>
          {/* Progress */}
          <div className="mt-5">
            <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 1 }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium text-white/80 mt-2">
              <span>0 referrals</span>
              <span>{data?.totalReferrals ?? 0} / 5 this month</span>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-muted/30 rounded-xl p-5 border border-border">
        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-4">How it works</p>
        <div className="space-y-4">
          {[
            { icon: ExternalLink, text: "Share your referral link with friends" },
            { icon: Users, text: "They sign up using your link" },
            { icon: MessageSquare, text: "You earn +500 free AI messages on their first subscription" },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <step.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground/80">{step.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Link */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Your Invite Link</p>
        {loading ? (
          <div className="h-11 bg-muted rounded-xl animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted px-4 py-2.5 rounded-xl text-sm font-mono truncate text-muted-foreground border border-border">
              {referralLink || "Generating..."}
            </div>
            <Button size="sm" variant="outline" className="rounded-xl h-11 px-4 shrink-0 gap-2 font-medium" onClick={copyLink}>
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        )}

        {/* Share Buttons */}
        <div className="flex gap-2.5 mt-4">
          {[
            { key: "twitter", label: "X", icon: <span className="font-bold text-sm">X</span> },
            { key: "linkedin", label: "in", icon: <span className="font-bold text-sm">in</span> },
            { key: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
            { key: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon /> },
          ].map(({ key, label, icon }) => {
            const text = `Join me on REMOVED AI and build powerful AI chatbots! Use my link: ${referralLink}`;
            const encodedText = encodeURIComponent(text);
            const encodedUrl = encodeURIComponent(referralLink);
            
            let href = "";
            if (key === "twitter") href = `https://twitter.com/intent/tweet?text=${encodedText}`;
            if (key === "whatsapp") href = `https://wa.me/?text=${encodedText}`;
            if (key === "linkedin") href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
            
            if (key === "email") {
              const isMobile = typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              if (isMobile) {
                href = `mailto:?subject=${encodeURIComponent("Join REMOVED AI")}&body=${encodedText}`;
              } else {
                href = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent("Join REMOVED AI")}&body=${encodedText}`;
              }
            }

            return (
              <a
                key={key}
                href={href}
                target={key === "email" ? (typeof window !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "_self" : "_blank") : "_blank"}
                rel="noopener noreferrer"
                title={label}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-border bg-muted/50 hover:bg-muted hover:border-primary/30 text-muted-foreground hover:text-foreground transition-all text-xs font-semibold shadow-sm"
              >
                {icon}
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
