import React, { useState } from 'react';
import {
  PauseCircle, PlayCircle, Ban, ShieldCheck, Package, Plus, X, AlertTriangle,
} from 'lucide-react';
import {
  bulkSetActiveByType, controlGoldenQR, createUnlimitedGoldenQR, writeOpLog,
} from '../../services/qr/qrManagementService';

const RED  = '#D71920';
const GOLD = '#D97706';

// ─── Shared components ────────────────────────────────────────────────────────

function SectionCard({ title, description, accent = '#E5E7EB', children }: {
  title: string; description: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${accent}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${accent}`, background: '#FAFAFA' }}>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{description}</p>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function ActionBtn({ label, icon, bg, border, color, loading, onClick, disabled }: {
  label: string; icon: React.ReactNode; bg: string; border: string; color: string;
  loading: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={loading || disabled} style={{
      background: bg, border: `1px solid ${border}`, color: loading ? `${color}88` : color,
      borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 700,
      cursor: loading || disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', gap: 7,
      transition: 'all 150ms', whiteSpace: 'nowrap', opacity: disabled ? 0.5 : 1,
    }}>
      {loading
        ? <span style={{ width: 13, height: 13, border: `2px solid ${color}33`, borderTopColor: color, borderRadius: '50%', animation: 'qraspin 0.7s linear infinite', display: 'inline-block' }} />
        : icon}
      {loading ? '…' : label}
    </button>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <AlertTriangle size={24} color={GOLD} style={{ marginBottom: 12 }} />
        <h3 style={{ color: '#1A1A1A', fontSize: 16, fontWeight: 900, margin: '0 0 8px' }}>{title}</h3>
        <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 22px', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 800, background: `linear-gradient(135deg,${GOLD},#B45309)`, border: 'none', color: '#fff', cursor: 'pointer' }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Regular QR Actions ───────────────────────────────────────────────────────

function RegularActions({ onRefresh, actor }: { onRefresh: () => void; actor: string }) {
  const [busy,    setBusy]    = useState<string | null>(null);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const [pending, setPending] = useState<'disable' | null>(null);

  const flash = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { flash(e?.message ?? 'Failed.', false); }
    finally { setBusy(null); }
  };

  return (
    <SectionCard title="Regular QR" description="Bulk enable or disable all Regular QR codes" accent="#E5E7EB">
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: msg.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.ok ? '#BBF7D0' : '#FECACA'}` }}>
          <p style={{ color: msg.ok ? '#15803D' : '#DC2626', fontSize: 12, fontWeight: 600, margin: 0 }}>{msg.text}</p>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <ActionBtn label="Disable All Regular"  icon={<PauseCircle size={15} strokeWidth={2} />} bg="#FFFBEB" border="#FDE68A" color={GOLD}    loading={busy === 'disable'} onClick={() => setPending('disable')} />
        <ActionBtn label="Enable All Regular"   icon={<PlayCircle  size={15} strokeWidth={2} />} bg="#F0FDF4" border="#BBF7D0" color="#15803D" loading={busy === 'enable'}  onClick={() => run('enable', async () => { const n = await bulkSetActiveByType('Regular', true); await writeOpLog('enable-all', 'Regular', n, actor); flash(`${n} Regular QR codes enabled.`, true); onRefresh(); })} />
      </div>
      {pending === 'disable' && (
        <ConfirmModal
          title="Disable All Regular QR"
          message="This sets active=false on every Regular QR code. Users will be blocked from scanning them. You can re-enable at any time."
          onCancel={() => setPending(null)}
          onConfirm={() => { setPending(null); run('disable', async () => { const n = await bulkSetActiveByType('Regular', false); await writeOpLog('disable-all', 'Regular', n, actor); flash(`${n} Regular QR codes disabled.`, true); onRefresh(); }); }}
        />
      )}
    </SectionCard>
  );
}

// ─── Golden QR Actions ────────────────────────────────────────────────────────

function GoldenActions({ onRefresh, actor }: { onRefresh: () => void; actor: string }) {
  const [action,     setAction]     = useState<string | null>(null);
  const [newCode,    setNewCode]    = useState('');
  const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const flash = (text: string, ok: boolean) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); };

  const run = async (type: 'pause' | 'resume' | 'disable') => {
    setAction(type);
    try { await controlGoldenQR(type); flash(`All Golden QR codes ${type}d.`, true); onRefresh(); }
    catch (e: any) { flash(e?.message ?? 'Failed.', false); }
    finally { setAction(null); }
  };

  const handleCreate = async () => {
    if (!newCode.trim()) { flash('Enter a code name.', false); return; }
    setAction('create');
    try {
      await createUnlimitedGoldenQR(newCode.trim());
      flash(`Golden QR "${newCode.trim().toUpperCase()}" created.`, true);
      setNewCode(''); setShowCreate(false); onRefresh();
    } catch (e: any) { flash(e?.message ?? 'Failed.', false); }
    finally { setAction(null); }
  };

  return (
    <SectionCard title="Golden QR" description="Create unlimited-access codes or bulk-control existing Golden QRs" accent="#FDE68A">
      {msg && (
        <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: msg.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.ok ? '#BBF7D0' : '#FECACA'}` }}>
          <p style={{ color: msg.ok ? '#15803D' : '#DC2626', fontSize: 12, fontWeight: 600, margin: 0 }}>{msg.text}</p>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={18} color={GOLD} strokeWidth={2} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Unlimited Access Codes</p>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Golden QR codes bypass play-count limits</p>
        </div>
      </div>

      {/* Create form */}
      {!showCreate ? (
        <button onClick={() => setShowCreate(true)} style={{ background: '#FEF3C7', border: '1px solid #FDE68A', color: GOLD, borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Plus size={14} strokeWidth={2.5} /> Create Unlimited QR
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', padding: 12, background: '#FFFBEB', borderRadius: 12, border: '1px solid #FDE68A' }}>
          <input
            style={{ flex: 1, minWidth: 180, padding: '10px 13px', borderRadius: 10, fontSize: 12, background: '#fff', border: '1.5px solid #FDE68A', color: '#1A1A1A', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
            placeholder="e.g. GOLDEN-VIP-001"
            value={newCode}
            onChange={e => setNewCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <button onClick={handleCreate} disabled={!!action} style={{ background: `linear-gradient(135deg,${GOLD},#B45309)`, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            {action === 'create' ? '…' : 'Create'}
          </button>
          <button onClick={() => setShowCreate(false)} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 10, padding: '10px 13px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <X size={13} strokeWidth={2} /> Cancel
          </button>
        </div>
      )}

      {/* Bulk actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <ActionBtn label="Pause All"   icon={<PauseCircle size={15} strokeWidth={2} />} bg="#FFFBEB" border="#FDE68A" color={GOLD}    loading={action === 'pause'}   onClick={() => run('pause')}   />
        <ActionBtn label="Resume All"  icon={<PlayCircle  size={15} strokeWidth={2} />} bg="#F0FDF4" border="#BBF7D0" color="#15803D" loading={action === 'resume'}  onClick={() => run('resume')}  />
        <ActionBtn label="Disable All" icon={<Ban         size={15} strokeWidth={2} />} bg="#FEF2F2" border="#FECACA" color="#DC2626" loading={action === 'disable'} onClick={() => run('disable')} />
      </div>
    </SectionCard>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface Props { onRefresh: () => void; actor: string; }

export default function QRActions({ onRefresh, actor }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Warning */}
      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <AlertTriangle size={15} color={GOLD} style={{ flexShrink: 0 }} />
        <p style={{ color: '#92400E', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Bulk actions affect all matching QR codes immediately and cannot be undone. Export a backup from the Bulk Actions tab before making large changes.
        </p>
      </div>

      <RegularActions onRefresh={onRefresh} actor={actor} />
      <GoldenActions  onRefresh={onRefresh} actor={actor} />

      <style>{`@keyframes qraspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
