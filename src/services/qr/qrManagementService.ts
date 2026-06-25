import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getCountFromServer,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type {
  QRCodeRecord,
  QRDashboardStats,
  QRCodeType,
  QRSearchFilters,
  QRAnalyticsData,
} from '../../types/qr/qrManagementTypes';

const COLLECTION = 'qrCodes';
const BASE_URL   = 'https://skm-egg-runner.vercel.app';

function buildCode(prefix: string, index: number): string {
  return `${prefix.toUpperCase()}-${String(index).padStart(6, '0')}`;
}

function buildURL(code: string): string {
  return `${BASE_URL}/?qr=${code}`;
}

function getBatchId(): string {
  return `BATCH-${Date.now()}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Dashboard Stats ────────────────────────────────────────────────────────────

export const EMPTY_STATS: QRDashboardStats = {
  totalGenerated: 0, activeQR: 0, disabledQR: 0,
  goldenQR: 0, developerQR: 0,
  scannedToday: 0, scannedThisWeek: 0, scannedThisMonth: 0,
  unusedQR: 0, lastSync: '',
};

/** Compute stats from a raw Firestore snapshot (used by both one-shot fetch and live listener) */
export function computeStatsFromSnap(snap: { forEach: (fn: (d: any) => void) => void; size: number }): QRDashboardStats {
  const today    = todayStr();
  const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const weekStr  = weekAgo.toISOString().slice(0, 10);
  const monthStr = monthAgo.toISOString().slice(0, 10);

  let totalGenerated = 0, activeQR = 0, disabledQR = 0;
  let goldenQR = 0, developerQR = 0, unusedQR = 0;
  let scannedToday = 0, scannedThisWeek = 0, scannedThisMonth = 0;

  console.log('[QR Dashboard] Computing stats from', snap.size, 'documents');

  snap.forEach(d => {
    const data       = d.data();
    const isActive:  boolean = data.active    ?? true;
    const playCount: number  = data.playCount ?? 0;
    const maxPlays:  number  = data.maxPlays  ?? 2;
    const typeLower: string  = (data.type ?? '').toLowerCase();

    totalGenerated++;

    // Active = active flag true AND not yet exhausted
    if (!isActive || playCount >= maxPlays) {
      disabledQR++;
    } else {
      activeQR++;
    }

    if (typeLower === 'golden')    goldenQR++;
    if (typeLower === 'developer') developerQR++;
    if (playCount === 0)           unusedQR++;

    // dailyScans map: { "YYYY-MM-DD": count }
    const dailyMap: Record<string, number> = data.dailyScans ?? {};

    // Today
    scannedToday += dailyMap[today] ?? 0;

    // This week + this month — sum all matching date keys
    Object.entries(dailyMap).forEach(([dateKey, count]) => {
      if (dateKey >= weekStr)  scannedThisWeek  += count;
      if (dateKey >= monthStr) scannedThisMonth += count;
    });
  });

  const lastSync = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  console.log('[QR Dashboard] totalGenerated:', totalGenerated);
  console.log('[QR Dashboard] activeQR:', activeQR, '| disabledQR:', disabledQR);
  console.log('[QR Dashboard] goldenQR:', goldenQR, '| developerQR:', developerQR);
  console.log('[QR Dashboard] unusedQR:', unusedQR);
  console.log('[QR Dashboard] scannedToday:', scannedToday, '| thisWeek:', scannedThisWeek, '| thisMonth:', scannedThisMonth);
  console.log('[QR Dashboard] lastSync:', lastSync);

  return { totalGenerated, activeQR, disabledQR, goldenQR, developerQR, unusedQR, scannedToday, scannedThisWeek, scannedThisMonth, lastSync };
}

export async function fetchDashboardStats(): Promise<QRDashboardStats> {
  console.log('[QR Dashboard] One-shot fetch from collection:', COLLECTION);
  const snap = await getDocs(collection(db, COLLECTION));
  return computeStatsFromSnap(snap);
}

/** Subscribe to live dashboard stats. Calls onChange whenever any QR doc changes. */
export function subscribeDashboardStats(onChange: (stats: QRDashboardStats) => void): Unsubscribe {
  console.log('[QR Dashboard] Starting live onSnapshot listener on:', COLLECTION);
  return onSnapshot(collection(db, COLLECTION), (snap) => {
    console.log('[QR Dashboard] onSnapshot fired — docs:', snap.size);
    onChange(computeStatsFromSnap(snap));
  }, (err) => {
    console.error('[QR Dashboard] onSnapshot error:', err?.message);
  });
}

// ── Generate QR Codes ──────────────────────────────────────────────────────────

export interface GeneratedQR { code: string; url: string; }

export async function generateQRCodes(
  prefix: string,
  quantity: number,
  maxPlays: number,
  type: QRCodeType,
): Promise<GeneratedQR[]> {
  const batch = writeBatch(db);
  const batchId = getBatchId();
  const codes: GeneratedQR[] = [];

  // Find highest existing index for this prefix to avoid duplicates
  const existing = await getDocs(
    query(collection(db, COLLECTION), where('prefix', '==', prefix.toUpperCase()))
  );
  let startIndex = existing.size + 1;

  // Golden QR codes get unlimited plays
  const effectiveMaxPlays = type === 'Golden' ? 999999 : maxPlays;

  for (let i = 0; i < quantity; i++) {
    const code = buildCode(prefix, startIndex + i);
    const url  = buildURL(code);
    codes.push({ code, url });
    const ref = doc(collection(db, COLLECTION), code);
    batch.set(ref, {
      code,
      url,
      prefix:    prefix.toUpperCase(),
      batch:     batchId,
      type,
      maxPlays:  effectiveMaxPlays,
      playCount: 0,
      active:    true,
      dailyScans: {},
      createdAt:  serverTimestamp(),
    });
  }

  await batch.commit();
  return codes;

}

// ── Fetch All QR Codes ────────────────────────────────────────────────────────

export async function fetchAllQRCodes(): Promise<QRCodeRecord[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  );

  return snap.docs.map(d => {
    const data = d.data();
    const today = todayStr();
    return {
      id:            d.id,
      code:          data.code ?? d.id,
      type:          data.type ?? 'Regular',
      prefix:        data.prefix ?? '',
      batch:         data.batch ?? '',
      maxPlays:      data.maxPlays ?? 2,
      playCount:     data.playCount ?? 0,
      active:        data.active ?? true,
      createdAt:     (data.createdAt as Timestamp)?.toDate() ?? new Date(),
      lastScannedAt: data.lastScannedAt ? (data.lastScannedAt as Timestamp).toDate() : undefined,
      scansToday:    (data.dailyScans ?? {})[today] ?? 0,
    };
  });
}

// ── Search QR Codes ───────────────────────────────────────────────────────────

export async function searchQRCodes(filters: QRSearchFilters): Promise<QRCodeRecord[]> {
  const all = await fetchAllQRCodes();

  return all.filter(qr => {
    const idMatch     = !filters.qrId   || qr.code.toLowerCase().includes(filters.qrId.toLowerCase());
    const batchMatch  = !filters.batch  || qr.batch.toLowerCase().includes(filters.batch.toLowerCase());
    const statusMatch = !filters.status || ((): boolean => {
      if (filters.status === 'active')    return qr.active && qr.playCount < qr.maxPlays;
      if (filters.status === 'disabled')  return !qr.active;
      if (filters.status === 'exhausted') return qr.active && qr.playCount >= qr.maxPlays;
      return true;
    })();
    return idMatch && batchMatch && statusMatch;
  });
}

// ── Toggle QR Active State ────────────────────────────────────────────────────

export async function setQRActive(code: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTION, code), { active });
}

// ── Golden QR Bulk Control ────────────────────────────────────────────────────

export async function controlGoldenQR(action: 'pause' | 'resume' | 'disable'): Promise<void> {
  console.log('[GOLDEN CONTROL]', action);

  // Fetch all and filter client-side — type field may be any case
  const snap = await getDocs(collection(db, COLLECTION));
  const golden = snap.docs.filter(d => (d.data().type ?? '').toLowerCase() === 'golden');

  console.log('[GOLDEN CONTROL] matching docs:', golden.length);
  if (!golden.length) return;

  for (let i = 0; i < golden.length; i += 499) {
    const chunk = golden.slice(i, i + 499);
    const b = writeBatch(db);
    chunk.forEach(d => {
      if (action === 'pause')   b.update(d.ref, { active: false });
      if (action === 'resume')  b.update(d.ref, { active: true  });
      if (action === 'disable') b.update(d.ref, { active: false, playCount: d.data().maxPlays ?? 999 });
    });
    await b.commit();
  }

  console.log('[GOLDEN CONTROL COMPLETE]', action, golden.length, 'docs');
}

// ── Create Unlimited Golden QR ────────────────────────────────────────────────

export async function createUnlimitedGoldenQR(code: string): Promise<void> {
  const ref = doc(collection(db, COLLECTION), code.toUpperCase());
  await addDoc(collection(db, COLLECTION), {
    code:      code.toUpperCase(),
    prefix:    'GOLDEN',
    batch:     'GOLDEN-UNLIMITED',
    type:      'Golden',
    maxPlays:  999999,
    playCount: 0,
    active:    true,
    dailyScans: {},
    createdAt: serverTimestamp(),
  });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export async function fetchAnalytics(): Promise<{
  daily:   QRAnalyticsData[];
  weekly:  QRAnalyticsData[];
  monthly: QRAnalyticsData[];
}> {
  console.log('[QR Analytics] Fetching from collection:', COLLECTION);
  const snap = await getDocs(collection(db, COLLECTION));
  console.log('[QR Analytics] Documents returned:', snap.size);

  // Aggregate dailyScans maps across all codes
  const dayTotals: Record<string, number> = {};
  snap.forEach(d => {
    const dailyScans: Record<string, number> = d.data().dailyScans ?? {};
    Object.entries(dailyScans).forEach(([date, count]) => {
      dayTotals[date] = (dayTotals[date] ?? 0) + (count as number);
    });
  });

  console.log('[QR Analytics] Unique scan days found:', Object.keys(dayTotals).length);

  // Build a complete last-7 and last-30 day range (fills zeros for missing days)
  const today    = todayStr();
  const allDates = (n: number): string[] =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      return d.toISOString().slice(0, 10);
    });

  const last7Dates  = allDates(7);
  const last30Dates = allDates(30);

  // Daily — last 7 days with labels like "Mon", "Tue"
  const daily: QRAnalyticsData[] = last7Dates.map(date => ({
    label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    scans: dayTotals[date] ?? 0,
  }));

  // Weekly — last 30 days grouped into 4 weeks (W1=oldest, W4=most recent)
  const weekly: QRAnalyticsData[] = [];
  for (let w = 0; w < 4; w++) {
    const chunk = last30Dates.slice(w * 7, w * 7 + 7);
    const total = chunk.reduce((sum, d) => sum + (dayTotals[d] ?? 0), 0);
    const label = w === 3 ? 'This Wk' : `${4 - w}w ago`;
    weekly.push({ label, scans: total });
  }

  // Monthly — all available data grouped by YYYY-MM, last 6 months
  const monthTotals: Record<string, number> = {};
  Object.entries(dayTotals).forEach(([date, scans]) => {
    const month = date.slice(0, 7);
    monthTotals[month] = (monthTotals[month] ?? 0) + scans;
  });
  const monthly: QRAnalyticsData[] = Object.entries(monthTotals)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, scans]) => ({
      label: new Date(month + '-15').toLocaleDateString('en-US', { month: 'short' }),
      scans,
    }));

  console.log('[QR Analytics] daily totals:', daily.map(d => `${d.label}:${d.scans}`).join(', '));
  console.log('[QR Analytics] weekly totals:', weekly.map(d => `${d.label}:${d.scans}`).join(', '));
  console.log('[QR Analytics] monthly totals:', monthly.map(d => `${d.label}:${d.scans}`).join(', '));

  return { daily, weekly, monthly };
}

// ── Export helpers (CSV) ──────────────────────────────────────────────────────

export function exportCSV(codes: QRCodeRecord[]): void {
  const header = 'Code,Type,Batch,MaxPlays,PlayCount,Active,CreatedAt\n';
  const rows   = codes.map(q =>
    `${q.code},${q.type},${q.batch},${q.maxPlays},${q.playCount},${q.active},${q.createdAt.toISOString()}`
  ).join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `qr-codes-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Export Excel (TSV that Excel opens natively) ──────────────────────────────

export function exportExcel(codes: QRCodeRecord[]): void {
  const header = 'Code\tType\tBatch\tMaxPlays\tPlayCount\tActive\tURL\tCreatedAt\n';
  const rows   = codes.map(q =>
    `${q.code}\t${q.type}\t${q.batch}\t${q.maxPlays}\t${q.playCount}\t${q.active}\t${buildURL(q.code)}\t${q.createdAt.toISOString()}`
  ).join('\n');
  const blob = new Blob(['﻿' + header + rows], { type: 'text/tab-separated-values' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `qr-codes-${Date.now()}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Backup to JSON ────────────────────────────────────────────────────────────

export async function exportBackupJSON(): Promise<string> {
  const codes = await fetchAllQRCodes();
  const date  = new Date().toISOString().slice(0, 10);
  const json  = JSON.stringify({ exportedAt: new Date().toISOString(), count: codes.length, codes }, null, 2);
  const blob  = new Blob([json], { type: 'application/json' });
  const url   = URL.createObjectURL(blob);
  const a     = document.createElement('a');
  a.href      = url;
  a.download  = `backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return date;
}

// ── Bulk disable / enable by type ─────────────────────────────────────────────
// Firestore 'type' field may be stored in any case (Regular/regular/REGULAR).
// We fetch all docs and filter client-side for reliability.

export async function bulkSetActiveByType(type: QRCodeType, active: boolean): Promise<number> {
  const op = active ? 'ENABLE' : 'DISABLE';
  console.log(`[${op} START] type="${type}" active=${active}`);

  const snap = await getDocs(collection(db, COLLECTION));
  console.log(`[${op}] Total docs in collection:`, snap.size);

  const typeLower = type.toLowerCase();
  const matching  = snap.docs.filter(d => {
    const t = (d.data().type ?? '').toLowerCase();
    return t === typeLower;
  });

  console.log(`[${op}] Matching docs for type "${type}":`, matching.length);
  if (!matching.length) return 0;

  let count = 0;
  for (let i = 0; i < matching.length; i += 499) {
    const chunk = matching.slice(i, i + 499);
    const b = writeBatch(db);
    chunk.forEach(d => {
      console.log(`[DOC FOUND]`, d.id);
      b.update(d.ref, { active });
    });
    await b.commit();
    count += chunk.length;
    console.log(`[DOC UPDATED] batch of ${chunk.length} committed`);
  }

  console.log(`[${op} COMPLETE] ${count} documents updated`);
  return count;
}

// ── Bulk delete by type ───────────────────────────────────────────────────────

export async function bulkDeleteByType(type: QRCodeType): Promise<number> {
  console.log('[DELETE START] type:', type);

  const snap = await getDocs(collection(db, COLLECTION));
  console.log('[DELETE] Total docs in collection:', snap.size);

  const typeLower = type.toLowerCase();
  const matching  = snap.docs.filter(d => {
    const t = (d.data().type ?? '').toLowerCase();
    return t === typeLower;
  });

  console.log('[DELETE] Matching docs:', matching.length);
  if (!matching.length) return 0;

  let count = 0;
  for (let i = 0; i < matching.length; i += 499) {
    const chunk = matching.slice(i, i + 499);
    const b = writeBatch(db);
    chunk.forEach(d => {
      console.log('[DOC FOUND]', d.id);
      b.delete(d.ref);
    });
    await b.commit();
    count += chunk.length;
    console.log('[DOC UPDATED] deleted batch of', chunk.length);
  }

  console.log('[DELETE COMPLETE]', count, 'documents deleted');
  return count;
}

// ── Bulk delete by specific doc IDs ──────────────────────────────────────────

export async function bulkDeleteByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  let count = 0;
  for (let i = 0; i < ids.length; i += 499) {
    const chunk = ids.slice(i, i + 499);
    const b = writeBatch(db);
    chunk.forEach(id => b.delete(doc(db, COLLECTION, id)));
    await b.commit();
    count += chunk.length;
  }
  return count;
}

// ── Operation Log ─────────────────────────────────────────────────────────────

export interface OpLog {
  id:        string;
  operation: string;
  type:      string;
  count:     number;
  actor:     string;
  ts:        Date;
}

export async function writeOpLog(operation: string, type: string, count: number, actor: string): Promise<void> {
  await addDoc(collection(db, 'qrOperationLogs'), {
    operation,
    type,
    count,
    actor,
    ts: serverTimestamp(),
  });
}

export async function fetchOpLogs(limit = 50): Promise<OpLog[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'qrOperationLogs'), orderBy('ts', 'desc'))
    );
    return snap.docs.slice(0, limit).map(d => {
      const data = d.data();
      return {
        id:        d.id,
        operation: data.operation ?? '',
        type:      data.type      ?? '',
        count:     data.count     ?? 0,
        actor:     data.actor     ?? 'Admin',
        ts:        (data.ts as Timestamp)?.toDate() ?? new Date(),
      };
    });
  } catch {
    return [];
  }
}
