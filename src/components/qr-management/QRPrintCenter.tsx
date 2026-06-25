import React, { useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import type { QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { writeOpLog } from '../../services/qr/qrManagementService';

const RED  = '#D71920';
const BASE = 'https://skm-egg-runner.vercel.app';

type PrintFilter = 'all' | 'regular' | 'golden' | 'campaign' | 'developer';

const FILTER_LABELS: Record<PrintFilter, string> = {
  all: 'All QR', regular: 'Regular Only', golden: 'Golden Only',
  campaign: 'Campaign Only', developer: 'Developer Only',
};

async function makeQRDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(`${BASE}/?qr=${code}`, {
    width: 200, margin: 1,
    color: { dark: '#1a0000', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  });
}

async function printQRCodes(codes: QRCodeRecord[], actor: string): Promise<void> {
  const PER_ROW = 3; const PER_PAGE = 9;
  const items = await Promise.all(codes.map(async (qr, idx) => ({
    code: qr.code, type: qr.type,
    isDev: qr.type.toLowerCase() === 'developer',
    sheetNum: Math.floor(idx / PER_PAGE) + 1,
    dataUrl: await makeQRDataUrl(qr.code),
  })));
  const pages: (typeof items)[] = [];
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));

  const rows = (page: typeof items, pi: number) => {
    const rowHtml: string[] = [];
    for (let r = 0; r < page.length; r += PER_ROW) {
      const cells = page.slice(r, r + PER_ROW);
      rowHtml.push(`<tr>${cells.map(item => `
        <td style="padding:14px 10px;text-align:center;vertical-align:top;width:33.33%">
          <div style="display:inline-block;border:1.5px solid #eee;border-radius:12px;padding:12px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <img src="${item.dataUrl}" width="160" height="160" style="display:block;margin:0 auto 10px;border-radius:6px"/>
            <div style="font-size:13px;font-weight:900;font-family:monospace;color:#111;margin-bottom:4px;letter-spacing:1px">${item.code}</div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:3px 10px;border-radius:20px;display:inline-block;background:${item.isDev ? 'rgba(139,0,0,0.08)' : 'rgba(215,25,32,0.07)'};color:${item.isDev ? '#8B0000' : '#D71920'}">${item.type}${item.isDev ? ' · Unlimited' : ''}</div>
            <div style="font-size:9px;color:#bbb;margin-top:6px">Sheet ${pi + 1}</div>
          </div>
        </td>`).join('')}</tr>`);
    }
    return rowHtml.join('');
  };

  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>SKM QR Codes</title>
    <style>@page{size:A4 portrait;margin:14mm}body{font-family:system-ui,sans-serif;margin:0}.page{page-break-after:always}.page:last-child{page-break-after:avoid}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #D71920;padding-bottom:8px;margin-bottom:16px}.header-title{font-size:16px;font-weight:900;color:#D71920}.header-meta{font-size:9px;color:#888;text-align:right}table{width:100%;border-collapse:collapse}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    </head><body>
    ${pages.map((page, pi) => `<div class="page"><div class="header"><div class="header-title">SKM QR Code Sheet</div><div class="header-meta">Page ${pi + 1} / ${pages.length}<br/>${date}<br/>Admin: ${actor}</div></div><table>${rows(page, pi)}</table></div>`).join('')}
    </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Allow pop-ups for this site to print QR codes.'); return; }
  win.document.write(html); win.document.close(); win.focus();
  setTimeout(() => win.print(), 800);
  await writeOpLog('print', 'mixed', codes.length, actor);
}

interface Props { codes: QRCodeRecord[]; actor: string; }

export default function QRPrintCenter({ codes, actor }: Props) {
  const [filter,   setFilter]   = useState<PrintFilter>('all');
  const [printing, setPrinting] = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);

  const filtered = filter === 'all' ? codes : codes.filter(c => c.type.toLowerCase() === filter);

  const handlePrint = async () => {
    if (!filtered.length) { setMsg('No QR codes match the selected filter.'); return; }
    setPrinting(true); setMsg(null);
    try { await printQRCodes(filtered, actor); setMsg(`Print dialog opened for ${filtered.length} QR codes.`); }
    catch (e: any) { setMsg(e?.message ?? 'Print failed.'); }
    finally { setPrinting(false); }
  };

  const isError = msg?.includes('fail') || msg?.includes('No QR');

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>PDF Print Center</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Generate A4 print sheets for packaging and production</p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {(Object.keys(FILTER_LABELS) as PrintFilter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              border: filter === f ? 'none' : '1px solid #E5E7EB', cursor: 'pointer', transition: 'all 150ms',
              background: filter === f ? RED : '#F9FAFB',
              color:      filter === f ? '#fff' : '#6B7280',
              boxShadow:  filter === f ? `0 2px 8px ${RED}30` : 'none',
            }}>{FILTER_LABELS[f]}</button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
            {filtered.length} QR code{filtered.length !== 1 ? 's' : ''} selected
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>·</span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            {Math.ceil(filtered.length / 9)} A4 page{Math.ceil(filtered.length / 9) !== 1 ? 's' : ''}, 9 per page
          </span>
        </div>

        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: isError ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${isError ? '#FECACA' : '#BBF7D0'}` }}>
            <p style={{ color: isError ? '#DC2626' : '#15803D', fontSize: 12, fontWeight: 600, margin: 0 }}>{msg}</p>
          </div>
        )}

        <button onClick={handlePrint} disabled={printing || !filtered.length} style={{
          background: printing || !filtered.length ? '#F3F4F6' : `linear-gradient(135deg,${RED},#B51218)`,
          color: printing || !filtered.length ? '#9CA3AF' : '#fff',
          border: 'none', borderRadius: 12, padding: '12px 28px',
          fontSize: 13, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
          cursor: printing || !filtered.length ? 'not-allowed' : 'pointer',
          boxShadow: printing || !filtered.length ? 'none' : `0 4px 16px ${RED}30`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {printing
            ? <span style={{ width: 14, height: 14, border: '2px solid #D1D5DB', borderTopColor: RED, borderRadius: '50%', animation: 'pcspin 0.7s linear infinite', display: 'inline-block' }} />
            : <Printer size={15} strokeWidth={2} />}
          {printing ? 'Generating…' : 'Print All QR'}
        </button>

        <p style={{ fontSize: 10, color: '#9CA3AF', margin: '10px 0 0', lineHeight: 1.6 }}>
          Opens a print-ready A4 sheet · 9 QR per page · suitable for packaging and production
        </p>
      </div>
      <style>{`@keyframes pcspin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
