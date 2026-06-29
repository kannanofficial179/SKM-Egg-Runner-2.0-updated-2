/**
 * SKM Notification Context
 * Global notification state with real-time Firestore sync + FCM push support.
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
import {
  getPushPermissionState,
  hasAskedPermission,
  requestPushPermission,
  initFCMToken,
  revokeFCMToken,
  subscribeForegroundMessages,
  listenForNotificationClicks,
  capturePWAInstallPrompt,
} from '../services/notifications/pushNotificationService';
import type { AppNotification, NotificationSettings } from '../types/notifications';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types/notifications';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  settings: NotificationSettings;
  drawerOpen: boolean;
  toastQueue: AppNotification[];
  pushPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  pushEnabled: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  updateSettings: (s: NotificationSettings) => Promise<void>;
  dismissToast: (id: string) => void;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  settings: DEFAULT_NOTIFICATION_SETTINGS,
  drawerOpen: false,
  toastQueue: [],
  pushPermission: 'default',
  pushEnabled: false,
  openDrawer: () => {},
  closeDrawer: () => {},
  markRead: async () => {},
  markAllRead: async () => {},
  remove: async () => {},
  clearAll: async () => {},
  updateSettings: async () => {},
  dismissToast: () => {},
  enablePush: async () => {},
  disablePush: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = (user as any)?.uid as string | undefined;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [settings, setSettings]           = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [toastQueue, setToastQueue]       = useState<AppNotification[]>([]);
  const [pushPermission, setPushPermission] = useState<NotificationContextValue['pushPermission']>(
    getPushPermissionState()
  );
  const [pushEnabled, setPushEnabled] = useState(false);

  // Track which notification IDs we've already shown as a toast this session
  const shownToastsRef = useRef<Set<string>>(new Set());

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── PWA install prompt capture (run once at app start) ──────────────────────
  useEffect(() => {
    capturePWAInstallPrompt();
  }, []);

  // ── Load settings once on login ──────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    getNotificationSettings(uid)
      .then(s => setSettings(s))
      .catch(() => {});
  }, [uid]);

  // ── Real-time notification subscription ──────────────────────────────────────
  useEffect(() => {
    if (!uid) { setNotifications([]); return; }

    const unsub = subscribeToNotifications(uid, (incoming) => {
      // Queue new unread items as in-app toasts (only once per session)
      const newUnread = incoming.filter(
        n => !n.read && !shownToastsRef.current.has(n.id)
      );
      if (newUnread.length > 0) {
        newUnread.forEach(n => shownToastsRef.current.add(n.id));
        const latest = newUnread.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        setToastQueue(prev => [...prev, latest]);
      }
      setNotifications(incoming);
    });

    return unsub;
  }, [uid]);

  // ── FCM push setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setPushEnabled(false);
      return;
    }

    // Auto-init push if permission already granted in a previous session
    const currentPerm = getPushPermissionState();
    setPushPermission(currentPerm);

    if (currentPerm === 'granted') {
      initFCMToken(uid)
        .then(token => setPushEnabled(!!token))
        .catch(() => setPushEnabled(false));
    }

    // Request permission automatically on first login (only once ever)
    if (currentPerm === 'default' && !hasAskedPermission()) {
      // Delay 3s so the user is settled into the app before the prompt appears
      const timer = setTimeout(async () => {
        const perm = await requestPushPermission();
        setPushPermission(perm);
        if (perm === 'granted') {
          const token = await initFCMToken(uid).catch(() => null);
          setPushEnabled(!!token);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [uid]);

  // ── FCM foreground message listener ─────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeForegroundMessages();

    const handleForeground = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // Create a synthetic AppNotification for the toast queue
      const syntheticNotif: AppNotification = {
        id:        `push_${Date.now()}`,
        userId:    uid ?? '',
        title:     detail.title,
        message:   detail.body,
        type:      detail.type ?? 'admin_announcement',
        priority:  'normal',
        read:      false,
        createdAt: new Date(),
        metadata:  { notifId: detail.notifId },
      };
      if (!shownToastsRef.current.has(syntheticNotif.id)) {
        shownToastsRef.current.add(syntheticNotif.id);
        setToastQueue(prev => [...prev, syntheticNotif]);
      }
    };

    window.addEventListener('skm_push_foreground', handleForeground);
    return () => {
      unsub();
      window.removeEventListener('skm_push_foreground', handleForeground);
    };
  }, [uid]);

  // ── SW notification click → app navigation ───────────────────────────────────
  useEffect(() => {
    const unsub = listenForNotificationClicks((type, url) => {
      // Dispatch a global event — screens can listen and navigate accordingly
      window.dispatchEvent(new CustomEvent('skm_notification_navigate', {
        detail: { type, url },
      }));
      console.info('[Notif] SW click navigate:', type, url);
    });
    return unsub;
  }, []);

  // ── Hourly reminder checks ───────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    const run = () => checkAndSendReminders(uid, settings).catch(() => {});
    run();
    const timer = setInterval(run, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [uid, settings]);

  // ── Actions ──────────────────────────────────────────────────────────────────

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

  const enablePush = useCallback(async () => {
    if (!uid) return;
    let perm = getPushPermissionState();
    if (perm === 'default') {
      perm = await requestPushPermission();
    }
    setPushPermission(perm);
    if (perm === 'granted') {
      const token = await initFCMToken(uid).catch(() => null);
      setPushEnabled(!!token);
    }
  }, [uid]);

  const disablePush = useCallback(async () => {
    if (!uid) return;
    await revokeFCMToken(uid);
    setPushEnabled(false);
    await updateSettings({ ...settings, pushNotifications: false });
  }, [uid, settings, updateSettings]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      settings,
      drawerOpen,
      toastQueue,
      pushPermission,
      pushEnabled,
      openDrawer,
      closeDrawer,
      markRead,
      markAllRead,
      remove,
      clearAll,
      updateSettings,
      dismissToast,
      enablePush,
      disablePush,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
