import { useState, useRef } from 'react';
import {
  Share2, Heart, Trophy, Download, X,
  Copy, Check, ChevronUp, ChevronDown,
  Clock, Sparkles, Layers, Flame, ArrowLeft,
} from 'lucide-react';
import type { MilestoneDef } from '../services/protein/milestoneRewardService';
import { RARITY_COLOR, RARITY_BG } from '../services/protein/milestoneRewardService';
import StickerArt from './StickerArt';

interface StickerDetailModalProps {
  milestone:        MilestoneDef | null;
  claimed:          boolean;
  claimedDate?:     string;
  ownerName?:       string;
  collectionIndex:  number;
  totalCollected:   number;
  isFavorite:       boolean;
  onToggleFavorite: (days: number) => void;
  onClose:          () => void;
}

const RED  = '#D71920';
const RED2 = '#B31217';

export default function StickerDetailModal({
  milestone, claimed, claimedDate, ownerName = 'Champion',
  collectionIndex, totalCollected, isFavorite, onToggleFavorite, onClose,
}: StickerDetailModalProps) {

  const [showShare,     setShowShare]     = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);
  const [showMore,      setShowMore]      = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [pressing,      setPressing]      = useState<string | null>(null);
  const [downloading,   setDownloading]   = useState(false);
  const [shareLoading,  setShareLoading]  = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  if (!milestone) return null;

  const rc   = RARITY_COLOR[milestone.rarity];
  const rb   = RARITY_BG[milestone.rarity];
  const grad = `linear-gradient(135deg, ${milestone.color}, ${milestone.color2})`;

  const formattedDate = claimedDate
    ? new Date(claimedDate + 'T12:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const shareText = `🔥 I just unlocked the "${milestone.stickerName}" sticker after a ${milestone.days}-Day Streak on SKM Protein Tracker! 💪 Start your healthy egg-eating journey today!\n\nhttps://skm-egg-runner.web.app`;
  const shareCaption = `🔥 ${milestone.stickerName} — ${milestone.days}-Day Streak unlocked! 💪 #SKMEgg #ProteinStreak`;

  // ── Canvas share card generator ─────────────────────────────────
  async function generateShareCard(): Promise<Blob | null> {
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background gradient
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, milestone.color);
    grd.addColorStop(1, milestone.color2);
    ctx.fillStyle = grd;
    ctx.roundRect(0, 0, W, H, 60);
    ctx.fill();

    // Decorative circles
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(W + 60, -60, 400, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-80, H + 80, 320, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Top label
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('I JUST UNLOCKED', W / 2, 160);

    // Sticker name
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 96px system-ui, sans-serif';
    ctx.fillText(milestone.stickerName, W / 2, 310);

    // Sticker emoji / art (fallback to emoji since canvas can't render SVG easily)
    ctx.font = '320px serif';
    ctx.textAlign = 'center';
    ctx.fillText(milestone.sticker, W / 2, 720);

    // Streak pill background
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    const pillW = 480, pillH = 80, pillX = (W - pillW) / 2, pillY = 810;
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 40);
    ctx.fill();

    // Streak text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🔥 ${milestone.days} Day Streak`, W / 2, pillY + 52);

    // Rarity badge
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const badgeW = 280, badgeH = 64, badgeX = (W - badgeW) / 2, badgeY = 930;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 32);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(milestone.rarity.toUpperCase(), W / 2, badgeY + 43);

    // Description
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '38px system-ui, sans-serif';
    const words = milestone.stickerDesc.split(' ');
    let line = '', y = 1060;
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > W - 160) {
        ctx.fillText(line, W / 2, y); y += 52; line = word;
      } else { line = test; }
    }
    if (line) ctx.fillText(line, W / 2, y);

    // Bottom watermark
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillText('SKM Protein Tracker · skm-egg-runner.web.app', W / 2, H - 60);

    return new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  }

  // ── Download handler ─────────────────────────────────────────────
  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await generateShareCard();
      if (!blob) return;
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href     = url;
      a.download = `${milestone.stickerName.replace(/\s+/g, '')}Sticker_${date}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setTimeout(() => setDownloading(false), 1200);
    }
  }

  // ── Share handler — tries Web Share API with image, falls back to sheet ──
  async function handleNativeShare() {
    setShareLoading(true);
    try {
      const blob = await generateShareCard();
      if (blob && navigator.canShare?.({ files: [new File([blob], 'sticker.png', { type: 'image/png' })] })) {
        await navigator.share({
          files:  [new File([blob], `${milestone.stickerName}.png`, { type: 'image/png' })],
          title:  `SKM Protein Tracker — ${milestone.stickerName}`,
          text:   shareCaption,
          url:    'https://skm-egg-runner.web.app',
        });
        setShareLoading(false);
        return;
      }
    } catch { /* user cancelled or API unavailable — fall through to sheet */ }
    setShareLoading(false);
    setShowShare(true);
  }

  function handleCopyText() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {});
  }

  // ── ActionBtn component ──────────────────────────────────────────
  function ActionBtn({
    id, icon: Icon, label, onClick, variant = 'primary', disabled = false, fullWidth = false,
  }: {
    id: string; icon: React.ElementType; label: string; onClick: () => void;
    variant?: 'primary' | 'outline' | 'ghost'; disabled?: boolean; fullWidth?: boolean;
  }) {
    const isPressed = pressing === id;
    const styles: Record<string, { bg: string; color: string; border: string; shadow: string }> = {
      primary: { bg: `linear-gradient(135deg,${RED},${RED2})`, color: '#fff', border: 'none',              shadow: `0 6px 18px ${RED}44` },
      outline: { bg: '#fff',     color: RED,   border: `1.5px solid ${RED}44`,  shadow: '0 2px 8px rgba(0,0,0,0.06)' },
      ghost:   { bg: '#F5F5F5', color: '#555', border: '1.5px solid #E8E8E8',  shadow: '0 2px 6px rgba(0,0,0,0.04)' },
    };
    const s = styles[variant];
    return (
      <button
        onClick={() => { if (!disabled) onClick(); }}
        onPointerDown={() => !disabled && setPressing(id)}
        onPointerUp={() => setPressing(null)}
        onPointerLeave={() => setPressing(null)}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          height: 48, padding: '0 20px', borderRadius: 16,
          width: fullWidth ? '100%' : undefined,
          flex: fullWidth ? undefined : 1,
          border: disabled ? '1.5px solid #E8E8E8' : s.border,
          background: disabled ? '#F0F0F0' : s.bg,
          color: disabled ? '#bbb' : s.color,
          fontWeight: 600, fontSize: 14,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: disabled || isPressed ? 'none' : s.shadow,
          transform: isPressed ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 100ms, box-shadow 100ms',
          WebkitTapHighlightColor: 'transparent', userSelect: 'none',
        }}
      >
        <Icon size={20} strokeWidth={2.2} />
        <span>{label}</span>
      </button>
    );
  }

  // ── MILESTONE DETAIL PANEL ───────────────────────────────────────
  if (showMilestone) {
    const daysLeft = Math.max(0, 0); // populated on streak screen; here just show the card
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10002,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)', padding: '16px',
        animation: 'sdt-fade 180ms ease',
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          width: '100%', maxWidth: 390, background: '#fff', borderRadius: 28,
          overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          animation: 'sdt-pop 300ms cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: '90vh', overflowY: 'auto',
        }}>
          {/* Hero */}
          <div style={{ background: grad, padding: '36px 24px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
            <button onClick={() => setShowMilestone(false)} style={{
              position: 'absolute', top: 14, left: 14, zIndex: 2,
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ArrowLeft size={18} color="#fff" strokeWidth={2.5} />
            </button>
            <button onClick={onClose} style={{
              position: 'absolute', top: 14, right: 14, zIndex: 2,
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={18} color="#fff" strokeWidth={2.5} />
            </button>
            <div style={{ marginTop: 8, marginBottom: 14, filter: `drop-shadow(0 0 24px ${milestone.color}99)`, animation: 'sdt-float 3s ease-in-out infinite' }}>
              <StickerArt days={milestone.days} fallback={milestone.sticker} size={100} locked={!claimed} />
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5, marginBottom: 8 }}>
              <Sparkles size={11} strokeWidth={2.5} />{milestone.rarity.toUpperCase()}
            </span>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 4px', letterSpacing: -0.3 }}>{milestone.stickerName}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 600 }}>{milestone.label} · {milestone.days}-Day Streak</p>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 20px 28px' }}>
            {/* Description */}
            <div style={{ background: rb, border: `1.5px solid ${rc}33`, borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>{milestone.stickerDesc}</p>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Required Streak', value: `${milestone.days} Days`, color: rc },
                { label: 'Rarity', value: milestone.rarity, color: rc },
                { label: 'Status', value: claimed ? '✅ Claimed' : '🔒 Locked', color: claimed ? '#22C55E' : '#999' },
                { label: 'Unlock Date', value: formattedDate ?? '—', color: '#1A1A1A' },
              ].map(c => (
                <div key={c.label} style={{ background: '#F8F8F8', borderRadius: 12, padding: '10px 12px' }}>
                  <p style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 3px' }}>{c.label}</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
                </div>
              ))}
            </div>

            {/* Progress bar if not claimed */}
            {!claimed && (
              <div style={{ background: '#F8F8F8', borderRadius: 14, padding: '14px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>Progress to unlock</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: rc }}>? / {milestone.days} days</span>
                </div>
                <div style={{ height: 8, background: '#E8E8E8', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: '30%', background: `linear-gradient(90deg,${milestone.color},${milestone.color2})`, borderRadius: 4 }} />
                </div>
                <p style={{ fontSize: 11, color: '#bbb', margin: '8px 0 0', fontWeight: 600 }}>Keep scanning eggs daily to reach this milestone!</p>
              </div>
            )}

            <button onClick={() => setShowMilestone(false)} style={{
              width: '100%', height: 48, borderRadius: 16, border: 'none',
              background: `linear-gradient(135deg,${RED},${RED2})`, color: '#fff',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 6px 18px ${RED}44`,
            }}>
              <ArrowLeft size={18} strokeWidth={2.5} />
              Back to Sticker
            </button>
          </div>
        </div>
        <style>{`
          @keyframes sdt-fade  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes sdt-pop   { from { transform: scale(0.82) translateY(30px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
          @keyframes sdt-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        `}</style>
      </div>
    );
  }

  // ── SHARE SHEET ─────────────────────────────────────────────────
  if (showShare) {
    const platforms = [
      {
        label: 'WhatsApp', color: '#25D366', bg: '#F0FDF4',
        icon: <svg viewBox="0 0 24 24" width={22} height={22} fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.555 4.112 1.522 5.84L0 24l6.335-1.498A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.493-5.18-1.355l-.37-.217-3.762.89.952-3.668-.242-.378A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>,
        href: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      },
      {
        label: 'Facebook', color: '#1877F2', bg: '#EFF6FF',
        icon: <svg viewBox="0 0 24 24" width={22} height={22} fill="#1877F2"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>,
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://skm-egg-runner.web.app')}`,
      },
      {
        label: 'X / Twitter', color: '#000', bg: '#F5F5F5',
        icon: <svg viewBox="0 0 24 24" width={22} height={22} fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareCaption)}`,
      },
    ];

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        animation: 'sdt-fade 200ms ease',
      }}>
        <div style={{
          width: '100%', maxWidth: 480,
          background: '#fff', borderRadius: '28px 28px 0 0',
          overflow: 'hidden', boxShadow: '0 -16px 60px rgba(0,0,0,0.4)',
          animation: 'sdt-sheet-up 320ms cubic-bezier(0.34,1.2,0.64,1)',
        }}>
          {/* Handle */}
          <div style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E8E8E8' }} />
          </div>

          {/* Share card preview — visual only */}
          <div style={{
            margin: '8px 16px 16px', borderRadius: 20, overflow: 'hidden',
            background: grad, padding: '24px 20px', textAlign: 'center', position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
            <div style={{ marginBottom: 10 }}>
              <StickerArt days={milestone.days} fallback={milestone.sticker} size={72} />
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 3px', letterSpacing: 1, textTransform: 'uppercase' }}>I just unlocked</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: -0.3 }}>{milestone.stickerName}</p>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '4px 12px' }}>
              <Flame size={12} color="#fff" strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{milestone.days} Day Streak · SKM Protein Tracker</span>
            </div>
          </div>

          {/* Platform buttons */}
          <div style={{ padding: '0 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Share To</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              {platforms.map(p => (
                <button key={p.label}
                  onClick={() => { if (p.href) window.open(p.href, '_blank', 'noopener'); }}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    padding: '12px 6px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    background: p.bg, transition: 'transform 100ms',
                  }}
                  onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                  onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
                  onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {p.icon}
                  <span style={{ fontSize: 9, fontWeight: 700, color: p.color }}>{p.label}</span>
                </button>
              ))}
            </div>

            {/* Copy message */}
            <button onClick={handleCopyText} style={{
              width: '100%', height: 48, borderRadius: 14, marginBottom: 10,
              border: `1.5px solid ${copied ? '#22C55E' : '#E8E8E8'}`,
              background: copied ? '#F0FDF4' : '#F5F5F5',
              color: copied ? '#166534' : '#444',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 200ms',
            }}>
              {copied ? <Check size={20} strokeWidth={2.5} color="#166534" /> : <Copy size={20} strokeWidth={2} />}
              {copied ? 'Copied!' : 'Copy Caption + Link'}
            </button>

            {/* Download card */}
            <button onClick={handleDownload} disabled={downloading} style={{
              width: '100%', height: 48, borderRadius: 14, marginBottom: 10,
              border: '1.5px solid #E8E8E8', background: downloading ? '#F0FDF4' : '#F8F8F8',
              color: downloading ? '#166534' : '#444',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}>
              {downloading ? <Check size={20} strokeWidth={2.5} color="#166534" /> : <Download size={20} strokeWidth={2} />}
              {downloading ? 'Downloaded!' : 'Save as Image (1080×1350)'}
            </button>

            {/* Back */}
            <button onClick={() => setShowShare(false)} style={{
              width: '100%', height: 48, borderRadius: 14, marginBottom: 20,
              border: 'none', background: `linear-gradient(135deg,${RED},${RED2})`,
              color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: `0 6px 18px ${RED}44`,
            }}>
              <ArrowLeft size={18} strokeWidth={2.5} />
              Back
            </button>
          </div>
        </div>

        <style>{`
          @keyframes sdt-fade     { from { opacity: 0; } to { opacity: 1; } }
          @keyframes sdt-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  // ── MAIN DETAIL MODAL ────────────────────────────────────────────
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)', padding: '16px',
      animation: 'sdt-fade 200ms ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 390, background: '#fff', borderRadius: 28,
        overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        animation: 'sdt-pop 320ms cubic-bezier(0.34,1.56,0.64,1)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* ── Hero ── */}
        <div style={{
          background: claimed ? grad : 'linear-gradient(135deg,#E8E8E8,#C8C8C8)',
          padding: '32px 20px 26px', textAlign: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -50, left: -30, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />

          {/* Close button */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 14, zIndex: 2,
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)', transition: 'background 150ms',
          }}
            onPointerDown={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.38)')}
            onPointerUp={e   => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
            onPointerLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
          >
            <X size={18} color="#fff" strokeWidth={2.5} />
          </button>

          {/* Favorite button */}
          {claimed && (
            <button onClick={() => onToggleFavorite(milestone.days)} style={{
              position: 'absolute', top: 14, left: 14, zIndex: 2,
              width: 36, height: 36, borderRadius: 12,
              background: isFavorite ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.22)',
              border: isFavorite ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(8px)', transition: 'all 150ms',
            }}
              onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.88)')}
              onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Heart size={18} strokeWidth={2.2} color={isFavorite ? '#FBBF24' : '#fff'} fill={isFavorite ? '#FBBF24' : 'none'} />
            </button>
          )}

          <div style={{
            display: 'inline-block', marginBottom: 14,
            filter: claimed ? `drop-shadow(0 0 22px ${milestone.color}99)` : 'none',
            animation: claimed ? 'sdt-float 3s ease-in-out infinite' : 'none',
          }}>
            <StickerArt days={milestone.days} fallback={milestone.sticker} size={96} locked={!claimed} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 14px', borderRadius: 20,
              background: claimed ? 'rgba(255,255,255,0.22)' : '#E0E0E0',
              fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
              color: claimed ? '#fff' : '#999', backdropFilter: 'blur(6px)',
            }}>
              <Sparkles size={11} strokeWidth={2.5} />
              {milestone.rarity.toUpperCase()}
            </span>
          </div>

          <p style={{ fontSize: 20, fontWeight: 900, color: claimed ? '#fff' : '#ccc', margin: '0 0 4px', letterSpacing: -0.3 }}>
            {milestone.stickerName}
          </p>
          <p style={{ fontSize: 12, color: claimed ? 'rgba(255,255,255,0.7)' : '#bbb', margin: 0, fontWeight: 600 }}>
            {milestone.label} · {milestone.days}-Day Streak
          </p>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '20px 20px 28px' }}>

          {/* Description */}
          <div style={{ background: rb, border: `1.5px solid ${rc}33`, borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#1A1A1A', margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
              {milestone.stickerDesc}
            </p>
          </div>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            <MetaCell label="Rarity"          value={milestone.rarity}                                   valueColor={rc} />
            <MetaCell label="Required Streak" value={`${milestone.days} Days`} />
            {formattedDate && <MetaCell label="Unlocked On" value={formattedDate} />}
            {claimed       && <MetaCell label="Owner"       value={ownerName} />}
            <MetaCell label="Collection" value={`#${collectionIndex} of ${totalCollected}`} />
            <MetaCell label="Status"     value={claimed ? 'Collected' : 'Locked'} valueColor={claimed ? '#22C55E' : '#999'} />
          </div>

          {/* Locked hint */}
          {!claimed && (
            <div style={{ background: '#FEF3C7', border: '1.5px solid #F59E0B44', borderRadius: 14, padding: '12px 14px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Flame size={18} color="#D97706" strokeWidth={2} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', margin: 0 }}>
                Reach a {milestone.days}-day streak to unlock this sticker.
              </p>
            </div>
          )}

          {/* Action buttons */}
          {claimed ? (
            <>
              {/* Row 1: Share + Favorite */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <ActionBtn
                  id="share" icon={shareLoading ? Check : Share2}
                  label={shareLoading ? 'Opening…' : 'Share'}
                  onClick={handleNativeShare} variant="primary"
                  disabled={shareLoading}
                />
                <ActionBtn
                  id="fav" icon={Heart}
                  label={isFavorite ? 'Favorited' : 'Favorite'}
                  onClick={() => onToggleFavorite(milestone.days)}
                  variant={isFavorite ? 'outline' : 'ghost'}
                />
              </div>

              {/* Row 2: Milestone + Download */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <ActionBtn id="milestone" icon={Trophy}   label="Milestone" onClick={() => setShowMilestone(true)} variant="ghost" />
                <ActionBtn id="download"  icon={downloading ? Check : Download} label={downloading ? 'Saved!' : 'Download'} onClick={handleDownload} variant="ghost" disabled={downloading} />
              </div>

              {/* Row 3: Close */}
              <ActionBtn id="close" icon={X} label="Close" onClick={onClose} variant="primary" fullWidth />

              {/* More details */}
              <button onClick={() => setShowMore(m => !m)} style={{
                width: '100%', height: 42, marginTop: 10,
                borderRadius: 14, border: '1.5px solid #E8E8E8',
                background: '#FAFAFA', color: '#888',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'background 150ms',
              }}
                onPointerDown={e => (e.currentTarget.style.background = '#F0F0F0')}
                onPointerUp={e   => (e.currentTarget.style.background = '#FAFAFA')}
                onPointerLeave={e => (e.currentTarget.style.background = '#FAFAFA')}
              >
                {showMore ? <ChevronUp size={16} strokeWidth={2.2} /> : <ChevronDown size={16} strokeWidth={2.2} />}
                {showMore ? 'Less' : 'More Details'}
              </button>

              {showMore && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, animation: 'sdt-slide-down 200ms ease' }}>
                  {[
                    { icon: Trophy,   label: 'View Milestone Details',              color: rc,       onClick: () => setShowMilestone(true) },
                    { icon: Clock,    label: `Unlock History: ${formattedDate ?? '—'}`, color: '#6B7280', onClick: undefined },
                    { icon: Sparkles, label: `Rarity: ${milestone.rarity}`,         color: rc,       onClick: undefined },
                    { icon: Layers,   label: `Other ${milestone.rarity} stickers`,  color: '#6B7280', onClick: undefined },
                  ].map(item => (
                    <div key={item.label}
                      onClick={item.onClick}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderRadius: 14,
                        background: '#F8F8F8', border: '1px solid #F0F0F0',
                        cursor: item.onClick ? 'pointer' : 'default',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <item.icon size={17} color={item.color} strokeWidth={2} />
                      </div>
                      <span style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <ActionBtn id="close-locked" icon={X} label="Close" onClick={onClose} variant="primary" fullWidth />
          )}
        </div>
      </div>

      <style>{`
        @keyframes sdt-fade       { from { opacity: 0; }                                   to { opacity: 1; } }
        @keyframes sdt-pop        { from { transform: scale(0.82) translateY(30px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes sdt-float      { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes sdt-slide-down { from { opacity: 0; transform: translateY(-8px); }      to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function MetaCell({ label, value, valueColor = '#1A1A1A' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ background: '#F8F8F8', borderRadius: 12, padding: '10px 12px' }}>
      <p style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 700, color: valueColor, margin: 0, lineHeight: 1.3 }}>{value}</p>
    </div>
  );
}
