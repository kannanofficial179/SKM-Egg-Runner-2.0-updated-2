import React from 'react';
import type { QRDashboardStats } from '../../types/qr/qrManagementTypes';

const RED = '#D71920';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: string;
  accent?: string;
}

function StatCard({ label, value, icon, accent = RED }: StatCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid rgba(215,25,32,0.18)`,
      borderRadius: 16,
      padding: '18px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 0,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${accent}22`,
        border: `1px solid ${accent}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

interface Props {
  stats: QRDashboardStats;
  loading: boolean;
}

export default function QRDashboard({ stats, loading }: Props) {
  const cards = [
    { label: 'Total Generated', value: stats.totalGenerated, icon: '🔢', accent: '#6366f1' },
    { label: 'Active QR',       value: stats.activeQR,       icon: '✅', accent: '#22c55e' },
    { label: 'Disabled QR',     value: stats.disabledQR,     icon: '🚫', accent: '#ef4444' },
    { label: 'Golden QR',       value: stats.goldenQR,       icon: '⭐', accent: '#f59e0b' },
    { label: 'Scanned Today',   value: stats.scannedToday,   icon: '📡', accent: RED       },
    { label: 'Unused QR',       value: stats.unusedQR,       icon: '🆕', accent: '#64748b' },
  ];

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        Dashboard
      </h2>
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 110, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          {cards.map(c => <StatCard key={c.label} {...c} />)}
        </div>
      )}
    </section>
  );
}
