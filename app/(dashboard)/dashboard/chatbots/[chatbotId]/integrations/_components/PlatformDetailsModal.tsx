"use client";

import Image from "next/image";
import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Info, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlatformIntegration } from "./PlatformCard";

type PlatformDetailsModalProps = {
  platform: PlatformIntegration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnect: (platform: PlatformIntegration) => void;
  onDisconnect: (platform: PlatformIntegration) => void;
};

function formatDate(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getTokenHealth(platform: PlatformDetailsModalProps["platform"]) {
  if (!platform?.connected || platform.status === "error" || platform.lastError) {
    return "error";
  }

  const expiresAt = platform.config?.tokenExpiresAt ? new Date(platform.config.tokenExpiresAt) : null;

  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return "active";
  }

  const daysLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysLeft <= 0) {
    return "expired";
  }

  if (daysLeft <= 7) {
    return "expiringSoon";
  }

  return "active";
}

export const PlatformDetailsModal = ({
  platform,
  open,
  onOpenChange,
  onReconnect,
  onDisconnect,
}: PlatformDetailsModalProps) => {
  const { t } = useTranslation("chatbots");
  const config = platform?.config || {};
  const health = getTokenHealth(platform);
  const connectedAt = formatDate(config.connectedAt);
  const tokenExpiresAt = formatDate(config.tokenExpiresAt);
  const isFacebook = platform?.platform === "facebook" || platform?.platform === "n8n_facebook";
  const isWhatsApp = platform?.platform === "whatsapp";
  const isInstagram = platform?.platform === "instagram";
  const needsReconnect = health === "error" || health === "expired" || health === "expiringSoon";

  const healthLabel = t(`integration_details.health.${health}`);
  const healthIcon =
    health === "active" ? CheckCircle2 : health === "expiringSoon" ? Clock3 : AlertCircle;
  const HealthIcon = healthIcon;

  const facebookRows = [
    { label: t("integration_details.connectedPage"), value: config.pageName },
    { label: t("integration_details.pageId"), value: config.pageId },
    { label: t("integration_details.pageCategory"), value: config.pageCategory },
    { label: t("integration_details.connectedAt"), value: connectedAt },
    { label: t("integration_details.reconnectBefore"), value: tokenExpiresAt },
  ];
  const whatsappRows = [
    { label: t("integration_details.connectedNumber"), value: config.displayPhoneNumber },
    { label: t("integration_details.businessName"), value: config.verifiedName || config.businessName },
    { label: t("integration_details.qualityRating"), value: config.qualityRating },
    { label: t("integration_details.connectedAt"), value: connectedAt },
  ];
  const instagramRows = [
    { label: t("integration_details.instagramAccount"), value: config.instagramUsername ? `@${config.instagramUsername}` : config.instagramName },
    { label: t("integration_details.linkedPage"), value: config.pageName },
    { label: t("integration_details.connectedAt"), value: connectedAt },
  ];
  const genericRows = [
    { label: t("integration_details.channel"), value: platform?.name },
    { label: t("integration_details.connectedAt"), value: connectedAt },
  ];
  const rows = (isFacebook ? facebookRows : isWhatsApp ? whatsappRows : isInstagram ? instagramRows : genericRows).filter((row) => row.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("integration_details.title", { platform: platform?.name || "" })}</DialogTitle>
          <DialogDescription>
            {t(
              isFacebook
                  ? "integration_details.facebookDescription"
                  : isWhatsApp
                    ? "integration_details.whatsappDescription"
                    : isInstagram
                      ? "integration_details.instagramDescription"
                    : "integration_details.description"
            )}
          </DialogDescription>
        </DialogHeader>

        {!platform ? null : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background text-sm font-semibold text-primary">
                {config.pagePictureUrl ? (
                  <Image
                    src={config.pagePictureUrl}
                    alt={config.pageName || platform.name}
                    width={48}
                    height={48}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  (config.pageName || platform.name).charAt(0)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {config.pageName || platform.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {platform.connected ? t("integration_details.connected") : t("integration_details.notConnected")}
                </p>
              </div>
              <Badge
                variant={health === "active" ? "secondary" : health === "expiringSoon" ? "outline" : "destructive"}
                className="gap-1"
              >
                <HealthIcon className="size-3" />
                {healthLabel}
              </Badge>
            </div>

            {platform.lastError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {platform.lastError}
              </div>
            ) : null}

            {rows.length > 0 ? (
              <div className="grid gap-2">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">{row.label}</span>
                    <span className="max-w-[60%] break-words text-right text-xs font-semibold text-foreground">
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                <Info className="size-4" />
                {t("integration_details.noMetadata")}
              </div>
            )}

            {isFacebook ? (
              <div className="space-y-2 rounded-xl bg-primary/10 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Info className="size-4 text-primary" />
                  {t("integration_details.whenToReconnectTitle")}
                </div>
                <p className="leading-relaxed">{t("integration_details.facebookReconnectNote")}</p>
              </div>
            ) : null}

            {isWhatsApp ? (
              <div className="space-y-2 rounded-xl bg-primary/10 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Info className="size-4 text-primary" />
                  {t("integration_details.whenToReconnectTitle")}
                </div>
                <p className="leading-relaxed">{t("integration_details.whatsappReconnectNote")}</p>
              </div>
            ) : null}

            {isInstagram ? (
              <div className="space-y-2 rounded-xl bg-primary/10 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Info className="size-4 text-primary" />
                  {t("integration_details.whenToReconnectTitle")}
                </div>
                <p className="leading-relaxed">{t("integration_details.instagramReconnectNote")}</p>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {platform?.connected ? (
            <Button variant="outline" onClick={() => onDisconnect(platform)} className="rounded-xl">
              {t("integration_details.disconnect")}
            </Button>
          ) : null}
          {platform && (isFacebook || needsReconnect) ? (
            <Button onClick={() => onReconnect(platform)} className="rounded-xl">
              {needsReconnect ? <RefreshCw className="size-4" /> : <ExternalLink className="size-4" />}
              {needsReconnect ? t("integration_details.reconnect") : t("integration_details.refreshConnection")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
