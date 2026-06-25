import React, { useState } from 'react';
import { ShieldCheck, PauseCircle, PlayCircle, Ban, Plus, X } from 'lucide-react';
import { controlGoldenQR, createUnlimitedGoldenQR } from '../../services/qr/qrManagementService';

const RED  = '#D71920';
const GOLD = '#D97706';

interface ActionBtnProps {
  label:   string;
  icon:    React.ReactNode;
  onClick: () => void;
  bg:      string;
  border:  string;
  color:   string;
  loading: boolean;
}

function ActionBtn({ label, icon, onClick, bg, border, color, loading }: ActionBtnProps) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: bg, border: `1px solid ${border}`,
      color: loading ? `${color}88` : color,
      borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 700,
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', gap: 7,
      transition: 'all 150ms', whiteSpace: 'nowrap',
    }}>
      {loading
        ? <span style={{ width: 13, height: 13, border: `2px solid ${color}33`, borderTopColor: color, borderRadius: '50%', animation: 'gqspin 0.7s linear infinite', display: 'inline-block' }} />
        : icon}
      {loading ? '…' : label}
    </button>
  );
}

interface Props { onRefresh: () => void; }

export default function GoldenQRControl({ onRefresh }: Props) {
  const [action,     setAction]     = useState<string | null>(null);
  const [newCode,    setNewCode]    = useState('');
  const [msg,        setMsg]        = useState<string | null>(null);
  const [msgOk,      setMsgOk]      = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const flash = (text: string, ok = true) => {
    setMsg(text); setMsgOk(ok); setTimeout(() => setMsg(null), 4000);
  };

  const run = async (type: 'pause' | 'resume' | 'disable') => {
    setAction(type);
    try { await controlGoldenQR(type); flash(`All Golden QR codes ${type}d successfully.`); onRefresh(); }
    catch (e: any) { flash(e?.message ?? 'Action failed.', false); }
    finally { setAction(null); }
  };

  const handleCreate = async () => {
    if (!newCode.trim()) { flash('Enter a code name.', false); return; }
    setAction('create');
    try {
      await createUnlimitedGoldenQR(newCode.trim());
      flash(`Golden QR "${newCode.trim().toUpperCase()}" created.`);
      setNewCode(''); setShowCreate(false); onRefresh();
    } catch (e: any) { flash(e?.message ?? 'Creation failed.', false); }
    finally { setAction(null); }
  };

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Golden QR</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Manage unlimited-access codes</p>
      </div>

      <div style={{ background: '#FFFFFF', border: `1px solid #FDE68A`, borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEF3C7', border: '1px solid #FDE68A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} color={GOLD} strokeWidth={2} />
          </div>
          <div>
            <div style={{ color: '#1A1A1A', fontWeight: 800, fontSize: 14 }}>Golden QR Management</div>
            <div style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>Create unlimited-access codes or bulk-control existing Golden QRs</div>
          </div>
        </div>

        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: msgOk ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msgOk ? '#BBF7D0' : '#FECACA'}` }}>
            <p style={{ color: msgOk ? '#15803D' : '#DC2626', fontSize: 12, fontWeight: 600, margin: 0 }}>{msg}</p>
          </div>
        )}

        {/* Create Unlimited */}
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} style={{
            background: '#FEF3C7', border: '1px solid #FDE68A', color: GOLD,
            borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Plus size={15} strokeWidth={2.5} /> Create Unlimited QR
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', padding: '12px', background: '#FFFBEB', borderRadius: 12, border: '1px solid #FDE68A' }}>
            <input
              style={{ flex: 1, minWidth: 180, padding: '10px 13px', borderRadius: 10, fontSize: 12, background: '#fff', border: '1.5px solid #FDE68A', color: '#1A1A1A', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
              placeholder="e.g. GOLDEN-VIP-001"
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            <button onClick={handleCreate} disabled={!!action} style={{
              background: `linear-gradient(135deg,${GOLD},#B45309)`,
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 18px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}>
              {action === 'create' ? '…' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', borderRadius: 10, padding: '10px 13px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <X size={13} strokeWidth={2} /> Cancel
            </button>
          </div>
        )}

        {/* Bulk actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ActionBtn label="Pause All"   icon={<PauseCircle size={15} strokeWidth={2} />} onClick={() => run('pause')}   bg="#FFFBEB" border="#FDE68A" color={GOLD}    loading={action === 'pause'}   />
          <ActionBtn label="Resume All"  icon={<PlayCircle  size={15} strokeWidth={2} />} onClick={() => run('resume')}  bg="#F0FDF4" border="#BBF7D0" color="#15803D" loading={action === 'resume'}  />
          <ActionBtn label="Disable All" icon={<Ban         size={15} strokeWidth={2} />} onClick={() => run('disable')} bg="#FEF2F2" border="#FECACA" color="#DC2626" loading={action === 'disable'} />
        </div>
      </div>
      <style>{`@keyframes gqspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
