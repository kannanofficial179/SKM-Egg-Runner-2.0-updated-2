import React from 'react';
import {
  QrCode, CheckCircle2, Ban, PackageOpen, ShieldCheck, Code2,
  ScanLine, BarChart2, TrendingUp, AlertTriangle, Circle,
} from 'lucide-react';
import type { QRDashboardStats } from '../../types/qr/qrManagementTypes';

const RED = '#D71920';

interface StatCardProps {
  label:   string;
  value:   number | string;
  icon:    React.ReactNode;
  accent?: string;
  sub?:    string;
}

function StatCard({ label, value, icon, accent = RED, sub }: StatCardProps) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: 16, padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}12`, border: `1px solid ${accent}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
      }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: '#C4C9D4', fontWeight: 500 }}>{sub}</div>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      height: 110, borderRadius: 16, background: '#F3F4F6', border: '1px solid #E5E7EB',
      animation: 'dbpulse 1.5s ease-in-out infinite',
    }} />
  );
}

interface Props {
  stats:   QRDashboardStats;
  loading: boolean;
  error?:  string | null;
}

export default function QRDashboard({ stats, loading, error }: Props) {
  const primaryCards = [
    { label: 'Total Generated',  value: stats.totalGenerated,  icon: <QrCode       size={18} strokeWidth={2} />, accent: '#6366f1' },
    { label: 'Active QR',        value: stats.activeQR,        icon: <CheckCircle2 size={18} strokeWidth={2} />, accent: '#16A34A' },
    { label: 'Disabled QR',      value: stats.disabledQR,      icon: <Ban          size={18} strokeWidth={2} />, accent: '#DC2626',  sub: 'active=false' },
    { label: 'Exhausted QR',     value: stats.exhaustedQR ?? 0,icon: <AlertTriangle size={18} strokeWidth={2} />, accent: '#D97706', sub: 'all plays used' },
    { label: 'Unused QR',        value: stats.unusedQR,        icon: <PackageOpen  size={18} strokeWidth={2} />, accent: '#6B7280' },
    { label: 'Golden QR',        value: stats.goldenQR,        icon: <ShieldCheck  size={18} strokeWidth={2} />, accent: '#D97706' },
    { label: 'Developer QR',     value: stats.developerQR,     icon: <Code2        size={18} strokeWidth={2} />, accent: '#4F46E5' },
  ];

  const scanCards = [
    { label: 'Scanned Today',      value: stats.scannedToday,      icon: <ScanLine   size={18} strokeWidth={2} />, accent: RED,       sub: 'real-time' },
    { label: 'Scanned This Week',  value: stats.scannedThisWeek,   icon: <BarChart2  size={18} strokeWidth={2} />, accent: '#0891B2', sub: 'last 7 days' },
    { label: 'Scanned This Month', value: stats.scannedThisMonth,  icon: <TrendingUp size={18} strokeWidth={2} />, accent: '#7C3AED', sub: 'last 30 days' },
  ];

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Dashboard</h2>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Live QR statistics</p>
        </div>
        {stats.lastSync && !loading && (
          <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Circle size={7} fill="#16A34A" color="#16A34A" /> Live · synced {stats.lastSync}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA',
          borderRadius: 12, padding: '10px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ color: '#DC2626', fontSize: 12, fontWeight: 700, margin: 0 }}>Load Error</p>
            <p style={{ color: '#EF4444', fontSize: 11, margin: '2px 0 0', fontFamily: 'monospace' }}>{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
            {primaryCards.map(c => <StatCard key={c.label} {...c} />)}
          </div>

          <div style={{
            background: '#FFF7F7', border: `1px solid ${RED}20`,
            borderRadius: 12, padding: '10px 14px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <ScanLine size={14} color={RED} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }}>
              Scan counts from <code style={{ fontFamily: 'monospace', color: RED, fontSize: 10 }}>dailyScans</code> field — updated on every game scan
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
            {scanCards.map(c => <StatCard key={c.label} {...c} />)}
          </div>
        </>
      )}

      <style>{`
        @keyframes dbpulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
      `}</style>
    </section>
  );
}
