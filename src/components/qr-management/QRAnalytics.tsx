import React, { useEffect, useState } from 'react';
import type { QRAnalyticsData } from '../../types/qr/qrManagementTypes';
import { fetchAnalytics } from '../../services/qr/qrManagementService';

const RED = '#D71920';

type Period = 'daily' | 'weekly' | 'monthly';

function BarChart({ data }: { data: QRAnalyticsData[] }) {
  if (!data.length) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
        No scan data yet.
      </div>
    );
  }

  const max = Math.max(...data.map(d => d.scans), 1);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            {d.scans > 0 ? d.scans : ''}
          </div>
          <div
            style={{
              width: '100%', borderRadius: '4px 4px 0 0',
              height: `${(d.scans / max) * 90}%`,
              minHeight: d.scans > 0 ? 4 : 2,
              background: d.scans > 0
                ? `linear-gradient(180deg,${RED},#8B0000)`
                : 'rgba(255,255,255,0.07)',
              transition: 'height 600ms cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
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

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tabs: { key: Period; label: string }[] = [
    { key: 'daily',   label: 'Daily Scans'   },
    { key: 'weekly',  label: 'Weekly Scans'  },
    { key: 'monthly', label: 'Monthly Scans' },
  ];

  const activeData = data[period];
  const total = activeData.reduce((s, d) => s + d.scans, 0);

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        Analytics
      </h2>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)', borderRadius: 18, padding: 20 }}>
        {/* Period tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              style={{
                padding: '7px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 150ms',
                background: period === t.key ? RED : 'rgba(255,255,255,0.06)',
                color: period === t.key ? '#fff' : 'rgba(255,255,255,0.5)',
                boxShadow: period === t.key ? `0 4px 12px ${RED}55` : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ height: 140, background: 'rgba(255,255,255,0.03)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
        ) : (
          <>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{total}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 6 }}>total scans</span>
            </div>
            <BarChart data={activeData} />
          </>
        )}
      </div>
    </section>
  );
}
