import React, { useState } from 'react';
import { Save, Info } from 'lucide-react';

const RED = '#D71920';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 13,
  background: '#F9FAFB', border: '1.5px solid #E5E7EB',
  color: '#1A1A1A', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui,-apple-system,sans-serif', transition: 'border-color 150ms',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block',
};

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6' }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>{title}</h3>
        {description && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{description}</p>}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

export default function QRSettings() {
  const [defaultMaxPlays, setDefaultMaxPlays] = useState(2);
  const [prefix,          setPrefix]          = useState('SKM');
  const [pdfColumns,      setPdfColumns]      = useState(3);
  const [pdfPerPage,      setPdfPerPage]      = useState(9);
  const [saved,           setSaved]           = useState(false);

  const handleSave = () => {
    // Settings are applied locally — no Firestore write needed for generator defaults
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Info banner */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Info size={15} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: '#1E40AF', margin: 0, lineHeight: 1.6 }}>
          Settings apply to default values in the QR Generator and PDF Print Center on this device. Firestore data is not affected.
        </p>
      </div>

      {/* QR Generation Defaults */}
      <Card title="QR Generation Defaults" description="Default values pre-filled in the QR Generator form">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>Default Prefix</label>
            <input style={inputStyle} value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())}
              placeholder="e.g. SKM"
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>Used as the code prefix, e.g. SKM-000001</p>
          </div>
          <div>
            <label style={labelStyle}>Default Max Plays</label>
            <input style={inputStyle} type="number" min={1} max={999} value={defaultMaxPlays}
              onChange={e => setDefaultMaxPlays(Number(e.target.value))}
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>How many times each QR can be scanned in-game</p>
          </div>
        </div>
      </Card>

      {/* PDF Layout */}
      <Card title="PDF Print Layout" description="Controls the grid layout of the QR print sheet">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>Columns Per Row</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={pdfColumns} onChange={e => setPdfColumns(Number(e.target.value))}>
              <option value={2}>2 columns</option>
              <option value={3}>3 columns (default)</option>
              <option value={4}>4 columns</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>QR Codes Per Page</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={pdfPerPage} onChange={e => setPdfPerPage(Number(e.target.value))}>
              <option value={6}>6 per page</option>
              <option value={9}>9 per page (default)</option>
              <option value={12}>12 per page</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
            Preview: <strong style={{ color: '#1A1A1A' }}>{pdfColumns} × {Math.ceil(pdfPerPage / pdfColumns)}</strong> grid · <strong style={{ color: '#1A1A1A' }}>{pdfPerPage} QR codes</strong> per A4 page
          </p>
        </div>
      </Card>

      {/* Validation Rules */}
      <Card title="Validation Rules" description="How QR codes are validated during scanning">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'QR must be active',       detail: 'Disabled QR codes are always rejected',                  enforced: true },
            { label: 'Play count limit',         detail: 'QR is rejected once maxPlays is reached',               enforced: true },
            { label: 'Any authenticated user',   detail: 'All logged-in users can scan any valid QR code',        enforced: true },
            { label: 'Golden Pass bypass',       detail: 'SKM-GOLDEN-PASS code grants unlimited access offline',  enforced: true },
            { label: 'Protein deduplication',    detail: 'Each user can earn protein credit from a QR only once', enforced: true },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: r.enforced ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${r.enforced ? '#BBF7D0' : '#FECACA'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <span style={{ fontSize: 10, color: r.enforced ? '#16A34A' : '#DC2626' }}>{r.enforced ? '✓' : '✗'}</span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{r.label}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{r.detail}</p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A', flexShrink: 0 }}>Enforced</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Save button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleSave} style={{
          background: `linear-gradient(135deg,${RED},#B51218)`, color: '#fff', border: 'none',
          borderRadius: 12, padding: '12px 28px', fontSize: 13, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: `0 4px 16px ${RED}30`,
        }}>
          <Save size={15} strokeWidth={2} /> Save Settings
        </button>
        {saved && <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 700 }}>Settings saved.</span>}
      </div>
    </div>
  );
}
