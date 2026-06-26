import React, { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  PauseCircle, PlayCircle, Trash2, Printer, Upload, HardDrive, Activity,
  Trash, Search, X, Filter, Download, ChevronRight, CheckCircle2, AlertCircle,
  Clock, Monitor, Smartphone, Globe, Hash, User, Package, FileText,
  Calendar, RefreshCw, ChevronDown,
} from 'lucide-react';
import { fetchOpLogs } from '../../services/qr/qrManagementService';
import type { OpLog } from '../../services/qr/qrManagementService';

const RED    = '#D71920';
const SAFE   = '#16A34A';
const DANGER = '#DC2626';
const WARN   = '#D97706';

// ─── Op metadata ─────────────────────────────────────────────────────────────

const OP_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'disable-all':     { label: 'Disable All',     color: WARN,     bg: '#FFFBEB', border: '#FDE68A' },
  'enable-all':      { label: 'Enable All',      color: SAFE,     bg: '#F0FDF4', border: '#BBF7D0' },
  'delete-all':      { label: 'Delete All',      color: DANGER,   bg: '#FEF2F2', border: '#FECACA' },
  'delete-selected': { label: 'Delete Selected', color: DANGER,   bg: '#FEF2F2', border: '#FECACA' },
  'print':           { label: 'Print',           color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  'export':          { label: 'Export',          color: '#6D28D9', bg: '#FAF5FF', border: '#DDD6FE' },
  'backup':          { label: 'Backup',          color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  'generate':        { label: 'Generate',        color: RED,       bg: `${RED}0D`, border: `${RED}25` },
};

function getMeta(op: string) {
  return OP_META[op] ?? { label: op, color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' };
}

function OpIcon({ op, color }: { op: string; color: string }) {
  const p = { size: 14, strokeWidth: 2, color };
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

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtFull(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeAgo(ts: Date): string {
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtShort(ts);
}

function dateKey(d: Date) { return d.toISOString().slice(0, 10); }
function todayKey()       { return dateKey(new Date()); }
function nDaysAgoKey(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); }

// ─── Log detail drawer ────────────────────────────────────────────────────────

function LogDetailDrawer({ log, onClose }: { log: OpLog; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t); }, []);

  const meta = getMeta(log.operation);
  const isSuccess = log.status !== 'failed';

  // Timeline stages
  const stages = [
    { label: 'Requested',   done: true },
    { label: 'Validated',   done: true },
    { label: 'Processing',  done: true },
    { label: 'Completed',   done: isSuccess },
  ];

  const durationLabel = log.durationMs
    ? log.durationMs >= 1000
      ? `${(log.durationMs / 1000).toFixed(1)}s`
      : `${log.durationMs}ms`
    : '—';

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      display: 'flex', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.3)',
          backdropFilter: 'blur(4px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 250ms ease',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 500,
        height: '100%', overflowY: 'auto',
        background: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.12)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 250ms cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid #E5E7EB',
          background: '#FAFAFA', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 2,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.bg, border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <OpIcon op={log.operation} color={meta.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Operation Log</p>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meta.label}
            </h3>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            padding: '3px 9px', borderRadius: 20,
            background: isSuccess ? '#F0FDF4' : '#FEF2F2',
            color: isSuccess ? SAFE : DANGER,
            border: `1px solid ${isSuccess ? '#BBF7D0' : '#FECACA'}`,
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
          }}>
            {isSuccess ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
            {isSuccess ? 'Success' : 'Failed'}
          </span>
          <button onClick={close} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F3F4F6', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

          {/* Timeline */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>Lifecycle Timeline</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {stages.map((s, i) => (
                <React.Fragment key={s.label}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: s.done ? (i === stages.length - 1 ? (isSuccess ? SAFE : DANGER) : '#6366F1') : '#E5E7EB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: s.done ? `0 0 0 3px ${i === stages.length - 1 ? (isSuccess ? '#BBF7D0' : '#FECACA') : '#C7D2FE'}` : 'none',
                    }}>
                      {s.done
                        ? <CheckCircle2 size={13} color="#fff" strokeWidth={2.5} />
                        : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D1D5DB' }} />}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: s.done ? '#1A1A1A' : '#9CA3AF', textAlign: 'center', letterSpacing: 0.3 }}>{s.label}</span>
                  </div>
                  {i < stages.length - 1 && (
                    <div style={{ flex: 1, height: 2, background: stages[i + 1].done ? '#6366F1' : '#E5E7EB', marginBottom: 20, transition: 'background 300ms' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
            {log.durationMs > 0 && (
              <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', margin: '8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Clock size={10} /> Total duration: <strong style={{ color: '#374151' }}>{durationLabel}</strong>
              </p>
            )}
          </div>

          {/* Core detail table */}
          <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '9px 14px', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Operation Details</span>
            </div>
            {[
              { icon: <Hash size={12} />,      label: 'Operation ID',   value: log.id,              mono: true  },
              { icon: <Calendar size={12} />,  label: 'Date & Time',    value: fmtFull(log.ts)               },
              { icon: <User size={12} />,      label: 'Admin',          value: log.actor                     },
              { icon: <Activity size={12} />,  label: 'Operation Type', value: meta.label                    },
              { icon: <Package size={12} />,   label: 'QR Type',        value: log.type || '—'               },
              { icon: <Hash size={12} />,      label: 'Affected Count', value: `${log.count} QR code${log.count !== 1 ? 's' : ''}` },
              { icon: <FileText size={12} />,  label: 'Batch',          value: log.batchName || '—'          },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ color: RED, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 110, flexShrink: 0 }}>{row.label}</span>
                <span style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 600, flex: 1, wordBreak: 'break-all', ...(row.mono ? { fontFamily: 'monospace', fontSize: 10 } : {}) }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Reason */}
          {log.reason && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Reason for Operation</p>
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 12, color: '#92400E', margin: 0, lineHeight: 1.6, fontStyle: 'italic' }}>
                  "{log.reason}"
                </p>
              </div>
            </div>
          )}

          {/* Environment */}
          {(log.browser || log.device) && (
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '9px 14px', background: '#F3F4F6', borderBottom: '1px solid #E5E7EB' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Environment</span>
              </div>
              {[
                { icon: log.device === 'Mobile' ? <Smartphone size={12} /> : <Monitor size={12} />, label: 'Device',  value: log.device  || '—' },
                { icon: <Globe size={12} />,   label: 'Browser', value: log.browser || '—' },
                { icon: <Clock size={12} />,   label: 'Duration', value: durationLabel },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ color: '#9CA3AF', flexShrink: 0 }}>{row.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', minWidth: 80, flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Affected QR IDs */}
          {log.qrIds && log.qrIds.length > 0 && (
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
                Affected QR IDs ({log.qrIds.length}{log.qrIds.length === 50 ? '+' : ''})
              </p>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 12px', maxHeight: 140, overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {log.qrIds.slice(0, 50).map(id => (
                    <span key={id} style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 5, background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#374151' }}>{id}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Filter types ─────────────────────────────────────────────────────────────

type PeriodFilter = 'all' | 'today' | 'yesterday' | 'last7' | 'last30';
type TypeFilter   = 'all' | 'generate' | 'delete-selected' | 'delete-all' | 'disable-all' | 'enable-all' | 'print' | 'export';
type StatusFilter = 'all' | 'success' | 'failed';

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportLogsCSV(logs: OpLog[]) {
  const header = 'ID,Operation,Type,Status,Count,Actor,Batch,Reason,Browser,Device,Duration(ms),Timestamp';
  const rows = logs.map(l =>
    [l.id, l.operation, l.type, l.status ?? 'success', l.count, l.actor, l.batchName ?? '', l.reason ?? '', l.browser ?? '', l.device ?? '', l.durationMs ?? 0, fmtFull(l.ts)]
      .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `qr-operation-logs-${dateKey(new Date())}.csv`; a.click();
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props { refreshKey: number; }

export default function QROperationLogs({ refreshKey }: Props) {
  const [logs,        setLogs]        = useState<OpLog[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<OpLog | null>(null);
  const [search,      setSearch]      = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [period,      setPeriod]      = useState<PeriodFilter>('all');
  const [opType,      setOpType]      = useState<TypeFilter>('all');
  const [status,      setStatus]      = useState<StatusFilter>('all');

  useEffect(() => {
    setLoading(true);
    fetchOpLogs(100).then(setLogs).catch(() => setLogs([])).finally(() => setLoading(false));
  }, [refreshKey]);

  // Filtered logs
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return logs.filter(log => {
      // Period
      if (period !== 'all') {
        const dk = dateKey(log.ts);
        if (period === 'today'     && dk !== todayKey())           return false;
        if (period === 'yesterday' && dk !== nDaysAgoKey(1))       return false;
        if (period === 'last7'     && dk < nDaysAgoKey(7))         return false;
        if (period === 'last30'    && dk < nDaysAgoKey(30))        return false;
      }
      // Op type
      if (opType !== 'all' && log.operation !== opType)           return false;
      // Status
      const logStatus = log.status ?? 'success';
      if (status !== 'all' && logStatus !== status)               return false;
      // Search
      if (q) {
        const hay = [log.id, log.operation, log.actor, log.batchName ?? '', log.reason ?? '', log.type, log.status ?? '', ...(log.qrIds ?? [])].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, period, opType, status]);

  const activeFilters = [period !== 'all', opType !== 'all', status !== 'all'].filter(Boolean).length;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Operation Logs</h2>
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>
            Complete audit trail of all admin actions · {filtered.length} of {logs.length} entries
          </p>
        </div>
        <button
          onClick={() => exportLogsCSV(filtered)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F3F4F6', color: '#374151', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

        {/* Search + filter bar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search */}
            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by ID, admin, batch, reason, QR ID…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  paddingLeft: 32, paddingRight: search ? 32 : 12,
                  paddingTop: 8, paddingBottom: 8,
                  borderRadius: 8, border: '1px solid #E5E7EB',
                  fontSize: 12, color: '#1A1A1A', outline: 'none',
                  background: '#F9FAFB',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 13px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                background: showFilters ? `${RED}0D` : '#F3F4F6',
                border: `1px solid ${showFilters ? `${RED}30` : '#E5E7EB'}`,
                color: showFilters ? RED : '#374151',
              }}
            >
              <Filter size={12} />
              Filters
              {activeFilters > 0 && (
                <span style={{ background: RED, color: '#fff', borderRadius: 20, padding: '1px 6px', fontSize: 9, fontWeight: 900 }}>{activeFilters}</span>
              )}
              <ChevronDown size={11} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, paddingTop: 10, borderTop: '1px solid #F3F4F6' }}>

              {/* Period */}
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Period</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {([['all','All Time'],['today','Today'],['yesterday','Yesterday'],['last7','Last 7 Days'],['last30','Last 30 Days']] as [PeriodFilter, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setPeriod(v)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: period === v ? `${RED}0D` : '#F9FAFB', color: period === v ? RED : '#6B7280', borderColor: period === v ? `${RED}30` : '#E5E7EB' }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Operation type */}
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Operation</p>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {([['all','All'],['generate','Generate'],['delete-selected','Delete'],['disable-all','Disable'],['enable-all','Enable'],['print','Print'],['export','Export']] as [TypeFilter, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setOpType(v)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: opType === v ? `${RED}0D` : '#F9FAFB', color: opType === v ? RED : '#6B7280', borderColor: opType === v ? `${RED}30` : '#E5E7EB' }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Status</p>
                <div style={{ display: 'flex', gap: 5 }}>
                  {([['all','All'],['success','Successful'],['failed','Failed']] as [StatusFilter, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setStatus(v)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid', background: status === v ? `${RED}0D` : '#F9FAFB', color: status === v ? RED : '#6B7280', borderColor: status === v ? `${RED}30` : '#E5E7EB' }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Clear */}
              {activeFilters > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={() => { setPeriod('all'); setOpType('all'); setStatus('all'); }} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: '1px solid #FECACA', background: '#FEF2F2', color: DANGER }}>Clear All</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Log list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', gap: 10, alignItems: 'center' }}>
            <RefreshCw size={16} color={RED} style={{ animation: 'olspin 0.8s linear infinite' }} />
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>Loading logs…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p style={{ color: '#9CA3AF', fontSize: 13, fontWeight: 600, margin: 0 }}>No operations match your search or filters.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((log, i) => {
              const meta = getMeta(log.operation);
              const isSuccess = log.status !== 'failed';
              return (
                <div
                  key={log.id}
                  onClick={() => setSelected(log)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none',
                    cursor: 'pointer', transition: 'background 120ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Op icon */}
                  <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: meta.bg, border: `1px solid ${meta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <OpIcon op={log.operation} color={meta.color} />
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#1A1A1A' }}>{meta.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {log.type}
                      </span>
                      {!isSuccess && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: '#FEF2F2', color: DANGER, border: '1px solid #FECACA', textTransform: 'uppercase', letterSpacing: 0.5 }}>Failed</span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>{log.actor}</span>
                      <span>·</span>
                      <span>{log.count} code{log.count !== 1 ? 's' : ''}</span>
                      {log.batchName && <><span>·</span><span>{log.batchName}</span></>}
                      {log.reason && <><span>·</span><span style={{ fontStyle: 'italic', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{log.reason}"</span></>}
                    </div>
                  </div>

                  {/* Time + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: '#9CA3AF' }}>{timeAgo(log.ts)}</span>
                    <ChevronRight size={13} color="#D1D5DB" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <LogDetailDrawer log={selected} onClose={() => setSelected(null)} />}

      <style>{`@keyframes olspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
