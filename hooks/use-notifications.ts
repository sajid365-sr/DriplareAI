import { create } from "zustand";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export const useNotifications = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (Array.isArray(data)) {
        set({ 
          notifications: data, 
          unreadCount: data.filter((n: any) => !n.read).length 
        });
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (id: string) => {
    const { notifications } = get();
    const notif = notifications.find(n => n.id === id);
    if (!notif || notif.read) return;

    // Optimistic update
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    set({ notifications: updated, unreadCount: updated.filter(n => !n.read).length });

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      // Revert if failed
      get().fetchNotifications();
    }
  },

  markAllRead: async () => {
    const { notifications } = get();
    set({ 
      notifications: notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0 
    });

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch (error) {
      get().fetchNotifications();
    }
  },
}));
