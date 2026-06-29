/**
 * AchievementPopup — full-screen celebration overlay for milestones.
 * Triggered via the custom event 'skm_achievement_popup'.
 */

import React, { useEffect, useState } from 'react';
import { Trophy, Star, Flame, Egg, Crown, Zap } from 'lucide-react';

export type AchievementPopupType =
  | 'level_up'
  | 'badge'
  | 'protein_milestone'
  | 'streak_milestone'
  | 'champion_rank'
  | 'golden_qr'
  | 'high_score';

export interface AchievementPopupPayload {
  type: AchievementPopupType;
  title: string;
  subtitle?: string;
  value?: string | number;
}

// Dispatch this event from anywhere to show the popup
export function triggerAchievementPopup(payload: AchievementPopupPayload) {
  window.dispatchEvent(new CustomEvent('skm_achievement_popup', { detail: payload }));
}

function popupConfig(type: AchievementPopupType) {
  switch (type) {
    case 'level_up':
      return { icon: <Zap size={40} color="#EAB308" />, gradient: 'linear-gradient(135deg,#1E1B4B 0%,#312E81 100%)', accent: '#EAB308', particle: '⭐' };
    case 'badge':
      return { icon: <Trophy size={40} color="#F59E0B" />, gradient: 'linear-gradient(135deg,#451A03 0%,#78350F 100%)', accent: '#F59E0B', particle: '🏆' };
    case 'protein_milestone':
      return { icon: <Egg size={40} color="#D71920" />, gradient: 'linear-gradient(135deg,#450A0A 0%,#7F1D1D 100%)', accent: '#D71920', particle: '🥚' };
    case 'streak_milestone':
      return { icon: <Flame size={40} color="#F97316" />, gradient: 'linear-gradient(135deg,#431407 0%,#7C2D12 100%)', accent: '#F97316', particle: '🔥' };
    case 'champion_rank':
      return { icon: <Crown size={40} color="#F59E0B" />, gradient: 'linear-gradient(135deg,#1C1917 0%,#44403C 100%)', accent: '#F59E0B', particle: '👑' };
    case 'golden_qr':
      return { icon: <Star size={40} color="#FBBF24" />, gradient: 'linear-gradient(135deg,#1C1917 0%,#78350F 100%)', accent: '#FBBF24', particle: '✨' };
    case 'high_score':
      return { icon: <Trophy size={40} color="#A855F7" />, gradient: 'linear-gradient(135deg,#1E1B4B 0%,#4C1D95 100%)', accent: '#A855F7', particle: '🎯' };
  }
}

const PARTICLES = 12;

export default function AchievementPopup() {
  const [payload,   setPayload]   = useState<AchievementPopupPayload | null>(null);
  const [visible,   setVisible]   = useState(false);
  const [particles, setParticles] = useState<{ x: number; y: number; rotate: number; delay: number }[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AchievementPopupPayload>).detail;
      setPayload(detail);
      setParticles(
        Array.from({ length: PARTICLES }, () => ({
          x: Math.random() * 100,
          y: Math.random() * 100,
          rotate: Math.random() * 360,
          delay: Math.random() * 400,
        }))
      );
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));

      // Auto-dismiss after 3.5s
      setTimeout(() => dismiss(), 3500);
    };

    window.addEventListener('skm_achievement_popup', handler);
    return () => window.removeEventListener('skm_achievement_popup', handler);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setPayload(null), 400);
  };

  if (!payload) return null;

  const cfg = popupConfig(payload.type);

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}
    >
      {/* Particle confetti */}
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: 18,
            opacity: visible ? 1 : 0,
            transform: visible ? `rotate(${p.rotate}deg) scale(1)` : 'scale(0)',
            transition: `all 600ms cubic-bezier(0.34,1.56,0.64,1) ${p.delay}ms`,
            pointerEvents: 'none',
          }}
        >
          {cfg.particle}
        </span>
      ))}

      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 1,
          background: cfg.gradient,
          borderRadius: 28,
          padding: '36px 32px',
          maxWidth: 320, width: '90%',
          textAlign: 'center',
          boxShadow: `0 0 0 1.5px ${cfg.accent}40, 0 32px 80px rgba(0,0,0,0.6)`,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(40px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 400ms cubic-bezier(0.34,1.56,0.64,1), opacity 300ms ease',
          overflow: 'hidden',
        }}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${cfg.accent}30 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20, margin: '0 auto 16px',
          background: `${cfg.accent}20`,
          border: `1.5px solid ${cfg.accent}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}>
          {cfg.icon}
        </div>

        <p style={{
          margin: '0 0 8px', fontSize: 11, fontWeight: 900,
          letterSpacing: 3, textTransform: 'uppercase',
          color: cfg.accent, fontFamily: 'monospace',
        }}>
          Achievement Unlocked
        </p>
        <h2 style={{
          margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#fff',
          lineHeight: 1.2, letterSpacing: '-0.3px',
        }}>
          {payload.title}
        </h2>
        {payload.subtitle && (
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
            {payload.subtitle}
          </p>
        )}
        {payload.value && (
          <p style={{
            margin: '12px 0 0', fontSize: 28, fontWeight: 900,
            color: cfg.accent, letterSpacing: '-0.5px',
          }}>
            {payload.value}
          </p>
        )}

        <button
          onClick={dismiss}
          style={{
            marginTop: 24, padding: '12px 32px', borderRadius: 14,
            border: `1.5px solid ${cfg.accent}50`,
            background: `${cfg.accent}20`,
            color: '#fff', fontWeight: 800, fontSize: 14,
            cursor: 'pointer', letterSpacing: 0.3,
          }}
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}
