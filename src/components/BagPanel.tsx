import React from 'react';
import { Sparkles, Trophy, Flame, Backpack, Eye, X, Award, Shield, Milestone } from 'lucide-react';
import { soundManager } from '../audio';

interface BagPanelProps {
  onClose: () => void;
  playerStats: {
    name: string;
    id: string;
    highscore: number;
    totalFeeds: number;
    totalEggs: number;
    maxDistance: number;
    totalGems: number;
    level: number;
  };
  missionsCompleted: number;
  achievementsCompleted: number;
}

export const BagPanel: React.FC<BagPanelProps> = ({
  onClose,
  playerStats,
  missionsCompleted,
  achievementsCompleted,
}) => {
  // Read real persisted Stage 2 eggs collected from localStorage
  const totalBrownEggs = parseInt(localStorage.getItem('skm_total_brown_eggs') || '0', 10);
  const currentStage = localStorage.getItem('skm_evolution_stage') || 'EGG';
  const isStage2 = localStorage.getItem('skm_is_stage_2') === 'true';

  // Batch Calculations System (Direct mathematical formulas based on instructions)
  // Stage 2: 30 eggs = 1 tray
  // Progression: 10 trays = 1 Silver Batch
  // 10 Silver Batches = 1 Gold Batch
  const totalTrays = Math.floor(totalBrownEggs / 30);
  const bronzeTrays = totalTrays % 10;
  const silverBatches = Math.floor(totalTrays / 10) % 10;
  const goldBatches = Math.floor(totalTrays / 100);

  // Country Eggs (Eggs collected in stage 2 game runs are light-brown "Country Eggs")
  const countryEggs = totalBrownEggs;

  const playClick = () => {
    soundManager.playClick();
  };

  return (
    <div id="bag_panel_overlay" className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div 
        id="bag_container" 
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 relative flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header decoration */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 rounded-t-3xl" />

        {/* Close Button */}
        <button
          id="btn_close_bag"
          onClick={() => { playClick(); onClose(); }}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Headline */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center text-yellow-500">
            <Backpack className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-wide uppercase leading-none">
              Poultry Runner Bag
            </h3>
            <span className="text-[10px] font-mono text-amber-500 font-bold uppercase tracking-wider block mt-1">
              Active Inventory & Real-Time Stats
            </span>
          </div>
        </div>

        {/* Player Profile Header Card */}
        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-3.5 mb-4 flex flex-col gap-1 text-left font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-200 uppercase">{playerStats.name}</span>
            <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
              LVL {playerStats.level}
            </span>
          </div>
          <div className="text-[10.5px] text-slate-400 flex items-center justify-between mt-1">
            <span>CHAMPION ID:</span>
            <span className="text-slate-100 font-bold font-mono tracking-wider">{playerStats.id}</span>
          </div>
        </div>

        {/* Main scrollable grid */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          
          {/* Section 1: Eggs & Currency Wallet */}
          <div>
            <h4 className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <span>🥚</span> WALLET & EGG RESERVES
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-2xl flex items-center gap-3">
                <span className="text-2xl">🥚</span>
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 font-semibold block leading-none">WHITE EGGS</span>
                  <span className="text-base font-black text-white leading-tight block mt-0.5">
                    {playerStats.totalEggs.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-2xl flex items-center gap-3">
                <span className="text-2xl text-cyan-300">🥚</span>
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 font-semibold block leading-none">CRYSTAL EGGS</span>
                  <span className="text-base font-black text-cyan-300 leading-tight block mt-0.5">
                    {playerStats.totalGems.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-2xl flex items-center gap-3">
                <span className="text-2xl">🤎</span>
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 font-semibold block leading-none">BROWN EGGS</span>
                  <span className="text-base font-black text-amber-600 leading-tight block mt-0.5">
                    {totalBrownEggs.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-2xl flex items-center gap-3">
                <span className="text-2xl">🍳</span>
                <div className="text-left">
                  <span className="text-[9px] text-slate-400 font-semibold block leading-none">COUNTRY EGGS</span>
                  <span className="text-base font-black text-amber-500 leading-tight block mt-0.5">
                    {countryEggs.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Batch Storage System (Stage 2) */}
          <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 text-left">
            <h4 className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
              <span>📦 BATCH STORAGE PROGRESSION</span>
              <span className="text-[8px] bg-amber-500/10 px-1.5 py-0.5 rounded-md">STAGE 2 ONLY</span>
            </h4>
            <p className="text-[9.5px] text-slate-400 font-mono leading-relaxed mb-3">
              Eggs collected in Stage 2 fill shipping trays. Organize batches to achieve maximum score and prestige!
            </p>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center flex flex-col items-center justify-center">
                <span className="text-xl">🟫</span>
                <span className="text-[8px] text-slate-400 font-mono font-bold mt-1 uppercase block">BRONZE TRAYS</span>
                <span className="text-sm font-black text-white mt-0.5">{bronzeTrays}</span>
                <span className="text-[7px] text-slate-500 font-mono mt-0.5">({totalBrownEggs % 30}/30 eggs to next)</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center flex flex-col items-center justify-center">
                <span className="text-xl">🥈</span>
                <span className="text-[8px] text-slate-400 font-mono font-bold mt-1 uppercase block">SILVER BATCHES</span>
                <span className="text-sm font-black text-slate-300 mt-0.5">{silverBatches}</span>
                <span className="text-[7px] text-slate-500 font-mono mt-0.5">({bronzeTrays}/10 trays to silver)</span>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-center flex flex-col items-center justify-center">
                <span className="text-xl">🥇</span>
                <span className="text-[8px] text-slate-400 font-mono font-bold mt-1 uppercase block">GOLD BATCHES</span>
                <span className="text-sm font-black text-yellow-500 mt-0.5">{goldBatches}</span>
                <span className="text-[7px] text-slate-500 font-mono mt-0.5">({silverBatches}/10 silver to gold)</span>
              </div>
            </div>
          </div>

          {/* Section 3: Gameplay Statistics & Milestones */}
          <div>
            <h4 className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1 text-left">
              <span>📊</span> PERSISTENT HIGHSCORE & MILESTONES
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl flex items-center gap-3 text-left">
                <Trophy className="w-5 h-5 text-yellow-500 shrink-0" />
                <div>
                  <span className="text-[8px] text-slate-400 font-mono font-bold block uppercase leading-none">HIGHEST SCORE</span>
                  <span className="text-xs font-black text-white mt-0.5 block leading-none">
                    {playerStats.highscore.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl flex items-center gap-3 text-left">
                <Milestone className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[8px] text-slate-400 font-mono font-bold block uppercase leading-none">MAX RUN DISTANCE</span>
                  <span className="text-xs font-black text-white mt-0.5 block leading-none">
                    {playerStats.maxDistance.toLocaleString()}m
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl flex items-center gap-3 text-left">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="text-[8px] text-slate-400 font-mono font-bold block uppercase leading-none">TOTAL FEED SPENT</span>
                  <span className="text-xs font-black text-slate-100 mt-0.5 block leading-none">
                    {playerStats.totalFeeds.toLocaleString()} 🌾
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-2xl flex items-center gap-3 text-left">
                <Award className="w-5 h-5 text-purple-400 shrink-0" />
                <div>
                  <span className="text-[8px] text-slate-400 font-mono font-bold block uppercase leading-none">EVOLUTION STAGE</span>
                  <span className="text-[9px] font-black text-purple-400 mt-1 block leading-none uppercase tracking-wide">
                    {isStage2 ? `${currentStage} (STG-2)` : `${currentStage}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Mission & Achievement Completion Count Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-3 text-left">
              <span className="text-[8px] font-mono text-zinc-400 uppercase font-black tracking-wide block leading-none">MISSIONS COMPLETED</span>
              <span className="text-sm font-black text-white mt-1.5 block leading-none">
                🎯 {missionsCompleted} Completed
              </span>
            </div>
            <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-3 text-left">
              <span className="text-[8px] font-mono text-zinc-400 uppercase font-black tracking-wide block leading-none">BADGES EARNED</span>
              <span className="text-sm font-black text-yellow-500 mt-1.5 block leading-none">
                🏆 {achievementsCompleted} Badges
              </span>
            </div>
          </div>

        </div>

        {/* Action Button */}
        <button
          id="btn_bag_close_action"
          onClick={() => { playClick(); onClose(); }}
          className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-2xl shadow-xl mt-4 text-xs uppercase cursor-pointer tracking-wider shrink-0 duration-200"
        >
          Confirm & Close Backpack
        </button>
      </div>
    </div>
  );
};
