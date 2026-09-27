"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  Users,
  ShoppingBag,
  MessageSquareOff,
  AlertCircle,
  CheckCircle2,
  Archive,
  Circle,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/icons/PlatformIcons";

import { toast } from "sonner";

interface LiveInboxHeaderProps {
  activeChannel: string;
  onChannelChange: (channel: string) => void;
  activeStatusTab?: string;
  onStatusTabChange?: (tab: string) => void;
  statusCounts?: {
    allContacts: number;
    orderRequests: number;
    unreplied: number;
    tickets: number;
    resolved: number;
    archived: number;
  };
  /** Mobile current view — used to show back button */
  mobileView?: "list" | "chat" | "crm";
  onMobileBack?: () => void;
}

export function LiveInboxHeader({
  activeChannel,
  onChannelChange,
  activeStatusTab = "allContacts",
  onStatusTabChange,
  statusCounts,
  mobileView,
  onMobileBack,
}: LiveInboxHeaderProps) {
  const { t } = useTranslation("live-inbox");
  const [agentStatus, setAgentStatus] = useState<"available" | "away" | "busy" | "offline">("available");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showChannelMenu, setShowChannelMenu] = useState(false);
  const [showMobileTabs, setShowMobileTabs] = useState(false);

  const STATUS_TABS = [
    { key: "allContacts",   label: t("statusTabs.allContacts"),   count: statusCounts?.allContacts   ?? 0, icon: Users },
    { key: "orderRequests", label: t("statusTabs.orderRequests"), count: statusCounts?.orderRequests ?? 0, icon: ShoppingBag },
    { key: "unreplied",     label: t("statusTabs.unreplied"),     count: statusCounts?.unreplied     ?? 0, icon: MessageSquareOff },
    { key: "tickets",       label: t("statusTabs.tickets"),       count: statusCounts?.tickets       ?? 0, icon: AlertCircle },
    { key: "resolved",      label: t("statusTabs.resolved"),      count: statusCounts?.resolved      ?? 0, icon: CheckCircle2 },
    { key: "archived",      label: t("statusTabs.archived"),      count: statusCounts?.archived      ?? 0, icon: Archive },
  ];

  const CHANNELS = [
    { key: "All",       label: t("channels.all"),       icon: Filter },
    { key: "facebook",  label: t("channels.facebook"),  icon: FacebookIcon },
    { key: "instagram", label: t("channels.instagram"), icon: InstagramIcon },
    { key: "whatsapp",  label: t("channels.whatsapp"),  icon: WhatsAppIcon },
  ];

  const AGENT_STATUSES = [
    { key: "available", label: "Available" },
    { key: "away",      label: "Away"      },
    { key: "busy",      label: "Busy"      },
    { key: "offline",   label: "Offline"   },
  ] as const;

  const currentStatusObj = AGENT_STATUSES.find((s) => s.key === agentStatus)!;
  const currentChannelObj = CHANNELS.find((c) => c.key.toLowerCase() === activeChannel.toLowerCase()) || CHANNELS[0];
  const ChannelIcon = currentChannelObj.icon;
  const activeTabObj = STATUS_TABS.find((t) => t.key === activeStatusTab) || STATUS_TABS[0];
  const ActiveTabIcon = activeTabObj.icon;

  // Only show back button on mobile when not on list view
  const showBack = mobileView && mobileView !== "list";

  return (
    <div className="w-full bg-card/80 backdrop-blur-md border-b border-border/50 shrink-0 relative z-30">
      {/* ──────────────────────────── MAIN ROW ──────────────────────────── */}
      <div className="px-3 py-2 flex items-center gap-2 justify-between">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile back button */}
          {showBack && (
            <button
              onClick={onMobileBack}
              className="flex items-center gap-0.5 text-primary text-[12px] font-semibold shrink-0 md:hidden"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}

          {/* ── DESKTOP: Status Tabs (hidden on mobile) ── */}
          <div className="hidden md:flex items-center gap-1">
            {STATUS_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeStatusTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => onStatusTabChange?.(tab.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/30 font-bold shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary opacity-100" : "opacity-70"}`} />
                  <span className="hidden lg:inline">{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`px-1.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── MOBILE: Active tab dropdown pill ── */}
          <div className="relative md:hidden">
            <button
              onClick={() => setShowMobileTabs((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-semibold bg-primary/10 text-primary border border-primary/30 whitespace-nowrap"
            >
              <ActiveTabIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{activeTabObj.label}</span>
              <span className="px-1.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground">
                {activeTabObj.count}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showMobileTabs && (
              <div className="absolute left-0 top-full mt-1.5 w-48 bg-card border border-border/60 rounded-xl shadow-xl p-1 z-50 space-y-0.5 animate-in fade-in-50 zoom-in-95">
                {STATUS_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeStatusTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => {
                        onStatusTabChange?.(tab.key);
                        setShowMobileTabs(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1 text-left">{tab.label}</span>
                      <span className="px-1.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vertical divider */}
          <div className="hidden md:block h-4 w-px bg-border/60 mx-1 shrink-0" />

          {/* Channel Selector Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowChannelMenu((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 hover:bg-muted border border-border/60 text-[11.5px] font-semibold text-foreground transition-all shadow-xs whitespace-nowrap"
            >
              <ChannelIcon className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="hidden sm:inline">{currentChannelObj.label}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showChannelMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-40 bg-card border border-border/60 rounded-xl shadow-xl p-1 z-50 space-y-0.5 animate-in fade-in-50 zoom-in-95">
                {CHANNELS.map((ch) => {
                  const Icon = ch.icon;
                  const isSelected = activeChannel.toLowerCase() === ch.key.toLowerCase();
                  return (
                    <button
                      key={ch.key}
                      onClick={() => {
                        onChannelChange(ch.key);
                        setShowChannelMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary font-bold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{ch.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Notification Bell & Agent Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notifications */}
          <button className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-primary text-primary-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
              4
            </span>
          </button>

          {/* Agent Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium transition-all shadow-xs whitespace-nowrap ${
                agentStatus === "available"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : agentStatus === "away"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : agentStatus === "busy"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Circle
                className={`w-2 h-2 shrink-0 ${
                  agentStatus === "available"
                    ? "fill-emerald-500 text-emerald-500 animate-pulse"
                    : agentStatus === "away"
                    ? "fill-amber-500 text-amber-500"
                    : agentStatus === "busy"
                    ? "fill-rose-500 text-rose-500"
                    : "fill-slate-500 text-slate-500"
                }`}
              />
              <span className="capitalize hidden sm:inline">{currentStatusObj.label}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-36 bg-card border border-border/60 rounded-xl shadow-xl p-1 z-50 space-y-0.5 animate-in fade-in-50 zoom-in-95">
                {AGENT_STATUSES.map((st) => (
                  <button
                    key={st.key}
                    onClick={() => {
                      setAgentStatus(st.key);
                      setShowStatusMenu(false);
                      toast.success(`Agent status updated to ${st.label}`);
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors ${
                      agentStatus === st.key
                        ? "bg-muted font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <Circle
                      className={`w-2 h-2 shrink-0 ${
                        st.key === "available"
                          ? "fill-emerald-500 text-emerald-500"
                          : st.key === "away"
                          ? "fill-amber-500 text-amber-500"
                          : st.key === "busy"
                          ? "fill-rose-500 text-rose-500"
                          : "fill-slate-500 text-slate-500"
                      }`}
                    />
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
