import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  QrCode, RefreshCw, ArrowLeft,
  LayoutDashboard, Plus, Search, Zap, Layers3,
  BarChart3, Activity, Printer, Trash2, Settings,
} from 'lucide-react';
import { subscribeDashboardStats, fetchAllQRCodes, EMPTY_STATS } from '../../services/qr/qrManagementService';
import type { QRDashboardStats, QRCodeRecord } from '../../types/qr/qrManagementTypes';
import { useAuth } from '../../auth/AuthProvider';
import QRDashboard     from '../../components/qr-management/QRDashboard';
import QRGenerator     from '../../components/qr-management/QRGenerator';
import QRSearch        from '../../components/qr-management/QRSearch';
import QRActions       from '../../components/qr-management/QRActions';
import QRBulkControl   from '../../components/qr-management/QRBulkControl';
import QRBulkExport    from '../../components/qr-management/QRBulkExport';
import QRAnalytics     from '../../components/qr-management/QRAnalytics';
import QROperationLogs from '../../components/qr-management/QROperationLogs';
import QRPrintCenter   from '../../components/qr-management/QRPrintCenter';
import QRSettings      from '../../components/qr-management/QRSettings';

const RED = '#D71920';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId =
  | 'dashboard' | 'generator' | 'search'   | 'actions'
  | 'bulk'      | 'analytics' | 'activity' | 'print'
  | 'delete'    | 'settings';

interface Tab {
  id:    TabId;
  label: string;
  icon:  React.ReactNode;
  badge?: string;
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: <LayoutDashboard size={16} strokeWidth={2} /> },
  { id: 'generator', label: 'Generator',    icon: <Plus            size={16} strokeWidth={2} /> },
  { id: 'search',    label: 'Search',       icon: <Search          size={16} strokeWidth={2} /> },
  { id: 'actions',   label: 'Actions',      icon: <Zap             size={16} strokeWidth={2} /> },
  { id: 'bulk',      label: 'Bulk Actions', icon: <Layers3         size={16} strokeWidth={2} /> },
  { id: 'analytics', label: 'Analytics',    icon: <BarChart3       size={16} strokeWidth={2} /> },
  { id: 'activity',  label: 'Activity',     icon: <Activity        size={16} strokeWidth={2} /> },
  { id: 'print',     label: 'Print',        icon: <Printer         size={16} strokeWidth={2} /> },
  { id: 'delete',    label: 'Delete',       icon: <Trash2          size={16} strokeWidth={2} />, badge: 'danger' },
  { id: 'settings',  label: 'Settings',     icon: <Settings        size={16} strokeWidth={2} /> },
];

const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard',    subtitle: 'Live system overview and QR statistics' },
  generator: { title: 'QR Generator', subtitle: 'Create single, bulk, or Golden QR codes' },
  search:    { title: 'QR Search',    subtitle: 'Find and manage individual QR codes' },
  actions:   { title: 'QR Actions',   subtitle: 'Enable, disable or control QR codes by type' },
  bulk:      { title: 'Bulk Actions', subtitle: 'Large-scale QR operations and data export' },
  analytics: { title: 'Analytics',    subtitle: 'Scan trends, usage rates and performance reports' },
  activity:  { title: 'Activity Logs',subtitle: 'Complete audit trail of all admin operations' },
  print:     { title: 'Print Center', subtitle: 'Generate A4 PDF print sheets for packaging' },
  delete:    { title: 'Delete Center',subtitle: 'Safe, filtered deletion of QR codes' },
  settings:  { title: 'Settings',     subtitle: 'System configuration and validation rules' },
};

// ─── Tab pill ─────────────────────────────────────────────────────────────────

function TabPill({ tab, active, onClick }: { tab: Tab; active: boolean; onClick: () => void }) {
  const isDanger = tab.badge === 'danger';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
        border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'all 150ms',
        background: active
          ? isDanger ? '#FEF2F2' : `${RED}10`
          : 'transparent',
        color: active
          ? isDanger ? '#DC2626' : RED
          : isDanger ? '#EF4444' : '#6B7280',
        borderLeft: active ? `3px solid ${isDanger ? '#DC2626' : RED}` : '3px solid transparent',
      }}
    >
      <span style={{ color: active ? (isDanger ? '#DC2626' : RED) : isDanger ? '#EF4444' : '#9CA3AF', flexShrink: 0 }}>
        {tab.icon}
      </span>
      {tab.label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function QRManagementPage({ onBack }: Props) {
  const { user } = useAuth();
  const actor = user?.email ?? user?.displayName ?? 'Admin';

  const [activeTab,    setActiveTab]    = useState<TabId>('dashboard');
  const [stats,        setStats]        = useState<QRDashboardStats>(EMPTY_STATS);
  const [codes,        setCodes]        = useState<QRCodeRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError,   setStatsError]   = useState<string | null>(null);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
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
        setStatsError(err?.message ?? String(err));
        setLoadingStats(false);
      });
    return () => { unsubRef.current?.(); };
  }, [refreshKey]);

  const navigate = (tab: TabId) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const { title, subtitle } = TAB_TITLES[activeTab];

  // ── Render active tab content ─────────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <QRDashboard stats={stats} loading={loadingStats} error={statsError} />;
      case 'generator': return <QRGenerator onGenerated={refresh} />;
      case 'search':    return <QRSearch />;
      case 'actions':   return <QRActions onRefresh={refresh} actor={actor} />;
      case 'bulk':      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <QRBulkExport codes={codes} actor={actor} />
          <QRBulkControl onRefresh={refresh} actor={actor} />
        </div>
      );
      case 'analytics': return <QRAnalytics />;
      case 'activity':  return <QROperationLogs refreshKey={refreshKey} />;
      case 'print':     return <QRPrintCenter codes={codes} actor={actor} />;
      case 'delete':    return <QRBulkControl onRefresh={refresh} actor={actor} />;
      case 'settings':  return <QRSettings />;
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#F8F9FB',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>

      {/* ── Top Bar ── */}
      <div style={{
        height: 56, background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
        padding: '0 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', zIndex: 20,
        position: 'relative',
      }}>
        <button onClick={onBack} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={16} strokeWidth={2} />
        </button>

        {/* Mobile menu toggle */}
        <button onClick={() => setSidebarOpen(v => !v)} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 14, height: 1.5, background: '#6B7280', borderRadius: 2 }} />)}
          </div>
        </button>

        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${RED}12`, border: `1px solid ${RED}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED, flexShrink: 0 }}>
          <QrCode size={16} strokeWidth={2} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A', margin: 0, lineHeight: 1.2 }}>QR Management</h1>
          <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{actor}</p>
        </div>

        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', padding: '3px 9px', borderRadius: 20, background: `${RED}12`, border: `1px solid ${RED}25`, color: RED, flexShrink: 0 }}>Admin</span>

        <button onClick={refresh} disabled={loadingStats} style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', color: loadingStats ? '#D1D5DB' : '#6B7280', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loadingStats ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
          <RefreshCw size={14} strokeWidth={2} style={{ animation: loadingStats ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <div style={{
          width: 200, flexShrink: 0,
          background: '#FFFFFF', borderRight: '1px solid #E5E7EB',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          // On small screens slide in/out
          position: 'absolute' as const,
          top: 56, bottom: 0, left: sidebarOpen ? 0 : -220,
          zIndex: 15,
          transition: 'left 250ms cubic-bezier(0.4,0,0.2,1)',
          boxShadow: sidebarOpen ? '4px 0 16px rgba(0,0,0,0.1)' : 'none',
        }}
        // Also show permanently on wider screens via CSS media would need a class;
        // we use a second static sidebar div below for wide screens
        >
          <div style={{ padding: '12px 10px' }}>
            {TABS.map(tab => (
              <TabPill key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => navigate(tab.id)} />
            ))}
          </div>
        </div>

        {/* Wide-screen permanent sidebar */}
        <div style={{
          width: 200, flexShrink: 0,
          background: '#FFFFFF', borderRight: '1px solid #E5E7EB',
          overflowY: 'auto', padding: '12px 10px',
        }}>
          {TABS.map(tab => (
            <TabPill key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => navigate(tab.id)} />
          ))}
        </div>

        {/* Mobile overlay backdrop */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'absolute', inset: 0, top: 56, background: 'rgba(0,0,0,0.3)', zIndex: 14 }} />
        )}

        {/* ── Main content area ── */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Page header */}
          <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1A1A1A', margin: 0, letterSpacing: '-0.3px' }}>{title}</h2>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '2px 0 0', fontWeight: 500 }}>{subtitle}</p>
              </div>
              {/* Quick-jump chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {activeTab !== 'dashboard' && (
                  <button onClick={() => navigate('dashboard')} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', cursor: 'pointer', fontWeight: 600 }}>
                    Dashboard
                  </button>
                )}
                {activeTab !== 'generator' && (
                  <button onClick={() => navigate('generator')} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: `${RED}08`, border: `1px solid ${RED}20`, color: RED, cursor: 'pointer', fontWeight: 700 }}>
                    + New QR
                  </button>
                )}
              </div>
            </div>

            {/* Breadcrumb divider */}
            <div style={{ height: 1, background: '#E5E7EB', margin: '14px 0 0' }} />
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, padding: '20px 24px 40px' }}>
            {renderTab()}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
