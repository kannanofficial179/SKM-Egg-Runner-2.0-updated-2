/**
 * NotificationBell — Bell icon with unread badge.
 * Drop it anywhere in a header/top-bar.
 */

import React, { useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

interface NotificationBellProps {
  /** Icon size in px (default 20) */
  size?: number;
  /** Icon colour (default #D71920) */
  color?: string;
  /** Extra inline styles for the wrapper button */
  style?: React.CSSProperties;
}

export default function NotificationBell({ size = 20, color = '#D71920', style }: NotificationBellProps) {
  const { unreadCount, openDrawer } = useNotifications();
  const prevCount = useRef(unreadCount);
  const badgeRef  = useRef<HTMLSpanElement | null>(null);

  // Bounce badge on new notification
  useEffect(() => {
    if (unreadCount > prevCount.current && badgeRef.current) {
      badgeRef.current.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }],
        { duration: 400, easing: 'cubic-bezier(0.34,1.56,0.64,1)' }
      );
    }
    prevCount.current = unreadCount;
  }, [unreadCount]);

  return (
    <button
      onClick={openDrawer}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 10,
        border: 'none',
        background: 'rgba(215,25,32,0.08)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 150ms ease',
        ...style,
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(215,25,32,0.16)')}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(215,25,32,0.08)')}
    >
      <Bell size={size} color={color} strokeWidth={2} />

      {unreadCount > 0 && (
        <span
          ref={badgeRef}
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            background: '#D71920',
            color: '#fff',
            fontSize: 9,
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            border: '2px solid #fff',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
