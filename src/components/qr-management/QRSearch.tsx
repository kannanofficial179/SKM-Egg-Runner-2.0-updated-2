import React, { useState } from 'react';
import { Search } from 'lucide-react';
import type { QRCodeRecord, QRSearchFilters } from '../../types/qr/qrManagementTypes';
import { searchQRCodes, setQRActive } from '../../services/qr/qrManagementService';

const RED = '#D71920';

const inputStyle: React.CSSProperties = {
  padding: '10px 13px', borderRadius: 10, fontSize: 12,
  background: '#F9FAFB', border: '1.5px solid #E5E7EB',
  color: '#1A1A1A', outline: 'none', boxSizing: 'border-box', flex: 1, minWidth: 120,
  fontFamily: 'system-ui,-apple-system,sans-serif', transition: 'border-color 150ms',
};

function StatusBadge({ active, playCount, maxPlays }: { active: boolean; playCount: number; maxPlays: number }) {
  if (!active)               return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#FEF2F2', color: '#DC2626', fontWeight: 700, border: '1px solid #FECACA' }}>Disabled</span>;
  if (playCount >= maxPlays) return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280', fontWeight: 700, border: '1px solid #E5E7EB' }}>Exhausted</span>;
  return                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#F0FDF4', color: '#16A34A', fontWeight: 700, border: '1px solid #BBF7D0' }}>Active</span>;
}

export default function QRSearch() {
  const [filters,  setFilters]  = useState<QRSearchFilters>({ qrId: '', batch: '', status: '' });
  const [results,  setResults]  = useState<QRCodeRecord[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true); setSearched(true);
    try { setResults(await searchQRCodes(filters)); }
    finally { setLoading(false); }
  };

  const handleToggle = async (code: string, currentActive: boolean) => {
    setToggling(code);
    try {
      await setQRActive(code, !currentActive);
      setResults(r => r.map(q => q.code === code ? { ...q, active: !currentActive } : q));
    } finally { setToggling(null); }
  };

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>QR Search</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Find and manage individual QR codes</p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <input style={inputStyle} placeholder="Search by QR ID…"
            value={filters.qrId} onChange={e => setFilters(f => ({ ...f, qrId: e.target.value }))}
            onFocus={e => (e.target.style.borderColor = RED)}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <input style={inputStyle} placeholder="Search by Batch…"
            value={filters.batch} onChange={e => setFilters(f => ({ ...f, batch: e.target.value }))}
            onFocus={e => (e.target.style.borderColor = RED)}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <select style={{ ...inputStyle, cursor: 'pointer', minWidth: 140 }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="exhausted">Exhausted</option>
          </select>
          <button onClick={handleSearch} disabled={loading} style={{
            background: loading ? '#F3F4F6' : `linear-gradient(135deg,${RED},#B51218)`,
            color: loading ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 10,
            padding: '10px 20px', fontSize: 12, fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: loading ? 'none' : `0 2px 8px ${RED}30`,
          }}>
            {loading
              ? <span style={{ width: 13, height: 13, border: '2px solid #D1D5DB', borderTopColor: RED, borderRadius: '50%', animation: 'srchspin 0.7s linear infinite', display: 'inline-block' }} />
              : <Search size={14} strokeWidth={2.5} />}
            {loading ? '…' : 'Search'}
          </button>
        </div>

        {searched && !loading && (
          results.length === 0 ? (
            <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0', margin: 0 }}>No QR codes found.</p>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E5E7EB' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['Code', 'Type', 'Batch', 'Plays', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 50).map((qr, i) => (
                    <tr key={qr.id} style={{ borderBottom: i < results.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FFF5F5')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '10px 12px', color: '#1A1A1A', fontFamily: 'monospace', fontWeight: 700 }}>{qr.code}</td>
                      <td style={{ padding: '10px 12px', color: '#374151' }}>{qr.type}</td>
                      <td style={{ padding: '10px 12px', color: '#9CA3AF', fontFamily: 'monospace', fontSize: 10 }}>{qr.batch || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#6B7280' }}>{qr.playCount}/{qr.maxPlays}</td>
                      <td style={{ padding: '10px 12px' }}><StatusBadge active={qr.active} playCount={qr.playCount} maxPlays={qr.maxPlays} /></td>
                      <td style={{ padding: '10px 12px' }}>
                        <button disabled={toggling === qr.code} onClick={() => handleToggle(qr.code, qr.active)} style={{
                          fontSize: 11, padding: '5px 12px', borderRadius: 8,
                          border: `1px solid ${qr.active ? '#FECACA' : '#BBF7D0'}`,
                          cursor: 'pointer', fontWeight: 700,
                          background: qr.active ? '#FEF2F2' : '#F0FDF4',
                          color:      qr.active ? '#DC2626' : '#16A34A',
                        }}>
                          {toggling === qr.code ? '…' : qr.active ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {results.length > 50 && (
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '10px 14px', textAlign: 'center' }}>
                  Showing first 50 of {results.length} results. Refine your search.
                </p>
              )}
            </div>
          )
        )}
      </div>
      <style>{`@keyframes srchspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
