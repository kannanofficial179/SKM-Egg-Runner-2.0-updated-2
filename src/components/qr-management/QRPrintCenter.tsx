import React, { useState, useRef } from 'react';
import QRCode from 'qrcode';
import type { QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { writeOpLog } from '../../services/qr/qrManagementService';

const RED  = '#D71920';
const BASE = 'https://skm-egg-runner.vercel.app';

type PrintFilter = 'all' | 'regular' | 'golden' | 'campaign' | 'developer';

const FILTER_LABELS: Record<PrintFilter, string> = {
  all:       'All QR',
  regular:   'Regular Only',
  golden:    'Golden Only',
  campaign:  'Campaign Only',
  developer: 'Developer Only',
};

// ── Generate a data URL for one QR (encodes the full URL) ────────────────────
async function makeQRDataUrl(code: string): Promise<string> {
  const url = `${BASE}/?qr=${code}`;
  return QRCode.toDataURL(url, {
    width: 200, margin: 1,
    color: { dark: '#1a0000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
}

// ── Build and open a print window with a multi-page A4 layout ────────────────
async function printQRCodes(
  codes: QRCodeRecord[],
  actor: string,
): Promise<void> {
  const PER_ROW = 3;
  const PER_PAGE = 9;

  // Render all QR images first
  const items = await Promise.all(
    codes.map(async qr => ({
      code:     qr.code,
      type:     qr.type,
      batch:    qr.batch || '—',
      maxPlays: qr.maxPlays >= 999999 ? 'Unlimited' : String(qr.maxPlays),
      dataUrl:  await makeQRDataUrl(qr.code),
    }))
  );

  // Build pages
  const pages: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) {
    pages.push(items.slice(i, i + PER_PAGE));
  }

  const rows = (page: typeof items) => {
    const rowHtml: string[] = [];
    for (let r = 0; r < page.length; r += PER_ROW) {
      const cells = page.slice(r, r + PER_ROW);
      const cellsHtml = cells.map(item => `
        <td style="padding:10px;text-align:center;vertical-align:top;width:33.33%">
          <img src="${item.dataUrl}" width="160" height="160" style="display:block;margin:0 auto 6px;border:1px solid #eee;border-radius:6px"/>
          <div style="font-size:11px;font-weight:700;font-family:monospace;color:#111;margin-bottom:2px">${item.code}</div>
          <div style="font-size:9px;color:#D71920;font-weight:700;text-transform:uppercase;letter-spacing:1px">${item.type}</div>
          <div style="font-size:9px;color:#888;margin-top:2px">Max: ${item.maxPlays} · Batch: ${item.batch}</div>
        </td>
      `).join('');
      rowHtml.push(`<tr>${cellsHtml}</tr>`);
    }
    return rowHtml.join('');
  };

  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>SKM QR Codes</title>
    <style>
      @page { size: A4 portrait; margin: 14mm; }
      body { font-family: system-ui,sans-serif; margin: 0; }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      .header { display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #D71920; padding-bottom:8px; margin-bottom:16px; }
      .header-title { font-size:16px; font-weight:900; color:#D71920; }
      .header-meta  { font-size:9px; color:#888; text-align:right; }
      table { width:100%; border-collapse:collapse; }
      @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
    </style>
  </head><body>
    ${pages.map((page, pi) => `
      <div class="page">
        <div class="header">
          <div class="header-title">▦ SKM QR Code Sheet</div>
          <div class="header-meta">Page ${pi + 1} / ${pages.length}<br/>${date}<br/>Admin: ${actor}</div>
        </div>
        <table>${rows(page)}</table>
      </div>
    `).join('')}
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Allow pop-ups for this site to print QR codes.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 800);

  await writeOpLog('print', 'mixed', codes.length, actor);
}

interface Props {
  codes:  QRCodeRecord[];
  actor:  string;
}

export default function QRPrintCenter({ codes, actor }: Props) {
  const [filter,   setFilter]   = useState<PrintFilter>('all');
  const [printing, setPrinting] = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);

  const filtered = filter === 'all'
    ? codes
    : codes.filter(c => c.type.toLowerCase() === filter);

  const handlePrint = async () => {
    if (!filtered.length) { setMsg('No QR codes match the selected filter.'); return; }
    setPrinting(true);
    setMsg(null);
    try {
      await printQRCodes(filtered, actor);
      setMsg(`Print dialog opened for ${filtered.length} QR codes.`);
    } catch (e: any) {
      setMsg(e?.message ?? 'Print failed.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        PDF Print Center
      </h2>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)',
        borderRadius: 18, padding: 20,
      }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(Object.keys(FILTER_LABELS) as PrintFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                border: 'none', cursor: 'pointer', transition: 'all 150ms',
                background: filter === f ? RED : 'rgba(255,255,255,0.07)',
                color: filter === f ? '#fff' : 'rgba(255,255,255,0.55)',
                boxShadow: filter === f ? `0 4px 12px ${RED}44` : 'none',
              }}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Info row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            {filtered.length} QR code{filtered.length !== 1 ? 's' : ''} selected
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            {Math.ceil(filtered.length / 9)} A4 page{Math.ceil(filtered.length / 9) !== 1 ? 's' : ''}, 9 per page
          </span>
        </div>

        {msg && (
          <p style={{ fontSize: 12, fontWeight: 600, color: msg.includes('fail') || msg.includes('No QR') ? '#f87171' : '#4ade80', margin: '0 0 14px' }}>
            {msg}
          </p>
        )}

        <button
          onClick={handlePrint}
          disabled={printing || filtered.length === 0}
          style={{
            background: printing || !filtered.length
              ? 'rgba(215,25,32,0.3)'
              : `linear-gradient(135deg,${RED},#8B0000)`,
            color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px',
            fontSize: 13, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
            cursor: printing || !filtered.length ? 'not-allowed' : 'pointer',
            boxShadow: printing ? 'none' : '0 4px 16px rgba(215,25,32,0.4)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {printing && (
            <span style={{
              width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff', borderRadius: '50%',
              animation: 'pcspin 0.7s linear infinite', display: 'inline-block',
            }} />
          )}
          {printing ? 'Generating…' : '🖨 Print All QR'}
        </button>

        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '10px 0 0', lineHeight: 1.6 }}>
          Opens a print-ready A4 sheet · 9 QR per page · includes code, type, batch and max plays
        </p>
      </div>

      <style>{`@keyframes pcspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
