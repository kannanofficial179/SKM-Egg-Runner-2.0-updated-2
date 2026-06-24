import React, { useState } from 'react';
import type { QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { exportCSV } from '../../services/qr/qrManagementService';

const RED = '#D71920';

interface ExportBtnProps {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}

function ExportBtn({ label, icon, onClick, disabled }: ExportBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1.5px solid rgba(255,255,255,0.12)',
        color: disabled ? 'rgba(255,255,255,0.3)' : '#fff',
        borderRadius: 12,
        padding: '12px 20px',
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 150ms',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget.style.borderColor = RED); }}
      onMouseLeave={e => { (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'); }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      {label}
    </button>
  );
}

interface Props {
  codes: QRCodeRecord[];
}

export default function QRBulkExport({ codes }: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  const handleCSV = () => {
    exportCSV(codes);
    setMsg('CSV exported successfully.');
    setTimeout(() => setMsg(null), 3000);
  };

  const notImplemented = (format: string) => {
    setMsg(`${format} export coming soon.`);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <section>
      <h2 style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 14px' }}>
        Bulk Export
      </h2>

      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(215,25,32,0.18)',
        borderRadius: 18, padding: '20px',
      }}>
        {msg && (
          <p style={{ color: '#4ade80', fontSize: 12, fontWeight: 600, margin: '0 0 14px' }}>{msg}</p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <ExportBtn label="Export PNG" icon="🖼️" onClick={() => notImplemented('PNG')} />
          <ExportBtn label="Export ZIP" icon="🗜️" onClick={() => notImplemented('ZIP')} />
          <ExportBtn label="Export PDF" icon="📄" onClick={() => notImplemented('PDF')} />
          <ExportBtn label="Export CSV" icon="📊" onClick={handleCSV} disabled={codes.length === 0} />
        </div>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '12px 0 0' }}>
          {codes.length} QR code{codes.length !== 1 ? 's' : ''} loaded. CSV is available immediately; PNG/ZIP/PDF require render pipeline.
        </p>
      </div>
    </section>
  );
}
