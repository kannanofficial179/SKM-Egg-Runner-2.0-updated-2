import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { validateAndUseQR } from '../services/qr/qrService';
import { SettingsModal } from '../frontend/modals/SettingsModal';

interface ModuleSelectScreenProps {
  onSelectGame:    () => void;
  onSelectTracker: () => void;
  onSelectQR?:     () => void;
}

const LAST_MODULE_KEY  = 'skm_last_module';
const QR_ELEMENT_ID    = 'module-select-qr-reader';

// ─────────────────────────────────────────────────────────────
// System Update Gate — developer authentication modal
// Shown after 12 secret taps. Renders via portal over everything.
// ─────────────────────────────────────────────────────────────

const ENCODED_DEV_NAME = 'REVWRUxPUEVS'; // base64 → "DEVELOPER"
const ENCODED_DEV_PASS = 'bnBtIHJ1biBkZXY='; // base64 → "npm run dev"

function SystemUpdateGate({
  onAccessGranted,
  onCancel,
}: {
  onAccessGranted: () => void;
  onCancel: () => void;
}) {
  const [visible,   setVisible]   = useState(false);
  const [devId,     setDevId]     = useState('');
  const [devPass,   setDevPass]   = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const idRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    setTimeout(() => idRef.current?.focus(), 300);
    return () => cancelAnimationFrame(t);
  }, []);

  const closeWith = (cb?: () => void) => {
    setVisible(false);
    setTimeout(() => cb?.(), 250);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      try {
        const validId   = btoa(devId.trim())   === ENCODED_DEV_NAME;
        const validPass = btoa(devPass.trim())  === ENCODED_DEV_PASS;
        if (validId && validPass) {
          closeWith(onAccessGranted);
        } else {
          setError('Access Denied — Invalid credentials.');
          setDevPass('');
        }
      } catch {
        setError('Access Denied — Invalid credentials.');
      }
      setLoading(false);
    }, 400);
  };

  const overlay: React.CSSProperties = {
    opacity:    visible ? 1 : 0,
    transition: 'opacity 250ms ease',
  };
  const card: React.CSSProperties = {
    transform:  visible ? 'scale(1)' : 'scale(0.88)',
    opacity:    visible ? 1 : 0,
    transition: 'transform 250ms cubic-bezier(0.34,1.56,0.64,1), opacity 250ms ease',
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto" style={overlay}>
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0"
        style={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', background: 'rgba(0,0,0,0.65)' }}
        onClick={() => closeWith(onCancel)}
      />

      {/* Gate card */}
      <div
        className="relative z-10 w-full mx-5 rounded-3xl overflow-hidden shadow-2xl"
        style={{
          ...card,
          maxWidth: 360,
          background: 'linear-gradient(160deg,#1a0000 0%,#2d0000 40%,#1a0000 100%)',
          boxShadow: '0 0 0 1.5px rgba(215,25,32,0.5), 0 32px 80px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glassmorphism highlight */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{ background: 'linear-gradient(135deg,rgba(215,25,32,0.18) 0%,rgba(255,255,255,0.03) 55%,transparent 100%)' }}
        />

        <div className="relative p-6">
          {/* Header */}
          <div className="text-center mb-6">
            {/* Shield icon */}
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'rgba(215,25,32,0.2)', border: '1.5px solid rgba(215,25,32,0.4)' }}>
              <svg className="w-8 h-8" fill="none" stroke="#D71920" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
              </svg>
            </div>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase font-mono mb-1"
              style={{ color: 'rgba(215,25,32,0.8)' }}>
              RESTRICTED ACCESS
            </p>
            <h2 className="text-xl font-black text-white tracking-tight">SYSTEM UPDATE GATE</h2>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Authorized Developer Access Required
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Developer ID */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                Developer ID
              </label>
              <input
                ref={idRef}
                type="text"
                value={devId}
                onChange={e => { setDevId(e.target.value); setError(''); }}
                placeholder="Enter Developer ID"
                autoComplete="off"
                className="w-full px-4 py-3 rounded-xl font-mono text-sm focus:outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(215,25,32,0.7)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5"
                style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                Password
              </label>
              <input
                type="password"
                value={devPass}
                onChange={e => { setDevPass(e.target.value); setError(''); }}
                placeholder="Enter Password"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl font-mono text-sm focus:outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  color: 'white',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(215,25,32,0.7)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl px-4 py-2.5 text-center"
                style={{ background: 'rgba(215,25,32,0.15)', border: '1px solid rgba(215,25,32,0.3)' }}>
                <p className="text-xs font-bold font-mono" style={{ color: '#ff6b6b' }}>{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => closeWith(onCancel)}
                className="flex-1 py-3 rounded-2xl font-bold text-sm uppercase tracking-wide transition active:scale-95 cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !devId.trim() || !devPass.trim()}
                className="flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-wide transition active:scale-95 disabled:opacity-50 cursor-pointer"
                style={{ background: 'linear-gradient(135deg,#D71920,#8B0000)', color: 'white', boxShadow: '0 4px 16px rgba(215,25,32,0.4)' }}
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                ) : 'Access Controller'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────
// QR Access Modal
// ─────────────────────────────────────────────────────────────

function QRAccessModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const [visible,     setVisible]     = useState(false);
  const [scanMsg,     setScanMsg]     = useState('');
  const [scanError,   setScanError]   = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const scannerRef  = useRef<Html5Qrcode | null>(null);
  const scanningRef = useRef(false);
  const handledRef  = useRef(false);

  // Fade + scale in, then immediately start scanner
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (visible) startScanner();
  }, [visible]);

  // Always clean up on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current && scanningRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (_) {}
      scanningRef.current = false;
    }
  };

  const startScanner = async () => {
    handledRef.current = false;
    setScanError(null);
    setScanSuccess(false);
    setScanMsg('Initializing camera…');

    // Small delay so the DOM element is painted before html5-qrcode targets it
    await new Promise(r => setTimeout(r, 150));

    const el = document.getElementById(QR_ELEMENT_ID);
    if (!el) {
      setScanError('Camera view unavailable. Please try again.');
      return;
    }

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(QR_ELEMENT_ID);
      }
      // qrbox as function — called after video is sized, avoids 0×0 on desktop
      const qrboxFn = (w: number, h: number) => {
        const side = Math.min(350, Math.max(200, Math.round(Math.min(w, h) * 0.80)));
        return { width: side, height: side };
      };

      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 15, qrbox: qrboxFn },
        async (decoded) => {
          if (handledRef.current) return;
          handledRef.current = true;

          // Stop scanner first — fire-and-forget so it never blocks validation
          stopScanner().catch(() => {});
          setScanMsg('Validating…');
          setScanError(null);

          let result: Awaited<ReturnType<typeof validateAndUseQR>>;
          try {
            result = await validateAndUseQR(decoded);
          } catch {
            handledRef.current = false;
            setScanError('Validation Timeout. Please try again.');
            setScanMsg('');
            setScanSuccess(false);
            return;
          }

          if (result.ok === true) {
            if (result.unlimited) {
              sessionStorage.setItem('skm_golden_qr', 'true');
            } else {
              sessionStorage.removeItem('skm_golden_qr');
            }
            setScanSuccess(true);
            setScanError(null);
            setScanMsg(result.unlimited ? '✓ Access Granted — Unlimited Play!' : '✓ Access Granted — Starting game…');
            // Navigate after 1 second — don't call closeWith (avoids double-stopScanner hang)
            setTimeout(() => onConfirm(), 1000);
          } else {
            handledRef.current = false;
            setScanSuccess(false);
            setScanMsg('');
            setScanError(
              result.reason === 'LIMIT_REACHED'
                ? 'QR Usage Limit Reached. This QR has been fully used.'
                : result.reason === 'INACTIVE'
                ? 'QR Invalid. This code has been disabled.'
                : result.message,
            );
          }
        },
        () => {}
      );
      scanningRef.current = true;
      setScanMsg('Align QR code within the frame');
    } catch (err: any) {
      setScanError(
        err?.message?.includes('permission')
          ? 'Camera permission denied. Please allow camera access.'
          : 'Camera unavailable. Check device settings.'
      );
    }
  };

  const closeWith = (cb?: () => void) => {
    setVisible(false);
    // stopScanner already called before validation — don't call again here
    setTimeout(() => { cb ? cb() : onCancel(); }, 250);
  };

  const overlayStyle: React.CSSProperties = {
    opacity:    visible ? 1 : 0,
    transition: 'opacity 250ms ease',
  };

  const cardStyle: React.CSSProperties = {
    transform:  visible ? 'scale(1)' : 'scale(0.88)',
    opacity:    visible ? 1 : 0,
    transition: 'transform 250ms cubic-bezier(0.34,1.56,0.64,1), opacity 250ms ease',
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', flexDirection: 'column',
        background: '#000',
        opacity: visible ? 1 : 0,
        transition: 'opacity 250ms ease',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px',
        background: 'linear-gradient(180deg,rgba(0,0,0,0.85) 0%,transparent 100%)',
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      }}>
        <div>
          <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(215,25,32,0.9)', margin: 0, fontFamily: 'monospace' }}>
            GAME ACCESS
          </p>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1.2 }}>
            Scan QR Code
          </h2>
        </div>
        <button
          onClick={() => closeWith()}
          style={{
            width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
          aria-label="Cancel"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Camera fill ── */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>

        {/* html5-qrcode mount — fills entire area */}
        <div id={QR_ELEMENT_ID} style={{ position: 'absolute', inset: 0 }} />

        {/* Scan frame overlay — large, centered */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Dark vignette strips */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 20%,transparent 80%,rgba(0,0,0,0.55) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right,rgba(0,0,0,0.4) 0%,transparent 15%,transparent 85%,rgba(0,0,0,0.4) 100%)' }} />

          {/* Scan frame box */}
          <div style={{
            position: 'relative',
            width: 'min(80vw, 350px)', height: 'min(80vw, 350px)',
            minWidth: 280, minHeight: 280,
          }}>
            {/* White corner brackets */}
            {[
              { top: 0,    left: 0,  borderTop: '4px solid #fff', borderLeft: '4px solid #fff',   borderRadius: '14px 0 0 0' },
              { top: 0,    right: 0, borderTop: '4px solid #fff', borderRight: '4px solid #fff',  borderRadius: '0 14px 0 0' },
              { bottom: 0, left: 0,  borderBottom: '4px solid #fff', borderLeft: '4px solid #fff',  borderRadius: '0 0 0 14px' },
              { bottom: 0, right: 0, borderBottom: '4px solid #fff', borderRight: '4px solid #fff', borderRadius: '0 0 14px 0' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: 52, height: 52, ...s }} />
            ))}
            {/* Red inner accent corners */}
            {[
              { top: 0,    left: 0,  borderTop: '3px solid #D71920', borderLeft: '3px solid #D71920',   borderRadius: '14px 0 0 0' },
              { top: 0,    right: 0, borderTop: '3px solid #D71920', borderRight: '3px solid #D71920',  borderRadius: '0 14px 0 0' },
              { bottom: 0, left: 0,  borderBottom: '3px solid #D71920', borderLeft: '3px solid #D71920',  borderRadius: '0 0 0 14px' },
              { bottom: 0, right: 0, borderBottom: '3px solid #D71920', borderRight: '3px solid #D71920', borderRadius: '0 0 14px 0' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }} />
            ))}
            {/* Animated red scan line */}
            <div style={{
              position: 'absolute', left: 8, right: 8, height: 2,
              background: 'linear-gradient(90deg,transparent,#D71920 30%,#FF6B6B 50%,#D71920 70%,transparent)',
              boxShadow: '0 0 10px 2px rgba(215,25,32,0.7)',
              animation: 'gameScanLine 2s ease-in-out infinite',
            }} />
          </div>
        </div>
      </div>

      {/* ── Bottom bar: status + cancel ── */}
      <div style={{
        flexShrink: 0, padding: '16px 20px 32px',
        background: 'linear-gradient(0deg,rgba(0,0,0,0.92) 0%,transparent 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ minHeight: 22, textAlign: 'center' }}>
          {scanError ? (
            <p style={{ color: '#FF6B6B', fontSize: 13, fontWeight: 700, margin: 0 }}>{scanError}</p>
          ) : scanSuccess ? (
            <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 800, margin: 0 }}>{scanMsg}</p>
          ) : (
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, margin: 0 }}>{scanMsg}</p>
          )}
        </div>
        <button
          onClick={() => closeWith()}
          style={{
            width: '100%', maxWidth: 340, padding: '14px 0', borderRadius: 16,
            background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)',
            color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 0.5,
          }}
        >
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes gameScanLine {
          0%   { top: 4px; }
          50%  { top: calc(100% - 6px); }
          100% { top: 4px; }
        }
        /* Force camera video to fill the entire background */
        #${QR_ELEMENT_ID},
        #${QR_ELEMENT_ID} > div {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #000 !important;
        }
        #${QR_ELEMENT_ID} video {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          object-position: center !important;
          display: block !important;
          z-index: 1 !important;
        }
        #${QR_ELEMENT_ID} img,
        #${QR_ELEMENT_ID} button,
        #${QR_ELEMENT_ID} select,
        #${QR_ELEMENT_ID} span,
        #${QR_ELEMENT_ID} #qr-shaded-region,
        #${QR_ELEMENT_ID} [id*="anchor"],
        #${QR_ELEMENT_ID} [id*="header"],
        #${QR_ELEMENT_ID} [id*="status"],
        #${QR_ELEMENT_ID} [id*="torch"],
        #${QR_ELEMENT_ID} [id*="dashboard"] {
          display: none !important;
        }
      `}</style>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────
// Module Select Screen
// ─────────────────────────────────────────────────────────────

const TAP_REQUIRED = 12;
const TAP_INTERVAL = 1500;

export default function ModuleSelectScreen({ onSelectGame, onSelectTracker, onSelectQR }: ModuleSelectScreenProps) {
  const [visible,      setVisible]      = useState(false);
  const [pressing,     setPressing]     = useState<'game' | 'tracker' | null>(null);
  const [showQRModal,  setShowQRModal]  = useState(false);
  const [showGate,     setShowGate]     = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);

  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSecretTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0; }, TAP_INTERVAL);
    if (tapCountRef.current >= TAP_REQUIRED) {
      tapCountRef.current = 0;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
      setShowGate(true);
    }
  };

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleSelectTracker = () => {
    localStorage.setItem(LAST_MODULE_KEY, 'tracker');
    setVisible(false);
    setTimeout(() => onSelectTracker(), 300);
  };

  const handleSelectGame = () => {
    localStorage.setItem(LAST_MODULE_KEY, 'game');
    setShowQRModal(true);
  };

  const handleQRConfirm = () => {
    setShowQRModal(false);
    setVisible(false);
    setTimeout(() => onSelectGame(), 300);
  };

  const handleQRCancel = () => setShowQRModal(false);

  return (
    <>
      {/* ── Page shell — premium white SKM brand ── */}
      <div
        style={{
          position: 'fixed', inset: 0,
          background: '#F8F9FB',
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms ease',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          overflow: 'hidden',
        }}
        onClick={handleSecretTap}
      >
        {/* Subtle top red accent line */}
        <div style={{ height: 4, background: 'linear-gradient(90deg,#D71920,#B51218)', flexShrink: 0 }} />

        {/* ── Header — centered, premium ── */}
        <div style={{
          flexShrink: 0,
          paddingTop: 20, paddingBottom: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <img
            src="/THUMBS_POSE__Egg_-removebg-preview.png"
            alt="SKM"
            style={{ width: 44, height: 44, objectFit: 'contain' }}
          />
          <p style={{
            fontSize: 9, fontWeight: 900, letterSpacing: 3, textTransform: 'uppercase',
            color: '#D71920', margin: 0,
          }}>
            SKM EXPERIENCE
          </p>
          <h1 style={{
            fontSize: 20, fontWeight: 900, color: '#1A1A1A',
            margin: 0, letterSpacing: '-0.4px', lineHeight: 1.2,
          }}>
            Choose Your Module
          </h1>
          <p style={{ fontSize: 11, color: '#888', margin: 0, fontWeight: 500 }}>
            Select your experience and continue
          </p>
        </div>

        {/* ── Cards ── */}
        <div style={{
          flex: 1,
          padding: '8px 16px 8px',
          display: 'flex', flexDirection: 'column', gap: 10,
          maxWidth: 480, width: '100%', margin: '0 auto', alignSelf: 'center',
          boxSizing: 'border-box', justifyContent: 'center',
        }}>

          {/* ══ PROTEIN TRACKER CARD ══ */}
          <button
            onClick={handleSelectTracker}
            onPointerDown={() => setPressing('tracker')}
            onPointerUp={() => setPressing(null)}
            onPointerLeave={() => setPressing(null)}
            style={{
              border: '2px solid #D71920',
              cursor: 'pointer', padding: 0, textAlign: 'left',
              borderRadius: 20, overflow: 'hidden', position: 'relative',
              background: '#fff',
              transform: pressing === 'tracker' ? 'scale(0.975)' : 'scale(1)',
              transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 150ms ease',
              boxShadow: pressing === 'tracker'
                ? '0 2px 8px rgba(215,25,32,0.12)'
                : '0 4px 20px rgba(215,25,32,0.13), 0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 118 }}>

              {/* Left — content */}
              <div style={{ flex: 1, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 1 }}>
                <div>
                  <span style={{
                    display: 'inline-block', fontSize: 8, fontWeight: 900, letterSpacing: 2,
                    textTransform: 'uppercase', color: '#fff',
                    background: '#D71920', padding: '3px 9px',
                    borderRadius: 20, marginBottom: 8,
                  }}>
                    Health
                  </span>
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: '#1A1A1A', margin: '0 0 4px', lineHeight: 1.15 }}>
                    Protein Tracker
                  </h2>
                  <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px', fontWeight: 500, lineHeight: 1.5 }}>
                    Track daily protein intake and build healthy habits.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px' }}>
                    {['Track Protein', 'Daily Goals', 'Smart Insights', 'Build Habits'].map(f => (
                      <span key={f} style={{ fontSize: 9, color: '#D71920', fontWeight: 700 }}>• {f}</span>
                    ))}
                  </div>
                </div>
                <div style={{
                  marginTop: 12,
                  background: 'linear-gradient(135deg,#D71920,#B51218)',
                  color: '#fff', borderRadius: 10, padding: '8px 0',
                  fontSize: 11, fontWeight: 800, textAlign: 'center', letterSpacing: 0.5,
                }}>
                  OPEN PROTEIN TRACKER
                </div>
              </div>

              {/* Right — mascot */}
              <div style={{
                width: 110, flexShrink: 0, position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(160deg,#fff5f5 0%,#ffe4e4 100%)',
              }}>
                <img
                  src="/egg mus_Image_v5vrg3v5vrg3v5vr-removebg-preview.png"
                  alt=""
                  style={{
                    position: 'absolute', bottom: -4, right: -8,
                    width: 118, height: 118, objectFit: 'contain',
                  }}
                />
              </div>
            </div>
          </button>

          {/* ══ SKM EGG RUNNER CARD ══ */}
          <button
            onClick={handleSelectGame}
            onPointerDown={() => setPressing('game')}
            onPointerUp={() => setPressing(null)}
            onPointerLeave={() => setPressing(null)}
            style={{
              border: '2px solid #D71920',
              cursor: 'pointer', padding: 0, textAlign: 'left',
              borderRadius: 20, overflow: 'hidden', position: 'relative',
              background: '#fff',
              transform: pressing === 'game' ? 'scale(0.975)' : 'scale(1)',
              transition: 'transform 150ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 150ms ease',
              boxShadow: pressing === 'game'
                ? '0 2px 8px rgba(215,25,32,0.12)'
                : '0 4px 20px rgba(215,25,32,0.13), 0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 118 }}>

              {/* Left — content */}
              <div style={{ flex: 1, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', zIndex: 1 }}>
                <div>
                  <span style={{
                    display: 'inline-block', fontSize: 8, fontWeight: 900, letterSpacing: 2,
                    textTransform: 'uppercase', color: '#fff',
                    background: '#D71920', padding: '3px 9px',
                    borderRadius: 20, marginBottom: 8,
                  }}>
                    Game
                  </span>
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: '#1A1A1A', margin: '0 0 4px', lineHeight: 1.15 }}>
                    SKM Egg Runner
                  </h2>
                  <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px', fontWeight: 500, lineHeight: 1.5 }}>
                    Evolve from Egg to Champion.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px' }}>
                    {['Collect Eggs', 'Earn Rewards', 'Unlock Characters', 'Compete'].map(f => (
                      <span key={f} style={{ fontSize: 9, color: '#D71920', fontWeight: 700 }}>• {f}</span>
                    ))}
                  </div>
                </div>
                <div style={{
                  marginTop: 12,
                  background: 'linear-gradient(135deg,#D71920,#B51218)',
                  color: '#fff', borderRadius: 10, padding: '8px 0',
                  fontSize: 11, fontWeight: 800, textAlign: 'center', letterSpacing: 0.5,
                }}>
                  PLAY SKM EGG RUNNER
                </div>
              </div>

              {/* Right — mascot */}
              <div style={{
                width: 110, flexShrink: 0, position: 'relative', overflow: 'hidden',
                background: 'linear-gradient(160deg,#fff5f5 0%,#ffe4e4 100%)',
              }}>
                <img
                  src="/egg play_Image_o17lyuo17lyuo17l-removebg-preview.png"
                  alt=""
                  style={{
                    position: 'absolute', bottom: -4, right: -8,
                    width: 118, height: 118, objectFit: 'contain',
                  }}
                />
              </div>
            </div>
          </button>

        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center', fontSize: 9, color: '#C8C8C8',
          padding: '10px 0 14px', margin: 0, letterSpacing: 1.5, textTransform: 'uppercase', flexShrink: 0,
        }}>
          SKM © 2024 · All Rights Reserved
        </p>
      </div>

      {showQRModal && <QRAccessModal onConfirm={handleQRConfirm} onCancel={handleQRCancel} />}

      {showGate && !showDevPanel && (
        <SystemUpdateGate
          onAccessGranted={() => { setShowGate(false); setShowDevPanel(true); }}
          onCancel={() => setShowGate(false)}
        />
      )}

      {showDevPanel && (
        <SettingsModal
          isOpen={true}
          onClose={() => setShowDevPanel(false)}
          soundEnabled={true}
          musicEnabled={true}
          onToggleSound={() => {}}
          onToggleMusic={() => {}}
          onStartGame={() => {}}
          initialView="DEV_PANEL"
          onNavigateQR={onSelectQR ? () => { setShowDevPanel(false); onSelectQR(); } : undefined}
        />
      )}
    </>
  );
}
