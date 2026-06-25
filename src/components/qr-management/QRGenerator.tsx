import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Plus, Download, CheckCircle2, XCircle } from 'lucide-react';
import type { QRCodeType, QRGeneratorForm } from '../../types/qr/qrManagementTypes';
import { generateQRCodes } from '../../services/qr/qrManagementService';

const RED = '#D71920';

const QR_TYPES: QRCodeType[] = ['Regular', 'Golden', 'Campaign', 'Developer'];

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#374151',
  marginBottom: 6, display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 13,
  background: '#F9FAFB', border: '1.5px solid #E5E7EB',
  color: '#1A1A1A', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui,-apple-system,sans-serif',
  transition: 'border-color 150ms',
};

interface QRPreviewItem { code: string; url: string; dataUrl: string; }

async function renderQRtoPNG(url: string, _code: string, type: QRCodeType): Promise<string> {
  const SIZE = 300; const MARGIN = 20;
  const qrDataUrl: string = await QRCode.toDataURL(url, {
    width: SIZE, margin: 1,
    color: { dark: type === 'Golden' ? '#B45309' : '#1a0000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
  const canvas = document.createElement('canvas');
  canvas.width = SIZE + MARGIN * 2; canvas.height = SIZE + MARGIN * 2;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, MARGIN, MARGIN, SIZE, SIZE); resolve(); };
    img.onerror = reject; img.src = qrDataUrl;
  });
  return canvas.toDataURL('image/png');
}

function downloadPNG(dataUrl: string, code: string): void {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = `${code}.png`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

interface Props { onGenerated: () => void; }

export default function QRGenerator({ onGenerated }: Props) {
  const [form, setForm] = useState<QRGeneratorForm>({ prefix: 'SKM', quantity: 1, maxPlays: 2, type: 'Regular' });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [previews, setPreviews] = useState<QRPreviewItem[]>([]);

  const handleGenerate = async () => {
    if (!form.prefix.trim())                      { setError('Prefix is required.'); return; }
    if (form.quantity < 1 || form.quantity > 500) { setError('Quantity must be 1–500.'); return; }
    if (form.maxPlays < 1)                        { setError('Max Plays must be at least 1.'); return; }
    setLoading(true); setError(null); setPreviews([]);
    try {
      const codes = await generateQRCodes(form.prefix, form.quantity, form.maxPlays, form.type);
      const rendered: QRPreviewItem[] = [];
      for (const { code, url } of codes) {
        try { rendered.push({ code, url, dataUrl: await renderQRtoPNG(url, code, form.type) }); }
        catch { /* skip failed renders */ }
      }
      setPreviews(rendered); onGenerated();
    } catch (e: any) { setError(e?.message ?? 'Generation failed.'); }
    finally { setLoading(false); }
  };

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>QR Generator</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Create new QR codes and save to Firebase</p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 18 }}>
          <div>
            <label style={labelStyle}>QR Prefix</label>
            <input style={inputStyle} value={form.prefix}
              onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
              placeholder="e.g. SKM"
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
          </div>
          <div>
            <label style={labelStyle}>Quantity</label>
            <input style={inputStyle} type="number" min={1} max={500} value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
          </div>
          <div>
            <label style={labelStyle}>Max Plays</label>
            <input style={inputStyle} type="number" min={1} value={form.maxPlays}
              onChange={e => setForm(f => ({ ...f, maxPlays: Number(e.target.value) }))}
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
          </div>
          <div>
            <label style={labelStyle}>QR Type</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as QRCodeType }))}>
              {QR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <p style={{ color: '#DC2626', fontSize: 12, margin: '0 0 14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>
            <XCircle size={14} strokeWidth={2} /> {error}
          </p>
        )}

        <button onClick={handleGenerate} disabled={loading} style={{
          background: loading ? '#F3F4F6' : `linear-gradient(135deg,${RED},#B51218)`,
          color: loading ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 12, padding: '12px 28px',
          fontSize: 13, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : `0 4px 16px ${RED}30`,
          transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {loading
            ? <span style={{ width: 14, height: 14, border: '2px solid #D1D5DB', borderTopColor: RED, borderRadius: '50%', animation: 'qrSpin 0.7s linear infinite', display: 'inline-block' }} />
            : <Plus size={16} strokeWidth={2.5} />}
          {loading ? 'Generating…' : 'Generate QR'}
        </button>

        {previews.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} strokeWidth={2} /> {previews.length} QR code{previews.length !== 1 ? 's' : ''} ready
              </span>
              {previews.length > 1 && (
                <button onClick={() => previews.forEach((item, i) => setTimeout(() => downloadPNG(item.dataUrl, item.code), i * 120))}
                  style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#1D4ED8', borderRadius: 10, padding: '7px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={13} strokeWidth={2} /> Download All PNG
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
              {previews.map(item => (
                <div key={item.code} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img src={item.dataUrl} alt={item.code} style={{ width: '100%', display: 'block' }} />
                  <button onClick={() => downloadPNG(item.dataUrl, item.code)} style={{
                    width: '100%', padding: '10px 0',
                    background: form.type === 'Golden' ? 'linear-gradient(135deg,#D97706,#B45309)' : `linear-gradient(135deg,${RED},#B51218)`,
                    color: '#fff', border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    <Download size={12} strokeWidth={2.5} /> Download PNG
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes qrSpin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
