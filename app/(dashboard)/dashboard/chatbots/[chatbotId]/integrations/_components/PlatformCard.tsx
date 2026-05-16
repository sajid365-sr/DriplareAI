"use client";

import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type PlatformConfig = {
  pageId?: string;
  pageName?: string;
  pageCategory?: string;
  pagePictureUrl?: string;
  instagramAccountId?: string;
  instagramUsername?: string;
  instagramName?: string;
  instagramProfilePictureUrl?: string;
  connectionSource?: string;
  wabaId?: string;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  businessName?: string;
  qualityRating?: string;
  webhookSubscribedAt?: string;
  connectedAt?: string;
  tokenExpiresAt?: string;
};

export type PlatformIntegration = {
  platform: string;
  name: string;
  description: string;
  color: string;
  coming_soon: boolean;
  connected: boolean;
  status?: string;
  lastError?: string | null;
  config?: PlatformConfig;
};

interface PlatformCardProps {
  platform: PlatformIntegration;
  icon: ComponentType<{ className?: string }>;
  onToggle: (platform: PlatformIntegration) => void;
  onShowDetails: (platform: PlatformIntegration) => void;
}

const getPlatformHealth = (platform: PlatformIntegration) => {
  if (!platform.connected || platform.status === "error" || platform.lastError) {
    return platform.lastError || platform.status === "error" ? "error" : "disconnected";
  }

  const expiresAt = platform.config?.tokenExpiresAt ? new Date(platform.config.tokenExpiresAt) : null;

  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return "connected";
  }

  const daysLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysLeft <= 0) {
    return "expired";
  }

  if (daysLeft <= 7) {
    return "expiringSoon";
  }

  return "connected";
};

export const PlatformCard = ({ platform, icon: Icon, onToggle, onShowDetails }: PlatformCardProps) => {
  const { t } = useTranslation("chatbots");
  const health = getPlatformHealth(platform);
  const isActionNeeded = health === "error" || health === "expired";
  const isExpiringSoon = health === "expiringSoon";
  const HealthIcon = isActionNeeded ? AlertCircle : isExpiringSoon ? Clock3 : CheckCircle2;

  if (platform.coming_soon) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20 p-6 opacity-70 grayscale-[0.5]">
        <div className="flex items-center justify-between mb-4">
          <div className="rounded-xl border border-border bg-muted/50 p-3 text-muted-foreground">
            <Icon className="w-6 h-6" />
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold bg-background/50">
            {t("integration_card.soon")}
          </Badge>
        </div>
        <h3 className="text-lg font-bold text-muted-foreground">
          {t(`integration_platforms.${platform.platform}.name`, { defaultValue: platform.name })}
        </h3>
        <p className="text-sm text-muted-foreground/70 mt-2 line-clamp-2">
          {t(`integration_platforms.${platform.platform}.description`, { defaultValue: platform.description })}
        </p>
        <div className="mt-6 pt-6 border-t border-border/50">
          <Button disabled variant="outline" size="sm" className="rounded-xl px-5 opacity-50 cursor-not-allowed">
            {t("integration_card.comingSoon")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      variants={{ hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } }} 
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl" 
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <div 
            className="rounded-xl border border-border bg-muted/50 p-3 shadow-sm transition-colors group-hover:bg-background" 
            style={{ color: platform.color }}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex items-center gap-2">
            {platform.connected || isActionNeeded ? (
              <div
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold animate-in fade-in zoom-in ${
                  isActionNeeded
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : isExpiringSoon
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-primary/20 bg-primary/10 text-primary"
                }`}
              >
                <HealthIcon className="w-3.5 h-3.5" />
                {t(`integration_card.health.${health}`)}
              </div>
            ) : null}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onShowDetails(platform);
              }}
              aria-label={t("integration_card.details")}
            >
              <Info className="size-4" />
            </Button>
          </div>
        </div>

        <h3 className="text-lg font-bold group-hover:text-primary transition-colors">
          {t(`integration_platforms.${platform.platform}.name`, { defaultValue: platform.name })}
        </h3>
        {platform.config?.pageName ? (
          <p className="mt-1 truncate text-xs font-medium text-primary">
            {t("integration_card.connectedPage", { page: platform.config.pageName })}
          </p>
        ) : null}
        {platform.config?.displayPhoneNumber ? (
          <p className="mt-1 truncate text-xs font-medium text-primary">
            {t("integration_card.connectedNumber", { number: platform.config.displayPhoneNumber })}
          </p>
        ) : null}
        {platform.config?.instagramUsername ? (
          <p className="mt-1 truncate text-xs font-medium text-primary">
            {t("integration_card.connectedInstagram", { username: platform.config.instagramUsername })}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2 min-h-[40px] leading-relaxed">
          {t(`integration_platforms.${platform.platform}.description`, { defaultValue: platform.description })}
        </p>

        <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
          <Button 
            variant={platform.connected ? "outline" : "default"}
            size="sm"
            onClick={() => onToggle(platform)}
            className={`rounded-xl px-5 font-semibold shadow-sm transition-all ${!platform.connected && "bg-primary hover:bg-primary/90 shadow-primary/20"}`}
          >
            {platform.connected ? t("integration_card.disconnect") : t("integration_card.connect")}
          </Button>
          
          {!platform.connected && <ChevronRight className="w-4 h-4 ml-1 opacity-70" />}
        </div>
      </div>
    </motion.div>
  );
};
