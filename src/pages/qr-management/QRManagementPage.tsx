import React, { useEffect, useState, useCallback, useRef } from 'react';
import { QrCode, RefreshCw, ArrowLeft } from 'lucide-react';
import { subscribeDashboardStats, fetchAllQRCodes, EMPTY_STATS } from '../../services/qr/qrManagementService';
import type { QRDashboardStats, QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { useAuth } from '../../auth/AuthProvider';
import QRDashboard     from '../../components/qr-management/QRDashboard';
import QRGenerator     from '../../components/qr-management/QRGenerator';
import QRBulkExport    from '../../components/qr-management/QRBulkExport';
import QRSearch        from '../../components/qr-management/QRSearch';
import GoldenQRControl from '../../components/qr-management/GoldenQRControl';
import QRAnalytics     from '../../components/qr-management/QRAnalytics';
import QRBulkControl   from '../../components/qr-management/QRBulkControl';
import QRPrintCenter   from '../../components/qr-management/QRPrintCenter';
import QROperationLogs from '../../components/qr-management/QROperationLogs';

const RED = '#D71920';

function Divider() {
  return <div style={{ height: 1, background: 'rgba(215,25,32,0.12)' }} />;
}

interface Props {
  onBack: () => void;
}

export default function QRManagementPage({ onBack }: Props) {
  const { user } = useAuth();
  const actor = user?.email ?? user?.displayName ?? 'Admin';

  const [stats,        setStats]        = useState<QRDashboardStats>(EMPTY_STATS);
  const [codes,        setCodes]        = useState<QRCodeRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError,   setStatsError]   = useState<string | null>(null);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Live stats via onSnapshot — auto-updates on every QR change
  useEffect(() => {
    setLoadingStats(true);
    setStatsError(null);

    // Subscribe to live dashboard stats
    unsubRef.current = subscribeDashboardStats((newStats) => {
      setStats(newStats);
      setLoadingStats(false);
    });

    // Also fetch all codes for export/print (one-shot, refreshed manually)
    fetchAllQRCodes()
      .then(setCodes)
      .catch((err: any) => {
        const msg = err?.message ?? String(err);
        console.error('[QR Management] fetchAllQRCodes failed:', msg);
        setStatsError(msg);
        setLoadingStats(false);
      });

    return () => { unsubRef.current?.(); };
  }, [refreshKey]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'linear-gradient(160deg,#0a0a0a 0%,#110000 50%,#0a0a0a 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      overflowY: 'auto',
    }}>

      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `
          radial-gradient(ellipse at 20% 0%, ${RED}18 0%, transparent 55%),
          radial-gradient(ellipse at 80% 100%, ${RED}10 0%, transparent 50%)
        `,
      }} />

      {/* ── Top Bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(10,10,10,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(215,25,32,0.15)',
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)', borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, fontSize: 16, transition: 'all 150ms',
          }}
          aria-label="Back"
        ><ArrowLeft size={18} strokeWidth={2} /></button>

        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${RED}22`, border: `1px solid ${RED}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED,
        }}><QrCode size={18} strokeWidth={2} /></div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            QR Management
          </h1>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: 0, fontWeight: 600 }}>
            Generate, Manage, Track and Secure QR Codes
          </p>
        </div>

        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase',
          padding: '4px 10px', borderRadius: 20,
          background: `${RED}22`, border: `1px solid ${RED}55`, color: RED, flexShrink: 0,
        }}>Admin</span>

        <button
          onClick={refresh}
          disabled={loadingStats}
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: loadingStats ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
            borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: loadingStats ? 'not-allowed' : 'pointer',
          }}
          aria-label="Refresh"
        ><RefreshCw size={16} strokeWidth={2} style={{ animation: loadingStats ? 'spin 1s linear infinite' : 'none' }} /></button>
      </div>

      {/* ── Page Content ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, padding: '24px 20px 40px',
        maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 32,
      }}>

        {/* 1. Dashboard */}
        <QRDashboard stats={stats} loading={loadingStats} error={statsError} />
        <Divider />

        {/* 2. QR Generator */}
        <QRGenerator onGenerated={refresh} />
        <Divider />

        {/* 3. Export Center */}
        <QRBulkExport codes={codes} actor={actor} />
        <Divider />

        {/* 4. PDF Print Center */}
        <QRPrintCenter codes={codes} actor={actor} />
        <Divider />

        {/* 5. QR Search */}
        <QRSearch />
        <Divider />

        {/* 6. Golden QR */}
        <GoldenQRControl onRefresh={refresh} />
        <Divider />

        {/* 7. Bulk Control Center */}
        <QRBulkControl onRefresh={refresh} actor={actor} />
        <Divider />

        {/* 8. Analytics */}
        <QRAnalytics />
        <Divider />

        {/* 9. Operation Logs */}
        <QROperationLogs refreshKey={refreshKey} />

      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
