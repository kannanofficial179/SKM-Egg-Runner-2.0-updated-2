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

export type DashboardResult =
  | { ok: true;  stats: QRDashboardStats }
  | { ok: false; error: string; stats: QRDashboardStats };

const EMPTY_STATS: QRDashboardStats = { totalGenerated: 0, activeQR: 0, disabledQR: 0, goldenQR: 0, scannedToday: 0, unusedQR: 0 };

export async function fetchDashboardStats(): Promise<QRDashboardStats> {
  console.log('[LOAD DASHBOARD] Fetching from collection:', COLLECTION);

  let snap;
  try {
    snap = await getDocs(collection(db, COLLECTION));
  } catch (err: any) {
    console.error('[LOAD FAILURE] Could not read collection:', COLLECTION, err?.message);
    throw err;
  }

  console.log('[LOAD TOTAL QR] Document count:', snap.size);

  let totalGenerated = 0;
  let activeQR       = 0;
  let disabledQR     = 0;
  let goldenQR       = 0;
  let scannedToday   = 0;
  let unusedQR       = 0;

  const today = todayStr();

  snap.forEach(d => {
    const data = d.data();
    totalGenerated++;

    const isActive:   boolean = data.active    ?? true;
    const playCount:  number  = data.playCount ?? 0;
    const maxPlays:   number  = data.maxPlays  ?? 2;
    // Normalise type to lower-case for comparison — docs may store "Regular", "regular", "REGULAR"
    const typeRaw:    string  = data.type ?? '';
    const typeLower:  string  = typeRaw.toLowerCase();

    if (!isActive) {
      disabledQR++;
    } else if (playCount >= maxPlays) {
      disabledQR++;
    } else {
      activeQR++;
    }

    if (typeLower === 'golden') goldenQR++;
    if (playCount === 0)        unusedQR++;

    // scansToday: stored as dailyScans map { [YYYY-MM-DD]: count }
    const dailyMap: Record<string, number> = data.dailyScans ?? {};
    scannedToday += dailyMap[today] ?? 0;
  });

  console.log('[LOAD ACTIVE QR]',    activeQR);
  console.log('[LOAD DISABLED QR]',  disabledQR);
  console.log('[LOAD GOLDEN QR]',    goldenQR);
  console.log('[LOAD SCANNED TODAY]',scannedToday);
  console.log('[LOAD SUCCESS] total:', totalGenerated, '| unused:', unusedQR);

  return { totalGenerated, activeQR, disabledQR, goldenQR, scannedToday, unusedQR };
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
  daily: QRAnalyticsData[];
  weekly: QRAnalyticsData[];
  monthly: QRAnalyticsData[];
}> {
  const snap = await getDocs(collection(db, COLLECTION));

  // Aggregate dailyScans maps across all codes
  const dayTotals: Record<string, number> = {};
  snap.forEach(d => {
    const dailyScans: Record<string, number> = d.data().dailyScans ?? {};
    Object.entries(dailyScans).forEach(([date, count]) => {
      dayTotals[date] = (dayTotals[date] ?? 0) + count;
    });
  });

  const sorted = Object.entries(dayTotals).sort(([a], [b]) => a.localeCompare(b));

  const last7  = sorted.slice(-7);
  const last30 = sorted.slice(-30);

  // Daily — last 7 days
  const daily: QRAnalyticsData[] = last7.map(([date, scans]) => ({
    label: date.slice(5), // MM-DD
    scans,
  }));

  // Weekly — group last 30 days into weeks
  const weekly: QRAnalyticsData[] = [];
  for (let w = 0; w < 4; w++) {
    const chunk = last30.slice(w * 7, w * 7 + 7);
    if (!chunk.length) continue;
    const total = chunk.reduce((sum, [, c]) => sum + c, 0);
    weekly.push({ label: `Week ${w + 1}`, scans: total });
  }

  // Monthly — group all available data by month
  const monthTotals: Record<string, number> = {};
  sorted.forEach(([date, scans]) => {
    const month = date.slice(0, 7); // YYYY-MM
    monthTotals[month] = (monthTotals[month] ?? 0) + scans;
  });
  const monthly: QRAnalyticsData[] = Object.entries(monthTotals)
    .slice(-6)
    .map(([month, scans]) => ({ label: month.slice(5), scans }));

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
