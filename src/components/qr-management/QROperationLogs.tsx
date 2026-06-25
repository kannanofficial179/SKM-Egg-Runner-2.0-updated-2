import React, { useEffect, useState } from 'react';
import { PauseCircle, PlayCircle, Trash2, Printer, Upload, HardDrive, Activity, Trash } from 'lucide-react';
import { fetchOpLogs } from '../../services/qr/qrManagementService';
import type { OpLog } from '../../services/qr/qrManagementService';

const RED = '#D71920';

const OP_META: Record<string, { color: string; bg: string; border: string }> = {
  'disable-all':    { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  'enable-all':     { color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  'delete-all':     { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  'delete-selected':{ color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  'print':          { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  'export':         { color: '#6D28D9', bg: '#FAF5FF', border: '#DDD6FE' },
  'backup':         { color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
};

function OpIcon({ op, color }: { op: string; color: string }) {
  const p = { size: 15, strokeWidth: 2, color };
  switch (op) {
    case 'disable-all':     return <PauseCircle {...p} />;
    case 'enable-all':      return <PlayCircle  {...p} />;
    case 'delete-all':      return <Trash2      {...p} />;
    case 'delete-selected': return <Trash       {...p} />;
    case 'print':           return <Printer     {...p} />;
    case 'export':          return <Upload      {...p} />;
    case 'backup':          return <HardDrive   {...p} />;
    default:                return <Activity    {...p} />;
  }
}

function timeAgo(ts: Date): string {
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface Props { refreshKey: number; }

export default function QROperationLogs({ refreshKey }: Props) {
  const [logs,    setLogs]    = useState<OpLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOpLogs(30).then(setLogs).catch(() => setLogs([])).finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Operation Logs</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Recent admin actions</p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0' }}>
            <div style={{ width: 22, height: 22, border: `2.5px solid #F3F4F6`, borderTopColor: RED, borderRadius: '50%', animation: 'olspin 0.8s linear infinite' }} />
          </div>
        ) : logs.length === 0 ? (
          <p style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '20px 0', margin: 0 }}>No operations logged yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {logs.map((log, i) => {
              const meta = OP_META[log.operation] ?? { color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' };
              return (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 4px',
                  borderBottom: i < logs.length - 1 ? '1px solid #F3F4F6' : 'none',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: meta.bg, border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <OpIcon op={log.operation} color={meta.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#1A1A1A', fontFamily: 'monospace' }}>{log.operation}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: meta.bg, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5, border: `1px solid ${meta.border}` }}>
                        {log.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>by {log.actor} · {log.count} codes</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0, textAlign: 'right' }}>{timeAgo(log.ts)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes olspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
