/**
 * SKM Render Notification Service
 *
 * When VITE_RENDER_API_URL is set  → POST to Render server → Firebase Admin SDK → FCM push
 * When VITE_RENDER_API_URL is empty → showNotification() via service worker (Android-compatible)
 */

import { getAuth } from 'firebase/auth';

const RENDER_URL: string = (import.meta.env.VITE_RENDER_API_URL as string | undefined) ?? '';
const ICON = '/THUMBS_POSE__Egg_-removebg-preview.png';

// ─── Show notification via FCM service worker ─────────────────────────────────
// The FCM SW (firebase-messaging-sw.js) already has notification authority
// from FCM registration. We post a SHOW_NOTIFICATION message to it so it
// calls self.registration.showNotification() — this works on Android Chrome.

async function showSWNotification(title: string, body: string, clickUrl = '/'): Promise<void> {
  console.info('[Notify] Attempting to show notification:', title);

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[Notify] Notifications not supported in this browser.');
    return;
  }
  if (Notification.permission !== 'granted') {
    console.warn('[Notify] Permission not granted:', Notification.permission);
    return;
  }

  const msg = {
    type:  'SHOW_NOTIFICATION',
    title,
    body,
    icon:  ICON,
    tag:   'skm-notification',
    url:   clickUrl,
  };

  // Try FCM SW first (scope: /firebase-cloud-messaging-push-scope)
  // It has notification authority from FCM, works on Android
  try {
    const fcmReg = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
    if (fcmReg?.active) {
      fcmReg.active.postMessage(msg);
      console.info('[Notify] ✓ Message sent to FCM SW — notification will appear.');
      return;
    }
  } catch (e: any) {
    console.warn('[Notify] FCM SW lookup failed:', e?.message);
  }

  // Try cache SW (scope: /)
  try {
    const cacheReg = await navigator.serviceWorker.getRegistration('/');
    if (cacheReg?.active) {
      cacheReg.active.postMessage(msg);
      console.info('[Notify] ✓ Message sent to cache SW — notification will appear.');
      return;
    }
  } catch (e: any) {
    console.warn('[Notify] Cache SW lookup failed:', e?.message);
  }

  // Last resort: reg.showNotification() directly (works on desktop Chrome)
  try {
    const ready = await navigator.serviceWorker.ready;
    await ready.showNotification(title, {
      body, icon: ICON, badge: ICON,
      tag: 'skm-notification',
      data: { url: clickUrl },
    });
    console.info('[Notify] ✓ Notification shown via ready.showNotification()');
  } catch (err: any) {
    console.error('[Notify] All SW methods failed:', err?.message);
    // Desktop absolute last resort
    try {
      new Notification(title, { body, icon: ICON });
      console.info('[Notify] ✓ Notification shown via direct new Notification()');
    } catch (e2: any) {
      console.error('[Notify] FAILED — browser blocked all notification methods:', e2?.message);
    }
  }
}

// ─── Notification text per event type ────────────────────────────────────────

function buildText(path: string, body: Record<string, unknown>): { title: string; msg: string; url: string } {
  // path is the route name: 'login', 'protein', 'streak', 'game', 'achievement', 'daily-summary', 'broadcast'
  // body['type'] is the specific sub-type within that route
  const type = String(body['type'] ?? path);

  switch (type) {
    case 'login':
      return {
        title: '👋 Welcome Back!',
        msg:   'You have successfully signed in to SKM. Have a great day!',
        url:   '/',
      };
    case 'protein_added':
      return {
        title: `+${body['grams'] ?? '?'}g Protein Added`,
        msg:   `Daily protein is now ${body['total'] ?? '?'}g. Keep it up!`,
        url:   '/?tab=tracker',
      };
    case 'protein_goal_complete':
      return {
        title: '🎯 Daily Protein Goal Reached!',
        msg:   `You hit ${body['total'] ?? '?'}g today. You're on fire!`,
        url:   '/?tab=tracker',
      };
    case 'protein_duplicate':
      return {
        title: '⚠️ Duplicate Egg Detected',
        msg:   'This egg has already been consumed today.',
        url:   '/?tab=tracker',
      };
    case 'protein_reminder':
      return {
        title: '🥚 Time to Fuel Your Day!',
        msg:   "Don't forget today's protein. Scan an SKM Egg and earn +6g protein.",
        url:   '/?tab=tracker',
      };
    case 'daily_goal_reminder':
      return {
        title: '💪 Almost There!',
        msg:   "You're close to today's protein goal. Keep going!",
        url:   '/?tab=tracker',
      };
    case 'golden_egg_scanned':
      return {
        title: '🥇 Golden Egg Scanned!',
        msg:   'Unlimited plays unlocked!',
        url:   '/?tab=game',
      };
    case 'streak_milestone':
      return {
        title: `🔥 ${body['days'] ?? '?'}-Day Streak!`,
        msg:   `${body['days'] ?? '?'} days straight. Incredible!`,
        url:   '/?tab=tracker',
      };
    case 'streak_reminder':
      return {
        title: "⏰ Don't Lose Your Streak!",
        msg:   "Record today's egg before midnight to keep your streak alive!",
        url:   '/?tab=tracker',
      };
    case 'new_high_score':
      return {
        title: '🏆 New High Score!',
        msg:   `New personal best: ${Number(body['score'] ?? 0).toLocaleString()} points!`,
        url:   '/?tab=game',
      };
    case 'game_reminder':
      return {
        title: '🎮 Ready for Another Run?',
        msg:   'Your chicken is warmed up and ready to race. Tap to play!',
        url:   '/?tab=game',
      };
    case 'mission_complete':
      return {
        title: '✅ Mission Complete!',
        msg:   `You completed "${body['missionName'] ?? 'a mission'}". Claim your reward!`,
        url:   '/?tab=game',
      };
    case 'qr_validated':
      return {
        title: '✅ QR Code Validated',
        msg:   `You have ${body['plays'] ?? '?'} plays available.`,
        url:   '/?tab=game',
      };
    case 'run_completed':
      return {
        title: '🐔 Run Complete!',
        msg:   `Score: ${Number(body['score'] ?? 0).toLocaleString()} points.`,
        url:   '/?tab=game',
      };
    case 'achievement_unlocked':
      return {
        title: '🎖️ Achievement Unlocked!',
        msg:   body['achievementName']
          ? `You unlocked "${body['achievementName']}"!`
          : 'New achievement unlocked! Check your profile.',
        url:   '/?tab=profile',
      };
    case 'protein_milestone':
      return {
        title: `🏅 ${body['total'] ?? '?'}g Protein Milestone!`,
        msg:   `You've consumed ${body['total'] ?? '?'}g of protein total. Champion!`,
        url:   '/?tab=profile',
      };
    case 'champion_rank_improved':
      return {
        title: '🏆 Champion Rank Improved!',
        msg:   `Your ranking improved to #${body['rank'] ?? '?'} in the Champion Hall.`,
        url:   '/?tab=profile',
      };
    case 'level_up':
      return {
        title: '⬆️ Level Up!',
        msg:   'You reached a new level. Keep climbing!',
        url:   '/?tab=profile',
      };
    case 'daily_summary':
    case 'daily-summary':
      return {
        title: "📊 Today's Summary",
        msg:   `Protein: ${body['protein'] ?? 0}g · Runs: ${body['runs'] ?? 0} · Streak: ${body['streak'] ?? 0} days`,
        url:   '/?tab=tracker',
      };
    case 'admin_announcement':
    case 'broadcast':
      return {
        title: String(body['title'] ?? 'SKM Announcement'),
        msg:   String(body['message'] ?? body['body'] ?? ''),
        url:   '/',
      };
    default:
      return {
        title: String(body['title'] ?? 'SKM Notification'),
        msg:   String(body['message'] ?? body['body'] ?? ''),
        url:   '/',
      };
  }
}

// ─── Internal fetch helper ────────────────────────────────────────────────────

async function getIdToken(): Promise<string | null> {
  try {
    const user = getAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function post(path: string, body: Record<string, unknown>): Promise<boolean> {
  const type = String(body['type'] ?? path);

  // ── No Render server: use SW notification directly ────────────────────────
  if (!RENDER_URL) {
    console.info(`[Notify] No RENDER_URL — showing SW notification for type: ${type}`);
    const { title, msg, url } = buildText(path, body);
    await showSWNotification(title, msg, url);
    return true;
  }

  // ── Render server: POST with Firebase ID Token ────────────────────────────
  const idToken = await getIdToken();
  if (!idToken) {
    console.warn('[Notify] No authenticated user — falling back to SW notification.');
    const { title, msg, url } = buildText(path, body);
    await showSWNotification(title, msg, url);
    return true;
  }

  const endpoint = `${RENDER_URL.replace(/\/$/, '')}/notify/${path}`;
  console.info(`[Notify] POST ${endpoint} type=${type}`);

  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[Notify] HTTP ${res.status} from Render:`, text);
      return false;
    }

    const data = await res.json().catch(() => ({}));
    if (data.success) {
      console.info(`[Notify] ✓ Render delivered push uid=${body['uid']} type=${type}`);
    } else {
      console.warn(`[Notify] Render no-op (reason: ${data.reason ?? 'unknown'})`);
    }
    return !!data.success;
  } catch (err: any) {
    console.error(`[Notify] Network error calling Render:`, err?.message ?? err);
    return false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const renderNotify = {
  login: (uid: string, email?: string) =>
    post('login', { uid, email: email ?? '', type: 'login' }),

  proteinAdded: (uid: string, grams: number, total: number) =>
    post('protein', { uid, grams, total, type: 'protein_added' }),

  proteinGoalComplete: (uid: string, goal: number) =>
    post('protein', { uid, total: goal, type: 'protein_goal_complete' }),

  proteinDuplicate: (uid: string) =>
    post('protein', { uid, type: 'protein_duplicate' }),

  proteinReminder: (uid: string) =>
    post('protein', { uid, type: 'protein_reminder' }),

  dailyGoalReminder: (uid: string) =>
    post('protein', { uid, type: 'daily_goal_reminder' }),

  goldenEgg: (uid: string) =>
    post('protein', { uid, type: 'golden_egg_scanned' }),

  streakMilestone: (uid: string, days: number) =>
    post('streak', { uid, days, type: 'streak_milestone' }),

  streakReminder: (uid: string, days: number) =>
    post('streak', { uid, days, type: 'streak_reminder' }),

  newHighScore: (uid: string, score: number) =>
    post('game', { uid, score, type: 'new_high_score' }),

  gameReminder: (uid: string) =>
    post('game', { uid, type: 'game_reminder' }),

  missionComplete: (uid: string, missionName: string) =>
    post('game', { uid, missionName, type: 'mission_complete' }),

  qrValidated: (uid: string, plays: number) =>
    post('game', { uid, plays, type: 'qr_validated' }),

  runCompleted: (uid: string, score: number) =>
    post('game', { uid, score, type: 'run_completed' }),

  achievementUnlocked: (uid: string, achievementName: string) =>
    post('achievement', { uid, achievementName, type: 'achievement_unlocked' }),

  proteinMilestone: (uid: string, total: number) =>
    post('achievement', { uid, total, type: 'protein_milestone' }),

  championRank: (uid: string, rank: number) =>
    post('achievement', { uid, rank, type: 'champion_rank_improved' }),

  levelUp: (uid: string) =>
    post('achievement', { uid, type: 'level_up' }),

  dailySummary: (uid: string, protein: number, runs: number, streak: number, rank?: number) =>
    post('daily-summary', { uid, protein, runs, streak, rank, type: 'daily_summary' }),

  broadcast: (uid: string, title: string, message: string, target = 'all') =>
    post('broadcast', { uid, title, message, target, type: 'admin_announcement' }),
};
