/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import ProfileModal from './auth/ProfileModal';
import SKMRunnerEngine from './gameEngine';
import { soundManager } from './audio';
import {
  PlayerStats,
  ActiveGameStats,
  Mission,
  Achievement,
  PowerUpType,
  LeaderboardEntry,
  ThemeType
} from './types';

// Frontend UI (screens, hud, modals)
import {
  MainMenu,
  GameHUD,
  PauseMenu,
  GameOverScreen,
  SkinShop,
  skinsList,
  MissionsPanel,
  LeaderboardPanel,
  BagPanel,
  SettingsModal
} from './frontend';
import { syncConfigWithServer, addDebugLog, getActiveLiveConfig } from './liveConfig';
import { saveRunStats } from './services/game/gameStatsService';
import { consumeOnePlay } from './services/qr/qrService';

// Storage keys are scoped per Firebase UID so each account has isolated data.
// getUid() is resolved inside App() where useAuth() is available.
const storageKey = (uid: string, suffix: string) => `skm_${uid}_${suffix}`;
const STATS_SUFFIX        = 'stats_v1';
const MISSIONS_SUFFIX     = 'missions_v1';
const ACHIEVEMENTS_SUFFIX = 'achievements_v1';
const LEADERBOARD_SUFFIX  = 'leaderboard_v1';

const seedLeaderboard: LeaderboardEntry[] = [];

const DEFAULT_STATS: PlayerStats = {
  totalFeeds: 0,
  totalGems: 0,
  totalEggs: 0,
  highscore: 0,
  level: 1,
  xp: 0,
  unlockedSkins: ['skin_classic'],
  activeSkinId: 'skin_classic',
  soundEnabled: true,
  musicEnabled: true,
  dailyRewardStreak: 0
};

const DEFAULT_MISSIONS: Mission[] = [
  {
    id: 'm1',
    text: 'Collect 150 Feed Bags in total',
    progress: 0,
    target: 150,
    completed: false,
    claimed: false,
    rewardType: 'feeds',
    rewardValue: 250
  },
  {
    id: 'm2',
    text: 'Run 2,000 meters in a single run',
    progress: 0,
    target: 2000,
    completed: false,
    claimed: false,
    rewardType: 'gems',
    rewardValue: 8
  },
  {
    id: 'm3',
    text: 'Collect 5 Golden Feed Bags',
    progress: 0,
    target: 5,
    completed: false,
    claimed: false,
    rewardType: 'xp',
    rewardValue: 350
  }
];

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'a1',
    name: 'Industrial Mogul',
    description: 'Collect 1,000 feed bags across all runs',
    progress: 0,
    target: 1000,
    completed: false,
    claimed: false,
    rewardType: 'feeds',
    rewardValue: 500
  },
  {
    id: 'a2',
    name: 'Countryside Voyager',
    description: 'Run a total of 15,000 meters across all runs',
    progress: 0,
    target: 15000,
    completed: false,
    claimed: false,
    rewardType: 'gems',
    rewardValue: 30
  },
  {
    id: 'a3',
    name: 'Runway Star',
    description: 'Unlock 3 distinct chicken skins',
    progress: 1,
    target: 3,
    completed: false,
    claimed: false,
    rewardType: 'feeds',
    rewardValue: 800
  }
];

export default function App({ onBackToMenu }: { onBackToMenu?: () => void } = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SKMRunnerEngine | null>(null);
  // Guards the full async game-start pipeline (QR consume + engine.start) against
  // double-fire. Held true until the engine actually starts or an error occurs.
  const isStartingRef = useRef(false);
  const { user, logout } = useAuth();
  const uid = user?.uid ?? 'guest';

  // UID-scoped storage keys — each Firebase account has isolated data
  const STORAGE_STATS_KEY        = storageKey(uid, STATS_SUFFIX);
  const STORAGE_MISSIONS_KEY     = storageKey(uid, MISSIONS_SUFFIX);
  const STORAGE_ACHIEVEMENTS_KEY = storageKey(uid, ACHIEVEMENTS_SUFFIX);
  const STORAGE_LEADERBOARD_KEY  = storageKey(uid, LEADERBOARD_SUFFIX);

  // Navigation Panel States
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('MENU');

  // QR Play Session — tracks whether a valid QR has been scanned this session.
  // remainingAttempts is kept for UI display only; Firestore playCount is the
  // authoritative gate. consumeOnePlay() is called at every game start.
  const [playSession, setPlaySession] = useState<{ remainingAttempts: number; unlimited?: boolean } | null>(() => {
    try {
      const saved = sessionStorage.getItem('skm_play_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (sessionStorage.getItem('skm_golden_qr') === 'true') {
          parsed.unlimited = true;
        }
        return parsed;
      }
      return null;
    } catch { return null; }
  });

  const updateSession = (session: { remainingAttempts: number; unlimited?: boolean } | null) => {
    setPlaySession(session);
    if (session) sessionStorage.setItem('skm_play_session', JSON.stringify(session));
    else {
      sessionStorage.removeItem('skm_play_session');
      sessionStorage.removeItem('skm_golden_qr');
      sessionStorage.removeItem('skm_qr_code');
      sessionStorage.removeItem('skm_qr_validated_at');
    }
  };
  
  // Modals overlay triggers
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen,  setIsProfileOpen]  = useState(false);
  const [settingsInitialView, setSettingsInitialView] = useState<'SETTINGS' | 'DEV_LOGIN'>('SETTINGS');
  const [showDevExprToast, setShowDevExprToast] = useState(false);
  const hasDecrementedThisRunRef = useRef(false);

  // Game economy states
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);
  const [missions, setMissions] = useState<Mission[]>(DEFAULT_MISSIONS);
  const [achievements, setAchievements] = useState<Achievement[]>(DEFAULT_ACHIEVEMENTS);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(seedLeaderboard);

  // Active Running Metrics
  const [runStats, setRunStats] = useState<ActiveGameStats>({
    score: 0,
    feeds: 0,
    gems: 0,
    distance: 0,
    speed: 16.0,
    multiplier: 1.0,
    eggs: 0
  });

  // Last run randomized egg details
  const [lastEggsEarned, setLastEggsEarned] = useState<number>(0);
  const [lastEggDropRarity, setLastEggDropRarity] = useState<'COMMON' | 'RARE' | 'VERY RARE' | 'NONE'>('NONE');
  const [lastLuckyEventName, setLastLuckyEventName] = useState<string | null>(null);
  const [lastLuckyEventEggs, setLastLuckyEventEggs] = useState<number>(0);

  // Power Up Display array
  const [activePowerUps, setActivePowerUps] = useState<{ type: PowerUpType; timeLeft: number; duration: number }[]>([]);
  const [fps, setFps] = useState(60);
  const [debugHitboxes, setDebugHitboxes] = useState(false);

  const handleToggleDebugHitboxes = () => {
    if (engineRef.current) {
      const active = engineRef.current.toggleDebugHitboxes();
      setDebugHitboxes(active);
    } else {
      setDebugHitboxes((prev) => !prev);
    }
  };

  // Collect text floating notifications
  const [collectNotifications, setCollectNotifications] = useState<{ id: string; text: string; type: 'feed' | 'gem' | 'powerup' }[]>([]);

  // Clean up floating collect text notifications periodically
  useEffect(() => {
    if (collectNotifications.length === 0) return;
    const timer = setTimeout(() => {
      setCollectNotifications((prev) => prev.slice(1));
    }, 800);
    return () => clearTimeout(timer);
  }, [collectNotifications]);

  // Dynamic Weather and Day/Night tracker
  const [timeOfDay, setTimeOfDay] = useState<number>(8.0); // starts at 8 AM
  const [currentWeather, setCurrentWeather] = useState<string>('SUNNY');
  const [isWeatherCtrlOpen, setIsWeatherCtrlOpen] = useState(false);

  // Player name — UID-scoped, populated by ProfileSetupScreen
  const [playerName, setPlayerName] = useState<string>(() => {
    const u = user?.uid ?? 'guest';
    return localStorage.getItem(`skm_player_name_${u}`)
      ?? user?.displayName
      ?? '';
  });
  // Name prompt is handled by ProfileSetupScreen in main.tsx — never show it here
  const [isNamePromptOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  // Stage 2 state variables
  const [brownEggsLaid, setBrownEggsLaid] = useState(0);
  const [brownEggsCollected, setBrownEggsCollected] = useState(0);
  const [isStage2, setIsStage2] = useState(false);

  // Evolution and Corner Warnings State (synced from engine)
  const [currentStage, setCurrentStage] = useState<'EGG' | 'CHICK' | 'ADULT'>('EGG');
  const [grainsCollected, setGrainsCollected] = useState(0);
  const [isNearCornerTurn, setIsNearCornerTurn] = useState(false);
  const [cornerTurnDirection, setCornerTurnDirection] = useState<'LEFT' | 'RIGHT' | 'T_JUNCTION'>('T_JUNCTION');
  const [isNearGate, setIsNearGate] = useState(false);
  const [isHatching, setIsHatching] = useState(false);

  const [liveConfig, setLiveConfig] = useState(getActiveLiveConfig());

  useEffect(() => {
    const handleConfigChange = () => {
      setLiveConfig(getActiveLiveConfig());
    };
    window.addEventListener('skm_config_updated', handleConfigChange);
    return () => {
      window.removeEventListener('skm_config_updated', handleConfigChange);
    };
  }, []);

  // --- Initial local storage hydration load ---
  useEffect(() => {
    try {
      const storedStats = localStorage.getItem(STORAGE_STATS_KEY);
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        setStats(prev => ({ ...prev, ...parsed }));
      } else {
        localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(DEFAULT_STATS));
      }

      const storedMissions = localStorage.getItem(STORAGE_MISSIONS_KEY);
      if (storedMissions) {
        setMissions(JSON.parse(storedMissions));
      } else {
        localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(DEFAULT_MISSIONS));
      }

      const storedAchievements = localStorage.getItem(STORAGE_ACHIEVEMENTS_KEY);
      if (storedAchievements) {
        setAchievements(JSON.parse(storedAchievements));
      } else {
        localStorage.setItem(STORAGE_ACHIEVEMENTS_KEY, JSON.stringify(DEFAULT_ACHIEVEMENTS));
      }

      const storedLeaderboard = localStorage.getItem(STORAGE_LEADERBOARD_KEY);
      if (storedLeaderboard) {
        setLeaderboard(JSON.parse(storedLeaderboard));
      } else {
        localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(seedLeaderboard));
      }
    } catch (e) {
      console.warn("Storage read error. Starting with defaults.", e);
    }
  }, []);

  // --- Synchronize Audio Manager toggles ---
  useEffect(() => {
    soundManager.setConfig(stats.soundEnabled, stats.musicEnabled);
  }, [stats.soundEnabled, stats.musicEnabled]);

  // Stop BGM when App unmounts (user leaves game to QR Management or any other screen).
  // Belt-and-suspenders alongside the main.tsx screen-change effect.
  useEffect(() => {
    return () => {
      soundManager.stopMusic();
      console.log('[AUDIO] App unmounted — Game BGM stopped.');
    };
  }, []);

  // --- Live configuration checking and browser anomaly recording hooks ---
  useEffect(() => {
    // 1. Server config polling sequence on initial system startup
    syncConfigWithServer();

    // 2. Safe error, warner and exception hijacking
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      localStorage.setItem('skm_last_error', msg);
      addDebugLog('ERROR', msg);
      originalError(...args);
    };
    
    console.warn = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      localStorage.setItem('skm_last_warning', msg);
      originalWarn(...args);
    };

    const handleError = (e: ErrorEvent) => {
      localStorage.setItem('skm_last_crash', e.message || 'Unknown runtime exception');
      addDebugLog('CRASH', e.message || 'Runtime crash captured.');
    };

    window.addEventListener('error', handleError);
    
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('error', handleError);
    };
  }, []);

  // --- Initialize 3D Engine ---
  // Dependency array is EMPTY — engine is created once per App mount.
  // Skin changes are applied via setSkin() in a separate effect below so the
  // engine is never torn down and re-created just because activeSkinId changed.
  // Teardown only happens when App unmounts (user navigates away from game).
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create Callbacks
    const engineCallbacks = {
      onScore: (score: number) => {
        setRunStats((prev) => ({ ...prev, score }));
      },
      onFeedCollected: (amount: number, isGolden: boolean) => {
        setRunStats((prev) => {
          const nextFeeds = prev.feeds + amount;
          
          // Advance active mission progress: Accumulate feeds in run
          updateMissionProgress('m1', amount);
          if (isGolden) {
            updateMissionProgress('m3', 1);
          }

          // Advance cumulative achievements: Feeds
          updateAchievementProgress('a1', amount);

          return { ...prev, feeds: nextFeeds };
        });
      },
      onGemCollected: () => {
        setRunStats((prev) => ({ ...prev, gems: prev.gems + 1 }));
      },
      onPowerUpActivated: (type: PowerUpType, duration: number) => {
        setActivePowerUps((prev) => {
          const filtered = prev.filter((p) => p.type !== type);
          return [...filtered, { type, timeLeft: duration, duration }];
        });
      },
      onDistanceUpdated: (
        distance: number,
        stage: 'EGG' | 'CHICK' | 'ADULT',
        grains: number,
        nearCorner: boolean,
        cornerDir: 'LEFT' | 'RIGHT' | 'T_JUNCTION',
        nearGate?: boolean,
        isCurrentlyHatching?: boolean
      ) => {
        setCurrentStage(stage);
        setGrainsCollected(grains);
        setIsNearCornerTurn(nearCorner);
        setCornerTurnDirection(cornerDir);
        setIsNearGate(!!nearGate);
        setIsHatching(!!isCurrentlyHatching);

        setRunStats((prev) => {
          // Update distance-based mission parameters
          updateMissionProgress('m2', distance, 'highwater');
          updateAchievementProgress('a2', distance - prev.distance);

          return { ...prev, distance };
        });
      },
      onCrash: () => {
        handleRunGameOver();
      },
      onFpsUpdated: (fpsVal: number) => {
        setFps(fpsVal);
      },
      onTimeUpdated: (hour: number, weatherStyle: string) => {
        setTimeOfDay(hour);
        setCurrentWeather(weatherStyle);
      },
      onCollectText: (text: string, type: 'feed' | 'gem' | 'powerup') => {
        setCollectNotifications((prev) => [
          ...prev.slice(-3), // Keep only the last 4 to avoid cluttering screen
          { id: Math.random().toString(36).substring(2, 9), text, type }
        ]);
      },
      onEggLaid: (count: number) => {
        setBrownEggsLaid(count);
      },
      onStage2TransitionCompleted: () => {
        setIsStage2(true);
      },
      onBrownEggCollected: (total: number) => {
        setBrownEggsCollected(total);
        // Also credit persistent eggs wallet
        const currentTotalBrown = parseInt(localStorage.getItem('skm_total_brown_eggs') || '0', 10);
        localStorage.setItem('skm_total_brown_eggs', (currentTotalBrown + 1).toString());
        setStats(prev => {
          const updated = {
            ...prev,
            totalEggs: (prev.totalEggs || 0) + 1
          };
          localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
          return updated;
        });
      }
    };

    engineRef.current = new SKMRunnerEngine(canvasRef.current, engineCallbacks);
    engineRef.current.debugHitboxesActive = debugHitboxes;
    
    // Apply initial equipped skin
    const curSkin = skinsList.find(s => s.id === stats.activeSkinId) || skinsList[0];
    engineRef.current.setSkin(curSkin.id, curSkin.color, curSkin.accentColor);

    return () => {
      if (engineRef.current) {
        engineRef.current.cleanup();
        engineRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty: engine lives for the full App lifetime. Skin is applied below.

  // Apply skin changes without tearing down the engine.
  useEffect(() => {
    if (!engineRef.current) return;
    const curSkin = skinsList.find(s => s.id === stats.activeSkinId) || skinsList[0];
    engineRef.current.setSkin(curSkin.id, curSkin.color, curSkin.accentColor);
  }, [stats.activeSkinId]);

  // Handle active power-up decaying animations
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const timer = setInterval(() => {
      setActivePowerUps((prev) => {
        return prev
          .map((p) => ({ ...p, timeLeft: p.timeLeft - 0.1 }))
          .filter((p) => p.timeLeft > 0);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [gameState]);

  // accumulate: adds amount to current progress (feed counts, golden bags)
  // highwater: only advances if amount exceeds current (distance-based)
  const updateMissionProgress = (id: string, amount: number, mode: 'accumulate' | 'highwater' = 'accumulate') => {
    setMissions((prev) => {
      const next = prev.map((m) => {
        if (m.id !== id || m.claimed) return m;
        const progress = mode === 'highwater'
          ? Math.max(m.progress, Math.min(m.target, amount))
          : Math.min(m.target, m.progress + amount);
        return { ...m, progress, completed: progress >= m.target };
      });
      localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const updateAchievementProgress = (id: string, amount: number) => {
    setAchievements((prev: Achievement[]) => {
      const next = prev.map((a: Achievement) => {
        if (a.id !== id || a.claimed) return a;
        const progress = Math.min(a.target, a.progress + amount);
        return { ...a, progress, completed: progress >= a.target };
      });
      localStorage.setItem(STORAGE_ACHIEVEMENTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const applyRewardToStats = (rewardType: 'feeds' | 'gems' | 'xp', rewardValue: number) => {
    setStats((prev: PlayerStats) => {
      let { totalFeeds, totalGems, xp, level } = prev;
      if (rewardType === 'feeds') {
        totalFeeds += rewardValue;
      } else if (rewardType === 'gems') {
        totalGems += rewardValue;
      } else if (rewardType === 'xp') {
        xp += rewardValue;
        while (xp >= level * 1000) { xp -= level * 1000; level += 1; }
      }
      const updated = { ...prev, totalFeeds, totalGems, xp, level };
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // --- Start Game Run ---
  const handleStartGame = () => {
    console.log('[GAME START] Initializing game…');

    setIsShopOpen(false);
    setIsMissionsOpen(false);
    setIsLeaderboardOpen(false);
    setIsBagOpen(false);

    hasDecrementedThisRunRef.current = false;

    // Reset evolution parameters for a fresh Stage-1 run
    localStorage.setItem('skm_evolution_stage', 'EGG');
    localStorage.setItem('skm_grains_collected', '0');
    localStorage.setItem('skm_is_stage_2', 'false');
    setBrownEggsLaid(0);
    setBrownEggsCollected(0);
    setIsStage2(false);

    console.log('[GAME START] Starting game loop…');
    setGameState('PLAYING');
    setRunStats({
      score: 0,
      feeds: 0,
      gems: 0,
      distance: 0,
      speed: 16.0,
      multiplier: skinsList.find(s => s.id === stats.activeSkinId)?.multiplierBonus || 1.0,
      eggs: 0
    });
    setActivePowerUps([]);

    // Capture engine ref synchronously before any async gap.
    // The engine effect now has an empty dep array so the engine is never torn
    // down mid-flight — this ref will always be valid after component mount.
    const engine = engineRef.current;
    if (!engine) {
      console.error('[GAME START] Engine not initialized — cannot start. This should never happen.');
      isStartingRef.current = false;
      return;
    }

    console.log('[GAME START] Spawning player…');
    const curSkin = skinsList.find(s => s.id === stats.activeSkinId) || skinsList[0];
    engine.setSkin(curSkin.id, curSkin.color, curSkin.accentColor);
    engine.debugHitboxesActive = debugHitboxes;

    // engine.start() is synchronous — it starts the RAF loop and spawns the player.
    // No setTimeout needed now that engine is guaranteed to exist.
    engine.start();
    isStartingRef.current = false;
    console.log('[GAME START] Game started successfully.');
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.pause();
    }
    setGameState('PAUSED');
  };

  const handleResume = () => {
    if (engineRef.current) {
      engineRef.current.resume();
    }
    setGameState('PLAYING');
  };

  const handleRestart = async () => {
    if (playSession?.unlimited) {
      console.log('[RETRY] Golden QR — unlimited, no Firestore consume');
      handleStartGame();
      return;
    }

    const qrCode = sessionStorage.getItem('skm_qr_code');
    if (!qrCode) {
      console.warn('[RETRY] No QR code in session — returning to menu');
      if (engineRef.current) engineRef.current.resetToShowcase();
      updateSession(null);
      setGameState('MENU');
      return;
    }

    // Consume one play from Firestore — blocks if all plays are used
    const result = await consumeOnePlay(qrCode);
    if (result.ok) {
      console.log('[RETRY] Play consumed — remaining:', result.remaining);
      updateSession({ remainingAttempts: result.remaining });
      handleStartGame();
    } else {
      console.warn('[RETRY] Blocked by Firestore:', result.reason, result.message);
      if (engineRef.current) engineRef.current.resetToShowcase();
      updateSession(null);
      setGameState('MENU');
    }
  };

  const handleHome = () => {
    if (engineRef.current) {
      engineRef.current.resetToShowcase();
    }
    updateSession(null);
    if (onBackToMenu) {
      onBackToMenu();
    } else {
      setGameState('MENU');
    }
  };

  // Run over crashes
  const handleRunGameOver = () => {
    // playCount is consumed at the START of each play (consumeOnePlay in
    // handleRestart / onStartGame). Nothing to decrement here — just show
    // the game over screen. The retry button will call consumeOnePlay again.
    const isGolden = sessionStorage.getItem('skm_golden_qr') === 'true';
    let savedSession: { remainingAttempts: number; unlimited?: boolean } | null = null;
    try {
      const raw = sessionStorage.getItem('skm_play_session');
      if (raw) savedSession = JSON.parse(raw);
    } catch { /* ignore */ }

    // Preserve current session as-is for the game over screen display
    if (isGolden) {
      updateSession({ remainingAttempts: 999, unlimited: true });
    } else {
      updateSession(savedSession);
    }
    setGameState('GAMEOVER');
    
    // Core RANDOM EGG REWARD SYSTEM values determination
    // 1. Random Egg Drops
    let dropRarity: 'COMMON' | 'RARE' | 'VERY RARE' | 'NONE' = 'COMMON';
    let dropEggs = 0;
    const dropRoll = Math.random();
    if (dropRoll < 0.1) {
      dropRarity = 'VERY RARE';
      dropEggs = Math.floor(Math.random() * 51) + 50; // 50 to 100
    } else if (dropRoll < 0.4) {
      dropRarity = 'RARE';
      dropEggs = Math.floor(Math.random() * 21) + 20; // 20 to 45
    } else {
      dropRarity = 'COMMON';
      dropEggs = Math.floor(Math.random() * 11) + 5; // 5 to 15
    }

    // 2. Random Event Triggers
    let luckyEvent: string | null = null;
    let eventEggs = 0;
    const eventRoll = Math.random();
    if (eventRoll < 0.01) {
      luckyEvent = 'JACKPOT CHICKEN';
      eventEggs = 250;
    } else if (eventRoll < 0.03) {
      luckyEvent = 'LUCKY SILO SURPLUS';
      eventEggs = 100;
    } else if (eventRoll < 0.08) {
      luckyEvent = 'HIDDEN NEST IN GRASS';
      eventEggs = 60;
    } else if (eventRoll < 0.16) {
      luckyEvent = 'SOLID GOLDEN EGG';
      eventEggs = 40;
    }

    // 3. Distance Milestones drop
    let distanceBonusEggs = 0;
    if (runStats.distance >= 500) {
      const milestones = Math.floor(runStats.distance / 500);
      for (let i = 0; i < milestones; i++) {
        if (Math.random() < 0.45) {
          distanceBonusEggs += Math.floor(Math.random() * 15) + 5; // +5 to 20
        }
      }
    }

    // 4. Feeds converter: Add 1 egg per 12 feeds
    const feedsEggs = Math.floor(runStats.feeds / 12);

    const totalEggsRewarded = dropEggs + eventEggs + distanceBonusEggs + feedsEggs;

    // Cache these randomized metrics for view display
    setLastEggsEarned(totalEggsRewarded);
    setLastEggDropRarity(dropRarity);
    setLastLuckyEventName(luckyEvent);
    setLastLuckyEventEggs(eventEggs);

    // Credit accumulated run balances immediately to their wallet
    setStats((prev) => {
      const totalFeeds = prev.totalFeeds + runStats.feeds;
      const totalGems = prev.totalGems + runStats.gems;
      const totalEggs = (prev.totalEggs || 0) + totalEggsRewarded;
      const isNewHigh = runStats.score > prev.highscore;
      const highscore = isNewHigh ? runStats.score : prev.highscore;

      // Yield Level XP (each point/meter yields XP)
      const xpEarned = Math.round(runStats.score / 10 + runStats.distance / 2);
      let xp = prev.xp + xpEarned;
      let level = prev.level;
      let xpThreshold = level * 1000;

      while (xp >= xpThreshold) {
        xp -= xpThreshold;
        level += 1;
        xpThreshold = level * 1000;
        soundManager.playLevelUp();
      }

      const updated = {
        ...prev,
        totalFeeds,
        totalGems,
        totalEggs,
        highscore,
        level,
        xp
      };

      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));

      // Persist run stats to Firestore so Protein Tracker can read live game data
      if (uid && uid !== 'guest') {
        saveRunStats(uid, {
          distance:      Math.round(runStats.distance),
          score:         runStats.score,
          feedsEarned:   runStats.feeds,
          xpEarned,
          eggsRewarded:  totalEggsRewarded,
          skinsUnlocked: updated.unlockedSkins.length,
          currentLevel:  updated.level,
        }).catch(() => { /* non-fatal */ });
      }

      return updated;
    });

    // Check developer difficulty countdown and handle temporary override expiry
    const devDiff = localStorage.getItem('skm_dev_difficulty');
    if (devDiff && !hasDecrementedThisRunRef.current) {
      hasDecrementedThisRunRef.current = true;
      const countStr = localStorage.getItem('overrideRunCount');
      const count = countStr ? parseInt(countStr, 10) : 0;
      const nextCount = count + 1;
      
      if (nextCount >= 2) {
        // EXPIRED!
        localStorage.removeItem('skm_dev_difficulty');
        localStorage.removeItem('overrideRunCount');
        
        soundManager.playGameOver();
        setShowDevExprToast(true);
        setTimeout(() => {
          setShowDevExprToast(false);
        }, 2000);
      } else {
        localStorage.setItem('overrideRunCount', nextCount.toString());
      }
    }
  };

  // Resurrect / continue by spending 3 gems — does NOT consume a QR play.
  // The play was already consumed at run start; this just resumes the same run.
  const handleContinueWithGems = () => {
    if (stats.totalGems < 3) return;
    if (!playSession) return;

    soundManager.playLevelUp();
    
    // Deduct continue cost AND roll back the pre-credited assets of the crash, since they accumulate and credit on final run-over
    setStats((prev) => {
      const nextYolk = lastEggsEarned;
      const updated = {
        ...prev,
        totalGems: prev.totalGems - 3 - runStats.gems, 
        totalFeeds: prev.totalFeeds - runStats.feeds,
        totalEggs: Math.max(0, (prev.totalEggs || 0) - nextYolk)
      };
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
      return updated;
    });

    // Reset game over and revive engine with brief force invincibility (shield)
    setGameState('PLAYING');
    
    if (engineRef.current) {
      // Keep score progress values in the engine on revive
      engineRef.current.score = runStats.score;
      engineRef.current.distance = runStats.distance;
      engineRef.current.revive();
    }
  };

  // --- Claim Daily Login Gift Calendar ---
  const handleClaimDailyReward = (rewardType: 'feeds' | 'gems', value: number) => {
    setStats((prev) => {
      const totalFeeds = rewardType === 'feeds' ? prev.totalFeeds + value : prev.totalFeeds;
      const totalGems = rewardType === 'gems' ? prev.totalGems + value : prev.totalGems;
      const dailyRewardStreak = prev.dailyRewardStreak + 1;
      const lastDailyRewardClaim = new Date().toISOString();

      const updated = {
        ...prev,
        totalFeeds,
        totalGems,
        dailyRewardStreak,
        lastDailyRewardClaim
      };

      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // --- Equip Skin and Purchase Shop Integrations ---
  const handleSelectSkin = (skinId: string) => {
    setStats((prev) => {
      const updated = { ...prev, activeSkinId: skinId };
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleBuySkin = (skinId: string, cost: number, currency: 'feeds' | 'gems' | 'eggs') => {
    setStats((prev) => {
      let balance = 0;
      if (currency === 'feeds') balance = prev.totalFeeds;
      else if (currency === 'gems') balance = prev.totalGems;
      else if (currency === 'eggs') balance = (prev as any).totalEggs || 0;

      if (balance < cost) return prev; // check affordability again to guard

      const totalFeeds = currency === 'feeds' ? prev.totalFeeds - cost : prev.totalFeeds;
      const totalGems = currency === 'gems' ? prev.totalGems - cost : prev.totalGems;
      const totalEggs = currency === 'eggs' ? ((prev as any).totalEggs || 0) - cost : ((prev as any).totalEggs || 0);
      const unlockedSkins = [...prev.unlockedSkins, skinId];

      const updated = {
        ...prev,
        totalFeeds,
        totalGems,
        totalEggs,
        unlockedSkins
      };

      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
      
      // Update skins owned achievement: Owners
      updateAchievementProgress('a3', 1);

      return updated;
    });
  };

  // --- Claim Missions / Achievements prizes ---
  const handleClaimMission = (id: string) => {
    const mission = missions.find(m => m.id === id);
    if (!mission) return;

    setMissions((prev: Mission[]) => {
      const next = prev.map((m: Mission) => (m.id === id ? { ...m, claimed: true, completed: true } : m));
      localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(next));
      return next;
    });

    applyRewardToStats(mission.rewardType, mission.rewardValue);
    showToast(`Claimed Mission Reward: +${mission.rewardValue} ${mission.rewardType.toUpperCase()}! 🌾💎`);
  };

  const handleClaimAchievement = (id: string) => {
    const ach = achievements.find(a => a.id === id);
    if (!ach) return;

    setAchievements((prev: Achievement[]) => {
      const next = prev.map((a: Achievement) => (a.id === id ? { ...a, claimed: true, completed: true } : a));
      localStorage.setItem(STORAGE_ACHIEVEMENTS_KEY, JSON.stringify(next));
      return next;
    });

    applyRewardToStats(ach.rewardType, ach.rewardValue);
    showToast(`Claimed Badge: +${ach.rewardValue} ${ach.rewardType.toUpperCase()}! 🏆💎`);
  };

  // --- Save Leaderboard records ---
  const handleSaveLeaderboard = (playerName: string) => {
    const newEntry: LeaderboardEntry = {
      name: playerName,
      score: runStats.score,
      feeds: runStats.feeds,
      distance: runStats.distance,
      date: new Date().toISOString().split('T')[0],
      isPlayer: true
    };

    setLeaderboard((prev) => {
      const next = [...prev, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 8); // top 8 entries preserved only
      
      localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleClearLeaderboard = () => {
    setLeaderboard(seedLeaderboard);
    localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(seedLeaderboard));
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden select-none">
      
      {/* 3D WEBGL GRAPHICS CANVAS */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* active UI views mapped to current gameState */}
      {gameState === 'MENU' && (
        <MainMenu
          stats={stats}
          onStartGame={async () => {
            // Hard guard: hold through the full async pipeline, not just 300ms.
            if (isStartingRef.current) {
              console.warn('[GAME START] Already starting — ignoring duplicate tap.');
              return;
            }
            isStartingRef.current = true;
            console.log('[GAME START] Button clicked.');

            try {
              const qrCode         = sessionStorage.getItem('skm_qr_code');
              const isGolden       = sessionStorage.getItem('skm_golden_qr') === 'true';
              const validatedAtRaw = sessionStorage.getItem('skm_qr_validated_at');

              console.log('[GAME START] Validation started — qrCode:', qrCode, '| isGolden:', isGolden);

              // No QR scanned this session — send back to scan
              if (!qrCode && !isGolden) {
                console.warn('[GAME START] Validation failed — no QR in session. Require scan.');
                updateSession(null);
                isStartingRef.current = false;
                return;
              }

              // Anti-refresh guard: scan timestamp older than 30 min requires re-scan
              const SESSION_TTL_MS = 30 * 60 * 1000;
              const validatedAt    = validatedAtRaw ? Number(validatedAtRaw) : 0;
              if (!isGolden && Date.now() - validatedAt > SESSION_TTL_MS) {
                console.warn('[GAME START] Validation failed — QR session expired. Require new scan.');
                updateSession(null);
                isStartingRef.current = false;
                return;
              }

              console.log('[GAME START] Validation passed.');

              if (isGolden) {
                console.log('[GAME START] Golden QR — unlimited plays, skipping Firestore consume.');
                console.log('[GAME START] Session created.');
                updateSession({ remainingAttempts: 999, unlimited: true });
                handleStartGame();
                return;
              }

              // Consume one play from Firestore — authoritative gate
              console.log('[GAME START] Loading assets / consuming play from Firestore…');
              const result = await consumeOnePlay(qrCode!);

              if (result.ok) {
                console.log('[GAME START] Assets loaded. Play consumed — remaining:', result.remaining);
                console.log('[GAME START] Session created.');
                updateSession({ remainingAttempts: result.remaining });
                handleStartGame();
              } else {
                console.warn('[GAME START] Blocked by Firestore:', result.reason, result.message);
                updateSession(null);
                isStartingRef.current = false;
              }
            } catch (err: any) {
              console.error('[GAME START] Unexpected error in start pipeline:', err?.message ?? err);
              isStartingRef.current = false;
            }
          }}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenMissions={() => setIsMissionsOpen(true)}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onOpenBag={() => setIsBagOpen(true)}
          onOpenSettings={(view) => {
            setSettingsInitialView(view);
            setIsSettingsOpen(true);
          }}
          onOpenProfile={() => setIsProfileOpen(true)}
          onClaimDailyReward={handleClaimDailyReward}
        />
      )}

      {gameState === 'PLAYING' && (
        <>
          <GameHUD
            score={runStats.score}
            feedsCollected={runStats.feeds}
            gemsCollected={runStats.gems}
            distance={runStats.distance}
            speed={runStats.speed}
            activePowerUps={activePowerUps}
            onPause={handlePause}
            onSwipeLeft={() => engineRef.current?.swipeLeft()}
            onSwipeRight={() => engineRef.current?.swipeRight()}
            onJump={() => engineRef.current?.pressJump()}
            onSlide={() => engineRef.current?.pressSlide()}
            fps={fps}
            debugHitboxes={debugHitboxes}
            onToggleDebugHitboxes={handleToggleDebugHitboxes}
            currentStage={currentStage}
            grainsCollected={grainsCollected}
            isNearCornerTurn={isNearCornerTurn}
            cornerTurnDirection={cornerTurnDirection}
            isNearGate={isNearGate}
            isHatching={isHatching}
            brownEggsLaid={brownEggsLaid}
            brownEggsCollected={brownEggsCollected}
            isStage2={isStage2}
            stage1EvolutionReq={liveConfig.stage1EvolutionReq}
            stage2EvolutionReq={liveConfig.stage2EvolutionReq}
          />
          {/* Floating Collect Text Notifications Overlay */}
          <div className="absolute top-[50%] left-0 right-0 pointer-events-none flex flex-col items-center z-20 select-none">
            <div className="flex flex-col items-center gap-1.5 origin-top scale-[var(--hud-scale)]">
              {collectNotifications.map((notif) => {
                let badgeClass = "bg-amber-950/90 border-amber-500/40 text-amber-300 drop-shadow-[0_2px_8px_rgba(245,158,11,0.25)]";
                if (notif.type === 'gem') {
                  badgeClass = "bg-cyan-950/90 border-cyan-500/40 text-cyan-300 drop-shadow-[0_2px_8px_rgba(6,182,212,0.25)]";
                } else if (notif.type === 'powerup') {
                  badgeClass = "bg-purple-950/90 border-purple-500/40 text-purple-300 drop-shadow-[0_2px_8px_rgba(168,85,247,0.25)]";
                }

                return (
                  <div
                    key={notif.id}
                    className={`animate-collect-float font-sans text-xs font-black tracking-wide px-3 md:px-3.5 py-1.5 rounded-2xl border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 shadow-xl text-center whitespace-pre-line pointer-events-none ${badgeClass}`}
                  >
                    {notif.text}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {gameState === 'PAUSED' && (
        <PauseMenu
          score={runStats.score}
          feeds={runStats.feeds}
          distance={runStats.distance}
          remainingAttempts={playSession?.remainingAttempts ?? 0}
          unlimited={playSession?.unlimited === true}
          onResume={handleResume}
          onRestart={handleRestart}
          onHome={handleHome}
        />
      )}

      {gameState === 'GAMEOVER' && (
        <GameOverScreen
          score={runStats.score}
          feeds={runStats.feeds}
          gems={runStats.gems}
          distance={runStats.distance}
          highscore={stats.highscore}
          playerGemsBalance={stats.totalGems}
          eggsEarned={lastEggsEarned}
          brownEggsEarned={brownEggsCollected}
          eggDropRarity={lastEggDropRarity}
          luckyEventName={lastLuckyEventName}
          luckyEventEggs={lastLuckyEventEggs}
          remainingAttempts={playSession?.remainingAttempts ?? 0}
          unlimited={playSession?.unlimited === true}
          onContinueWithGems={handleContinueWithGems}
          onRestart={handleRestart}
          onHome={handleHome}
          onScanNewQR={() => { updateSession(null); if (onBackToMenu) onBackToMenu(); else setGameState('MENU'); }}
        />
      )}

      {/* MODAL OVERLAYS */}
      {showDevExprToast && (
        <div id="dev_expiry_toast" className="fixed top-8 left-1/2 -translate-x-1/2 bg-slate-950/95 border-2 border-red-500/50 text-red-100 text-[11px] md:text-xs font-black px-6 py-4 rounded-2xl shadow-2xl z-50 animate-bounce font-mono uppercase tracking-wider flex items-center gap-2.5 max-w-[90vw] text-center justify-center">
          <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
          <span>Developer test mode ended. Standard difficulty restored.</span>
        </div>
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          initialView={settingsInitialView}
          soundEnabled={stats.soundEnabled}
          musicEnabled={stats.musicEnabled}
          onToggleSound={() => setStats(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
          onToggleMusic={() => setStats(prev => ({ ...prev, musicEnabled: !prev.musicEnabled }))}
          onClose={() => setIsSettingsOpen(false)}
          onStartGame={() => {
            setIsSettingsOpen(false);
            setGameState('MENU');
          }}
          onLogout={logout}
          engine={engineRef.current}
          stats={stats}
          setStats={setStats}
          achievements={achievements}
          setAchievements={setAchievements}
          missions={missions}
          setMissions={setMissions}
          fps={fps}
        />
      )}

      {isShopOpen && (
        <SkinShop
          stats={stats}
          onSelectSkin={handleSelectSkin}
          onBuySkin={handleBuySkin}
          onClose={() => setIsShopOpen(false)}
        />
      )}

      {isMissionsOpen && (
        <MissionsPanel
          missions={missions}
          achievements={achievements}
          onClaimMission={handleClaimMission}
          onClaimAchievement={handleClaimAchievement}
          onClose={() => setIsMissionsOpen(false)}
        />
      )}

      {isLeaderboardOpen && (
        <LeaderboardPanel
          playerStats={{
            name: playerName || 'Anonymous Farmer',
            highscore: stats.highscore,
            totalFeeds: stats.totalFeeds,
            totalEggs: stats.totalEggs,
            maxDistance: stats.level * 180 + (stats.highscore > 5000 ? Math.round(stats.highscore * 0.08) : 100)
          }}
          onClose={() => setIsLeaderboardOpen(false)}
        />
      )}

      {isBagOpen && (
        <BagPanel
          playerStats={{
            name: playerName || 'Anonymous Farmer',
            id: localStorage.getItem('skm_player_id') || 'SKM_RUNNER_101',
            highscore: stats.highscore,
            totalFeeds: stats.totalFeeds,
            totalEggs: stats.totalEggs,
            maxDistance: stats.level * 180 + (stats.highscore > 5000 ? Math.round(stats.highscore * 0.08) : 100),
            totalGems: stats.totalGems,
            level: stats.level
          }}
          missionsCompleted={missions.filter(m => m.completed).length}
          achievementsCompleted={achievements.filter(a => a.completed).length}
          onClose={() => setIsBagOpen(false)}
        />
      )}

      {/* PROFILE MODAL */}
      {isProfileOpen && user && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          user={user}
          stats={stats}
          onLogout={logout}
          onDataDeleted={() => {
            // Clear all UID-scoped data then reload to login screen
            [STORAGE_STATS_KEY, STORAGE_MISSIONS_KEY, STORAGE_ACHIEVEMENTS_KEY, STORAGE_LEADERBOARD_KEY].forEach(k => localStorage.removeItem(k));
            localStorage.removeItem(`skm_player_name_${uid}`);
            window.location.reload();
          }}
        />
      )}

      {/* TOAST SYSTEM (Sleek floating bubble notification with modern backdrop-blur) */}
      {toastMessage && (
        <div 
          id="toast_notification"
          className="fixed top-6 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 font-black px-6 py-3 rounded-full shadow-2xl z-55 flex items-center gap-2 border border-yellow-400/30 animate-bounce backdrop-blur text-sm font-sans"
        >
          <span>🏆</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Name prompt replaced by ProfileSetupScreen in main.tsx */}


    </div>
  );
}
