/**
 * InAppToast — slides in from top-right, auto-dismisses after 5s.
 * Renders the first item in the toastQueue from NotificationContext.
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import type { AppNotification } from '../../types/notifications';

const TOAST_DURATION_MS = 5000;

export default function InAppToast() {
  const { toastQueue, dismissToast, markRead } = useNotifications();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<AppNotification | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (toastQueue.length === 0) return;

    const next = toastQueue[0];
    setCurrent(next);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });

    // Auto-dismiss
    timerRef.current = setTimeout(() => {
      dismiss(next.id);
    }, TOAST_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [toastQueue]);

  const dismiss = (id: string) => {
    setVisible(false);
    setTimeout(() => {
      setCurrent(null);
      dismissToast(id);
    }, 300);
  };

  const handleClick = async () => {
    if (!current) return;
    if (!current.read) await markRead(current.id);
    dismiss(current.id);
  };

  if (!current) return null;

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        width: 320,
        maxWidth: 'calc(100vw - 32px)',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(215,25,32,0.12)',
        overflow: 'hidden',
        cursor: 'pointer',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(calc(100% + 32px)) scale(0.95)',
        opacity: visible ? 1 : 0,
        transition: 'transform 350ms cubic-bezier(0.34,1.1,0.64,1), opacity 300ms ease',
        fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}
    >
      {/* Red progress bar */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg,#D71920,#FF6B6B)',
        animation: `toastProgress ${TOAST_DURATION_MS}ms linear forwards`,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px' }}>
        {/* Icon */}
        <div style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: 10,
          background: 'rgba(215,25,32,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bell size={16} color="#D71920" />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1A1A1A', lineHeight: 1.3 }}>
            {current.title}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#666', lineHeight: 1.45 }}>
            {current.message}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={e => { e.stopPropagation(); dismiss(current.id); }}
          style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: 6,
            border: 'none', background: '#F5F5F5',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={12} color="#999" />
        </button>
      </div>

      <style>{`
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
}
