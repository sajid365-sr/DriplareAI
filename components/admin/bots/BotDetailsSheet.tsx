"use client";

import { useTranslation } from "react-i18next";
import {
  Bot,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface BotIntegration {
  id: string;
  platform: string;
  connected: boolean;
  status: string;
  connectedAt: string | null;
}

export interface BotDetails {
  id: string;
  chatbotId: string;
  name: string;
  model: string;
  provider: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  status: string;
  avatarColor: string;
  avatarBase64: string | null;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
  user: {
    userId: string;
    name: string;
    email: string;
    picture: string | null;
  };
  workspace: {
    workspaceId: string;
    name: string;
  } | null;
  sourcesCount: number;
  sessionsCount: number;
  messagesCount: number;
  integrations: BotIntegration[];
}

interface BotDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: BotDetails | null;
  onToggleStatus: (botId: string, status: "active" | "disabled" | "suspended") => Promise<void>;
}

export function BotDetailsSheet({
  open,
  onOpenChange,
  bot,
  onToggleStatus,
}: BotDetailsSheetProps) {
  const { t } = useTranslation("admin");

  if (!bot) return null;

  const statusBadge = {
    active: "border-success/30 bg-success/10 text-success",
    disabled: "border-warning/30 bg-warning/10 text-warning",
    suspended: "border-destructive/30 bg-destructive/10 text-destructive",
  }[bot.status] ?? "border-border bg-muted/40 text-muted-foreground";

  // Match connected platforms
  const getPlatformStatus = (platform: string) => {
    const found = bot.integrations.find(
      (i) => i.platform.toLowerCase() === platform.toLowerCase()
    );
    if (!found) return { connected: false, label: "Not Connected" };
    return {
      connected: found.connected,
      label: found.connected ? "Connected" : "Disconnected",
    };
  };

  const fbStatus = getPlatformStatus("facebook");
  const waStatus = getPlatformStatus("whatsapp");
  const webStatus = getPlatformStatus("website");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        {/* Header */}
        <div className="border-b border-border/60 bg-muted/20 p-6">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                {bot.avatarBase64 ? (
                  <AvatarImage src={bot.avatarBase64} alt={bot.name} />
                ) : null}
                <AvatarFallback
                  className="text-white text-base font-bold"
                  style={{ backgroundColor: bot.avatarColor || "#895AF6" }}
                >
                  {bot.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-xl font-bold truncate">
                    {bot.name}
                  </SheetTitle>
                  <Badge variant="outline" className={cn("text-xs capitalize", statusBadge)}>
                    {bot.status}
                  </Badge>
                </div>
                <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                  ID: {bot.chatbotId}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Merchant & Workspace Info */}
          <div className="rounded-xl border border-primary/10 bg-card/60 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("bots.details.merchantInfo", "Merchant & Workspace")}
            </h4>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-8 w-8 ring-1 ring-primary/15">
                  <AvatarImage src={bot.user.picture ?? undefined} alt={bot.user.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {bot.user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{bot.user.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{bot.user.email}</p>
                </div>
              </div>
              {bot.workspace && (
                <Badge variant="secondary" className="text-[11px] shrink-0">
                  {bot.workspace.name}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Created: {new Date(bot.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Last Active: {new Date(bot.lastActiveAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Connected Platforms */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("bots.details.connectedPlatforms", "Connected Integrations")}
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Facebook */}
              <div className="rounded-xl border border-border/60 bg-card p-3 flex flex-col items-center justify-center text-center">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mb-1.5">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium">Facebook</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1.5 text-[9px] px-1.5 py-0",
                    fbStatus.connected
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {fbStatus.label}
                </Badge>
              </div>

              {/* WhatsApp */}
              <div className="rounded-xl border border-border/60 bg-card p-3 flex flex-col items-center justify-center text-center">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-1.5">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium">WhatsApp</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1.5 text-[9px] px-1.5 py-0",
                    waStatus.connected
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {waStatus.label}
                </Badge>
              </div>

              {/* Website */}
              <div className="rounded-xl border border-border/60 bg-card p-3 flex flex-col items-center justify-center text-center">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-1.5">
                  <Globe className="h-4 w-4" />
                </div>
                <p className="text-xs font-medium">Website</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1.5 text-[9px] px-1.5 py-0",
                    webStatus.connected
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {webStatus.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* AI Model & Stats */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("bots.details.modelConfig", "AI Configuration & Stats")}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Model & Provider</p>
                <p className="text-xs font-bold mt-1 text-foreground truncate">
                  {bot.model}
                </p>
                <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                  Provider: {bot.provider}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Parameters</p>
                <p className="text-xs font-bold mt-1 text-foreground">
                  Temp: {bot.temperature} | Max: {bot.maxTokens}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Mode: General
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Training Data</p>
                <p className="text-xs font-bold mt-1 text-foreground">
                  {bot.sourcesCount} Sources
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">Conversations</p>
                <p className="text-xs font-bold mt-1 text-foreground">
                  {bot.sessionsCount} Sessions ({bot.messagesCount} Msgs)
                </p>
              </div>
            </div>
          </div>

          {/* System Prompt Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("bots.details.systemPrompt", "System Prompt Preview")}
            </h4>
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 max-h-40 overflow-y-auto text-xs font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {bot.systemPrompt || "No system prompt configured."}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-border/60 bg-muted/20 p-4 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground font-medium">Quick Governance Actions:</p>
          <div className="flex items-center gap-2">
            {bot.status !== "active" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg border-success/30 text-success hover:bg-success/10 gap-1 text-xs"
                onClick={() => onToggleStatus(bot.id, "active")}
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Enable
              </Button>
            )}
            {bot.status !== "disabled" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg border-warning/30 text-warning hover:bg-warning/10 gap-1 text-xs"
                onClick={() => onToggleStatus(bot.id, "disabled")}
              >
                <PauseCircle className="h-3.5 w-3.5" />
                Disable
              </Button>
            )}
            {bot.status !== "suspended" && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10 gap-1 text-xs"
                onClick={() => onToggleStatus(bot.id, "suspended")}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Suspend
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
