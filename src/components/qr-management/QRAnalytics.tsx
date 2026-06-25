import React, { useEffect, useState } from 'react';
import type { QRAnalyticsData } from '../../types/qr/qrManagementTypes';
import { fetchAnalytics } from '../../services/qr/qrManagementService';

const RED = '#D71920';

type Period = 'daily' | 'weekly' | 'monthly';

function BarChart({ data }: { data: QRAnalyticsData[] }) {
  if (!data.length) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
        No scan data yet. Scans appear here after QR codes are used.
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.scans), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
            {d.scans > 0 ? d.scans : ''}
          </div>
          <div style={{
            width: '100%', borderRadius: '4px 4px 0 0',
            height: `${Math.max((d.scans / max) * 90, d.scans > 0 ? 4 : 1)}%`,
            background: d.scans > 0
              ? `linear-gradient(180deg,${RED},#8B0000)`
              : 'rgba(255,255,255,0.07)',
            transition: 'height 600ms cubic-bezier(0.34,1.56,0.64,1)',
          }} />
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
            {d.label}
          </div>
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
    setLoading(true);
    setError(null);
    fetchAnalytics()
      .then(result => {
        console.log('[QR Analytics] daily:', result.daily);
        console.log('[QR Analytics] weekly:', result.weekly);
        console.log('[QR Analytics] monthly:', result.monthly);
        setData(result);
      })
      .catch(err => {
        console.error('[QR Analytics] fetchAnalytics failed:', err?.message);
        setError(err?.message ?? 'Failed to load analytics');
      })
      .finally(() => setLoading(false));
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
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        Analytics
      </h2>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)', borderRadius: 18, padding: 20 }}>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <div>
              <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, margin: 0 }}>Analytics Error</p>
              <p style={{ color: 'rgba(248,113,113,0.7)', fontSize: 11, margin: '2px 0 0', fontFamily: 'monospace' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setPeriod(t.key)} style={{
              padding: '7px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 150ms',
              background: period === t.key ? RED : 'rgba(255,255,255,0.06)',
              color: period === t.key ? '#fff' : 'rgba(255,255,255,0.5)',
              boxShadow: period === t.key ? `0 4px 12px ${RED}55` : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ height: 140, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'anpulse 1.5s infinite' }} />
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{total}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
                total scans · {period === 'daily' ? 'last 7 days' : period === 'weekly' ? 'last 4 weeks' : 'last 6 months'}
              </span>
            </div>
            <BarChart data={activeData} />

            {total === 0 && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: 0 }}>
                  💡 Scan data is written to <code style={{ fontFamily: 'monospace' }}>dailyScans</code> field in each qrCodes document when a QR is used in-game.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`@keyframes anpulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
    </section>
  );
}
