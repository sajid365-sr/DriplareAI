"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CreditCard, Zap, TrendingUp, Gift, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotifications } from "@/hooks/use-notifications";

type NotifType = "payment" | "usage" | "plan" | "referral" | "system";

const NOTIF_ICON: Record<NotifType, { icon: any; bg: string; color: string }> = {
  payment:  { icon: CreditCard,     bg: "bg-emerald-500/10", color: "text-emerald-500" },
  usage:    { icon: Zap,            bg: "bg-amber-500/10",   color: "text-amber-500" },
  plan:     { icon: TrendingUp,     bg: "bg-primary/10",     color: "text-primary" },
  referral: { icon: Gift,           bg: "bg-fuchsia-500/10", color: "text-fuchsia-500" },
  system:   { icon: CheckCircle2,   bg: "bg-muted",          color: "text-muted-foreground" },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead } = useNotifications();

  useEffect(() => {
    fetchNotifications();
    
    // Fast polling for near real-time feel (15 seconds)
    const interval = setInterval(fetchNotifications, 15000);
    
    // Also refetch when window regains focus
    const handleFocus = () => fetchNotifications();
    window.addEventListener("focus", handleFocus);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchNotifications]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        data-testid="notification-bell"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-white text-[9px] font-bold rounded-full flex items-center justify-center"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="absolute right-0 top-11 z-50 w-[360px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary hover:underline font-medium">
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const meta = NOTIF_ICON[notif.type as NotifType] || NOTIF_ICON.system;
                    const Icon = meta.icon;
                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        onClick={() => markRead(notif.id)}
                        className={`flex gap-3 px-4 py-3.5 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-muted/40 ${
                          !notif.read ? "bg-primary/[0.03]" : ""
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate">{notif.title}</p>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.message}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border bg-muted/30 text-center">
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Your notifications are up to date
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
