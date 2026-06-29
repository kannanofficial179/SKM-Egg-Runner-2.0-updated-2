/**
 * Single notification row inside the drawer.
 */

import React from 'react';
import {
  Egg, Flame, Trophy, Swords, Crown, QrCode,
  Bell, Megaphone, Zap, Star, Target, X, Check
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import type { AppNotification, NotificationType } from '../../types/notifications';

interface Props { notification: AppNotification }

function typeIcon(type: NotificationType): React.ReactNode {
  const s = 16;
  switch (type) {
    case 'protein_added':
    case 'protein_goal_complete':
    case 'protein_goal_missed':
    case 'protein_reminder':
    case 'daily_goal_reminder':
    case 'golden_egg_scanned':
      return <Egg size={s} color="#D71920" />;
    case 'protein_streak_increased':
    case 'streak_reminder':
    case 'streak_milestone':
      return <Flame size={s} color="#F97316" />;
    case 'protein_milestone':
    case 'achievement_unlocked':
    case 'level_up':
      return <Trophy size={s} color="#EAB308" />;
    case 'run_completed':
    case 'new_high_score':
    case 'mission_complete':
      return <Swords size={s} color="#8B5CF6" />;
    case 'champion_rank_improved':
      return <Crown size={s} color="#F59E0B" />;
    case 'qr_validated':
    case 'protein_duplicate':
      return <QrCode size={s} color="#10B981" />;
    case 'daily_reward_available':
    case 'daily_summary':
      return <Star size={s} color="#3B82F6" />;
    case 'game_reminder':
      return <Target size={s} color="#6366F1" />;
    case 'admin_announcement':
    case 'campaign':
      return <Megaphone size={s} color="#D71920" />;
    case 'system_update':
    case 'maintenance':
      return <Zap size={s} color="#64748B" />;
    default:
      return <Bell size={s} color="#9CA3AF" />;
  }
}

function typeAccent(type: NotificationType): string {
  switch (type) {
    case 'protein_added':
    case 'protein_goal_complete':
    case 'golden_egg_scanned':
    case 'protein_reminder':
    case 'daily_goal_reminder':
      return '#D71920';
    case 'protein_streak_increased':
    case 'streak_reminder':
    case 'streak_milestone':
      return '#F97316';
    case 'achievement_unlocked':
    case 'level_up':
    case 'protein_milestone':
      return '#EAB308';
    case 'run_completed':
    case 'new_high_score':
    case 'mission_complete':
      return '#8B5CF6';
    case 'champion_rank_improved':
      return '#F59E0B';
    case 'qr_validated':
      return '#10B981';
    case 'admin_announcement':
    case 'campaign':
      return '#D71920';
    case 'system_update':
      return '#64748B';
    default:
      return '#9CA3AF';
  }
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export default function NotificationItem({ notification: n }: Props) {
  const { markRead, remove } = useNotifications();
  const accent = typeAccent(n.type);

  const handleClick = async () => {
    if (!n.read) await markRead(n.id);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 16px',
        background: n.read ? '#fff' : '#FFF8F8',
        borderBottom: '1px solid #F5F5F5',
        cursor: 'pointer',
        transition: 'background 150ms ease',
        position: 'relative',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.background = '#FFF0F0')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.background = n.read ? '#fff' : '#FFF8F8')}
    >
      {/* Unread indicator strip */}
      {!n.read && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: accent, borderRadius: '0 2px 2px 0',
        }} />
      )}

      {/* Icon bubble */}
      <div style={{
        flexShrink: 0,
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}15`,
        border: `1px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {typeIcon(n.type)}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{
            margin: 0, fontSize: 13, fontWeight: n.read ? 600 : 800,
            color: '#1A1A1A', lineHeight: 1.3,
          }}>
            {n.title}
          </p>
          <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0, marginTop: 1 }}>
            {timeAgo(n.createdAt)}
          </span>
        </div>
        <p style={{
          margin: '3px 0 0', fontSize: 12,
          color: n.read ? '#888' : '#555',
          lineHeight: 1.45,
        }}>
          {n.message}
        </p>

        {/* Quick actions */}
        {n.actions && n.actions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {n.actions.map((action, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); }}
                style={{
                  padding: '4px 10px', borderRadius: 8,
                  border: `1px solid ${accent}40`,
                  background: `${accent}10`,
                  color: accent, fontSize: 10, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete button */}
      <button
        onClick={async (e) => { e.stopPropagation(); await remove(n.id); }}
        style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: 6,
          border: 'none', background: 'transparent',
          color: '#ccc', cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'color 150ms',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.color = '#D71920')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.color = '#ccc')}
        title="Remove"
      >
        <X size={13} />
      </button>
    </div>
  );
}
