/**
 * DEV ASSISTANT - Real-Time Analytics Engine
 *
 * Architecture:
 *   User command -> COMMANDS registry (regex patterns) -> handler function
 *   -> Firestore query -> calculate -> DevAnswer { text, cards, table, meta }
 *
 * Permission model:
 *   The logged-in user must have role == "developer" in their Firestore
 *   users/{uid} document. This is checked via isDeveloperRole() before
 *   any analytics query runs. The Firestore rules enforce the same check
 *   server-side via the isDeveloper() function.
 *
 * Error policy:
 *   Every Firestore error is classified and returned verbatim in
 *   DevAnswer.error. No "No data available" without a reason.
 */

import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  getCountFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase';
import { getActiveLiveConfig } from '../../liveConfig';
import { todayKey, startOfToday, startOfWeek, nowTimeStr } from '../../utils/dateHelpers';
import { STOP_WORDS, tokenize, levenshtein } from '../../utils/textHelpers';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type CardColor = 'red' | 'green' | 'yellow' | 'blue' | 'white' | 'purple' | 'orange';

export interface DevCard {
  label: string;
  value: string;
  sub?: string;
  color?: CardColor;
}

export interface DevMeta {
  source: string;
  records: number;
  execMs: number;
  timestamp: string;
  confidence: '100%' | 'PARTIAL' | 'ERROR';
}

export interface DevAnswer {
  text: string;
  error?: string;
  cards?: DevCard[];
  table?: { headers: string[]; rows: string[][] };
  meta?: DevMeta;
  type?: 'cards' | 'table' | 'health' | 'config' | 'info' | 'diagnostic';
  suggestions?: string[];  // follow-up command labels shown as chips after the answer
}

export interface PermissionStatus {
  uid: string;
  email: string;
  role: string;
  isDeveloper: boolean;
  error?: string;
}

// ─────────────────────────────────────────────
// Firebase error classifier
// Returns a human-readable reason for Firestore errors.
// ─────────────────────────────────────────────

function classifyError(err: unknown, collection: string): string {
  if (!(err instanceof Error)) return `Unknown error on ${collection}`;
  const msg = err.message;
  const code = (err as { code?: string }).code ?? '';

  if (code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
    return `PERMISSION DENIED on ${collection}. Your user account does not have role="developer" in Firestore, or the security rules have not been deployed yet.`;
  }
  if (code === 'unavailable' || msg.includes('network') || msg.includes('offline')) {
    return `NETWORK ERROR on ${collection}. Firebase is unreachable. Check your internet connection.`;
  }
  if (code === 'failed-precondition' || msg.includes('index')) {
    return `MISSING INDEX on ${collection}. Deploy firestore.indexes.json: run "firebase deploy --only firestore:indexes".`;
  }
  if (code === 'not-found' || msg.includes('not found')) {
    return `COLLECTION NOT FOUND: ${collection}. This collection has no documents yet.`;
  }
  if (code === 'unauthenticated' || msg.includes('unauthenticated')) {
    return `NOT AUTHENTICATED. Log in before using DEV.`;
  }
  return `${collection}: ${msg.slice(0, 120)}`;
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

// todayKey, startOfToday, startOfWeek, nowTimeStr imported from utils/dateHelpers
// STOP_WORDS, tokenize, levenshtein imported from utils/textHelpers

function makeMeta(source: string, records: number, t0: number, confidence: DevMeta['confidence'] = '100%'): DevMeta {
  return { source, records, execMs: Date.now() - t0, timestamp: nowTimeStr(), confidence };
}

// ─────────────────────────────────────────────
// PERMISSION LAYER
// ─────────────────────────────────────────────

/**
 * Check whether the current Firebase Auth user has role="developer"
 * in their Firestore users/{uid} document.
 * Returns a PermissionStatus with full diagnostic info.
 */
export async function checkDevPermissions(): Promise<PermissionStatus> {
  const user = auth.currentUser;
  if (!user) {
    return { uid: '', email: '', role: 'none', isDeveloper: false, error: 'NOT AUTHENTICATED. No Firebase user is signed in.' };
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) {
      return {
        uid: user.uid, email: user.email ?? '', role: 'none', isDeveloper: false,
        error: `User document users/${user.uid} does not exist in Firestore.`,
      };
    }
    const role = snap.data().role ?? 'user';
    return { uid: user.uid, email: user.email ?? '', role, isDeveloper: role === 'developer' };
  } catch (err: unknown) {
    return {
      uid: user.uid, email: user.email ?? '', role: 'unknown', isDeveloper: false,
      error: classifyError(err, `users/${user.uid}`),
    };
  }
}

/**
 * Set role="developer" on the current user's Firestore document.
 * Call this once after logging in as the developer account.
 */
export async function setDeveloperRole(): Promise<{ ok: boolean; error?: string }> {
  const user = auth.currentUser;
  if (!user) return { ok: false, error: 'Not authenticated.' };
  try {
    await setDoc(doc(db, 'users', user.uid), { role: 'developer', updatedAt: serverTimestamp() }, { merge: true });
    console.log('[DEV] role=developer set on', user.uid);
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: classifyError(err, 'users/' + user.uid) };
  }
}

// ─────────────────────────────────────────────
// COMMAND HANDLERS
// Each handler runs exactly one (or a small set of) Firestore queries.
// Errors are always classified and returned — never swallowed.
// ─────────────────────────────────────────────

// ── Diagnostic ─────────────────────────────

async function cmdDiagnostic(): Promise<DevAnswer> {
  const t0 = Date.now();
  const perm = await checkDevPermissions();

  const COLLECTIONS: Array<{ col: string; label: string; isGroup?: boolean }> = [
    { col: 'users',              label: 'Users' },
    { col: 'leaderboard',        label: 'Leaderboard' },
    { col: 'qrCodes',            label: 'QR Codes' },
    { col: 'gameConfig',         label: 'Dev Config' },
    { col: 'login_streaks',      label: 'Streaks' },
    { col: 'daily_stats',        label: 'Daily Stats' },
    { col: 'protein_logs',       label: 'Protein Logs' },
    { col: 'tracker_settings',   label: 'Tracker Settings' },
    { col: 'daily_missions',     label: 'Daily Missions' },
  ];

  const rows: string[][] = [
    ['UID',   perm.uid.slice(0, 16) + (perm.uid.length > 16 ? '...' : ''), perm.uid ? 'OK' : 'MISSING'],
    ['Email', perm.email || 'N/A', perm.email ? 'OK' : 'MISSING'],
    ['Role',  perm.role, perm.isDeveloper ? 'DEVELOPER' : 'BLOCKED'],
    ['Auth',  auth.currentUser ? 'Signed In' : 'Not Signed In', auth.currentUser ? 'OK' : 'ERROR'],
  ];

  for (const { col, label } of COLLECTIONS) {
    try {
      await getDocs(query(collection(db, col), limit(1)));
      rows.push([label, col, 'ACCESSIBLE']);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? 'error';
      rows.push([label, col, code === 'permission-denied' ? 'PERMISSION DENIED' : code.toUpperCase()]);
    }
  }

  return {
    text: perm.isDeveloper
      ? 'DEV diagnostic complete. Developer access confirmed.'
      : `DEV diagnostic: NOT a developer. Role is "${perm.role}". Run "grant dev access" to fix.`,
    type: 'diagnostic',
    error: perm.error,
    table: {
      headers: ['Service', 'Path / Value', 'Status'],
      rows,
    },
    meta: makeMeta('multi-collection diagnostic', rows.length, t0, perm.isDeveloper ? '100%' : 'ERROR'),
  };
}

async function cmdGrantDevAccess(): Promise<DevAnswer> {
  const t0 = Date.now();
  const result = await setDeveloperRole();
  if (result.ok) {
    return {
      text: 'Developer role granted. Reload the DEV tab to apply access.',
      type: 'info',
      cards: [{ label: 'Role', value: 'developer', color: 'green' }, { label: 'Status', value: 'GRANTED', color: 'green' }],
      meta: makeMeta('users/' + (auth.currentUser?.uid ?? ''), 1, t0),
    };
  }
  return {
    text: 'Failed to grant developer role.',
    error: result.error,
    meta: makeMeta('users', 0, t0, 'ERROR'),
  };
}

// ── User analytics ──────────────────────────

async function cmdNewUsersToday(): Promise<DevAnswer> {
  const t0 = Date.now();
  const start = Timestamp.fromDate(startOfToday());

  // Try Timestamp filter first; if it fails try string comparison in JS
  let snap;
  let usedFallback = false;
  try {
    snap = await getDocs(query(collection(db, 'users'), where('createdAt', '>=', start)));
  } catch (err1: unknown) {
    const reason1 = classifyError(err1, 'users[createdAt>=today]');
    // Fallback: load all users and filter in JS
    try {
      const all = await getDocs(collection(db, 'users'));
      const todayStr = todayKey();
      const filtered = all.docs.filter(d => {
        const created = d.data().createdAt;
        if (created instanceof Timestamp) return created.toDate().toISOString().startsWith(todayStr);
        if (typeof created === 'string') return created.startsWith(todayStr);
        return false;
      });
      snap = { docs: filtered, size: filtered.length, empty: filtered.length === 0 } as any;
      usedFallback = true;
    } catch (err2: unknown) {
      return { text: 'Query failed.', error: reason1 + ' | Fallback also failed: ' + classifyError(err2, 'users'), meta: makeMeta('users', 0, t0, 'ERROR') };
    }
  }

  let google = 0, phone = 0, other = 0;
  (snap as any).docs.forEach((d: any) => {
    const p = d.data().provider ?? '';
    if (p === 'google.com' || p === 'google') google++;
    else if (p === 'phone') phone++;
    else other++;
  });

  const total = (snap as any).size ?? (snap as any).docs.length;
  return {
    text: total === 0 ? 'No new users registered today.' : `${total} new user${total !== 1 ? 's' : ''} registered today.`,
    type: 'cards',
    cards: [
      { label: 'New Today',  value: String(total),  color: 'red'   },
      { label: 'Google',     value: String(google), color: 'blue'  },
      { label: 'Phone',      value: String(phone),  color: 'green' },
      { label: 'Other',      value: String(other),  color: 'white' },
    ],
    meta: makeMeta('users', total, t0, usedFallback ? 'PARTIAL' : '100%'),
  };
}

async function cmdTotalUsers(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const agg = await getCountFromServer(collection(db, 'users'));
    const count = agg.data().count;
    return {
      text: `${count.toLocaleString()} total registered user${count !== 1 ? 's' : ''}.`,
      type: 'cards',
      cards: [{ label: 'Total Users', value: count.toLocaleString(), color: 'red' }],
      meta: makeMeta('users', count, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'users'), meta: makeMeta('users', 0, t0, 'ERROR') };
  }
}

async function cmdActiveUsersToday(): Promise<DevAnswer> {
  const t0 = Date.now();
  const start = Timestamp.fromDate(startOfToday());
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('lastLogin', '>=', start)));
    return {
      text: `${snap.size} active user${snap.size !== 1 ? 's' : ''} today.`,
      type: 'cards',
      cards: [{ label: 'Active Today', value: String(snap.size), color: 'green' }],
      meta: makeMeta('users', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'users[lastLogin>=today]'), meta: makeMeta('users', 0, t0, 'ERROR') };
  }
}

async function cmdActiveUsersWeek(): Promise<DevAnswer> {
  const t0 = Date.now();
  const start = Timestamp.fromDate(startOfWeek());
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('lastLogin', '>=', start)));
    return {
      text: `${snap.size} active user${snap.size !== 1 ? 's' : ''} this week.`,
      type: 'cards',
      cards: [{ label: 'Active This Week', value: String(snap.size), color: 'green' }],
      meta: makeMeta('users', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'users[lastLogin>=week]'), meta: makeMeta('users', 0, t0, 'ERROR') };
  }
}

// ── Game analytics ──────────────────────────

async function cmdTopPlayers(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10)));
    if (snap.empty) return { text: 'Leaderboard is empty. No game runs recorded yet.', meta: makeMeta('leaderboard', 0, t0) };
    const rows = snap.docs.map((d, i) => {
      const data = d.data();
      return [`#${i + 1}`, data.playerName ?? 'Unknown', (data.score ?? 0).toLocaleString(), `${Math.round(data.distance ?? 0)}m`];
    });
    return {
      text: `Top ${snap.size} players by score.`,
      type: 'table',
      table: { headers: ['Rank', 'Player', 'Score', 'Distance'], rows },
      meta: makeMeta('leaderboard', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'leaderboard'), meta: makeMeta('leaderboard', 0, t0, 'ERROR') };
  }
}

async function cmdHighestScore(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(1)));
    if (snap.empty) return { text: 'No scores recorded yet.', meta: makeMeta('leaderboard', 0, t0) };
    const d = snap.docs[0].data();
    return {
      text: `All-time highest score: ${(d.score ?? 0).toLocaleString()} by ${d.playerName ?? 'Unknown'}.`,
      type: 'cards',
      cards: [
        { label: 'Player',     value: d.playerName ?? 'Unknown',             color: 'white'  },
        { label: 'Score',      value: (d.score ?? 0).toLocaleString(),       color: 'red'    },
        { label: 'Distance',   value: `${Math.round(d.distance ?? 0)}m`,     color: 'yellow' },
        { label: 'Total Runs', value: String(d.totalRuns ?? 'N/A'),          color: 'blue'   },
      ],
      meta: makeMeta('leaderboard', 1, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'leaderboard'), meta: makeMeta('leaderboard', 0, t0, 'ERROR') };
  }
}

async function cmdAverageScore(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'leaderboard'), limit(500)));
    if (snap.empty) return { text: 'No scores recorded yet.', meta: makeMeta('leaderboard', 0, t0) };
    let total = 0, maxScore = 0, totalDist = 0;
    snap.forEach(d => {
      const s = d.data().score ?? 0;
      total += s; if (s > maxScore) maxScore = s;
      totalDist += d.data().distance ?? 0;
    });
    const n = snap.size;
    return {
      text: `Score statistics across ${n} player${n !== 1 ? 's' : ''}.`,
      type: 'cards',
      cards: [
        { label: 'Players',      value: n.toLocaleString(),                       color: 'white'  },
        { label: 'Avg Score',    value: Math.round(total / n).toLocaleString(),   color: 'yellow' },
        { label: 'Top Score',    value: maxScore.toLocaleString(),                color: 'red'    },
        { label: 'Avg Distance', value: `${Math.round(totalDist / n)}m`,          color: 'blue'   },
      ],
      meta: makeMeta('leaderboard', n, t0, n >= 500 ? 'PARTIAL' : '100%'),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'leaderboard'), meta: makeMeta('leaderboard', 0, t0, 'ERROR') };
  }
}

async function cmdTotalRuns(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'leaderboard'), limit(500)));
    let totalRuns = 0;
    snap.forEach(d => { totalRuns += d.data().totalRuns ?? 0; });
    return {
      text: `${totalRuns.toLocaleString()} total game runs across ${snap.size} players.`,
      type: 'cards',
      cards: [
        { label: 'Total Runs', value: totalRuns.toLocaleString(), color: 'red'    },
        { label: 'Players',    value: snap.size.toLocaleString(), color: 'white'  },
        { label: 'Avg Runs',   value: snap.size > 0 ? Math.round(totalRuns / snap.size).toString() : '0', color: 'yellow' },
      ],
      meta: makeMeta('leaderboard', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'leaderboard'), meta: makeMeta('leaderboard', 0, t0, 'ERROR') };
  }
}

// ── QR analytics ────────────────────────────

async function cmdQRStats(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(collection(db, 'qrCodes'));
    if (snap.empty) return { text: 'No QR codes found in database.', meta: makeMeta('qrCodes', 0, t0) };
    let totalScans = 0, exhausted = 0, totalCap = 0;
    snap.forEach(d => {
      const data = d.data();
      const plays = data.playCount ?? 0;
      const max   = data.maxPlays   ?? 999;
      totalScans += plays; totalCap += max;
      if (plays >= max) exhausted++;
    });
    return {
      text: `${snap.size} QR codes — ${totalScans.toLocaleString()} total scans.`,
      type: 'cards',
      cards: [
        { label: 'Total Codes',   value: snap.size.toLocaleString(),              color: 'white'  },
        { label: 'Total Scans',   value: totalScans.toLocaleString(),             color: 'green'  },
        { label: 'Active',        value: (snap.size - exhausted).toLocaleString(), color: 'yellow' },
        { label: 'Exhausted',     value: exhausted.toLocaleString(),              color: 'red'    },
        { label: 'Remaining Cap', value: (totalCap - totalScans).toLocaleString(), color: 'blue'  },
      ],
      meta: makeMeta('qrCodes', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'qrCodes'), meta: makeMeta('qrCodes', 0, t0, 'ERROR') };
  }
}

async function cmdTopQRCodes(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'qrCodes'), orderBy('playCount', 'desc'), limit(10)));
    if (snap.empty) return { text: 'No QR codes found.', meta: makeMeta('qrCodes', 0, t0) };
    const rows = snap.docs.map((d, i) => {
      const data = d.data();
      return [`#${i + 1}`, d.id.slice(0, 14) + '...', String(data.playCount ?? 0), String(data.maxPlays ?? 'N/A'), (data.playCount ?? 0) >= (data.maxPlays ?? 999) ? 'USED UP' : 'ACTIVE'];
    });
    return {
      text: `Top ${snap.size} most-scanned QR codes.`,
      type: 'table',
      table: { headers: ['Rank', 'Code ID', 'Scans', 'Max', 'Status'], rows },
      meta: makeMeta('qrCodes', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'qrCodes[orderBy playCount]'), meta: makeMeta('qrCodes', 0, t0, 'ERROR') };
  }
}

// ── Streak analytics ─────────────────────────

async function cmdStreakStats(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(collection(db, 'login_streaks'));
    if (snap.empty) return { text: 'No streak data found. Users must log in at least once to create streak records.', meta: makeMeta('login_streaks', 0, t0) };
    let maxStreak = 0, sumCurrent = 0, sumBest = 0, broken = 0;
    const today = todayKey();
    snap.forEach(d => {
      const data = d.data();
      const cur  = data.currentStreak ?? 0;
      const best = data.bestStreak    ?? cur;
      sumCurrent += cur; sumBest += best;
      if (best > maxStreak) maxStreak = best;
      if (data.lastActiveDate && data.lastActiveDate !== today) broken++;
    });
    const n = snap.size;
    return {
      text: `Streak statistics across ${n} users.`,
      type: 'cards',
      cards: [
        { label: 'Users Tracked', value: n.toLocaleString(),                    color: 'white'  },
        { label: 'Longest Ever',  value: `${maxStreak} days`,                   color: 'red'    },
        { label: 'Avg Current',   value: `${(sumCurrent / n).toFixed(1)} days`, color: 'yellow' },
        { label: 'Avg Best',      value: `${(sumBest    / n).toFixed(1)} days`, color: 'green'  },
        { label: 'Broken Today',  value: broken.toLocaleString(),               color: 'orange' },
      ],
      meta: makeMeta('login_streaks', n, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'login_streaks'), meta: makeMeta('login_streaks', 0, t0, 'ERROR') };
  }
}

async function cmdStreakLeaders(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'login_streaks'), orderBy('currentStreak', 'desc'), limit(10)));
    if (snap.empty) return { text: 'No streak data found.', meta: makeMeta('login_streaks', 0, t0) };
    const rows = snap.docs.map((d, i) => {
      const data = d.data();
      return [`#${i + 1}`, d.id.slice(0, 10) + '...', `${data.currentStreak ?? 0}d`, `${data.bestStreak ?? 0}d`, data.lastActiveDate ?? 'N/A'];
    });
    return {
      text: `Top ${snap.size} streak leaders.`,
      type: 'table',
      table: { headers: ['Rank', 'UID', 'Current', 'Best', 'Last Active'], rows },
      meta: makeMeta('login_streaks', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'login_streaks[orderBy currentStreak]'), meta: makeMeta('login_streaks', 0, t0, 'ERROR') };
  }
}

// ── Protein tracker ──────────────────────────

async function cmdProteinToday(): Promise<DevAnswer> {
  const t0 = Date.now();
  const today = todayKey();
  try {
    const snap = await getDocs(query(collectionGroup(db, 'days'), where('date', '==', today)));
    if (snap.empty) return { text: `No protein logs for today (${today}). Users must log meals first.`, meta: makeMeta('daily_stats/days', 0, t0) };
    let totalProtein = 0, goalsHit = 0;
    snap.forEach(d => {
      const data = d.data();
      totalProtein += data.totalProtein ?? 0;
      if ((data.totalProtein ?? 0) >= (data.dailyGoal ?? 60)) goalsHit++;
    });
    const n = snap.size;
    return {
      text: `Protein Tracker — today (${today}).`,
      type: 'cards',
      cards: [
        { label: 'Active Loggers', value: n.toLocaleString(),                                            color: 'green'  },
        { label: 'Total Protein',  value: `${totalProtein.toFixed(0)}g`,                                 color: 'red'    },
        { label: 'Avg Per User',   value: `${(totalProtein / n).toFixed(0)}g`,                           color: 'yellow' },
        { label: 'Goals Hit',      value: `${goalsHit} / ${n} (${((goalsHit / n) * 100).toFixed(0)}%)`, color: 'blue'   },
      ],
      meta: makeMeta('daily_stats/*/days', n, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'collectionGroup(days)[date==' + today + ']'), meta: makeMeta('daily_stats/days', 0, t0, 'ERROR') };
  }
}

async function cmdEggConsumption(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('lifetimeConsumption', 'desc'), limit(10)));
    if (snap.empty) return { text: 'No egg consumption data found.', meta: makeMeta('users', 0, t0) };
    let totalEggs = 0;
    const rows = snap.docs.map((d, i) => {
      const data = d.data();
      totalEggs += data.lifetimeConsumption ?? 0;
      return [`#${i + 1}`, data.playerName ?? 'Unknown', (data.lifetimeConsumption ?? 0).toLocaleString()];
    });
    return {
      text: `Top egg consumers. Total logged: ${totalEggs.toLocaleString()} eggs.`,
      type: 'table',
      table: { headers: ['Rank', 'Player', 'Eggs Consumed'], rows },
      meta: makeMeta('users', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'users[orderBy lifetimeConsumption]'), meta: makeMeta('users', 0, t0, 'ERROR') };
  }
}

// ── Developer config ─────────────────────────

async function cmdDevConfig(): Promise<DevAnswer> {
  const t0 = Date.now();
  const lsConfig = getActiveLiveConfig();
  let firestoreConfig: Record<string, unknown> = {};
  let firestoreOk = false;
  let firestoreError: string | undefined;

  try {
    const snap = await getDoc(doc(db, 'gameConfig', 'active'));
    if (snap.exists()) { firestoreConfig = snap.data(); firestoreOk = true; }
    else firestoreError = 'gameConfig/active document does not exist yet.';
  } catch (err: unknown) {
    firestoreError = classifyError(err, 'gameConfig/active');
  }

  const cfg = firestoreOk ? { ...lsConfig, ...firestoreConfig } : lsConfig;
  return {
    text: firestoreOk ? 'Live developer config (Firestore source).' : `Live config (localStorage only). Firestore: ${firestoreError}`,
    type: 'config',
    error: firestoreOk ? undefined : firestoreError,
    cards: [
      { label: 'Version',       value: String(cfg.configVersion  ?? 'N/A'), color: 'green'  },
      { label: 'Feed Spawn',    value: `${cfg.feedSpawnRate}x`,              color: 'green'  },
      { label: 'Obstacle Rate', value: `${cfg.obstacleSpawnRate}x`,          color: 'yellow' },
      { label: 'Traffic',       value: `${cfg.trafficDensity}x`,             color: 'red'    },
      { label: 'Vehicle Rate',  value: `${cfg.vehicleSpawnRate}x`,           color: 'red'    },
      { label: 'Run Speed',     value: `${cfg.runSpeedMultiplier}x`,         color: 'blue'   },
      { label: 'Evo Stage 1',   value: `${cfg.stage1EvolutionReq} grains`,   color: 'white'  },
      { label: 'Evo Stage 2',   value: `${cfg.stage2EvolutionReq} grains`,   color: 'white'  },
      { label: 'Crystal Rew.',  value: `${cfg.crystalEggRewards}x`,          color: 'yellow' },
      { label: 'Mission Rew.',  value: `${cfg.missionRewards}x`,             color: 'purple' },
      { label: 'Updated By',    value: String(cfg.updatedBy ?? 'SYSTEM'),   color: 'white'  },
      { label: 'Status',        value: cfg.isActive ? 'ACTIVE' : 'INACTIVE', color: cfg.isActive ? 'green' : 'red' },
    ],
    meta: makeMeta(firestoreOk ? 'gameConfig/active' : 'localStorage', 1, t0, firestoreOk ? '100%' : 'PARTIAL'),
  };
}

// ── System health ────────────────────────────

async function cmdSystemHealth(): Promise<DevAnswer> {
  const t0 = Date.now();
  const targets = [
    { col: 'users',            label: 'Auth / Users'      },
    { col: 'leaderboard',      label: 'Game Leaderboard'  },
    { col: 'qrCodes',          label: 'QR Validation'     },
    { col: 'gameConfig',       label: 'Dev Config'        },
    { col: 'login_streaks',    label: 'Streak System'     },
    { col: 'tracker_settings', label: 'Protein Tracker'   },
    { col: 'daily_stats',      label: 'Daily Stats'       },
    { col: 'daily_missions',   label: 'Daily Missions'    },
  ];

  const results = await Promise.allSettled(
    targets.map(({ col }) => getDocs(query(collection(db, col), limit(1))))
  );

  const rows = targets.map(({ col, label }, i) => {
    const res = results[i];
    if (res.status === 'fulfilled') return [label, col, 'ACCESSIBLE'];
    const code = (res.reason as { code?: string }).code ?? '';
    const detail = code === 'permission-denied' ? 'PERMISSION DENIED' : code ? code.toUpperCase() : 'ERROR';
    return [label, col, detail];
  });

  const allOk = rows.every(r => r[2] === 'ACCESSIBLE');
  const perm = await checkDevPermissions();

  rows.unshift(['Firebase Auth', auth.currentUser ? auth.currentUser.email ?? auth.currentUser.uid : 'Not signed in', auth.currentUser ? 'SIGNED IN' : 'NO SESSION']);
  rows.unshift(['Developer Role', perm.role, perm.isDeveloper ? 'CONFIRMED' : 'NOT DEVELOPER']);

  return {
    text: allOk ? 'All services accessible.' : `${rows.filter(r => r[2] !== 'ACCESSIBLE' && r[2] !== 'SIGNED IN' && r[2] !== 'CONFIRMED').length} service(s) blocked or erroring.`,
    type: 'health',
    error: perm.isDeveloper ? undefined : 'Access is limited because your account does not have role="developer". Run "grant dev access" to fix.',
    table: { headers: ['Service', 'Collection / Value', 'Status'], rows },
    meta: makeMeta('8 collections', rows.length, t0, allOk ? '100%' : 'PARTIAL'),
  };
}

// ── Mission analytics ────────────────────────

async function cmdMissionStats(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(collectionGroup(db, 'game_missions'));
    if (snap.empty) return { text: 'No mission data found. game_missions subcollection may be empty.', meta: makeMeta('game_missions', 0, t0) };
    let total = 0, completed = 0;
    snap.forEach(d => { total++; if (d.data().completed === true) completed++; });
    const rate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
    return {
      text: `Mission completion: ${rate}% (${completed} of ${total}).`,
      type: 'cards',
      cards: [
        { label: 'Total',       value: total.toLocaleString(),                       color: 'white'  },
        { label: 'Completed',   value: completed.toLocaleString(),                   color: 'green'  },
        { label: 'Pending',     value: (total - completed).toLocaleString(),         color: 'yellow' },
        { label: 'Rate',        value: `${rate}%`,                                   color: 'blue'   },
      ],
      meta: makeMeta('game_missions (collectionGroup)', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'game_missions collectionGroup'), meta: makeMeta('game_missions', 0, t0, 'ERROR') };
  }
}

// ── Find user ────────────────────────────────

async function cmdFindUser(name: string): Promise<DevAnswer> {
  const t0 = Date.now();
  if (!name.trim()) return { text: 'Usage: find user [player name]', type: 'info' };
  try {
    const snap = await getDocs(query(collection(db, 'users'), where('playerName', '==', name.trim()), limit(1)));
    if (snap.empty) return { text: `No user found with player name "${name}".`, meta: makeMeta('users', 0, t0) };
    const data = snap.docs[0].data();
    return {
      text: `Player found: ${data.playerName ?? name}`,
      type: 'cards',
      cards: [
        { label: 'Player Name',  value: data.playerName    ?? 'N/A',                  color: 'white'  },
        { label: 'Email',        value: data.email         || 'N/A',                  color: 'white'  },
        { label: 'Phone',        value: data.phoneNumber   || data.phone || 'N/A',    color: 'white'  },
        { label: 'Provider',     value: data.provider      ?? 'N/A',                  color: 'blue'   },
        { label: 'Role',         value: data.role          ?? 'user',                 color: data.role === 'developer' ? 'green' : 'white' },
        { label: 'Best Score',   value: (data.bestScore    ?? 0).toLocaleString(),    color: 'red'    },
        { label: 'Best Dist',    value: `${Math.round(data.bestDistance ?? 0)}m`,     color: 'yellow' },
        { label: 'Total Runs',   value: (data.totalRuns    ?? 0).toLocaleString(),    color: 'green'  },
        { label: 'Level',        value: `${data.level ?? 1} — ${data.currentStage ?? 'EGG'}`, color: 'purple' },
        { label: 'XP',           value: (data.xp           ?? 0).toLocaleString(),    color: 'blue'   },
        { label: 'UID',          value: (data.uid          ?? '').slice(0, 16) + '...', color: 'white' },
      ],
      meta: makeMeta('users', 1, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'users[playerName==' + name + ']'), meta: makeMeta('users', 0, t0, 'ERROR') };
  }
}

// ── COMPOUND COMMANDS ────────────────────────
// These run multiple Firestore queries in parallel and synthesize insights.

// Daily executive summary — "how are we doing today?"
async function cmdDailySummary(): Promise<DevAnswer> {
  const t0 = Date.now();
  const start = Timestamp.fromDate(startOfToday());

  const [newUsersSnap, activeSnap, leaderSnap, qrSnap, proteinSnap] = await Promise.allSettled([
    getDocs(query(collection(db, 'users'), where('createdAt', '>=', start))),
    getDocs(query(collection(db, 'users'), where('lastLogin',  '>=', start))),
    getDocs(query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(1))),
    getDocs(collection(db, 'qrCodes')),
    getDocs(query(collectionGroup(db, 'days'), where('date', '==', todayKey()))),
  ]);

  const newUsers  = newUsersSnap.status  === 'fulfilled' ? newUsersSnap.value.size  : null;
  const active    = activeSnap.status    === 'fulfilled' ? activeSnap.value.size    : null;
  const topPlayer = leaderSnap.status    === 'fulfilled' && !leaderSnap.value.empty ? leaderSnap.value.docs[0].data() : null;
  const qrDocs    = qrSnap.status        === 'fulfilled' ? qrSnap.value             : null;
  const protein   = proteinSnap.status   === 'fulfilled' ? proteinSnap.value        : null;

  let totalScans = 0;
  qrDocs?.forEach(d => { totalScans += d.data().playCount ?? 0; });

  let totalProtein = 0, proteinUsers = 0;
  protein?.forEach(d => { totalProtein += d.data().totalProtein ?? 0; proteinUsers++; });

  const cards: DevCard[] = [
    { label: 'New Users',    value: newUsers  !== null ? String(newUsers)  : 'N/A', color: 'blue'   },
    { label: 'Active Today', value: active    !== null ? String(active)    : 'N/A', color: 'green'  },
    { label: 'QR Scans',     value: String(totalScans),                             color: 'yellow' },
    { label: 'Top Score',    value: topPlayer ? (topPlayer.score ?? 0).toLocaleString() : 'N/A',    color: 'red'    },
    { label: 'Top Player',   value: topPlayer ? (topPlayer.playerName ?? 'Unknown') : 'N/A',        color: 'white'  },
    { label: 'Protein Users', value: proteinUsers > 0 ? String(proteinUsers)       : 'N/A',        color: 'purple' },
    { label: 'Total Protein', value: proteinUsers > 0 ? `${totalProtein.toFixed(0)}g` : 'N/A',    color: 'purple' },
  ];

  const errors = [newUsersSnap, activeSnap, leaderSnap, qrSnap, proteinSnap]
    .filter(r => r.status === 'rejected')
    .map(r => (r as PromiseRejectedResult).reason?.code ?? 'error');

  return {
    text: 'Today\'s Executive Summary',
    type: 'cards',
    cards,
    error: errors.length > 0 ? `${errors.length} query(ies) failed: ${errors.join(', ')}. Deploy rules + indexes if permission-denied.` : undefined,
    meta: makeMeta('users + leaderboard + qrCodes + daily_stats/days', cards.length, t0, errors.length > 0 ? 'PARTIAL' : '100%'),
  };
}

// "Anything wrong today?" — health check + anomaly scan
async function cmdAnomalyCheck(): Promise<DevAnswer> {
  const t0 = Date.now();
  const alerts: Array<{ label: string; detail: string; severity: 'warn' | 'ok' | 'error' }> = [];

  // Check each service
  const services = ['users', 'leaderboard', 'qrCodes', 'gameConfig', 'login_streaks'];
  const results = await Promise.allSettled(services.map(s => getDocs(query(collection(db, s), limit(1)))));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const code = (r.reason as { code?: string }).code ?? 'error';
      alerts.push({ label: services[i], detail: code === 'permission-denied' ? 'PERMISSION DENIED' : code.toUpperCase(), severity: 'error' });
    } else {
      alerts.push({ label: services[i], detail: 'Accessible', severity: 'ok' });
    }
  });

  // Check for suspicious scores (score > 1,000,000 is likely cheating)
  try {
    const high = await getDocs(query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(5)));
    high.forEach(d => {
      const score = d.data().score ?? 0;
      if (score > 999999) alerts.push({ label: 'Suspicious Score', detail: `${d.data().playerName}: ${score.toLocaleString()}`, severity: 'warn' });
    });
  } catch { /* ignore */ }

  const errors = alerts.filter(a => a.severity === 'error');
  const warnings = alerts.filter(a => a.severity === 'warn');
  const allOk = errors.length === 0 && warnings.length === 0;

  return {
    text: allOk
      ? 'No issues detected. All systems operational.'
      : `${errors.length} error(s), ${warnings.length} warning(s) detected.`,
    type: 'health',
    table: {
      headers: ['Check', 'Detail', 'Status'],
      rows: alerts.map(a => [a.label, a.detail, a.severity === 'ok' ? 'OK' : a.severity === 'warn' ? 'WARNING' : 'ERROR']),
    },
    meta: makeMeta('5 services + leaderboard', alerts.length, t0, allOk ? '100%' : 'PARTIAL'),
  };
}

// "Who are our best players?" — multi-dimension best players
async function cmdBestPlayers(): Promise<DevAnswer> {
  const t0 = Date.now();
  const [byScore, byXP, byEggs] = await Promise.allSettled([
    getDocs(query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(1))),
    getDocs(query(collection(db, 'users'), orderBy('xp', 'desc'), limit(1))),
    getDocs(query(collection(db, 'users'), orderBy('lifetimeConsumption', 'desc'), limit(1))),
  ]);

  const topScore  = byScore.status  === 'fulfilled' && !byScore.value.empty  ? byScore.value.docs[0].data()  : null;
  const topXP     = byXP.status     === 'fulfilled' && !byXP.value.empty     ? byXP.value.docs[0].data()     : null;
  const topEggs   = byEggs.status   === 'fulfilled' && !byEggs.value.empty   ? byEggs.value.docs[0].data()   : null;

  return {
    text: 'Best Players — Multi-Dimension Analysis',
    type: 'cards',
    cards: [
      { label: 'Highest Score', value: topScore ? String((topScore.score ?? 0).toLocaleString())                      : 'N/A', color: 'red',    sub: topScore?.playerName ?? 'N/A' },
      { label: 'Top XP',        value: topXP    ? `${(topXP.xp ?? 0).toLocaleString()} XP`                           : 'N/A', color: 'purple', sub: topXP?.playerName    ?? 'N/A' },
      { label: 'Most Eggs',     value: topEggs  ? String((topEggs.lifetimeConsumption ?? 0).toLocaleString())         : 'N/A', color: 'yellow', sub: topEggs?.playerName  ?? 'N/A' },
      { label: 'Best Distance', value: topScore ? `${Math.round(topScore.distance ?? 0)}m`                            : 'N/A', color: 'blue',   sub: topScore?.playerName ?? 'N/A' },
    ],
    meta: makeMeta('leaderboard + users', 3, t0),
  };
}

// Weekly summary
async function cmdWeeklySummary(): Promise<DevAnswer> {
  const t0 = Date.now();
  const start = Timestamp.fromDate(startOfWeek());

  const [newSnap, activeSnap, runSnap] = await Promise.allSettled([
    getDocs(query(collection(db, 'users'), where('createdAt', '>=', start))),
    getDocs(query(collection(db, 'users'), where('lastLogin',  '>=', start))),
    getDocs(query(collection(db, 'leaderboard'), limit(500))),
  ]);

  const newUsers  = newSnap.status    === 'fulfilled' ? newSnap.value.size    : null;
  const active    = activeSnap.status === 'fulfilled' ? activeSnap.value.size : null;
  let totalRuns = 0, totalScore = 0, maxScore = 0;
  if (runSnap.status === 'fulfilled') {
    runSnap.value.forEach(d => {
      totalRuns  += d.data().totalRuns ?? 0;
      totalScore += d.data().score     ?? 0;
      if ((d.data().score ?? 0) > maxScore) maxScore = d.data().score ?? 0;
    });
  }

  return {
    text: 'Weekly Summary — this week so far.',
    type: 'cards',
    cards: [
      { label: 'New Users',    value: newUsers !== null ? newUsers.toLocaleString()  : 'N/A', color: 'blue'   },
      { label: 'Active Users', value: active   !== null ? active.toLocaleString()    : 'N/A', color: 'green'  },
      { label: 'Total Runs',   value: totalRuns.toLocaleString(),                             color: 'red'    },
      { label: 'Top Score',    value: maxScore.toLocaleString(),                              color: 'yellow' },
      { label: 'Avg Score',    value: runSnap.status === 'fulfilled' && runSnap.value.size > 0 ? Math.round(totalScore / runSnap.value.size).toLocaleString() : 'N/A', color: 'white' },
    ],
    meta: makeMeta('users + leaderboard', (newUsers ?? 0) + (active ?? 0), t0, [newSnap, activeSnap, runSnap].every(r => r.status === 'fulfilled') ? '100%' : 'PARTIAL'),
  };
}

// Retention analysis — day 1/7/30 (requires enough historical data)
async function cmdRetentionAnalysis(): Promise<DevAnswer> {
  const t0 = Date.now();
  const now   = new Date();
  const day1  = new Date(now); day1.setDate(now.getDate() - 1);
  const day7  = new Date(now); day7.setDate(now.getDate() - 7);
  const day30 = new Date(now); day30.setDate(now.getDate() - 30);

  let totalUsersSnap;
  try {
    totalUsersSnap = await getDocs(collection(db, 'users'));
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'users'), meta: makeMeta('users', 0, t0, 'ERROR') };
  }

  const total = totalUsersSnap.size;
  if (total === 0) return { text: 'No users found.', meta: makeMeta('users', 0, t0) };

  let ret1 = 0, ret7 = 0, ret30 = 0;
  const oldestCreated = new Date(8640000000000000);
  totalUsersSnap.forEach(d => {
    const data = d.data();
    const login = data.lastLogin instanceof Timestamp ? data.lastLogin.toDate() : null;
    const created = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null;
    if (created && created < oldestCreated) oldestCreated.setTime(created.getTime());
    if (login && login >= day1)  ret1++;
    if (login && login >= day7)  ret7++;
    if (login && login >= day30) ret30++;
  });

  const daysSinceFirst = Math.round((now.getTime() - oldestCreated.getTime()) / 86400000);
  const notes: string[] = [];
  if (daysSinceFirst < 7)  notes.push('Less than 7 days of data — Day 7/30 retention not meaningful yet.');
  if (daysSinceFirst < 30) notes.push('Less than 30 days of data — Day 30 retention estimate only.');

  return {
    text: `Retention analysis across ${total} users. ${notes.join(' ')}`,
    type: 'cards',
    cards: [
      { label: 'Total Users',    value: total.toLocaleString(),                          color: 'white'  },
      { label: 'Day 1 Ret.',     value: `${((ret1  / total) * 100).toFixed(1)}%`,        color: 'green'  },
      { label: 'Day 7 Ret.',     value: daysSinceFirst >= 7  ? `${((ret7  / total) * 100).toFixed(1)}%` : 'Insufficient data', color: 'yellow' },
      { label: 'Day 30 Ret.',    value: daysSinceFirst >= 30 ? `${((ret30 / total) * 100).toFixed(1)}%` : 'Insufficient data', color: 'red'    },
      { label: 'Data Age',       value: `${daysSinceFirst} days`,                        color: 'blue'   },
    ],
    meta: makeMeta('users', total, t0, daysSinceFirst >= 30 ? '100%' : 'PARTIAL'),
  };
}

// QR management center
async function cmdQRManagement(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(collection(db, 'qrCodes'));
    if (snap.empty) return { text: 'No QR codes in database.', meta: makeMeta('qrCodes', 0, t0) };

    let totalScans = 0, exhausted = 0, totalCap = 0, mostUsed = { id: '', plays: 0 };
    snap.forEach(d => {
      const data = d.data();
      const plays = data.playCount ?? 0;
      const max   = data.maxPlays   ?? 999;
      totalScans += plays; totalCap += max;
      if (plays >= max) exhausted++;
      if (plays > mostUsed.plays) mostUsed = { id: d.id, plays };
    });

    return {
      text: `QR Management Center — ${snap.size} codes, ${totalScans.toLocaleString()} total scans.`,
      type: 'cards',
      cards: [
        { label: 'Total Codes',    value: snap.size.toLocaleString(),              color: 'white'  },
        { label: 'Total Scans',    value: totalScans.toLocaleString(),             color: 'green'  },
        { label: 'Active Codes',   value: (snap.size - exhausted).toLocaleString(), color: 'yellow' },
        { label: 'Exhausted',      value: exhausted.toLocaleString(),              color: 'red'    },
        { label: 'Remaining Cap.', value: (totalCap - totalScans).toLocaleString(), color: 'blue'  },
        { label: 'Most Used ID',   value: mostUsed.id.slice(0, 12) + '...',       color: 'purple', sub: `${mostUsed.plays} scans` },
      ],
      meta: makeMeta('qrCodes', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'qrCodes'), meta: makeMeta('qrCodes', 0, t0, 'ERROR') };
  }
}

// Game economy analysis
async function cmdGameEconomy(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'users'), limit(500)));
    if (snap.empty) return { text: 'No user data found.', meta: makeMeta('users', 0, t0) };

    let totalXP = 0, totalRuns = 0, maxXP = 0, maxLevel = 0;
    snap.forEach(d => {
      const data = d.data();
      totalXP   += data.xp         ?? 0;
      totalRuns += data.totalRuns  ?? 0;
      if ((data.xp    ?? 0) > maxXP)    maxXP    = data.xp    ?? 0;
      if ((data.level ?? 0) > maxLevel) maxLevel = data.level ?? 0;
    });
    const n = snap.size;

    return {
      text: `Game economy across ${n} player${n !== 1 ? 's' : ''}.`,
      type: 'cards',
      cards: [
        { label: 'Players',    value: n.toLocaleString(),                          color: 'white'  },
        { label: 'Total XP',   value: totalXP.toLocaleString(),                   color: 'purple' },
        { label: 'Avg XP',     value: Math.round(totalXP / n).toLocaleString(),   color: 'yellow' },
        { label: 'Max XP',     value: maxXP.toLocaleString(),                     color: 'red'    },
        { label: 'Total Runs', value: totalRuns.toLocaleString(),                  color: 'green'  },
        { label: 'Max Level',  value: String(maxLevel),                            color: 'blue'   },
      ],
      meta: makeMeta('users', n, t0, n >= 500 ? 'PARTIAL' : '100%'),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'users'), meta: makeMeta('users', 0, t0, 'ERROR') };
  }
}

// Cheater detection
async function cmdCheaterDetection(): Promise<DevAnswer> {
  const t0 = Date.now();
  try {
    const snap = await getDocs(query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(50)));
    if (snap.empty) return { text: 'No leaderboard data.', meta: makeMeta('leaderboard', 0, t0) };

    const suspicious: string[][] = [];
    snap.forEach(d => {
      const data = d.data();
      const score = data.score ?? 0;
      const dist  = data.distance ?? 0;
      const runs  = data.totalRuns ?? 1;
      // Flag: impossibly high score (>500k), or score/distance ratio > 5000 (unrealistic)
      const ratio = dist > 0 ? score / dist : 0;
      if (score > 500000 || ratio > 5000) {
        suspicious.push([
          data.playerName ?? 'Unknown',
          score.toLocaleString(),
          `${Math.round(dist)}m`,
          String(runs),
          score > 500000 ? 'SCORE TOO HIGH' : 'ABNORMAL RATIO',
        ]);
      }
    });

    if (suspicious.length === 0) {
      return {
        text: `No suspicious activity detected in top 50 players.`,
        type: 'info',
        cards: [{ label: 'Status', value: 'CLEAN', color: 'green', sub: 'Top 50 analyzed' }],
        meta: makeMeta('leaderboard', snap.size, t0),
      };
    }

    return {
      text: `${suspicious.length} suspicious player(s) detected.`,
      type: 'table',
      table: { headers: ['Player', 'Score', 'Distance', 'Runs', 'Flag'], rows: suspicious },
      meta: makeMeta('leaderboard', snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'leaderboard'), meta: makeMeta('leaderboard', 0, t0, 'ERROR') };
  }
}

// Show raw collection documents (live Firebase inspector)
async function cmdShowCollection(colName: string): Promise<DevAnswer> {
  const t0 = Date.now();
  const ALLOWED = ['users','leaderboard','qrCodes','gameConfig','login_streaks','daily_stats','tracker_settings','protein_logs','daily_missions'];
  if (!ALLOWED.includes(colName)) {
    return {
      text: `Collection "${colName}" is not available for inspection.`,
      error: `Allowed collections: ${ALLOWED.join(', ')}`,
      type: 'info',
    };
  }
  try {
    const snap = await getDocs(query(collection(db, colName), limit(10)));
    if (snap.empty) return { text: `Collection "${colName}" is empty.`, meta: makeMeta(colName, 0, t0) };

    const firstDoc = snap.docs[0].data();
    const headers = Object.keys(firstDoc).slice(0, 5); // show first 5 fields
    const rows = snap.docs.map(d => {
      const data = d.data();
      return headers.map(h => {
        const v = data[h];
        if (v instanceof Timestamp) return v.toDate().toLocaleDateString('en-IN');
        if (typeof v === 'object' && v !== null) return '[object]';
        return String(v ?? '').slice(0, 30);
      });
    });

    return {
      text: `Collection: ${colName} — first ${snap.size} documents (${headers.length} fields shown).`,
      type: 'table',
      table: { headers: ['#', ...headers], rows: rows.map((r, i) => [String(i + 1), ...r]) },
      meta: makeMeta(colName, snap.size, t0),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, colName), meta: makeMeta(colName, 0, t0, 'ERROR') };
  }
}

// Protein tracker insights
async function cmdProteinInsights(): Promise<DevAnswer> {
  const t0 = Date.now();
  const today = todayKey();
  try {
    const [todaySnap, topSnap] = await Promise.allSettled([
      getDocs(query(collectionGroup(db, 'days'), where('date', '==', today))),
      getDocs(query(collection(db, 'users'), orderBy('lifetimeConsumption', 'desc'), limit(5))),
    ]);

    const todayData  = todaySnap.status  === 'fulfilled' ? todaySnap.value  : null;
    const topData    = topSnap.status    === 'fulfilled' ? topSnap.value    : null;

    let totalProtein = 0, goalsHit = 0, loggers = 0;
    todayData?.forEach(d => {
      loggers++;
      totalProtein += d.data().totalProtein ?? 0;
      if ((d.data().totalProtein ?? 0) >= (d.data().dailyGoal ?? 60)) goalsHit++;
    });

    const cards: DevCard[] = [
      { label: 'Loggers Today',  value: loggers > 0 ? loggers.toLocaleString()         : 'N/A', color: 'green'  },
      { label: 'Total Protein',  value: loggers > 0 ? `${totalProtein.toFixed(0)}g`    : 'N/A', color: 'red'    },
      { label: 'Avg Per User',   value: loggers > 0 ? `${(totalProtein/loggers).toFixed(0)}g` : 'N/A', color: 'yellow' },
      { label: 'Goal Hit Rate',  value: loggers > 0 ? `${((goalsHit/loggers)*100).toFixed(0)}%` : 'N/A', color: 'blue' },
    ];

    if (topData && !topData.empty) {
      const top = topData.docs[0].data();
      cards.push({ label: 'Top Consumer', value: top.playerName ?? 'Unknown', color: 'purple', sub: `${(top.lifetimeConsumption ?? 0)} eggs lifetime` });
    }

    return {
      text: `Protein Tracker Insights — today (${today}).`,
      type: 'cards',
      cards,
      meta: makeMeta('daily_stats/days + users', loggers, t0, [todaySnap, topSnap].every(r => r.status === 'fulfilled') ? '100%' : 'PARTIAL'),
    };
  } catch (err: unknown) {
    return { text: 'Query failed.', error: classifyError(err, 'daily_stats'), meta: makeMeta('daily_stats', 0, t0, 'ERROR') };
  }
}

// ── Help ─────────────────────────────────────

function cmdHelp(): DevAnswer {
  return {
    text: 'DEV Command Reference',
    type: 'info',
    table: {
      headers: ['Category', 'Commands'],
      rows: [
        ['Diagnostics', 'diagnostic / system health / grant dev access'],
        ['Users',       'new users today / total users / active users / active this week'],
        ['Scores',      'highest score / top players / average score / total runs'],
        ['QR',          'qr stats / top qr codes'],
        ['Config',      'show config / developer config'],
        ['Streaks',     'streak stats / streak leaders'],
        ['Protein',     'protein today / egg consumption'],
        ['Missions',    'mission stats'],
        ['Find',        'find user [player name]'],
      ],
    },
  };
}

// ─────────────────────────────────────────────
// COMMAND REGISTRY
// Ordered by specificity — first match wins.
// ─────────────────────────────────────────────

interface CommandEntry {
  id: string;
  patterns: RegExp[];
  handler: (q: string) => Promise<DevAnswer> | DevAnswer;
  suggestions?: string[]; // follow-up commands shown after this answer
}

const COMMANDS: CommandEntry[] = [
  // Grant dev access
  { id: 'grant_dev', patterns: [/grant\s+dev/i, /set\s+developer\s+role/i, /make\s+me\s+developer/i, /activate\s+dev/i],
    handler: () => cmdGrantDevAccess(),
    suggestions: ['diagnostic', 'system health', 'new users today'] },

  // Diagnostic
  { id: 'diagnostic', patterns: [/\bdiagnostic\b/i, /permission\s+(check|test)/i, /\bwho\s+am\s+i\b/i, /\bmy\s+role\b/i, /\bdev\s+access\b/i],
    handler: () => cmdDiagnostic(),
    suggestions: ['system health', 'new users today', 'show config'] },

  // Compound: daily summary
  { id: 'daily_summary', patterns: [/how\s+are\s+we\s+doing/i, /today.*summary/i, /summary.*today/i, /daily\s+summary/i, /executive\s+summary/i, /overview\s+today/i, /what.*happening\s+today/i, /status\s+today/i, /today.*overview/i],
    handler: () => cmdDailySummary(),
    suggestions: ['active users', 'highest score', 'system health', 'qr stats'] },

  // Compound: anomaly check
  { id: 'anomaly', patterns: [/anything\s+(wrong|broken|failing|bad)/i, /problems?\s+today/i, /issues?\s+today/i, /errors?\s+today/i, /alerts?\s+today/i, /what.*wrong/i, /check.*issues/i],
    handler: () => cmdAnomalyCheck(),
    suggestions: ['system health', 'cheater detection', 'diagnostic'] },

  // Compound: best players
  { id: 'best_players', patterns: [/best\s+players?/i, /who.*best\s+player/i, /top\s+performers?/i, /who.*our\s+(top|best)/i, /champion/i, /mvp/i],
    handler: () => cmdBestPlayers(),
    suggestions: ['top players', 'highest score', 'leaderboard'] },

  // Weekly summary
  { id: 'weekly_summary', patterns: [/weekly\s+summary/i, /this\s+week\s+summary/i, /week.*overview/i, /how.*week/i, /week.*doing/i],
    handler: () => cmdWeeklySummary(),
    suggestions: ['active users', 'total users', 'total runs'] },

  // Retention analysis
  { id: 'retention', patterns: [/retention/i, /why.*users?\s+(leav|drop|churn|quit)/i, /users?\s+leaving/i, /users?\s+dropping/i, /churn/i, /day\s+[137]\s+retention/i],
    handler: () => cmdRetentionAnalysis(),
    suggestions: ['streak stats', 'active users', 'daily summary'] },

  // QR management
  { id: 'qr_management', patterns: [/qr\s+management/i, /qr\s+center/i, /manage\s+qr/i, /qr\s+overview/i],
    handler: () => cmdQRManagement(),
    suggestions: ['top qr codes', 'qr stats', 'system health'] },

  // Game economy
  { id: 'economy', patterns: [/game\s+economy/i, /economy\s+analysis/i, /xp\s+stats/i, /xp\s+earned/i, /coins?\s+earned/i, /rewards?\s+claimed/i],
    handler: () => cmdGameEconomy(),
    suggestions: ['top players', 'mission stats', 'highest score'] },

  // Cheater detection
  { id: 'cheater', patterns: [/cheat/i, /suspicious/i, /abnormal\s+score/i, /hack/i, /exploit/i, /impossibl/i, /fake\s+score/i],
    handler: () => cmdCheaterDetection(),
    suggestions: ['top players', 'highest score', 'system health'] },

  // Show collection (Firebase inspector)
  { id: 'show_col', patterns: [/show\s+collection\s+(\w+)/i, /inspect\s+(\w+)/i, /browse\s+(\w+)/i, /open\s+collection\s+(\w+)/i],
    handler: (q) => {
      const m = q.match(/(?:show\s+collection|inspect|browse|open\s+collection)\s+(\w+)/i);
      return cmdShowCollection(m ? m[1].toLowerCase() : '');
    },
    suggestions: ['system health', 'total users', 'diagnostic'] },

  // Protein insights
  { id: 'protein_insights', patterns: [/protein\s+insights?/i, /protein\s+overview/i, /protein\s+tracker\s+insights?/i, /nutrition\s+overview/i, /protein\s+analysis/i],
    handler: () => cmdProteinInsights(),
    suggestions: ['egg consumption', 'streak stats', 'active users'] },

  // Find user
  { id: 'find_user', patterns: [/^find\s+user\s+(.+)$/i, /^search\s+user\s+(.+)$/i, /^player\s+named?\s+(.+)$/i, /^lookup\s+(.+)$/i],
    handler: (q) => { const m = q.match(/(?:find|search)\s+user\s+(.+)|player\s+named?\s+(.+)|lookup\s+(.+)/i); return cmdFindUser(m ? (m[1]||m[2]||m[3]||'').trim() : ''); },
    suggestions: ['top players', 'leaderboard', 'total users'] },

  // System health
  { id: 'health', patterns: [/system\s+health/i, /service\s+status/i, /firebase\s+health/i, /db\s+health/i, /\bhealth\b/i, /is\s+firebase/i, /database\s+status/i, /is\s+(everything|all)\s+(ok|fine|working)/i],
    handler: () => cmdSystemHealth(),
    suggestions: ['diagnostic', 'show config', 'anomaly check'] },

  // User analytics
  { id: 'new_users_today', patterns: [/new\s+users?\s+today/i, /users?\s+joined\s+today/i, /joined\s+today/i, /registered\s+today/i, /signups?\s+today/i, /today.*new\s+users?/i, /today.*registrations?/i, /users?\s+added\s+today/i, /people\s+signed\s+up/i, /new\s+accounts?\s+today/i, /new\s+members?\s+today/i],
    handler: () => cmdNewUsersToday(),
    suggestions: ['total users', 'active users', 'daily summary'] },

  { id: 'active_week', patterns: [/active\s+(users?|players?)\s+(this\s+)?week/i, /weekly\s+active/i, /\bwau\b/i, /users?\s+this\s+week/i],
    handler: () => cmdActiveUsersWeek(),
    suggestions: ['weekly summary', 'active users', 'new users today'] },

  { id: 'active_today', patterns: [/active\s+(users?|players?)/i, /played\s+today/i, /\bdau\b/i, /online\s+today/i, /users?\s+online/i, /how\s+many.*play/i, /players?\s+today/i],
    handler: () => cmdActiveUsersToday(),
    suggestions: ['daily summary', 'new users today', 'total users'] },

  { id: 'total_users', patterns: [/total\s+users?/i, /how\s+many\s+users?/i, /user\s+count/i, /registered\s+users?/i, /all\s+users?/i, /number\s+of\s+users?/i, /how\s+large.*user\s+base/i],
    handler: () => cmdTotalUsers(),
    suggestions: ['new users today', 'active users', 'retention'] },

  // Game analytics
  { id: 'top_players', patterns: [/top\s+(10\s+)?players?/i, /\bleaderboard\b/i, /rankings?/i, /show.*leaderboard/i, /player\s+list/i, /who.*play/i, /show.*players?/i],
    handler: () => cmdTopPlayers(),
    suggestions: ['highest score', 'average score', 'best players'] },

  { id: 'highest_score', patterns: [/highest\s+score/i, /top\s+score/i, /best\s+score/i, /max\s+score/i, /record\s+score/i, /who\s+scored/i, /today.*winner/i, /score\s+record/i],
    handler: () => cmdHighestScore(),
    suggestions: ['top players', 'average score', 'cheater detection'] },

  { id: 'avg_score', patterns: [/average\s+score/i, /avg\s+score/i, /score\s+stats/i, /mean\s+score/i, /score\s+average/i],
    handler: () => cmdAverageScore(),
    suggestions: ['highest score', 'total runs', 'game economy'] },

  { id: 'total_runs', patterns: [/total\s+runs?/i, /how\s+many\s+runs?/i, /games?\s+played/i, /play\s+count/i, /session\s+count/i, /total\s+sessions?/i],
    handler: () => cmdTotalRuns(),
    suggestions: ['average score', 'game economy', 'active users'] },

  // QR
  { id: 'top_qr', patterns: [/top\s+qr/i, /most\s+scanned/i, /popular\s+qr/i, /qr\s+leaders?/i],
    handler: () => cmdTopQRCodes(),
    suggestions: ['qr stats', 'qr management', 'system health'] },

  { id: 'qr_stats', patterns: [/qr\s+(stats?|codes?|analytics?|report|data)/i, /scan\s+(stats?|count|report)/i, /\bqr\b/i, /\bscans?\b/i, /qr\s+usage/i],
    handler: () => cmdQRStats(),
    suggestions: ['top qr codes', 'qr management', 'active users'] },

  // Streaks
  { id: 'streak_leaders', patterns: [/streak\s+leaders?/i, /top\s+streaks?/i, /best\s+streaks?/i, /longest\s+streak/i],
    handler: () => cmdStreakLeaders(),
    suggestions: ['streak stats', 'retention', 'active users'] },

  { id: 'streak_stats', patterns: [/streak\s+(stats?|analytics?|report|data)/i, /\bstreaks?\b/i, /streak\s+analysis/i, /broken\s+streak/i],
    handler: () => cmdStreakStats(),
    suggestions: ['streak leaders', 'retention', 'daily summary'] },

  // Protein
  { id: 'egg_consumption', patterns: [/egg\s+consump/i, /eggs?\s+eaten/i, /eggs?\s+consumed/i, /top\s+consumers?/i, /egg\s+tracking/i],
    handler: () => cmdEggConsumption(),
    suggestions: ['protein today', 'protein insights', 'total users'] },

  { id: 'protein_today', patterns: [/protein\s+(today|stats?|report|tracker|data|log)/i, /daily\s+protein/i, /nutrition\s+today/i, /protein\s+intake/i, /food\s+logged/i],
    handler: () => cmdProteinToday(),
    suggestions: ['protein insights', 'egg consumption', 'active users'] },

  // Missions
  { id: 'missions', patterns: [/mission\s+(stats?|completion|rate|report|data)/i, /\bmissions?\b/i, /task\s+completion/i, /challenge\s+completion/i],
    handler: () => cmdMissionStats(),
    suggestions: ['game economy', 'active users', 'streak stats'] },

  // Config
  { id: 'config', patterns: [/(dev|developer)\s+config/i, /show\s+config/i, /current\s+config/i, /live\s+config/i, /traffic\s+config/i, /spawn\s+config/i, /\bconfig\b/i, /game\s+settings/i, /spawn\s+rate/i, /traffic\s+rate/i],
    handler: () => cmdDevConfig(),
    suggestions: ['system health', 'anomaly check', 'diagnostic'] },

  // Help
  { id: 'help', patterns: [/\bhelp\b/i, /what\s+can/i, /\bcommands?\b/i, /how\s+to\s+use/i, /what\s+do\s+you\s+know/i, /capabilities/i],
    handler: () => cmdHelp() },
];

// ─────────────────────────────────────────────
// INTENT ENGINE
// 5-stage pipeline:
//   1. Regex (exact command patterns — fastest, most precise)
//   2. Keyword scoring (bag-of-words overlap)
//   3. Fuzzy suggestion (if nothing scores well)
// ─────────────────────────────────────────────

// STOP_WORDS, tokenize, levenshtein imported from utils/textHelpers

// Keyword map: each entry defines signal words for an intent
// cmdIndex maps to the COMMANDS array (0-based, ordered as declared above)
interface IntentDef {
  label: string;
  keywords: string[];
  cmdIndex: number;
}

// COMMANDS array position map (0-based):
// 0=grant_dev  1=diagnostic  2=daily_summary  3=anomaly  4=best_players
// 5=weekly_summary  6=retention  7=qr_management  8=economy  9=cheater
// 10=show_col  11=protein_insights  12=find_user  13=health
// 14=new_users_today  15=active_week  16=active_today  17=total_users
// 18=top_players  19=highest_score  20=avg_score  21=total_runs
// 22=top_qr  23=qr_stats  24=streak_leaders  25=streak_stats
// 26=egg_consumption  27=protein_today  28=missions  29=config  30=help

const INTENT_LIBRARY: IntentDef[] = [
  { label: 'Grant Dev Access',       keywords: ['grant','dev','access','role','developer','activate','enable','make','set'],       cmdIndex: 0 },
  { label: 'Diagnostic / My Role',   keywords: ['diagnostic','permission','who','role','status','access','check','verify','test'], cmdIndex: 1 },
  { label: 'Daily Summary',          keywords: ['summary','overview','doing','today','executive','dashboard','status'],            cmdIndex: 2 },
  { label: 'Anomaly Check',          keywords: ['wrong','broken','failing','problems','issues','errors','alerts','bad'],           cmdIndex: 3 },
  { label: 'Best Players',           keywords: ['best','players','top','performers','champion','mvp','our'],                       cmdIndex: 4 },
  { label: 'Weekly Summary',         keywords: ['week','weekly','summary','overview','doing'],                                     cmdIndex: 5 },
  { label: 'Retention Analysis',     keywords: ['retention','leaving','dropping','churn','quit','day','return'],                   cmdIndex: 6 },
  { label: 'QR Management',          keywords: ['qr','management','manage','center','overview'],                                   cmdIndex: 7 },
  { label: 'Game Economy',           keywords: ['economy','xp','coins','rewards','earned','claimed','level'],                     cmdIndex: 8 },
  { label: 'Cheater Detection',      keywords: ['cheat','suspicious','abnormal','hack','exploit','impossible','fake'],             cmdIndex: 9 },
  { label: 'Browse Collection',      keywords: ['collection','browse','inspect','open','show','documents'],                       cmdIndex: 10 },
  { label: 'Protein Insights',       keywords: ['protein','insights','overview','analysis','nutrition'],                          cmdIndex: 11 },
  { label: 'Find User',              keywords: ['find','search','lookup','player','user','named','name'],                         cmdIndex: 12 },
  { label: 'System Health',          keywords: ['system','health','service','firebase','database','db','online','offline','status','firestore','connection'], cmdIndex: 13 },
  { label: 'New Users Today',        keywords: ['new','user','users','today','joined','signup','signups','registration','registrations','added','people','members','accounts','created'], cmdIndex: 14 },
  { label: 'Active Users This Week', keywords: ['active','users','players','week','weekly','wau','seven','days'],                 cmdIndex: 15 },
  { label: 'Active Users Today',     keywords: ['active','users','players','today','online','dau','daily','playing','played','logged','visited','sessions'], cmdIndex: 16 },
  { label: 'Total Users',            keywords: ['total','all','users','registered','count','many','number','accounts','members','entire'], cmdIndex: 17 },
  { label: 'Top Players / Leaderboard', keywords: ['top','players','leaderboard','rankings','rank','leaders','winners','list'],  cmdIndex: 18 },
  { label: 'Highest Score',          keywords: ['highest','score','best','top','max','record','winner','champion','scored'],      cmdIndex: 19 },
  { label: 'Average Score',          keywords: ['average','avg','mean','score','stats','statistics'],                             cmdIndex: 20 },
  { label: 'Total Runs / Plays',     keywords: ['total','runs','plays','games','played','sessions','times'],                     cmdIndex: 21 },
  { label: 'Top QR Codes',           keywords: ['top','qr','codes','popular','most','scanned'],                                  cmdIndex: 22 },
  { label: 'QR Statistics',          keywords: ['qr','scan','scans','code','codes','analytics','stats','usage','invalid','remaining'], cmdIndex: 23 },
  { label: 'Streak Leaders',         keywords: ['streak','leaders','top','best','longest','highest'],                            cmdIndex: 24 },
  { label: 'Streak Statistics',      keywords: ['streak','streaks','stats','statistics','average','broken','retention','days'],  cmdIndex: 25 },
  { label: 'Egg Consumption',        keywords: ['egg','eggs','consumption','consumed','eaten','eat','food','protein','top','consumers'], cmdIndex: 26 },
  { label: 'Protein Today',          keywords: ['protein','today','nutrition','daily','food','tracker','log','intake','grams','diet'], cmdIndex: 27 },
  { label: 'Mission Stats',          keywords: ['mission','missions','task','tasks','completion','complete','rate','progress'],  cmdIndex: 28 },
  { label: 'Developer Config',       keywords: ['config','configuration','settings','traffic','obstacle','spawn','feed','speed','evolution','developer','live','current','values'], cmdIndex: 29 },
  { label: 'Help / Commands',        keywords: ['help','commands','command','list','available','options','usage','examples'],    cmdIndex: 30 },
];

// tokenize and levenshtein imported from utils/textHelpers

// Score a query against one intent definition
function scoreIntent(queryTokens: string[], intent: IntentDef): number {
  let score = 0;
  for (const qt of queryTokens) {
    for (const kw of intent.keywords) {
      if (qt === kw) { score += 3; continue; }               // exact match
      if (kw.startsWith(qt) || qt.startsWith(kw)) { score += 2; continue; } // prefix
      if (qt.length >= 4 && kw.length >= 4 && levenshtein(qt, kw) <= 1) score += 1; // fuzzy (1 edit)
    }
  }
  // Bonus: number of distinct keyword categories hit
  const hit = new Set(queryTokens.filter(t => intent.keywords.includes(t)));
  score += hit.size * 0.5;
  return score;
}

// ─────────────────────────────────────────────
// SESSION CONTEXT MEMORY
// Tracks what the last query was about so follow-up questions
// like "what about yesterday?" can be understood in context.
// Scoped to the module — resets when page reloads.
// ─────────────────────────────────────────────

interface SessionContext {
  lastCommandId: string;       // e.g. 'new_users_today'
  lastSubject: string;         // e.g. 'users', 'scores', 'qr'
  lastQuestion: string;
}

let _sessionCtx: SessionContext = { lastCommandId: '', lastSubject: '', lastQuestion: '' };

function subjectOf(commandId: string): string {
  if (['new_users_today','active_today','active_week','total_users','retention'].includes(commandId)) return 'users';
  if (['top_players','highest_score','avg_score','total_runs','best_players','cheater'].includes(commandId)) return 'scores';
  if (['qr_stats','top_qr','qr_management'].includes(commandId)) return 'qr';
  if (['protein_today','egg_consumption','protein_insights'].includes(commandId)) return 'protein';
  if (['streak_stats','streak_leaders'].includes(commandId)) return 'streaks';
  if (['config'].includes(commandId)) return 'config';
  if (['health','anomaly','diagnostic'].includes(commandId)) return 'health';
  return 'general';
}

// Context-aware query resolution: map pronouns / references to concrete commands
function resolveContext(q: string, ctx: SessionContext): string | null {
  const lower = q.toLowerCase().trim();
  // "what about yesterday?" / "and yesterday?" / "yesterday?"
  if (/yesterday/.test(lower)) {
    if (ctx.lastSubject === 'users') return 'new users today'; // best proxy (yesterday data not separately stored)
    if (ctx.lastSubject === 'scores') return 'highest score';
  }
  // "and the same for this week?" / "weekly?"
  if (/this\s+week|weekly/.test(lower) && ctx.lastSubject === 'users') return 'active users this week';
  // "compare" — show summary
  if (/compar/.test(lower)) return 'daily summary';
  // "tell me more" / "more details" / "expand"
  if (/more\s+detail|expand|tell\s+me\s+more/.test(lower)) return ctx.lastCommandId.replace(/_/g, ' ');
  return null;
}

// ─────────────────────────────────────────────
// MULTI-INTENT DETECTION
// Detects "and" / "also" / "+" queries and runs both handlers
// ─────────────────────────────────────────────

function splitMultiIntent(q: string): string[] | null {
  // "how many users today AND what is the highest score?"
  const parts = q.split(/\s+and\s+also\s+|\s+and\s+|\s+also\s+|\s*\+\s*|\s*,\s+/i).map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

// ─────────────────────────────────────────────
// CORE MATCHER
// Returns the matched CommandEntry + adds suggestions to answer
// ─────────────────────────────────────────────

async function matchAndRun(q: string): Promise<DevAnswer | null> {
  // Stage 1: regex
  for (const cmd of COMMANDS) {
    if (cmd.patterns.some(p => p.test(q))) {
      const answer = await cmd.handler(q);
      // Attach suggestions from registry
      if (cmd.suggestions && cmd.suggestions.length > 0) {
        answer.suggestions = cmd.suggestions;
      }
      // Update session context
      _sessionCtx = { lastCommandId: cmd.id, lastSubject: subjectOf(cmd.id), lastQuestion: q };
      return answer;
    }
  }

  // Stage 2: keyword scoring
  const tokens = tokenize(q);
  if (tokens.length > 0) {
    const scored = INTENT_LIBRARY.map(intent => ({
      intent,
      score: scoreIntent(tokens, intent),
    })).sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best.score >= 2) {
      const cmd = COMMANDS[best.intent.cmdIndex];
      if (cmd) {
        const answer = await cmd.handler(q);
        if (cmd.suggestions) answer.suggestions = cmd.suggestions;
        _sessionCtx = { lastCommandId: cmd.id, lastSubject: subjectOf(cmd.id), lastQuestion: q };
        return answer;
      }
    }

    // Stage 3: suggest alternatives
    const alts = scored.filter(s => s.score >= 1).slice(0, 3).map(s => s.intent.label);
    if (alts.length > 0) {
      return {
        text: `Not sure what you mean by "${q}". Did you mean:`,
        type: 'info',
        cards: alts.map((s, i) => ({
          label: `Option ${i + 1}`,
          value: s,
          color: (['yellow', 'blue', 'white'] as const)[i] ?? 'white',
        })),
        suggestions: alts,
      };
    }
  }

  return null;
}

// ─────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────

export async function runDevQuery(question: string): Promise<DevAnswer> {
  const q = question.trim();
  if (!q) return { text: 'Enter a command. Type "help" to see commands or tap a quick action above.' };

  // Context resolution first (e.g. "what about yesterday?")
  const contextResolved = resolveContext(q, _sessionCtx);
  if (contextResolved) {
    const resolved = await matchAndRun(contextResolved);
    if (resolved) {
      resolved.text = `[Context: "${q}" → ${contextResolved}] ${resolved.text}`;
      return resolved;
    }
  }

  // Multi-intent detection: "users today and highest score"
  const parts = splitMultiIntent(q);
  if (parts && parts.length === 2) {
    const [r1, r2] = await Promise.all([matchAndRun(parts[0]), matchAndRun(parts[1])]);
    if (r1 && r2) {
      // Merge: combine cards from both answers
      return {
        text: `${r1.text} | ${r2.text}`,
        type: 'cards',
        cards: [...(r1.cards ?? []), ...(r2.cards ?? [])],
        suggestions: [...new Set([...(r1.suggestions ?? []), ...(r2.suggestions ?? [])])].slice(0, 4),
        meta: r1.meta,
      };
    }
  }

  // Single intent
  const result = await matchAndRun(q);
  if (result) return result;

  // Stage 4: fallback to help
  return { ...cmdHelp(), text: `No match for "${q}". Here are all available commands:` };
}

/**
 * Run the daily executive summary — used as the DEV home screen
 * when the tab opens. No question required.
 */
export async function runDailySummary(): Promise<DevAnswer> {
  const answer = await cmdDailySummary();
  answer.suggestions = ['active users', 'highest score', 'system health', 'qr stats', 'streak stats'];
  return answer;
}

export const QUICK_COMMANDS = [
  { label: 'Diagnostic',    cmd: 'diagnostic'        },
  { label: 'Users Today',   cmd: 'new users today'   },
  { label: 'Top Players',   cmd: 'top players'       },
  { label: 'Highest Score', cmd: 'highest score'     },
  { label: 'QR Stats',      cmd: 'qr stats'          },
  { label: 'System Health', cmd: 'system health'     },
  { label: 'Streak Stats',  cmd: 'streak stats'      },
  { label: 'Protein Today', cmd: 'protein today'     },
  { label: 'Dev Config',    cmd: 'show config'       },
  { label: 'Leaderboard',   cmd: 'leaderboard'       },
] as const;
