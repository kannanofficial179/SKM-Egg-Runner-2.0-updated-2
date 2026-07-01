/**
 * SKM Egg Streaks — Premium streak tracking screen
 *
 * Layout:
 *   1. Large fire hero card with streak count + emoji evolution
 *   2. Motivational message
 *   3. Today's status banner
 *   4. Weekly batch progress (7-day lock system)
 *   5. Stats row (best streak / total egg days / batches)
 *   6. Recent 30-day calendar
 */

import { useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  getEggStreakData, getStreakHistory,
  getStreakEmoji, getStreakTitle, getStreakFireLevel,
  getMotivationalMessage, getBatchRewardLabel, buildBatches,
  type EggStreakData, type StreakDayRecord,
} from '../services/protein/eggStreakService';

interface EggStreakScreenProps {
  user: User;
  refreshKey: number;
  onScanQR: () => void;
}

export default function EggStreakScreen({ user, refreshKey, onScanQR }: EggStreakScreenProps) {
  const [data,    setData]    = useState<EggStreakData | null>(null);
  const [history, setHistory] = useState<StreakDayRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, h] = await Promise.all([
        getEggStreakData(user.uid),
        getStreakHistory(user.uid, 30),
      ]);
      setData(d);
      setHistory(h);
    } catch (e) {
      console.error('[EggStreak]', e);
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <StreakSkeleton />;
  if (!data)   return null;

  const {
    currentStreak, bestStreak, totalEggDays, todayCompleted,
    todayTime, completedBatches, batchProgress,
  } = data;

  const emoji     = getStreakEmoji(currentStreak);
  const title     = getStreakTitle(currentStreak);
  const fireLevel = getStreakFireLevel(currentStreak);
  const message   = getMotivationalMessage(currentStreak, todayCompleted);
  const batches   = buildBatches(currentStreak, completedBatches);

  // Build a quick map from the history array for O(1) lookup
  const historyMap = new Map(history.map(r => [r.dateKey, r]));

  // Generate last 30 calendar days, newest first
  const last30: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last30.push(d.toISOString().slice(0, 10));
  }
  const today = new Date().toISOString().slice(0, 10);

  const fireColors = ['#F59E0B', '#F97316', '#EF4444', '#DC2626'];
  const heroGrad = currentStreak >= 30
    ? 'linear-gradient(135deg,#7C3AED,#EC4899)'
    : currentStreak >= 14
    ? 'linear-gradient(135deg,#B45309,#D97706)'
    : currentStreak >= 7
    ? 'linear-gradient(135deg,#D71920,#B31217)'
    : 'linear-gradient(135deg,#D71920,#B31217)';

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>

      {/* ── Hero Card ── */}
      <div style={{
        background: heroGrad,
        padding: '28px 20px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Fire rings animation */}
        {fireLevel >= 1 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[0, 1, 2].slice(0, fireLevel).map(i => (
              <div key={i} style={{
                position: 'absolute',
                width: 120 + i * 60,
                height: 120 + i * 60,
                borderRadius: '50%',
                border: `2px solid rgba(255,255,255,${0.12 - i * 0.03})`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                animation: `pulse-ring ${1.5 + i * 0.4}s ease-out infinite`,
                animationDelay: `${i * 0.35}s`,
              }} />
            ))}
          </div>
        )}

        {/* Emoji */}
        <div style={{
          fontSize: 64,
          lineHeight: 1,
          marginBottom: 10,
          filter: fireLevel >= 2 ? 'drop-shadow(0 0 16px rgba(255,200,50,0.7))' : 'none',
          animation: currentStreak > 0 ? 'float 2.5s ease-in-out infinite' : 'none',
        }}>
          {emoji}
        </div>

        {/* Streak count */}
        <div style={{
          fontSize: currentStreak >= 100 ? 64 : 80,
          fontWeight: 900,
          color: '#fff',
          lineHeight: 1,
          letterSpacing: -2,
          textShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {currentStreak}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' }}>
          Day Streak
        </div>

        {/* Title badge */}
        <div style={{
          display: 'inline-block',
          marginTop: 10,
          padding: '5px 16px',
          borderRadius: 50,
          background: 'rgba(255,255,255,0.2)',
          backdropFilter: 'blur(8px)',
          fontSize: 13,
          fontWeight: 800,
          color: '#fff',
          letterSpacing: 0.3,
        }}>
          {title}
        </div>
      </div>

      {/* ── Motivational message ── */}
      <div style={{
        margin: '12px 14px 0',
        padding: '14px 16px',
        background: todayCompleted ? '#F0FDF4' : '#FFFBEB',
        borderRadius: 16,
        borderLeft: `4px solid ${todayCompleted ? '#22C55E' : '#F59E0B'}`,
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: todayCompleted ? '#166534' : '#92400E', margin: 0, lineHeight: 1.5 }}>
          {message}
        </p>
      </div>

      {/* ── Today status ── */}
      {!todayCompleted && (
        <div style={{ margin: '10px 14px 0', padding: '14px 16px', background: '#fff', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Today's Egg Pending</p>
            <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 0' }}>Scan an egg to extend your streak</p>
          </div>
          <button onClick={onScanQR} style={{
            padding: '10px 16px', borderRadius: 13, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#D71920,#B31217)',
            color: '#fff', fontWeight: 900, fontSize: 12, whiteSpace: 'nowrap',
            boxShadow: '0 4px 14px rgba(215,25,32,0.4)',
          }}>
            Scan Now
          </button>
        </div>
      )}

      {todayCompleted && (
        <div style={{ margin: '10px 14px 0', padding: '14px 16px', background: '#F0FDF4', borderRadius: 16, border: '1.5px solid #86EFAC', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#166534', margin: 0 }}>Today's Egg Recorded!</p>
            {todayTime && <p style={{ fontSize: 11, color: '#16A34A', margin: '2px 0 0', fontWeight: 600 }}>Scanned at {todayTime}</p>}
          </div>
        </div>
      )}

      <div style={{ padding: '0 14px' }}>

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
          <StatTile label="Best Streak" value={`${bestStreak}d`} emoji="🏆" />
          <StatTile label="Total Eggs" value={String(totalEggDays)} emoji="🥚" />
          <StatTile label="Batches Done" value={String(completedBatches)} emoji="🔥" />
        </div>

        {/* ── Weekly Batch System ── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, marginTop: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: '0 0 2px' }}>Weekly Batches</p>
            <p style={{ fontSize: 11, color: '#bbb', margin: 0 }}>7 days = 1 batch. Completed batches are locked forever.</p>
          </div>
          {batches.map(batch => {
            const rewardLabel = getBatchRewardLabel(batch.batchNumber);
            return (
              <div key={batch.batchNumber} style={{
                marginBottom: 12,
                padding: '12px 14px',
                borderRadius: 14,
                background: batch.isLocked ? '#FAFAFA' : batch.isComplete ? '#F0FDF4' : '#FFF7F0',
                border: batch.isCurrent ? '2px solid #F59E0B' : batch.isComplete ? '1.5px solid #86EFAC' : '1.5px solid #F0F0F0',
                opacity: batch.isLocked ? 0.5 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {batch.isComplete && <span style={{ fontSize: 16 }}>🔒</span>}
                    {batch.isCurrent && <span style={{ fontSize: 16 }}>🔥</span>}
                    {batch.isLocked  && <span style={{ fontSize: 16 }}>⭕</span>}
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#1A1A1A' }}>
                      Batch {batch.batchNumber} — Days {batch.startDay}–{batch.endDay}
                    </span>
                  </div>
                  {batch.isComplete && rewardLabel && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', background: '#DCFCE7', borderRadius: 8, padding: '2px 8px' }}>
                      {rewardLabel}
                    </span>
                  )}
                  {batch.isCurrent && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#92400E', background: '#FEF3C7', borderRadius: 8, padding: '2px 8px' }}>
                      {batchProgress}/7 days
                    </span>
                  )}
                </div>
                {/* 7 day dots */}
                <div style={{ display: 'flex', gap: 5 }}>
                  {batch.days.map((d, i) => (
                    <div key={i} style={{
                      flex: 1,
                      height: 8,
                      borderRadius: 4,
                      background: d.completed
                        ? (batch.isComplete ? '#22C55E' : '#F59E0B')
                        : (batch.isCurrent ? '#E8E8E8' : '#F0F0F0'),
                      transition: 'background 300ms ease',
                    }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── 30-Day Calendar ── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, marginTop: 12, marginBottom: 0, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: '0 0 2px' }}>30-Day History</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
              {[
                { dot: '#22C55E', label: 'Egg scanned' },
                { dot: '#D71920', label: 'Today (not yet)' },
                { dot: '#E8E8E8', label: 'Missed' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: l.dot }} />
                  <span style={{ fontSize: 10, color: '#bbb', fontWeight: 600 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 1fr)',
            gap: 4,
          }}>
            {last30.map(dateKey => {
              const rec       = historyMap.get(dateKey);
              const isToday   = dateKey === today;
              const completed = !!rec?.completed;
              const dayNum    = parseInt(dateKey.slice(8, 10), 10);
              const monthAbbr = new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' });

              let bg    = '#F0F0F0';
              let emoji = '';
              if (completed) { bg = '#DCFCE7'; emoji = '🥚'; }
              else if (isToday && !completed) { bg = '#FCE8E8'; emoji = '🔥'; }

              return (
                <div key={dateKey} style={{
                  background: bg,
                  borderRadius: 8,
                  padding: '5px 2px',
                  textAlign: 'center',
                  border: isToday ? '2px solid #D71920' : '1.5px solid transparent',
                }}>
                  <div style={{ fontSize: 14, lineHeight: 1 }}>{emoji || '·'}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, color: '#999', marginTop: 2 }}>{dayNum}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Milestone road ── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, marginTop: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: '0 0 12px' }}>Milestone Road</p>
          {[
            { days: 3,   emoji: '🐣', label: 'Hatching' },
            { days: 7,   emoji: '🔥', label: 'On Fire' },
            { days: 14,  emoji: '🔥🔥', label: 'Double Fire' },
            { days: 21,  emoji: '⭐', label: 'Consistent' },
            { days: 30,  emoji: '👑', label: 'Egg Master' },
            { days: 50,  emoji: '💎', label: 'Diamond Egg' },
            { days: 75,  emoji: '🚀', label: 'Unstoppable' },
            { days: 100, emoji: '🏆', label: 'Century Streak' },
          ].map(m => {
            const reached = currentStreak >= m.days;
            return (
              <div key={m.days} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                marginBottom: 10,
                opacity: reached ? 1 : 0.45,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: reached ? '#FCE8E8' : '#F0F0F0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  {m.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: reached ? '#1A1A1A' : '#bbb', margin: 0 }}>{m.label}</p>
                  <p style={{ fontSize: 10, color: '#ccc', margin: 0 }}>{m.days} day streak</p>
                </div>
                {reached && (
                  <div style={{ fontSize: 16 }}>✅</div>
                )}
                {!reached && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#bbb' }}>
                    {m.days - currentStreak}d left
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function StatTile({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '12px 8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
      <p style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 9, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.3, margin: '3px 0 0' }}>{label}</p>
    </div>
  );
}

function StreakSkeleton() {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ height: 260, background: 'linear-gradient(135deg,#D71920,#B31217)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
