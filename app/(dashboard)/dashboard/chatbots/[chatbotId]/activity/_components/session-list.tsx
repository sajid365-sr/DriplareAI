"use client";

import { MessageCircle, RefreshCcw, AlertCircle } from "lucide-react";

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
}

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
          className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="All">All</option>
          <option value="Facebook">Facebook</option>
          <option value="Web">Web</option>
        </select>
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
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm ${session.platform === 'facebook' ? 'bg-blue-600' : 'bg-primary'}`}>
                    {session.title.charAt(0).toUpperCase()}
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
              <div className="flex items-center gap-1.5 mt-2.5 pl-[52px]">
                <div className={`w-2 h-2 rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)] ${session.isActive ? 'bg-emerald-500' : 'bg-rose-500 shadow-rose-500/50'}`}></div>
                <span className={`text-xs font-medium ${session.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {session.isActive ? 'Active (AI)' : 'Inactive (Manual)'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
