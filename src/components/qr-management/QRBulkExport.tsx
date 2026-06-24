import React, { useState } from 'react';
import type { QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { exportCSV, exportExcel, exportBackupJSON, writeOpLog } from '../../services/qr/qrManagementService';

const RED = '#D71920';

interface ExportBtnProps {
  label:    string;
  icon:     string;
  onClick:  () => void;
  disabled?: boolean;
  accent?:  string;
}

function ExportBtn({ label, icon, onClick, disabled, accent = 'rgba(255,255,255,0.12)' }: ExportBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'rgba(255,255,255,0.03)' : accent,
        border: '1.5px solid rgba(255,255,255,0.1)',
        color: disabled ? 'rgba(255,255,255,0.25)' : '#fff',
        borderRadius: 12, padding: '11px 18px', fontSize: 12, fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 7, transition: 'all 150ms', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = RED; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {label}
    </button>
  );
}

interface Props {
  codes: QRCodeRecord[];
  actor?: string;
}

export default function QRBulkExport({ codes, actor = 'Admin' }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [ok,  setOk]  = useState(true);

  const flash = (text: string, isOk = true) => {
    setMsg(text); setOk(isOk);
    setTimeout(() => setMsg(null), 4000);
  };

  const handleCSV = () => {
    exportCSV(codes);
    writeOpLog('export', 'CSV', codes.length, actor).catch(() => {});
    flash(`CSV exported — ${codes.length} codes.`);
  };

  const handleExcel = () => {
    exportExcel(codes);
    writeOpLog('export', 'Excel', codes.length, actor).catch(() => {});
    flash(`Excel file exported — ${codes.length} codes.`);
  };

  const handleBackup = async () => {
    try {
      const date = await exportBackupJSON();
      writeOpLog('backup', 'JSON', codes.length, actor).catch(() => {});
      flash(`Backup saved: backup-${date}.json`);
    } catch (e: any) {
      flash(e?.message ?? 'Backup failed.', false);
    }
  };

  const notReady = (format: string) => flash(`${format} export coming soon.`);

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        Export Center
      </h2>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)',
        borderRadius: 18, padding: 20,
      }}>
        {msg && (
          <p style={{ color: ok ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: 600, margin: '0 0 14px' }}>{msg}</p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ExportBtn label="Export PNG"    icon="🖼️" onClick={() => notReady('PNG')}  disabled={codes.length === 0} />
          <ExportBtn label="Export ZIP"    icon="🗜️" onClick={() => notReady('ZIP')}  disabled={codes.length === 0} />
          <ExportBtn label="Export PDF"    icon="📄" onClick={() => notReady('PDF')}  disabled={codes.length === 0} />
          <ExportBtn label="Export CSV"    icon="📊" onClick={handleCSV}              disabled={codes.length === 0} accent="rgba(96,165,250,0.15)" />
          <ExportBtn label="Export Excel"  icon="📗" onClick={handleExcel}            disabled={codes.length === 0} accent="rgba(34,197,94,0.15)"  />
          <ExportBtn label="Backup JSON"   icon="💾" onClick={handleBackup}           disabled={codes.length === 0} accent="rgba(167,139,250,0.15)"/>
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', margin: '12px 0 0' }}>
          {codes.length} QR code{codes.length !== 1 ? 's' : ''} loaded. CSV and Excel are available immediately.
        </p>
      </div>
    </section>
  );
}
