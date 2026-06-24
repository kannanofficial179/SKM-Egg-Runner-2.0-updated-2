import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
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

function buildCode(prefix: string, index: number): string {
  return `${prefix.toUpperCase()}-${String(index).padStart(4, '0')}`;
}

function getBatchId(): string {
  return `BATCH-${Date.now()}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Dashboard Stats ────────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<QRDashboardStats> {
  const snap = await getDocs(collection(db, COLLECTION));

  let totalGenerated = 0;
  let activeQR = 0;
  let disabledQR = 0;
  let goldenQR = 0;
  let scannedToday = 0;
  let unusedQR = 0;

  const today = todayStr();

  snap.forEach(d => {
    const data = d.data();
    totalGenerated++;

    const isActive: boolean = data.active ?? true;
    const playCount: number = data.playCount ?? 0;
    const maxPlays: number  = data.maxPlays  ?? 2;
    const type: string      = data.type ?? 'Regular';

    if (!isActive) {
      disabledQR++;
    } else if (playCount >= maxPlays) {
      // exhausted but active field still true
      disabledQR++;
    } else {
      activeQR++;
    }

    if (type === 'Golden') goldenQR++;
    if (playCount === 0) unusedQR++;

    // scansToday stored as a map { [date]: count }
    const dailyMap: Record<string, number> = data.dailyScans ?? {};
    scannedToday += dailyMap[today] ?? 0;
  });

  return { totalGenerated, activeQR, disabledQR, goldenQR, scannedToday, unusedQR };
}

// ── Generate QR Codes ──────────────────────────────────────────────────────────

export async function generateQRCodes(
  prefix: string,
  quantity: number,
  maxPlays: number,
  type: QRCodeType,
): Promise<string[]> {
  const batch = writeBatch(db);
  const batchId = getBatchId();
  const codes: string[] = [];

  // Find highest existing index for this prefix to avoid duplicates
  const existing = await getDocs(
    query(collection(db, COLLECTION), where('prefix', '==', prefix.toUpperCase()))
  );
  let startIndex = existing.size + 1;

  for (let i = 0; i < quantity; i++) {
    const code = buildCode(prefix, startIndex + i);
    codes.push(code);
    const ref = doc(collection(db, COLLECTION), code);
    batch.set(ref, {
      code,
      prefix:    prefix.toUpperCase(),
      batch:     batchId,
      type,
      maxPlays,
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
  const snap = await getDocs(
    query(collection(db, COLLECTION), where('type', '==', 'Golden'))
  );

  const batch = writeBatch(db);
  snap.forEach(d => {
    if (action === 'pause')   batch.update(d.ref, { active: false });
    if (action === 'resume')  batch.update(d.ref, { active: true  });
    if (action === 'disable') batch.update(d.ref, { active: false, playCount: d.data().maxPlays ?? 999 });
  });

  await batch.commit();
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
