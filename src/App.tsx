/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
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

// Subcomponents
import MainMenu from './components/MainMenu';
import GameHUD from './components/GameHUD';
import PauseMenu from './components/PauseMenu';
import GameOverScreen from './components/GameOverScreen';
import { SkinShop, skinsList } from './components/SkinShop';
import { MissionsPanel } from './components/MissionsPanel';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { BagPanel } from './components/BagPanel';
import { SettingsModal } from './components/SettingsModal';
import { syncConfigWithServer, addDebugLog, getActiveLiveConfig } from './liveConfig';

const STORAGE_STATS_KEY = 'skm_chicken_run_stats_v1';
const STORAGE_MISSIONS_KEY = 'skm_chicken_run_missions_v1';
const STORAGE_ACHIEVEMENTS_KEY = 'skm_chicken_run_achievements_v1';
const STORAGE_LEADERBOARD_KEY = 'skm_chicken_run_leaderboard_v1';

const seedLeaderboard: LeaderboardEntry[] = [];

const DEFAULT_STATS: PlayerStats = {
  totalFeeds: 150, // a little gift starter for customization
  totalGems: 8,    // enough for one revive right off the bat!
  totalEggs: 50,   // a warm starter nest of eggs
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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SKMRunnerEngine | null>(null);

  // Navigation Panel States
  const [gameState, setGameState] = useState<'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'>('MENU');
  
  // Modals overlay triggers
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  // Player Profile Name and Toast notifications
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('skm_player_name') || '';
  });
  const [isNamePromptOpen, setIsNamePromptOpen] = useState<boolean>(() => {
    return !localStorage.getItem('skm_player_name');
  });
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
          updateMaxMissionProgress('m2', distance);
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

  // Helper selectors to make edits safe
  const updateMissionProgress = (id: string, amount: number) => {
    setMissions((prev) => {
      const next = prev.map((m) => {
        if (m.id === id && !m.claimed) {
          const progress = Math.min(m.target, m.progress + amount);
          return { ...m, progress, completed: progress >= m.target };
        }
        return m;
      });
      localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const updateMaxMissionProgress = (id: string, amount: number) => {
    setMissions((prev) => {
      const next = prev.map((m) => {
        if (m.id === id && !m.claimed) {
          const progress = Math.max(m.progress, Math.min(m.target, amount));
          return { ...m, progress, completed: progress >= m.target };
        }
        return m;
      });
      localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const updateAchievementProgress = (id: string, amount: number) => {
    setAchievements((prev) => {
      const next = prev.map((a) => {
        if (a.id === id && !a.claimed) {
          const progress = Math.min(a.target, a.progress + amount);
          return { ...a, progress, completed: progress >= a.target };
        }
        return a;
      });
      localStorage.setItem(STORAGE_ACHIEVEMENTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  // --- Start Game Run ---
  const handleStartGame = () => {
    setIsShopOpen(false);
    setIsMissionsOpen(false);
    setIsLeaderboardOpen(false);
    setIsBagOpen(false);
    
    hasDecrementedThisRunRef.current = false;
    
    // Explicitly reset evolution parameters for a fresh, clean Stage 1 white egg run
    localStorage.setItem('skm_evolution_stage', 'EGG');
    localStorage.setItem('skm_grains_collected', '0');
    localStorage.setItem('skm_is_stage_2', 'false');

    setBrownEggsLaid(0);
    setBrownEggsCollected(0);
    setIsStage2(false);

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
    
    setTimeout(() => {
      if (engineRef.current) {
        engineRef.current.setSkin(
          stats.activeSkinId,
          skinsList.find(s => s.id === stats.activeSkinId)?.color || '#ffffff',
          skinsList.find(s => s.id === stats.activeSkinId)?.accentColor || '#f97316'
        );
        engineRef.current.debugHitboxesActive = debugHitboxes;
        engineRef.current.start();
      }
    }, 50);
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

  const handleRestart = () => {
    handleStartGame();
  };

  const handleHome = () => {
    if (engineRef.current) {
      engineRef.current.resetToShowcase();
    }
    setGameState('MENU');
  };

  // Run over crashes
  const handleRunGameOver = () => {
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

  // Resurrect / continue by spending 3 gems
  const handleContinueWithGems = () => {
    if (stats.totalGems < 3) return;

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

    setMissions((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, claimed: true, completed: true } : m));
      localStorage.setItem(STORAGE_MISSIONS_KEY, JSON.stringify(next));
      return next;
    });

    // Credit reward
    setStats((prev) => {
      let totalFeeds = prev.totalFeeds;
      let totalGems = prev.totalGems;
      let xp = prev.xp;
      let level = prev.level;

      if (mission.rewardType === 'feeds') {
        totalFeeds += mission.rewardValue;
      } else if (mission.rewardType === 'gems') {
        totalGems += mission.rewardValue;
      } else if (mission.rewardType === 'xp') {
        xp += mission.rewardValue;
        const xpThreshold = level * 1000;
        while (xp >= xpThreshold) {
          xp -= xpThreshold;
          level += 1;
        }
      }

      const updated = { ...prev, totalFeeds, totalGems, xp, level };
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
      return updated;
    });

    showToast(`Claimed Mission Reward: +${mission.rewardValue} ${mission.rewardType.toUpperCase()}! 🌾💎`);
  };

  const handleClaimAchievement = (id: string) => {
    const ach = achievements.find(a => a.id === id);
    if (!ach) return;

    setAchievements((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, claimed: true, completed: true } : a));
      localStorage.setItem(STORAGE_ACHIEVEMENTS_KEY, JSON.stringify(next));
      return next;
    });

    setStats((prev) => {
      let totalFeeds = prev.totalFeeds;
      let totalGems = prev.totalGems;

      if (ach.rewardType === 'feeds') {
        totalFeeds += ach.rewardValue;
      } else if (ach.rewardType === 'gems') {
        totalGems += ach.rewardValue;
      }

      const updated = { ...prev, totalFeeds, totalGems };
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
      return updated;
    });

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
          onStartGame={handleStartGame}
          onOpenShop={() => setIsShopOpen(true)}
          onOpenMissions={() => setIsMissionsOpen(true)}
          onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
          onOpenBag={() => setIsBagOpen(true)}
          onOpenSettings={(view) => {
            setSettingsInitialView(view);
            setIsSettingsOpen(true);
          }}
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
          onContinueWithGems={handleContinueWithGems}
          onRestart={handleRestart}
          onHome={handleHome}
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
            handleStartGame();
          }}
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

      {/* FIRST LAUNCH PLAYER NAME PROMPT OVERLAY (High fidelity Subway Surfers-style menu blocking card) */}
      {isNamePromptOpen && (
        <div 
          id="first_launch_name_modal"
          className="fixed inset-0 bg-slate-950/95 backdrop-blur-lg flex items-center justify-center p-4 z-55"
        >
          <div className="bg-slate-900 border-2 border-yellow-500 rounded-3xl p-6 shadow-2xl w-full max-w-sm text-center relative animate-fade-in">
            <div className="mx-auto w-12 h-12 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl flex items-center justify-center text-yellow-500 mb-3 shadow-lg">
              <span className="text-xl">🥚</span>
            </div>
            
            <h3 className="text-xl font-black text-white font-sans uppercase tracking-tight">
              Enter Poultry Champion Hall
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-1 mb-5">
              Choose your official runner nickname to sync your high scores onto the daily and weekly rankings!
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const input = form.elements.namedItem('nickname') as HTMLInputElement;
                const val = input.value.trim();
                if (val.length < 2) {
                  return;
                }
                soundManager.playLevelUp();
                localStorage.setItem('skm_player_name', val);
                setPlayerName(val);
                setIsNamePromptOpen(false);
                showToast(`Welcome ${val}! Your poultry profile is synchronized! 🌾`);
              }}
              className="space-y-4"
            >
              <input
                id="inp_player_nickname"
                name="nickname"
                type="text"
                autoComplete="off"
                placeholder="PRO PUMPKIN RUNNER"
                maxLength={20}
                required
                className="w-full bg-slate-950 border border-slate-800 text-white font-black text-center text-sm tracking-widest uppercase placeholder-slate-700 py-3 px-4 rounded-xl focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
              />

              <button
                id="btn_confirm_nickname"
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black py-3 rounded-xl shadow-lg transition duration-200 text-xs uppercase cursor-pointer tracking-wider"
              >
                Confirm Nickname & Play!
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Living World Weather and Day/Night Cycle Coantroller Panel (Sized down for elegant non-blocking premium UI) */}
      <div className="fixed top-20 left-4 z-40 pointer-events-auto origin-top-left scale-[0.58]">
        {!isWeatherCtrlOpen ? (
          <button
            onClick={() => setIsWeatherCtrlOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900/95 border border-white/5 hover:border-yellow-400 text-white rounded-full shadow-lg text-[10px] font-medium backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer"
            title="Open Dynamic Weather & Cycle Controller"
            id="weather_btn_expand"
          >
          </button>
        ) : (
          <div className="w-[280px] bg-neutral-950/95 border border-white/10 text-white rounded-2xl shadow-2xl p-4 backdrop-blur-md transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base animate-pulse">🌍</span>
                <div>
                  <h3 className="font-bold text-xs tracking-tight text-white m-0">Living World Controller</h3>
                  <p className="text-[9px] text-zinc-400 m-0">Real-time dynamic simulation</p>
                </div>
              </div>
              <button
                onClick={() => setIsWeatherCtrlOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 text-xs transition-colors cursor-pointer"
                id="weather_btn_collapse"
              >
                ✕
              </button>
            </div>

            {/* Time of Day Display Widget */}
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-white/5 rounded-xl p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Simulation Time</span>
                <span className="text-[8px] bg-white/10 text-white font-mono px-1.5 py-0.5 rounded">
                  Cycle: {engineRef.current ? `${engineRef.current.timeScale}x` : 'Paused'}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black font-mono tracking-wider text-yellow-300">
                  {(() => {
                    const totalMinutes = Math.floor(timeOfDay * 60);
                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;
                    const ampm = hours >= 12 ? 'PM' : 'AM';
                    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
                    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
                    return `${displayHours}:${displayMinutes} ${ampm}`;
                  })()}
                </span>
                <span className="text-[9px] font-bold text-teal-400 bg-teal-950/60 border border-teal-800/50 px-2 py-0.5 rounded-full">
                  {(() => {
                    if (timeOfDay >= 5.0 && timeOfDay < 7.0) return '🌅 Dawn';
                    if (timeOfDay >= 7.0 && timeOfDay < 11.0) return '☀️ Morning';
                    if (timeOfDay >= 11.0 && timeOfDay < 15.0) return '☀️ Noon';
                    if (timeOfDay >= 15.0 && timeOfDay < 17.0) return '⛅ Afternoon';
                    if (timeOfDay >= 17.0 && timeOfDay < 19.5) return '🌇 Sunset';
                    if (timeOfDay >= 19.5 && timeOfDay < 21.5) return '🌌 Dusk';
                    return '🌙 Midnight';
                  })()}
                </span>
              </div>

              {/* Slider simulation track indicator */}
              <div className="relative mt-2.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 left-0 bg-yellow-400 rounded-full"
                  style={{ width: `${(timeOfDay / 24) * 100}%` }}
                />
              </div>
            </div>

            {/* Time Presets Overrides */}
            <div className="mb-3">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black block mb-2">Set Time Preset</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Dawn', hour: 6.0, icon: '🌅' },
                  { label: 'Noon', hour: 12.0, icon: '☀️' },
                  { label: 'Sunset', hour: 18.0, icon: '🌇' },
                  { label: 'Midnight', hour: 23.5, icon: '🌙' },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      if (engineRef.current) {
                        engineRef.current.timeOfDay = p.hour;
                        setTimeOfDay(p.hour);
                      }
                    }}
                    className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-lg border text-[10px] transition-all cursor-pointer ${
                      Math.abs(timeOfDay - p.hour) < 1.0
                        ? 'bg-yellow-400 text-neutral-950 border-yellow-400 font-bold scale-102'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate max-w-full text-[8px] mt-0.5">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Weather Style Presets Overrides */}
            <div className="mb-3">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black block mb-2">Set Weather Override</span>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'SUNNY', label: 'Sunny', icon: '☀️' },
                  { id: 'CLOUDY', label: 'Cloudy', icon: '☁️' },
                  { id: 'LIGHT_RAIN', label: 'Rain', icon: '🌧' },
                  { id: 'THUNDERSTORM', label: 'Storm', icon: '⛈️' },
                  { id: 'FOGGY', label: 'Foggy', icon: '🌫️' },
                  { id: 'RAIN_SUNSHINE', label: 'Sun Rain', icon: '🌦️' },
                ].map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      if (engineRef.current) {
                        engineRef.current.setWeather(w.id);
                        setCurrentWeather(w.id);
                      }
                    }}
                    className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-[10px] transition-all cursor-pointer ${
                      currentWeather === w.id
                        ? 'bg-blue-500 text-white border-blue-500 font-bold scale-102'
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <span className="text-[11px]">{w.icon}</span>
                    <span className="truncate max-w-full text-[8px] mt-0.5">{w.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Thunder Strike / Speed Sliders */}
            <div className="border-t border-white/10 pt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (engineRef.current) {
                      engineRef.current.triggerLightningStrike();
                    }
                  }}
                  disabled={currentWeather !== 'THUNDERSTORM'}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    currentWeather === 'THUNDERSTORM'
                      ? 'bg-amber-500 hover:bg-amber-600 border border-amber-400 text-neutral-950 shadow-md shadow-amber-500/20'
                      : 'bg-zinc-900 border border-zinc-850 text-zinc-600 cursor-not-allowed opacity-50'
                  }`}
                  title={currentWeather === 'THUNDERSTORM' ? 'Trigger instant thunderstorm lightning!' : 'Requires Storm weather state'}
                >
                  <span>⚡</span>
                  <span className="text-[9px]">Lightning Flash</span>
                </button>

                <button
                  onClick={() => {
                    if (engineRef.current) {
                      const nextScale = engineRef.current.timeScale === 0.08 ? 0.35 : 0.08;
                      engineRef.current.timeScale = nextScale;
                      setTimeOfDay(prev => (prev + 0.0001) % 24.0);
                    }
                  }}
                  className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[9px] font-semibold text-zinc-400 hover:text-white cursor-pointer"
                  title="Accelerate day/night cycle speed"
                >
                  🚀 Speed Cycle
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
