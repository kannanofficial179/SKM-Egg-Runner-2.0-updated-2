/**
 * NotificationSettings — toggle panel for all notification categories.
 * Embeddable in ProfileScreen or any settings view.
 */

import React, { useState } from 'react';
import {
  Bell, Egg, Flame, Trophy, Crown, Megaphone, Zap, Calendar, Target
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import type { NotificationSettings as NS } from '../../types/notifications';

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ icon, label, description, value, onChange }: ToggleRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0', borderBottom: '1px solid #F5F5F5',
    }}>
      <div style={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 10,
        background: value ? '#FCE8E8' : '#F5F5F5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 200ms',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A1A1A' }}>{label}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#999' }}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        style={{
          flexShrink: 0,
          width: 44, height: 24, borderRadius: 12, border: 'none',
          background: value ? '#D71920' : '#D8D8D8',
          cursor: 'pointer', position: 'relative',
          transition: 'background 200ms',
          padding: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: value ? 22 : 2,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          transition: 'left 200ms cubic-bezier(0.34,1.2,0.64,1)',
        }} />
      </button>
    </div>
  );
}

export default function NotificationSettings() {
  const { settings, updateSettings } = useNotifications();
  const [saving, setSaving] = useState(false);

  const update = async (key: keyof NS, val: boolean) => {
    const next = { ...settings, [key]: val };
    setSaving(true);
    await updateSettings(next);
    setSaving(false);
  };

  const rows: Array<{
    icon: React.ReactNode;
    label: string;
    description: string;
    key: keyof NS;
  }> = [
    {
      icon: <Egg size={17} color={settings.proteinReminders ? '#D71920' : '#bbb'} />,
      label: 'Protein Reminders',
      description: 'Daily scan reminders and protein goal alerts',
      key: 'proteinReminders',
    },
    {
      icon: <Flame size={17} color={settings.streakReminders ? '#F97316' : '#bbb'} />,
      label: 'Streak Reminders',
      description: 'Alerts before your streak resets',
      key: 'streakReminders',
    },
    {
      icon: <Target size={17} color={settings.gameReminders ? '#8B5CF6' : '#bbb'} />,
      label: 'Game Reminders',
      description: 'Daily play reminders for SKM Egg Runner',
      key: 'gameReminders',
    },
    {
      icon: <Trophy size={17} color={settings.achievements ? '#EAB308' : '#bbb'} />,
      label: 'Achievements',
      description: 'Level-ups, badges, and milestones',
      key: 'achievements',
    },
    {
      icon: <Crown size={17} color={settings.championHall ? '#F59E0B' : '#bbb'} />,
      label: 'Champion Hall',
      description: 'Rank changes and leaderboard updates',
      key: 'championHall',
    },
    {
      icon: <Megaphone size={17} color={settings.adminMessages ? '#D71920' : '#bbb'} />,
      label: 'Admin Announcements',
      description: 'Campaigns, events, and system updates',
      key: 'adminMessages',
    },
    {
      icon: <Calendar size={17} color={settings.dailySummary ? '#3B82F6' : '#bbb'} />,
      label: 'Daily Summary',
      description: 'Evening recap of your protein and game stats',
      key: 'dailySummary',
    },
  ];

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      padding: '16px 16px 4px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Bell size={16} color="#D71920" />
        <span style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A' }}>Notification Settings</span>
        {saving && (
          <span style={{ fontSize: 10, color: '#10B981', marginLeft: 'auto', fontWeight: 700 }}>Saving…</span>
        )}
      </div>

      {rows.map(row => (
        <ToggleRow
          key={row.key}
          icon={row.icon}
          label={row.label}
          description={row.description}
          value={settings[row.key] as boolean}
          onChange={val => update(row.key, val)}
        />
      ))}

      <p style={{
        margin: '12px 0 8px', fontSize: 10, color: '#bbb', textAlign: 'center',
        lineHeight: 1.5,
      }}>
        Max 2 protein reminders · 1 game reminder per day
      </p>
    </div>
  );
}
