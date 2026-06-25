import React, { useState } from 'react';
import { Image, Archive, FileText, Table2, FileSpreadsheet, HardDrive } from 'lucide-react';
import type { QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { exportCSV, exportExcel, exportBackupJSON, writeOpLog } from '../../services/qr/qrManagementService';

const RED = '#D71920';

interface ExportBtnProps {
  label:    string;
  icon:     React.ReactNode;
  onClick:  () => void;
  disabled?: boolean;
  accent?:  string;
  textColor?: string;
}

function ExportBtn({ label, icon, onClick, disabled, accent = '#F3F4F6', textColor = '#374151' }: ExportBtnProps) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:  disabled ? '#F9FAFB' : accent,
      border:      `1px solid ${disabled ? '#E5E7EB' : '#E5E7EB'}`,
      color:       disabled ? '#D1D5DB' : textColor,
      borderRadius: 10, padding: '10px 16px', fontSize: 12, fontWeight: 700,
      cursor:      disabled ? 'not-allowed' : 'pointer',
      display:     'flex', alignItems: 'center', gap: 7,
      transition:  'all 150ms', whiteSpace: 'nowrap',
    }}
    onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.borderColor = RED; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E7EB'; }}>
      {icon}{label}
    </button>
  );
}

interface Props { codes: QRCodeRecord[]; actor?: string; }

export default function QRBulkExport({ codes, actor = 'Admin' }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [ok,  setOk]  = useState(true);

  const flash = (text: string, isOk = true) => {
    setMsg(text); setOk(isOk); setTimeout(() => setMsg(null), 4000);
  };

  const handleCSV   = () => { exportCSV(codes); writeOpLog('export', 'CSV',   codes.length, actor).catch(() => {}); flash(`CSV exported — ${codes.length} codes.`); };
  const handleExcel = () => { exportExcel(codes); writeOpLog('export', 'Excel', codes.length, actor).catch(() => {}); flash(`Excel exported — ${codes.length} codes.`); };
  const handleBackup = async () => {
    try { const d = await exportBackupJSON(); writeOpLog('backup', 'JSON', codes.length, actor).catch(() => {}); flash(`Backup saved: backup-${d}.json`); }
    catch (e: any) { flash(e?.message ?? 'Backup failed.', false); }
  };
  const notReady = (f: string) => flash(`${f} export coming soon.`);

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>Export Center</h2>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>Download QR data in multiple formats</p>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {msg && (
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 14, background: ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${ok ? '#BBF7D0' : '#FECACA'}` }}>
            <p style={{ color: ok ? '#15803D' : '#DC2626', fontSize: 12, fontWeight: 600, margin: 0 }}>{msg}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <ExportBtn label="Export PNG"   icon={<Image         size={14} strokeWidth={2} />} onClick={() => notReady('PNG')}  disabled={!codes.length} />
          <ExportBtn label="Export ZIP"   icon={<Archive       size={14} strokeWidth={2} />} onClick={() => notReady('ZIP')}  disabled={!codes.length} />
          <ExportBtn label="Export PDF"   icon={<FileText      size={14} strokeWidth={2} />} onClick={() => notReady('PDF')}  disabled={!codes.length} />
          <ExportBtn label="Export CSV"   icon={<Table2        size={14} strokeWidth={2} />} onClick={handleCSV}              disabled={!codes.length} accent="#EFF6FF" textColor="#1D4ED8" />
          <ExportBtn label="Export Excel" icon={<FileSpreadsheet size={14} strokeWidth={2} />} onClick={handleExcel}          disabled={!codes.length} accent="#F0FDF4" textColor="#15803D" />
          <ExportBtn label="Backup JSON"  icon={<HardDrive     size={14} strokeWidth={2} />} onClick={handleBackup}           disabled={!codes.length} accent="#FAF5FF" textColor="#6D28D9" />
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '12px 0 0' }}>
          {codes.length} QR code{codes.length !== 1 ? 's' : ''} loaded · CSV and Excel available immediately
        </p>
      </div>
    </section>
  );
}
