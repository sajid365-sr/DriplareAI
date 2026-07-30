"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plug, Bot, CheckCircle2, AlertCircle, RefreshCcw, ExternalLink, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  FacebookIcon,
  WhatsAppIcon,
  InstagramIcon,
  MessengerIcon,
} from "@/components/icons/PlatformIcons";

export default function GlobalIntegrationsPage() {
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState([
    {
      id: "int-1",
      platform: "Facebook Page",
      accountName: "Driplare E-Commerce",
      connected: true,
      botId: "bot-1",
      botName: "Driplare Inbox",
      icon: FacebookIcon,
      color: "text-[#1877F2]",
    },
    {
      id: "int-2",
      platform: "Instagram DM",
      accountName: "@driplare.official",
      connected: true,
      botId: "bot-1",
      botName: "Driplare Inbox",
      icon: InstagramIcon,
      color: "text-[#E1306C]",
    },
    {
      id: "int-3",
      platform: "WhatsApp Business API",
      accountName: "+880 1894-927244",
      connected: true,
      botId: "bot-2",
      botName: "Sales Assistant Bot",
      icon: WhatsAppIcon,
      color: "text-[#25D366]",
    },
    {
      id: "int-4",
      platform: "Website Live Widget",
      accountName: "Embedded on driplare.ai",
      connected: false,
      botId: "bot-1",
      botName: "Driplare Inbox",
      icon: MessengerIcon,
      color: "text-[#0084FF]",
    },
  ]);

  useEffect(() => {
    async function loadBots() {
      try {
        const res = await fetch("/api/chatbots");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setChatbots(data);
        }
      } catch {
        setChatbots([
          { id: "bot-1", name: "Driplare Inbox" },
          { id: "bot-2", name: "Sales Assistant Bot" },
        ]);
      }
    }
    loadBots();
  }, []);

  const handleReassignBot = (integrationId: string, newBotId: string) => {
    const selectedBot = chatbots.find((b) => b.id === newBotId);
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === integrationId
          ? {
              ...item,
              botId: newBotId,
              botName: selectedBot ? selectedBot.name : item.botName,
            }
          : item
      )
    );
    setOpenDropdownId(null);
    toast.success("Assigned AI Agent updated successfully!");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-8"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Plug className="w-6 h-6 text-primary" />
            Channel Integrations & Bot Mapping
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect Meta Pages, Instagram DMs, and WhatsApp numbers and map them to your designated AI Agents.
          </p>
        </div>

        <Button className="gap-2 bg-gradient-to-r from-violet-600 to-blue-500 hover:opacity-90 text-white border-none">
          <Plug className="w-4 h-4" />
          Connect New Channel
        </Button>
      </div>

      {/* Integration Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((item) => {
          const Icon = item.icon;
          const isDropdownOpen = openDropdownId === item.id;

          return (
            <div
              key={item.id}
              className="bg-card border border-border/60 rounded-xl p-5 space-y-4 shadow-xs hover:border-border transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center border border-border/40">
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground">{item.platform}</h3>
                    <p className="text-xs text-muted-foreground">{item.accountName}</p>
                  </div>
                </div>

                {item.connected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <AlertCircle className="w-3 h-3" />
                    Not Connected
                  </span>
                )}
              </div>

              {/* Bot Re-assignment Row */}
              <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-3 relative">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-400 shrink-0" />
                  <span className="text-xs text-muted-foreground font-semibold">Assigned Agent:</span>
                </div>

                {/* Custom Premium Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setOpenDropdownId(isDropdownOpen ? null : item.id)}
                    className="flex items-center gap-2 bg-muted/60 hover:bg-muted border border-border/60 rounded-lg px-2.5 py-1 text-xs font-bold text-foreground transition-all cursor-pointer"
                  >
                    <span>{item.botName}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isDropdownOpen ? "rotate-180 text-primary" : ""}`} />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-30"
                          onClick={() => setOpenDropdownId(null)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.98 }}
                          className="absolute right-0 top-full mt-1 w-52 bg-card border border-border/80 rounded-xl shadow-xl z-40 p-1 space-y-0.5 overflow-hidden"
                        >
                          {chatbots.map((bot) => {
                            const isSelected = bot.id === item.botId;
                            return (
                              <button
                                key={bot.id}
                                onClick={() => handleReassignBot(item.id, bot.id)}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  isSelected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted/60 text-foreground"
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <Bot className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                                  <span className="truncate">{bot.name}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
