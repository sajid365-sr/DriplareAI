"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Globe,
  Settings,
  Trash2,
  Zap,
  BarChart2,
  Copy,
  MoreHorizontal,
  Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FacebookIcon,
  WhatsAppIcon,
  InstagramIcon,
  TelegramIcon,
  SlackIcon,
  MessengerIcon,
} from "@/components/icons/PlatformIcons";
import { useConfirm } from "@/hooks/use-confirm";

const PLATFORM_ICONS: Record<string, { icon: any; color: string; label: string }> = {
  facebook: { icon: FacebookIcon, color: "#1877F2", label: "Facebook" },
  n8n_facebook: { icon: MessengerIcon, color: "#1877F2", label: "Facebook Messenger" },
  whatsapp: { icon: WhatsAppIcon, color: "#25D366", label: "WhatsApp" },
  instagram: { icon: InstagramIcon, color: "#E4405F", label: "Instagram" },
  telegram: { icon: TelegramIcon, color: "#229ED9", label: "Telegram" },
  slack: { icon: SlackIcon, color: "#4A154B", label: "Slack" },
  messenger: { icon: MessengerIcon, color: "#00B2FF", label: "Messenger" },
};

interface ChatbotRowProps {
  bot: any;
  index: number;
  toggleStatus: (id: string, currentStatus: string, e: React.MouseEvent) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function ChatbotRow({
  bot,
  index,
  toggleStatus,
  onDelete,
  onDuplicate,
}: ChatbotRowProps) {
  const { t } = useTranslation("chatbots");
  const router = useRouter();
  const confirm = useConfirm((state) => state.confirm);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    confirm(
      t("messages.deleteConfirmTitle", "Delete Chatbot"),
      t("messages.deleteConfirmMessage", { name: bot.name || "this chatbot" }),
      () => onDelete(bot.chatbotId)
    );
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDuplicate(bot.chatbotId);
  };

  const navigate = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(path);
  };

  const hasIntegrations = bot.integrations && bot.integrations.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div
        onClick={() => router.push(`/dashboard/chatbots/${bot.chatbotId}/chat`)}
        className="grid grid-cols-12 px-6 py-4 items-center hover:bg-muted/50 border-b border-border last:border-b-0 cursor-pointer group"
        data-testid={`bot-row-${bot.chatbotId}`}
      >
        {/* Bot Name + Avatar */}
        <div className="col-span-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center font-semibold overflow-hidden shrink-0">
            {bot.avatarBase64 ? (
              <img
                src={bot.avatarBase64}
                alt={bot.name}
                className="w-full h-full object-cover"
              />
            ) : (
              bot.name?.[0]?.toUpperCase()
            )}
          </div>
          <div>
            <div className="font-medium">{bot.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="w-3 h-3" />
              {bot._count?.sources || 0} {t("table.sources", "sources")}
            </div>
          </div>
        </div>

        {/* Last Modified */}
        <div className="col-span-3 text-sm text-muted-foreground">
          {new Date(bot.updatedAt || bot.createdAt).toLocaleString()}
        </div>

        {/* Connected Channels */}
        <div className="col-span-2 flex items-center gap-1.5">
          {hasIntegrations ? (
            <div className="flex -space-x-1 overflow-hidden">
              {bot.integrations.map((int: any) => {
                const platform = PLATFORM_ICONS[int.platform];
                const Icon = platform?.icon || Globe;
                return (
                  <div
                    key={int.platform}
                    className="w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: platform?.color || "#94a3b8" }}
                    title={platform?.label || int.platform}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                );
              })}
            </div>
          ) : (
            /* Fallback: subtle "+ Connect" badge */
            <button
              onClick={(e) =>
                navigate(`/dashboard/platforms`, e)
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors"
              title={t("actions.connectChannel", "+ Connect")}
            >
              <Link2 className="w-3 h-3" />
              {t("actions.connectChannel", "+ Connect")}
            </button>
          )}
        </div>

        {/* Status Toggle Dropdown */}
        <div
          className="col-span-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none cursor-pointer transition-transform hover:scale-105 active:scale-95">
              {bot.status === "paused" ? (
                <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 border-0">
                  {t("status.paused", "Paused")}{" "}
                  <span className="ml-1 text-[10px] opacity-60">▼</span>
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-0">
                  {t("status.active", "Active")}{" "}
                  <span className="ml-1 text-[10px] opacity-60">▼</span>
                </Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                onClick={(e) => toggleStatus(bot.chatbotId, bot.status, e as any)}
                className={
                  bot.status === "paused"
                    ? "text-emerald-600 focus:text-emerald-700 font-medium"
                    : "text-amber-600 focus:text-amber-700 font-medium"
                }
              >
                {bot.status === "paused"
                  ? t("status.setAsActive", "Set as Active")
                  : t("status.setAsPaused", "Set as Paused")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Dropdown (⋯) */}
        <div className="col-span-2 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-48">
              {/* Bot Settings */}
              <DropdownMenuItem
                onClick={(e) =>
                  navigate(`/dashboard/chatbots/${bot.chatbotId}/settings`, e)
                }
              >
                <Settings className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                {t("actions.botSettings", "Bot Settings")}
              </DropdownMenuItem>

              {/* Open Playground */}
              <DropdownMenuItem
                onClick={(e) =>
                  navigate(`/dashboard/chatbots/${bot.chatbotId}/chat`, e)
                }
              >
                <Zap className="w-3.5 h-3.5 mr-2 text-violet-500" />
                {t("actions.openPlayground", "Open Playground")}
              </DropdownMenuItem>

              {/* Analytics */}
              <DropdownMenuItem
                onClick={(e) =>
                  navigate(`/dashboard/chatbots/${bot.chatbotId}/analytics`, e)
                }
              >
                <BarChart2 className="w-3.5 h-3.5 mr-2 text-sky-500" />
                {t("actions.analytics", "Analytics")}
              </DropdownMenuItem>

              {/* Duplicate Bot */}
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                {t("actions.duplicateBot", "Duplicate Bot")}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Delete — Destructive */}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                onClick={handleDelete}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                {t("actions.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}
