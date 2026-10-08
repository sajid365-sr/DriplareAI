"use client";

import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { Globe, MessageSquare, MoreHorizontal } from "lucide-react";
import { FacebookIcon, WhatsAppIcon, MessengerIcon, TelegramIcon } from "@/components/icons/PlatformIcons";
import { Badge } from "@/components/ui/badge";

interface RecentSessionsProps {
  sessions: any[];
}

export const RecentSessions = ({ sessions }: RecentSessionsProps) => {
  const { t } = useTranslation("analytics");

  // প্ল্যাটফর্মের রঙগুলো ইচ্ছাকৃতভাবে প্যালেট ক্লাসই থাকে — এগুলো আমাদের থিম
  // নয়, প্রতিষ্ঠানের নিজস্ব ব্র্যান্ড মার্ক (Facebook-নীল, WhatsApp-সবুজ,
  // Telegram-আকাশি)। টোকেনে বদলালে চেনা লোগোই চেনা যেত না।
  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "web": return <Globe className="w-4 h-4" />;
      case "facebook": return <FacebookIcon className="w-4 h-4 text-blue-600" />;
      case "n8n_facebook": return <MessengerIcon className="w-4 h-4 text-blue-500" />;
      case "whatsapp": return <WhatsAppIcon className="w-4 h-4 text-green-600" />;
      case "telegram": return <TelegramIcon className="w-4 h-4 text-sky-500" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 rounded-2xl border border-border bg-card shadow-sm h-full">
      <h3 className="font-semibold text-lg mb-6">{t("recent_sessions")}</h3>
      
      <div className="space-y-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-8">{t("no_data")}</p>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-background border border-border">
                  {getPlatformIcon(session.platform)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {session.sessionId}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              <Badge variant="outline" className={`capitalize text-[10px] ${
                session.sentiment === 'positive' ? 'text-success bg-success/10 border-success/20' :
                session.sentiment === 'negative' ? 'text-destructive bg-destructive/10 border-destructive/20' :
                'text-muted-foreground'
              }`}>
                {session.sentiment}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
