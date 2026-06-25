import React, { useState } from 'react';
import { ShieldCheck, PauseCircle, PlayCircle, Ban, Plus } from 'lucide-react';
import { controlGoldenQR, createUnlimitedGoldenQR } from '../../services/qr/qrManagementService';

const RED = '#D71920';

interface ActionBtnProps {
  label:   string;
  icon:    React.ReactNode;
  onClick: () => void;
  color:   string;
  loading: boolean;
}

function ActionBtn({ label, icon, onClick, color, loading }: ActionBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        background: `${color}22`, border: `1.5px solid ${color}55`,
        color: loading ? `${color}66` : color,
        borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'all 150ms', whiteSpace: 'nowrap',
      }}
    >
      {loading
        ? <span style={{ width: 14, height: 14, border: `2px solid ${color}44`, borderTopColor: color, borderRadius: '50%', animation: 'gqspin 0.7s linear infinite', display: 'inline-block' }} />
        : icon}
      {loading ? '…' : label}
    </button>
  );
}

interface Props {
  onRefresh: () => void;
}

export default function GoldenQRControl({ onRefresh }: Props) {
  const [action,      setAction]      = useState<string | null>(null);
  const [newCode,     setNewCode]     = useState('');
  const [msg,         setMsg]         = useState<string | null>(null);
  const [msgColor,    setMsgColor]    = useState('#4ade80');
  const [showCreate,  setShowCreate]  = useState(false);

  const run = async (type: 'pause' | 'resume' | 'disable') => {
    setAction(type);
    try {
      await controlGoldenQR(type);
      setMsg(`All Golden QR codes ${type}d successfully.`);
      setMsgColor('#4ade80');
      onRefresh();
    } catch (e: any) {
      setMsg(e?.message ?? 'Action failed.');
      setMsgColor('#f87171');
    } finally {
      setAction(null);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleCreate = async () => {
    if (!newCode.trim()) { setMsg('Enter a code name.'); setMsgColor('#f87171'); return; }
    setAction('create');
    try {
      await createUnlimitedGoldenQR(newCode.trim());
      setMsg(`Unlimited Golden QR "${newCode.trim().toUpperCase()}" created.`);
      setMsgColor('#4ade80');
      setNewCode('');
      setShowCreate(false);
      onRefresh();
    } catch (e: any) {
      setMsg(e?.message ?? 'Creation failed.');
      setMsgColor('#f87171');
    } finally {
      setAction(null);
      setTimeout(() => setMsg(null), 4000);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        Golden QR
      </h2>

      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 18, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <ShieldCheck size={22} color="#f59e0b" strokeWidth={2} />
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Golden QR Management</div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
              Create unlimited-access codes or bulk-control existing Golden QRs
            </div>
          </div>
        </div>

        {msg && (
          <p style={{ fontSize: 12, fontWeight: 600, color: msgColor, margin: '0 0 14px' }}>{msg}</p>
        )}

        {/* Create Unlimited */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: 'rgba(245,158,11,0.15)', border: '1.5px solid rgba(245,158,11,0.4)',
              color: '#f59e0b', borderRadius: 12, padding: '12px 20px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Plus size={15} strokeWidth={2.5} /> Create Unlimited QR
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              style={{
                flex: 1, minWidth: 180, padding: '11px 14px', borderRadius: 10, fontSize: 12,
                background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(245,158,11,0.4)',
                color: '#fff', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
              placeholder="e.g. GOLDEN-VIP-001"
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={!!action}
              style={{
                background: 'linear-gradient(135deg,#f59e0b,#b45309)',
                color: '#000', border: 'none', borderRadius: 10,
                padding: '11px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}
            >
              {action === 'create' ? '…' : 'Create'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: 10, padding: '11px 14px', fontSize: 12, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Bulk actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <ActionBtn label="Pause All"   icon={<PauseCircle size={16} strokeWidth={2} />} onClick={() => run('pause')}   color="#f59e0b" loading={action === 'pause'}   />
          <ActionBtn label="Resume All"  icon={<PlayCircle  size={16} strokeWidth={2} />} onClick={() => run('resume')}  color="#22c55e" loading={action === 'resume'}  />
          <ActionBtn label="Disable All" icon={<Ban         size={16} strokeWidth={2} />} onClick={() => run('disable')} color="#ef4444" loading={action === 'disable'} />
        </div>
      </div>
    </section>
  );
}

