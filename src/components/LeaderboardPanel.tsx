import React, { useState, useMemo } from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy, Calendar, EyeOff, Award, Wifi, ShieldAlert, WifiOff } from 'lucide-react';
import { soundManager } from '../audio';

interface LeaderboardPanelProps {
  playerStats: {
    name: string;
    highscore: number;
    totalFeeds: number;
    totalEggs: number;
    maxDistance: number;
  };
  onClose: () => void;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  playerStats,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'alltime'>('alltime');

  // Load real history of saved records from localstorage
  const listEntries = useMemo<LeaderboardEntry[]>(() => {
    try {
      const stored = localStorage.getItem('skm_chicken_run_leaderboard_v1');
      let parsed: LeaderboardEntry[] = [];
      if (stored) {
        parsed = JSON.parse(stored);
      }

      // Filter to keep ONLY real local player entries and prevent any dummy rows
      parsed = parsed.filter(entry => {
        if (!entry || !entry.name) return false;
        const isRealUser = entry.isPlayer || entry.name === playerStats.name;
        const isDummy = [
          'theevanam', 'king', 'dummy', 'guest', 'placeholder', 'anonymous', 'sample', 'test'
        ].some(dummyWord => entry.name.toLowerCase().includes(dummyWord));
        return isRealUser && !isDummy;
      });

      // Always inject the current user's best run as a verified record
      const hasCurrentUser = parsed.some(e => e.isPlayer || e.name === playerStats.name);
      if (!hasCurrentUser && playerStats.highscore > 0) {
        parsed.push({
          name: playerStats.name || 'Anonymous Runner',
          score: playerStats.highscore,
          feeds: playerStats.totalFeeds,
          distance: playerStats.maxDistance,
          eggs: playerStats.totalEggs,
          date: new Date().toISOString().split('T')[0],
          isPlayer: true
        });
      }

      // Sort descending by highest score
      parsed.sort((a, b) => b.score - a.score);

      // Keep unique names for real records to show highest personal runs
      const uniqueMap = new Map<string, LeaderboardEntry>();
      parsed.forEach(entry => {
        if (!uniqueMap.has(entry.name)) {
          uniqueMap.set(entry.name, entry);
        }
      });
      return Array.from(uniqueMap.values());
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [playerStats]);

  // Find player's rank
  const playerRank = useMemo(() => {
    return listEntries.findIndex(e => e.isPlayer || e.name === playerStats.name) + 1;
  }, [listEntries, playerStats.name]);

  return (
    <div id="leaderboard_overlay" className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div id="leaderboard_container" className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col font-sans">
        
        {/* Header bar */}
        <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
              <Trophy className="text-yellow-400 w-5 h-5" />
              Poultry Champion Hall
            </h2>
            <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase">
              RECORDS FROM LOCAL PLAYER CHANNELS ONLY
            </p>
          </div>
          <button
            id="btn_close_leaderboard"
            onClick={() => { soundManager.playClick(); onClose(); }}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Offline Disclaimer */}
        <div className="bg-slate-950 border border-slate-850 p-3 rounded-2xl mb-4 flex items-center gap-3 text-left">
          <WifiOff className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="font-mono text-[9px] leading-relaxed text-slate-400">
            <span className="text-amber-500 font-black block uppercase">LOCAL RUNS ARCHIVE (ONLINE STANDBY)</span>
             <span className="text-yellow-400 font-extrabold font-sans"><h1>Online rankings coming soon.</h1></span> 
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex bg-slate-950 p-1 border border-slate-850 rounded-xl mb-4 text-[10px] uppercase font-bold text-slate-400 tracking-wide">
          <button
            id="btn_tab_local"
            onClick={() => soundManager.playClick()}
            className="flex-1 py-1.5 bg-yellow-500 text-slate-950 rounded-lg font-black text-center"
          >
            Local Hall of Fame
          </button>
          <div className="flex-1 py-1.5 text-center cursor-not-allowed text-slate-600 font-mono text-[9px] flex items-center justify-center gap-1">
            <Wifi className="w-3 h-3" /> Online rankings coming soon.
          </div>
        </div>

        {/* Current User Stats Card */}
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-3 mb-4 flex items-center justify-between text-xs font-mono text-left">
          <div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs">
              <Award className="w-4 h-4" />
              <span>{playerStats.name || 'Anonymous Farmer'}</span>
            </div>
            <div className="text-slate-400 text-[9px] mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <span>🌾 HIGHSCORE: <strong className="text-white">{playerStats.highscore.toLocaleString()}</strong></span>
              <span>🏃 MAX DIST: <strong className="text-white">{playerStats.maxDistance}m</strong></span>
              <span>🥚 EGGS LAID: <strong className="text-white">{playerStats.totalEggs}</strong></span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[7.5px] text-slate-500 block uppercase font-bold tracking-wider font-sans leading-none">Your Rank</span>
            <span className="text-emerald-400 font-black text-lg font-mono">
              #{playerRank > 0 ? playerRank : '1'}
            </span>
          </div>
        </div>

        {/* Real Records List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800 text-left">
          {listEntries.length === 0 ? (
            <div className="text-slate-500 text-xs font-mono py-16 text-center flex flex-col items-center justify-center gap-3">
              <span className="text-3xl">🌾</span>
              <p className="font-bold uppercase tracking-wider text-slate-400">No champions yet.</p>
              <p className="text-[10px] text-slate-500 max-w-xs mt-1 text-center">
                Establish your first record! Play a game and compete to become the first local champion!
              </p>
            </div>
          ) : (
            listEntries.map((entry, index) => {
              const rank = index + 1;
              let itemClass = 'bg-slate-950/40 border-slate-850 text-slate-300';
              let numClass = 'bg-slate-800 text-slate-400';
              
              if (rank === 1) {
                itemClass = 'bg-yellow-500/5 border-yellow-500/30 text-yellow-105';
                numClass = 'bg-yellow-500 text-slate-950 font-black';
              } else if (rank === 2) {
                itemClass = 'bg-slate-300/5 border-slate-400/20 text-slate-205';
                numClass = 'bg-slate-400 text-slate-950 font-bold';
              } else if (rank === 3) {
                itemClass = 'bg-amber-700/5 border-amber-600/20 text-amber-205';
                numClass = 'bg-amber-600 text-slate-100 font-bold';
              }

              if (entry.isPlayer) {
                itemClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-105 shadow-md shadow-emerald-500/5';
              }

              return (
                <div
                  key={index}
                  className={`border rounded-2xl p-3 flex items-center justify-between transition-all ${itemClass}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-5.5 h-5.5 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold ${numClass}`}>
                      {rank}
                    </div>

                    <div className="truncate text-left">
                      <span className="font-black text-white text-xs truncate flex items-center gap-1.5 leading-none">
                        {entry.name}
                        {entry.isPlayer && (
                          <span className="bg-emerald-500 text-slate-950 text-[7px] font-black px-1 rounded font-mono leading-none py-0.5">
                            YOU
                          </span>
                        )}
                      </span>
                      <span className="text-[9.5px] text-slate-400 font-mono block mt-1.5">
                        🌾 {entry.feeds.toLocaleString()} feeds | 🏃 {entry.distance.toLocaleString()}m | 🥚 {entry.eggs ?? 0} eggs
                      </span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 ml-3 font-mono">
                    <span className="font-black text-yellow-500 text-sm">
                      {entry.score.toLocaleString()}
                    </span>
                    <span className="text-[8px] text-slate-500 block mt-1 uppercase font-semibold">
                      {entry.date}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
