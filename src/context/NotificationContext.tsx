/**
 * SKM Notification Context
 * Global notification state with real-time Firestore sync.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  getNotificationSettings,
  saveNotificationSettings,
} from '../services/notifications/notificationService';
import { checkAndSendReminders } from '../services/notifications/reminderService';
import type { AppNotification, NotificationSettings } from '../types/notifications';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types/notifications';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  settings: NotificationSettings;
  drawerOpen: boolean;
  toastQueue: AppNotification[];
  openDrawer: () => void;
  closeDrawer: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  updateSettings: (s: NotificationSettings) => Promise<void>;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  settings: DEFAULT_NOTIFICATION_SETTINGS,
  drawerOpen: false,
  toastQueue: [],
  openDrawer: () => {},
  closeDrawer: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  remove: async () => {},
  clearAll: async () => {},
  updateSettings: async () => {},
  dismissToast: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = (user as any)?.uid as string | undefined;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings]           = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [toastQueue, setToastQueue]       = useState<AppNotification[]>([]);

  // Track which notification IDs we've already shown as a toast this session
  const shownToastsRef = useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter(n => !n.read).length;

  // Load settings once on login
  useEffect(() => {
    if (!uid) return;
    getNotificationSettings(uid)
      .then(s => setSettings(s))
      .catch(() => {});
  }, [uid]);

  // Real-time notification subscription
  useEffect(() => {
    if (!uid) { setNotifications([]); return; }

    const unsub = subscribeToNotifications(uid, (incoming) => {
      // Queue new unread items as in-app toasts (only once per session)
      const newUnread = incoming.filter(
        n => !n.read && !shownToastsRef.current.has(n.id)
      );
      if (newUnread.length > 0) {
        newUnread.forEach(n => shownToastsRef.current.add(n.id));
        // Only show the most recent one as a toast to avoid spamming
        const latest = newUnread.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        setToastQueue(prev => [...prev, latest]);
      }
      setNotifications(incoming);
    });

    return unsub;
  }, [uid]);

  // Run reminder checks once per hour (client-side scheduling)
  useEffect(() => {
    if (!uid) return;

    const runChecks = () => {
      checkAndSendReminders(uid, settings).catch(() => {});
    };

    runChecks();
    const timer = setInterval(runChecks, 60 * 60 * 1000); // every hour
    return () => clearInterval(timer);
  }, [uid, settings]);

  const openDrawer  = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const markRead = useCallback(async (id: string) => {
    await markAsRead(id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (uid) await markAllAsRead(uid);
  }, [uid]);

  const remove = useCallback(async (id: string) => {
    await deleteNotification(id);
  }, []);

  const clearAll = useCallback(async () => {
    if (uid) await clearAllNotifications(uid);
  }, [uid]);

  const updateSettings = useCallback(async (s: NotificationSettings) => {
    setSettings(s);
    if (uid) await saveNotificationSettings(uid, s);
  }, [uid]);

  const dismissToast = useCallback((id: string) => {
    setToastQueue(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      settings,
      drawerOpen,
      toastQueue,
      openDrawer,
      closeDrawer,
      markRead,
      markAllRead,
      remove,
      clearAll,
      updateSettings,
      dismissToast,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
