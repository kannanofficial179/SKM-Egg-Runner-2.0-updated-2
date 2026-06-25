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
  return <div style={{ height: 1, background: '#E5E7EB', margin: '0 0 4px' }} />;
}

interface Props { onBack: () => void; }

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

  useEffect(() => {
    setLoadingStats(true);
    setStatsError(null);
    unsubRef.current = subscribeDashboardStats((newStats) => {
      setStats(newStats);
      setLoadingStats(false);
    });
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
      background: '#F8F9FB',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      overflowY: 'auto',
    }}>

      {/* ── Top Bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={onBack}
          style={{
            background: '#F3F4F6', border: '1px solid #E5E7EB',
            color: '#374151', borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, transition: 'all 150ms',
          }}
          aria-label="Back"
        ><ArrowLeft size={18} strokeWidth={2} /></button>

        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `${RED}12`, border: `1px solid ${RED}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED,
        }}><QrCode size={18} strokeWidth={2} /></div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A', margin: 0, letterSpacing: '-0.3px', lineHeight: 1.2 }}>
            QR Management
          </h1>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0, fontWeight: 500 }}>
            Manage, Validate and Monitor QR Codes
          </p>
        </div>

        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
          padding: '4px 10px', borderRadius: 20,
          background: `${RED}12`, border: `1px solid ${RED}30`, color: RED, flexShrink: 0,
        }}>Admin</span>

        <button
          onClick={refresh}
          disabled={loadingStats}
          style={{
            background: '#F3F4F6', border: '1px solid #E5E7EB',
            color: loadingStats ? '#D1D5DB' : '#6B7280',
            borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: loadingStats ? 'not-allowed' : 'pointer',
          }}
          aria-label="Refresh"
        ><RefreshCw size={16} strokeWidth={2} style={{ animation: loadingStats ? 'spin 1s linear infinite' : 'none' }} /></button>
      </div>

      {/* ── Page Content ── */}
      <div style={{
        flex: 1, padding: '24px 20px 48px',
        maxWidth: 960, width: '100%', margin: '0 auto', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 28,
      }}>
        <QRDashboard stats={stats} loading={loadingStats} error={statsError} />
        <Divider />
        <QRGenerator onGenerated={refresh} />
        <Divider />
        <QRBulkExport codes={codes} actor={actor} />
        <Divider />
        <QRPrintCenter codes={codes} actor={actor} />
        <Divider />
        <QRSearch />
        <Divider />
        <GoldenQRControl onRefresh={refresh} />
        <Divider />
        <QRBulkControl onRefresh={refresh} actor={actor} />
        <Divider />
        <QRAnalytics />
        <Divider />
        <QROperationLogs refreshKey={refreshKey} />
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
