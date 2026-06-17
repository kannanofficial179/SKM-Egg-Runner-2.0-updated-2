import React from 'react';
import { Play, RotateCcw, Home } from 'lucide-react';
import { soundManager } from '../audio';

interface PauseMenuProps {
  score: number;
  feeds: number;
  distance: number;
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  score,
  feeds,
  distance,
  onResume,
  onRestart,
  onHome
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-40">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center">
        {/* Glow Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-cyan-500/10 blur-xl rounded-full" />

        <h2 className="text-xl font-bold text-white font-sans uppercase tracking-widest mt-2">
          Run Suspended
        </h2>
        <p className="text-xs text-slate-400 font-mono mt-1">
          Pause state holding. Take a breath and get back!
        </p>

        {/* Current Run stats summary */}
        <div className="my-6 bg-slate-950 p-3 rounded-lg border border-slate-800 text-left space-y-1">
          <div className="flex justify-between items-center text-xs font-mono px-2">
            <span className="text-slate-400">CURRENT SCORE:</span>
            <span className="text-white font-extrabold">{score.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono px-2 border-t border-slate-800/40 pt-1">
            <span className="text-slate-400">FEEDS:</span>
            <span className="text-yellow-400 font-extrabold">🌾 {feeds}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono px-2 border-t border-slate-800/40 pt-1">
            <span className="text-slate-400">DISTANCE:</span>
            <span className="text-cyan-400 font-extrabold">{distance} m</span>
          </div>
        </div>

        {/* Vertical Actions List */}
        <div className="space-y-2">
          <button
            id="btn_resume_run"
            onClick={() => { soundManager.playClick(); onResume(); }}
            className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm uppercase cursor-pointer"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Resume Run
          </button>

          <button
            id="btn_restart_run"
            onClick={() => { soundManager.playClick(); onRestart(); }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Restart Match
          </button>

          <button
            id="btn_home_menu"
            onClick={() => { soundManager.playClick(); onHome(); }}
            className="w-full bg-slate-955 hover:bg-slate-950 text-slate-400 font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs border border-slate-850 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            Exit to Lodge
          </button>
        </div>
      </div>
    </div>
  );
};
export default PauseMenu;
