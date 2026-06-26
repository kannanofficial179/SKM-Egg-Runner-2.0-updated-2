import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import QRCode from 'qrcode';
import { Plus, Download, CheckCircle2, XCircle, Sparkles, Package } from 'lucide-react';
import type { QRCodeType, QRGeneratorForm } from '../../types/qr/qrManagementTypes';
import { generateQRCodes } from '../../services/qr/qrManagementService';

const RED = '#D71920';

const QR_TYPES: QRCodeType[] = ['Regular', 'Golden', 'Campaign', 'Developer'];

const LOADING_MESSAGES = [
  'Preparing your QR batch…',
  'Our egg mascot is carefully drawing your QR codes…',
  'Printing secure QR patterns…',
  'Encrypting each QR for secure validation…',
  'Organizing your batch…',
  'Adding the final touches…',
  'Almost ready…',
  'Your QR batch is nearly complete!',
];

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

async function renderQRtoPNG(url: string, type: QRCodeType): Promise<string> {
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

// ─── Mascot SVG (SKM Egg drawing QR codes) ───────────────────────────────────

function EggMascot({ done }: { done: boolean }) {
  return (
    <svg width="110" height="130" viewBox="0 0 110 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Egg body */}
      <ellipse cx="55" cy="78" rx="36" ry="44" fill="#FFF8E7" stroke="#F59E0B" strokeWidth="2.5" />
      {/* Face */}
      <ellipse cx="44" cy="72" rx="4" ry="4.5" fill="#1A1A1A" />
      <ellipse cx="66" cy="72" rx="4" ry="4.5" fill="#1A1A1A" />
      {/* Eye shine */}
      <circle cx="46" cy="70" r="1.5" fill="#fff" />
      <circle cx="68" cy="70" r="1.5" fill="#fff" />
      {/* Smile or thumbs-up mouth */}
      {done
        ? <path d="M44 84 Q55 92 66 84" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        : <path d="M44 83 Q55 88 66 83" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" fill="none" />
      }
      {/* Cheeks */}
      <ellipse cx="38" cy="80" rx="5" ry="3" fill="#FCA5A5" opacity="0.6" />
      <ellipse cx="72" cy="80" rx="5" ry="3" fill="#FCA5A5" opacity="0.6" />
      {/* Arms */}
      {done ? (
        <>
          {/* Thumbs-up right arm */}
          <path d="M91 72 Q100 60 96 50" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="96" cy="48" r="5" fill="#F59E0B" />
          {/* Left arm relaxed */}
          <path d="M19 72 Q10 80 14 90" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          {/* Right arm holding brush */}
          <path d="M91 72 Q102 58 98 44" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" fill="none" />
          {/* Brush */}
          <rect x="94" y="30" width="5" height="18" rx="2" fill="#92400E" />
          <ellipse cx="96.5" cy="30" rx="4" ry="5" fill={RED} />
          {/* Left arm */}
          <path d="M19 72 Q10 82 16 94" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" fill="none" />
        </>
      )}
      {/* Feet */}
      <ellipse cx="44" cy="121" rx="10" ry="5" fill="#F59E0B" />
      <ellipse cx="66" cy="121" rx="10" ry="5" fill="#F59E0B" />
      {/* Hat */}
      <ellipse cx="55" cy="34" rx="28" ry="6" fill="#D71920" />
      <rect x="38" y="10" width="34" height="26" rx="8" fill="#D71920" />
      {/* Hat band */}
      <rect x="38" y="28" width="34" height="6" rx="2" fill="#9B1515" />
    </svg>
  );
}

// ─── Mini QR animation (lines appearing) ─────────────────────────────────────

function QRDrawAnimation({ progress }: { progress: number }) {
  const cells = 7;
  const filled = Math.round((progress / 100) * cells * cells);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells},1fr)`, gap: 2, width: 56, height: 56 }}>
      {Array.from({ length: cells * cells }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 1,
          background: i < filled ? RED : '#E5E7EB',
          transition: 'background 200ms',
        }} />
      ))}
    </div>
  );
}

// ─── Full-screen generation modal ─────────────────────────────────────────────

interface GenerationModalProps {
  progress:    number;   // 0-100
  done:        number;
  total:       number;
  message:     string;
  completed:   boolean;
  batchName:   string;
  onDownload:  () => void;
  onClose:     () => void;
}

function GenerationModal({ progress, done, total, message, completed, batchName, onDownload, onClose }: GenerationModalProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t); }, []);

  const etaSecs = (() => {
    if (done === 0 || done >= total) return null;
    // rough estimate: ~50ms per QR code in Firestore
    const msPerCode = 55;
    const remaining = total - done;
    return Math.ceil((remaining * msPerCode) / 1000);
  })();

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 300ms ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, margin: '0 20px',
        background: '#FFFFFF',
        borderRadius: 28,
        boxShadow: '0 32px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(215,25,32,0.15)',
        padding: '36px 32px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(16px)',
        transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Red accent top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${RED},#FF6B6B,${RED})`, backgroundSize: '200% auto', animation: completed ? 'none' : 'gradientSlide 2s linear infinite' }} />

        {/* Sparkle decorations */}
        {completed && (
          <>
            <Sparkles size={16} color="#F59E0B" style={{ position: 'absolute', top: 20, right: 28, opacity: 0.8 }} />
            <Sparkles size={12} color="#F59E0B" style={{ position: 'absolute', top: 36, right: 52, opacity: 0.5 }} />
            <Sparkles size={10} color={RED} style={{ position: 'absolute', top: 16, left: 40, opacity: 0.6 }} />
          </>
        )}

        {/* Mascot */}
        <div style={{
          animation: completed ? 'mascotBounce 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'mascotFloat 2.4s ease-in-out infinite',
          marginBottom: 8,
        }}>
          <EggMascot done={completed} />
        </div>

        {/* Mini QR draw + batch badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <QRDrawAnimation progress={progress} />
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', color: RED, background: `${RED}10`, border: `1px solid ${RED}20`, padding: '3px 10px', borderRadius: 20, marginBottom: 4 }}>
              <Package size={11} /> {batchName}
            </span>
            <p style={{ margin: 0, fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
              {completed ? `${total} QR codes ready` : `${done} / ${total} generated`}
            </p>
          </div>
        </div>

        {/* Message */}
        <p style={{
          fontSize: 13, fontWeight: 700, color: '#1A1A1A', textAlign: 'center',
          margin: '0 0 20px', lineHeight: 1.55, minHeight: 40,
        }}>
          {completed ? `🎉 Your QR batch has been generated successfully!` : message}
        </p>

        {/* Progress bar */}
        {!completed && (
          <div style={{ width: '100%', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Generating QR Codes</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: RED }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 8, background: '#F3F4F6', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                background: `linear-gradient(90deg,${RED},#FF6B6B)`,
                width: `${progress}%`,
                transition: 'width 400ms ease',
                backgroundSize: '200% auto',
                animation: 'gradientSlide 1.5s linear infinite',
              }} />
            </div>
            {etaSecs !== null && (
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '5px 0 0', textAlign: 'right' }}>
                ~{etaSecs}s remaining
              </p>
            )}
          </div>
        )}

        {/* Completed actions */}
        {completed && (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={onDownload}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg,${RED},#B51218)`, color: '#fff',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: `0 4px 14px ${RED}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Download size={14} strokeWidth={2.5} /> Download PNGs
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '12px 20px', borderRadius: 12,
                background: '#F3F4F6', border: '1px solid #E5E7EB',
                color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes gradientSlide { to { background-position: 200% center; } }
        @keyframes mascotFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes mascotBounce {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.12); }
          70%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { onGenerated: () => void; }

export default function QRGenerator({ onGenerated }: Props) {
  const [form, setForm] = useState<QRGeneratorForm>({ prefix: 'SKM', quantity: 1, maxPlays: 2, type: 'Regular' });
  const [error,     setError]     = useState<string | null>(null);
  const [previews,  setPreviews]  = useState<QRPreviewItem[]>([]);

  // Modal state
  const [showModal,    setShowModal]    = useState(false);
  const [modalDone,    setModalDone]    = useState(0);
  const [modalTotal,   setModalTotal]   = useState(0);
  const [modalMsg,     setModalMsg]     = useState(LOADING_MESSAGES[0]);
  const [modalComplete,setModalComplete]= useState(false);
  const [batchName,    setBatchName]    = useState('');
  const generatedRef = useRef<Array<{ code: string; url: string }>>([]);
  const msgTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgIdxRef    = useRef(0);

  // Rotate loading messages
  const startMsgRotation = () => {
    msgIdxRef.current = 0;
    setModalMsg(LOADING_MESSAGES[0]);
    msgTimerRef.current = setInterval(() => {
      msgIdxRef.current = (msgIdxRef.current + 1) % LOADING_MESSAGES.length;
      setModalMsg(LOADING_MESSAGES[msgIdxRef.current]);
    }, 2800);
  };
  const stopMsgRotation = () => {
    if (msgTimerRef.current) { clearInterval(msgTimerRef.current); msgTimerRef.current = null; }
  };

  useEffect(() => () => stopMsgRotation(), []);

  const handleGenerate = async () => {
    if (!form.prefix.trim())                       { setError('Prefix is required.'); return; }
    if (form.quantity < 1 || form.quantity > 1000) { setError('Quantity must be 1–1000.'); return; }
    if (form.maxPlays < 1)                         { setError('Max Plays must be at least 1.'); return; }

    setError(null);
    setPreviews([]);
    generatedRef.current = [];
    setModalDone(0);
    setModalTotal(form.quantity);
    setModalComplete(false);
    setBatchName('');
    setShowModal(true);
    startMsgRotation();

    try {
      const codes = await generateQRCodes(
        form.prefix,
        form.quantity,
        form.maxPlays,
        form.type,
        (done, total) => {
          setModalDone(done);
          setModalTotal(total);
        },
      );

      generatedRef.current = codes;
      stopMsgRotation();
      setModalDone(codes.length);
      setModalComplete(true);

      // Infer batch name from service (it was persisted to localStorage)
      // We show it via the count we know was just written
      const count = parseInt(localStorage.getItem('qr_batch_count') ?? '1', 10);
      setBatchName(`Batch ${count}`);

      onGenerated();
    } catch (e: any) {
      stopMsgRotation();
      setShowModal(false);
      setError(e?.message ?? 'Generation failed.');
    }
  };

  // Render previews (only first 20 to avoid browser freeze)
  const handleDownloadAll = async () => {
    const codes = generatedRef.current;
    const PREVIEW_LIMIT = 20;
    const toRender = codes.slice(0, PREVIEW_LIMIT);
    const rendered: QRPreviewItem[] = [];
    for (const { code, url } of toRender) {
      try { rendered.push({ code, url, dataUrl: await renderQRtoPNG(url, form.type) }); }
      catch { /* skip */ }
    }
    setPreviews(rendered);
    setShowModal(false);
  };

  const progress = modalTotal > 0 ? Math.round((modalDone / modalTotal) * 100) : 0;

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>QR Generator</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Create new QR codes and save to Firebase · Max 1000 per batch</p>
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
            <label style={labelStyle}>Quantity <span style={{ color: '#9CA3AF', fontWeight: 500 }}>(max 1000)</span></label>
            <input style={inputStyle} type="number" min={1} max={1000} value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: Math.min(1000, Number(e.target.value)) }))}
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

        {/* Large-batch warning */}
        {form.quantity > 100 && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⏱</span>
            <p style={{ fontSize: 11, color: '#92400E', margin: 0, fontWeight: 600 }}>
              Generating {form.quantity} QR codes. This may take ~{Math.ceil(form.quantity * 0.06)}s. A progress screen will appear.
            </p>
          </div>
        )}

        {error && (
          <p style={{ color: '#DC2626', fontSize: 12, margin: '0 0 14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: '#FEF2F2', padding: '8px 12px', borderRadius: 8 }}>
            <XCircle size={14} strokeWidth={2} /> {error}
          </p>
        )}

        <button onClick={handleGenerate} style={{
          background: `linear-gradient(135deg,${RED},#B51218)`,
          color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px',
          fontSize: 13, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: `0 4px 16px ${RED}30`,
          transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Plus size={16} strokeWidth={2.5} />
          Generate QR{form.quantity > 1 ? ` (${form.quantity})` : ''}
        </button>

        {/* Preview grid — first 20 only */}
        {previews.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} strokeWidth={2} />
                {generatedRef.current.length} QR code{generatedRef.current.length !== 1 ? 's' : ''} generated
                {generatedRef.current.length > previews.length && (
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>
                    · showing first {previews.length}
                  </span>
                )}
              </span>
              {previews.length > 1 && (
                <button
                  onClick={() => previews.forEach((item, i) => setTimeout(() => downloadPNG(item.dataUrl, item.code), i * 120))}
                  style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', color: '#1D4ED8', borderRadius: 10, padding: '7px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Download size={13} strokeWidth={2} /> Download All PNG
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
              {previews.map(item => (
                <div key={item.code} style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', border: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img src={item.dataUrl} alt={item.code} style={{ width: '100%', display: 'block' }} />
                  <button
                    onClick={() => downloadPNG(item.dataUrl, item.code)}
                    style={{
                      width: '100%', padding: '10px 0',
                      background: form.type === 'Golden' ? 'linear-gradient(135deg,#D97706,#B45309)' : `linear-gradient(135deg,${RED},#B51218)`,
                      color: '#fff', border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: 0.5,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
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

      {showModal && (
        <GenerationModal
          progress={progress}
          done={modalDone}
          total={modalTotal}
          message={modalMsg}
          completed={modalComplete}
          batchName={batchName || `Batch`}
          onDownload={handleDownloadAll}
          onClose={() => setShowModal(false)}
        />
      )}
    </section>
  );
}
