"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plug, Bot, ChevronDown, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import type { ComponentType } from "react";
import type { ChatbotOption } from "@/components/integrations/ConfigureChannelModal";
import { getPlatformIcon } from "./getPlatformIcon";

/**
 * A platform an admin activated in `/admin/platforms` that has no dedicated
 * connect flow of its own — Telegram, Slack, Custom API, and whatever gets
 * added later. They all connect through the same generic route.
 */
export interface ExtraPlatformOption {
    platform: string;
    name: string;
    description?: string | null;
}

interface PlatformsHeaderProps {
    chatbots: ChatbotOption[];
    selectedBotFilter: string;
    isConnectDropdownOpen: boolean;
    connectBotId: string;
    /** Generic platforms for the chosen agent, excluding the dedicated flows. */
    extraPlatforms: ExtraPlatformOption[];
    onToggleConnectDropdown: () => void;
    onCloseConnectDropdown: () => void;
    onSetConnectBotId: (id: string) => void;
    onStartChannelConnect: (platform: string) => void;
}

/**
 * Top header section with page title, description, and the
 * "Connect New Channel" action button with its step-by-step dropdown.
 */
export function PlatformsHeader({
    chatbots,
    selectedBotFilter,
    isConnectDropdownOpen,
    connectBotId,
    extraPlatforms,
    onToggleConnectDropdown,
    onCloseConnectDropdown,
    onSetConnectBotId,
    onStartChannelConnect,
}: PlatformsHeaderProps) {
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
                    className="gap-2 bg-brand-gradient hover:opacity-90 text-white border-none shadow-md cursor-pointer font-semibold"
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
                                        extraPlatforms={extraPlatforms}
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
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
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
    extraPlatforms: ExtraPlatformOption[];
    onSelect: (platform: string) => void;
}

/** Step 2 — Platform picker: the dedicated flows, then everything else. */
function PlatformSelectionStep({
    connectBotId,
    chatbots,
    extraPlatforms,
    onSelect,
}: PlatformSelectionStepProps) {
    const { t } = useTranslation("integrations");
    const agentName = chatbots.find((b) => b.chatbotId === connectBotId)?.name;

    // Icon and colour come from the shared map so these rows cannot drift from
    // the channel cards below. Only the copy is specific to this picker.
    const dedicatedPlatforms = [
        {
            key: "facebook",
            label: "Facebook Page",
            description: "Connect Meta Facebook Page",
        },
        {
            key: "instagram",
            label: "Instagram DM",
            description: "Link Instagram Business Account",
        },
        {
            key: "whatsapp",
            label: "WhatsApp Business API",
            description: "Connect Official WABA Phone Number",
        },
        {
            key: "website",
            label: t("website_widget.title", "Website Widget"),
            description: t(
                "website_widget.menuDescription",
                "Embed the chat bubble on any site"
            ),
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

            {dedicatedPlatforms.map(({ key, label, description }) => {
                const { icon, color, bg } = getPlatformIcon(key);
                return (
                    <PlatformOption
                        key={key}
                        label={label}
                        description={description}
                        icon={icon}
                        iconBg={bg}
                        iconColor={color}
                        onSelect={() => onSelect(key)}
                    />
                );
            })}

            {/* Everything an admin turned on that has no flow of its own. Listed
                after the dedicated ones so the common paths stay on top. */}
            {extraPlatforms.length > 0 && (
                <>
                    <div className="px-2 pt-3 pb-1.5 mt-1 border-t border-border/40">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                            {t("moreChannels", "More Channels")}
                        </span>
                    </div>
                    {extraPlatforms.map((p) => {
                        const { icon, color, bg } = getPlatformIcon(p.platform);
                        return (
                            <PlatformOption
                                key={p.platform}
                                label={p.name}
                                description={p.description || t("connectGeneric", "Connect this channel")}
                                icon={icon}
                                iconBg={bg}
                                iconColor={color}
                                onSelect={() => onSelect(p.platform)}
                            />
                        );
                    })}
                </>
            )}
        </>
    );
}

interface PlatformOptionProps {
    label: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    onSelect: () => void;
}

/** One row in the platform picker. */
function PlatformOption({
    label,
    description,
    icon: Icon,
    iconBg,
    iconColor,
    onSelect,
}: PlatformOptionProps) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group cursor-pointer"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                </div>
                <div className="min-w-0">
                    <h4 className="text-xs font-bold text-foreground truncate">{label}</h4>
                    <p className="text-[11px] text-muted-foreground truncate">{description}</p>
                </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
        </button>
    );
}
