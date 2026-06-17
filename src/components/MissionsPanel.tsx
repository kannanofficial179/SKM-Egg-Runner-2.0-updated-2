import React from 'react';
import { Mission, Achievement } from '../types';
import { Trophy, Compass, CheckCircle, Award } from 'lucide-react';
import { soundManager } from '../audio';

interface MissionsPanelProps {
  missions: Mission[];
  achievements: Achievement[];
  onClaimMission: (id: string) => void;
  onClaimAchievement: (id: string) => void;
  onClose: () => void;
}

export const MissionsPanel: React.FC<MissionsPanelProps> = ({
  missions,
  achievements,
  onClaimMission,
  onClaimAchievement,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2 font-sans">
              <Trophy className="text-amber-500 w-6 h-6" />
              Missions & Achievements
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Complete various farm running goals to yield rewards and boost your experience!
            </p>
          </div>
          <button
            id="btn_close_missions"
            onClick={() => { soundManager.playClick(); onClose(); }}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm transition"
          >
            ✕ Close
          </button>
        </div>

        {/* Categories split */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
          {/* Active Missions Category */}
          <div className="flex flex-col">
            <h3 className="text-white font-bold text-base flex items-center gap-2 border-b border-slate-800 pb-2 mb-4 font-sans">
              <Compass className="text-sky-400 w-5 h-5" />
              Daily Farm Missions
            </h3>

            <div className="space-y-4 flex-1">
              {missions.length === 0 ? (
                <div className="text-slate-500 text-xs font-mono p-4 text-center">
                  All daily farm missions claimed! Check back tomorrow.
                </div>
              ) : (
                missions.map((m) => {
                  const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
                  const isReady = m.progress >= m.target && !m.claimed;
                  const isClaimed = m.claimed;

                  return (
                    <div
                      key={m.id}
                      className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-slate-200 text-sm font-sans font-medium">{m.text}</p>
                          {isClaimed && (
                            <span className="text-emerald-500 text-xs font-bold font-mono">Claimed</span>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                            <span>PROGRESS</span>
                            <span>{m.progress} / {m.target} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                pct >= 100 ? 'bg-emerald-500' : 'bg-sky-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Prize and CTA */}
                      <div className="mt-3 flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                        <span className="text-[10px] text-slate-400 font-mono">
                          REWARD:{' '}
                          <span className="text-yellow-400 font-bold ml-1">
                            {m.rewardType === 'feeds' ? '🌾' : '💎'} {m.rewardValue} {m.rewardType.toUpperCase()}
                          </span>
                        </span>

                        {isReady ? (
                          <button
                            id={`btn_claim_mission_${m.id}`}
                            onClick={() => { soundManager.playLevelUp(); onClaimMission(m.id); }}
                            className="bg-emerald-500 hover:bg-emerald-400 text-slate-955 font-bold px-3 py-1 rounded-md text-xs font-sans transition cursor-pointer"
                          >
                            Claim Prize
                          </button>
                        ) : isClaimed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="text-[10px] text-slate-500 font-mono">Running...</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Lifetime Achievements Category */}
          <div className="flex flex-col">
            <h3 className="text-white font-bold text-base flex items-center gap-2 border-b border-slate-800 pb-2 mb-4 font-sans">
              <Award className="text-yellow-400 w-5 h-5" />
              Lifetime Achievements
            </h3>

            <div className="space-y-4">
              {achievements.map((a) => {
                const pct = Math.min(100, Math.round((a.progress / a.target) * 100));
                const isReady = a.progress >= a.target && !a.claimed;
                const isClaimed = a.claimed;

                return (
                  <div
                    key={a.id}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between gap-2">
                        <div>
                          <h4 className="text-slate-200 text-sm font-sans font-bold">{a.name}</h4>
                          <p className="text-slate-400 text-xs mt-0.5 font-sans leading-relaxed">
                            {a.description}
                          </p>
                        </div>
                        {isClaimed && (
                          <span className="text-yellow-500 text-xs font-bold font-mono">Unlocked</span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                          <span>COMPLETION</span>
                          <span>{a.progress} / {a.target} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              pct >= 100 ? 'bg-yellow-500' : 'bg-amber-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Prize and CTA */}
                    <div className="mt-3 flex justify-between items-center bg-slate-900/60 p-2 rounded-lg border border-slate-800/40">
                      <span className="text-[10px] text-slate-400 font-mono">
                        BONUS:{' '}
                        <span className="text-emerald-400 font-bold ml-1">
                          {a.rewardType === 'feeds' ? '🌾' : '💎'} {a.rewardValue} {a.rewardType.toUpperCase()}
                        </span>
                      </span>

                      {isReady ? (
                        <button
                          id={`btn_claim_ach_${a.id}`}
                          onClick={() => { soundManager.playLevelUp(); onClaimAchievement(a.id); }}
                          className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold px-3 py-1 rounded-md text-xs font-sans transition cursor-pointer"
                        >
                          Unlock Medal
                        </button>
                      ) : isClaimed ? (
                        <CheckCircle className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Locked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
