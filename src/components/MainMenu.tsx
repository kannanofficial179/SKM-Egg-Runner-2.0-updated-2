import React from 'react';
import { PlayerStats } from '../types';
import { soundManager } from '../audio';
import { Play, ShoppingCart, Trophy, ListOrdered, Calendar, Award, Backpack, Settings } from 'lucide-react';

interface MainMenuProps {
  stats: PlayerStats;
  onStartGame: () => void;
  onOpenShop: () => void;
  onOpenMissions: () => void;
  onOpenLeaderboard: () => void;
  onOpenBag: () => void;
  onOpenSettings: (initialView: 'SETTINGS' | 'DEV_LOGIN') => void;
  onClaimDailyReward: (rewardType: 'feeds' | 'gems', value: number) => void;
}

export const DailyRewardsList = [
  { day: 1, type: 'feeds' as const, value: 150, desc: 'Starter Seed' },
  { day: 2, type: 'feeds' as const, value: 300, desc: 'Feed Pack' },
  { day: 3, type: 'gems' as const, value: 5, desc: 'Mineral Crystal Eggs' },
  { day: 4, type: 'feeds' as const, value: 600, desc: 'Silo Surplus' },
  { day: 5, type: 'gems' as const, value: 15, desc: 'Golden Crystal Egg' },
  { day: 6, type: 'feeds' as const, value: 1200, desc: 'Factory Special' },
  { day: 7, type: 'gems' as const, value: 40, desc: 'Jackpot Crystal Eggs' }
];

export const MainMenu: React.FC<MainMenuProps> = ({
  stats,
  onStartGame,
  onOpenShop,
  onOpenMissions,
  onOpenLeaderboard,
  onOpenBag,
  onOpenSettings,
  onClaimDailyReward
}) => {
  // Determine if daily reward can be claimed
  const canClaimDaily = React.useMemo(() => {
    if (!stats.lastDailyRewardClaim) return true;
    const lastClaim = new Date(stats.lastDailyRewardClaim);
    const today = new Date();
    
    // Check if on a different calendar day
    return (
      lastClaim.getFullYear() !== today.getFullYear() ||
      lastClaim.getMonth() !== today.getMonth() ||
      lastClaim.getDate() !== today.getDate()
    );
  }, [stats.lastDailyRewardClaim]);

  // Click/Hold tracker for developer mode 10 continuous seconds. Show a small circular progress indicator while holding.
  const [holdProgress, setHoldProgress] = React.useState<number>(0);
  const pressStartTimeRef = React.useRef<number | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const holdTriggeredRef = React.useRef<boolean>(false);

  const startHoldTimer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    pressStartTimeRef.current = Date.now();
    holdTriggeredRef.current = false;
    setHoldProgress(0);

    const updateProgress = () => {
      if (!pressStartTimeRef.current) return;
      const elapsed = Date.now() - pressStartTimeRef.current;
      const pct = Math.min(100, (elapsed / 10000) * 100);
      setHoldProgress(pct);

      if (elapsed >= 10000) {
        // Complete hold!
        holdTriggeredRef.current = true;
        setHoldProgress(0);
        pressStartTimeRef.current = null;
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        
        soundManager.playLevelUp();
        onOpenSettings('DEV_LOGIN');
      } else {
        animationFrameRef.current = requestAnimationFrame(updateProgress);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const cancelHoldTimer = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setHoldProgress(0);
  };

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only capture primary touch/click
    startHoldTimer();
  };

  const handlePointerUp = () => {
    cancelHoldTimer();
  };

  const handlePointerLeave = () => {
    cancelHoldTimer();
  };

  const handlePointerCancel = () => {
    cancelHoldTimer();
  };

  const handleSettingsClick = (e: React.MouseEvent) => {
    if (holdTriggeredRef.current) {
      holdTriggeredRef.current = false;
      return;
    }
    const elapsed = pressStartTimeRef.current ? (Date.now() - pressStartTimeRef.current) : 0;
    if (elapsed > 500) {
      // Released after some continuous holding but before 10s, don't trigger anything
      return;
    }
    // Normal fast click behavior
    soundManager.playClick();
    onOpenSettings('SETTINGS');
  };

  const activeDailyDayIndex = stats.dailyRewardStreak % 7;
  const currentReward = DailyRewardsList[activeDailyDayIndex];

  const handleClaim = () => {
    if (!canClaimDaily) return;
    soundManager.playLevelUp();
    onClaimDailyReward(currentReward.type, currentReward.value);
  };



  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80 pointer-events-none">
      
      {/* Top Profile Badge & Sound Toggles */}
      <div className="flex justify-between items-start w-full pointer-events-auto">


        {/* Settings button & General highscore feedback */}
        <div className="flex flex-col items-end gap-2">
          

          {/* Quick Settings Button */}
          <div className="flex gap-1">
            <button
              id="btn_toggle_settings"
              onClick={handleSettingsClick}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerLeave}
              onPointerCancel={handlePointerCancel}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-850 text-yellow-400 hover:scale-105 transition-all duration-300 backdrop-blur shadow-lg cursor-pointer flex items-center justify-center relative select-none touch-none"
              title="Open Game Settings"
            >
              <Settings className="w-4 h-4 text-yellow-400 animate-spin-slow" />

              {/* Circular Progress Indicator Overlay */}
              {holdProgress > 0 && (
                <svg 
                  className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-1" 
                  viewBox="0 0 32 32"
                >
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    stroke="#1d2433"
                    strokeWidth="2.5"
                    className="opacity-70"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    stroke="#facc15"
                    strokeWidth="2.5"
                    strokeDasharray={2 * Math.PI * 13}
                    strokeDashoffset={(2 * Math.PI * 13) - (holdProgress / 100) * (2 * Math.PI * 13)}
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Center Logo branding & Big Play Trigger */}
      <div className="flex-1 flex flex-col justify-center items-center pointer-events-auto select-none py-12">
        {/* Cinematic Title Box */}
        <div className="text-center bg-slate-950/40 p-4 rounded-3xl backdrop-blur-xs border border-transparent max-w-lg mb-8 flex flex-col items-center">
          <span className="bg-amber-500 text-slate-950 text-[10px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full shadow-md leading-none font-mono">
            3D Endless runner
          </span>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 mt-2 filter drop-shadow font-sans text-center uppercase tracking-tight">
            SKM Egg Runner
          </h1>
          <h2 className="text-xl md:text-2xl font-bold font-mono text-cyan-400 tracking-widest -mt-1 uppercase">
            3D Endless runner
          </h2>
          <div className="h-0.5 w-32 bg-slate-800 mt-3 rounded-full" />
        </div>

        {/* Big Action Core Buttons */}
        <div className="flex flex-col gap-3 min-w-64 max-w-xs w-full">
          {/* TAP TO RUN PLAY BUTTON */}
          <button
            id="btn_play_now"
            onClick={onStartGame}
            className="group relative bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400 bg-[length:200%_auto] hover:bg-right hover:scale-105 text-slate-950 font-black py-4 px-6 rounded-2xl shadow-xl shadow-yellow-500/30 transition-all duration-300 active:scale-95 flex flex-col items-center justify-center gap-0.5 text-lg uppercase cursor-pointer tracking-wider animate-bounce"
          >
            <div className="absolute inset-0 rounded-2xl bg-white/25 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-xs font-black tracking-widest text-slate-900 opacity-80 font-mono -mb-0.5">TAP TO RUN</span>
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 fill-slate-950" />
              <span className="text-base font-extrabold font-sans">RUN NOW</span>
            </div>
          </button>

          {/* Sub menu grid */}
          <div className="grid grid-cols-4 gap-1.5">
            <button
              id="btn_open_shop"
              onClick={onOpenShop}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold p-2.5 rounded-xl transition flex flex-col items-center justify-center gap-1.5 text-[10px] cursor-pointer shadow"
            >
              <ShoppingCart className="w-4 h-4 text-yellow-400" />
              Skins
            </button>

            <button
              id="btn_open_missions"
              onClick={onOpenMissions}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold p-2.5 rounded-xl transition flex flex-col items-center justify-center gap-1.5 text-[10px] cursor-pointer shadow"
            >
              <Trophy className="w-4 h-4 text-emerald-400" />
              Goals
            </button>

            <button
              id="btn_open_leaderboard"
              onClick={onOpenLeaderboard}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold p-2.5 rounded-xl transition flex flex-col items-center justify-center gap-1.5 text-[10px] cursor-pointer shadow"
            >
              <ListOrdered className="w-4 h-4 text-cyan-400" />
              Ranks
            </button>

            <button
              id="btn_open_bag"
              onClick={() => { soundManager.playClick(); onOpenBag(); }}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold p-2.5 rounded-xl transition flex flex-col items-center justify-center gap-1.5 text-[10px] cursor-pointer shadow"
            >
              <Backpack className="w-4 h-4 text-amber-500" />
              Bag
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Segment: Daily Reward Claim Drawer */}
      <div className="w-full flex justify-center pointer-events-auto">
        <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 p-4 rounded-2xl backdrop-blur shadow-2xl flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-mono block leading-none">DAILY BONUS</span>
              <h4 className="text-white text-xs font-bold font-sans mt-1">
                Day {stats.dailyRewardStreak + 1}: {currentReward.desc}
              </h4>
              <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                Reward: {currentReward.type === 'feeds' ? '🌾' : '🥚'} {currentReward.value}
              </p>
            </div>
          </div>

          <button
            id="btn_claim_daily"
            disabled={!canClaimDaily}
            onClick={handleClaim}
            className={`font-black py-2 px-5 rounded-xl text-xs uppercase font-mono tracking-wider transition ${
              canClaimDaily
                ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 shadow-md cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/30'
            }`}
          >
            {canClaimDaily ? 'Claim Gift' : 'Claimed Today'}
          </button>
        </div>
      </div>

    </div>
  );
};
export default MainMenu;
