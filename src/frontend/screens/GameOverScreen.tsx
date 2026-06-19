import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Trophy, Navigation, Leaf, Package, Check, RefreshCw, LogOut, HeartPulse, Home } from 'lucide-react';
import { soundManager } from '../../audio';

interface GameOverScreenProps {
  score: number;
  feeds: number;
  gems: number;
  distance: number;
  highscore: number;
  playerGemsBalance: number;
  eggsEarned: number;
  brownEggsEarned: number;
  eggDropRarity: 'COMMON' | 'RARE' | 'VERY RARE' | 'NONE';
  luckyEventName: string | null;
  luckyEventEggs: number;
  onContinueWithGems: () => void;
  onRestart: () => void;
  onHome: () => void;
}

// Sparkle Effect for 3-star rating
const SparkleParticle: React.FC<{ delay: number; style: React.CSSProperties }> = ({ delay, style }) => {
  return (
    <div
      className="absolute w-2 h-2 bg-yellow-300 rounded-full animate-ping pointer-events-none"
      style={{
        ...style,
        animationDelay: `${delay}s`,
        animationDuration: '1.5s',
      }}
    />
  );
};

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  feeds,
  gems,
  distance,
  highscore,
  playerGemsBalance,
  eggsEarned,
  brownEggsEarned,
  eggDropRarity,
  luckyEventName,
  luckyEventEggs,
  onContinueWithGems,
  onRestart,
  onHome
}) => {
  const isNewHighscore = score > highscore;
  const canContinue = playerGemsBalance >= 3;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Confetti system for 3 golden eggs milestone
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Determine Egg Rating based on performance milestones
  // 1 Egg = Poor/Started run (< 20 pts)
  // 2 Eggs = Medium/Chick evolution (>= 20 and < 50 pts)
  // 3 Golden Eggs = Perfect/Hen evolution (>= 50 pts)
  let eggRating = 1;
  if (score >= 50) {
    eggRating = 3;
  } else if (score >= 20) {
    eggRating = 2;
  }

  // Handle continuous gameplay revival
  const handleReviveClick = () => {
    if (canContinue) {
      soundManager.playClick();
      onContinueWithGems();
    } else {
      soundManager.playClick();
      setErrorMessage(`Need 3 Crystal Eggs. You have: 🥚 ${playerGemsBalance}`);
      setTimeout(() => {
        setErrorMessage(null);
      }, 3000);
    }
  };

  const traysEarned = Math.floor(brownEggsEarned / 30);
  const batchesEarned = Math.floor(traysEarned / 10);

  // Run Confetti effect if player earned 3 golden eggs
  useEffect(() => {
    if (eggRating < 3 || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (canvas) {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    const colors = ['#f59e0b', '#fbbf24', '#fef08a', '#ec4899', '#3b82f6', '#10b981'];
    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedX: Math.random() * 4 - 2,
      speedY: Math.random() * 5 + 3,
      angle: Math.random() * 360,
      spin: Math.random() * 10 - 5,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        p.angle += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();

        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
        }
      });
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [eggRating]);

  return (
    <div className="fixed inset-0 bg-amber-950/80 backdrop-blur-md flex items-center justify-center p-3 z-40 overflow-hidden select-none font-sans">

      {/* Dynamic Confetti Canvas for 3 Golden Eggs victory */}
      {eggRating === 3 && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-50 w-full h-full"
        />
      )}

      {/* Main Board Container */}
      <div className="w-full max-w-sm flex flex-col justify-center max-h-[96vh] relative animate-fade-in">

        {/* Floating Error Bar */}
        {errorMessage && (
          <div className="absolute top-[50%] left-4 right-4 bg-red-600 text-white text-[11px] font-black py-2 px-4 rounded-xl z-50 text-center shadow-[0_4px_12px_rgba(220,38,38,0.4)] flex items-center justify-center gap-1.5 animate-bounce">
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {/* AAA PREMIUM CARTOON STYLE BOARD */}
        <div className="relative bg-[#FFF9F2] border-[10px] border-[#814C23] rounded-[48px] p-4 pt-1 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_-8px_0_#ECD2B1] flex flex-col items-center text-center border-solid ring-8 ring-stone-900/40">

          {/* RED RIBBON BANNER ("GAME OVER") */}
          <div className="relative -mt-9 mb-2 z-20 flex justify-center items-center select-none w-[90%]">
            {/* Left Wing fold back */}
            <div className="absolute left-[-10px] top-[10px] w-6 h-8 bg-red-800 rounded-l-md -z-10 origin-right transform -skew-y-12 shadow-sm"></div>
            {/* Left triangle fold shadow */}
            <div className="absolute left-1 top-[26px] border-t-[8px] border-t-red-950 border-r-[10px] border-r-transparent -z-10"></div>

            {/* Main Ribbon Text Bar */}
            <div className="bg-gradient-to-r from-red-650 via-red-500 to-red-650 text-white text-lg font-black py-2 px-8 rounded-xl shadow-[0_6px_10px_rgba(0,0,0,0.35)] border-b-4 border-red-800 tracking-wider uppercase text-center w-full select-none"
                 style={{ textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
              GAME OVER
            </div>

            {/* Right Wing fold back */}
            <div className="absolute right-[-10px] top-[10px] w-6 h-8 bg-red-800 rounded-r-md -z-10 origin-left transform skew-y-12 shadow-sm"></div>
            {/* Right triangle fold shadow */}
            <div className="absolute right-1 top-[26px] border-t-[8px] border-t-red-950 border-l-[10px] border-l-transparent -z-10"></div>
          </div>

          {/* 3-EGG RATING SYSTEM */}
          <div className="flex justify-center items-end gap-3.5 mb-2 mt-1 relative py-1 px-4 bg-[#74421A]/5 rounded-2xl border border-[#74421A]/10">
            {/* EGG 1: Stage 1 (Poor Run) */}
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-11 rounded-[50%_50%_50%_50%_/_65%_65%_40%_40%] border-2 flex items-center justify-center transition-all duration-500 shadow-md ${
                  eggRating >= 1
                    ? 'bg-gradient-to-b from-white to-amber-100 border-amber-300 scale-100 animate-bounce'
                    : 'bg-stone-200/50 border-stone-300 opacity-30 transform scale-90'
                }`}
                style={{ animationDelay: '0.1s', animationDuration: '2s' }}
              >
                {eggRating >= 1 ? (
                  <span className="text-sm select-none">🥚</span>
                ) : (
                  <span className="text-[10px] text-stone-400 font-bold">1</span>
                )}
              </div>
              <span className={`text-[7px] font-black uppercase mt-1 tracking-tight ${eggRating >= 1 ? 'text-[#814C23]' : 'text-stone-400'}`}>
                Egg
              </span>
            </div>

            {/* EGG 2: Chick (Medium Run) */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-12 rounded-[50%_50%_50%_50%_/_65%_65%_40%_40%] border-2 flex items-center justify-center transition-all duration-500 shadow-md relative ${
                  eggRating >= 2
                    ? 'bg-gradient-to-b from-yellow-100 to-yellow-300 border-yellow-400 scale-105 animate-bounce'
                    : 'bg-stone-200/50 border-stone-300 opacity-30 transform scale-90'
                }`}
                style={{ animationDelay: '0.3s', animationDuration: '2s' }}
              >
                {eggRating >= 2 ? (
                  <span className="text-base select-none">🐥</span>
                ) : (
                  <span className="text-[10px] text-stone-400 font-bold">2</span>
                )}
                {eggRating >= 2 && <SparkleParticle delay={0.1} style={{ top: -4, right: -4 }} />}
              </div>
              <span className={`text-[7.5px] font-black uppercase mt-1 tracking-tight ${eggRating >= 2 ? 'text-amber-640' : 'text-stone-400'}`}>
                Chick
              </span>
            </div>

            {/* EGG 3: Golden Hen (Lucky Epic Run) */}
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-11 rounded-[50%_50%_50%_50%_/_65%_65%_40%_40%] border-2 flex items-center justify-center transition-all duration-500 shadow-md relative ${
                  eggRating >= 3
                    ? 'bg-gradient-to-b from-amber-300 via-yellow-400 to-orange-500 border-amber-500 scale-100 animate-bounce'
                    : 'bg-stone-200/50 border-stone-300 opacity-30 transform scale-90'
                }`}
                style={{ animationDelay: '0.5s', animationDuration: '2s' }}
              >
                {eggRating >= 3 ? (
                  <span className="text-sm select-none">👑</span>
                ) : (
                  <span className="text-[10px] text-stone-400 font-bold">3</span>
                )}
                {eggRating >= 3 && (
                  <>
                    <SparkleParticle delay={0.2} style={{ bottom: -3, left: -3 }} />
                    <SparkleParticle delay={0.4} style={{ top: 2, right: 3 }} />
                  </>
                )}
              </div>
              <span className={`text-[7px] font-black uppercase mt-1 tracking-tight ${eggRating >= 3 ? 'text-orange-600' : 'text-stone-400'}`}>
                Hen
              </span>
            </div>
          </div>

          {/* CENTER: LARGE SCORE SECTION */}
          <div className="w-full bg-[#FFF1DE] border-4 border-[#C89B72] rounded-3xl p-3 shadow-[0_8px_0_#E1C3A5,inset_0_2px_4px_rgba(255,255,255,0.7)] flex flex-col items-center justify-center my-1.5 relative overflow-hidden">
            {/* Glossy Diagonal Shine Effect */}
            <div className="absolute top-0 -left-6 w-12 h-32 bg-white/20 transform rotate-12 -translate-y-8 pointer-events-none animate-pulse" />

            <span className="text-[9px] font-extrabold text-[#814C23] font-mono uppercase tracking-widest leading-none mb-1">
              🏆 Current Run Score 🏆
            </span>

            {/* Huge Bold Candy-Style Score */}
            <div className="relative py-1">
              <span
                className="text-5xl md:text-6xl font-black leading-none tracking-tight block font-sans"
                style={{
                  color: '#FFB800',
                  WebkitTextStroke: '5px #5C2C0C',
                  textShadow: '0 4px 0 #5C2C0C, 0 8px 12px rgba(92, 44, 12, 0.5)',
                  paintOrder: 'stroke fill',
                }}
              >
                {score}
              </span>
            </div>

            {/* Highscore Badge */}
            {isNewHighscore ? (
              <div className="mt-1 px-3 py-0.5 bg-[#FFD338] border border-amber-600 rounded-full flex items-center gap-1 shadow-sm select-none">
                <Sparkles className="w-3 h-3 text-[#5C2C0C] fill-[#5C2C0C]" />
                <span className="text-[8px] font-black text-[#5C2C0C] font-mono uppercase tracking-wider">
                  NEW BEST RECORD!
                </span>
              </div>
            ) : (
              <div className="mt-1 text-[8px] font-bold text-[#814C23]/60 font-mono uppercase tracking-wider">
                BEST: {highscore.toLocaleString()} PTS
              </div>
            )}
          </div>

          {/* UNDER SCORE: THREE REWARD BADGES HORIZONTALLY */}
          <div className="w-full grid grid-cols-3 gap-1.5 my-1.5">
            {/* Badge 1: Distance */}
            <div className="bg-gradient-to-b from-[#E6F4FF] to-[#BAE0FF] border-2 border-[#1890FF] rounded-2xl p-1.5 flex flex-col items-center justify-center shadow-md transform active:scale-95 transition-all">
              <Navigation className="w-4 h-4 text-[#1890FF] shrink-0" />
              <span className="text-[7px] font-black text-[#003A8C] uppercase tracking-wider font-sans mt-0.5 leading-none">
                Distance
              </span>
              <span className="text-[10px] font-black text-[#002140] font-mono leading-none mt-1">
                {Math.round(distance)}m
              </span>
            </div>

            {/* Badge 2: Feeds */}
            <div className="bg-gradient-to-b from-[#F6FFED] to-[#D9F7BE] border-2 border-[#52C41A] rounded-2xl p-1.5 flex flex-col items-center justify-center shadow-md transform active:scale-95 transition-all">
              <Leaf className="w-4 h-4 text-[#52C41A] shrink-0" />
              <span className="text-[7px] font-black text-[#135200] uppercase tracking-wider font-sans mt-0.5 leading-none">
                Feeds
              </span>
              <span className="text-[10px] font-black text-[#092B00] font-mono leading-none mt-1">
                🌾 {feeds}
              </span>
            </div>

            {/* Badge 3: Crystal Eggs */}
            <div className="bg-gradient-to-b from-[#F9F0FF] to-[#EFDBFF] border-2 border-[#9254DE] rounded-2xl p-1.5 flex flex-col items-center justify-center shadow-md transform active:scale-95 transition-all">
              <span className="text-sm select-none shrink-0 leading-none">🥚</span>
              <span className="text-[7px] font-black text-[#531DAB] uppercase tracking-wider font-sans mt-0.5 leading-none">
                Crystals
              </span>
              <span className="text-[10px] font-black text-[#22075E] font-mono leading-none mt-1 animate-pulse">
                +{gems}
              </span>
            </div>
          </div>

          {/* BOTTOM STATS PANEL */}
          <div className="w-full bg-[#FCF3E5] border-2 border-[#D1B898]/60 rounded-2xl p-2.5 flex flex-col gap-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)] border-solid my-1">
            <div className="flex items-center justify-between px-1.5">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-[8.5px] font-black text-[#814C23] uppercase font-sans tracking-wide">Trays Earned</span>
              </div>
              <span className="text-[11px] font-black text-amber-905 font-mono">+{traysEarned}</span>
            </div>

            <div className="w-full h-[1px] bg-[#E1C3A5]/40" />

            <div className="flex items-center justify-between px-1.5">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[8.5px] font-black text-[#814C23] uppercase font-sans tracking-wide">Batches Complete</span>
              </div>
              <span className="text-[11px] font-black text-emerald-705 font-mono">+{batchesEarned}</span>
            </div>
          </div>

          {/* Optional Lucky event prompt overlay if active */}
          {luckyEventName && (
            <div className="w-full bg-[#FFF9EB] border border-amber-200 rounded-lg py-1 px-2.5 my-1.5 flex items-center justify-between text-left select-none animate-pulse">
              <span className="text-[7.5px] text-amber-800 font-bold uppercase truncate">
                🍀 BONUS: {luckyEventName}
              </span>
              <span className="text-[9px] font-black text-amber-900 font-mono">+{luckyEventEggs} 🥚</span>
            </div>
          )}

        </div>

        {/* BUTTONS CONTROLLER (BOTTOM OF CARD) */}
        <div className="mt-3.5 px-2 flex flex-col gap-2 relative z-10 w-full">

          {/* Bottom Action Bar: Horizontal circular button row */}
          <div className="flex items-center justify-center gap-6 mt-1 mb-1 relative z-10 w-full">
            {/* Left Circular Button (Refresh/Retry ↻) */}
            <button
              id="btn_retry_match"
              onClick={() => {
                soundManager.playClick();
                onRestart();
              }}
              className="w-16 h-16 md:w-[72px] md:h-[72px] relative group transition-all duration-300 transform active:scale-90 hover:scale-105 cursor-pointer flex items-center justify-center rounded-full shrink-0"
            >
              {/* 3D shadow depth layer */}
              <div className="absolute inset-0 bg-[#D48C00] rounded-full translate-y-1.5 transition-all group-active:translate-y-0.5" />
              {/* Top Glossy Core */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#FFCC00] via-[#FFAA00] to-[#FFCC00] rounded-full flex items-center justify-center border-2 border-white/50 shadow-md group-active:translate-y-1">
                {/* Diagonal Highlight (glossy) */}
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-t-full pointer-events-none" />
                <RefreshCw className="w-7 h-7 text-[#5C2C0C] font-black shrink-0" />
              </div>
            </button>
            {/* Right Circular Button (Home ⎋) */}
            <button
              id="btn_exit_lobby"
              onClick={() => {
                soundManager.playClick();
                onHome();
              }}
              className="w-16 h-16 md:w-[72px] md:h-[72px] relative group transition-all duration-300 transform active:scale-90 hover:scale-105 cursor-pointer flex items-center justify-center rounded-full shrink-0"
            >
              {/* 3D shadow depth layer */}
              <div className="absolute inset-0 bg-[#B71C1C] rounded-full translate-y-1.5 transition-all group-active:translate-y-0.5" />
              {/* Top Core */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#FF4040] via-[#D62828] to-[#B71C1C] rounded-full flex items-center justify-center border-2 border-white/40 shadow-md group-active:translate-y-1">
                {/* Diagonal Highlight (glossy) */}
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/20 rounded-t-full pointer-events-none" />
                <Home className="w-7 h-7 text-white shrink-0" />
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
