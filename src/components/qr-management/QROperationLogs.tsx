import React, { useEffect, useState } from 'react';
import { fetchOpLogs } from '../../services/qr/qrManagementService';
import type { OpLog } from '../../services/qr/qrManagementService';

const RED = '#D71920';

const OP_COLORS: Record<string, string> = {
  'disable-all': '#f59e0b',
  'enable-all':  '#22c55e',
  'delete-all':  '#ef4444',
  'print':       '#60a5fa',
  'export':      '#a78bfa',
  'backup':      '#34d399',
};

const OP_ICONS: Record<string, string> = {
  'disable-all': '⏸',
  'enable-all':  '▶',
  'delete-all':  '🗑️',
  'print':       '🖨',
  'export':      '📤',
  'backup':      '💾',
};

function timeAgo(ts: Date): string {
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
  return ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

interface Props {
  refreshKey: number;
}

export default function QROperationLogs({ refreshKey }: Props) {
  const [logs,    setLogs]    = useState<OpLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOpLogs(30)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        Operation Logs
      </h2>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)',
        borderRadius: 18, padding: 20,
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{ width: 24, height: 24, border: '2.5px solid rgba(215,25,32,0.2)', borderTopColor: RED, borderRadius: '50%', animation: 'olspin 0.8s linear infinite' }} />
          </div>
        ) : logs.length === 0 ? (
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '20px 0', margin: 0 }}>
            No operations logged yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {logs.map((log, i) => {
              const color = OP_COLORS[log.operation] ?? 'rgba(255,255,255,0.5)';
              const icon  = OP_ICONS[log.operation]  ?? '●';
              return (
                <div
                  key={log.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 4px',
                    borderBottom: i < logs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: `${color}18`, border: `1px solid ${color}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                  }}>
                    {icon}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>
                        {log.operation}
                      </span>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
                        background: `${color}18`, color, textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        {log.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                      by {log.actor} · {log.count} codes
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0, textAlign: 'right' }}>
                    {timeAgo(log.ts)}
                  </div>
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
