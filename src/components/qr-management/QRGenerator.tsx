import React, { useState } from 'react';
import type { QRCodeType, QRGeneratorForm } from '../../types/qr/qrManagementTypes';
import { generateQRCodes } from '../../services/qr/qrManagementService';

const RED = '#D71920';

const QR_TYPES: QRCodeType[] = ['Regular', 'Golden', 'Campaign', 'Developer'];

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 12, fontSize: 13,
  background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)',
  color: '#fff', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui,-apple-system,sans-serif',
};

interface Props {
  onGenerated: () => void;
}

export default function QRGenerator({ onGenerated }: Props) {
  const [form, setForm] = useState<QRGeneratorForm>({
    prefix: 'SKM', quantity: 10, maxPlays: 2, type: 'Regular',
  });
  const [loading, setLoading]   = useState(false);
  const [result,  setResult]    = useState<string | null>(null);
  const [error,   setError]     = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!form.prefix.trim()) { setError('Prefix is required.'); return; }
    if (form.quantity < 1 || form.quantity > 500) { setError('Quantity must be 1–500.'); return; }
    if (form.maxPlays < 1) { setError('Max Plays must be at least 1.'); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const codes = await generateQRCodes(form.prefix, form.quantity, form.maxPlays, form.type);
      setResult(`${codes.length} QR codes generated successfully.`);
      onGenerated();
    } catch (e: any) {
      setError(e?.message ?? 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        QR Generator
      </h2>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)',
        borderRadius: 18, padding: '20px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 16 }}>
          {/* Prefix */}
          <div>
            <label style={labelStyle}>QR Prefix</label>
            <input
              style={inputStyle}
              value={form.prefix}
              onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
              placeholder="e.g. SKM"
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {/* Quantity */}
          <div>
            <label style={labelStyle}>Quantity</label>
            <input
              style={inputStyle}
              type="number"
              min={1} max={500}
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {/* Max Plays */}
          <div>
            <label style={labelStyle}>Max Plays</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              value={form.maxPlays}
              onChange={e => setForm(f => ({ ...f, maxPlays: Number(e.target.value) }))}
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>

          {/* QR Type */}
          <div>
            <label style={labelStyle}>QR Type</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as QRCodeType }))}
            >
              {QR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {error  && <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 12px', fontWeight: 600 }}>{error}</p>}
        {result && <p style={{ color: '#4ade80', fontSize: 12, margin: '0 0 12px', fontWeight: 600 }}>{result}</p>}

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            background: loading ? 'rgba(215,25,32,0.4)' : `linear-gradient(135deg,${RED},#8B0000)`,
            color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px',
            fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(215,25,32,0.4)',
            transition: 'all 150ms',
          }}
        >
          {loading ? 'Generating…' : 'Generate QR'}
        </button>
      </div>
    </section>
  );
}
