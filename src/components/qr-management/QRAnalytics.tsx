import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { QRAnalyticsData } from '../../types/qr/qrManagementTypes';
import { fetchAnalytics } from '../../services/qr/qrManagementService';

const RED = '#D71920';

type Period = 'daily' | 'weekly' | 'monthly';

function BarChart({ data }: { data: QRAnalyticsData[] }) {
  if (!data.length) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
        No scan data yet. Scans appear here after QR codes are used.
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.scans), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700 }}>{d.scans > 0 ? d.scans : ''}</div>
          <div style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            height: `${Math.max((d.scans / max) * 90, d.scans > 0 ? 4 : 1)}%`,
            background: d.scans > 0 ? `linear-gradient(180deg,${RED},#B51218)` : '#F3F4F6',
            transition: 'height 600ms cubic-bezier(0.34,1.56,0.64,1)',
          }} />
          <div style={{ fontSize: 8, color: '#9CA3AF', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function QRAnalytics() {
  const [period,  setPeriod]  = useState<Period>('daily');
  const [data,    setData]    = useState<{ daily: QRAnalyticsData[]; weekly: QRAnalyticsData[]; monthly: QRAnalyticsData[] }>({ daily: [], weekly: [], monthly: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetchAnalytics()
      .then(result => { setData(result); })
      .catch(err   => { setError(err?.message ?? 'Failed to load analytics'); })
      .finally(()  => setLoading(false));
  }, []);

  const tabs: { key: Period; label: string }[] = [
    { key: 'daily',   label: 'Last 7 Days' },
    { key: 'weekly',  label: 'By Week'     },
    { key: 'monthly', label: 'By Month'    },
  ];

  const activeData = data[period];
  const total = activeData.reduce((s, d) => s + d.scans, 0);

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Analytics</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>QR scan trends over time</p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

        {error && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AlertTriangle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ color: '#DC2626', fontSize: 12, fontWeight: 700, margin: 0 }}>Analytics Error</p>
              <p style={{ color: '#EF4444', fontSize: 11, margin: '2px 0 0', fontFamily: 'monospace' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setPeriod(t.key)} style={{
              padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              border: period === t.key ? 'none' : '1px solid #E5E7EB',
              cursor: 'pointer', transition: 'all 150ms',
              background: period === t.key ? RED : '#F9FAFB',
              color:      period === t.key ? '#fff' : '#6B7280',
              boxShadow:  period === t.key ? `0 2px 8px ${RED}30` : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ height: 140, background: '#F3F4F6', borderRadius: 10, animation: 'anpulse 1.5s infinite' }} />
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 30, fontWeight: 900, color: '#1A1A1A' }}>{total}</span>
              <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 8 }}>
                total scans · {period === 'daily' ? 'last 7 days' : period === 'weekly' ? 'last 4 weeks' : 'last 6 months'}
              </span>
            </div>
            {/* Grid background */}
            <div style={{ position: 'relative', background: '#FAFAFA', borderRadius: 12, padding: '16px 12px 8px', border: '1px solid #F3F4F6' }}>
              <BarChart data={activeData} />
            </div>

            {total === 0 && (
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Info size={14} color="#16A34A" />
                <p style={{ color: '#15803D', fontSize: 11, margin: 0 }}>
                  Scan data is written to <code style={{ fontFamily: 'monospace', fontSize: 10 }}>dailyScans</code> when a QR is used in-game.
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes anpulse { 0%,100%{opacity:0.6} 50%{opacity:1} }`}</style>
    </section>
  );
}
