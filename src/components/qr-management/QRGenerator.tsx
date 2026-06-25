import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { Plus, Download, CheckCircle2, XCircle } from 'lucide-react';
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

interface QRPreviewItem {
  code: string;
  url: string;
  dataUrl: string;
}

// ── Draw one QR code onto a canvas and return a PNG data URL ─────────────────
// The QR matrix encodes the full URL; the code is only used for logging.
async function renderQRtoPNG(url: string, code: string, type: QRCodeType): Promise<string> {
  const SIZE = 300;
  const MARGIN = 20;

  console.log('[QR DATA CREATED]', code);

  // 1. Generate QR matrix data URL — encodes the full URL, not just the code
  const qrDataUrl: string = await QRCode.toDataURL(url, {
    width: SIZE,
    margin: 1,
    color: {
      dark:  type === 'Golden' ? '#B45309' : '#1a0000',
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'H',
  });
  console.log('[QR SVG CREATED]', code);

  // 2. Create canvas — QR only, no text labels
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE + MARGIN * 2;
  canvas.height = SIZE + MARGIN * 2;
  const ctx = canvas.getContext('2d')!;
  console.log('[QR CANVAS CREATED]', code);

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Load QR image onto canvas
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload  = () => { ctx.drawImage(img, MARGIN, MARGIN, SIZE, SIZE); resolve(); };
    img.onerror = reject;
    img.src     = qrDataUrl;
  });

  console.log('[PNG GENERATED]', code);

  const dataUrl = canvas.toDataURL('image/png');
  console.log('[PREVIEW RENDERED]', code);
  return dataUrl;
}

// ── Trigger browser download for one PNG ─────────────────────────────────────
function downloadPNG(dataUrl: string, code: string): void {
  console.log('[DOWNLOAD TRIGGERED]', code);
  const a       = document.createElement('a');
  a.href        = dataUrl;
  a.download    = `${code}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  console.log('[DOWNLOAD SUCCESS]', code);
}

interface Props {
  onGenerated: () => void;
}

export default function QRGenerator({ onGenerated }: Props) {
  const [form, setForm] = useState<QRGeneratorForm>({
    prefix: 'SKM', quantity: 1, maxPlays: 2, type: 'Regular',
  });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [previews,  setPreviews]  = useState<QRPreviewItem[]>([]);

  const log = (msg: string) => console.log(msg);

  const handleGenerate = async () => {
    if (!form.prefix.trim())                         { setError('Prefix is required.'); return; }
    if (form.quantity < 1 || form.quantity > 500)    { setError('Quantity must be 1–500.'); return; }
    if (form.maxPlays < 1)                           { setError('Max Plays must be at least 1.'); return; }

    setLoading(true);
    setError(null);
    setPreviews([]);

    try {
      // ── Step 1: Save to Firestore ─────────────────────────────────────────
      log(`[QR DATA CREATED] Saving ${form.quantity} codes to Firestore…`);
      const codes = await generateQRCodes(form.prefix, form.quantity, form.maxPlays, form.type);
      log(`[QR DATA CREATED] ${codes.length} Firestore documents written.`);

      // ── Step 2: Render each code to PNG ───────────────────────────────────
      const rendered: QRPreviewItem[] = [];
      for (const { code, url } of codes) {
        try {
          log(`[QR CANVAS CREATED] Rendering ${code}…`);
          const dataUrl = await renderQRtoPNG(url, code, form.type);
          rendered.push({ code, url, dataUrl });
          log(`[PREVIEW RENDERED] ${code} ready.`);
        } catch (renderErr: any) {
          log(`[ERROR] Render failed for ${code}: ${renderErr?.message}`);
        }
      }

      setPreviews(rendered);
      log(`[PREVIEW RENDERED] All ${rendered.length} previews ready.`);
      onGenerated();

    } catch (e: any) {
      const msg = e?.message ?? 'Generation failed.';
      log(`[ERROR] ${msg}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOne = (item: QRPreviewItem) => {
    downloadPNG(item.dataUrl, item.code);
  };

  const handleDownloadAll = () => {
    previews.forEach((item, i) => {
      setTimeout(() => downloadPNG(item.dataUrl, item.code), i * 120);
    });
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

        {/* ── Form fields ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 16 }}>

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

        {error && (
          <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <XCircle size={14} strokeWidth={2} /> {error}
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            background: loading ? 'rgba(215,25,32,0.4)' : `linear-gradient(135deg,${RED},#8B0000)`,
            color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px',
            fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(215,25,32,0.4)',
            transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {loading ? (
            <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'qrSpin 0.7s linear infinite', display: 'inline-block' }} />
          ) : (
            <Plus size={16} strokeWidth={2.5} />
          )}
          {loading ? 'Generating…' : 'Generate QR'}
        </button>


        {/* ── Preview grid ── */}
        {previews.length > 0 && (
          <div style={{ marginTop: 20 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} strokeWidth={2} /> {previews.length} QR code{previews.length !== 1 ? 's' : ''} ready
              </span>
              {previews.length > 1 && (
                <button
                  onClick={handleDownloadAll}
                  style={{
                    background: 'rgba(96,165,250,0.15)', border: '1.5px solid rgba(96,165,250,0.4)',
                    color: '#60a5fa', borderRadius: 10, padding: '7px 16px',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Download size={13} strokeWidth={2} /> Download All PNG
                </button>
              )}
            </div>

            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
              {previews.map(item => (
                <div
                  key={item.code}
                  style={{
                    background: '#fff', borderRadius: 14, overflow: 'hidden',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                  }}
                >
                  <img
                    src={item.dataUrl}
                    alt={item.code}
                    style={{ width: '100%', display: 'block' }}
                  />
                  <button
                    onClick={() => handleDownloadOne(item)}
                    style={{
                      width: '100%', padding: '10px 0',
                      background: form.type === 'Golden'
                        ? 'linear-gradient(135deg,#f59e0b,#b45309)'
                        : `linear-gradient(135deg,${RED},#8B0000)`,
                      color: '#fff', border: 'none',
                      fontSize: 11, fontWeight: 800, cursor: 'pointer',
                      letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <Download size={12} strokeWidth={2.5} /> Download PNG
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes qrSpin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
