"use client";
import { MessageCircle, RefreshCcw, AlertCircle, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SessionListProps {
  sessions: any[];
  filteredSessions: any[];
  loadingSessions: boolean;
  selectedSession: string | null;
  onSelectSession: (id: string) => void;
  onRefresh: () => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  integrationStatus: any;
  formatDate: (date: string) => string;
  getPlatformIcon: (platform: string) => React.ReactNode;
  platforms?: string[];
  searchQuery: string;
  onSearchChange: (search: string) => void;
  selectedSessionIds: string[];
  onToggleSelectSession: (id: string) => void;
  onSelectAllSessions: (checked: boolean) => void;
  onDeleteSelectedSessions: () => void;
  onToggleSessionStatus: (id: string, current: boolean) => void;
}

const getPlatformBgColor = (platform: string) => {
  const normPlatform = platform?.toLowerCase();
  switch (normPlatform) {
    case "facebook":
      return "bg-[#1877F2]";
    case "whatsapp":
      return "bg-[#25D366]";
    case "instagram":
      return "bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]";
    case "telegram":
      return "bg-[#24A1DE]";
    case "slack":
      return "bg-[#4A154B]";
    case "messenger":
      return "bg-gradient-to-tr from-[#0084FF] to-[#A033FF]";
    case "tiktok":
      return "bg-[#010101]";
    default:
      return "bg-primary";
  }
};

export const SessionList = ({
  filteredSessions,
  loadingSessions,
  selectedSession,
  onSelectSession,
  onRefresh,
  filter,
  onFilterChange,
  integrationStatus,
  formatDate,
  getPlatformIcon,
  platforms = [],
  searchQuery,
  onSearchChange,
  selectedSessionIds,
  onToggleSelectSession,
  onSelectAllSessions,
  onDeleteSelectedSessions,
  onToggleSessionStatus,
}: SessionListProps) => {
  return (
    <div className="w-1/3 bg-card border border-border rounded-xl flex flex-col overflow-hidden shrink-0 shadow-sm">
      <div className="p-4 border-b border-border flex flex-col gap-3 bg-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Chat Logs</h2>
          <button 
            onClick={onRefresh}
            disabled={loadingSessions}
            className="p-1.5 hover:bg-muted rounded-md transition-colors disabled:opacity-50"
            title="Refresh sessions"
          >
            <RefreshCcw className={`w-4 h-4 ${loadingSessions ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {integrationStatus?.status === "error" && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-bold text-destructive leading-none uppercase tracking-wider">Connection Error</p>
              <p className="text-[12px] text-destructive/90 leading-tight">
                {integrationStatus.lastError || "Token expired. Please reconnect."}
              </p>
            </div>
          </div>
        )}

        <select 
          value={filter} 
          onChange={(e) => onFilterChange(e.target.value)}
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/50 capitalize"
        >
          <option value="All">All Platforms</option>
          {platforms.map((plt) => (
            <option key={plt} value={plt}>
              {plt === "web" ? "Web" : plt.charAt(0).toUpperCase() + plt.slice(1)}
            </option>
          ))}
        </select>

        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {filteredSessions.length > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-border mt-1">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer text-muted-foreground select-none">
              <input
                type="checkbox"
                checked={filteredSessions.length > 0 && filteredSessions.every(s => selectedSessionIds.includes(s.sessionId))}
                onChange={(e) => onSelectAllSessions(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
              />
              Select All ({filteredSessions.length})
            </label>
            
            {selectedSessionIds.length > 0 && (
              <button
                onClick={onDeleteSelectedSessions}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedSessionIds.length})
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loadingSessions ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading sessions...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
            <MessageCircle className="w-10 h-10 opacity-20" />
            <p className="text-sm">No chat logs found.</p>
            {!integrationStatus?.connected && (
              <p className="text-[11px] leading-relaxed">
                Facebook logs are hidden because the page is disconnected. 
                Reconnect to view them.
              </p>
            )}
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div 
              key={session.sessionId}
              onClick={() => onSelectSession(session.sessionId)}
              className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${selectedSession === session.sessionId ? 'bg-muted border-l-4 border-l-primary pl-3' : 'border-l-4 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-3">
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="flex items-center shrink-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSessionIds.includes(session.sessionId)}
                      onChange={() => onToggleSelectSession(session.sessionId)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
                    />
                  </div>
                  
                  <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shadow-sm shrink-0">
                    {session.profilePhoto ? (
                      <img src={session.profilePhoto} alt={session.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center text-white font-bold text-base ${getPlatformBgColor(session.platform)}`}>
                        {session.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-medium leading-none mb-1.5">{session.title}</h3>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {session.timestamp ? formatDate(session.timestamp) : 'Unknown'}
                    </div>
                  </div>
                </div>
                <div>
                  {getPlatformIcon(session.platform)}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pl-[52px] pr-2" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none cursor-pointer transition-transform hover:scale-105 active:scale-95">
                    {session.isActive ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10 border-0 flex items-center gap-1">
                        Active (AI) <span className="text-[10px] opacity-60">▼</span>
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/10 border-0 flex items-center gap-1">
                        Inactive (Manual) <span className="text-[10px] opacity-60">▼</span>
                      </Badge>
                    )}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSessionStatus(session.sessionId, session.isActive);
                      }}
                      className={session.isActive ? 'text-rose-600 focus:text-rose-700 font-medium' : 'text-emerald-600 focus:text-emerald-700 font-medium'}
                    >
                      {session.isActive ? "Set as Inactive (Manual)" : "Set as Active (AI)"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
