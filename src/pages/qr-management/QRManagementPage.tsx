import React, { useEffect, useState, useCallback, useRef } from 'react';
import { soundManager } from '../../audio';
import {
  QrCode, RefreshCw, ArrowLeft,
  LayoutDashboard, Plus, Search, Zap, Layers3,
  BarChart3, Activity, Printer, Trash2, Settings, Menu, ScanSearch,
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
import QRTracker      from '../../components/qr-management/QRTracker';

const RED = '#D71920';

const SIDEBAR_EXPANDED_W = 260;
const SIDEBAR_COLLAPSED_W = 72;
const SIDEBAR_MOBILE_W = 280;
const TOPBAR_H = 56;
const STORAGE_KEY = 'qr_sidebar_collapsed';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId =
  | 'dashboard' | 'generator' | 'search'   | 'actions'
  | 'bulk'      | 'analytics' | 'tracker'  | 'activity' | 'print'
  | 'delete'    | 'settings';

interface Tab {
  id:    TabId;
  label: string;
  icon:  React.ReactNode;
  badge?: string;
}

const TABS: Tab[] = [
  { id: 'dashboard', label: 'Dashboard',    icon: <LayoutDashboard size={17} strokeWidth={2} /> },
  { id: 'generator', label: 'Generator',    icon: <Plus            size={17} strokeWidth={2} /> },
  { id: 'search',    label: 'Search',       icon: <Search          size={17} strokeWidth={2} /> },
  { id: 'actions',   label: 'Actions',      icon: <Zap             size={17} strokeWidth={2} /> },
  { id: 'bulk',      label: 'Bulk Actions', icon: <Layers3         size={17} strokeWidth={2} /> },
  { id: 'analytics', label: 'Analytics',    icon: <BarChart3       size={17} strokeWidth={2} /> },
  { id: 'tracker',   label: 'QR Tracker',   icon: <ScanSearch      size={17} strokeWidth={2} /> },
  { id: 'activity',  label: 'Activity',     icon: <Activity        size={17} strokeWidth={2} /> },
  { id: 'print',     label: 'Print',        icon: <Printer         size={17} strokeWidth={2} /> },
  { id: 'delete',    label: 'Delete',       icon: <Trash2          size={17} strokeWidth={2} />, badge: 'danger' },
  { id: 'settings',  label: 'Settings',     icon: <Settings        size={17} strokeWidth={2} /> },
];

const TAB_TITLES: Record<TabId, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard',    subtitle: 'Live system overview and QR statistics' },
  generator: { title: 'QR Generator', subtitle: 'Create single, bulk, or Golden QR codes' },
  search:    { title: 'QR Search',    subtitle: 'Find and manage individual QR codes' },
  actions:   { title: 'QR Actions',   subtitle: 'Enable, disable or control QR codes by type' },
  bulk:      { title: 'Bulk Actions', subtitle: 'Large-scale QR operations and data export' },
  analytics: { title: 'Analytics',    subtitle: 'Scan trends, usage rates and performance reports' },
  tracker:   { title: 'QR Tracker',   subtitle: 'Full lifecycle tracking and per-QR inspection' },
  activity:  { title: 'Activity Logs',subtitle: 'Complete audit trail of all admin operations' },
  print:     { title: 'Print Center', subtitle: 'Generate A4 PDF print sheets for packaging' },
  delete:    { title: 'Delete Center',subtitle: 'Safe, filtered deletion of QR codes' },
  settings:  { title: 'Settings',     subtitle: 'System configuration and validation rules' },
};

// ─── Detect mobile (≤ 768 px) ────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

// ─── Tab pill — expanded (icon + label) ──────────────────────────────────────

function TabPill({
  tab, active, collapsed, onClick,
}: {
  tab: Tab; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  const isDanger = tab.badge === 'danger';
  const activeColor = isDanger ? '#DC2626' : RED;
  const iconColor = active ? activeColor : isDanger ? '#EF4444' : '#9CA3AF';

  return (
    <button
      onClick={onClick}
      title={collapsed ? tab.label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '9px 14px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 700,
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'background 150ms, color 150ms, border-color 150ms',
        background: active ? (isDanger ? '#FEF2F2' : `${RED}10`) : 'transparent',
        color: active ? activeColor : isDanger ? '#EF4444' : '#6B7280',
        borderLeft: collapsed
          ? 'none'
          : active
            ? `3px solid ${activeColor}`
            : '3px solid transparent',
        position: 'relative',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Active indicator bar for collapsed mode */}
      {collapsed && active && (
        <span style={{
          position: 'absolute', left: 0, top: '20%', bottom: '20%',
          width: 3, borderRadius: 2,
          background: activeColor,
        }} />
      )}
      <span style={{ color: iconColor, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {tab.icon}
      </span>
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.label}</span>
      )}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; }

export default function QRManagementPage({ onBack }: Props) {
  const { user } = useAuth();
  const actor = user?.email ?? user?.displayName ?? 'Admin';
  const isMobile = useIsMobile();

  const [activeTab,    setActiveTab]    = useState<TabId>('dashboard');
  const [stats,        setStats]        = useState<QRDashboardStats>(EMPTY_STATS);
  const [codes,        setCodes]        = useState<QRCodeRecord[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError,   setStatsError]   = useState<string | null>(null);
  const [refreshKey,   setRefreshKey]   = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);

  // Desktop: collapsed = icon-only. Mobile: open = overlay visible.
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist desktop collapse state
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(desktopCollapsed)); } catch { /* ignore */ }
  }, [desktopCollapsed]);

  // Close mobile sidebar when resizing to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Safety: ensure all game audio is silenced whenever this admin panel is mounted.
  // main.tsx already stops BGM on screen transition; this is belt-and-suspenders
  // in case of any async race between mount and the screen-change effect.
  useEffect(() => {
    soundManager.stopMusic();
    console.log('[AUDIO] Entered Admin Route: /codes — Game BGM stopped.');
  }, []);

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
    if (isMobile) setMobileOpen(false);
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(v => !v);
    } else {
      setDesktopCollapsed(v => !v);
    }
  };

  const { title, subtitle } = TAB_TITLES[activeTab];

  // ── Computed sidebar width for desktop layout ─────────────────────────────
  const desktopSidebarW = desktopCollapsed ? SIDEBAR_COLLAPSED_W : SIDEBAR_EXPANDED_W;

  // ── Render active tab content ─────────────────────────────────────────────
  const renderTab = () => {
    switch (activeTab) {
      case 'dashboard': return <QRDashboard stats={stats} loading={loadingStats} error={statsError} codes={codes} actor={actor} onNavigate={(tab) => navigate(tab as any)} onRefresh={refresh} />;
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
      case 'tracker':   return <QRTracker codes={codes} onRefresh={refresh} actor={actor} />;
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
        height: TOPBAR_H, background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
        padding: '0 16px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', zIndex: 20,
        position: 'relative',
      }}>
        {/* Back */}
        <button
          onClick={onBack}
          title="Back"
          style={{
            background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151',
            borderRadius: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>

        {/* ☰ Sidebar toggle — always visible, top-left */}
        <button
          onClick={toggleSidebar}
          title={isMobile
            ? (mobileOpen ? 'Close menu' : 'Open menu')
            : (desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}
          style={{
            background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151',
            borderRadius: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background 150ms, transform 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#E5E7EB')}
          onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
        >
          <Menu size={16} strokeWidth={2} />
        </button>

        {/* Logo mark */}
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${RED}12`, border: `1px solid ${RED}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: RED, flexShrink: 0,
        }}>
          <QrCode size={16} strokeWidth={2} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 14, fontWeight: 800, color: '#1A1A1A', margin: 0, lineHeight: 1.2 }}>
            QR Management
          </h1>
          <p style={{ fontSize: 9, color: '#9CA3AF', margin: 0, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {actor}
          </p>
        </div>

        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
          padding: '3px 9px', borderRadius: 20,
          background: `${RED}12`, border: `1px solid ${RED}25`, color: RED, flexShrink: 0,
        }}>Admin</span>

        <button
          onClick={refresh}
          disabled={loadingStats}
          title="Refresh"
          style={{
            background: '#F3F4F6', border: '1px solid #E5E7EB',
            color: loadingStats ? '#D1D5DB' : '#6B7280',
            borderRadius: 8, width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: loadingStats ? 'not-allowed' : 'pointer', flexShrink: 0,
            transition: 'background 150ms',
          }}
          onMouseEnter={e => { if (!loadingStats) e.currentTarget.style.background = '#E5E7EB'; }}
          onMouseLeave={e => (e.currentTarget.style.background = '#F3F4F6')}
        >
          <RefreshCw size={14} strokeWidth={2} style={{ animation: loadingStats ? 'qrSpin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* ── Body: sidebar + content ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ══ DESKTOP SIDEBAR ══
            Sits in normal flow — content area shrinks/grows alongside it.
            Uses transform for the slide animation, width stays fixed so
            the flex layout can transition without layout thrashing.         */}
        {!isMobile && (
          <div style={{
            width: desktopSidebarW,
            flexShrink: 0,
            transition: 'width 250ms ease-in-out',
            overflow: 'hidden',
            position: 'relative',
          }}>
            {/* Inner panel — fixed visual width, translated when collapsing */}
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: SIDEBAR_EXPANDED_W,
              background: '#FFFFFF',
              borderRight: '1px solid #E5E7EB',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto', overflowX: 'hidden',
              boxShadow: '1px 0 4px rgba(0,0,0,0.04)',
              transform: desktopCollapsed
                ? `translateX(${SIDEBAR_COLLAPSED_W - SIDEBAR_EXPANDED_W}px)`
                : 'translateX(0)',
              transition: 'transform 250ms ease-in-out',
            }}>
              {/* Section label — only shown when expanded */}
              <div style={{
                padding: '14px 14px 6px',
                opacity: desktopCollapsed ? 0 : 1,
                transition: 'opacity 200ms ease-in-out',
                pointerEvents: desktopCollapsed ? 'none' : 'auto',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 2,
                  textTransform: 'uppercase', color: '#9CA3AF',
                }}>Navigation</span>
              </div>

              <div style={{ padding: desktopCollapsed ? '8px 4px' : '4px 10px', flex: 1 }}>
                {TABS.map(tab => (
                  <TabPill
                    key={tab.id}
                    tab={tab}
                    active={activeTab === tab.id}
                    collapsed={desktopCollapsed}
                    onClick={() => navigate(tab.id)}
                  />
                ))}
              </div>

              {/* Collapse hint at bottom when expanded */}
              {!desktopCollapsed && (
                <div style={{
                  padding: '10px 14px 14px',
                  borderTop: '1px solid #F3F4F6',
                  fontSize: 10, color: '#C4C9D4', fontWeight: 500,
                  textAlign: 'center',
                }}>
                  ☰ to collapse
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ MOBILE SIDEBAR OVERLAY ══
            Absolutely positioned, slides in from left over content.         */}
        {isMobile && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setMobileOpen(false)}
              style={{
                position: 'absolute', inset: 0, zIndex: 15,
                background: 'rgba(0,0,0,0.35)',
                opacity: mobileOpen ? 1 : 0,
                pointerEvents: mobileOpen ? 'auto' : 'none',
                transition: 'opacity 250ms ease-in-out',
              }}
            />

            {/* Sidebar panel */}
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: SIDEBAR_MOBILE_W,
              background: '#FFFFFF',
              borderRight: '1px solid #E5E7EB',
              zIndex: 16,
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
              boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.14)' : 'none',
              transform: mobileOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_MOBILE_W + 8}px)`,
              transition: 'transform 250ms ease-in-out, box-shadow 250ms ease-in-out',
            }}>
              <div style={{ padding: '14px 14px 6px' }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 2,
                  textTransform: 'uppercase', color: '#9CA3AF',
                }}>Navigation</span>
              </div>
              <div style={{ padding: '4px 10px', flex: 1 }}>
                {TABS.map(tab => (
                  <TabPill
                    key={tab.id}
                    tab={tab}
                    active={activeTab === tab.id}
                    collapsed={false}
                    onClick={() => navigate(tab.id)}
                  />
                ))}
              </div>
            </div>
          </>
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
                  <button
                    onClick={() => navigate('dashboard')}
                    style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Dashboard
                  </button>
                )}
                {activeTab !== 'generator' && (
                  <button
                    onClick={() => navigate('generator')}
                    style={{ fontSize: 10, padding: '4px 10px', borderRadius: 20, background: `${RED}08`, border: `1px solid ${RED}20`, color: RED, cursor: 'pointer', fontWeight: 700 }}
                  >
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

      <style>{`
        @keyframes qrSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
