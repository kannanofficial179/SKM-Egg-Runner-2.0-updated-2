/**
 * AdminNotificationManager — send and schedule notifications from the admin panel.
 * Targets: Everyone, Specific User, Only Players, Only Protein Tracker Users.
 */

import React, { useState } from 'react';
import { Megaphone, Send, Eye, Clock, Users, User, Egg, Swords, CheckCircle, AlertCircle } from 'lucide-react';
import { db } from '../../services/firebase/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { createNotification } from '../../services/notifications/notificationService';
import type { NotificationType, NotificationPriority } from '../../types/notifications';

type TargetGroup = 'everyone' | 'specific_user' | 'players' | 'protein_users';

interface FormState {
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  target: TargetGroup;
  specificUserId: string;
  scheduleAt: string;
}

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'admin_announcement', label: 'Announcement' },
  { value: 'campaign',           label: 'Campaign / Event' },
  { value: 'system_update',      label: 'System Update' },
  { value: 'maintenance',        label: 'Maintenance' },
  { value: 'golden_egg_scanned', label: 'Golden QR Event' },
];

const PRIORITY_OPTIONS: { value: NotificationPriority; label: string }[] = [
  { value: 'low',    label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function AdminNotificationManager() {
  const [form, setForm] = useState<FormState>({
    title: '',
    message: '',
    type: 'admin_announcement',
    priority: 'normal',
    target: 'everyone',
    specificUserId: '',
    scheduleAt: '',
  });
  const [preview, setPreview]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [result,  setResult]    = useState<{ ok: boolean; sent: number } | null>(null);

  const set = (key: keyof FormState, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setResult(null);
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      let userIds: string[] = [];

      if (form.target === 'specific_user') {
        if (!form.specificUserId.trim()) { setSending(false); return; }
        userIds = [form.specificUserId.trim()];
      } else {
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers  = usersSnap.docs.map(d => d.id);

        if (form.target === 'everyone') {
          userIds = allUsers;
        } else if (form.target === 'players') {
          // Users who have at least one run recorded
          const runsSnap = await getDocs(collection(db, 'game_stats'));
          const playerSet = new Set(runsSnap.docs.map(d => d.id));
          userIds = allUsers.filter(uid => playerSet.has(uid));
        } else if (form.target === 'protein_users') {
          // Users who have at least one protein log
          const logSnap = await getDocs(collection(db, 'protein_logs'));
          const proteinSet = new Set(logSnap.docs.map(d => d.id));
          userIds = allUsers.filter(uid => proteinSet.has(uid));
        }
      }

      // Send to all target users (batched in parallel, max 10 concurrent)
      const BATCH = 10;
      for (let i = 0; i < userIds.length; i += BATCH) {
        await Promise.all(
          userIds.slice(i, i + BATCH).map(uid =>
            createNotification({
              userId: uid,
              title: form.title,
              message: form.message,
              type: form.type,
              priority: form.priority,
              targetAll: form.target === 'everyone',
            })
          )
        );
      }

      setResult({ ok: true, sent: userIds.length });
      setForm(prev => ({ ...prev, title: '', message: '' }));
    } catch (err) {
      console.error('[AdminNotif]', err);
      setResult({ ok: false, sent: 0 });
    } finally {
      setSending(false);
    }
  };

  const valid = form.title.trim().length > 0 && form.message.trim().length > 0
    && (form.target !== 'specific_user' || form.specificUserId.trim().length > 0);

  return (
    <div style={{
      background: '#fff', borderRadius: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px',
        background: 'linear-gradient(135deg,#D71920 0%,#B31217 100%)',
      }}>
        <Megaphone size={18} color="#fff" />
        <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>Notification Manager</span>
      </div>

      <div style={{ padding: 16 }}>
        {/* Target selector */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Target Audience</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            {[
              { value: 'everyone',      icon: <Users size={13} />,  label: 'Everyone' },
              { value: 'specific_user', icon: <User size={13} />,   label: 'Specific User' },
              { value: 'players',       icon: <Swords size={13} />, label: 'Players Only' },
              { value: 'protein_users', icon: <Egg size={13} />,    label: 'Protein Users' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => set('target', opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 12px', borderRadius: 10,
                  border: `1.5px solid ${form.target === opt.value ? '#D71920' : '#E8E8E8'}`,
                  background: form.target === opt.value ? '#FCE8E8' : '#FAFAFA',
                  color: form.target === opt.value ? '#D71920' : '#555',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Specific user input */}
        {form.target === 'specific_user' && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>User ID</label>
            <input
              value={form.specificUserId}
              onChange={e => set('specificUserId', e.target.value)}
              placeholder="Firebase UID (e.g. abc123...)"
              style={inputStyle}
            />
          </div>
        )}

        {/* Type & Priority row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)} style={selectStyle}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)} style={selectStyle}>
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Title</label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Notification title..."
            maxLength={80}
            style={inputStyle}
          />
        </div>

        {/* Message */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Message</label>
          <textarea
            value={form.message}
            onChange={e => set('message', e.target.value)}
            placeholder="Write your message here..."
            rows={3}
            maxLength={300}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
          />
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#bbb', textAlign: 'right' }}>
            {form.message.length}/300
          </p>
        </div>

        {/* Preview */}
        {preview && form.title && (
          <div style={{
            marginBottom: 14, padding: 12, borderRadius: 12,
            border: '1.5px dashed #D71920', background: '#FFF8F8',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, color: '#D71920', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>Preview</p>
            <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 800, color: '#1A1A1A' }}>{form.title}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#555' }}>{form.message}</p>
          </div>
        )}

        {/* Result banner */}
        {result && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 10,
            background: result.ok ? '#F0FDF4' : '#FFF1F2',
            border: `1px solid ${result.ok ? '#86EFAC' : '#FECDD3'}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {result.ok
              ? <CheckCircle size={16} color="#22C55E" />
              : <AlertCircle size={16} color="#EF4444" />}
            <span style={{ fontSize: 12, fontWeight: 700, color: result.ok ? '#166534' : '#991B1B' }}>
              {result.ok
                ? `Sent to ${result.sent} user${result.sent !== 1 ? 's' : ''} successfully!`
                : 'Failed to send. Please try again.'}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPreview(p => !p)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 11,
              border: '1.5px solid #E8E8E8', background: '#FAFAFA',
              color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Eye size={14} />
            {preview ? 'Hide Preview' : 'Preview'}
          </button>
          <button
            onClick={handleSend}
            disabled={!valid || sending}
            style={{
              flex: 2, padding: '10px 0', borderRadius: 11,
              border: 'none',
              background: valid && !sending ? 'linear-gradient(135deg,#D71920,#B31217)' : '#E8E8E8',
              color: valid && !sending ? '#fff' : '#bbb',
              fontSize: 13, fontWeight: 800, cursor: valid && !sending ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 200ms',
            }}
          >
            {sending ? (
              <span style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite', display: 'inline-block',
              }} />
            ) : <Send size={14} />}
            {sending ? 'Sending…' : 'Send Now'}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Shared mini styles ────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 800,
  textTransform: 'uppercase', letterSpacing: 1.2,
  color: '#999', marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #E8E8E8', background: '#FAFAFA',
  fontSize: 13, color: '#1A1A1A', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance: 'none', cursor: 'pointer',
};
