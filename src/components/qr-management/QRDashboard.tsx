import React, { useEffect, useRef, useState } from 'react';
import {
  QrCode, CheckCircle2, Ban, PackageOpen, ShieldCheck, Code2,
  ScanLine, BarChart2, TrendingUp, AlertTriangle, Circle,
  Plus, Printer, Download, RefreshCw, Activity, Zap,
  ArrowUpRight, Layers3, Clock, ChevronRight,
  Wifi, Server, Key, Link2, HardDrive,
} from 'lucide-react';
import type { QRDashboardStats, QRCodeRecord } from '../../types/qr/qrManagementTypes';

const RED  = '#D71920';
const SAFE = '#16A34A';

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff  = target - start;
    if (diff === 0) return;
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setVal(Math.round(start + diff * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ h = 110, r = 16 }: { h?: number; r?: number }) {
  return (
    <div style={{
      height: h, borderRadius: r, overflow: 'hidden',
      background: 'linear-gradient(90deg,#F3F4F6 25%,#E9EAEC 50%,#F3F4F6 75%)',
      backgroundSize: '200% 100%',
      animation: 'dbSlide 1.4s ease-in-out infinite',
    }} />
  );
}

// ─── Today Overview Card ──────────────────────────────────────────────────────

function TodayCard({ label, value, icon, color, sub }: {
  label: string; value: number; icon: React.ReactNode; color: string; sub?: string;
}) {
  const displayed = useCountUp(value);
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 18, padding: '22px 20px',
      border: '1px solid #E5E7EB',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle colored top border */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '18px 18px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `${color}12`, border: `1px solid ${color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>{icon}</div>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
          padding: '3px 9px', borderRadius: 20,
          background: `${color}10`, color, border: `1px solid ${color}20`,
        }}>Today</span>
      </div>

      <div>
        <div style={{ fontSize: 34, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>
          {displayed.toLocaleString()}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', marginTop: 5 }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── KPI Stat Card ────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, accent = RED, sub, onClick }: {
  label: string; value: number | string; icon: React.ReactNode;
  accent?: string; sub?: string; onClick?: () => void;
}) {
  const num = typeof value === 'number' ? value : 0;
  const displayed = useCountUp(num);
  const [hover, setHover] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#FFFFFF', borderRadius: 14, padding: '14px 14px',
        border: `1px solid ${hover && onClick ? accent + '30' : '#E5E7EB'}`,
        boxShadow: hover && onClick ? `0 4px 16px ${accent}15` : '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 200ms, box-shadow 200ms',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${accent}12`, border: `1px solid ${accent}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
        }}>{icon}</div>
        {onClick && <ChevronRight size={13} color="#D1D5DB" />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>
        {typeof value === 'string' ? value : displayed.toLocaleString()}
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
        {sub && <div style={{ fontSize: 9, color: '#C4C9D4', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Inline Bar Chart (no library) ───────────────────────────────────────────

function MiniBarChart({ data, color = RED }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 52 }}>
      {data.map(({ label, value }) => (
        <div key={label} title={`${label}: ${value}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            background: value > 0 ? color : '#E5E7EB',
            height: `${Math.max(4, (value / max) * 44)}px`,
            transition: 'height 600ms cubic-bezier(0.34,1.56,0.64,1)',
          }} />
          <span style={{ fontSize: 8, color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut Chart (SVG, no library) ───────────────────────────────────────────

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, g) => s + g.value, 0) || 1;
  const R = 44, CX = 56, CY = 56, stroke = 14;
  const circ = 2 * Math.PI * R;

  let offset = 0;
  const arcs = segments.map(seg => {
    const pct  = seg.value / total;
    const dash = pct * circ;
    const arc  = { ...seg, dash, offset, pct };
    offset += dash;
    return arc;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={112} height={112} style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => (
          <circle key={i}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={`${a.dash} ${circ - a.dash}`}
            strokeDashoffset={-(a.offset - circ / 4)}
            strokeLinecap="round"
          />
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize={14} fontWeight={900} fill="#1A1A1A">{total}</text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize={8} fill="#9CA3AF">Total</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{s.label}</span>
            <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', paddingLeft: 8, fontWeight: 700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── System Health ────────────────────────────────────────────────────────────

function HealthRow({ icon, label, status, ok }: { icon: React.ReactNode; label: string; status: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F9FAFB' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ok ? SAFE : '#DC2626', flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 9px', borderRadius: 20, background: ok ? '#F0FDF4' : '#FEF2F2', color: ok ? SAFE : '#DC2626', border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}` }}>
        {status}
      </span>
    </div>
  );
}

// ─── Recent Batch Table ───────────────────────────────────────────────────────

function RecentBatches({ codes }: { codes: QRCodeRecord[] }) {
  const batches = React.useMemo(() => {
    const map = new Map<string, { name: string; count: number; active: number; createdAt: Date }>();
    codes.forEach(c => {
      const b = c.batch || '—';
      if (!map.has(b)) map.set(b, { name: b, count: 0, active: 0, createdAt: c.createdAt });
      const entry = map.get(b)!;
      entry.count++;
      if (c.active && c.playCount < c.maxPlays) entry.active++;
      if (c.createdAt > entry.createdAt) entry.createdAt = c.createdAt;
    });
    return [...map.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8);
  }, [codes]);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
            {['Batch', 'QR Count', 'Active', 'Created'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {batches.length === 0 ? (
            <tr><td colSpan={4} style={{ padding: '20px 10px', textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>No batches yet</td></tr>
          ) : batches.map((b, i) => (
            <tr key={b.name} style={{ borderBottom: i < batches.length - 1 ? '1px solid #F9FAFB' : 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <td style={{ padding: '9px 10px', fontWeight: 800, color: '#1A1A1A', fontFamily: 'monospace', fontSize: 11 }}>{b.name}</td>
              <td style={{ padding: '9px 10px', color: '#374151', fontWeight: 700 }}>{b.count}</td>
              <td style={{ padding: '9px 10px' }}>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: b.active > 0 ? '#F0FDF4' : '#F3F4F6', color: b.active > 0 ? SAFE : '#9CA3AF', fontWeight: 700 }}>{b.active}</span>
              </td>
              <td style={{ padding: '9px 10px', color: '#6B7280', fontSize: 11 }}>{fmtDate(b.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Recent QR Activity (from codes) ─────────────────────────────────────────

function ActivityItem({ icon, color, title, sub, time }: { icon: React.ReactNode; color: string; title: string; sub: string; time: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderBottom: '1px solid #F9FAFB' }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}10`, border: `1px solid ${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0' }}>{sub}</p>
      </div>
      <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0, whiteSpace: 'nowrap' }}>{time}</span>
    </div>
  );
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function DashCard({ title, subtitle, icon, action, onAction, children }: {
  title: string; subtitle?: string; icon?: React.ReactNode;
  action?: string; onAction?: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 18, border: '1px solid #E5E7EB', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 10 }}>
        {icon && <span style={{ color: RED, flexShrink: 0 }}>{icon}</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0 }}>{subtitle}</p>}
        </div>
        {action && onAction && (
          <button onClick={onAction} style={{ fontSize: 10, fontWeight: 700, color: RED, background: `${RED}08`, border: `1px solid ${RED}20`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
            {action} <ArrowUpRight size={10} />
          </button>
        )}
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

// ─── Quick stats row ──────────────────────────────────────────────────────────

function QuickStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F9FAFB' }}>
      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 800, color: '#1A1A1A' }}>{value}</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

interface Props {
  stats:      QRDashboardStats;
  loading:    boolean;
  error?:     string | null;
  codes?:     QRCodeRecord[];
  actor?:     string;
  onNavigate?: (tab: string) => void;
  onRefresh?:  () => void;
}

export default function QRDashboard({ stats, loading, error, codes = [], actor = 'Admin', onNavigate, onRefresh }: Props) {
  const [now, setNow] = useState(fmtTime);
  useEffect(() => {
    const t = setInterval(() => setNow(fmtTime()), 30_000);
    return () => clearInterval(t);
  }, []);

  const today = todayStr();

  // ── Today's derived stats ────────────────────────────────────────────────
  const generatedToday = codes.filter(c => c.createdAt?.toISOString?.()?.slice(0, 10) === today).length;
  const scannedToday   = stats.scannedToday;

  // Scans per day for last 7 days (derived from codes.dailyScans if available)
  const last7 = React.useMemo(() => {
    const dayTotals: Record<string, number> = {};
    codes.forEach(c => {
      const ds = (c as any).dailyScans as Record<string, number> | undefined;
      if (ds) Object.entries(ds).forEach(([d, n]) => { dayTotals[d] = (dayTotals[d] ?? 0) + n; });
    });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        value: dayTotals[key] ?? 0,
      };
    });
  }, [codes]);

  // Most recent batches for activity feed
  const recentActivity = React.useMemo(() =>
    codes.slice(0, 10).map(c => ({
      code: c.code, batch: c.batch, type: c.type, createdAt: c.createdAt,
      active: c.active, playCount: c.playCount,
    })),
    [codes]
  );

  // Quick stats
  const avgScans    = codes.length ? (codes.reduce((s, c) => s + c.playCount, 0) / codes.length).toFixed(1) : '0';
  const totalLeft   = codes.filter(c => c.maxPlays < 999999).reduce((s, c) => s + Math.max(0, c.maxPlays - c.playCount), 0);
  const mostUsed    = codes.sort((a, b) => b.playCount - a.playCount)[0];
  const latestBatch = codes[0]?.batch || '—';

  const gameLink = (() => { try { return localStorage.getItem('qr_game_url') || 'Not set'; } catch { return '—'; } })();

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 1 }}>QR Management</p>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: '-0.4px' }}>
            Welcome back, <span style={{ color: RED }}>{actor.split('@')[0]}</span>
          </h2>
          <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Circle size={7} fill={SAFE} color={SAFE} />
            Live · {now}
            {stats.lastSync && !loading && <span>· Last sync: {stats.lastSync}</span>}
          </p>
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Generate', icon: <Plus size={13} />, tab: 'generator', primary: true },
            { label: 'Print',    icon: <Printer size={13} />, tab: 'print' },
            { label: 'Export',   icon: <Download size={13} />, tab: 'bulk' },
          ].map(({ label, icon, tab, primary }) => (
            <button key={label} onClick={() => onNavigate?.(tab)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10,
              fontSize: 12, fontWeight: 800, cursor: 'pointer', border: 'none',
              background: primary ? `linear-gradient(135deg,${RED},#B51218)` : '#F3F4F6',
              color:      primary ? '#fff' : '#374151',
              boxShadow:  primary ? `0 3px 10px ${RED}30` : 'none',
            }}>{icon}{label}</button>
          ))}
          <button onClick={onRefresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', border: '1px solid #E5E7EB', background: '#FFFFFF', color: '#6B7280' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'dbSpin 0.9s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15} color="#DC2626" />
          <p style={{ color: '#DC2626', fontSize: 12, fontWeight: 700, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* ── Today's Overview ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={130} />)}
        </div>
      ) : (
        <>
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 10px' }}>Today's Overview</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
              <TodayCard label="QR Generated Today"       value={generatedToday}   icon={<Plus size={18} strokeWidth={2} />}     color="#6366F1" sub="new codes created" />
              <TodayCard label="QR Scanned Today"         value={scannedToday}     icon={<ScanLine size={18} strokeWidth={2} />} color={RED}     sub="from dailyScans" />
              <TodayCard label="Game Sessions Today"      value={scannedToday}     icon={<Zap size={18} strokeWidth={2} />}      color="#0891B2" sub="game entries" />
              <TodayCard label="Protein Tracker Scans"   value={0}                icon={<Activity size={18} strokeWidth={2} />} color="#16A34A" sub="nutrition scans" />
            </div>
          </div>

          {/* ── KPI Grid ── */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 10px' }}>QR Status</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
              <KpiCard label="Total Generated" value={stats.totalGenerated}  icon={<QrCode size={16} strokeWidth={2} />}       accent="#6366F1" onClick={() => onNavigate?.('search')} />
              <KpiCard label="Active QR"       value={stats.activeQR}        icon={<CheckCircle2 size={16} strokeWidth={2} />} accent={SAFE}    sub="plays remaining" onClick={() => onNavigate?.('search')} />
              <KpiCard label="Disabled"        value={stats.disabledQR}      icon={<Ban size={16} strokeWidth={2} />}          accent="#DC2626" sub="active=false" />
              <KpiCard label="Exhausted"       value={stats.exhaustedQR ?? 0}icon={<AlertTriangle size={16} strokeWidth={2} />}accent="#F97316" sub="all plays used" />
              <KpiCard label="Unused"          value={stats.unusedQR}        icon={<PackageOpen size={16} strokeWidth={2} />}  accent="#6B7280" sub="playCount=0" />
              <KpiCard label="Golden QR"       value={stats.goldenQR}        icon={<ShieldCheck size={16} strokeWidth={2} />}  accent="#D97706" />
              <KpiCard label="Developer QR"    value={stats.developerQR}     icon={<Code2 size={16} strokeWidth={2} />}        accent="#4F46E5" />
            </div>
          </div>

          {/* ── Scan Metrics ── */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.5, margin: '0 0 10px' }}>Scan Metrics</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
              <KpiCard label="Today"      value={stats.scannedToday}       icon={<ScanLine size={16} strokeWidth={2} />}   accent={RED}      sub="real-time" />
              <KpiCard label="This Week"  value={stats.scannedThisWeek}    icon={<BarChart2 size={16} strokeWidth={2} />}  accent="#0891B2"  sub="last 7 days" />
              <KpiCard label="This Month" value={stats.scannedThisMonth}   icon={<TrendingUp size={16} strokeWidth={2} />} accent="#7C3AED"  sub="last 30 days" />
            </div>
          </div>

          {/* ── Charts Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>

            {/* Daily scans bar chart */}
            <DashCard title="Daily Scans" subtitle="Last 7 days" icon={<BarChart2 size={15} />}>
              <MiniBarChart data={last7} color={RED} />
            </DashCard>

            {/* Donut — QR status distribution */}
            <DashCard title="QR Status Distribution" subtitle="Live breakdown" icon={<Layers3 size={15} />}>
              <DonutChart segments={[
                { label: 'Active',    value: stats.activeQR,         color: SAFE      },
                { label: 'Exhausted', value: stats.exhaustedQR ?? 0, color: '#F97316' },
                { label: 'Disabled',  value: stats.disabledQR,       color: '#DC2626' },
                { label: 'Unused',    value: stats.unusedQR,         color: '#9CA3AF' },
              ]} />
            </DashCard>

            {/* System health */}
            <DashCard title="System Health" subtitle="Live status" icon={<Wifi size={15} />}>
              <HealthRow icon={<Server size={13} />}   label="Firestore"        status="Online"  ok />
              <HealthRow icon={<Key size={13} />}      label="Authentication"   status="Online"  ok />
              <HealthRow icon={<QrCode size={13} />}   label="QR Validation"    status="Healthy" ok />
              <HealthRow icon={<Link2 size={13} />}    label="Game Link"        status={gameLink !== 'Not set' ? 'Mapped' : 'Not set'} ok={gameLink !== 'Not set'} />
              <HealthRow icon={<HardDrive size={13} />}label="Export Service"   status="Ready"   ok />
            </DashCard>
          </div>

          {/* ── Bottom Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>

            {/* Recent batches table */}
            <DashCard title="Recent Batches" subtitle="Latest generated" icon={<Layers3 size={15} />} action="View All" onAction={() => onNavigate?.('tracker')}>
              <RecentBatches codes={codes} />
            </DashCard>

            {/* Quick stats */}
            <DashCard title="Quick Stats" subtitle="Aggregated insights" icon={<Zap size={15} />}>
              <QuickStat label="Average Scans / QR"  value={avgScans} />
              <QuickStat label="Total Plays Remaining" value={totalLeft.toLocaleString()} />
              <QuickStat label="Most Used QR"         value={mostUsed?.code ?? '—'} />
              <QuickStat label="Latest Batch"         value={latestBatch} />
              <QuickStat label="Total Codes"          value={codes.length.toLocaleString()} />
              <QuickStat label="Golden / Developer"   value={`${stats.goldenQR} / ${stats.developerQR}`} />
            </DashCard>

            {/* Recent QR activity */}
            <DashCard title="Recent QR Activity" subtitle="Latest 10 codes" icon={<Clock size={15} />} action="Search" onAction={() => onNavigate?.('search')}>
              {recentActivity.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, textAlign: 'center', padding: '12px 0' }}>No QR codes yet.</p>
              ) : recentActivity.map((c, i) => (
                <ActivityItem
                  key={c.code + i}
                  icon={<QrCode size={13} />}
                  color={c.active && c.playCount < 999999 ? (c.playCount === 0 ? '#6366F1' : SAFE) : '#DC2626'}
                  title={c.code}
                  sub={`${c.batch || '—'} · ${c.type} · ${c.playCount} plays`}
                  time={fmtDate(c.createdAt)}
                />
              ))}
            </DashCard>
          </div>
        </>
      )}

      <style>{`
        @keyframes dbSlide { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        @keyframes dbSpin  { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
