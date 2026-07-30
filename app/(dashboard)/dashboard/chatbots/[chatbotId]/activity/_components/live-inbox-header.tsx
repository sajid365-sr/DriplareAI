"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  ChevronDown,
  Users,
  ShoppingBag,
  MessageSquareOff,
  Ticket,
  CheckCircle2,
  Archive,
  Circle,
} from "lucide-react";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/icons/PlatformIcons";

interface LiveInboxHeaderProps {
  activeChannel: string;
  onChannelChange: (channel: string) => void;
  totalContactsCount: number;
}

export function LiveInboxHeader({
  activeChannel,
  onChannelChange,
  totalContactsCount,
}: LiveInboxHeaderProps) {
  const { t } = useTranslation("live-inbox");
  const [activeTab, setActiveTab] = useState("allContacts");

  const STATUS_TABS = [
    { key: "allContacts", label: t("statusTabs.allContacts"), count: totalContactsCount || 538, icon: Users },
    { key: "orderRequests", label: t("statusTabs.orderRequests"), count: 12, icon: ShoppingBag },
    { key: "unreplied", label: t("statusTabs.unreplied"), count: 20, icon: MessageSquareOff },
    { key: "tickets", label: t("statusTabs.tickets"), count: 22, icon: Ticket },
    { key: "resolved", label: t("statusTabs.resolved"), count: null, icon: CheckCircle2 },
    { key: "archived", label: t("statusTabs.archived"), count: 69, icon: Archive },
  ];

  const CHANNELS = [
    { key: "All", label: t("channels.all"), icon: null },
    { key: "facebook", label: t("channels.facebook"), icon: FacebookIcon },
    { key: "instagram", label: t("channels.instagram"), icon: InstagramIcon },
    { key: "whatsapp", label: t("channels.whatsapp"), icon: WhatsAppIcon },
  ];

  return (
    <div className="w-full bg-card/80 backdrop-blur-md border-b border-border/50 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
      {/* Left: Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                isActive
                  ? "bg-secondary text-foreground border border-border shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5 opacity-70" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
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

      {/* Right: Channel Filter & Agent Status */}
      <div className="flex items-center gap-3">
        {/* Vertical divider */}
        <div className="hidden md:block h-5 w-px bg-border/60" />

        {/* Channel Selector Pills */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40">
          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const isSelected = activeChannel === ch.key;
            return (
              <button
                key={ch.key}
                onClick={() => onChannelChange(ch.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition-all ${
                  isSelected
                    ? "bg-card text-foreground shadow-xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="w-3 h-3" />}
                <span>{ch.label}</span>
              </button>
            );
          })}
        </div>

        {/* Header Right Utilities */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Notifications */}
          <button className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
              48
            </span>
          </button>

          {/* Availability Status */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-[12px] font-medium">
            <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
            <span>Available</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>
        </div>
      </div>
    </div>
  );
}
