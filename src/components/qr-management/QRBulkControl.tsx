import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2, CheckCircle2, AlertTriangle, PauseCircle, PlayCircle,
  HardDrive, ShieldCheck, Package, Trash, X,
} from 'lucide-react';
import {
  bulkSetActiveByType,
  bulkDeleteByIds,
  exportBackupJSON,
  fetchAllQRCodes,
  writeOpLog,
} from '../../services/qr/qrManagementService';
import type { QRCodeRecord, QRCodeType } from '../../types/qr/qrManagementTypes';

const RED    = '#D71920';
const DANGER = '#DC2626';
const SAFE   = '#16A34A';
const WARN   = '#D97706';

// ─── helpers ─────────────────────────────────────────────────────────────────

function dateKey(d: Date) { return d.toISOString().slice(0, 10); }
function todayKey()     { return dateKey(new Date()); }
function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); }
function nDaysAgoKey(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); }
function fmt(d: Date)   { return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }

function statusOf(qr: QRCodeRecord): 'Active' | 'Disabled' | 'Exhausted' | 'Unused' {
  if (qr.playCount === 0)          return 'Unused';
  if (!qr.active)                  return 'Disabled';
  if (qr.playCount >= qr.maxPlays) return 'Exhausted';
  return 'Active';
}

function statusStyle(s: string): React.CSSProperties {
  if (s === 'Active')    return { background: '#F0FDF4', color: SAFE,   border: '1px solid #BBF7D0' };
  if (s === 'Disabled')  return { background: '#FEF2F2', color: DANGER, border: '1px solid #FECACA' };
  if (s === 'Exhausted') return { background: '#FFFBEB', color: WARN,   border: '1px solid #FDE68A' };
  return                        { background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' };
}

function typeStyle(t: string): React.CSSProperties {
  const l = t.toLowerCase();
  if (l === 'golden')    return { background: '#FFFBEB', color: WARN,    border: '1px solid #FDE68A' };
  if (l === 'developer') return { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' };
  if (l === 'campaign')  return { background: '#F0FDF4', color: SAFE,    border: '1px solid #BBF7D0' };
  return                        { background: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
}

// ─── Delete Confirmation Modal (with mandatory reason) ────────────────────────

const REASON_EXAMPLES = [
  'Duplicate batch created by mistake',
  'Deleted after successful printing',
  'Expired campaign — codes no longer needed',
  'Testing data cleanup',
  'Customer requested removal',
];

interface DeleteConfirmProps {
  count:      number;
  batchNames: string[];
  onConfirm:  (reason: string) => void;
  onCancel:   () => void;
}

function DeleteConfirmModal({ count, batchNames, onConfirm, onCancel }: DeleteConfirmProps) {
  const [reason,      setReason]      = useState('');
  const [reasonError, setReasonError] = useState(false);

  const ready = reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!ready) { setReasonError(true); return; }
    onConfirm(reason.trim());
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10100,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 22,
        boxShadow: '0 32px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(220,38,38,0.12)',
        width: '100%', maxWidth: 440,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: '#FFF5F5', borderBottom: '1px solid #FECACA', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Trash2 size={20} strokeWidth={2} color={DANGER} />
          </div>
          <div>
            <h3 style={{ color: '#1A1A1A', fontSize: 16, fontWeight: 900, margin: '0 0 4px' }}>
              Permanently Delete QR Codes
            </h3>
            <p style={{ color: '#6B7280', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
              This action cannot be undone. Affected records will be removed from Firebase.
            </p>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* What will be deleted */}
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.8 }}>You are about to permanently delete:</p>
            {batchNames.length > 0 && (
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', margin: '0 0 4px' }}>
                {batchNames.slice(0, 3).join(', ')}{batchNames.length > 3 ? ` +${batchNames.length - 3} more` : ''}
              </p>
            )}
            <p style={{ fontSize: 22, fontWeight: 900, color: DANGER, margin: 0, lineHeight: 1 }}>
              {count} <span style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>QR Code{count !== 1 ? 's' : ''}</span>
            </p>
          </div>

          {/* Mandatory reason */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 800, color: '#374151', display: 'block', marginBottom: 6 }}>
              Reason for Deletion <span style={{ color: DANGER }}>*</span>
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={e => { setReason(e.target.value); setReasonError(false); }}
              placeholder={`e.g. "${REASON_EXAMPLES[Math.floor(Date.now() / 1000) % REASON_EXAMPLES.length]}"`}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 13px', borderRadius: 10, fontSize: 13,
                background: '#F9FAFB',
                border: `1.5px solid ${reasonError ? DANGER : reason.trim().length >= 5 ? SAFE : '#E5E7EB'}`,
                color: '#1A1A1A', outline: 'none', resize: 'vertical',
                fontFamily: 'system-ui,-apple-system,sans-serif',
                lineHeight: 1.5, transition: 'border-color 150ms',
              }}
            />
            {reasonError && (
              <p style={{ fontSize: 11, color: DANGER, fontWeight: 600, margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} /> Reason is required before deletion can proceed.
              </p>
            )}
            {!reasonError && reason.trim().length > 0 && reason.trim().length < 5 && (
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>
                Keep typing… ({reason.trim().length}/5 min characters)
              </p>
            )}
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '6px 0 0' }}>
              This reason will be stored permanently in the operation audit log.
            </p>
          </div>

          {/* Quick-fill reason pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {REASON_EXAMPLES.slice(0, 3).map(ex => (
              <button
                key={ex}
                onClick={() => { setReason(ex); setReasonError(false); }}
                style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: '1px solid #E5E7EB', background: '#F3F4F6', color: '#6B7280', cursor: 'pointer' }}
              >
                {ex}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button
              onClick={onCancel}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              style={{
                flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer',
                background: ready ? `linear-gradient(135deg,${DANGER},#B91C1C)` : '#F3F4F6',
                color: ready ? '#fff' : '#9CA3AF',
                boxShadow: ready ? `0 4px 14px ${DANGER}30` : 'none',
                transition: 'all 200ms',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Trash2 size={14} strokeWidth={2.5} />
              Delete Permanently
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ deletedCount, batches, timestamp, onClose }: { deletedCount: number; batches: string[]; timestamp: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10100, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px', background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle2 size={26} strokeWidth={2} color={SAFE} />
        </div>
        <h3 style={{ color: SAFE, fontSize: 18, fontWeight: 900, margin: '0 0 6px' }}>
          {deletedCount} QR Code{deletedCount !== 1 ? 's' : ''} Deleted
        </h3>
        <p style={{ color: '#9CA3AF', fontSize: 12, margin: '0 0 18px' }}>Successfully removed from Firebase</p>
        <div style={{ background: '#F9FAFB', borderRadius: 12, padding: '12px 16px', textAlign: 'left', marginBottom: 20, border: '1px solid #E5E7EB' }}>
          {[
            { label: 'Deleted Count',     value: `${deletedCount} QR codes` },
            { label: 'Batches Affected',  value: batches.length ? batches.slice(0, 3).join(', ') + (batches.length > 3 ? ` +${batches.length - 3} more` : '') : '—' },
            { label: 'Timestamp',         value: timestamp },
          ].map((r, i, arr) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: i < arr.length - 1 ? 8 : 0, marginBottom: i < arr.length - 1 ? 8 : 0, borderBottom: i < arr.length - 1 ? '1px solid #E5E7EB' : 'none' }}>
              <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{r.label}</span>
              <span style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 700 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '13px 0', borderRadius: 13, border: 'none', background: `linear-gradient(135deg,${SAFE},#15803D)`, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 16px ${SAFE}30` }}>Done</button>
      </div>
    </div>
  );
}

// ─── Delete Center Modal ──────────────────────────────────────────────────────

type FilterTab = 'today' | 'yesterday' | 'last7' | 'last30' | 'unused' | 'disabled' | 'all';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'today',     label: 'Today'       },
  { id: 'yesterday', label: 'Yesterday'   },
  { id: 'last7',     label: 'Last 7 Days' },
  { id: 'last30',    label: 'Last 30 Days'},
  { id: 'unused',    label: 'Unused Only' },
  { id: 'disabled',  label: 'Disabled'    },
  { id: 'all',       label: 'All Regular' },
];

interface DeleteCenterProps { onClose: () => void; onRefresh: () => void; actor: string; }

function DeleteCenterModal({ onClose, onRefresh, actor }: DeleteCenterProps) {
  const [codes,    setCodes]    = useState<QRCodeRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<FilterTab>('today');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm,      setConfirm]      = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [success,      setSuccess]      = useState<{ count: number; batches: string[]; ts: string } | null>(null);
  const startTimeRef = React.useRef<number>(0);

  useEffect(() => {
    fetchAllQRCodes().then(all => { setCodes(all); setLoading(false); });
  }, []);

  const stats = useMemo(() => {
    const regular  = codes.filter(c => c.type.toLowerCase() === 'regular').length;
    const unused   = codes.filter(c => c.playCount === 0).length;
    const disabled = codes.filter(c => !c.active).length;
    return { total: codes.length, regular, unused, disabled };
  }, [codes]);

  const filtered = useMemo(() => {
    const regular = codes.filter(c => c.type.toLowerCase() === 'regular');
    const today = todayKey(), yesterday = yesterdayKey(), ago7 = nDaysAgoKey(7), ago30 = nDaysAgoKey(30);
    switch (tab) {
      case 'today':     return regular.filter(c => dateKey(c.createdAt) === today);
      case 'yesterday': return regular.filter(c => dateKey(c.createdAt) === yesterday);
      case 'last7':     return regular.filter(c => dateKey(c.createdAt) >= ago7);
      case 'last30':    return regular.filter(c => dateKey(c.createdAt) >= ago30);
      case 'unused':    return regular.filter(c => c.playCount === 0);
      case 'disabled':  return regular.filter(c => !c.active);
      case 'all':       return regular;
    }
  }, [codes, tab]);

  const batchNames = useMemo(() => [...new Set(filtered.map(c => c.batch).filter(Boolean))], [filtered]);
  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  const toggleAll = () => {
    if (allVisibleSelected) setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.delete(c.id)); return s; });
    else setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.add(c.id)); return s; });
  };
  const toggleOne   = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectBatch = (batch: string) => setSelected(prev => { const s = new Set(prev); filtered.filter(c => c.batch === batch).forEach(c => s.add(c.id)); return s; });

  const handleDelete = async (reason: string) => {
    setDeleting(true); setConfirm(false);
    const t0 = Date.now();
    try {
      const ids = [...selected];
      const affectedCodes = codes.filter(c => ids.includes(c.id));
      const batches = [...new Set(affectedCodes.map(c => c.batch).filter(Boolean))];
      const n = await bulkDeleteByIds(ids);
      const durationMs = Date.now() - t0;
      await writeOpLog('delete-selected', 'Regular', n, actor, {
        reason,
        batchName:  batches.slice(0, 5).join(', '),
        qrIds:      ids.slice(0, 50),
        durationMs,
        status:     'success',
      });
      onRefresh();
      setSuccess({ count: n, batches, ts: new Date().toLocaleTimeString() });
    } catch (e: any) {
      await writeOpLog('delete-selected', 'Regular', 0, actor, { reason, status: 'failed' }).catch(() => {});
      alert(e?.message ?? 'Delete failed.');
    }
    finally { setDeleting(false); }
  };

  if (success) return <SuccessScreen deletedCount={success.count} batches={success.batches} timestamp={success.ts} onClose={() => { setSuccess(null); onClose(); }} />;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

        <div style={{ background: '#FFFFFF', border: '1px solid #FECACA', borderRadius: 22, width: '100%', maxWidth: 740, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ background: '#FFF5F5', borderBottom: '1px solid #FECACA', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} strokeWidth={2} color={DANGER} />
                </div>
                <h2 style={{ color: '#1A1A1A', fontSize: 17, fontWeight: 900, margin: 0 }}>Delete QR Codes</h2>
              </div>
              <p style={{ color: '#6B7280', fontSize: 12, margin: 0 }}>Select which QR codes should be removed. Golden &amp; Developer codes are protected.</p>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { label: 'Total',    value: stats.total,    bg: '#F9FAFB', color: '#374151', border: '#E5E7EB' },
                { label: 'Regular',  value: stats.regular,  bg: '#F9FAFB', color: '#374151', border: '#E5E7EB' },
                { label: 'Unused',   value: stats.unused,   bg: '#FFFBEB', color: WARN,      border: '#FDE68A' },
                { label: 'Disabled', value: stats.disabled, bg: '#FEF2F2', color: DANGER,    border: '#FECACA' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setSelected(new Set()); }} style={{
                  padding: '6px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  border: tab === t.id ? 'none' : '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 150ms',
                  background: tab === t.id ? DANGER : '#F9FAFB',
                  color:      tab === t.id ? '#fff'  : '#6B7280',
                  boxShadow:  tab === t.id ? `0 2px 8px ${DANGER}30` : 'none',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Quick-select */}
            {!loading && filtered.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Select:</span>
                <button onClick={toggleAll} style={quickBtnLight(allVisibleSelected ? DANGER : undefined)}>
                  {allVisibleSelected ? 'Deselect All' : `All ${filtered.length} visible`}
                </button>
                {batchNames.slice(0, 4).map(b => (
                  <button key={b} onClick={() => selectBatch(b)} style={quickBtnLight()}>
                    {b.replace('BATCH-', 'Batch ').substring(0, 14)}
                  </button>
                ))}
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set())} style={quickBtnLight(WARN)}>
                    Clear ({selected.size})
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  <div style={{ width: 20, height: 20, border: '2px solid #F3F4F6', borderTopColor: DANGER, borderRadius: '50%', animation: 'bcspin 0.7s linear infinite', margin: '0 auto 8px' }} />
                  Loading QR codes...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No Regular QR codes match this filter.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      {['', 'QR ID', 'Type', 'Created', 'Status', 'Scans'].map((h, i) => (
                        <th key={i} style={{ padding: '9px 12px', textAlign: 'left', color: '#6B7280', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((qr, i) => {
                      const sel = selected.has(qr.id);
                      const st  = statusOf(qr);
                      return (
                        <tr key={qr.id} onClick={() => toggleOne(qr.id)} style={{ background: sel ? '#FEF2F2' : i % 2 === 0 ? '#FFFFFF' : '#FAFAFA', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', transition: 'background 100ms' }}>
                          <td style={{ padding: '9px 12px', width: 32 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${sel ? DANGER : '#D1D5DB'}`, background: sel ? DANGER : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>{sel ? '✓' : ''}</div>
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#1A1A1A', fontWeight: 700, whiteSpace: 'nowrap' }}>{qr.code}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 7px', borderRadius: 20, ...typeStyle(qr.type) }}>{qr.type}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: '#6B7280', whiteSpace: 'nowrap' }}>{fmt(qr.createdAt)}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, padding: '2px 7px', borderRadius: 20, ...statusStyle(st) }}>{st}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: '#6B7280', textAlign: 'center' }}>{qr.playCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Delete summary */}
            <div style={{ background: selected.size > 0 ? '#FEF2F2' : '#F9FAFB', border: `1px solid ${selected.size > 0 ? '#FECACA' : '#E5E7EB'}`, borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', transition: 'all 200ms ease' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: selected.size > 0 ? DANGER : '#9CA3AF' }}>
                  Selected: {selected.size} QR Code{selected.size !== 1 ? 's' : ''}
                </div>
                {selected.size > 0 && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Estimated removal: {selected.size} Firestore record{selected.size !== 1 ? 's' : ''}</div>}
              </div>
              <button onClick={() => setConfirm(true)} disabled={selected.size === 0 || deleting} style={{
                padding: '11px 22px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 800,
                background: selected.size > 0 ? `linear-gradient(135deg,${DANGER},#B91C1C)` : '#F3F4F6',
                color: selected.size > 0 ? '#fff' : '#9CA3AF',
                cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                boxShadow: selected.size > 0 ? `0 4px 16px ${DANGER}30` : 'none',
                display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: 'all 200ms ease',
              }}>
                {deleting
                  ? <><div style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'bcspin 0.7s linear infinite' }} /> Deleting...</>
                  : <><Trash size={14} strokeWidth={2} /> Delete Selected</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <DeleteConfirmModal
          count={selected.size}
          batchNames={[...new Set(codes.filter(c => selected.has(c.id)).map(c => c.batch).filter(Boolean))]}
          onCancel={() => setConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
      <style>{`@keyframes bcspin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function quickBtnLight(color?: string): React.CSSProperties {
  if (color === DANGER) return { padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: `1px solid #FECACA`, background: '#FEF2F2', color: DANGER, cursor: 'pointer' };
  if (color === WARN)   return { padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: `1px solid #FDE68A`, background: '#FFFBEB', color: WARN,   cursor: 'pointer' };
  return                       { padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, border: '1px solid #E5E7EB', background: '#F3F4F6', color: '#6B7280', cursor: 'pointer' };
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────

type BtnVariant = 'danger' | 'warn' | 'safe' | 'ghost';

function ActionBtn({ label, icon, variant, onClick, loading }: { label: string; icon: React.ReactNode; variant: BtnVariant; onClick: () => void; loading: boolean; }) {
  const styles: Record<BtnVariant, { bg: string; border: string; color: string }> = {
    danger: { bg: '#FEF2F2', border: '#FECACA', color: DANGER },
    warn:   { bg: '#FFFBEB', border: '#FDE68A', color: WARN   },
    safe:   { bg: '#F0FDF4', border: '#BBF7D0', color: SAFE   },
    ghost:  { bg: '#F9FAFB', border: '#E5E7EB', color: '#374151' },
  };
  const c = styles[variant];
  return (
    <button onClick={onClick} disabled={loading} style={{ background: c.bg, border: `1px solid ${c.border}`, color: loading ? `${c.color}88` : c.color, borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: 'all 150ms' }}>
      {loading ? <span style={{ width: 12, height: 12, border: `2px solid ${c.color}33`, borderTopColor: c.color, borderRadius: '50%', animation: 'bcspin 0.7s linear infinite', display: 'inline-block' }} /> : icon}
      {label}
    </button>
  );
}

// ─── TypeGroup ────────────────────────────────────────────────────────────────

interface GroupProps { typeName: QRCodeType; label: string; icon: React.ReactNode; accent: string; bg: string; border: string; onRefresh: () => void; actor: string; }

function TypeGroup({ typeName, label, icon, accent, bg, border, onRefresh, actor }: GroupProps) {
  const [busy,           setBusy]           = useState<string | null>(null);
  const [msg,            setMsg]            = useState<string | null>(null);
  const [msgOk,          setMsgOk]          = useState(true);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const flash = (text: string, ok: boolean) => { setMsg(text); setMsgOk(ok); setTimeout(() => setMsg(null), 4000); };
  const run   = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e: any) { flash(e?.message ?? 'Failed.', false); } finally { setBusy(null); } };

  return (
    <>
      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ display: 'flex', color: accent }}>{icon}</span>
          <span style={{ color: accent, fontSize: 13, fontWeight: 800 }}>{label} QR</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, background: `${accent}15`, color: accent, border: `1px solid ${border}` }}>BULK</span>
        </div>
        {msg && <div style={{ padding: '6px 10px', borderRadius: 8, marginBottom: 10, background: msgOk ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msgOk ? '#BBF7D0' : '#FECACA'}` }}><p style={{ color: msgOk ? SAFE : DANGER, fontSize: 11, fontWeight: 700, margin: 0 }}>{msg}</p></div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ActionBtn label="Disable All" icon={<PauseCircle size={15} strokeWidth={2} />} variant="warn" onClick={() => setConfirmDisable(true)} loading={busy === 'disable'} />
          <ActionBtn label="Enable All"  icon={<PlayCircle  size={15} strokeWidth={2} />} variant="safe" onClick={() => run('enable', async () => { const n = await bulkSetActiveByType(typeName, true); await writeOpLog('enable-all', typeName, n, actor); flash(`${n} ${label} QR codes enabled.`, true); onRefresh(); })} loading={busy === 'enable'} />
        </div>
      </div>

      {confirmDisable && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: 20, padding: 28, maxWidth: 380, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <AlertTriangle size={24} color={WARN} style={{ marginBottom: 12 }} />
            <h3 style={{ color: '#1A1A1A', fontSize: 16, fontWeight: 900, margin: '0 0 8px' }}>Disable All {label}</h3>
            <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 20px', lineHeight: 1.6 }}>Set active=false on every {label} QR code. You can re-enable them at any time.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDisable(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => { setConfirmDisable(false); run('disable', async () => { const n = await bulkSetActiveByType(typeName, false); await writeOpLog('disable-all', typeName, n, actor); flash(`${n} ${label} QR codes disabled.`, true); onRefresh(); }); }} style={{ flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 800, background: `linear-gradient(135deg,${WARN},#B45309)`, border: 'none', color: '#fff', cursor: 'pointer' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface Props { onRefresh: () => void; actor: string; }

export default function QRBulkControl({ onRefresh, actor }: Props) {
  const [backupMsg,        setBackupMsg]        = useState<string | null>(null);
  const [backing,          setBacking]          = useState(false);
  const [showDeleteCenter, setShowDeleteCenter] = useState(false);

  const handleBackup = async () => {
    setBacking(true);
    try { const d = await exportBackupJSON(); setBackupMsg(`Backup downloaded: backup-${d}.json`); setTimeout(() => setBackupMsg(null), 5000); }
    catch (e: any) { setBackupMsg(e?.message ?? 'Backup failed.'); }
    finally { setBacking(false); }
  };

  return (
    <>
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Bulk Control Center</h2>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Enable, disable or delete QR codes in bulk</p>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20, background: '#FEF2F2', border: '1px solid #FECACA', color: DANGER }}>Admin Only</span>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Warning */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color={WARN} style={{ flexShrink: 0 }} />
            <p style={{ color: '#92400E', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
              Bulk operations affect all matching QR codes immediately. Always export a backup before deleting.
            </p>
          </div>

          {/* Backup + Delete Center */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <ActionBtn label="Export Backup JSON" icon={<HardDrive size={15} strokeWidth={2} />} variant="ghost" onClick={handleBackup} loading={backing} />
            <button onClick={() => setShowDeleteCenter(true)} style={{ background: '#FEF2F2', border: `1px solid #FECACA`, color: DANGER, borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
              <Trash2 size={14} strokeWidth={2} /> Delete Center
            </button>
            {backupMsg && <span style={{ fontSize: 11, color: SAFE, fontWeight: 700 }}>{backupMsg}</span>}
          </div>

          {/* Groups */}
          <TypeGroup typeName="Regular" label="Regular" icon={<Package     size={17} strokeWidth={2} />} accent="#374151" bg="#F9FAFB" border="#E5E7EB" onRefresh={onRefresh} actor={actor} />
          <TypeGroup typeName="Golden"  label="Golden"  icon={<ShieldCheck size={17} strokeWidth={2} />} accent={WARN}    bg="#FFFBEB" border="#FDE68A" onRefresh={onRefresh} actor={actor} />
        </div>
      </section>

      {showDeleteCenter && <DeleteCenterModal onClose={() => setShowDeleteCenter(false)} onRefresh={onRefresh} actor={actor} />}
      <style>{`@keyframes bcspin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
