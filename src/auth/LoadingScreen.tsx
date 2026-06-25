import { useEffect, useState, useRef } from 'react';

const RED = '#D71920';

const MESSAGES = [
  'Building healthy habits...',
  'Loading your protein journey...',
  'Preparing your dashboard...',
  'Checking today\'s progress...',
  'Welcome back...',
];

interface Props {
  /** Called when the minimum display time has passed AND data is ready */
  ready: boolean;
  onDone: () => void;
}

export default function LoadingScreen({ ready, onDone }: Props) {
  const [progress,  setProgress]  = useState(0);
  const [msgIdx,    setMsgIdx]    = useState(0);
  const [visible,   setVisible]   = useState(true);
  const [bounce,    setBounce]    = useState(false);
  const doneRef = useRef(false);

  // Bounce the mascot every 800ms
  useEffect(() => {
    const t = setInterval(() => setBounce(b => !b), 800);
    return () => clearInterval(t);
  }, []);

  // Rotate messages every 600ms
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 700);
    return () => clearInterval(t);
  }, []);

  // Drive progress bar:
  // - Animate to 85% over 800ms regardless
  // - Jump to 100% the moment ready=true (but min 400ms shown)
  useEffect(() => {
    const start = Date.now();
    const FAST_END = 800; // reach 85% in 800ms

    const tick = () => {
      const elapsed = Date.now() - start;
      const natural = Math.min(85, Math.round((elapsed / FAST_END) * 85));
      setProgress(natural);
      if (natural < 85) {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!ready || doneRef.current) return;
    // Jump to 100% then fade out after a short settle
    setProgress(100);
    const t = setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setVisible(false);
      setTimeout(onDone, 280);
    }, 350);
    return () => clearTimeout(t);
  }, [ready, onDone]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'linear-gradient(160deg,#ffffff 0%,#fff5f5 50%,#ffffff 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      transition: 'opacity 280ms ease',
      opacity: visible ? 1 : 0,
    }}>

      {/* Top red accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${RED},#B51218)` }} />

      {/* Mascot with bounce */}
      <div style={{
        transform: bounce ? 'translateY(-8px)' : 'translateY(0px)',
        transition: 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
        marginBottom: 24,
      }}>
        <img
          src="/Jump pose.png"
          alt="SKM"
          style={{ width: 80, height: 80, objectFit: 'contain', display: 'block' }}
        />
      </div>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: RED }}>SKM</span>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#1A1A1A' }}>Experience</span>
      </div>

      {/* Rotating message */}
      <p style={{
        fontSize: 12, color: '#999', fontWeight: 500,
        margin: '0 0 28px', minHeight: 18, textAlign: 'center',
        transition: 'opacity 200ms',
      }}>
        {MESSAGES[msgIdx]}
      </p>

      {/* Progress bar */}
      <div style={{
        width: 200, height: 3, borderRadius: 99,
        background: 'rgba(215,25,32,0.12)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          borderRadius: 99,
          background: `linear-gradient(90deg,${RED},#B51218)`,
          transition: progress === 100 ? 'width 300ms ease' : 'width 80ms linear',
          boxShadow: `0 0 8px ${RED}66`,
        }} />
      </div>

      {/* SKM footer */}
      <p style={{
        position: 'absolute', bottom: 20,
        fontSize: 9, color: 'rgba(0,0,0,0.2)',
        letterSpacing: 2, textTransform: 'uppercase', margin: 0,
      }}>
        SKM © 2024 · All Rights Reserved
      </p>
    </div>
  );
}
