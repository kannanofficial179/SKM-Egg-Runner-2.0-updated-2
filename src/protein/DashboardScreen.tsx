import { useEffect, useState, useCallback } from 'react';
import SkeletonLoader from '../auth/SkeletonLoader';
import type { User } from 'firebase/auth';
import {
  getTodayStats, getStreakInfo, getWeeklyData, getTrackerSettings, getRecentEntries,
  PROTEIN_PER_EGG,
  type DailyStats, type StreakInfo, type WeeklyData, type ProteinLogEntry, type TrackerSettings,
  todayKey,
} from '../services/protein/proteinTrackerService';
import {
  EggIcon, FlameIcon, TargetIcon, TrendUpIcon, CameraIcon,
  FoodLogIcon, AnalyticsIcon, ChevronRightIcon, SunIcon, MoonIcon,
} from './Icons';

interface DashboardScreenProps {
  user: User;
  onScanQR: () => void;
  onViewAnalytics: () => void;
  onViewLog: () => void;
  onViewStreaks: () => void;
  refreshKey: number;
}

export default function DashboardScreen({ user, onScanQR, onViewAnalytics, onViewLog, onViewStreaks, refreshKey }: DashboardScreenProps) {
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [streak,     setStreak]     = useState<StreakInfo>({ currentStreak: 0, bestStreak: 0, lastActiveDate: '' });
  const [weekData,   setWeekData]   = useState<WeeklyData[]>([]);
  const [settings,   setSettings]   = useState<TrackerSettings | null>(null);
  const [recent,     setRecent]     = useState<ProteinLogEntry[]>([]);
  const [loading,    setLoading]    = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ts, si, wd, stg, rc] = await Promise.all([
        getTodayStats(user.uid),
        getStreakInfo(user.uid),
        getWeeklyData(user.uid),
        getTrackerSettings(user.uid),
        getRecentEntries(user.uid, 5),
      ]);
      setTodayStats(ts); setStreak(si); setWeekData(wd); setSettings(stg); setRecent(rc);
    } catch (e) { console.error('[Dashboard]', e); }
    finally { setLoading(false); }
  }, [user.uid]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const goal      = settings?.dailyGoal ?? 60;
  const consumed  = todayStats?.totalProtein ?? 0;
  const eggs      = todayStats?.totalEggs    ?? 0;
  const pct       = Math.min(100, Math.round((consumed / goal) * 100));
  const remaining = Math.max(0, goal - consumed);
  const name      = user.displayName?.split(' ')[0] ?? 'Champion';
  const hour      = new Date().getHours();
  const R         = 52;
  const circumf   = 2 * Math.PI * R;
  const dashOffset = circumf - (circumf * pct) / 100;
  const maxBar    = Math.max(...weekData.map(d => d.totalProtein), goal, 1);

  if (loading) return <SkeletonLoader />;

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg,#D71920 0%,#B31217 100%)',
        padding: '18px 18px 24px', position: 'relative', overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(215,25,32,0.3)',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -20, width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Greeting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {hour < 17 ? <SunIcon size={13} color="rgba(255,255,255,0.65)" /> : <MoonIcon size={13} color="rgba(255,255,255,0.65)" />}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: 0, fontWeight: 600 }}>
            {hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'}
          </p>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 14px', letterSpacing: '-0.3px' }}>{name}</h1>

        {/* Today at a glance */}
        <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 14px', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: '0 0 2px', fontWeight: 600 }}>Today's Protein</p>
            <p style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>{consumed}g</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: '2px 0 0', fontWeight: 500 }}>of {goal}g daily goal</p>
          </div>
          {remaining > 0 ? (
            <button onClick={onScanQR} style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 12, padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>{Math.ceil(remaining / PROTEIN_PER_EGG)}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.75)', margin: '3px 0 0', fontWeight: 700, whiteSpace: 'nowrap' }}>eggs to goal</p>
            </button>
          ) : (
            <div style={{ background: 'rgba(34,197,94,0.3)', borderRadius: 12, padding: '10px 14px', textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 900, color: '#86efac', margin: 0 }}>Goal</p>
              <p style={{ fontSize: 12, fontWeight: 900, color: '#86efac', margin: 0 }}>Met!</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '0 14px' }}>

        {/* ── Protein Ring Card ── */}
        <div style={{ background: '#fff', borderRadius: 24, padding: 18, marginTop: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', width: 116, height: 116, flexShrink: 0 }}>
              <svg width="116" height="116" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="58" cy="58" r={R} fill="none" stroke="#F0F0F0" strokeWidth={10} />
                <circle cx="58" cy="58" r={R} fill="none" stroke={pct >= 100 ? '#22C55E' : '#D71920'}
                  strokeWidth={10} strokeLinecap="round"
                  strokeDasharray={circumf} strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 800ms ease' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#1A1A1A', lineHeight: 1 }}>{pct}%</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: pct >= 100 ? '#22C55E' : '#D71920', marginTop: 1 }}>of goal</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 900, color: '#1A1A1A', margin: '0 0 8px' }}>Today's Nutrition</p>
              <StatRow label="Consumed"  value={`${consumed}g`} red />
              <StatRow label="Goal"      value={`${goal}g`} />
              <StatRow label="Remaining" value={`${remaining}g`} red={remaining > 0} green={remaining === 0} />
              <StatRow label="Eggs Today" value={`${eggs}`} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 9, background: '#F0F0F0', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: pct >= 100 ? '#22C55E' : 'linear-gradient(90deg,#D71920,#B31217)',
                borderRadius: 5, transition: 'width 800ms ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 9, color: '#bbb', fontWeight: 500 }}>0g</span>
              <span style={{ fontSize: 9, color: '#D71920', fontWeight: 700 }}>{pct}% of {goal}g daily goal</span>
              <span style={{ fontSize: 9, color: '#bbb', fontWeight: 500 }}>{goal}g</span>
            </div>
          </div>
        </div>

        {/* ── Quick stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
          <MiniStat icon={<EggIcon size={15} color="#D71920" />}    label="Eggs Today"    value={String(eggs)} />
          <MiniStat icon={<FlameIcon size={15} color="#F59E0B" />}  label="Day Streak"    value={`${streak.currentStreak}d`} color="#F59E0B" />
          <MiniStat icon={<TargetIcon size={15} color="#22C55E" />} label="Goal"          value={pct >= 100 ? 'Done!' : `${remaining}g left`} color={pct >= 100 ? '#22C55E' : '#666'} />
        </div>

        {/* ── Streak Card ── */}
        <button onClick={onViewStreaks} style={{
          width: '100%', marginTop: 12,
          background: streak.currentStreak >= 30
            ? 'linear-gradient(135deg,#7C3AED,#EC4899)'
            : streak.currentStreak >= 7
            ? 'linear-gradient(135deg,#B45309,#D97706)'
            : 'linear-gradient(135deg,#D71920,#B31217)',
          borderRadius: 20, padding: '16px 18px',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(215,25,32,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Egg Streak</p>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>
              {streak.currentStreak} <span style={{ fontSize: 14, fontWeight: 700 }}>days</span>
            </p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0', fontWeight: 600 }}>
              {streak.currentStreak === 0 ? 'Start scanning to begin' : `Best: ${streak.bestStreak}d`}
            </p>
          </div>
          <div style={{ fontSize: 52, lineHeight: 1, filter: 'drop-shadow(0 0 8px rgba(255,200,50,0.5))' }}>
            {streak.currentStreak >= 30 ? '👑'
              : streak.currentStreak >= 14 ? '🔥🔥'
              : streak.currentStreak >= 7  ? '🔥'
              : streak.currentStreak >= 3  ? '🐣'
              : '🥚'}
          </div>
        </button>

        {/* ── Quick Actions ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <QuickAction icon={<CameraIcon size={20} color="#fff" />}       label="Scan QR"    sub="Scan SKM Egg"   primary onClick={onScanQR} />
          <QuickAction icon={<FoodLogIcon size={20} color="#D71920" />}   label="Food Log"   sub="Manual entry"   onClick={onViewLog} />
          <QuickAction icon={<AnalyticsIcon size={20} color="#D71920" />} label="Analytics"  sub="View trends"    onClick={onViewAnalytics} />
          <QuickAction icon={<TrendUpIcon size={20} color="#D71920" />}   label="Streaks"    sub={`${streak.currentStreak} day streak`} onClick={onViewStreaks} />
        </div>

        {/* ── Weekly Chart ── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, marginTop: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Weekly Overview</p>
            <button onClick={onViewAnalytics} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#D71920', fontWeight: 700, fontSize: 11 }}>
              Details <ChevronRightIcon size={13} color="#D71920" />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 76 }}>
            {weekData.map(d => {
              const barH = maxBar > 0 ? Math.max(4, Math.round((d.totalProtein / maxBar) * 68)) : 4;
              const isToday = d.dateKey === todayKey();
              return (
                <div key={d.dateKey} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: '100%', height: 68, position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: Math.round((goal / maxBar) * 68), borderTop: '1.5px dashed rgba(215,25,32,0.2)' }} />
                    <div style={{
                      width: '100%', height: barH, borderRadius: '4px 4px 0 0',
                      background: d.goalMet ? 'linear-gradient(180deg,#D71920,#B31217)' : d.totalProtein > 0 ? 'rgba(215,25,32,0.3)' : '#F0F0F0',
                      outline: isToday ? '2px solid #D71920' : 'none', outlineOffset: 1,
                      transition: 'height 400ms ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: d.goalMet ? '#D71920' : '#ccc' }}>{d.dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        {recent.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 20, padding: '16px 16px', marginTop: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Recent Activity</p>
              <button onClick={onViewLog} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#D71920', fontWeight: 700, fontSize: 11 }}>
                View All <ChevronRightIcon size={13} color="#D71920" />
              </button>
            </div>
            {recent.map((entry, i) => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: i > 0 ? 9 : 0, marginTop: i > 0 ? 9 : 0, borderTop: i > 0 ? '1px solid #F8F8F8' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: 11, background: entry.type === 'qr_scan' ? '#FCE8E8' : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {entry.type === 'qr_scan' ? <EggIcon size={17} color="#D71920" /> : <FoodLogIcon size={17} color="#666" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.foodName}</p>
                  <p style={{ fontSize: 10, color: '#bbb', margin: 0, textTransform: 'capitalize' }}>{entry.meal}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 900, color: '#D71920', margin: 0 }}>+{entry.protein}g</p>
                  <p style={{ fontSize: 9, color: '#ddd', margin: 0 }}>{entry.calories} kcal</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function StatRow({ label, value, red, green }: { label: string; value: string; red?: boolean; green?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
      <span style={{ fontSize: 10, color: '#bbb', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: green ? '#22C55E' : red ? '#D71920' : '#1A1A1A' }}>{value}</span>
    </div>
  );
}

function MiniStat({ icon, label, value, color = '#D71920' }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '12px 10px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
      <p style={{ fontSize: 14, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 8, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.3, margin: '3px 0 0' }}>{label}</p>
    </div>
  );
}

function QuickAction({ icon, label, sub, primary, onClick }: { icon: React.ReactNode; label: string; sub: string; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: primary ? 'linear-gradient(135deg,#D71920,#B31217)' : '#fff',
      borderRadius: 17, padding: '13px 13px', border: 'none', cursor: 'pointer',
      boxShadow: primary ? '0 5px 16px rgba(215,25,32,0.35)' : '0 2px 8px rgba(0,0,0,0.06)',
      display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: primary ? 'rgba(255,255,255,0.2)' : '#FCE8E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 900, color: primary ? '#fff' : '#1A1A1A', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 10, color: primary ? 'rgba(255,255,255,0.7)' : '#bbb', margin: 0, marginTop: 1 }}>{sub}</p>
      </div>
    </button>
  );
}
