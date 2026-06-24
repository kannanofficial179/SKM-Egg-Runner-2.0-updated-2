import React, { useState } from 'react';
import {
  bulkSetActiveByType,
  bulkDeleteByType,
  exportBackupJSON,
  writeOpLog,
} from '../../services/qr/qrManagementService';
import type { QRCodeType } from '../../types/qr/qrManagementTypes';

const RED    = '#D71920';
const DANGER = '#ef4444';
const SAFE   = '#22c55e';
const WARN   = '#f59e0b';

// ── Confirmation Dialog ───────────────────────────────────────────────────────

interface ConfirmProps {
  title:       string;
  description: string;
  requireType: string | null; // if set, user must type this word
  onConfirm:   () => void;
  onCancel:    () => void;
  danger?:     boolean;
}

function ConfirmDialog({ title, description, requireType, onConfirm, onCancel, danger }: ConfirmProps) {
  const [typed, setTyped] = useState('');
  const ready = requireType ? typed.trim() === requireType : true;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#111', border: `1.5px solid ${danger ? DANGER : WARN}44`,
        borderRadius: 20, padding: 28, maxWidth: 380, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
      }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, marginBottom: 14,
            background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
            border: `1px solid ${danger ? DANGER : WARN}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>
            {danger ? '🗑️' : '⚠️'}
          </div>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 900, margin: '0 0 6px' }}>{title}</h3>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0, lineHeight: 1.6 }}>{description}</p>
        </div>

        {requireType && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ color: DANGER, fontSize: 11, fontWeight: 700, margin: '0 0 6px' }}>
              Type <strong>{requireType}</strong> to confirm:
            </p>
            <input
              autoFocus
              value={typed}
              onChange={e => setTyped(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                background: 'rgba(255,255,255,0.05)',
                border: `1.5px solid ${typed === requireType ? SAFE : 'rgba(255,255,255,0.1)'}`,
                color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
              }}
              placeholder={`Type "${requireType}" here`}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 800,
              background: ready ? (danger ? DANGER : WARN) : 'rgba(255,255,255,0.1)',
              border: 'none', color: ready ? '#fff' : 'rgba(255,255,255,0.3)',
              cursor: ready ? 'pointer' : 'not-allowed',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Single Action Button ──────────────────────────────────────────────────────

type BtnVariant = 'danger' | 'warn' | 'safe' | 'ghost';

function ActionBtn({
  label, icon, variant, onClick, loading,
}: {
  label: string; icon: string; variant: BtnVariant; onClick: () => void; loading: boolean;
}) {
  const colors: Record<BtnVariant, { bg: string; border: string; color: string }> = {
    danger: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: DANGER },
    warn:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: WARN   },
    safe:   { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  color: SAFE   },
    ghost:  { bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.12)',color: 'rgba(255,255,255,0.6)' },
  };
  const c = colors[variant];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        background: c.bg, border: `1.5px solid ${c.border}`, color: loading ? `${c.color}55` : c.color,
        borderRadius: 11, padding: '10px 16px', fontSize: 12, fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
        transition: 'all 150ms',
      }}
    >
      {loading
        ? <span style={{ width: 12, height: 12, border: `2px solid ${c.color}44`, borderTopColor: c.color, borderRadius: '50%', animation: 'bspin 0.7s linear infinite', display: 'inline-block' }} />
        : <span style={{ fontSize: 14 }}>{icon}</span>
      }
      {label}
    </button>
  );
}

// ── Sub-group (Regular / Golden) ──────────────────────────────────────────────

interface GroupProps {
  typeName: QRCodeType;
  label:    string;
  icon:     string;
  color:    string;
  onRefresh: () => void;
  actor:     string;
}

function TypeGroup({ typeName, label, icon, color, onRefresh, actor }: GroupProps) {
  const [busy,    setBusy]    = useState<string | null>(null);
  const [msg,     setMsg]     = useState<string | null>(null);
  const [isOk,    setIsOk]    = useState(true);
  const [confirm, setConfirm] = useState<null | {
    title: string; description: string; requireType: string | null; danger: boolean; action: () => Promise<void>;
  }>(null);

  const flash = (text: string, ok: boolean) => {
    setMsg(text); setIsOk(ok);
    setTimeout(() => setMsg(null), 4000);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { flash(e?.message ?? 'Operation failed.', false); }
    finally { setBusy(null); }
  };

  const ask = (
    title: string, description: string, requireType: string | null, danger: boolean,
    action: () => Promise<void>,
  ) => setConfirm({ title, description, requireType, danger, action });

  const handleDisable = () =>
    ask(
      `Disable All ${label}`,
      `Set active=false on every ${label} QR code. Users will be blocked from scanning them. You can re-enable them at any time.`,
      null, false,
      async () => {
        const n = await bulkSetActiveByType(typeName, false);
        await writeOpLog(`disable-all`, typeName, n, actor);
        flash(`${n} ${label} QR codes disabled.`, true);
        onRefresh();
      },
    );

  const handleEnable = () =>
    run('enable', async () => {
      const n = await bulkSetActiveByType(typeName, true);
      await writeOpLog('enable-all', typeName, n, actor);
      flash(`${n} ${label} QR codes enabled.`, true);
      onRefresh();
    });

  const handleDelete = () =>
    ask(
      `Delete All ${label} QR`,
      `This permanently deletes every ${label} QR code from Firestore. This cannot be undone. Back up first.`,
      'DELETE', true,
      async () => {
        const n = await bulkDeleteByType(typeName);
        await writeOpLog('delete-all', typeName, n, actor);
        flash(`${n} ${label} QR codes deleted.`, true);
        onRefresh();
      },
    );

  return (
    <>
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
        borderRadius: 14, padding: '16px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ color, fontSize: 13, fontWeight: 800 }}>{label} QR</span>
          <span style={{
            fontSize: 9, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 20, background: `${color}18`, color,
          }}>BULK</span>
        </div>

        {msg && (
          <p style={{ fontSize: 11, fontWeight: 700, color: isOk ? SAFE : DANGER, margin: '0 0 10px' }}>{msg}</p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ActionBtn label="Disable All" icon="⏸"  variant="warn"   onClick={handleDisable} loading={busy === 'disable'} />
          <ActionBtn label="Enable All"  icon="▶"   variant="safe"   onClick={handleEnable}  loading={busy === 'enable'}  />
          <ActionBtn label="Delete All"  icon="🗑️"  variant="danger" onClick={handleDelete}  loading={busy === 'delete'}  />
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          description={confirm.description}
          requireType={confirm.requireType}
          danger={confirm.danger}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            setBusy('action');
            try { await confirm.action(); } finally { setBusy(null); }
          }}
        />
      )}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  onRefresh: () => void;
  actor:     string;
}

export default function QRBulkControl({ onRefresh, actor }: Props) {
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [backing,   setBacking]   = useState(false);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const date = await exportBackupJSON();
      setBackupMsg(`Backup downloaded: backup-${date}.json`);
      setTimeout(() => setBackupMsg(null), 5000);
    } catch (e: any) {
      setBackupMsg(e?.message ?? 'Backup failed.');
    } finally {
      setBacking(false);
    }
  };

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
          Bulk Control Center
        </h2>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase',
          padding: '3px 10px', borderRadius: 20,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: DANGER,
        }}>
          Admin Only
        </span>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 18, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Warning banner */}
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
            Bulk operations affect all matching QR codes immediately. Always export a backup before deleting.
          </p>
        </div>

        {/* Backup button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <ActionBtn label="Export Backup JSON" icon="💾" variant="ghost" onClick={handleBackup} loading={backing} />
          {backupMsg && <span style={{ fontSize: 11, color: SAFE, fontWeight: 700 }}>{backupMsg}</span>}
        </div>

        {/* Regular QR group */}
        <TypeGroup
          typeName="Regular" label="Regular" icon="▦"
          color="rgba(255,255,255,0.7)"
          onRefresh={onRefresh} actor={actor}
        />

        {/* Golden QR group */}
        <TypeGroup
          typeName="Golden" label="Golden" icon="⭐"
          color={WARN}
          onRefresh={onRefresh} actor={actor}
        />
      </div>

      <style>{`@keyframes bspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
