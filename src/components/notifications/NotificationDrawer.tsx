/**
 * NotificationDrawer — slide-in panel with grouped notifications.
 * Sections: Today, Yesterday, Earlier. Tabs: All / Unread.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, Trash2, Settings } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import type { AppNotification } from '../../types/notifications';
import NotificationItem from './NotificationItem';

type FilterTab = 'all' | 'unread';

function sectionKey(date: Date): 'today' | 'yesterday' | 'earlier' {
  const now = new Date();
  const d = new Date(date);
  const todayStart     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  if (d >= todayStart)     return 'today';
  if (d >= yesterdayStart) return 'yesterday';
  return 'earlier';
}

interface DrawerSection {
  label: string;
  items: AppNotification[];
}

export default function NotificationDrawer({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const { notifications, drawerOpen, closeDrawer, markAllRead, clearAll, unreadCount } = useNotifications();
  const [tab,     setTab]     = useState<FilterTab>('all');
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Animate in/out
  useEffect(() => {
    if (drawerOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [drawerOpen]);

  // Close on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDrawer(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  const filtered = useMemo(() => {
    return tab === 'unread' ? notifications.filter(n => !n.read) : notifications;
  }, [notifications, tab]);

  const sections = useMemo((): DrawerSection[] => {
    const groups: Record<string, AppNotification[]> = { today: [], yesterday: [], earlier: [] };
    filtered.forEach(n => groups[sectionKey(n.createdAt)].push(n));
    return [
      { label: 'Today',     items: groups.today },
      { label: 'Yesterday', items: groups.yesterday },
      { label: 'Earlier',   items: groups.earlier },
    ].filter(s => s.items.length > 0);
  }, [filtered]);

  if (!drawerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={closeDrawer}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 250ms ease',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '100%', maxWidth: 400, zIndex: 1201,
          background: '#fff',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms cubic-bezier(0.34,1.1,0.64,1)',
          fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          flexShrink: 0,
          background: 'linear-gradient(135deg,#D71920 0%,#B31217 100%)',
          padding: '14px 16px',
          boxShadow: '0 2px 12px rgba(215,25,32,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bell size={18} color="#fff" />
              <span style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  background: 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 10,
                  fontWeight: 800, padding: '2px 7px', borderRadius: 10,
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {onOpenSettings && (
                <button onClick={onOpenSettings} style={iconBtn} title="Notification Settings">
                  <Settings size={15} color="#fff" />
                </button>
              )}
              <button onClick={closeDrawer} style={iconBtn} title="Close">
                <X size={16} color="#fff" />
              </button>
            </div>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={actionBtn}>
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={clearAll} style={{ ...actionBtn, background: 'rgba(255,255,255,0.12)' }}>
                <Trash2 size={12} />
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div style={{
          flexShrink: 0, display: 'flex',
          borderBottom: '1px solid #F0F0F0',
          background: '#fff',
        }}>
          {(['all', 'unread'] as FilterTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: tab === t ? 800 : 600,
                color: tab === t ? '#D71920' : '#999',
                borderBottom: tab === t ? '2px solid #D71920' : '2px solid transparent',
                textTransform: 'capitalize', transition: 'all 150ms ease',
              }}
            >
              {t === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* ── Notification list ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sections.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            sections.map(section => (
              <div key={section.label}>
                <div style={{
                  padding: '10px 16px 4px',
                  fontSize: 10, fontWeight: 900, color: '#bbb',
                  textTransform: 'uppercase', letterSpacing: 1.5,
                  background: '#FAFAFA', borderBottom: '1px solid #F5F5F5',
                }}>
                  {section.label}
                </div>
                {section.items.map(n => (
                  <NotificationItem key={n.id} notification={n} />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function EmptyState({ tab }: { tab: FilterTab }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 40,
      color: '#ccc', gap: 12,
    }}>
      <Bell size={40} color="#E8E8E8" />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#bbb' }}>
        {tab === 'unread' ? 'All caught up!' : 'No notifications yet'}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#ccc', textAlign: 'center', lineHeight: 1.5 }}>
        {tab === 'unread'
          ? 'You have no unread notifications.'
          : 'Scan your first SKM egg or play a game to get started.'}
      </p>
    </div>
  );
}

// ── Mini styles ─────────────────────────────────────────────────────────────

const iconBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.25)',
  background: 'rgba(255,255,255,0.15)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const actionBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '5px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.25)',
  color: '#fff', fontSize: 11, fontWeight: 700,
  cursor: 'pointer',
};
