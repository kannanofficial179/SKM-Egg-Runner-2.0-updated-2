/**
 * SKM Notification Context
 *
 * Push-only architecture:
 *   - All notifications go to the Android notification bar via FCM.
 *   - NO in-app toasts, popups, or banners are shown automatically.
 *   - The notification drawer is a history panel — opened manually by the user.
 *   - FCM foreground messages are silently stored; never shown as in-app UI.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  initForegroundMessages,
  listenForNotificationClicks,
  capturePWAInstallPrompt,
} from '../services/notifications/pushNotificationService';
import { sendLoginNotification } from '../services/notifications/loginNotificationService';
import type { AppNotification, NotificationSettings } from '../types/notifications';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../types/notifications';

interface NotificationContextValue {
  notifications:  AppNotification[];
  unreadCount:    number;
  settings:       NotificationSettings;
  drawerOpen:     boolean;
  pushPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  pushEnabled:    boolean;
  openDrawer:     () => void;
  closeDrawer:    () => void;
  markRead:       (id: string) => Promise<void>;
  markAllRead:    () => Promise<void>;
  remove:         (id: string) => Promise<void>;
  clearAll:       () => Promise<void>;
  updateSettings: (s: NotificationSettings) => Promise<void>;
  enablePush:     () => Promise<void>;
  disablePush:    () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications:  [],
  unreadCount:    0,
  settings:       DEFAULT_NOTIFICATION_SETTINGS,
  drawerOpen:     false,
  pushPermission: 'default',
  pushEnabled:    false,
  openDrawer:     () => {},
  closeDrawer:    () => {},
  markRead:       async () => {},
  markAllRead:    async () => {},
  remove:         async () => {},
  clearAll:       async () => {},
  updateSettings: async () => {},
  enablePush:     async () => {},
  disablePush:    async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const uid = (user as any)?.uid as string | undefined;

  const [notifications,  setNotifications]  = useState<AppNotification[]>([]);
  const [settings,       setSettings]       = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationContextValue['pushPermission']>(
    getPushPermissionState()
  );
  const [pushEnabled, setPushEnabled] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  // ── PWA install prompt ───────────────────────────────────────────────────────
  useEffect(() => { capturePWAInstallPrompt(); }, []);

  // ── Load notification settings ───────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    getNotificationSettings(uid).then(s => setSettings(s)).catch(() => {});
  }, [uid]);

  // ── Real-time Firestore listener — history only, no UI popups ────────────────
  useEffect(() => {
    if (!uid) { setNotifications([]); return; }
    const unsub = subscribeToNotifications(uid, (incoming) => {
      setNotifications(incoming);
      // No toast queue. No popup. Notifications are stored silently.
    });
    return unsub;
  }, [uid]);

  // ── FCM token setup + login notification ─────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      setPushEnabled(false);
      return;
    }

    const email       = (user as any)?.email as string | undefined;
    const currentPerm = getPushPermissionState();
    setPushPermission(currentPerm);

    console.info('[FCM] User logged in. uid:', uid, '| notification permission:', currentPerm);

    const run = async () => {
      let permToUse = currentPerm;

      // If permission is already granted → go straight to token init
      if (permToUse === 'granted') {
        console.info('[FCM] Permission already granted — initializing FCM token...');
        const token = await initFCMToken(uid);
        setPushEnabled(!!token);
        if (token) {
          await sendLoginNotification(uid, email);
        }
        return;
      }

      // If permission is default → request it (always, not just first time)
      if (permToUse === 'default') {
        console.info('[FCM] Permission is default — will request in 2s...');
        await new Promise(r => setTimeout(r, 2000));
        permToUse = await requestPushPermission();
        setPushPermission(permToUse);

        if (permToUse === 'granted') {
          const token = await initFCMToken(uid);
          setPushEnabled(!!token);
          if (token) {
            await sendLoginNotification(uid, email);
          }
        }
        return;
      }

      // Denied or unsupported
      console.warn('[FCM] Push notifications not available. Permission:', permToUse);
      if (permToUse === 'denied') {
        console.warn('[FCM] User blocked notifications. To re-enable:');
        console.warn('[FCM]   Chrome: address bar lock icon → Notifications → Allow');
        console.warn('[FCM]   Android: Settings → Apps → Chrome → Notifications → Allow');
      }
    };

    run().catch(err => {
      console.error('[FCM] FCM setup error (non-fatal):', err?.message ?? err);
      setPushEnabled(false);
    });
  }, [uid]);

  // ── FCM foreground handler — NO popup, just log silently ────────────────────
  // When the app is open FCM normally suppresses OS notifications.
  // We do NOT show any in-app UI either. The message is already stored in
  // Firestore by the Cloud Function and will appear in the drawer.
  useEffect(() => {
    let unsubFCM: (() => void) | null = null;
    initForegroundMessages().then(unsub => { unsubFCM = unsub; }).catch(() => {});
    // Consume the custom event so nothing else acts on it
    const swallow = () => {};
    window.addEventListener('skm_push_foreground', swallow);
    return () => {
      unsubFCM?.();
      window.removeEventListener('skm_push_foreground', swallow);
    };
  }, []);

  // ── SW notification click → navigate ─────────────────────────────────────────
  useEffect(() => {
    const unsub = listenForNotificationClicks((type, url) => {
      window.dispatchEvent(new CustomEvent('skm_notification_navigate', {
        detail: { type, url },
      }));
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

  const openDrawer  = useCallback(() => setDrawerOpen(true),  []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const markRead    = useCallback(async (id: string) => { await markAsRead(id); }, []);
  const markAllRead = useCallback(async () => { if (uid) await markAllAsRead(uid); }, [uid]);
  const remove      = useCallback(async (id: string) => { await deleteNotification(id); }, []);
  const clearAll    = useCallback(async () => { if (uid) await clearAllNotifications(uid); }, [uid]);

  const updateSettings = useCallback(async (s: NotificationSettings) => {
    setSettings(s);
    if (uid) await saveNotificationSettings(uid, s);
  }, [uid]);

  const enablePush = useCallback(async () => {
    if (!uid) return;
    let perm = getPushPermissionState();
    if (perm === 'default') perm = await requestPushPermission();
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
      pushPermission,
      pushEnabled,
      openDrawer,
      closeDrawer,
      markRead,
      markAllRead,
      remove,
      clearAll,
      updateSettings,
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
