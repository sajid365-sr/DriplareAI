"use client";
import { MessageCircle, Trash2, Download } from "lucide-react";
import { MessageBubble } from "./message-bubble";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationPanelProps {
  selectedSession: string | null;
  messages: any[];
  loadingMessages: boolean;
  activeSessionData: any;
  onDelete: (id: string) => void;
  onDownload: () => void;
  onToggleStatus: (id: string, current: boolean) => void;
  formatShortDate: (date: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ConversationPanel = ({
  selectedSession,
  messages,
  loadingMessages,
  activeSessionData,
  onDelete,
  onDownload,
  onToggleStatus,
  formatShortDate,
  messagesEndRef,
}: ConversationPanelProps) => {
  if (!selectedSession) {
    return (
      <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden relative shadow-sm">
        <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
          <MessageCircle className="w-12 h-12 opacity-20" />
          <p>Select a session to view conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-card border border-border rounded-xl flex flex-col overflow-hidden relative shadow-sm">
      <div className="p-4 border-b border-border flex justify-between items-center bg-card z-10 shrink-0">
        <div>
          <h2 className="text-base font-semibold">{activeSessionData?.title || "Conversation"}</h2>
          <div className="text-xs text-muted-foreground mt-0.5">
            Session Id: {selectedSession}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {activeSessionData && (
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none cursor-pointer transition-transform hover:scale-105 active:scale-95">
                {activeSessionData.isActive ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-0 flex items-center gap-1">
                    Active (AI) <span className="text-[10px] opacity-60">▼</span>
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/10 border-0 flex items-center gap-1">
                    Inactive (Manual) <span className="text-[10px] opacity-60">▼</span>
                  </Badge>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => onToggleStatus(selectedSession, activeSessionData.isActive)}
                  className={activeSessionData.isActive ? 'text-rose-600 focus:text-rose-700 font-medium' : 'text-emerald-600 focus:text-emerald-700 font-medium'}
                >
                  {activeSessionData.isActive ? "Set as Inactive (Manual)" : "Set as Active (AI)"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="h-4 w-px bg-border"></div>
          <div className="flex gap-2">
            <button 
              onClick={() => onDelete(selectedSession)}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              title="Delete Session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={onDownload}
              className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              title="Download Conversation"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6 bg-secondary/30">
        {loadingMessages ? (
          <div className="text-center text-muted-foreground text-sm pt-10">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm pt-10">No messages in this session.</div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble 
              key={msg.id || i}
              message={msg}
              formatShortDate={formatShortDate}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
