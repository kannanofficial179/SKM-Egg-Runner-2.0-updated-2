import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2, CheckCircle2, AlertTriangle, PauseCircle, PlayCircle,
  HardDrive, ShieldCheck, Code2, Package, Trash,
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
const DANGER = '#ef4444';
const SAFE   = '#22c55e';
const WARN   = '#f59e0b';

// ─── helpers ─────────────────────────────────────────────────────────────────

function dateKey(d: Date) { return d.toISOString().slice(0, 10); }
function todayKey()      { return dateKey(new Date()); }
function yesterdayKey()  { const d = new Date(); d.setDate(d.getDate() - 1); return dateKey(d); }
function nDaysAgoKey(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); }

function fmt(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusOf(qr: QRCodeRecord): 'Active' | 'Disabled' | 'Exhausted' | 'Unused' {
  if (qr.playCount === 0)                        return 'Unused';
  if (!qr.active)                                return 'Disabled';
  if (qr.playCount >= qr.maxPlays)               return 'Exhausted';
  return 'Active';
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmDialog({
  count, onConfirm, onCancel,
}: { count: number; onConfirm: () => void; onCancel: () => void }) {
  const [typed, setTyped] = useState('');
  const ready = typed.trim() === 'DELETE';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10100,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#0f0f0f', border: `1.5px solid ${DANGER}55`,
        borderRadius: 20, padding: 28, maxWidth: 380, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, marginBottom: 16,
          background: 'rgba(239,68,68,0.15)', border: `1px solid ${DANGER}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}><Trash2 size={22} strokeWidth={2} color={DANGER} /></div>
        <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 900, margin: '0 0 8px' }}>
          Delete {count} QR Code{count !== 1 ? 's' : ''}?
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 18px', lineHeight: 1.6 }}>
          This permanently removes the selected QR codes from Firebase. This action cannot be undone.
        </p>
        <p style={{ color: DANGER, fontSize: 11, fontWeight: 700, margin: '0 0 7px' }}>
          Type <strong>DELETE</strong> to confirm:
        </p>
        <input
          autoFocus
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder='Type "DELETE" here'
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
            background: 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${typed === 'DELETE' ? SAFE : 'rgba(255,255,255,0.1)'}`,
            color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
            marginBottom: 18,
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} disabled={!ready} style={{
            flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 800,
            background: ready ? DANGER : 'rgba(255,255,255,0.08)', border: 'none',
            color: ready ? '#fff' : 'rgba(255,255,255,0.25)', cursor: ready ? 'pointer' : 'not-allowed',
          }}>Confirm Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({
  deletedCount, batches, timestamp, onClose,
}: { deletedCount: number; batches: string[]; timestamp: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10100,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#0f0f0f', border: `1.5px solid ${SAFE}44`,
        borderRadius: 20, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.9)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 18px',
          background: `rgba(34,197,94,0.15)`, border: `1px solid ${SAFE}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        }}><CheckCircle2 size={26} strokeWidth={2} color={SAFE} /></div>
        <h3 style={{ color: SAFE, fontSize: 18, fontWeight: 900, margin: '0 0 8px' }}>
          {deletedCount} QR Code{deletedCount !== 1 ? 's' : ''} Deleted
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '0 0 18px' }}>Successfully removed from Firebase</p>

        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '12px 16px', textAlign: 'left', marginBottom: 20 }}>
          <Row label="Deleted Count"  value={`${deletedCount} QR codes`} />
          <Row label="Batches Affected" value={batches.length ? batches.slice(0, 3).join(', ') + (batches.length > 3 ? ` +${batches.length - 3} more` : '') : '—'} />
          <Row label="Timestamp"      value={timestamp} last />
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '13px 0', borderRadius: 13, border: 'none',
          background: `linear-gradient(135deg,${SAFE},#16A34A)`,
          color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
          boxShadow: `0 4px 16px rgba(34,197,94,0.35)`,
        }}>Done</button>
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      paddingBottom: last ? 0 : 8, marginBottom: last ? 0 : 8,
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ─── Delete Center Modal ──────────────────────────────────────────────────────

type FilterTab = 'today' | 'yesterday' | 'last7' | 'last30' | 'unused' | 'disabled' | 'all';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'today',     label: 'Today'      },
  { id: 'yesterday', label: 'Yesterday'  },
  { id: 'last7',     label: 'Last 7 Days'},
  { id: 'last30',    label: 'Last 30 Days'},
  { id: 'unused',    label: 'Unused Only' },
  { id: 'disabled',  label: 'Disabled'   },
  { id: 'all',       label: 'All Regular' },
];

function typeColor(t: string) {
  const l = t.toLowerCase();
  if (l === 'golden')    return WARN;
  if (l === 'developer') return '#818cf8';
  if (l === 'campaign')  return '#34d399';
  return 'rgba(255,255,255,0.6)';
}

function statusColor(s: string) {
  if (s === 'Active')    return SAFE;
  if (s === 'Disabled')  return DANGER;
  if (s === 'Exhausted') return WARN;
  return 'rgba(255,255,255,0.35)';
}

interface DeleteCenterProps {
  onClose:   () => void;
  onRefresh: () => void;
  actor:     string;
}

function DeleteCenterModal({ onClose, onRefresh, actor }: DeleteCenterProps) {
  const [codes,     setCodes]     = useState<QRCodeRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<FilterTab>('today');
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [confirm,   setConfirm]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [success,   setSuccess]   = useState<{ count: number; batches: string[]; ts: string } | null>(null);

  useEffect(() => {
    fetchAllQRCodes().then(all => {
      // Only regular codes in the Delete Center — never touch Golden/Developer unless they explicitly appear
      setCodes(all);
      setLoading(false);
    });
  }, []);

  // Stats panel
  const stats = useMemo(() => {
    const regular   = codes.filter(c => c.type.toLowerCase() === 'regular');
    const developer = codes.filter(c => c.type.toLowerCase() === 'developer');
    const golden    = codes.filter(c => c.type.toLowerCase() === 'golden');
    const disabled  = codes.filter(c => !c.active);
    const scanned   = codes.filter(c => c.playCount > 0);
    const unused    = codes.filter(c => c.playCount === 0);
    return { total: codes.length, regular: regular.length, developer: developer.length,
      golden: golden.length, disabled: disabled.length, scanned: scanned.length, unused: unused.length };
  }, [codes]);

  // Filtered rows (only Regular QRs can be deleted here)
  const filtered = useMemo(() => {
    const regular = codes.filter(c => c.type.toLowerCase() === 'regular');
    const today     = todayKey();
    const yesterday = yesterdayKey();
    const ago7      = nDaysAgoKey(7);
    const ago30     = nDaysAgoKey(30);
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

  // Batch names in current filter
  const batchNames = useMemo(() => {
    const names = [...new Set(filtered.map(c => c.batch).filter(Boolean))];
    // Show "Batch 1", "Batch 2" etc for cleanliness
    return names;
  }, [filtered]);

  // Selection helpers
  const allVisibleSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.delete(c.id)); return s; });
    } else {
      setSelected(prev => { const s = new Set(prev); filtered.forEach(c => s.add(c.id)); return s; });
    }
  };

  const toggleOne = (id: string) => {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const selectBatch = (batch: string) => {
    setSelected(prev => {
      const s = new Set(prev);
      filtered.filter(c => c.batch === batch).forEach(c => s.add(c.id));
      return s;
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    setConfirm(false);
    try {
      const ids      = [...selected];
      const affected = codes.filter(c => ids.includes(c.id));
      const batches  = [...new Set(affected.map(c => c.batch).filter(Boolean))];
      const n        = await bulkDeleteByIds(ids);
      await writeOpLog('delete-selected', 'Regular', n, actor);
      onRefresh();
      setSuccess({ count: n, batches, ts: new Date().toLocaleTimeString() });
    } catch (e: any) {
      alert(e?.message ?? 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  if (success) {
    return <SuccessScreen
      deletedCount={success.count}
      batches={success.batches}
      timestamp={success.ts}
      onClose={() => { setSuccess(null); onClose(); }}
    />;
  }

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '20px 16px', overflowY: 'auto',
      }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

        <div style={{
          background: '#0d0d0d', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 22, width: '100%', maxWidth: 720,
          boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(0,0,0,0))',
            borderBottom: '1px solid rgba(239,68,68,0.18)',
            padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(239,68,68,0.15)', border: `1px solid ${DANGER}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}><Trash2 size={18} strokeWidth={2} color={DANGER} /></div>
                <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 900, margin: 0 }}>Delete QR Codes</h2>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
                Select which QR codes should be removed. Golden &amp; Developer codes are protected.
              </p>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: 'none', fontSize: 18,
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>×</button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Stats panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { label: 'Total',     value: stats.total,     color: 'rgba(255,255,255,0.7)' },
                { label: 'Regular',   value: stats.regular,   color: 'rgba(255,255,255,0.55)' },
                { label: 'Unused',    value: stats.unused,    color: WARN },
                { label: 'Disabled',  value: stats.disabled,  color: DANGER },
              ].map(s => (
                <div key={s.label} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setSelected(new Set()); }} style={{
                  padding: '6px 13px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  border: 'none', cursor: 'pointer', transition: 'all 150ms',
                  background: tab === t.id ? DANGER : 'rgba(255,255,255,0.06)',
                  color:      tab === t.id ? '#fff'  : 'rgba(255,255,255,0.45)',
                  boxShadow:  tab === t.id ? `0 3px 10px ${DANGER}44` : 'none',
                }}>{t.label}</button>
              ))}
            </div>

            {/* Quick-select row */}
            {!loading && filtered.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>Select:</span>
                <button onClick={toggleAll} style={quickBtn(allVisibleSelected ? DANGER : undefined)}>
                  {allVisibleSelected ? 'Deselect All' : `All ${filtered.length} visible`}
                </button>
                {batchNames.slice(0, 4).map(b => (
                  <button key={b} onClick={() => selectBatch(b)} style={quickBtn()}>
                    {b.replace('BATCH-', 'Batch ').substring(0, 14)}
                  </button>
                ))}
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set())} style={quickBtn(WARN)}>
                    Clear ({selected.size})
                  </button>
                )}
              </div>
            )}

            {/* Table */}
            <div style={{
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
              overflow: 'hidden', maxHeight: 300, overflowY: 'auto',
            }}>
              {loading ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  <div style={{ width: 20, height: 20, border: `2px solid rgba(255,255,255,0.1)`, borderTopColor: DANGER,
                    borderRadius: '50%', animation: 'bcspin 0.7s linear infinite', margin: '0 auto 8px' }} />
                  Loading QR codes...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                  No Regular QR codes match this filter.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      {['', 'QR ID', 'Type', 'Created', 'Status', 'Scans'].map((h, i) => (
                        <th key={i} style={{ padding: '9px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.35)',
                          fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((qr, i) => {
                      const sel = selected.has(qr.id);
                      const st  = statusOf(qr);
                      return (
                        <tr key={qr.id} onClick={() => toggleOne(qr.id)} style={{
                          background: sel ? 'rgba(239,68,68,0.08)' : i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          cursor: 'pointer', transition: 'background 100ms',
                        }}>
                          <td style={{ padding: '9px 12px', width: 32 }}>
                            <div style={{
                              width: 16, height: 16, borderRadius: 5, border: `1.5px solid ${sel ? DANGER : 'rgba(255,255,255,0.2)'}`,
                              background: sel ? DANGER : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, color: '#fff',
                            }}>{sel ? '✓' : ''}</div>
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap' }}>{qr.code}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
                              color: typeColor(qr.type), padding: '2px 7px', borderRadius: 20,
                              background: `${typeColor(qr.type)}18` }}>{qr.type}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{fmt(qr.createdAt)}</td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
                              color: statusColor(st), padding: '2px 7px', borderRadius: 20,
                              background: `${statusColor(st)}18` }}>{st}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{qr.playCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Delete summary + action */}
            <div style={{
              background: selected.size > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${selected.size > 0 ? DANGER + '33' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
              transition: 'all 200ms ease', flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: selected.size > 0 ? DANGER : 'rgba(255,255,255,0.3)' }}>
                  Selected: {selected.size} QR Code{selected.size !== 1 ? 's' : ''}
                </div>
                {selected.size > 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                    Estimated removal: {selected.size} Firestore record{selected.size !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <button
                onClick={() => setConfirm(true)}
                disabled={selected.size === 0 || deleting}
                style={{
                  padding: '11px 22px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 800,
                  background: selected.size > 0 ? `linear-gradient(135deg,${DANGER},#b91c1c)` : 'rgba(255,255,255,0.06)',
                  color: selected.size > 0 ? '#fff' : 'rgba(255,255,255,0.2)',
                  cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: selected.size > 0 ? `0 4px 16px ${DANGER}44` : 'none',
                  display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
                  transition: 'all 200ms ease',
                }}
              >
                {deleting
                  ? <><div style={{ width: 13, height: 13, border: `2px solid rgba(255,255,255,0.3)`, borderTopColor: '#fff', borderRadius: '50%', animation: 'bcspin 0.7s linear infinite' }} /> Deleting...</>
                  : <><Trash size={14} strokeWidth={2} /> Delete Selected</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          count={selected.size}
          onCancel={() => setConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      <style>{`@keyframes bcspin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function quickBtn(color?: string): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    border: `1px solid ${color ? color + '55' : 'rgba(255,255,255,0.12)'}`,
    background: color ? color + '18' : 'rgba(255,255,255,0.05)',
    color: color ?? 'rgba(255,255,255,0.5)', cursor: 'pointer',
  };
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────

type BtnVariant = 'danger' | 'warn' | 'safe' | 'ghost';

function ActionBtn({
  label, icon, variant, onClick, loading,
}: {
  label: string; icon: React.ReactNode; variant: BtnVariant; onClick: () => void; loading: boolean;
}) {
  const colors: Record<BtnVariant, { bg: string; border: string; color: string }> = {
    danger: { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  color: DANGER },
    warn:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', color: WARN   },
    safe:   { bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)',  color: SAFE   },
    ghost:  { bg: 'rgba(255,255,255,0.05)',border: 'rgba(255,255,255,0.12)',color: 'rgba(255,255,255,0.6)' },
  };
  const c = colors[variant];
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: c.bg, border: `1.5px solid ${c.border}`, color: loading ? `${c.color}55` : c.color,
      borderRadius: 11, padding: '10px 16px', fontSize: 12, fontWeight: 700,
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', transition: 'all 150ms',
    }}>
      {loading
        ? <span style={{ width: 12, height: 12, border: `2px solid ${c.color}44`, borderTopColor: c.color, borderRadius: '50%', animation: 'bcspin 0.7s linear infinite', display: 'inline-block' }} />
        : icon}
      {label}
    </button>
  );
}

// ─── TypeGroup (enable / disable — no delete button here anymore) ─────────────

interface GroupProps {
  typeName:  QRCodeType;
  label:     string;
  icon:      React.ReactNode;
  color:     string;
  onRefresh: () => void;
  actor:     string;
}

function TypeGroup({ typeName, label, icon, color, onRefresh, actor }: GroupProps) {
  const [busy, setBusy]   = useState<string | null>(null);
  const [msg,  setMsg]    = useState<string | null>(null);
  const [isOk, setIsOk]  = useState(true);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const flash = (text: string, ok: boolean) => {
    setMsg(text); setIsOk(ok);
    setTimeout(() => setMsg(null), 4000);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { flash(e?.message ?? 'Operation failed.', false); }
    finally { setBusy(null); }
  };

  const handleDisable = () => setConfirmDisable(true);

  const handleEnable = () =>
    run('enable', async () => {
      const n = await bulkSetActiveByType(typeName, true);
      await writeOpLog('enable-all', typeName, n, actor);
      flash(`${n} ${label} QR codes enabled.`, true);
      onRefresh();
    });

  return (
    <>
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`,
        borderRadius: 14, padding: '16px 18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ display: 'flex', color }}>{icon}</span>
          <span style={{ color, fontSize: 13, fontWeight: 800 }}>{label} QR</span>
          <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase',
            padding: '2px 8px', borderRadius: 20, background: `${color}18`, color }}>BULK</span>
        </div>
        {msg && <p style={{ fontSize: 11, fontWeight: 700, color: isOk ? SAFE : DANGER, margin: '0 0 10px' }}>{msg}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ActionBtn label="Disable All" icon={<PauseCircle size={15} strokeWidth={2} />} variant="warn" onClick={handleDisable} loading={busy === 'disable'} />
          <ActionBtn label="Enable All"  icon={<PlayCircle  size={15} strokeWidth={2} />} variant="safe" onClick={handleEnable}  loading={busy === 'enable'}  />
        </div>
      </div>

      {confirmDisable && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: '#111', border: `1.5px solid ${WARN}44`,
            borderRadius: 20, padding: 28, maxWidth: 360, width: '100%',
          }}>
            <AlertTriangle size={24} color={WARN} style={{ marginBottom: 12 }} />
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 900, margin: '0 0 8px' }}>Disable All {label}</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '0 0 20px', lineHeight: 1.6 }}>
              Set active=false on every {label} QR code. You can re-enable them at any time.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDisable(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => {
                setConfirmDisable(false);
                run('disable', async () => {
                  const n = await bulkSetActiveByType(typeName, false);
                  await writeOpLog('disable-all', typeName, n, actor);
                  flash(`${n} ${label} QR codes disabled.`, true);
                  onRefresh();
                });
              }} style={{
                flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 800,
                background: WARN, border: 'none', color: '#fff', cursor: 'pointer',
              }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

interface Props {
  onRefresh: () => void;
  actor:     string;
}

export default function QRBulkControl({ onRefresh, actor }: Props) {
  const [backupMsg,      setBackupMsg]      = useState<string | null>(null);
  const [backing,        setBacking]        = useState(false);
  const [showDeleteCenter, setShowDeleteCenter] = useState(false);

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
    <>
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>
            Bulk Control Center
          </h2>
          <span style={{
            fontSize: 9, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase',
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: DANGER,
          }}>Admin Only</span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Warning */}
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0 }} />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, margin: 0, lineHeight: 1.5 }}>
              Bulk operations affect all matching QR codes immediately. Always export a backup before deleting.
            </p>
          </div>

          {/* Backup + Delete Center */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <ActionBtn label="Export Backup JSON" icon={<HardDrive size={15} strokeWidth={2} />} variant="ghost" onClick={handleBackup} loading={backing} />
            <button
              onClick={() => setShowDeleteCenter(true)}
              style={{
                background: 'rgba(239,68,68,0.12)', border: `1.5px solid ${DANGER}55`,
                color: DANGER, borderRadius: 11, padding: '10px 16px',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
              }}
            >
              <Trash2 size={14} strokeWidth={2} /> Delete Center
            </button>
            {backupMsg && <span style={{ fontSize: 11, color: SAFE, fontWeight: 700 }}>{backupMsg}</span>}
          </div>

          {/* Enable / Disable groups */}
          <TypeGroup typeName="Regular" label="Regular" icon={<Package      size={18} strokeWidth={2} />} color="rgba(255,255,255,0.7)" onRefresh={onRefresh} actor={actor} />
          <TypeGroup typeName="Golden"  label="Golden"  icon={<ShieldCheck  size={18} strokeWidth={2} />} color={WARN}                  onRefresh={onRefresh} actor={actor} />
        </div>
      </section>

      {showDeleteCenter && (
        <DeleteCenterModal
          onClose={() => setShowDeleteCenter(false)}
          onRefresh={onRefresh}
          actor={actor}
        />
      )}

      <style>{`@keyframes bcspin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
