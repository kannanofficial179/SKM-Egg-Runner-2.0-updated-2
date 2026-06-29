import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from './AuthProvider';
import DashboardScreen   from '../protein/DashboardScreen';
import QRScanScreen      from '../protein/QRScanScreen';
import ConsumptionScreen from '../protein/ConsumptionScreen';
import AnalyticsScreen   from '../protein/AnalyticsScreen';
import ProfileScreen     from '../protein/ProfileScreen';
import { HomeIcon, CameraIcon, FoodLogIcon, AnalyticsIcon, UserIcon } from '../protein/Icons';
import NotificationBell from '../components/notifications/NotificationBell';

type Tab = 'dashboard' | 'scan' | 'log' | 'stats' | 'profile';

interface ProteinTrackerScreenProps { onBack: () => void; }

const PRIMARY_NAV: { key: Tab; label: string; icon: (a: boolean) => React.ReactNode }[] = [
  { key: 'dashboard', label: 'Home',    icon: (a) => <HomeIcon      size={20} color={a ? '#D71920' : '#bbb'} /> },
  { key: 'scan',      label: 'Scan',    icon: (a) => <CameraIcon    size={20} color={a ? '#D71920' : '#bbb'} /> },
  { key: 'log',       label: 'Log',     icon: (a) => <FoodLogIcon   size={20} color={a ? '#D71920' : '#bbb'} /> },
  { key: 'stats',     label: 'Stats',   icon: (a) => <AnalyticsIcon size={20} color={a ? '#D71920' : '#bbb'} /> },
  { key: 'profile',   label: 'Profile', icon: (a) => <UserIcon      size={20} color={a ? '#D71920' : '#bbb'} /> },
];

export default function ProteinTrackerScreen({ onBack }: ProteinTrackerScreenProps) {
  const { user, logout } = useAuth();
  const [tab,        setTab]        = useState<Tab>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  // Preload html5-qrcode in the background so the scanner opens instantly
  useEffect(() => {
    import('html5-qrcode').catch(() => {});
  }, []);

  const typedUser = user as User;
  if (!typedUser) return null;

  const bump = () => setRefreshKey(k => k + 1);

  const handleScanSuccess = () => { bump(); setTab('dashboard'); };
  const handleLogout      = async () => { await logout(); };

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      background: '#F5F5F5',
      fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    }}>

      {/* ── Top App Bar ── */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #F0F0F0', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/egg mus_Image_v5vrg3v5vrg3v5vr-removebg-preview.png" alt="SKM"
              style={{ width: 26, height: 26, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(215,25,32,0.3))' }} />
            <span style={{ fontWeight: 900, fontSize: 14, color: '#D71920' }}>SKM</span>
            <span style={{ fontWeight: 900, fontSize: 14, color: '#1A1A1A' }}>Protein</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell size={18} />
            <button onClick={() => setTab('scan')} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 11,
              background: tab === 'scan' ? '#FCE8E8' : '#F5F5F5', border: 'none', cursor: 'pointer',
            }}>
              <CameraIcon size={15} color="#D71920" />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#D71920' }}>Scan</span>
            </button>
            <button onClick={() => setTab('profile')} style={{
              width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
              border: tab === 'profile' ? '2px solid #D71920' : '2px solid transparent',
              background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
            }}>
              {typedUser.photoURL ? (
                <img src={typedUser.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#FCE8E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: '#D71920' }}>{(typedUser.displayName ?? 'U')[0].toUpperCase()}</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Screen content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'dashboard' && (
          <DashboardScreen
            user={typedUser}
            refreshKey={refreshKey}
            onScanQR={() => setTab('scan')}
            onViewAnalytics={() => setTab('stats')}
            onViewLog={() => setTab('log')}
          />
        )}
        {tab === 'scan'    && <QRScanScreen      user={typedUser} onScanSuccess={handleScanSuccess} />}
        {tab === 'log'     && <ConsumptionScreen  user={typedUser} refreshKey={refreshKey} onScanQR={() => setTab('scan')} />}
        {tab === 'stats'   && <AnalyticsScreen    user={typedUser} refreshKey={refreshKey} />}
        {tab === 'profile' && (
          <ProfileScreen
            user={typedUser}
            onLogout={handleLogout}
            onDataDeleted={() => {}}
            onBackToMenu={onBack}
          />
        )}
      </div>

      {/* ── Bottom Navigation ── */}
      <div style={{
        flexShrink: 0, background: '#fff',
        borderTop: '1px solid #F0F0F0',
        boxShadow: '0 -2px 14px rgba(0,0,0,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ display: 'flex' }}>
          {PRIMARY_NAV.map(item => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '9px 0 7px', gap: 2,
                  background: 'none', border: 'none', cursor: 'pointer', outline: 'none',
                }}
                onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.92)')}
                onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={{
                  width: 38, height: 27, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? '#FCE8E8' : 'transparent', transition: 'all 150ms ease',
                }}>
                  {item.icon(active)}
                </div>
                <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, color: active ? '#D71920' : '#bbb', transition: 'color 150ms ease' }}>
                  {item.label}
                </span>
                {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#D71920' }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
