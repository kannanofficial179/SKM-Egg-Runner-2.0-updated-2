import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import QRCode from 'qrcode';
import {
  Archive, FileText, Table2, FileSpreadsheet, HardDrive,
  Download, X, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import type { QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { exportCSV, exportExcel, exportBackupJSON, writeOpLog } from '../../services/qr/qrManagementService';

const RED    = '#D71920';
const SAFE   = '#16A34A';
const DANGER = '#DC2626';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }

function inferBatchName(codes: QRCodeRecord[]): string {
  if (!codes.length) return 'Batch';
  const b = codes[0].batch ?? '';
  // Readable batch names like "Batch 12" come through directly;
  // raw BATCH-timestamp IDs get prettified
  if (/^Batch\s+\d+$/i.test(b)) return b;
  if (b.startsWith('BATCH-')) return `Batch ${b.replace('BATCH-', '')}`;
  return b || 'Batch';
}

function safeFilename(name: string) { return name.replace(/[^a-zA-Z0-9_-]/g, '_'); }

/** Render a QR code to a canvas data-URL at the given pixel size. */
async function renderQR(url: string, size: number, type: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: size, margin: 1, errorCorrectionLevel: 'H',
    color: { dark: type === 'Golden' ? '#92400E' : '#0A0000', light: '#FFFFFF' },
  });
}

/** Yield to the event loop so the browser stays responsive between heavy operations. */
const tick = () => new Promise<void>(r => setTimeout(r, 0));

// ─── Progress Modal ───────────────────────────────────────────────────────────

type ExportPhase = 'idle' | 'working' | 'done' | 'error';

interface ProgressState {
  phase:    ExportPhase;
  step:     string;
  pct:      number;
  error:    string;
  blobUrl:  string;
  filename: string;
}

function ProgressModal({
  state, onClose,
}: { state: ProgressState; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  React.useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t); }, []);

  const close = () => { setVisible(false); setTimeout(onClose, 250); };

  const isWorking = state.phase === 'working';
  const isDone    = state.phase === 'done';
  const isError   = state.phase === 'error';

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
      padding: 20,
      opacity: visible ? 1 : 0, transition: 'opacity 250ms ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: '#FFFFFF',
        borderRadius: 22, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(215,25,32,0.1)',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
        transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Top accent */}
        <div style={{
          height: 3, background: isDone ? `linear-gradient(90deg,${SAFE},#22C55E)` : isError ? `linear-gradient(90deg,${DANGER},#EF4444)` : `linear-gradient(90deg,${RED},#FF4D4D,${RED})`,
          backgroundSize: '200% auto',
          animation: isWorking ? 'expGrad 1.5s linear infinite' : 'none',
        }} />

        <div style={{ padding: '28px 28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

          {/* Icon */}
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: isDone ? '#F0FDF4' : isError ? '#FEF2F2' : `${RED}0D`,
            border: `1px solid ${isDone ? '#BBF7D0' : isError ? '#FECACA' : `${RED}25`}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: isWorking ? 'none' : isDone ? 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
          }}>
            {isWorking && <Loader2 size={26} color={RED} style={{ animation: 'expSpin 0.9s linear infinite' }} />}
            {isDone    && <CheckCircle2 size={26} color={SAFE} strokeWidth={2.5} />}
            {isError   && <AlertCircle  size={26} color={DANGER} strokeWidth={2.5} />}
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', margin: '0 0 4px' }}>
              {isWorking ? 'Preparing Export…' : isDone ? 'Export Complete' : 'Export Failed'}
            </h3>
            <p style={{ fontSize: 12, color: isError ? DANGER : '#6B7280', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
              {isError ? state.error : isWorking ? state.step : 'Your file is ready for download.'}
            </p>
          </div>

          {/* Progress bar */}
          {isWorking && (
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{state.step}</span>
                <span style={{ fontSize: 11, fontWeight: 800, color: RED }}>{state.pct}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 6, background: '#F3F4F6', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 6,
                  background: `linear-gradient(90deg,${RED},#FF4D4D)`,
                  width: `${state.pct}%`, transition: 'width 350ms ease',
                  backgroundSize: '200% auto', animation: 'expGrad 1.5s linear infinite',
                }} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            {isDone && state.blobUrl && (
              <a
                href={state.blobUrl}
                download={state.filename}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12,
                  background: `linear-gradient(135deg,${RED},#B51218)`, color: '#fff',
                  fontWeight: 800, fontSize: 13, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: `0 4px 14px ${RED}30`,
                }}
              >
                <Download size={14} strokeWidth={2.5} /> Download
              </a>
            )}
            {(isDone || isError) && (
              <button
                onClick={close}
                style={{
                  flex: isDone && state.blobUrl ? '0 0 auto' : 1,
                  padding: '12px 20px', borderRadius: 12,
                  background: '#F3F4F6', border: '1px solid #E5E7EB',
                  color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                <X size={14} /> Close
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes expGrad { to { background-position: 200% center; } }
        @keyframes expSpin { to { transform: rotate(360deg); } }
        @keyframes popIn   { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>,
    document.body,
  );
}

// ─── Pure-JS ZIP builder ──────────────────────────────────────────────────────
// Implements the ZIP local file + central directory format from spec.
// No external library — runs in the browser using Uint8Array.

class ZipBuilder {
  private files: Array<{ name: string; data: Uint8Array; crc: number; date: number }> = [];

  private crc32(buf: Uint8Array): number {
    const table = ZipBuilder.crcTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
    return (~crc) >>> 0;
  }

  private static _table: number[] | null = null;
  private static crcTable(): number[] {
    if (ZipBuilder._table) return ZipBuilder._table;
    const t: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return ZipBuilder._table = t;
  }

  private dosDate(): number {
    const d = new Date();
    return ((d.getFullYear() - 1980) << 25) | ((d.getMonth() + 1) << 21) | (d.getDate() << 16) |
           (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  }

  private u32(n: number): number[] { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF]; }
  private u16(n: number): number[] { return [n & 0xFF, (n >> 8) & 0xFF]; }

  addFile(name: string, data: Uint8Array) {
    this.files.push({ name, data, crc: this.crc32(data), date: this.dosDate() });
  }

  addText(name: string, text: string) {
    this.addFile(name, new TextEncoder().encode(text));
  }

  build(): Uint8Array {
    const enc = new TextEncoder();
    const parts: Uint8Array[] = [];
    const offsets: number[] = [];
    let offset = 0;

    // Local file entries
    for (const f of this.files) {
      offsets.push(offset);
      const nameBytes = enc.encode(f.name);
      const header = [
        0x50, 0x4B, 0x03, 0x04,      // signature
        0x14, 0x00,                   // version needed
        0x00, 0x00,                   // flags
        0x00, 0x00,                   // compression (stored)
        ...this.u32(f.date),          // mod date+time (4 bytes)
        ...this.u32(f.crc),
        ...this.u32(f.data.length),   // compressed
        ...this.u32(f.data.length),   // uncompressed
        ...this.u16(nameBytes.length),
        0x00, 0x00,                   // extra field length
      ];
      const localEntry = new Uint8Array(header.length + nameBytes.length + f.data.length);
      localEntry.set(header, 0);
      localEntry.set(nameBytes, header.length);
      localEntry.set(f.data, header.length + nameBytes.length);
      parts.push(localEntry);
      offset += localEntry.length;
    }

    // Central directory
    const cdParts: Uint8Array[] = [];
    let cdSize = 0;
    for (let i = 0; i < this.files.length; i++) {
      const f = this.files[i];
      const nameBytes = enc.encode(f.name);
      const cd = [
        0x50, 0x4B, 0x01, 0x02,     // signature
        0x14, 0x00,                  // version made by
        0x14, 0x00,                  // version needed
        0x00, 0x00,                  // flags
        0x00, 0x00,                  // compression
        ...this.u32(f.date),
        ...this.u32(f.crc),
        ...this.u32(f.data.length),
        ...this.u32(f.data.length),
        ...this.u16(nameBytes.length),
        0x00, 0x00,                  // extra
        0x00, 0x00,                  // comment
        0x00, 0x00,                  // disk start
        0x00, 0x00,                  // int attribs
        0x00, 0x00, 0x00, 0x00,     // ext attribs
        ...this.u32(offsets[i]),
      ];
      const entry = new Uint8Array(cd.length + nameBytes.length);
      entry.set(cd, 0); entry.set(nameBytes, cd.length);
      cdParts.push(entry);
      cdSize += entry.length;
    }

    // End of central directory
    const eocd = [
      0x50, 0x4B, 0x05, 0x06,
      0x00, 0x00, 0x00, 0x00,
      ...this.u16(this.files.length),
      ...this.u16(this.files.length),
      ...this.u32(cdSize),
      ...this.u32(offset),
      0x00, 0x00,
    ];

    const total = parts.reduce((s, p) => s + p.length, 0) +
                  cdParts.reduce((s, p) => s + p.length, 0) + eocd.length;
    const out = new Uint8Array(total);
    let pos = 0;
    [...parts, ...cdParts].forEach(p => { out.set(p, pos); pos += p.length; });
    out.set(eocd, pos);
    return out;
  }
}

// ─── Pure canvas → PDF export (no print dialog, no external library) ──────────
//
// Strategy: render each A4 page onto an offscreen canvas (2480×3508 px @ 300dpi),
// then encode the canvas pixels as a PDF with embedded JPEG images.
// PDF spec used: minimal cross-reference table, one image XObject per page.
// The result is a real .pdf file that downloads directly — no dialog.

const A4_W_PX  = 2480;  // A4 @ 300 dpi
const A4_H_PX  = 3508;
const COLS      = 4;
const ROWS      = 5;
const PER_PAGE  = COLS * ROWS;  // 20 QR codes per page

/** Draw one A4 page onto a canvas and return it as a JPEG Uint8Array. */
async function renderPageToJpeg(
  codes: QRCodeRecord[],
  dataUrls: string[],
  pageIdx: number,
  batchName: string,
  actor: string,
  totalPages: number,
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width  = A4_W_PX;
  canvas.height = A4_H_PX;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, A4_W_PX, A4_H_PX);

  const M  = 80;   // page margin px
  const IW = A4_W_PX - M * 2;

  // ── Header ──
  const headerH = 120;
  ctx.fillStyle = '#D71920';
  ctx.fillRect(M, M, IW, 4);

  ctx.fillStyle = '#1A1A1A';
  ctx.font = 'bold 52px system-ui,sans-serif';
  ctx.fillText('SKM QR Management', M, M + 70);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '36px system-ui,sans-serif';
  ctx.fillText(`${batchName}  ·  Generated by ${actor}  ·  Page ${pageIdx + 1} / ${totalPages}`, M, M + 110);

  // ── QR grid ──
  const gridTop  = M + headerH + 20;
  const gridH    = A4_H_PX - gridTop - M - 80;
  const cellW    = Math.floor(IW / COLS);
  const cellH    = Math.floor(gridH / ROWS);
  const qrSize   = Math.min(cellW, cellH) - 80;

  const startIdx = pageIdx * PER_PAGE;
  const slice    = codes.slice(startIdx, startIdx + PER_PAGE);

  for (let i = 0; i < slice.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx  = M + col * cellW;
    const cy  = gridTop + row * cellH;
    const c   = slice[i];
    const imgUrl = dataUrls[startIdx + i];

    // Cell border
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(cx + 8, cy + 8, cellW - 16, cellH - 16, 16);
    ctx.stroke();

    // QR image
    if (imgUrl) {
      await new Promise<void>(resolve => {
        const img = new Image();
        img.onload  = () => {
          const ix = cx + Math.floor((cellW - qrSize) / 2);
          const iy = cy + 24;
          ctx.drawImage(img, ix, iy, qrSize, qrSize);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = imgUrl;
      });
    }

    // Code text
    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 28px monospace,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.code, cx + cellW / 2, cy + 28 + qrSize + 36, cellW - 20);

    // Meta text
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '22px system-ui,sans-serif';
    const meta = `${c.type} · ${c.maxPlays === 999999 ? '∞' : c.maxPlays} plays`;
    ctx.fillText(meta, cx + cellW / 2, cy + 28 + qrSize + 66, cellW - 20);

    ctx.textAlign = 'left';
  }

  // ── Footer ──
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  ctx.fillStyle = '#E5E7EB';
  ctx.fillRect(M, A4_H_PX - M - 60, IW, 2);

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '28px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${date}  ·  ${codes.length} QR Codes  ·  Confidential — SKM`, A4_W_PX / 2, A4_H_PX - M - 20);
  ctx.textAlign = 'left';

  // Export canvas to JPEG bytes
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = jpegDataUrl.split(',')[1];
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
  return bytes;
}

/** Assemble a minimal valid PDF from an array of JPEG page images. */
function buildPdfFromJpegs(pages: Uint8Array[]): Uint8Array {
  const enc = (s: string) => new TextEncoder().encode(s);

  const parts: Uint8Array[] = [];
  const offsets: number[]   = [];
  let   pos = 0;

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === 'string' ? enc(data) : data;
    parts.push(bytes);
    pos += bytes.length;
  };

  // Header
  push('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  const pageCount = pages.length;
  // Object IDs:
  //   1 = catalog, 2 = pages, 3+(3n) = page n, 4+(3n) = image XObject n, 5+(3n) = resources dict ref (inline)
  // Simpler flat layout: 1=catalog, 2=pages, then per page: image obj, page obj

  const imgObjIds:  number[] = [];
  const pageObjIds: number[] = [];
  let objId = 3;

  for (let i = 0; i < pageCount; i++) {
    const jpeg = pages[i];
    imgObjIds.push(objId);

    offsets[objId] = pos;
    push(`${objId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${A4_W_PX} /Height ${A4_H_PX} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream\nendobj\n');
    objId++;

    pageObjIds.push(objId);
    const imgId = imgObjIds[i];
    offsets[objId] = pos;
    push(`${objId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W_PX} ${A4_H_PX}] /Resources << /XObject << /Im${i} ${imgId} 0 R >> >> /Contents ${objId + 1} 0 R >>\nendobj\n`);
    objId++;

    // Content stream: draw image covering full page
    const content = `q ${A4_W_PX} 0 0 ${A4_H_PX} 0 0 cm /Im${i} Do Q`;
    const contentBytes = enc(content);
    offsets[objId] = pos;
    push(`${objId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    push('\nendstream\nendobj\n');
    objId++;
  }

  // Pages object (id=2)
  const pagesRef = pageObjIds.map(id => `${id} 0 R`).join(' ');
  offsets[2] = pos;
  push(`2 0 obj\n<< /Type /Pages /Kids [${pagesRef}] /Count ${pageCount} >>\nendobj\n`);

  // Catalog (id=1)
  offsets[1] = pos;
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // Cross-reference table
  const xrefOffset = pos;
  const totalObjs  = objId;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (let i = 1; i < totalObjs; i++) {
    xref += String(offsets[i] ?? 0).padStart(10, '0') + ' 00000 n \n';
  }
  push(xref);
  push(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  // Concatenate all parts
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out   = new Uint8Array(total);
  let   off2  = 0;
  for (const p of parts) { out.set(p, off2); off2 += p.length; }
  return out;
}

// ─── Export functions ─────────────────────────────────────────────────────────

async function exportAsPDF(
  codes: QRCodeRecord[],
  batchName: string,
  actor: string,
  onProgress: (pct: number, step: string) => void,
  onDone: (blobUrl: string, filename: string) => void,
  onError: (msg: string) => void,
) {
  try {
    const totalPages = Math.ceil(codes.length / PER_PAGE);

    // Step 1: render all QR data-URLs
    onProgress(3, 'Rendering QR codes…');
    const dataUrls: string[] = [];
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      const url = (c as any).url ?? `https://skm-egg-runner.vercel.app/?qr=${c.code}`;
      try { dataUrls.push(await renderQR(url, 200, c.type)); }
      catch { dataUrls.push(''); }
      if (i % 10 === 9 || i === codes.length - 1) {
        onProgress(3 + Math.round(((i + 1) / codes.length) * 55), `Rendering QR codes… (${i + 1}/${codes.length})`);
        await tick();
      }
    }

    // Step 2: render each page canvas → JPEG
    onProgress(60, 'Composing pages…');
    const jpegPages: Uint8Array[] = [];
    for (let p = 0; p < totalPages; p++) {
      onProgress(60 + Math.round((p / totalPages) * 30), `Composing page ${p + 1} / ${totalPages}…`);
      jpegPages.push(await renderPageToJpeg(codes, dataUrls, p, batchName, actor, totalPages));
      await tick();
    }

    // Step 3: assemble PDF binary
    onProgress(92, 'Building PDF…');
    await tick();
    const pdfBytes = buildPdfFromJpegs(jpegPages);

    // Step 4: create download blob
    onProgress(98, 'Finalising…');
    await tick();
    const blob     = new Blob([pdfBytes], { type: 'application/pdf' });
    const url      = URL.createObjectURL(blob);
    const filename = `SKM_${safeFilename(batchName)}_${codes.length}QR_${todayStr()}.pdf`;

    onProgress(100, 'Done');
    onDone(url, filename);
  } catch (e: any) {
    onError(e?.message ?? 'PDF generation failed. Please try again.');
  }
}

async function exportAsZIP(
  codes: QRCodeRecord[],
  batchName: string,
  actor: string,
  onProgress: (pct: number, step: string) => void,
  onDone: (blobUrl: string, filename: string) => void,
  onError: (msg: string) => void,
) {
  try {
    const zip = new ZipBuilder();
    const folderName = safeFilename(batchName);
    const total = codes.length;

    onProgress(5, 'Rendering QR images…');

    // Render QR PNGs in batches of 10 to keep browser responsive
    for (let i = 0; i < total; i++) {
      const c = codes[i];
      const url = (c as any).url ?? `https://skm-egg-runner.vercel.app/?qr=${c.code}`;
      const dataUrl = await renderQR(url, 300, c.type);

      // Convert data-URL to Uint8Array
      const base64 = dataUrl.split(',')[1];
      const binary  = atob(base64);
      const bytes   = new Uint8Array(binary.length);
      for (let b = 0; b < binary.length; b++) bytes[b] = binary.charCodeAt(b);
      zip.addFile(`${folderName}/${c.code}.png`, bytes);

      if (i % 10 === 9 || i === total - 1) {
        onProgress(5 + Math.round(((i + 1) / total) * 75), `Rendering QR images… (${i + 1}/${total})`);
        await tick();
      }
    }

    onProgress(82, 'Building manifest CSV…');
    await tick();

    // Manifest CSV
    const csvHeader = 'QR ID,Batch,QR Type,Max Plays,Status,Used Plays,Remaining,Game URL';
    const csvRows = codes.map(c => {
      const status  = !c.active ? 'Disabled' : c.playCount >= c.maxPlays ? 'Exhausted' : c.playCount > 0 ? 'In Use' : 'Available';
      const maxStr  = c.maxPlays === 999999 ? 'Unlimited' : String(c.maxPlays);
      const remStr  = c.maxPlays === 999999 ? 'Unlimited' : String(Math.max(0, c.maxPlays - c.playCount));
      const url     = (c as any).url ?? `https://skm-egg-runner.vercel.app/?qr=${c.code}`;
      return [c.code, c.batch, c.type, maxStr, status, c.playCount, remStr, url]
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
    });
    zip.addText(`${folderName}/manifest.csv`, [csvHeader, ...csvRows].join('\n'));

    onProgress(90, 'Building manifest JSON…');
    await tick();

    // Manifest JSON
    const manifest = {
      batchName,
      exportedAt:  new Date().toISOString(),
      exportedBy:  actor,
      totalCodes:  total,
      codes: codes.map(c => ({
        id:        c.id,
        code:      c.code,
        batch:     c.batch,
        type:      c.type,
        maxPlays:  c.maxPlays,
        playCount: c.playCount,
        active:    c.active,
        createdAt: c.createdAt?.toISOString?.() ?? '',
        url:       (c as any).url ?? '',
      })),
    };
    zip.addText(`${folderName}/manifest.json`, JSON.stringify(manifest, null, 2));

    onProgress(96, 'Compressing…');
    await tick();

    const bytes  = zip.build();
    const blob   = new Blob([bytes], { type: 'application/zip' });
    const url    = URL.createObjectURL(blob);
    const date   = todayStr();
    const filename = `SKM_${safeFilename(batchName)}_QR_PNG_${date}.zip`;

    onProgress(100, 'Done');
    onDone(url, filename);
  } catch (e: any) {
    onError(e?.message ?? 'ZIP generation failed. Please try again.');
  }
}

// ─── Export button ────────────────────────────────────────────────────────────

function ExportBtn({ label, icon, onClick, disabled, accent = '#F3F4F6', textColor = '#374151' }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; accent?: string; textColor?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:   disabled ? '#F9FAFB' : accent,
      border:       `1px solid ${disabled ? '#E5E7EB' : '#E5E7EB'}`,
      color:        disabled ? '#D1D5DB' : textColor,
      borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700,
      cursor:       disabled ? 'not-allowed' : 'pointer',
      display:      'flex', alignItems: 'center', gap: 7,
      transition:   'all 150ms', whiteSpace: 'nowrap',
    }}
    onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = RED; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
    >
      {icon}{label}
    </button>
  );
}

// ─── Main Export Center component ─────────────────────────────────────────────

interface Props { codes: QRCodeRecord[]; actor?: string; }

export default function QRBulkExport({ codes, actor = 'Admin' }: Props) {
  const [csvMsg, setCsvMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [modalState, setModalState] = useState<ProgressState>({ phase: 'idle', step: '', pct: 0, error: '', blobUrl: '', filename: '' });
  const blobRef = useRef<string>('');

  const flash = (text: string, ok = true) => { setCsvMsg({ text, ok }); setTimeout(() => setCsvMsg(null), 4000); };

  const updateModal = (patch: Partial<ProgressState>) =>
    setModalState(prev => ({ ...prev, ...patch }));

  const startExport = (phase: ExportPhase = 'working') => {
    // Revoke any previous blob URL to free memory
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = ''; }
    setModalState({ phase, step: 'Initialising…', pct: 0, error: '', blobUrl: '', filename: '' });
  };

  const onDone = (blobUrl: string, filename: string) => {
    blobRef.current = blobUrl;
    updateModal({ phase: 'done', blobUrl, filename, pct: 100, step: 'Complete' });
  };

  const onError = (error: string) => updateModal({ phase: 'error', error });

  const progress = (pct: number, step: string) => updateModal({ pct: Math.round(pct), step });

  const batchName = inferBatchName(codes);

  const handlePDF = () => {
    if (!codes.length) return;
    startExport('working');
    exportAsPDF(codes, batchName, actor, progress, onDone, onError);
  };

  const handleZIP = () => {
    if (!codes.length) return;
    startExport('working');
    exportAsZIP(codes, batchName, actor, progress, onDone, onError);
  };

  const handleCSV = () => {
    exportCSV(codes);
    writeOpLog('export', 'CSV', codes.length, actor).catch(() => {});
    flash(`CSV exported — ${codes.length} codes.`);
  };

  const handleExcel = () => {
    exportExcel(codes);
    writeOpLog('export', 'Excel', codes.length, actor).catch(() => {});
    flash(`Excel exported — ${codes.length} codes.`);
  };

  const handleBackup = async () => {
    try {
      const d = await exportBackupJSON();
      writeOpLog('backup', 'JSON', codes.length, actor).catch(() => {});
      flash(`Backup saved: backup-${d}.json`);
    } catch (e: any) { flash(e?.message ?? 'Backup failed.', false); }
  };

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Export Center</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>
          Download QR data in multiple formats · {codes.length} code{codes.length !== 1 ? 's' : ''} loaded
        </p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Format groups */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 8px' }}>Visual Export</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <ExportBtn
              label="Export PDF"
              icon={<FileText size={14} strokeWidth={2} />}
              onClick={handlePDF}
              disabled={!codes.length}
              accent={`${RED}0D`}
              textColor={RED}
            />
            <ExportBtn
              label="Export ZIP (PNG)"
              icon={<Archive size={14} strokeWidth={2} />}
              onClick={handleZIP}
              disabled={!codes.length}
              accent="#F5F3FF"
              textColor="#6D28D9"
            />
          </div>
          {codes.length > 0 && (
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '6px 0 0' }}>
              PDF: A4 print-ready · 4×5 grid · {Math.ceil(codes.length / 20)} page{Math.ceil(codes.length / 20) !== 1 ? 's' : ''} &nbsp;|&nbsp;
              ZIP: individual PNGs + manifest.csv + manifest.json
            </p>
          )}
        </div>

        <div style={{ height: 1, background: '#F3F4F6' }} />

        <div>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1.2, margin: '0 0 8px' }}>Data Export</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <ExportBtn label="Export CSV"   icon={<Table2          size={14} strokeWidth={2} />} onClick={handleCSV}    disabled={!codes.length} accent="#EFF6FF" textColor="#1D4ED8" />
            <ExportBtn label="Export Excel" icon={<FileSpreadsheet size={14} strokeWidth={2} />} onClick={handleExcel}  disabled={!codes.length} accent="#F0FDF4" textColor="#15803D" />
            <ExportBtn label="Backup JSON"  icon={<HardDrive       size={14} strokeWidth={2} />} onClick={handleBackup} disabled={!codes.length} accent="#FAF5FF" textColor="#6D28D9" />
          </div>
        </div>

        {csvMsg && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: csvMsg.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${csvMsg.ok ? '#BBF7D0' : '#FECACA'}` }}>
            <p style={{ color: csvMsg.ok ? SAFE : DANGER, fontSize: 12, fontWeight: 600, margin: 0 }}>{csvMsg.text}</p>
          </div>
        )}
      </div>

      {modalState.phase !== 'idle' && (
        <ProgressModal
          state={modalState}
          onClose={() => setModalState(prev => ({ ...prev, phase: 'idle' }))}
        />
      )}
    </section>
  );
}
