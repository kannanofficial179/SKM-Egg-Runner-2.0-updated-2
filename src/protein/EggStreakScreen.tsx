/**
 * SKM Egg Streaks — Premium streak tracking screen v2
 *
 * Weekly batches now displayed newest-first.
 * Sticker road uses SVG artwork via StickerArt.
 * Calendar uses local date keys (consistent with dateHelpers).
 */

import { useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import {
  getEggStreakData, getStreakHistory,
  getStreakEmoji, getStreakTitle, getStreakFireLevel,
  getMotivationalMessage, getBatchRewardLabel, buildBatches,
  type EggStreakData, type StreakDayRecord,
} from '../services/protein/eggStreakService';
import {
  MILESTONES, MILESTONE_DAYS, getClaimedStickers, getMilestone,
  RARITY_COLOR,
  type MilestoneDef,
} from '../services/protein/milestoneRewardService';
import { todayKey, dateKeyFor } from '../utils/dateHelpers';
import MilestoneRewardModal from './MilestoneRewardModal';
import StickerArt from './StickerArt';

interface EggStreakScreenProps {
  user: User;
  refreshKey: number;
  onScanQR: () => void;
}

export default function EggStreakScreen({ user, refreshKey, onScanQR }: EggStreakScreenProps) {
  const [data,            setData]            = useState<EggStreakData | null>(null);
  const [history,         setHistory]         = useState<StreakDayRecord[]>([]);
  const [claimed,         setClaimed]         = useState<Set<number>>(new Set());
  const [activeMilestone, setActiveMilestone] = useState<MilestoneDef | null>(null);
  const [loading,         setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, h, cl] = await Promise.all([
        getEggStreakData(user.uid),
        getStreakHistory(user.uid, 30),
        getClaimedStickers(user.uid),
      ]);
      setData(d); setHistory(h); setClaimed(cl);
    } catch (e) {
      console.error('[EggStreak]', e);
    } finally {
      setLoading(false);
    }
  }, [user.uid]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (loading) return <StreakSkeleton />;
  if (!data)   return null;

  const { currentStreak, bestStreak, totalEggDays, todayCompleted, todayTime, completedBatches, batchProgress } = data;

  const emoji     = getStreakEmoji(currentStreak);
  const title     = getStreakTitle(currentStreak);
  const fireLevel = getStreakFireLevel(currentStreak);
  const message   = getMotivationalMessage(currentStreak, todayCompleted);

  // Weekly batches — current first, then upcoming locked (ascending), then completed (descending)
  const batchesAsc = buildBatches(currentStreak, completedBatches);
  const current    = batchesAsc.filter(b => b.isCurrent);
  const locked     = batchesAsc.filter(b => b.isLocked);        // ascending already
  const completed  = batchesAsc.filter(b => b.isComplete).reverse(); // newest completed first
  const batches    = [...current, ...locked, ...completed];

  // Build a quick lookup for calendar
  const historyMap = new Map(history.map(r => [r.dateKey, r]));

  // Last 30 days in local time, newest first
  const today   = todayKey();
  const last30: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last30.push(dateKeyFor(d));
  }

  const heroGrad = currentStreak >= 100
    ? 'linear-gradient(135deg,#92400E,#D97706)'
    : currentStreak >= 30
    ? 'linear-gradient(135deg,#7C3AED,#EC4899)'
    : currentStreak >= 14
    ? 'linear-gradient(135deg,#B45309,#D97706)'
    : 'linear-gradient(135deg,#D71920,#B31217)';

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>

      {/* ── Hero Card ── */}
      <div style={{
        background: heroGrad,
        padding: '36px 20px 44px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Fire rings */}
        {fireLevel >= 1 && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[0, 1, 2].slice(0, fireLevel).map(i => (
              <div key={i} style={{
                position: 'absolute',
                width: 120 + i * 60, height: 120 + i * 60,
                borderRadius: '50%',
                border: `2px solid rgba(255,255,255,${0.12 - i * 0.03})`,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                animation: `pulse-ring ${1.5 + i * 0.4}s ease-out infinite`,
                animationDelay: `${i * 0.35}s`,
              }} />
            ))}
          </div>
        )}

        {/* Flame emoji */}
        <div style={{
          fontSize: 64, lineHeight: 1, marginBottom: 10,
          filter: fireLevel >= 2 ? 'drop-shadow(0 0 16px rgba(255,200,50,0.7))' : 'none',
          animation: currentStreak > 0 ? 'float 2.5s ease-in-out infinite' : 'none',
        }}>
          {emoji}
        </div>

        {/* Streak number */}
        <div style={{
          fontSize: currentStreak >= 100 ? 72 : 88,
          fontWeight: 900, color: '#fff', lineHeight: 1,
          letterSpacing: -3, textShadow: '0 4px 24px rgba(0,0,0,0.35)',
        }}>
          {currentStreak}
        </div>

        {/* DAY STREAK label */}
        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.65)', marginTop: 4, letterSpacing: 3, textTransform: 'uppercase' }}>
          DAY STREAK
        </div>

        {/* Title pill */}
        <div style={{
          display: 'inline-block', marginTop: 10,
          padding: '5px 16px', borderRadius: 50,
          background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
          fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: 0.3,
        }}>
          {title}
        </div>

        {/* Glassmorphism stats bar */}
        <div style={{
          background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(12px)',
          borderRadius: 20, padding: '12px 0', marginTop: 20,
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
        }}>
          {[
            { value: bestStreak,        label: 'Best Streak', icon: '🏆', border: true  },
            { value: totalEggDays,      label: 'Total Eggs',  icon: '🥚', border: true  },
            { value: completedBatches,  label: 'Batches Done',icon: '🔥', border: false },
          ].map((cell, ci) => (
            <div key={ci} style={{
              textAlign: 'center',
              borderRight: cell.border ? '1px solid rgba(255,255,255,0.15)' : 'none',
            }}>
              <div style={{ fontSize: 14, lineHeight: 1, marginBottom: 4 }}>{cell.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{cell.value}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 }}>{cell.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Motivational ── */}
      <div style={{
        margin: '12px 14px 0', padding: '14px 16px',
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

        {/* ── Weekly Batches ── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, marginTop: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: '0 0 2px' }}>Weekly Batches</p>
            <p style={{ fontSize: 11, color: '#bbb', margin: 0 }}>7 days = 1 batch · Current week always shown first</p>
          </div>

          {batches.map((batch, idx) => {
            const rewardLabel    = getBatchRewardLabel(batch.batchNumber);
            const daysCompleted  = batch.days.filter(d => d.completed).length;
            const pct            = Math.round((daysCompleted / 7) * 100);

            // Calendar dates for this batch
            const daysAgoEnd    = currentStreak - batch.startDay;
            const daysAgoStart  = currentStreak - batch.endDay;
            const batchStartDate = (() => { const d = new Date(); d.setDate(d.getDate() - daysAgoEnd); return d; })();
            const batchEndDate   = (() => { const d = new Date(); d.setDate(d.getDate() - Math.max(0, daysAgoStart)); return d; })();
            const fmt            = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const dateRange      = `${fmt(batchStartDate)} – ${fmt(batchEndDate)}`;

            // Section dividers
            const prevBatch     = batches[idx - 1];
            const showUpcoming  = batch.isLocked  && !prevBatch?.isLocked  && !prevBatch?.isCurrent === false;
            const showCompleted = batch.isComplete && !prevBatch?.isComplete;

            // Determine if upcoming divider should show (first locked batch)
            const isFirstLocked    = batch.isLocked  && (!prevBatch || !prevBatch.isLocked);
            const isFirstCompleted = batch.isComplete && (!prevBatch || !prevBatch.isComplete);

            return (
              <div key={batch.batchNumber}>

                {/* ── Section divider: Upcoming ── */}
                {isFirstLocked && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 12px' }}>
                    <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                      🔒 UPCOMING BATCHES
                    </span>
                    <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
                  </div>
                )}

                {/* ── Section divider: Completed ── */}
                {isFirstCompleted && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 12px' }}>
                    <div style={{ flex: 1, height: 1, background: '#DCFCE7' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#22C55E', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                      ✅ COMPLETED BATCHES
                    </span>
                    <div style={{ flex: 1, height: 1, background: '#DCFCE7' }} />
                  </div>
                )}

                {/* ── CURRENT batch card ── */}
                {batch.isCurrent && (
                  <div style={{
                    marginBottom: 12, padding: '16px',
                    borderRadius: 18,
                    background: 'linear-gradient(135deg, #FFF7ED, #FFFBF0)',
                    border: '2px solid #F59E0B',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.18)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Animated glow border */}
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: 18, pointerEvents: 'none',
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.06), transparent)',
                    }} />

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 3px 10px rgba(245,158,11,0.35)',
                        }}>
                          <span style={{ fontSize: 18 }}>🔥</span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <p style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>
                              Week {batch.batchNumber}
                            </p>
                            <span style={{
                              fontSize: 9, fontWeight: 800, color: '#fff',
                              background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                              borderRadius: 6, padding: '2px 7px', letterSpacing: 0.5,
                              animation: 'batch-pulse 2s ease-in-out infinite',
                            }}>
                              CURRENT
                            </span>
                          </div>
                          <p style={{ fontSize: 10, color: '#92400E', margin: '2px 0 0', fontWeight: 600 }}>{dateRange}</p>
                        </div>
                      </div>
                      {/* Progress ring / counter */}
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                        background: `conic-gradient(#F59E0B ${pct * 3.6}deg, #F3F4F6 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: '#FFFBF0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'column',
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 900, color: '#92400E', lineHeight: 1 }}>{batchProgress}</span>
                          <span style={{ fontSize: 7, color: '#bbb', fontWeight: 700 }}>/7</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {[
                        { label: `${daysCompleted}/7 Eggs`, bg: '#FEF3C7', color: '#92400E' },
                        { label: `${daysCompleted * 6}g Protein`, bg: '#FEF3C7', color: '#92400E' },
                        { label: `${pct}% Done`, bg: '#FEF3C7', color: '#92400E' },
                      ].map(s => (
                        <span key={s.label} style={{
                          fontSize: 10, fontWeight: 700, color: s.color,
                          background: s.bg, borderRadius: 8, padding: '3px 8px',
                        }}>{s.label}</span>
                      ))}
                    </div>

                    {/* Day mini-cards */}
                    <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
                      {batch.days.map((d, i) => {
                        const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
                        const isPast   = d.completed;
                        const isCurDay = !d.completed && i === batch.days.filter(x => x.completed).length;
                        return (
                          <div key={i} style={{
                            flex: 1, borderRadius: 10, padding: '6px 2px', textAlign: 'center',
                            background: isPast ? 'linear-gradient(160deg,#F59E0B,#D97706)' : isCurDay ? 'rgba(245,158,11,0.12)' : '#F0F0F0',
                            border: isCurDay ? '1.5px solid #F59E0B' : '1.5px solid transparent',
                            boxShadow: isPast ? '0 3px 8px rgba(245,158,11,0.35)' : 'none',
                            transition: 'all 200ms',
                          }}>
                            <div style={{ fontSize: isPast ? 14 : 10, lineHeight: 1, marginBottom: 2 }}>
                              {isPast ? '🥚' : isCurDay ? '🔥' : '·'}
                            </div>
                            <div style={{ fontSize: 7, fontWeight: 800, color: isPast ? '#fff' : isCurDay ? '#D97706' : '#bbb' }}>
                              {dayNames[i]}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Days remaining */}
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#92400E', margin: 0 }}>
                      🎯 {7 - daysCompleted} day{7 - daysCompleted !== 1 ? 's' : ''} remaining in this batch
                    </p>
                  </div>
                )}

                {/* ── LOCKED batch card ── */}
                {batch.isLocked && (
                  <div style={{
                    marginBottom: 10, padding: '13px 14px',
                    borderRadius: 14,
                    background: '#FAFAFA',
                    border: '1.5px solid #F0F0F0',
                    opacity: 0.7,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: '#EFEFEF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15,
                    }}>🔒</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: '#888', margin: 0 }}>
                        Week {batch.batchNumber}
                      </p>
                      <p style={{ fontSize: 10, color: '#ccc', margin: '2px 0 0', fontWeight: 600 }}>
                        Unlocks after Week {batch.batchNumber - 1} is complete
                      </p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#ccc' }}>Locked</span>
                  </div>
                )}

                {/* ── COMPLETED batch card ── */}
                {batch.isComplete && (
                  <div style={{
                    marginBottom: 10, padding: '14px',
                    borderRadius: 16,
                    background: '#F0FDF4',
                    border: '1.5px solid #86EFAC',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                          background: 'linear-gradient(135deg,#22C55E,#16A34A)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, boxShadow: '0 3px 8px rgba(34,197,94,0.3)',
                        }}>✅</div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 900, color: '#166534', margin: 0 }}>
                            Week {batch.batchNumber}
                          </p>
                          <p style={{ fontSize: 9, color: '#16A34A', margin: '2px 0 0', fontWeight: 600 }}>{dateRange}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, color: '#fff',
                          background: 'linear-gradient(135deg,#22C55E,#16A34A)',
                          borderRadius: 7, padding: '2px 8px', display: 'block', marginBottom: 3,
                        }}>COMPLETED</span>
                        {rewardLabel && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#166534' }}>{rewardLabel}</span>
                        )}
                      </div>
                    </div>

                    {/* Day bars */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {batch.days.map((d, i) => (
                        <div key={i} style={{
                          flex: 1, height: 7, borderRadius: 4,
                          background: d.completed ? '#22C55E' : '#DCFCE7',
                        }} />
                      ))}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>

        {/* ── 30-Day History Timeline ── */}
        <HistoryTimeline
          last30={last30}
          today={today}
          historyMap={historyMap}
          currentStreak={currentStreak}
          claimedSet={claimed}
        />

        {/* ── Milestone Road ── */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 16, marginTop: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Milestone Road</p>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#bbb' }}>
              {claimed.size}/{MILESTONES.length} claimed
            </span>
          </div>

          {MILESTONES.map(m => {
            const reached   = currentStreak >= m.days;
            const isClaimed = claimed.has(m.days);
            const claimable = reached && !isClaimed;
            const rc        = RARITY_COLOR[m.rarity];
            // Days remaining — always computed from actual streak, never from dev offsets
            const daysLeft  = Math.max(0, m.days - currentStreak);

            return (
              <div key={m.days} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                marginBottom: 10, padding: '10px 12px', borderRadius: 14,
                background: isClaimed ? '#F0FDF4' : claimable ? '#FFFBEB' : '#FAFAFA',
                border: claimable ? '1.5px solid #F59E0B' : isClaimed ? '1.5px solid #86EFAC' : '1.5px solid transparent',
                opacity: reached ? 1 : 0.55,
                transition: 'all 200ms',
                animation: claimable ? 'milestone-glow 2s ease-in-out infinite' : 'none',
              }}>
                {/* SVG sticker */}
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: isClaimed
                    ? `linear-gradient(135deg,${m.color}22,${m.color2}11)`
                    : '#F0F0F0',
                  border: isClaimed ? `1.5px solid ${m.color}44` : '1.5px solid #E8E8E8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isClaimed ? `0 4px 12px ${m.color}33` : 'none',
                  overflow: 'hidden',
                }}>
                  <StickerArt days={m.days} fallback={m.sticker} size={36} locked={!reached} />
                </div>

                {/* Labels */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: reached ? '#1A1A1A' : '#bbb', margin: 0 }}>
                      {m.label}
                    </p>
                    <span style={{
                      fontSize: 8, fontWeight: 800, color: rc,
                      background: `${rc}15`, borderRadius: 4, padding: '1px 5px', letterSpacing: 0.3,
                    }}>
                      {m.rarity.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: '#999', margin: 0 }}>
                    {m.stickerName} · {m.days}d streak
                  </p>
                </div>

                {/* Right side */}
                {isClaimed && (
                  <div style={{
                    background: '#DCFCE7', borderRadius: 8, padding: '4px 10px',
                    display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#166534' }}>✅ Claimed</span>
                  </div>
                )}
                {claimable && (
                  <button
                    onClick={() => setActiveMilestone(getMilestone(m.days) ?? null)}
                    style={{
                      background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                      border: 'none', borderRadius: 10, padding: '6px 12px',
                      cursor: 'pointer', flexShrink: 0,
                      boxShadow: '0 3px 10px rgba(245,158,11,0.45)',
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>🎁 Claim</span>
                  </button>
                )}
                {!reached && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#ccc', flexShrink: 0, textAlign: 'right' }}>
                    {daysLeft}d left
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      <MilestoneRewardModal
        uid={user.uid}
        milestone={activeMilestone}
        onClaimed={() => { setClaimed(prev => new Set([...prev, activeMilestone!.days])); }}
        onClose={() => setActiveMilestone(null)}
      />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes pulse-ring {
          0%   { transform: translate(-50%,-50%) scale(1); opacity: 0.6; }
          100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; }
        }
        @keyframes batch-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.65; }
        }
        @keyframes milestone-glow {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          50%      { box-shadow: 0 0 0 6px rgba(245,158,11,0.25); }
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

// ── 30-Day History Timeline ────────────────────────────────────────────────

interface HistoryTimelineProps {
  last30:        string[];
  today:         string;
  historyMap:    Map<string, StreakDayRecord>;
  currentStreak: number;
  claimedSet:    Set<number>;
}

function HistoryTimeline({ last30, today, historyMap, currentStreak, claimedSet }: HistoryTimelineProps) {
  const [selected, setSelected] = useState<string | null>(null);

  // Day label relative to today
  function dayLabel(idx: number): string {
    if (idx === 0) return 'TODAY';
    if (idx === 1) return 'YESTERDAY';
    return `${idx}D AGO`;
  }

  // Friendly date: "2 Jul"
  function friendlyDate(dateKey: string): string {
    return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  // Which streak day number is this date? (currentStreak = today if completed)
  function streakDayFor(idx: number, completed: boolean): number | null {
    if (!completed) return null;
    // idx 0 = today, which is currentStreak days into the streak
    const dayNum = currentStreak - idx;
    return dayNum > 0 ? dayNum : null;
  }

  // Is this date a milestone day?
  function milestoneForDay(idx: number, completed: boolean): number | null {
    const sday = streakDayFor(idx, completed);
    if (!sday) return null;
    return MILESTONE_DAYS.includes(sday) ? sday : null;
  }

  const selectedRec = selected ? historyMap.get(selected) : null;
  const selectedIdx = selected ? last30.indexOf(selected) : -1;

  return (
    <div style={{ background: '#fff', borderRadius: 20, marginTop: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: '0 0 2px' }}>30-Day History</p>
          <p style={{ fontSize: 10, color: '#bbb', margin: 0 }}>Today first · Scroll to see older days</p>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { dot: 'linear-gradient(135deg,#22C55E,#16A34A)', label: 'Scanned' },
            { dot: 'linear-gradient(135deg,#D71920,#B31217)', label: 'Today' },
            { dot: '#E8E8E8', label: 'Missed' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: '#bbb', fontWeight: 600 }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Horizontal scroll track */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 16px',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}>
        <style>{`.ht-scroll::-webkit-scrollbar { display: none; }`}</style>

        {last30.map((dateKey, idx) => {
          const rec         = historyMap.get(dateKey);
          const isToday     = dateKey === today;
          const completed   = !!rec?.completed;
          const missed      = !completed && !isToday;
          const mDay        = milestoneForDay(idx, completed);
          const isMilestone = mDay !== null;
          const sday        = streakDayFor(idx, completed);
          const isSelected  = dateKey === selected;

          // Card dimensions
          const cardW = isToday ? 100 : 72;

          // Colors
          let cardBg     = '#F5F5F5';
          let cardBorder = '1.5px solid #EFEFEF';
          let cardShadow = 'none';
          if (isToday && completed)   { cardBg = 'linear-gradient(160deg,#FFF7ED,#FEF3C7)'; cardBorder = '2px solid #F59E0B'; cardShadow = '0 6px 20px rgba(245,158,11,0.25)'; }
          else if (isToday)           { cardBg = 'linear-gradient(160deg,#FEF2F2,#FEE2E2)'; cardBorder = '2px solid #D71920'; cardShadow = '0 6px 20px rgba(215,25,32,0.2)'; }
          else if (isMilestone)       { cardBg = 'linear-gradient(160deg,#FFFBEB,#FEF3C7)'; cardBorder = '1.5px solid #F59E0B'; cardShadow = '0 4px 14px rgba(245,158,11,0.2)'; }
          else if (completed)         { cardBg = 'linear-gradient(160deg,#F0FDF4,#DCFCE7)'; cardBorder = '1.5px solid #86EFAC'; cardShadow = '0 3px 10px rgba(34,197,94,0.15)'; }

          return (
            <div
              key={dateKey}
              onClick={() => completed || isToday ? setSelected(isSelected ? null : dateKey) : undefined}
              style={{
                width: cardW, minWidth: cardW, flexShrink: 0,
                borderRadius: isToday ? 18 : 14,
                background: cardBg,
                border: cardBorder,
                boxShadow: isSelected ? `0 0 0 2px #D71920, ${cardShadow}` : cardShadow,
                padding: isToday ? '14px 10px 12px' : '10px 6px 8px',
                textAlign: 'center',
                cursor: completed || isToday ? 'pointer' : 'default',
                position: 'relative',
                transition: 'transform 120ms, box-shadow 120ms',
                animation: isToday ? 'ht-today-pulse 2.8s ease-in-out infinite' : 'none',
              }}
              onPointerDown={e => { if (completed || isToday) e.currentTarget.style.transform = 'scale(0.94)'; }}
              onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
              onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {/* TODAY ribbon */}
              {isToday && (
                <div style={{
                  position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                  background: completed
                    ? 'linear-gradient(135deg,#F59E0B,#D97706)'
                    : 'linear-gradient(135deg,#D71920,#B31217)',
                  borderRadius: '0 0 8px 8px',
                  padding: '2px 10px',
                  fontSize: 8, fontWeight: 900, color: '#fff', letterSpacing: 0.8,
                  whiteSpace: 'nowrap',
                }}>TODAY</div>
              )}

              {/* Milestone crown */}
              {isMilestone && !isToday && (
                <div style={{
                  position: 'absolute', top: -7, right: -5,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, boxShadow: '0 2px 6px rgba(245,158,11,0.45)',
                }}>⭐</div>
              )}

              {/* Day label */}
              <p style={{
                fontSize: isToday ? 9 : 7, fontWeight: 800, margin: isToday ? '10px 0 4px' : '4px 0 3px',
                color: isToday ? '#92400E' : (completed ? '#166534' : '#ccc'),
                letterSpacing: 0.4, lineHeight: 1,
              }}>
                {dayLabel(idx)}
              </p>

              {/* Date */}
              <p style={{
                fontSize: isToday ? 11 : 9, fontWeight: 700, margin: '0 0 6px',
                color: isToday ? '#1A1A1A' : '#888', lineHeight: 1,
              }}>
                {friendlyDate(dateKey)}
              </p>

              {/* Status icon */}
              <div style={{ fontSize: isToday ? 22 : 18, lineHeight: 1, marginBottom: 4 }}>
                {isMilestone ? '🏆' : completed ? '🥚' : isToday ? '🔥' : '·'}
              </div>

              {/* Protein badge */}
              {completed && (
                <div style={{
                  display: 'inline-block', padding: '2px 5px', borderRadius: 6,
                  background: isMilestone ? '#FEF3C7' : '#DCFCE7',
                  fontSize: isToday ? 9 : 8, fontWeight: 700,
                  color: isMilestone ? '#92400E' : '#166534',
                  lineHeight: 1.2,
                }}>
                  +6g
                </div>
              )}

              {/* Streak day number */}
              {sday !== null && (
                <p style={{
                  fontSize: 7, fontWeight: 800, color: '#bbb', margin: '3px 0 0', lineHeight: 1,
                }}>
                  Day {sday}
                </p>
              )}

              {/* Missed label */}
              {missed && (
                <p style={{ fontSize: 7, fontWeight: 700, color: '#ddd', margin: '2px 0 0', lineHeight: 1 }}>
                  Missed
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Day detail panel (expands below when a card is tapped) ── */}
      {selected && (selectedRec?.completed || selectedIdx === 0) && (
        <div style={{
          margin: '0 16px 16px',
          background: '#F8F8F8', borderRadius: 16, padding: '14px 16px',
          animation: 'ht-slide-down 220ms cubic-bezier(0.34,1.3,0.64,1)',
          border: '1.5px solid #EFEFEF',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>
                {selectedIdx === 0 ? 'Today' : selectedIdx === 1 ? 'Yesterday' : `${selectedIdx} Days Ago`}
              </p>
              <p style={{ fontSize: 11, color: '#bbb', margin: '2px 0 0', fontWeight: 600 }}>
                {friendlyDate(selected)}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: '#EFEFEF', border: 'none', cursor: 'pointer',
                fontSize: 13, color: '#888', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <DetailCell
              label="Protein"
              value={selectedRec?.completed ? '+6g' : '—'}
              color={selectedRec?.completed ? '#22C55E' : '#ccc'}
            />
            <DetailCell
              label="Status"
              value={selectedRec?.completed ? 'Scanned ✅' : (selectedIdx === 0 ? 'Pending 🔥' : 'Missed')}
              color={selectedRec?.completed ? '#22C55E' : (selectedIdx === 0 ? '#D97706' : '#ccc')}
            />
            <DetailCell
              label="Time"
              value={selectedRec?.time ?? '—'}
              color="#1A1A1A"
            />
          </div>

          {(() => {
            const sday = streakDayFor(selectedIdx, !!selectedRec?.completed);
            const mDay = sday && MILESTONE_DAYS.includes(sday) ? sday : null;
            if (!mDay) return null;
            const claimed = claimedSet.has(mDay);
            return (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 12,
                background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
                border: '1.5px solid #F59E0B44',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 16 }}>🏆</span>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 800, color: '#92400E', margin: 0 }}>
                    Milestone Day · {mDay}-Day Streak
                  </p>
                  <p style={{ fontSize: 10, color: '#bbb', margin: '1px 0 0' }}>
                    {claimed ? '✅ Sticker Claimed' : 'Sticker Reward Available'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <style>{`
        @keyframes ht-today-pulse {
          0%, 100% { box-shadow: 0 6px 20px rgba(215,25,32,0.15); }
          50%       { box-shadow: 0 6px 28px rgba(215,25,32,0.32); }
        }
        @keyframes ht-slide-down {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function DetailCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
      <p style={{ fontSize: 8, fontWeight: 800, color: '#ccc', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 3px' }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 800, color, margin: 0, lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}
