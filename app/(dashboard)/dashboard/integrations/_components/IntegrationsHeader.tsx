"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plug, Bot, ChevronDown, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
    FacebookIcon,
    InstagramIcon,
    WhatsAppIcon,
} from "@/components/icons/PlatformIcons";
import type { ChatbotOption, ChannelItem } from "@/components/integrations/ConfigureChannelModal";

interface IntegrationsHeaderProps {
    chatbots: ChatbotOption[];
    selectedBotFilter: string;
    isConnectDropdownOpen: boolean;
    connectBotId: string;
    onToggleConnectDropdown: () => void;
    onCloseConnectDropdown: () => void;
    onSetConnectBotId: (id: string) => void;
    onStartChannelConnect: (platform: "facebook" | "instagram" | "whatsapp") => void;
}

/**
 * Top header section with page title, description, and the
 * "Connect New Channel" action button with its step-by-step dropdown.
 */
export function IntegrationsHeader({
    chatbots,
    selectedBotFilter,
    isConnectDropdownOpen,
    connectBotId,
    onToggleConnectDropdown,
    onCloseConnectDropdown,
    onSetConnectBotId,
    onStartChannelConnect,
}: IntegrationsHeaderProps) {
    const { t } = useTranslation("integrations");

    const handleToggle = () => {
        const next = !isConnectDropdownOpen;
        onToggleConnectDropdown();
        // Always pre-select the currently filtered bot when opening
        if (next) {
            onSetConnectBotId(selectedBotFilter);
        }
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Plug className="w-6 h-6 text-primary" />
                    {t("title", "Channel Integrations & Bot Mapping")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {t(
                        "subtitle",
                        "Connect Meta Pages, Instagram DMs, and WhatsApp numbers and map them to your designated AI Agents."
                    )}
                </p>
            </div>

            {/* Action Button Dropdown */}
            <div className="relative">
                <Button
                    onClick={handleToggle}
                    className="gap-2 bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none shadow-md cursor-pointer font-semibold"
                >
                    <Plus className="w-4 h-4" />
                    {t("connectNewChannel", "Connect New Channel")}
                    <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${isConnectDropdownOpen ? "rotate-180" : ""
                            }`}
                    />
                </Button>

                <AnimatePresence>
                    {isConnectDropdownOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-30"
                                onClick={onCloseConnectDropdown}
                            />
                            <motion.div
                                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-2 w-80 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-2 space-y-1"
                            >
                                {/* Step 1: Choose which AI Agent the channel attaches to */}
                                {!connectBotId ? (
                                    <AgentSelectionStep
                                        chatbots={chatbots}
                                        onSelect={onSetConnectBotId}
                                    />
                                ) : (
                                    /* Step 2: Choose the channel platform (fires OAuth) */
                                    <PlatformSelectionStep
                                        connectBotId={connectBotId}
                                        chatbots={chatbots}
                                        onSelect={onStartChannelConnect}
                                    />
                                )}
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// ── Sub-components for the dropdown steps ──────────────────────────────────────

interface AgentSelectionStepProps {
    chatbots: ChatbotOption[];
    onSelect: (chatbotId: string) => void;
}

/** Step 1 — Agent picker inside the Connect New Channel dropdown. */
function AgentSelectionStep({ chatbots, onSelect }: AgentSelectionStepProps) {
    const { t } = useTranslation("integrations");

    return (
        <>
            <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-b border-border/40 mb-1">
                {t("selectAgentStep", "Step 1 — Select AI Agent")}
            </div>
            {chatbots.length === 0 ? (
                <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                    {t(
                        "noAgentsForConnect",
                        "Create an AI Agent first before connecting a channel."
                    )}
                </p>
            ) : (
                chatbots.map((bot) => (
                    <button
                        key={bot.chatbotId}
                        type="button"
                        onClick={() => onSelect(bot.chatbotId)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left cursor-pointer"
                    >
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-violet-500" />
                        </div>
                        <span className="text-xs font-bold text-foreground truncate">
                            {bot.name}
                        </span>
                    </button>
                ))
            )}
        </>
    );
}

interface PlatformSelectionStepProps {
    connectBotId: string;
    chatbots: ChatbotOption[];
    onSelect: (platform: "facebook" | "instagram" | "whatsapp") => void;
}

/** Step 2 — Platform picker (Facebook / Instagram / WhatsApp). */
function PlatformSelectionStep({
    connectBotId,
    chatbots,
    onSelect,
}: PlatformSelectionStepProps) {
    const { t } = useTranslation("integrations");
    const agentName = chatbots.find((b) => b.chatbotId === connectBotId)?.name;

    const platforms = [
        {
            key: "facebook" as const,
            label: "Facebook Page",
            description: "Connect Meta Facebook Page",
            icon: FacebookIcon,
            iconBg: "bg-[#1877F2]/10",
            iconColor: "text-[#1877F2]",
        },
        {
            key: "instagram" as const,
            label: "Instagram DM",
            description: "Link Instagram Business Account",
            icon: InstagramIcon,
            iconBg: "bg-[#E1306C]/10",
            iconColor: "text-[#E1306C]",
        },
        {
            key: "whatsapp" as const,
            label: "WhatsApp Business API",
            description: "Connect Official WABA Phone Number",
            icon: WhatsAppIcon,
            iconBg: "bg-[#25D366]/10",
            iconColor: "text-[#25D366]",
        },
    ];

    return (
        <>
            <div className="px-2 py-1.5 border-b border-border/40 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 truncate">
                    {t("selectPlatform", "Select Platform")}
                    {" · "}
                    {agentName}
                </span>
            </div>

            {platforms.map((p) => (
                <button
                    key={p.key}
                    type="button"
                    onClick={() => onSelect(p.key)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${p.iconBg} flex items-center justify-center`}>
                            <p.icon className={`w-4 h-4 ${p.iconColor}`} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-foreground">{p.label}</h4>
                            <p className="text-[11px] text-muted-foreground">{p.description}</p>
                        </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </button>
            ))}
        </>
    );
}
