"use client";

import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { CompareSession } from "./compare-types";

interface CompareHistoryTableProps {
  sessions: CompareSession[];
  activeSessionId: string;
  loadingSessions: boolean;
  loadingMessages: boolean;
  onRefresh: () => void;
  onView: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
}

export const CompareHistoryTable = ({
  sessions,
  activeSessionId,
  loadingSessions,
  loadingMessages,
  onRefresh,
  onView,
  onDelete,
}: CompareHistoryTableProps) => {
  return (
    <div className="rounded-2xl border border-border/85 bg-card/45 backdrop-blur-sm p-5 shadow-sm">
      {/* Table Header */}
      <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">Compare History</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loadingSessions}
          className="text-xs hover:bg-secondary rounded-lg font-medium"
        >
          {loadingSessions && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
          Refresh History
        </Button>
      </div>

      {/* Table Body */}
      {loadingSessions && sessions.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          Loading history...
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground italic">
          No past comparison sessions found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50 bg-background/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider font-semibold border-b border-border/50">
                  <th className="px-5 py-3">Session ID</th>
                  <th className="px-5 py-3">Last Message Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const isActive = activeSessionId === s.sessionId;
                  return (
                    <tr
                      key={s.sessionId}
                      className={cn(
                        "border-b border-border/40 hover:bg-secondary/20 transition-colors",
                        isActive && "bg-primary/5 font-medium"
                      )}
                    >
                      <td className="px-5 py-3 font-mono text-xs max-w-[200px] truncate">
                        {s.sessionId}
                        {isActive && (
                          <span className="ml-2 text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {new Date(s.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loadingMessages}
                            onClick={() => onView(s.sessionId)}
                            className="h-8 rounded-lg text-xs font-semibold hover:bg-primary/10 hover:text-primary transition-colors border-primary/20"
                          >
                            View
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(s.sessionId)}
                            className="h-8 rounded-lg text-xs font-semibold bg-red-500 hover:bg-red-600 text-white border-none shadow-sm transition-colors"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
