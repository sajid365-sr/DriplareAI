"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Settings, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChannelItem } from "@/components/integrations/ConfigureChannelModal";
import { getPlatformIcon } from "./getPlatformIcon";

interface ChannelCardProps {
    item: ChannelItem;
    onConfigure: (item: ChannelItem) => void;
    onDisconnect: (item: ChannelItem) => void;
}

/**
 * A single connected channel card showing the platform icon,
 * account name, status badge, and action buttons (Configure / Disconnect).
 */
export function ChannelCard({ item, onConfigure, onDisconnect }: ChannelCardProps) {
    const { t } = useTranslation("integrations");
    const platformDetails = getPlatformIcon(item.platform);
    const Icon = platformDetails.icon;

    return (
        <motion.div
            key={item.integrationId || item.id}
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-xs hover:border-border transition-all"
        >
            {/* Header Row */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-11 h-11 rounded-xl ${platformDetails.bg} flex items-center justify-center border border-border/40`}
                    >
                        <Icon className={`w-6 h-6 ${platformDetails.color}`} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-foreground">
                            {item.accountName}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span className="capitalize">{item.platform}</span>
                            {item.accountId && (
                                <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded">
                                    {item.accountId}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Status Badge */}
                {item.connected && item.status === "active" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("active", "Active")}
                    </span>
                ) : item.status === "error" ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <AlertCircle className="w-3 h-3" />
                        {t("needsReauth", "Needs Re-auth")}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/15 text-destructive border border-destructive/30">
                        <AlertCircle className="w-3 h-3" />
                        {t("disconnected", "Disconnected")}
                    </span>
                )}
            </div>

            {/* Quick Action Controls */}
            <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => onConfigure(item)}
                        className="p-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Configure channel settings"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        <span>{t("configure", "Configure")}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onDisconnect(item)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border/60 rounded-lg transition-colors cursor-pointer"
                        title="Disconnect channel"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
