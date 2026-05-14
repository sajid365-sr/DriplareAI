"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Globe, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FacebookIcon, WhatsAppIcon, InstagramIcon, TelegramIcon, SlackIcon, MessengerIcon } from "@/components/icons/PlatformIcons";
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
}

export function ChatbotRow({ bot, index, toggleStatus, onDelete }: ChatbotRowProps) {
  const { t } = useTranslation("chatbots");
  const router = useRouter();
  const confirm = useConfirm((state) => state.confirm);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    confirm(
      t("messages.deleteConfirmTitle", "Delete Chatbot"),
      t("messages.deleteConfirmMessage", { name: bot.name || 'this chatbot' }),
      () => onDelete(bot.chatbotId)
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <div 
        onClick={() => router.push(`/dashboard/chatbots/${bot.chatbotId}/chat`)} 
        className="grid grid-cols-12 px-6 py-4 items-center hover:bg-muted/50 border-b border-border last:border-b-0 cursor-pointer group" 
        data-testid={`bot-row-${bot.chatbotId}`}
      >
        <div className="col-span-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-white flex items-center justify-center font-semibold overflow-hidden shrink-0">
            {bot.avatarBase64 ? (
              <img src={bot.avatarBase64} alt={bot.name} className="w-full h-full object-cover" />
            ) : (
              bot.name?.[0]?.toUpperCase()
            )}
          </div>
          <div>
            <div className="font-medium">{bot.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="w-3 h-3" /> {bot._count?.sources || 0} {t("table.sources", "sources")}
            </div>
          </div>
        </div>
        
        <div className="col-span-3 text-sm text-muted-foreground">
          {new Date(bot.updatedAt || bot.createdAt).toLocaleString()}
        </div>
        
        <div className="col-span-2 flex items-center gap-1.5">
          {bot.integrations && bot.integrations.length > 0 ? (
            <div className="flex -space-x-1 overflow-hidden">
              {bot.integrations.map((int: any) => {
                const platform = PLATFORM_ICONS[int.platform];
                const Icon = platform?.icon || Globe;
                return (
                  <div 
                    key={int.platform} 
                    className="w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: platform?.color || "#94a3b8" }}
                    title={int.platform}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">—</span>
          )}
        </div>
        
        <div className="col-span-1" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none cursor-pointer transition-transform hover:scale-105 active:scale-95">
              {bot.status === "paused" ? (
                <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/10 border-0">
                  {t("status.paused", "Paused")} <span className="ml-1 text-[10px] opacity-60">▼</span>
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-0">
                  {t("status.active", "Active")} <span className="ml-1 text-[10px] opacity-60">▼</span>
                </Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem 
                onClick={(e) => toggleStatus(bot.chatbotId, bot.status, e as any)}
                className={bot.status === 'paused' ? 'text-emerald-600 focus:text-emerald-700 font-medium' : 'text-amber-600 focus:text-amber-700 font-medium'}
              >
                {bot.status === "paused" ? t("status.setAsActive", "Set as Active") : t("status.setAsPaused", "Set as Paused")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="col-span-2 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-8 w-8 p-0" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <span className="sr-only">Open menu</span>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-4 w-4">
                <path d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
              </svg>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/dashboard/chatbots/${bot.chatbotId}/settings`); }}>
                <Pencil className="w-3 h-3 mr-2" />
                {t("actions.edit", "Edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDelete}>
                <Trash2 className="w-3 h-3 mr-2" />
                {t("actions.delete", "Delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  );
}
