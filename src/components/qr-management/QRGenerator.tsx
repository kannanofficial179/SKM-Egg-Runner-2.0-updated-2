import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import QRCode from 'qrcode';
import { Plus, Download, CheckCircle2, XCircle, ShieldCheck, Package, Printer, Clock, Link2, QrCode as QrCodeIcon } from 'lucide-react';
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

// ─── Confetti particle (CSS-only, no canvas) ─────────────────────────────────

function ConfettiParticles() {
  const particles = [
    { x: 12,  y: -10, size: 5,  color: RED,       delay: 0,    dur: 1.1, rx: 14  },
    { x: 88,  y: -8,  size: 4,  color: '#F59E0B',  delay: 0.1,  dur: 1.3, rx: -20 },
    { x: 30,  y: -14, size: 3,  color: '#6366F1',  delay: 0.2,  dur: 1.0, rx: 8   },
    { x: 70,  y: -12, size: 4,  color: RED,        delay: 0.05, dur: 1.2, rx: -12 },
    { x: 50,  y: -18, size: 5,  color: '#10B981',  delay: 0.15, dur: 1.4, rx: 18  },
    { x: 20,  y: -6,  size: 3,  color: '#F59E0B',  delay: 0.25, dur: 0.9, rx: -8  },
    { x: 80,  y: -16, size: 4,  color: '#6366F1',  delay: 0.08, dur: 1.1, rx: 22  },
    { x: 42,  y: -10, size: 3,  color: RED,        delay: 0.3,  dur: 1.3, rx: -16 },
    { x: 62,  y: -8,  size: 5,  color: '#10B981',  delay: 0.18, dur: 1.0, rx: 10  },
    { x: 5,   y: -12, size: 3,  color: '#F59E0B',  delay: 0.22, dur: 1.2, rx: -6  },
    { x: 95,  y: -10, size: 4,  color: RED,        delay: 0.12, dur: 1.1, rx: 14  },
    { x: 55,  y: -20, size: 3,  color: '#6366F1',  delay: 0.28, dur: 0.95,rx: -18 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${p.x}%`, top: 0,
          width: p.size, height: p.size,
          background: p.color,
          borderRadius: 1,
          animation: `confettiFall ${p.dur}s ${p.delay}s ease-in both`,
          transform: `rotate(${p.rx}deg)`,
          opacity: 0,
        }} />
      ))}
    </div>
  );
}

// ─── Generation loading view (in-progress) ────────────────────────────────────

function LoadingView({ progress, done, total, message, etaSecs }: {
  progress: number; done: number; total: number; message: string; etaSecs: number | null;
}) {
  const cells = 8;
  const filled = Math.round((progress / 100) * cells * cells);

  return (
    <>
      {/* Illustration: mascot image with scanning overlay */}
      <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 28px', flexShrink: 0 }}>
        {/* Soft red glow behind image */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: `radial-gradient(circle, ${RED}18 0%, transparent 70%)`,
          animation: 'glowPulse 2s ease-in-out infinite',
        }} />
        {/* Mascot image */}
        <img
          src="/Qr.png"
          alt="Generating QR codes"
          style={{ width: '100%', height: '100%', objectFit: 'contain', position: 'relative', zIndex: 1 }}
        />
        {/* Scan line overlay */}
        <div style={{
          position: 'absolute', left: '10%', right: '10%', height: 2, zIndex: 2,
          background: `linear-gradient(90deg, transparent, ${RED}CC, transparent)`,
          boxShadow: `0 0 10px 3px ${RED}60`,
          animation: 'scanLine 1.8s ease-in-out infinite',
          top: '10%',
        }} />
        {/* Mini QR grid — fills as progress advances */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 3,
          display: 'grid', gridTemplateColumns: `repeat(${cells},1fr)`,
          gap: 1.5, width: 52, height: 52,
          background: 'rgba(255,255,255,0.9)',
          borderRadius: 6, padding: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
          {Array.from({ length: cells * cells }).map((_, i) => (
            <div key={i} style={{
              borderRadius: 0.5,
              background: i < filled ? RED : '#E5E7EB',
              transition: 'background 180ms',
            }} />
          ))}
        </div>
      </div>

      {/* Counter */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', margin: '0 0 4px' }}>
          {message}
        </p>
        <p style={{ fontSize: 28, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: '-0.5px', lineHeight: 1 }}>
          {done.toLocaleString()} <span style={{ fontSize: 16, color: '#9CA3AF', fontWeight: 600 }}>/ {total.toLocaleString()}</span>
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Generating QR Codes</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: RED }}>{Math.round(progress)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 6, background: '#F3F4F6', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 6,
            background: `linear-gradient(90deg, ${RED}, #FF4D4D)`,
            width: `${progress}%`,
            transition: 'width 400ms ease',
            backgroundSize: '200% auto',
            animation: 'gradientSlide 1.5s linear infinite',
          }} />
        </div>
        {etaSecs !== null && (
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: '5px 0 0', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
            <Clock size={10} /> ~{etaSecs}s remaining
          </p>
        )}
      </div>
    </>
  );
}

// ─── Success view ─────────────────────────────────────────────────────────────

function SuccessView({ total, batchName, onDownload, onClose }: {
  total: number; batchName: string; onDownload: () => void; onClose: () => void;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 40); return () => clearTimeout(t); }, []);

  const gameUrl = (() => {
    try { return localStorage.getItem('qr_game_url') || 'https://skm-egg-runner.vercel.app'; } catch { return '—'; }
  })();

  const genTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{
      width: '100%',
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
      transition: 'opacity 350ms ease, transform 350ms cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      {/* Illustration */}
      <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 24px', flexShrink: 0 }}>
        {/* Soft red glow */}
        <div style={{
          position: 'absolute', inset: -20, borderRadius: '50%',
          background: `radial-gradient(circle, ${RED}15 0%, transparent 65%)`,
          animation: 'glowPulse 3s ease-in-out infinite',
        }} />
        <img
          src="/Qr.png"
          alt="QR batch ready"
          style={{
            width: '100%', height: '100%', objectFit: 'contain',
            position: 'relative', zIndex: 1,
            filter: 'drop-shadow(0 8px 24px rgba(215,25,32,0.18))',
            animation: show ? 'illustrationPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
          }}
        />
        {/* Shield check badge */}
        <div style={{
          position: 'absolute', bottom: 4, right: 4, zIndex: 3,
          width: 36, height: 36, borderRadius: '50%',
          background: `linear-gradient(135deg, ${RED}, #B51218)`,
          boxShadow: `0 4px 14px ${RED}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: show ? 'shieldPop 0.4s 0.2s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
        }}>
          <ShieldCheck size={18} color="#fff" strokeWidth={2.5} />
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h3 style={{ fontSize: 17, fontWeight: 900, color: '#1A1A1A', margin: '0 0 5px', letterSpacing: '-0.3px' }}>
          QR Batch Generated Successfully
        </h3>
        <p style={{ fontSize: 12, color: '#6B7280', margin: 0, fontWeight: 500 }}>
          All QR codes have been securely generated and are ready for download, printing, and deployment.
        </p>
      </div>

      {/* Success detail card */}
      <div style={{
        width: '100%', background: '#F9FAFB',
        border: '1px solid #E5E7EB', borderRadius: 14,
        overflow: 'hidden', marginBottom: 20,
      }}>
        {/* Card header */}
        <div style={{
          padding: '10px 16px',
          background: `linear-gradient(90deg, ${RED}08, transparent)`,
          borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 6px #22C55E80' }} />
          <span style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Batch Status: Ready
          </span>
        </div>

        {/* Detail rows */}
        {[
          { icon: <Package size={12} />,  label: 'Batch Name',          value: batchName },
          { icon: <QrCodeIcon size={12} />, label: 'QR Codes Created',    value: `${total.toLocaleString()} secure QR codes` },
          { icon: <Clock size={12} />,    label: 'Generation Time',      value: genTime },
          { icon: <Link2 size={12} />,    label: 'Game Link Mapping',    value: gameUrl },
          { icon: <ShieldCheck size={12} />, label: 'Encryption Status', value: 'Active — High error correction' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 16px',
            borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none',
          }}>
            <span style={{ color: RED, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', minWidth: 120, flexShrink: 0 }}>{row.label}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#1A1A1A',
              flex: 1, wordBreak: 'break-all',
              ...(row.label === 'Game Link Mapping' ? { fontFamily: 'monospace', fontSize: 10 } : {}),
            }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
        {/* Primary */}
        <button
          onClick={onDownload}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg, ${RED}, #B51218)`,
            color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            boxShadow: `0 4px 16px ${RED}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            letterSpacing: 0.2,
          }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
          <Download size={15} strokeWidth={2.5} />
          Download PNG
        </button>

        {/* Secondary */}
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12,
            background: '#F3F4F6', border: '1px solid #E5E7EB',
            color: '#374151', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
        >
          <Printer size={14} strokeWidth={2} />
          Print / Close
        </button>
      </div>
    </div>
  );
}

// ─── Full-screen generation modal ─────────────────────────────────────────────

interface GenerationModalProps {
  progress:    number;
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
    const remaining = total - done;
    return Math.ceil((remaining * 55) / 1000);
  })();

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,10,14,0.6)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 300ms ease',
      padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 440,
        background: '#FFFFFF',
        borderRadius: 24,
        boxShadow: '0 40px 100px rgba(0,0,0,0.35), 0 0 0 1px rgba(215,25,32,0.12)',
        padding: '32px 28px 28px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(20px)',
        transition: 'transform 350ms cubic-bezier(0.34,1.56,0.64,1)',
        position: 'relative', overflow: 'hidden',
        maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* Top accent line — animated while loading, solid when done */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: completed
            ? `linear-gradient(90deg, #22C55E, ${RED})`
            : `linear-gradient(90deg, ${RED}, #FF4D4D, ${RED})`,
          backgroundSize: '200% auto',
          animation: completed ? 'none' : 'gradientSlide 1.8s linear infinite',
        }} />

        {/* Batch pill — always visible */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20, marginBottom: 20,
          background: `${RED}0D`, border: `1px solid ${RED}22`,
          fontSize: 10, fontWeight: 800, letterSpacing: 1.5,
          textTransform: 'uppercase', color: RED,
        }}>
          <Package size={11} strokeWidth={2.5} />
          {batchName || 'Processing'}
        </div>

        {/* Confetti only on success */}
        {completed && <ConfettiParticles />}

        {/* Conditional body */}
        {completed ? (
          <SuccessView
            total={total}
            batchName={batchName}
            onDownload={onDownload}
            onClose={onClose}
          />
        ) : (
          <LoadingView
            progress={progress}
            done={done}
            total={total}
            message={message}
            etaSecs={etaSecs}
          />
        )}
      </div>

      <style>{`
        @keyframes gradientSlide   { to { background-position: 200% center; } }
        @keyframes glowPulse       { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.06); } }
        @keyframes scanLine        { 0%,100% { top:10%; opacity:0.8; } 50% { top:85%; opacity:1; } }
        @keyframes illustrationPop { 0% { transform:scale(0.88); opacity:0; } 100% { transform:scale(1); opacity:1; } }
        @keyframes shieldPop       { 0% { transform:scale(0) rotate(-20deg); opacity:0; } 100% { transform:scale(1) rotate(0deg); opacity:1; } }
        @keyframes confettiFall    { 0% { transform:translateY(-10px) rotate(0deg); opacity:1; } 100% { transform:translateY(120px) rotate(360deg); opacity:0; } }
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
