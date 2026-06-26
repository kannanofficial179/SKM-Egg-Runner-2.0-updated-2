import React, { useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Search, Eye, Download, Printer, Copy, PauseCircle, PlayCircle,
  X, CheckCircle2, QrCode as QrCodeIcon,
} from 'lucide-react';
import type { QRCodeRecord, QRSearchFilters } from '../../types/qr/qrManagementTypes';
import { searchQRCodes, setQRActive, syncGameUrlFromFirestore } from '../../services/qr/qrManagementService';

const RED = '#D71920';

// Resolve the QR URL for a record: prefer the url field stored in Firestore
// at generation time (always correct), fall back to live Settings fetch.
async function resolveQRUrl(qr: any): Promise<string> {
  if (qr.url) return qr.url as string;
  const base = await syncGameUrlFromFirestore();
  console.log('[QR PAYLOAD] URL embedded:', `${base}/?qr=${qr.code}`, '| Source: Firestore Settings (fallback)');
  return `${base}/?qr=${qr.code}`;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function statusMeta(qr: QRCodeRecord) {
  if (!qr.active)                      return { label: 'Disabled',  bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' };
  if (qr.playCount >= qr.maxPlays)     return { label: 'Exhausted', bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' };
  return                                      { label: 'Active',    bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' };
}

function typeMeta(type: string) {
  const l = type.toLowerCase();
  if (l === 'golden')    return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' };
  if (l === 'developer') return { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' };
  if (l === 'campaign')  return { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' };
  return                        { bg: '#F3F4F6', color: '#374151', border: '#E5E7EB' };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function generateQRDataUrl(qr: any): Promise<string> {
  const url = await resolveQRUrl(qr);
  console.log('[QR IMAGE] Generating with URL:', url);
  return QRCode.toDataURL(url, {
    width: 300, margin: 2,
    color: { dark: '#1a0000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
}

function downloadBlob(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─── Icon button ─────────────────────────────────────────────────────────────

function IconBtn({ icon, tooltip, onClick, danger, success, disabled }: {
  icon: React.ReactNode; tooltip: string; onClick: () => void;
  danger?: boolean; success?: boolean; disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const color  = danger ? '#DC2626' : success ? '#16A34A' : '#6B7280';
  const hoverBg = danger ? '#FEF2F2' : success ? '#F0FDF4' : '#F3F4F6';

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={onClick} disabled={disabled}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={tooltip}
        style={{
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: hover ? hoverBg : 'transparent',
          color: disabled ? '#D1D5DB' : color,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 150ms', flexShrink: 0,
        }}
      >{icon}</button>
      {hover && !disabled && (
        <div style={{
          position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)',
          background: '#1A1A1A', color: '#fff', fontSize: 10, fontWeight: 600,
          padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none',
          zIndex: 100,
        }}>{tooltip}</div>
      )}
    </div>
  );
}

// ─── QR Preview Modal ─────────────────────────────────────────────────────────

interface PreviewModalProps {
  qr:       QRCodeRecord;
  dataUrl:  string;
  onClose:  () => void;
  onToggle: (code: string, active: boolean) => void;
  toggling: string | null;
}

function QRPreviewModal({ qr, dataUrl, onClose, onToggle, toggling }: PreviewModalProps) {
  const [copied, setCopied]     = useState(false);
  const [printing, setPrinting] = useState(false);

  const sm = statusMeta(qr);
  const tm = typeMeta(qr.type);

  const handleCopy = () => {
    navigator.clipboard.writeText(qr.code).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => downloadBlob(dataUrl, `${qr.code}.png`);

  const handlePrint = () => {
    setPrinting(true);
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${qr.code}</title>
      <style>@page{size:A5;margin:14mm}body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0}
      .card{border:1.5px solid #eee;border-radius:14px;padding:20px;text-align:center;max-width:240px}
      .code{font-size:14px;font-weight:900;font-family:monospace;color:#111;margin:10px 0 4px;letter-spacing:1px}
      .badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:3px 10px;border-radius:20px;background:rgba(215,25,32,0.07);color:#D71920;display:inline-block;margin-bottom:4px}
      .meta{font-size:9px;color:#bbb;margin-top:6px}</style>
      </head><body>
      <div class="card">
        <img src="${dataUrl}" width="200" height="200" style="display:block;margin:0 auto;border-radius:8px"/>
        <div class="code">${qr.code}</div>
        <div class="badge">${qr.type}</div>
        <div class="meta">${date}</div>
      </div>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>`;
    const win = window.open('', '_blank', 'width=400,height=500');
    if (win) { win.document.write(html); win.document.close(); }
    setTimeout(() => setPrinting(false), 1000);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#FFFFFF', borderRadius: 22, width: '100%', maxWidth: 680, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', overflow: 'hidden', border: '1px solid #E5E7EB' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `${RED}10`, border: `1px solid ${RED}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}>
              <QrCodeIcon size={15} strokeWidth={2} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>QR Preview</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>{qr.code}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* ── Two-column body ── */}
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 320 }}>

          {/* Left — QR image */}
          <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#FAFAFA' }}>
            <div style={{ border: '1.5px solid #E5E7EB', borderRadius: 16, padding: 14, background: '#FFFFFF', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
              <img src={dataUrl} alt={qr.code} style={{ width: 160, height: 160, display: 'block', borderRadius: 6 }} />
            </div>
          </div>

          {/* Right — details + actions */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '18px 20px', gap: 14, minWidth: 0 }}>

            {/* Details table */}
            <div style={{ background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden', flex: 1 }}>
              {[
                { label: 'QR Code', value: qr.code,                                                         mono: true },
                { label: 'Type',    value: qr.type,                                                         badge: tm  },
                { label: 'Status',  value: sm.label,                                                        badge: sm  },
                { label: 'Batch',   value: qr.batch || '—',                                                 mono: true },
                { label: 'Usage',   value: `${qr.playCount} / ${qr.maxPlays >= 999999 ? '∞' : qr.maxPlays} scans`     },
                { label: 'Created', value: fmtDate(qr.createdAt)                                                       },
              ].map((row, i, arr) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, flexShrink: 0 }}>{row.label}</span>
                  {row.badge ? (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, padding: '2px 8px', borderRadius: 20, background: row.badge.bg, color: row.badge.color, border: `1px solid ${row.badge.border}` }}>
                      {row.value}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A', fontFamily: row.mono ? 'monospace' : undefined, textAlign: 'right', wordBreak: 'break-all' }}>{row.value}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {/* Download — primary */}
              <button onClick={handleDownload} style={{
                background: `linear-gradient(135deg,${RED},#B51218)`, color: '#fff', border: 'none',
                borderRadius: 10, padding: '11px 0', fontSize: 12, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: `0 3px 12px ${RED}30`,
              }}>
                <Download size={14} strokeWidth={2} /> Download PNG
              </button>

              {/* Print + Copy */}
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={handlePrint} disabled={printing} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid #E5E7EB',
                  background: '#F9FAFB', color: '#374151', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <Printer size={13} strokeWidth={2} /> {printing ? 'Printing…' : 'Print QR'}
                </button>
                <button onClick={handleCopy} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10,
                  border: `1px solid ${copied ? '#BBF7D0' : '#E5E7EB'}`,
                  background: copied ? '#F0FDF4' : '#F9FAFB',
                  color: copied ? '#16A34A' : '#374151', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'all 200ms',
                }}>
                  {copied ? <CheckCircle2 size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={2} />}
                  {copied ? 'Copied!' : 'Copy ID'}
                </button>
              </div>

              {/* Enable / Disable */}
              <button onClick={() => { onToggle(qr.code, qr.active); onClose(); }} disabled={toggling === qr.code} style={{
                padding: '9px 0', borderRadius: 10,
                border: `1px solid ${qr.active ? '#FECACA' : '#BBF7D0'}`,
                background: qr.active ? '#FEF2F2' : '#F0FDF4',
                color: qr.active ? '#DC2626' : '#16A34A',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                {qr.active
                  ? <><PauseCircle size={13} strokeWidth={2} /> Disable QR</>
                  : <><PlayCircle  size={13} strokeWidth={2} /> Enable QR</>}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status badge (table) ─────────────────────────────────────────────────────

function StatusBadge({ qr }: { qr: QRCodeRecord }) {
  const m = statusMeta(qr);
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: m.bg, color: m.color, fontWeight: 700, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const m = typeMeta(type);
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: m.bg, color: m.color, fontWeight: 700, border: `1px solid ${m.border}`, whiteSpace: 'nowrap' }}>
      {type}
    </span>
  );
}

// ─── Input style ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '10px 13px', borderRadius: 10, fontSize: 12,
  background: '#F9FAFB', border: '1.5px solid #E5E7EB',
  color: '#1A1A1A', outline: 'none', boxSizing: 'border-box', flex: 1, minWidth: 120,
  fontFamily: 'system-ui,-apple-system,sans-serif', transition: 'border-color 150ms',
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function QRSearch() {
  const [filters,   setFilters]   = useState<QRSearchFilters>({ qrId: '', batch: '', status: '' });
  const [results,   setResults]   = useState<QRCodeRecord[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [searched,  setSearched]  = useState(false);
  const [toggling,  setToggling]  = useState<string | null>(null);
  const [preview,   setPreview]   = useState<{ qr: QRCodeRecord; dataUrl: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true); setSearched(true);
    try { setResults(await searchQRCodes(filters)); }
    finally { setLoading(false); }
  };

  const handleToggle = async (code: string, currentActive: boolean) => {
    setToggling(code);
    try {
      await setQRActive(code, !currentActive);
      setResults(r => r.map(q => q.code === code ? { ...q, active: !currentActive } : q));
    } finally { setToggling(null); }
  };

  const handleView = useCallback(async (qr: QRCodeRecord) => {
    setLoadingQr(qr.code);
    try {
      const dataUrl = await generateQRDataUrl(qr);
      setPreview({ qr, dataUrl });
    } finally { setLoadingQr(null); }
  }, []);

  const handleDownloadDirect = useCallback(async (qr: QRCodeRecord) => {
    setLoadingQr(qr.code);
    try {
      const dataUrl = await generateQRDataUrl(qr);
      downloadBlob(dataUrl, `${qr.code}.png`);
    } finally { setLoadingQr(null); }
  }, []);

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>QR Search</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Find, preview and manage individual QR codes</p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

        {/* Search bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <input style={inputStyle} placeholder="Search by QR ID…"
            value={filters.qrId} onChange={e => setFilters(f => ({ ...f, qrId: e.target.value }))}
            onFocus={e => (e.target.style.borderColor = RED)}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <input style={inputStyle} placeholder="Search by Batch…"
            value={filters.batch} onChange={e => setFilters(f => ({ ...f, batch: e.target.value }))}
            onFocus={e => (e.target.style.borderColor = RED)}
            onBlur={e  => (e.target.style.borderColor = '#E5E7EB')}
            onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          <select style={{ ...inputStyle, cursor: 'pointer', minWidth: 140 }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value as any }))}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="exhausted">Exhausted</option>
          </select>
          <button onClick={handleSearch} disabled={loading} style={{
            background: loading ? '#F3F4F6' : `linear-gradient(135deg,${RED},#B51218)`,
            color: loading ? '#9CA3AF' : '#fff', border: 'none', borderRadius: 10,
            padding: '10px 20px', fontSize: 12, fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            boxShadow: loading ? 'none' : `0 2px 8px ${RED}30`,
          }}>
            {loading
              ? <span style={{ width: 13, height: 13, border: '2px solid #D1D5DB', borderTopColor: RED, borderRadius: '50%', animation: 'srchspin 0.7s linear infinite', display: 'inline-block' }} />
              : <Search size={14} strokeWidth={2.5} />}
            {loading ? '…' : 'Search'}
          </button>
        </div>

        {/* Results */}
        {searched && !loading && (
          results.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <QrCodeIcon size={32} color="#E5E7EB" style={{ marginBottom: 10 }} />
              <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>No QR codes found. Try a different search.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}{results.length > 50 ? ' (showing first 50)' : ''}
                </span>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      {['QR Code ID', 'Type', 'Status', 'Batch', 'Created', 'Scans', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 50).map((qr, i) => (
                      <tr
                        key={qr.id}
                        style={{ borderBottom: i < Math.min(results.length, 50) - 1 ? '1px solid #F3F4F6' : 'none', transition: 'background 100ms' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FFFBFB')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* QR Code ID */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#1A1A1A', fontSize: 12 }}>{qr.code}</span>
                        </td>

                        {/* Type */}
                        <td style={{ padding: '10px 12px' }}>
                          <TypeBadge type={qr.type} />
                        </td>

                        {/* Status */}
                        <td style={{ padding: '10px 12px' }}>
                          <StatusBadge qr={qr} />
                        </td>

                        {/* Batch */}
                        <td style={{ padding: '10px 12px', color: '#9CA3AF', fontFamily: 'monospace', fontSize: 10, whiteSpace: 'nowrap' }}>
                          {qr.batch ? qr.batch.replace('BATCH-', 'B-') : '—'}
                        </td>

                        {/* Created */}
                        <td style={{ padding: '10px 12px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                          {fmtDate(qr.createdAt)}
                        </td>

                        {/* Scans */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: qr.playCount > 0 ? '#1A1A1A' : '#9CA3AF' }}>
                              {qr.playCount}
                            </span>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>
                              / {qr.maxPlays >= 999999 ? '∞' : qr.maxPlays}
                            </span>
                            {qr.playCount > 0 && qr.maxPlays < 999999 && (
                              <div style={{ flex: 1, minWidth: 36, height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: 2,
                                  width: `${Math.min(100, (qr.playCount / qr.maxPlays) * 100)}%`,
                                  background: qr.playCount >= qr.maxPlays ? '#DC2626' : RED,
                                  transition: 'width 300ms ease',
                                }} />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {/* View / Preview */}
                            <IconBtn
                              icon={loadingQr === qr.code
                                ? <span style={{ width: 13, height: 13, border: '2px solid #D1D5DB', borderTopColor: RED, borderRadius: '50%', animation: 'srchspin 0.7s linear infinite', display: 'inline-block' }} />
                                : <Eye size={15} strokeWidth={2} />}
                              tooltip="View QR"
                              onClick={() => handleView(qr)}
                              disabled={loadingQr === qr.code}
                            />

                            {/* Download */}
                            <IconBtn
                              icon={<Download size={15} strokeWidth={2} />}
                              tooltip="Download PNG"
                              onClick={() => handleDownloadDirect(qr)}
                              disabled={loadingQr === qr.code}
                            />

                            {/* Enable / Disable toggle */}
                            <IconBtn
                              icon={toggling === qr.code
                                ? <span style={{ width: 13, height: 13, border: `2px solid ${qr.active ? '#FCA5A5' : '#86EFAC'}`, borderTopColor: qr.active ? '#DC2626' : '#16A34A', borderRadius: '50%', animation: 'srchspin 0.7s linear infinite', display: 'inline-block' }} />
                                : qr.active
                                  ? <PauseCircle size={15} strokeWidth={2} />
                                  : <PlayCircle  size={15} strokeWidth={2} />}
                              tooltip={qr.active ? 'Disable QR' : 'Enable QR'}
                              onClick={() => handleToggle(qr.code, qr.active)}
                              danger={qr.active}
                              success={!qr.active}
                              disabled={toggling === qr.code}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {results.length > 50 && (
                <p style={{ fontSize: 11, color: '#9CA3AF', margin: '10px 0 0', textAlign: 'center' }}>
                  Showing 50 of {results.length} results — refine your search to see more.
                </p>
              )}
            </>
          )
        )}
      </div>

      {/* QR Preview Modal */}
      {preview && (
        <QRPreviewModal
          qr={preview.qr}
          dataUrl={preview.dataUrl}
          onClose={() => setPreview(null)}
          onToggle={handleToggle}
          toggling={toggling}
        />
      )}

      <style>{`@keyframes srchspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
