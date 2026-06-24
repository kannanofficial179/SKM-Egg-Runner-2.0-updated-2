import React from 'react';
import type { QRDashboardStats } from '../../types/qr/qrManagementTypes';

const RED = '#D71920';

interface StatCardProps {
  label:   string;
  value:   number | string;
  icon:    string;
  accent?: string;
  error?:  boolean;
}

function StatCard({ label, value, icon, accent = RED, error }: StatCardProps) {
  return (
    <div style={{
      background: error ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${error ? 'rgba(239,68,68,0.3)' : 'rgba(215,25,32,0.18)'}`,
      borderRadius: 16, padding: '18px 16px',
      display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: `${accent}22`, border: `1px solid ${accent}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{icon}</div>
      <div style={{
        fontSize: error ? 11 : 24, fontWeight: 900,
        color: error ? '#f87171' : '#fff', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
    </div>
  );
}

interface Props {
  stats:    QRDashboardStats;
  loading:  boolean;
  error?:   string | null;
}

export default function QRDashboard({ stats, loading, error }: Props) {
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 110, borderRadius: 16, background: 'rgba(255,255,255,0.04)', animation: 'dbpulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
          {cards.map(c => (
            <StatCard key={c.label} {...c} error={!!error} />
          ))}
        </div>
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
