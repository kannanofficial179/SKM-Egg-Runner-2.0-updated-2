import React from 'react';
import type { QRDashboardStats } from '../../types/qr/qrManagementTypes';

const RED = '#D71920';

interface StatCardProps {
  label:   string;
  value:   number | string;
  icon:    string;
  accent?: string;
  sub?:    string;
}

function StatCard({ label, value, icon, accent = RED, sub }: StatCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid rgba(215,25,32,0.18)`,
      borderRadius: 16, padding: '16px 14px',
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}22`, border: `1px solid ${accent}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
      }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>{sub}</div>
      )}
    </div>
  );
}

interface Props {
  stats:   QRDashboardStats;
  loading: boolean;
  error?:  string | null;
}

export default function QRDashboard({ stats, loading, error }: Props) {
  const primaryCards = [
    { label: 'Total Generated',  value: stats.totalGenerated,   icon: '🔢', accent: '#6366f1' },
    { label: 'Active QR',        value: stats.activeQR,         icon: '✅', accent: '#22c55e' },
    { label: 'Disabled QR',      value: stats.disabledQR,       icon: '🚫', accent: '#ef4444' },
    { label: 'Unused QR',        value: stats.unusedQR,         icon: '🆕', accent: '#64748b' },
    { label: 'Golden QR',        value: stats.goldenQR,         icon: '⭐', accent: '#f59e0b' },
    { label: 'Developer QR',     value: stats.developerQR,      icon: '🛠️', accent: '#818cf8' },
  ];

  const scanCards = [
    { label: 'Scanned Today',      value: stats.scannedToday,       icon: '📡', accent: RED,       sub: 'real-time' },
    { label: 'Scanned This Week',  value: stats.scannedThisWeek,    icon: '📊', accent: '#06b6d4', sub: 'last 7 days' },
    { label: 'Scanned This Month', value: stats.scannedThisMonth,   icon: '📈', accent: '#8b5cf6', sub: 'last 30 days' },
  ];

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
          Dashboard
        </h2>
        {stats.lastSync && !loading && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
            🟢 Live · synced {stats.lastSync}
          </span>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, margin: 0 }}>Load Error</p>
            <p style={{ color: 'rgba(248,113,113,0.7)', fontSize: 11, margin: '2px 0 0', fontFamily: 'monospace' }}>{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 110, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'dbpulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ height: 110, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'dbpulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* QR Count cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 10 }}>
            {primaryCards.map(c => <StatCard key={c.label} {...c} />)}
          </div>

          {/* Scan stats row */}
          <div style={{
            background: 'rgba(215,25,32,0.04)', border: '1px solid rgba(215,25,32,0.15)',
            borderRadius: 14, padding: '10px 14px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 13 }}>📡</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Scan Counts — sourced from <code style={{ fontFamily: 'monospace', color: RED }}>dailyScans</code> field in qrCodes
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10 }}>
            {scanCards.map(c => <StatCard key={c.label} {...c} />)}
          </div>
        </>
      )}

      <style>{`
        @keyframes dbpulse {
          0%,100% { opacity: 0.4; }
          50%      { opacity: 0.8; }
        }
      `}</style>
    </section>
  );
}
