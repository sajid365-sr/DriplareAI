"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatbotOption } from "@/components/integrations/ConfigureChannelModal";

interface BotFilterDropdownProps {
    chatbots: ChatbotOption[];
    selectedBotFilter: string;
    isBotFilterOpen: boolean;
    selectedBotName: string;
    onToggle: () => void;
    onSelect: (chatbotId: string) => void;
    onClose: () => void;
}

/**
 * Dropdown filter that lets the user pick which AI Agent's channels to display.
 * Positioned in the toolbar row above the channel cards grid.
 */
export function BotFilterDropdown({
    chatbots,
    selectedBotFilter,
    isBotFilterOpen,
    selectedBotName,
    onToggle,
    onSelect,
    onClose,
}: BotFilterDropdownProps) {
    const { t } = useTranslation("integrations");

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggle}
                className="flex items-center gap-2.5 bg-card hover:bg-muted/40 border border-border/80 rounded-xl px-3.5 py-2.5 shadow-xs transition-all cursor-pointer"
            >
                <Bot className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs text-muted-foreground font-medium shrink-0">
                    {t("filterByBot", "Filter by Bot")}:
                </span>
                <span className="text-xs font-bold text-foreground max-w-[160px] truncate">
                    {selectedBotName}
                </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isBotFilterOpen ? "rotate-180 text-primary" : ""
                        }`}
                />
            </button>

            <AnimatePresence>
                {isBotFilterOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-30"
                            onClick={onClose}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-1.5 w-64 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-1.5 space-y-0.5"
                        >
                            <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 border-b border-border/40 mb-1">
                                Select Active Agent
                            </div>
                            {chatbots.map((bot) => {
                                const isSelected = bot.chatbotId === selectedBotFilter;
                                return (
                                    <button
                                        key={bot.chatbotId}
                                        type="button"
                                        onClick={() => {
                                            onSelect(bot.chatbotId);
                                            onClose();
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${isSelected
                                                ? "bg-primary/10 text-primary font-bold"
                                                : "text-foreground hover:bg-muted/60"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Bot
                                                className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"
                                                    }`}
                                            />
                                            <span className="truncate">{bot.name}</span>
                                        </div>
                                        {isSelected && (
                                            <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                                        )}
                                    </button>
                                );
                            })}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
