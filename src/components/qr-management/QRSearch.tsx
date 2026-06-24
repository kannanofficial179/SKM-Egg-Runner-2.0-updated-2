import React, { useState, useEffect } from 'react';
import type { QRCodeRecord, QRSearchFilters } from '../../types/qr/qrManagementTypes';
import { searchQRCodes, setQRActive } from '../../services/qr/qrManagementService';

const RED = '#D71920';

const inputStyle: React.CSSProperties = {
  padding: '10px 13px', borderRadius: 10, fontSize: 12,
  background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)',
  color: '#fff', outline: 'none', boxSizing: 'border-box', flex: 1, minWidth: 120,
  fontFamily: 'system-ui,-apple-system,sans-serif',
};

function StatusBadge({ active, playCount, maxPlays }: { active: boolean; playCount: number; maxPlays: number }) {
  if (!active) return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 700 }}>Disabled</span>;
  if (playCount >= maxPlays) return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(100,116,139,0.2)', color: '#94a3b8', fontWeight: 700 }}>Exhausted</span>;
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(34,197,94,0.2)', color: '#4ade80', fontWeight: 700 }}>Active</span>;
}

export default function QRSearch() {
  const [filters, setFilters] = useState<QRSearchFilters>({ qrId: '', batch: '', status: '' });
  const [results, setResults] = useState<QRCodeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true); setSearched(true);
    try {
      const res = await searchQRCodes(filters);
      setResults(res);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (code: string, currentActive: boolean) => {
    setToggling(code);
    try {
      await setQRActive(code, !currentActive);
      setResults(r => r.map(q => q.code === code ? { ...q, active: !currentActive } : q));
    } finally {
      setToggling(null);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        QR Search
      </h2>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)', borderRadius: 18, padding: 20 }}>
        {/* Filters row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <input
            style={inputStyle}
            placeholder="Search by QR ID…"
            value={filters.qrId}
            onChange={e => setFilters(f => ({ ...f, qrId: e.target.value }))}
            onFocus={e => (e.target.style.borderColor = RED)}
            onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <input
            style={inputStyle}
            placeholder="Search by Batch…"
            value={filters.batch}
            onChange={e => setFilters(f => ({ ...f, batch: e.target.value }))}
            onFocus={e => (e.target.style.borderColor = RED)}
            onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <select
            style={{ ...inputStyle, cursor: 'pointer', minWidth: 130 }}
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="exhausted">Exhausted</option>
          </select>
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{
              background: `linear-gradient(135deg,${RED},#8B0000)`,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 20px', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', letterSpacing: 1,
            }}
          >
            {loading ? '…' : 'Search'}
          </button>
        </div>

        {/* Results table */}
        {searched && !loading && (
          results.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center', padding: 20 }}>No QR codes found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Code', 'Type', 'Batch', 'Plays', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 50).map(qr => (
                    <tr key={qr.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '9px 10px', color: '#fff', fontFamily: 'monospace' }}>{qr.code}</td>
                      <td style={{ padding: '9px 10px', color: 'rgba(255,255,255,0.6)' }}>{qr.type}</td>
                      <td style={{ padding: '9px 10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 10 }}>{qr.batch || '—'}</td>
                      <td style={{ padding: '9px 10px', color: 'rgba(255,255,255,0.6)' }}>{qr.playCount}/{qr.maxPlays}</td>
                      <td style={{ padding: '9px 10px' }}><StatusBadge active={qr.active} playCount={qr.playCount} maxPlays={qr.maxPlays} /></td>
                      <td style={{ padding: '9px 10px' }}>
                        <button
                          disabled={toggling === qr.code}
                          onClick={() => handleToggle(qr.code, qr.active)}
                          style={{
                            fontSize: 10, padding: '4px 10px', borderRadius: 8, border: 'none',
                            cursor: 'pointer', fontWeight: 700,
                            background: qr.active ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                            color: qr.active ? '#f87171' : '#4ade80',
                          }}
                        >
                          {toggling === qr.code ? '…' : qr.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.length > 50 && (
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '10px 0 0', textAlign: 'center' }}>
                  Showing first 50 of {results.length} results. Refine your search to narrow down.
                </p>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}
