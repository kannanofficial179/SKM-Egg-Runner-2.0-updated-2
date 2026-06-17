import React from 'react';
import { Skin, PlayerStats } from '../types';
import { ShoppingBag, Zap, CheckCircle2, Lock } from 'lucide-react';
import { soundManager } from '../audio';

interface SkinShopProps {
  stats: PlayerStats;
  onSelectSkin: (id: string) => void;
  onBuySkin: (id: string, cost: number, currency: 'feeds' | 'gems' | 'eggs') => void;
  onClose: () => void;
}

export const skinsList: Skin[] = [
  {
    id: 'skin_classic',
    name: 'Default White Egg',
    description: 'The original pure white egg shell runner athlete.',
    cost: 0,
    currency: 'eggs',
    unlocked: true,
    color: '#ffffff',
    accentColor: '#f97316',
    multiplierBonus: 1.0,
    rarity: 'COMMON'
  },
  {
    id: 'skin_farmer',
    name: 'Farmer Egg',
    description: 'A cute agricultural specialist egg wearing virtual denim overalls and protective straw accents.',
    cost: 10,
    currency: 'eggs',
    unlocked: false,
    color: '#d97706',
    accentColor: '#4f46e5',
    multiplierBonus: 1.3,
    rarity: 'COMMON'
  },
  {
    id: 'skin_golden',
    name: 'Golden Egg',
    description: 'Extremely rare, brilliant solid-gold shell structure reflecting farm sunshine.',
    cost: 25,
    currency: 'eggs',
    unlocked: false,
    color: '#fbbf24',
    accentColor: '#ea580c',
    multiplierBonus: 1.8,
    rarity: 'RARE'
  },
  {
    id: 'skin_champion',
    name: 'Champion Egg',
    description: 'Prized egg of the champion chicken leagues, detailed with professional metallic blue race paint.',
    cost: 50,
    currency: 'eggs',
    unlocked: false,
    color: '#1d4ed8',
    accentColor: '#60a5fa',
    multiplierBonus: 2.5,
    rarity: 'EPIC'
  },
  {
    id: 'skin_premium',
    name: 'SKM Premium Egg',
    description: 'An elite industrial-grade cargo-safe premium shell with emerald lines and maximum structural integrity.',
    cost: 90,
    currency: 'eggs',
    unlocked: false,
    color: '#10b981',
    accentColor: '#ec4899',
    multiplierBonus: 3.5,
    rarity: 'LEGENDARY'
  }
];

export const SkinShop: React.FC<SkinShopProps> = ({
  stats,
  onSelectSkin,
  onBuySkin,
  onClose
}) => {
  const handleSelect = (skinId: string) => {
    soundManager.playClick();
    onSelectSkin(skinId);
  };

  const handleBuy = (skin: Skin) => {
    soundManager.playClick();
    onBuySkin(skin.id, skin.cost, skin.currency);
  };

  const totalEggs = stats.totalEggs ?? 0;
  const currentSkin = skinsList.find(s => s.id === stats.activeSkinId) || skinsList[0];

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2 font-sans">
              <ShoppingBag className="text-yellow-400 w-6 h-6" />
              Poultry Skin Shop
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Unlock special chicken companion skins with Eggs to boost your run score multiplier!
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-xs font-semibold text-yellow-500 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              Active Skin: <strong className="font-bold text-yellow-400">{currentSkin.name}</strong> ({currentSkin.multiplierBonus}x Multiplier)
            </div>
          </div>
          <button
            id="btn_close_shop"
            onClick={() => { soundManager.playClick(); onClose(); }}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        {/* Economy Rules & Currency Wallet */}
        <div className="grid grid-cols-3 gap-2.5 mb-6 bg-slate-950 p-3 rounded-xl border border-slate-800/80 mx-1">
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider font-sans">🌾 Feed (Upgrades)</span>
            <span className="text-amber-500 font-bold font-mono text-base md:text-lg mt-0.5">
              {stats.totalFeeds}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-1 border-x border-slate-800/80">
            <span className="text-slate-300 text-[10px] uppercase font-bold tracking-wider font-sans">🥚 Eggs (Skins)</span>
            <span className="text-yellow-400 font-bold font-mono text-base md:text-lg mt-0.5 flex items-center gap-1 animate-pulse">
              🥚 {totalEggs}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center py-1">
            <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider font-sans">🥚 Crystal Eggs (Premium)</span>
            <span className="text-cyan-300 font-bold font-mono text-base md:text-lg mt-0.5">
              🥚 {stats.totalGems}
            </span>
          </div>
        </div>

        {/* Skin Cards Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 p-1-scroll">
          {skinsList.map((skin) => {
            const isUnlocked = skin.id === 'skin_classic' || stats.unlockedSkins.includes(skin.id);
            const isActive = stats.activeSkinId === skin.id;
            
            // Check affordability
            const balance = totalEggs;
            const canAfford = balance >= skin.cost;

            // Rarity color schemes
            let rarityBadgeClass = "bg-slate-800 text-slate-300 border-slate-700";
            if (skin.rarity === 'RARE') rarityBadgeClass = "bg-blue-950/60 text-blue-300 border-blue-800/50";
            else if (skin.rarity === 'EPIC') rarityBadgeClass = "bg-purple-950/60 text-purple-300 border-purple-800/50";
            else if (skin.rarity === 'LEGENDARY') rarityBadgeClass = "bg-amber-950/60 text-amber-300 border-amber-800/50";
            else if (skin.rarity === 'SPECIAL EVENT') rarityBadgeClass = "bg-rose-950/60 text-rose-300 border-rose-800/50";

            // Progress towards skin cost
            const progressPct = isUnlocked ? 100 : Math.min(100, Math.round((totalEggs / skin.cost) * 100));
            
            // Text representation of progress bar
            // e.g. ██████░░░░
            const totalBarsCount = 10;
            const filledBarsCount = Math.round((progressPct / 100) * totalBarsCount);
            const emptyBarsCount = totalBarsCount - filledBarsCount;
            const asciiProgress = '█'.repeat(filledBarsCount) + '░'.repeat(emptyBarsCount);

            return (
              <div
                key={skin.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3.5 transition ${
                  isActive
                    ? 'bg-slate-800/80 border-yellow-500 shadow-lg shadow-yellow-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex gap-4 items-start">
                  {/* Visual Avatar Placeholder representing the chicken color */}
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center relative shadow-inner overflow-hidden flex-shrink-0"
                    style={{
                      background: `radial-gradient(circle, ${skin.color} 30%, ${skin.accentColor} 100%)`,
                      border: `2px solid ${skin.color}`
                    }}
                  >
                    {/* Comb */}
                    <div className="absolute top-1 w-4 h-2 bg-red-600 rounded-full" />
                    {/* Beak */}
                    <div className="absolute top-1/2 left-1/3 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-amber-500 rotate-45 rounded-sm" />
                    {/* Eye */}
                    <div className="absolute top-1/3 right-1/4 w-1.5 h-1.5 bg-black rounded-full" />
                    <div className="absolute top-1/3 right-1/4 w-0.5 h-0.5 bg-white rounded-full translate-x-[-0.5px] translate-y-[-0.5px]" />
                    
                    {!isUnlocked && (
                      <div className="absolute inset-0 bg-black/75 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 justify-between">
                      <h3 className="text-white font-bold truncate text-sm md:text-base font-sans leading-none">{skin.name}</h3>
                      <div className="flex gap-1 items-center">
                        <span className={`text-[8px] font-black tracking-widest uppercase border px-1.5 py-0.5 rounded ${rarityBadgeClass}`}>
                          {skin.rarity}
                        </span>
                        <div className="text-[10px] font-bold text-yellow-400 font-mono flex items-center gap-0.5 bg-slate-800 pl-1 pr-1.5 py-0.5 rounded">
                          <Zap className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
                          {skin.multiplierBonus}x
                        </div>
                      </div>
                    </div>
                    <p className="text-slate-400 text-xs mt-1 font-mono leading-tight line-clamp-2">
                      {skin.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar towards Egg requirements */}
                {!isUnlocked && (
                  <div className="bg-slate-900 border border-slate-800/50 rounded-lg p-2.5 font-mono text-[10px] text-zinc-400">
                    <div className="flex justify-between font-bold text-zinc-300">
                      <span>EGG PROGRESS:</span>
                      <span className="text-yellow-400">{totalEggs} / {skin.cost} Eggs</span>
                    </div>
                    {/* Visual custom-styled block progress bar */}
                    <div className="text-xs text-yellow-500 tracking-wide mt-1 select-none font-mono">
                      {asciiProgress} <span className="text-[9px] text-zinc-500 font-bold ml-1">({progressPct}%)</span>
                    </div>
                  </div>
                )}

                {/* Sell/Equip Status Trigger */}
                <div className="flex justify-between items-center bg-slate-900/40 p-1.5 rounded-lg border border-slate-800/40">
                  <span className="text-[10px] text-slate-400 font-mono pl-1.5">
                    COST:{' '}
                    <span className="text-amber-400 font-bold">🥚 {skin.cost} Eggs</span>
                  </span>

                  <div>
                    {isUnlocked ? (
                      isActive ? (
                        <span className="text-emerald-400 text-xs font-bold font-mono py-1 px-2.5 bg-emerald-950/40 rounded-lg flex items-center gap-1 border border-emerald-800/40">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Equipped
                        </span>
                      ) : (
                        <button
                          id={`btn_select_${skin.id}`}
                          onClick={() => handleSelect(skin.id)}
                          className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-1 px-4 rounded-lg text-xs transition cursor-pointer"
                        >
                          Equip
                        </button>
                      )
                    ) : (
                      <button
                        id={`btn_buy_${skin.id}`}
                        onClick={() => handleBuy(skin)}
                        disabled={!canAfford}
                        className={`font-black py-1.5 px-4 rounded-lg text-xs transition flex items-center gap-1 shadow-md cursor-pointer ${
                          canAfford
                            ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950'
                            : 'bg-slate-850 text-slate-500 cursor-not-allowed border border-slate-800/50'
                        }`}
                      >
                        Unlock Skin
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
