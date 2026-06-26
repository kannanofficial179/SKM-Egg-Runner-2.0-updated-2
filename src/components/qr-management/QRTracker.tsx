import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, X, RefreshCw, Copy, Download, Printer, Power, PowerOff, Trash2,
  CheckCircle, XCircle, Clock, AlertTriangle, Zap, QrCode,
  Calendar, Hash, Layers3, User, ChevronRight, Filter,
  ArrowUpRight, TrendingUp, Activity,
} from 'lucide-react';
import {
  collection, getDocs, doc, getDoc, updateDoc, deleteDoc,
  query, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';
import type { QRCodeRecord, QRCodeType } from '../../types/qr/qrManagementTypes';

const RED   = '#D71920';
const COLL  = 'qrCodes';

// ─── Types ────────────────────────────────────────────────────────────────────

type LiveStatus = 'available' | 'in_use' | 'fully_used' | 'disabled' | 'expired';

interface TrackedQR extends QRCodeRecord {
  url?:         string;
  dailyScans?:  Record<string, number>;
  liveStatus:   LiveStatus;
  remaining:    number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLiveStatus(qr: QRCodeRecord): LiveStatus {
  if (!qr.active) return 'disabled';
  if (qr.playCount >= qr.maxPlays) return 'fully_used';
  if (qr.playCount > 0) return 'in_use';
  return 'available';
}

function fmtDate(d?: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDateShort(d?: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function todayStr(): string { return new Date().toISOString().slice(0, 10); }

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<LiveStatus, { label: string; bg: string; color: string; dot: string }> = {
  available:  { label: 'Available',   bg: '#F0FDF4', color: '#15803D', dot: '#22C55E' },
  in_use:     { label: 'In Use',      bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  fully_used: { label: 'Fully Used',  bg: '#FFF7ED', color: '#C2410C', dot: '#F97316' },
  disabled:   { label: 'Disabled',    bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF' },
  expired:    { label: 'Expired',     bg: '#FEF2F2', color: '#DC2626', dot: '#EF4444' },
};

function StatusBadge({ status }: { status: LiveStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: QRCodeType }) {
  const isGolden = type === 'Golden';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 800,
      background: isGolden ? '#FEF9C3' : `${RED}10`,
      color: isGolden ? '#92400E' : RED,
      border: `1px solid ${isGolden ? '#FDE68A' : `${RED}25`}`,
      letterSpacing: 0.5,
    }}>
      {isGolden ? '★ Golden' : type}
    </span>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 12, padding: '14px 18px',
      border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      flex: '1 1 130px', minWidth: 0,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 900, color: color ?? '#1A1A1A', margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ─── Timeline event ───────────────────────────────────────────────────────────

interface TimelineItem {
  action: string;
  time:   string;
  icon:   React.ReactNode;
  color:  string;
}

function buildTimeline(qr: TrackedQR): TimelineItem[] {
  const events: TimelineItem[] = [];

  events.push({
    action: 'QR Code Created',
    time:   fmtDate(qr.createdAt),
    icon:   <QrCode size={13} />,
    color:  '#6366F1',
  });

  if (qr.playCount > 0 && qr.lastScannedAt) {
    events.push({
      action: `First scan recorded`,
      time:   fmtDate(qr.lastScannedAt),
      icon:   <Activity size={13} />,
      color:  '#3B82F6',
    });
  }

  if (qr.liveStatus === 'fully_used') {
    events.push({
      action: `All ${qr.maxPlays} play${qr.maxPlays !== 1 ? 's' : ''} consumed`,
      time:   qr.lastScannedAt ? fmtDate(qr.lastScannedAt) : '—',
      icon:   <CheckCircle size={13} />,
      color:  '#F97316',
    });
  }

  if (!qr.active) {
    events.push({
      action: 'QR Disabled',
      time:   '—',
      icon:   <PowerOff size={13} />,
      color:  '#9CA3AF',
    });
  }

  return events.reverse(); // newest first
}

// ─── Daily scans mini-chart ───────────────────────────────────────────────────

function DailyScanChart({ dailyScans }: { dailyScans: Record<string, number> }) {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), count: dailyScans[key] ?? 0 };
  });

  const max = Math.max(...days.map(d => d.count), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 48 }}>
      {days.map(({ key, label, count }) => (
        <div key={key} title={`${label}: ${count} scan${count !== 1 ? 's' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%', borderRadius: 3,
            background: count > 0 ? RED : '#E5E7EB',
            height: `${Math.max(4, (count / max) * 40)}px`,
            opacity: key === todayStr() ? 1 : 0.7,
            transition: 'height 300ms ease',
          }} />
        </div>
      ))}
    </div>
  );
}

// ─── QR Detail Panel ─────────────────────────────────────────────────────────

function QRDetailPanel({
  qr, actor, onClose, onRefresh,
}: {
  qr: TrackedQR; actor: string; onClose: () => void; onRefresh: () => void;
}) {
  const [copying, setCopying]   = useState(false);
  const [acting,  setActing]    = useState(false);
  const [confirm, setConfirm]   = useState<'disable' | 'enable' | 'delete' | null>(null);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopying(true);
    setTimeout(() => setCopying(false), 1200);
  };

  const doAction = async (action: 'disable' | 'enable' | 'delete') => {
    setActing(true);
    try {
      const ref = doc(db, COLL, qr.id);
      if (action === 'delete') {
        await deleteDoc(ref);
      } else {
        await updateDoc(ref, { active: action === 'enable' });
      }
      onRefresh();
      onClose();
    } catch (e: any) {
      console.error('[QRTracker] action error:', e?.message);
    }
    setActing(false);
    setConfirm(null);
  };

  const timeline = buildTimeline(qr);
  const totalScans = qr.playCount;
  const successRate = qr.maxPlays > 0 ? Math.round((qr.playCount / qr.maxPlays) * 100) : 0;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qr.url ?? qr.code)}&margin=1`;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
      pointerEvents: 'none',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.25)',
          pointerEvents: 'auto',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 520,
        height: '100%', overflowY: 'auto',
        background: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Panel header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#FAFAFA', flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>QR Tracker</p>
            <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1A1A1A', margin: 0, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {qr.code}
            </h3>
          </div>
          <StatusBadge status={qr.liveStatus} />
          <button
            onClick={onClose}
            style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#6B7280' }}
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* QR preview + identity */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 12, flexShrink: 0,
              border: '1px solid #E5E7EB', overflow: 'hidden',
              background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img
                src={qrImageUrl}
                alt={qr.code}
                style={{ width: 88, height: 88, objectFit: 'contain' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                <TypeBadge type={qr.type} />
                {qr.batch && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '2px 8px', borderRadius: 20 }}>
                    {qr.batch}
                  </span>
                )}
              </div>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
                <span style={{ fontWeight: 700, color: '#374151' }}>ID: </span>{qr.id}
              </p>
              <p style={{ margin: '0 0 3px', fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
                <span style={{ fontWeight: 700, color: '#374151' }}>Prefix: </span>{qr.prefix || '—'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#6B7280', fontWeight: 500 }}>
                <span style={{ fontWeight: 700, color: '#374151' }}>Created: </span>{fmtDateShort(qr.createdAt)}
              </p>
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <StatCard label="Max Plays"  value={qr.maxPlays === 999999 ? '∞' : qr.maxPlays} />
            <StatCard label="Used Plays" value={qr.playCount} color={qr.playCount > 0 ? RED : undefined} />
            <StatCard label="Remaining"  value={qr.maxPlays === 999999 ? '∞' : qr.remaining} color={qr.remaining === 0 ? '#F97316' : '#15803D'} />
            <StatCard label="Today"      value={qr.scansToday} sub="scans today" />
          </div>

          {/* Usage progress bar */}
          {qr.maxPlays !== 999999 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Usage</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: successRate >= 100 ? '#F97316' : RED }}>{successRate}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 8, background: '#F3F4F6', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 8,
                  background: successRate >= 100 ? '#F97316' : RED,
                  width: `${Math.min(successRate, 100)}%`,
                  transition: 'width 500ms ease',
                }} />
              </div>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>
                {qr.playCount} of {qr.maxPlays} plays used
              </p>
            </div>
          )}

          {/* Daily scan chart */}
          {qr.dailyScans && Object.keys(qr.dailyScans).length > 0 && (
            <div style={{ marginBottom: 20, background: '#F9FAFB', borderRadius: 12, padding: '14px 16px', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <TrendingUp size={13} color={RED} /> Daily Scans (14 days)
                </span>
                <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
                  {Object.values(qr.dailyScans).reduce((a, b) => a + b, 0)} total
                </span>
              </div>
              <DailyScanChart dailyScans={qr.dailyScans} />
            </div>
          )}

          {/* Last scan info */}
          {qr.lastScannedAt && (
            <div style={{ marginBottom: 20, background: '#EFF6FF', borderRadius: 12, padding: '12px 16px', border: '1px solid #BFDBFE' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={13} /> Last Scan
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#1E40AF', fontWeight: 600 }}>
                {fmtDate(qr.lastScannedAt)}
              </p>
            </div>
          )}

          {/* Full field table */}
          <div style={{ marginBottom: 20, background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #E5E7EB', background: '#F3F4F6' }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Full Details</span>
            </div>
            {[
              { label: 'QR ID',       value: qr.id,    copy: true },
              { label: 'Code',        value: qr.code,  copy: true },
              { label: 'Type',        value: qr.type               },
              { label: 'Batch',       value: qr.batch || '—'       },
              { label: 'Prefix',      value: qr.prefix || '—'      },
              { label: 'Created',     value: fmtDate(qr.createdAt) },
              { label: 'Last Scanned',value: fmtDate(qr.lastScannedAt) },
              { label: 'URL',         value: qr.url ?? '—', copy: !!qr.url },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #F3F4F6', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', minWidth: 100, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 11, color: '#1A1A1A', flex: 1, wordBreak: 'break-all' }}>{row.value}</span>
                {row.copy && (
                  <button
                    onClick={() => copy(row.value as string)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: copying ? '#15803D' : '#9CA3AF', padding: '2px 4px', borderRadius: 4, flexShrink: 0 }}
                    title="Copy"
                  >
                    <Copy size={12} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#374151', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.8 }}>Lifecycle Timeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {timeline.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                  {/* connector line */}
                  {i < timeline.length - 1 && (
                    <div style={{ position: 'absolute', left: 13, top: 26, bottom: 0, width: 1, background: '#E5E7EB' }} />
                  )}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: `${ev.color}15`, border: `1.5px solid ${ev.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: ev.color,
                  }}>
                    {ev.icon}
                  </div>
                  <div style={{ paddingBottom: 16, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{ev.action}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9CA3AF' }}>{ev.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.8 }}>Actions</p>

            {confirm ? (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 16px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                  Confirm {confirm === 'delete' ? 'delete' : confirm === 'disable' ? 'disable' : 'enable'} this QR?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => doAction(confirm)}
                    disabled={acting}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: confirm === 'delete' ? '#DC2626' : RED, color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
                  >
                    {acting ? 'Processing…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirm(null)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  onClick={() => copy(qr.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Copy size={13} /> Copy ID
                </button>
                {qr.url && (
                  <a
                    href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr.url)}`}
                    download={`${qr.code}.png`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
                  >
                    <Download size={13} /> Download PNG
                  </a>
                )}
                {qr.active ? (
                  <button
                    onClick={() => setConfirm('disable')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA', color: '#C2410C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <PowerOff size={13} /> Disable
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirm('enable')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    <Power size={13} /> Enable
                  </button>
                )}
                <button
                  onClick={() => setConfirm('delete')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type FilterPeriod = 'all' | 'today' | 'yesterday' | 'week' | 'month';
type FilterType   = 'all' | 'Regular' | 'Golden';
type FilterStatus = 'all' | 'available' | 'in_use' | 'fully_used' | 'disabled';

interface Filters {
  period: FilterPeriod;
  type:   FilterType;
  status: FilterStatus;
}

const PERIOD_LABELS: Record<FilterPeriod, string> = {
  all:       'All Time',
  today:     'Today',
  yesterday: 'Yesterday',
  week:      'This Week',
  month:     'This Month',
};

// ─── Main QRTracker component ─────────────────────────────────────────────────

interface Props {
  codes: QRCodeRecord[];
  onRefresh: () => void;
  actor: string;
}

export default function QRTracker({ codes, onRefresh, actor }: Props) {
  const [searchTerm,  setSearchTerm]  = useState('');
  const [filters,     setFilters]     = useState<Filters>({ period: 'all', type: 'all', status: 'all' });
  const [showFilters, setShowFilters] = useState(false);
  const [selected,    setSelected]    = useState<TrackedQR | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Enrich codes with liveStatus and remaining
  const tracked: TrackedQR[] = codes.map(qr => ({
    ...qr,
    liveStatus: getLiveStatus(qr),
    remaining:  Math.max(0, qr.maxPlays - qr.playCount),
  }));

  // Apply search
  const searchLower = searchTerm.toLowerCase().trim();
  const afterSearch = searchLower
    ? tracked.filter(qr =>
        qr.id.toLowerCase().includes(searchLower) ||
        qr.code.toLowerCase().includes(searchLower) ||
        qr.batch.toLowerCase().includes(searchLower) ||
        qr.type.toLowerCase().includes(searchLower) ||
        qr.prefix.toLowerCase().includes(searchLower)
      )
    : tracked;

  // Apply filters
  const now = new Date();
  const filtered = afterSearch.filter(qr => {
    // Period filter
    if (filters.period !== 'all') {
      const c = qr.createdAt;
      if (!c) return false;
      if (filters.period === 'today') {
        if (c.toDateString() !== now.toDateString()) return false;
      } else if (filters.period === 'yesterday') {
        const yd = new Date(now); yd.setDate(yd.getDate() - 1);
        if (c.toDateString() !== yd.toDateString()) return false;
      } else if (filters.period === 'week') {
        const wk = new Date(now); wk.setDate(wk.getDate() - 7);
        if (c < wk) return false;
      } else if (filters.period === 'month') {
        const mo = new Date(now); mo.setDate(mo.getDate() - 30);
        if (c < mo) return false;
      }
    }
    // Type filter
    if (filters.type !== 'all' && qr.type !== filters.type) return false;
    // Status filter
    if (filters.status !== 'all' && qr.liveStatus !== filters.status) return false;
    return true;
  });

  // Open detail — fetch full doc including dailyScans
  const openDetail = useCallback(async (qr: TrackedQR) => {
    setDetailLoading(true);
    setSelected(qr);
    try {
      const snap = await getDoc(doc(db, COLL, qr.id));
      if (snap.exists()) {
        const data = snap.data();
        const enriched: TrackedQR = {
          ...qr,
          url:        data.url ?? undefined,
          dailyScans: data.dailyScans ?? {},
        };
        setSelected(enriched);
      }
    } catch { /* show what we have */ }
    setDetailLoading(false);
  }, []);

  // Summary counts
  const summary = {
    total:      tracked.length,
    available:  tracked.filter(q => q.liveStatus === 'available').length,
    inUse:      tracked.filter(q => q.liveStatus === 'in_use').length,
    fullyUsed:  tracked.filter(q => q.liveStatus === 'fully_used').length,
    disabled:   tracked.filter(q => q.liveStatus === 'disabled').length,
  };

  // Export CSV
  const exportCSV = () => {
    const header = 'QR ID,Code,Type,Batch,Prefix,Status,Max Plays,Used Plays,Remaining,Created At,Last Scanned';
    const rows = filtered.map(q =>
      [q.id, q.code, q.type, q.batch, q.prefix, q.liveStatus, q.maxPlays, q.playCount, q.remaining, fmtDate(q.createdAt), fmtDate(q.lastScannedAt)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `qr-tracker-${todayStr()}.csv`; a.click();
  };

  const activeFilterCount = [
    filters.period !== 'all',
    filters.type !== 'all',
    filters.status !== 'all',
  ].filter(Boolean).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Summary stat row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <StatCard label="Total QRs"   value={summary.total} />
        <StatCard label="Available"   value={summary.available}  color="#15803D" />
        <StatCard label="In Use"      value={summary.inUse}      color="#1D4ED8" />
        <StatCard label="Fully Used"  value={summary.fullyUsed}  color="#C2410C" />
        <StatCard label="Disabled"    value={summary.disabled}   color="#6B7280" />
      </div>

      {/* Search + filter bar */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '14px 16px', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search input */}
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by QR ID, code, batch, type, prefix…"
              style={{
                width: '100%', boxSizing: 'border-box',
                paddingLeft: 32, paddingRight: searchTerm ? 32 : 12,
                paddingTop: 8, paddingBottom: 8,
                borderRadius: 8, border: '1px solid #E5E7EB',
                fontSize: 12, color: '#1A1A1A', outline: 'none',
                background: '#F9FAFB',
              }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: showFilters ? `${RED}10` : '#F3F4F6',
              border: `1px solid ${showFilters ? `${RED}30` : '#E5E7EB'}`,
              color: showFilters ? RED : '#374151',
            }}
          >
            <Filter size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span style={{ background: RED, color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 900 }}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Export */}
          <button
            onClick={exportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151' }}
          >
            <Download size={13} /> Export CSV
          </button>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>

            {/* Period */}
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Period</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(Object.keys(PERIOD_LABELS) as FilterPeriod[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setFilters(f => ({ ...f, period: p }))}
                    style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: filters.period === p ? `${RED}10` : '#F9FAFB', color: filters.period === p ? RED : '#6B7280', borderColor: filters.period === p ? `${RED}30` : '#E5E7EB' }}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Type</p>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['all', 'Regular', 'Golden'] as FilterType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilters(f => ({ ...f, type: t }))}
                    style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: filters.type === t ? `${RED}10` : '#F9FAFB', color: filters.type === t ? RED : '#6B7280', borderColor: filters.type === t ? `${RED}30` : '#E5E7EB' }}
                  >
                    {t === 'all' ? 'All' : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>Status</p>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['all', 'available', 'in_use', 'fully_used', 'disabled'] as FilterStatus[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilters(f => ({ ...f, status: s }))}
                    style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: filters.status === s ? `${RED}10` : '#F9FAFB', color: filters.status === s ? RED : '#6B7280', borderColor: filters.status === s ? `${RED}30` : '#E5E7EB' }}
                  >
                    {s === 'all' ? 'All' : s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={() => setFilters({ period: 'all', type: 'all', status: 'all' })}
                  style={{ padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626' }}
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>
          Showing {filtered.length} of {tracked.length} QR codes
        </p>
      </div>

      {/* QR list */}
      <div style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 90px 100px 70px 70px 70px 36px',
          gap: 0, padding: '10px 16px',
          background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
          fontSize: 10, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8,
        }}>
          <span>QR Code</span>
          <span>Type</span>
          <span>Status</span>
          <span style={{ textAlign: 'center' }}>Max</span>
          <span style={{ textAlign: 'center' }}>Used</span>
          <span style={{ textAlign: 'center' }}>Left</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600, margin: 0 }}>No QR codes match your search or filters.</p>
          </div>
        ) : (
          filtered.map((qr, i) => (
            <div
              key={qr.id}
              onClick={() => openDetail(qr)}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 90px 100px 70px 70px 70px 36px',
                gap: 0, padding: '11px 16px',
                borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
                cursor: 'pointer', alignItems: 'center',
                transition: 'background 120ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* ID + batch */}
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#1A1A1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qr.code}</p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{qr.batch || qr.prefix || '—'}</p>
              </div>

              <span><TypeBadge type={qr.type} /></span>
              <span><StatusBadge status={qr.liveStatus} /></span>

              <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#374151' }}>
                {qr.maxPlays === 999999 ? '∞' : qr.maxPlays}
              </span>
              <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: qr.playCount > 0 ? RED : '#9CA3AF' }}>
                {qr.playCount}
              </span>
              <span style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: qr.remaining === 0 && qr.maxPlays !== 999999 ? '#F97316' : '#15803D' }}>
                {qr.maxPlays === 999999 ? '∞' : qr.remaining}
              </span>

              <span style={{ display: 'flex', justifyContent: 'center', color: '#9CA3AF' }}>
                <ChevronRight size={14} />
              </span>
            </div>
          ))
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <QRDetailPanel
          qr={selected}
          actor={actor}
          onClose={() => setSelected(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
