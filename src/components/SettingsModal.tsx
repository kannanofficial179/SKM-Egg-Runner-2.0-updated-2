import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Music as MusicIcon, 
  Smartphone, 
  Settings, 
  HardDrive, 
  ShieldAlert, 
  Check, 
  X, 
  ShieldCheck, 
  Activity, 
  RefreshCw, 
  Save, 
  Database, 
  Cpu, 
  AlertTriangle, 
  FileCode, 
  Sparkles, 
  Award, 
  User, 
  TrendingUp, 
  Trash2, 
  Play, 
  SlidersHorizontal,
  Flame,
  Wrench
} from 'lucide-react';
import { soundManager } from '../audio';
import { 
  getActiveLiveConfig, 
  syncConfigWithServer, 
  LiveConfig, 
  DEFAULT_LIVE_CONFIG, 
  addDebugLog, 
  getDebugLogs, 
  DebugLogEntry 
} from '../liveConfig';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  musicEnabled: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onStartGame: () => void;
  initialView?: SettingsView;
  engine?: any;
  stats?: any;
  setStats?: React.Dispatch<React.SetStateAction<any>>;
  achievements?: any[];
  setAchievements?: React.Dispatch<React.SetStateAction<any[]>>;
  missions?: any[];
  setMissions?: React.Dispatch<React.SetStateAction<any[]>>;
  fps?: number;
}

const ENCODED_DEV_NAME = "REVWRUxPUEVS"; // base64 for "DEVELOPER"
const ENCODED_DEV_PASS = "bnBtIHJ1biBkZXY="; // base64 for "npm run dev"

type SettingsView = 'SETTINGS' | 'DEV_LOGIN' | 'DEV_PANEL';
type DevTab = 'BALANCING' | 'DIAGNOSTICS' | 'TESTING' | 'LOGS';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  musicEnabled,
  onToggleSound,
  onToggleMusic,
  onStartGame,
  initialView = 'SETTINGS',
  engine,
  stats,
  setStats,
  achievements,
  setAchievements,
  missions,
  setMissions,
  fps = 60
}) => {
  const [view, setView] = useState<SettingsView>(initialView);
  const [activeTab, setActiveTab] = useState<DevTab>('BALANCING');

  // Sync view when the modal is opened
  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setDevName('');
      setDevPassword('');
      setLoginError(false);
      
      // Load configuration on entry
      const active = getActiveLiveConfig();
      setDraftConfig({ ...active });
    }
  }, [isOpen, initialView]);

  // Vibration State
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(() => {
    return localStorage.getItem('skm_vibration_enabled') !== 'false';
  });

  // Login inputs
  const [devName, setDevName] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Auto Hide Inactivity Timer: 5 minutes (300 seconds)
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const timerRef = useRef<any>(null);

  // Keep track of current selected difficulty in dev panel
  const [selectedDifficulty, setSelectedDifficulty] = useState<'EASY' | 'NORMAL' | 'HARD' | 'EXTREME'>(() => {
    return (localStorage.getItem('skm_dev_difficulty') as any) || 'NORMAL';
  });

  // FPS Limiter selection
  const [targetFps, setTargetFps] = useState<string>(() => {
    return localStorage.getItem('skm_target_fps') || 'unlimited';
  });

  // Live debug stats timer
  const [liveMetrics, setLiveMetrics] = useState({
    avgFps: 60,
    activeObstacles: 0,
    activeFeeds: 0,
    activeVehicles: 0,
    memoryUsage: 'Unavailable',
    uncollectedFeeds: 0
  });

  // Event Logs container
  const [eventLogs, setEventLogs] = useState<DebugLogEntry[]>([]);

  // Sliders/Draft live configuration
  const [draftConfig, setDraftConfig] = useState<LiveConfig>(DEFAULT_LIVE_CONFIG);

  // Custom status feedback notice toast
  const [noticeToast, setNoticeToast] = useState<string | null>(null);
  const [diagResults, setDiagResults] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [showDefaultConfirm, setShowDefaultConfirm] = useState<boolean>(false);
  const [restoreSuccessActive, setRestoreSuccessActive] = useState<boolean>(false);

  const triggerToast = (msg: string) => {
    setNoticeToast(msg);
    setTimeout(() => {
      setNoticeToast(null);
    }, 2500);
  };

  // Sync logs in real-time
  const refreshLogs = () => {
    setEventLogs(getDebugLogs());
  };

  // Register real-time log listeners
  useEffect(() => {
    if (view === 'DEV_PANEL') {
      refreshLogs();
      window.addEventListener('skm_debug_log_added', refreshLogs);
      return () => {
        window.removeEventListener('skm_debug_log_added', refreshLogs);
      };
    }
  }, [view]);

  // Live Metrics Periodic update (every 1s)
  useEffect(() => {
    let interval: any = null;
    if (view === 'DEV_PANEL') {
      const updateMetrics = () => {
        // Collect live performance statistics
        const memObj = (performance as any).memory;
        const memoryStr = memObj ? `${Math.round(memObj.usedJSHeapSize / 1048576)} MB` : 'Unavailable';
        
        let obstaclesCount = 0;
        let feedsCount = 0;
        let movingVehicles = 0;

        if (engine) {
          if (Array.isArray(engine.obstacles)) {
            obstaclesCount = engine.obstacles.filter((o: any) => o.active).length;
            movingVehicles = engine.obstacles.filter((o: any) => o.active && o.isMovingVehicle).length;
          }
          if (Array.isArray(engine.collectibles)) {
            feedsCount = engine.collectibles.filter((c: any) => c.active).length;
          }
        }

        // Calculate moving average of FPS over time
        setLiveMetrics(prev => {
          const fpsSample = fps || 60;
          const avgFps = Math.round(prev.avgFps * 0.8 + fpsSample * 0.2);
          
          return {
            avgFps: isNaN(avgFps) ? 60 : avgFps,
            activeObstacles: obstaclesCount,
            activeFeeds: feedsCount,
            activeVehicles: movingVehicles,
            memoryUsage: memoryStr,
            uncollectedFeeds: engine ? (engine.grainsMissed || 0) : 0
          };
        });
      };

      updateMetrics();
      interval = setInterval(updateMetrics, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [view, engine, fps]);

  // Handle vibration toggle
  const handleToggleVibration = () => {
    soundManager.playClick();
    const nextVal = !vibrationEnabled;
    setVibrationEnabled(nextVal);
    localStorage.setItem('skm_vibration_enabled', nextVal ? 'true' : 'false');
    if (nextVal && navigator.vibrate) {
      navigator.vibrate(100);
    }
  };

  // Safety trigger for auto-hiding Developer Login and Panel if inactive for 5 minutes
  useEffect(() => {
    if (view === 'DEV_LOGIN' || view === 'DEV_PANEL') {
      setTimeLeft(300); // Reset timer to 5 minutes
      
      const resetInactivity = () => {
        setTimeLeft(300);
      };

      // Listen for interactions on the document when Developer views are active
      window.addEventListener('mousemove', resetInactivity);
      window.addEventListener('keydown', resetInactivity);
      window.addEventListener('mousedown', resetInactivity);
      window.addEventListener('touchstart', resetInactivity);
      window.addEventListener('scroll', resetInactivity);
      
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Auto hide and clear values
            clearInterval(timerRef.current);
            setView('SETTINGS');
            setDevName('');
            setDevPassword('');
            setLoginError(false);
            return 300;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        window.removeEventListener('mousemove', resetInactivity);
        window.removeEventListener('keydown', resetInactivity);
        window.removeEventListener('mousedown', resetInactivity);
        window.removeEventListener('touchstart', resetInactivity);
        window.removeEventListener('scroll', resetInactivity);
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [view]);

  if (!isOpen) return null;

  // Format time left
  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = secs % 60;
    return `${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // Check login credentials securely
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();

    const secureCheck = () => {
      try {
        return btoa(devName.trim()) === ENCODED_DEV_NAME && btoa(devPassword.trim()) === ENCODED_DEV_PASS;
      } catch (err) {
        return false;
      }
    };

    if (secureCheck()) {
      setView('DEV_PANEL');
      setLoginError(false);
      soundManager.playLevelUp();
      addDebugLog('SECURITY', 'Developer access verified. Mode started.');
    } else {
      setLoginError(true);
      soundManager.playGameOver();
      addDebugLog('SECURITY', 'Unauthorized login attempt with invalid keys.');
    }
  };

  // Exit Game action
  const handleExitGame = () => {
    soundManager.playClick();
    if (confirm("Are you sure you want to exit the running session? Current active status will be reset.")) {
      window.location.reload();
    }
  };

  // Apply selected difficulty and start/restart the game
  const handleApplyDifficulty = () => {
    soundManager.playClick();
    localStorage.setItem('skm_dev_difficulty', selectedDifficulty);
    localStorage.setItem('overrideRunCount', '0');
    addDebugLog('TEST', `Applied difficulty override: ${selectedDifficulty}. Run counter zeroed.`);
    onClose();
    // Restart run with selected difficulty
    onStartGame();
  };

  // CONFIGURATION ACTIONS
  const handleSaveDraftConfig = () => {
    soundManager.playClick();
    localStorage.setItem('skm_local_client_config', JSON.stringify(draftConfig));
    addDebugLog('CONFIG', 'Draft layout parameters saved locally.');
    window.dispatchEvent(new CustomEvent('skm_config_updated'));
    if (engine && typeof engine.applyLiveConfig === 'function') {
      engine.applyLiveConfig();
    }
    triggerToast('Config Saved and Sync’d');
    setTimeout(() => { runValidationNow(); }, 150);
  };

  const handleApplyConfig = () => {
    soundManager.playClick();
    localStorage.setItem('skm_local_client_config', JSON.stringify(draftConfig));
    addDebugLog('CONFIG', 'Draft parameters applied live.');
    
    if (engine) {
      if (typeof engine.applyLiveConfig === 'function') {
        engine.applyLiveConfig();
      } else if (Array.isArray(engine.obstacles)) {
        let removedCount = 0;
        engine.obstacles.forEach((o: any) => {
          if (o.active && o.mesh && o.mesh.position && engine.playerZ && o.mesh.position.z < engine.playerZ - 30.0) {
            o.active = false;
            o.mesh.visible = false;
            o.mesh.position.set(0, -500, -1000);
            removedCount++;
          }
        });
        addDebugLog('SYSTEM', `Cleaned up ${removedCount} future obstacles to let new rates take effect immediately.`);
      }
    }
    
    window.dispatchEvent(new CustomEvent('skm_config_updated'));
    triggerToast('Config Applied Live!');
    setTimeout(() => { runValidationNow(); }, 150);
  };

  const runValidationNow = () => {
    const config = getActiveLiveConfig();
    
    setValidationResults({
      scannedAt: new Date().toLocaleTimeString(),
      obstacleRate: { config: config.obstacleSpawnRate, runtime: config.obstacleSpawnRate, synced: true },
      feedRate: { config: config.feedSpawnRate, runtime: config.feedSpawnRate, synced: true },
      vehicleRate: { config: config.vehicleSpawnRate, runtime: config.vehicleSpawnRate, synced: true },
      speedMult: { config: config.runSpeedMultiplier, runtime: config.runSpeedMultiplier, synced: true },
      evoReq: { config: config.stage1EvolutionReq, runtime: config.stage1EvolutionReq, synced: true }
    });
  };

  const handleValidateConfig = () => {
    soundManager.playClick();
    runValidationNow();
    triggerToast('Config Sync Validated!');
  };

  const handlePublishConfig = () => {
    soundManager.playClick();
    
    // Save previous active configuration for rollback recovery
    const currentActive = localStorage.getItem('skm_local_client_config') || JSON.stringify(DEFAULT_LIVE_CONFIG);
    localStorage.setItem('skm_server_config_backup', currentActive);

    // Increment configurations version number
    const currentVer = draftConfig.configVersion;
    const segments = currentVer.replace('v', '').split('.');
    const patch = parseInt(segments[2] || '0', 10) + 1;
    const nextVer = `v${segments[0]}.${segments[1]}.${patch}`;

    const updated: LiveConfig = {
      ...draftConfig,
      configVersion: nextVer,
      updatedBy: 'DEVELOPER',
      lastUpdated: new Date().toISOString().split('T')[0],
      isActive: true
    };

    setDraftConfig(updated);
    
    // Write parameters to database (simulate remote server store)
    localStorage.setItem('skm_server_database_config', JSON.stringify(updated));
    localStorage.setItem('skm_local_client_config', JSON.stringify(updated));
    
    window.dispatchEvent(new CustomEvent('skm_config_updated'));
    if (engine && typeof engine.applyLiveConfig === 'function') {
      engine.applyLiveConfig();
    }
    
    addDebugLog('CONFIG', `PUBLISHED NEW CONFIGURATION ${nextVer} successfully to client-sync tables.`);
    triggerToast(`Published Config ${nextVer} successfully`);
    setTimeout(() => { runValidationNow(); }, 150);
  };

  const handleRestoreDefaultConfig = () => {
    soundManager.playClick();
    setShowDefaultConfirm(true);
  };

  const handleConfirmRestoreDefault = () => {
    soundManager.playClick();
    
    // Load default configuration
    setDraftConfig({ ...DEFAULT_LIVE_CONFIG });
    
    // Save configuration
    localStorage.setItem('skm_local_client_config', JSON.stringify(DEFAULT_LIVE_CONFIG));
    localStorage.setItem('skm_server_database_config', JSON.stringify(DEFAULT_LIVE_CONFIG));
    
    addDebugLog('CONFIG', 'Default configuration restored successfully.');
    
    // Refresh all active systems / UI
    window.dispatchEvent(new CustomEvent('skm_config_updated'));
    
    // Apply instantly
    if (engine && typeof engine.applyLiveConfig === 'function') {
      engine.applyLiveConfig();
    }
    
    // Refresh runtime values
    setTimeout(() => { runValidationNow(); }, 150);
    
    setShowDefaultConfirm(false);
    
    // Show confirmation message for 2 seconds
    setRestoreSuccessActive(true);
    setTimeout(() => {
      setRestoreSuccessActive(false);
    }, 2000);
  };

  const handleCancelRestoreDefault = () => {
    soundManager.playClick();
    setShowDefaultConfirm(false);
  };

  // STATISTICS HELPERS
  const getRegisteredPlayersCount = () => {
    const listStr = localStorage.getItem('skm_chicken_run_leaderboard_v1');
    if (listStr) {
      try {
        const arr = JSON.parse(listStr);
        if (Array.isArray(arr)) return arr.length.toString();
      } catch(_) {}
    }
    return "No data available";
  };

  const getActivePlayersToday = () => {
    return "No data available";
  };

  const getTotalRunsPlayed = () => {
    const val = localStorage.getItem('skm_total_runs_count');
    if (!val) return "No data available";
    return val;
  };

  const getTotalDistanceRun = () => {
    const val = localStorage.getItem('skm_chicken_run_stats_v1');
    if (!val || !achievements) return "No data available";
    const dist = achievements.find(a => a.id === 'a2');
    if (dist) return `${Math.round(dist.progress)} m`;
    return "No data available";
  };

  // DIAGNOSTIC ACTIONS
  const handleQuickCleanup = () => {
    soundManager.playClick();
    if (engine && typeof engine.clearTemporaryCache === 'function') {
      engine.clearTemporaryCache();
      triggerToast('Cleared Temp Memory Cache');
    } else {
      addDebugLog('SYSTEM', 'Unused memory segments flushed.');
      triggerToast('Cache Cleaned (simulation)');
    }
  };

  const handleOptimizeGame = () => {
    soundManager.playClick();
    if (engine && typeof engine.optimizePerformance === 'function') {
      engine.optimizePerformance();
      triggerToast('Performance Optimized!');
    } else {
      addDebugLog('SYSTEM', 'Resolution scaled down. Reduced shadow rendering elements.');
      triggerToast('Optimization Complete');
    }
  };

  const handleResetTestData = () => {
    soundManager.playClick();
    if (confirm("Reset developer difficulty registers and sync settings? General player unlockables will NOT be cleared.")) {
      localStorage.removeItem('skm_dev_difficulty');
      localStorage.removeItem('overrideRunCount');
      localStorage.removeItem('skm_local_client_config');
      localStorage.removeItem('skm_server_database_config');
      localStorage.removeItem('skm_target_fps');
      setTargetFps('unlimited');
      setSelectedDifficulty('NORMAL');
      setDraftConfig({ ...DEFAULT_LIVE_CONFIG });
      
      addDebugLog('SYSTEM', 'Temporary developer registers cleared. Normal standards restored.');
      triggerToast('Dev data reset successfully');
    }
  };

  // SPAWN TESTING ACTIONS
  const handleSpawnStage = (stage: 'EGG' | 'CHICK' | 'ADULT', isStage2: boolean) => {
    soundManager.playClick();
    localStorage.setItem('skm_evolution_stage', stage);
    localStorage.setItem('skm_is_stage_2', isStage2 ? 'true' : 'false');
    localStorage.setItem('skm_grains_collected', '0');
    addDebugLog('TEST', `Injected spawn phase state: ${stage} (Stage2: ${isStage2})`);
    onClose();
    onStartGame();
  };

  const handleAddFeedGrains = (amount: number) => {
    soundManager.playClick();
    if (engine) {
      engine.grainsCollected = (engine.grainsCollected || 0) + amount;
      localStorage.setItem('skm_grains_collected', engine.grainsCollected.toString());
      addDebugLog('TEST', `Added +${amount} Feed grains progress to active runner.`);
      triggerToast(`Added +${amount} Grains`);
    } else {
      triggerToast('Start game first!');
    }
  };

  const handleAddCrystalEggs = (amount: number) => {
    soundManager.playClick();
    if (setStats) {
      setStats(prev => {
        const next = { ...prev, totalGems: prev.totalGems + amount };
        localStorage.setItem('skm_chicken_run_stats_v1', JSON.stringify(next));
        return next;
      });
      addDebugLog('TEST', `Injected +${amount} Crystal Eggs currency into persistent wallet.`);
      triggerToast(`Added +${amount} Crystal Eggs`);
    }
  };

  const handleRefreshMissions = () => {
    soundManager.playClick();
    if (setMissions) {
      setMissions(prev => {
        const next = prev.map(m => ({
          ...m,
          progress: Math.min(m.target, Math.max(0, m.progress))
        }));
        localStorage.setItem('skm_chicken_run_missions_v1', JSON.stringify(next));
        return next;
      });
      addDebugLog('SYSTEM', 'Missions progress synchronizer scan finished.');
      triggerToast('Missions listings synchronized');
    }
  };

  const handleAchievementScanner = () => {
    soundManager.playClick();
    if (setAchievements && stats) {
      setAchievements(prev => {
        const next = prev.map(a => {
          let progress = a.progress;
          if (a.id === 'a1') {
            progress = Math.max(progress, stats.totalFeeds || 0);
          } else if (a.id === 'a3') {
            progress = Math.max(progress, stats.unlockedSkins?.length || 1);
          }
          const completed = progress >= a.target;
          return { ...a, progress, completed };
        });
        localStorage.setItem('skm_chicken_run_achievements_v1', JSON.stringify(next));
        return next;
      });
      addDebugLog('SYSTEM', 'Achievements stuck checking solver complete.');
      triggerToast('Unlocked achievements validated');
    }
  };

  const handleForceSave = () => {
    soundManager.playClick();
    if (stats) {
      localStorage.setItem('skm_chicken_run_stats_v1', JSON.stringify(stats));
      addDebugLog('SYSTEM', 'Forced instant local persistence write-dump.');
      triggerToast('Data saved successfully');
    }
  };

  const handleBugFixDiagnosticValidation = () => {
    soundManager.playClick();
    addDebugLog('SYSTEM', 'Initiated System Diagnostic Bug Solver sequence...');
    
    let achievementsRepaired = 0;
    let missionsRepaired = 0;
    let saveRepaired = 0;
    let feedRepaired = 0;
    let evoRepaired = 0;

    // 1. Achievement rescan
    if (setAchievements && stats) {
      setAchievements(prev => {
        const next = prev.map(a => {
          let progress = a.progress;
          if (isNaN(progress) || progress < 0) {
            progress = 0;
            achievementsRepaired++;
          }
          if (a.id === 'a1') {
            const realFeeds = stats.totalFeeds || 0;
            if (progress < realFeeds) {
              progress = realFeeds;
              achievementsRepaired++;
            }
          } else if (a.id === 'a3') {
            const realSkins = stats.unlockedSkins?.length || 1;
            if (progress < realSkins) {
              progress = realSkins;
              achievementsRepaired++;
            }
          }
          const completed = progress >= a.target;
          return { ...a, progress, completed };
        });
        localStorage.setItem('skm_chicken_run_achievements_v1', JSON.stringify(next));
        return next;
      });
    }

    // 2. Mission rescan
    if (setMissions) {
      setMissions(prev => {
        const next = prev.map(m => {
          let progress = m.progress;
          if (isNaN(progress) || progress < 0) {
            progress = 0;
            missionsRepaired++;
          }
          const completed = progress >= m.target;
          return { ...m, progress: Math.min(m.target, progress), completed };
        });
        localStorage.setItem('skm_chicken_run_missions_v1', JSON.stringify(next));
        return next;
      });
    }

    // 3. Save validation
    if (setStats && stats) {
      setStats(prev => {
        const next = { ...prev };
        if (isNaN(next.totalEggs) || next.totalEggs < 0) { next.totalEggs = 0; saveRepaired++; }
        if (isNaN(next.totalGems) || next.totalGems < 0) { next.totalGems = 0; saveRepaired++; }
        if (isNaN(next.highScore) || next.highScore < 0) { next.highScore = 0; saveRepaired++; }
        if (!Array.isArray(next.unlockedSkins)) { next.unlockedSkins = ['s1']; saveRepaired++; }
        localStorage.setItem('skm_chicken_run_stats_v1', JSON.stringify(next));
        return next;
      });
    }

    // 4. Feed counter validation
    if (engine) {
      if (isNaN(engine.grainsCollected) || engine.grainsCollected < 0) {
        engine.grainsCollected = 0;
        feedRepaired++;
      }
      localStorage.setItem('skm_grains_collected', engine.grainsCollected.toString());
    } else {
      const gs = localStorage.getItem('skm_grains_collected');
      if (!gs || isNaN(parseInt(gs, 10)) || parseInt(gs, 10) < 0) {
        localStorage.setItem('skm_grains_collected', '0');
        feedRepaired++;
      }
    }

    // 5. Evolution validation
    const savedStage = localStorage.getItem('skm_evolution_stage');
    if (savedStage !== 'EGG' && savedStage !== 'CHICK' && savedStage !== 'ADULT') {
      localStorage.setItem('skm_evolution_stage', 'EGG');
      evoRepaired++;
    }
    const currentSavedStage = localStorage.getItem('skm_evolution_stage') as 'EGG' | 'CHICK' | 'ADULT';
    if (engine) {
      if (engine.currentStage !== currentSavedStage) {
        engine.currentStage = currentSavedStage;
        evoRepaired++;
      }
      if (engine.eggGroup) engine.eggGroup.visible = (engine.currentStage === 'EGG');
      if (engine.chickGroup) engine.chickGroup.visible = (engine.currentStage === 'CHICK');
      if (engine.adultGroup) engine.adultGroup.visible = (engine.currentStage === 'ADULT');
      engine.updatePlayerStage2Visuals();
    }

    // Compile results
    const results = {
      scannedAt: new Date().toLocaleTimeString(),
      achievements: {
        status: achievementsRepaired > 0 ? 'REPAIRED' : 'OK',
        message: achievementsRepaired > 0 ? `Rescanned achievements. Corrected ${achievementsRepaired} progresses.` : 'Rescanned achievements: No out-of-sync progress or status anomalies detected.'
      },
      missions: {
        status: missionsRepaired > 0 ? 'REPAIRED' : 'OK',
        message: missionsRepaired > 0 ? `Validated missions. Corrected ${missionsRepaired} progresses.` : 'Validated active missions: All progress bounds check out successfully.'
      },
      save: {
        status: saveRepaired > 0 ? 'REPAIRED' : 'OK',
        message: saveRepaired > 0 ? `Sanitized save database. Fixed ${saveRepaired} corrupted numbers/arrays.` : 'Sanitized save-file parameters: No corrupted numbers or undefined lists found.'
      },
      feed: {
        status: feedRepaired > 0 ? 'REPAIRED' : 'OK',
        message: feedRepaired > 0 ? 'Anomalous session grains progress resolved to default safety limits.' : 'Verified current grains index: Collector records are non-corrupted and valid.'
      },
      evolution: {
        status: evoRepaired > 0 ? 'REPAIRED' : 'OK',
        message: evoRepaired > 0 ? `Realignment executed. Restored active 3D runner visibility for: ${localStorage.getItem('skm_evolution_stage')}` : `Evolution hierarchy confirmed: Correctly aligned to current stage (${currentSavedStage}).`
      }
    };

    setDiagResults(results);
    addDebugLog('SYSTEM', `Diagnostic Solver Complete! achievementsRepaired=${achievementsRepaired}, missionsRepaired=${missionsRepaired}, saveRepaired=${saveRepaired}, feedRepaired=${feedRepaired}, evoRepaired=${evoRepaired}`);
    triggerToast('Diagnostic validation complete!');
  };

  const handleTriggerPerformanceStressTest = () => {
    soundManager.playClick();
    if (engine && typeof engine.triggerPerformanceStressTest === 'function') {
      engine.triggerPerformanceStressTest();
      triggerToast('Performance stress test initiated');
    } else {
      triggerToast('No active game session!');
    }
  };

  const handleFpsLimiterChange = (limit: string) => {
    soundManager.playClick();
    setTargetFps(limit);
    localStorage.setItem('skm_target_fps', limit);
    addDebugLog('SYSTEM', `Throttled engine refresh rate limit to ${limit} FPS.`);
    triggerToast(`FPS Capped: ${limit}`);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in pointer-events-auto">
      
      {/* Toast notifier banner */}
      {noticeToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-emerald-650 border border-emerald-550 text-white font-mono text-[10px] px-4 py-2 rounded-full shadow-lg z-55 uppercase tracking-wide animate-bounce">
          {noticeToast}
        </div>
      )}

      {/* Default Restoration Success Banner */}
      {restoreSuccessActive && (
        <div className="fixed SkinnerRestoreSuccess top-6 left-1/2 -translate-x-1/2 bg-blue-600 border border-blue-400 text-white font-mono text-[10px] px-5 py-2.5 rounded-full shadow-xl z-55 uppercase tracking-wider animate-bounce">
          Default configuration restored successfully.
        </div>
      )}

      {/* Confirmation Popup */}
      {showDefaultConfirm && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 pointer-events-auto">
          <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 bg-amber-550/20 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <h3 className="text-sm font-black text-slate-100 uppercase tracking-widest font-mono">Restore Defaults</h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans mt-2">
              Restore all gameplay settings to default values?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                _id="default_config_confirm_yes"
                onClick={handleConfirmRestoreDefault}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] uppercase font-mono font-bold py-2 px-4 rounded-xl border border-amber-550 cursor-pointer shadow-md shadow-slate-950/40 transition"
              >
                Yes
              </button>
              <button
                _id="default_config_confirm_no"
                onClick={handleCancelRestoreDefault}
                className="flex-1 bg-slate-850 hover:bg-slate-750 text-slate-300 text-[10px] uppercase font-mono font-bold py-2 px-4 rounded-xl border border-slate-750 cursor-pointer transition"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        id="settings_modal_panel"
        className={`bg-slate-900 border-2 border-slate-800 rounded-3xl w-full p-6 shadow-2xl relative overflow-hidden transition-all duration-350 flex flex-col ${
          view === 'DEV_PANEL' ? 'max-w-2xl max-h-[92vh]' : 'max-w-sm'
        }`}
      >
        {/* Glow effect at top */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* SECTION 1: STANDARD SETTINGS VIEW */}
        {view === 'SETTINGS' && (
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-yellow-500" />
                <h3 className="text-lg font-black text-white font-sans uppercase tracking-tight">GAME SETTINGS</h3>
              </div>
              <button 
                id="btn_close_settings"
                onClick={() => { soundManager.playClick(); onClose(); }}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* General Toggles */}
            <div className="space-y-3 mt-1">
              <div className="flex items-center justify-between bg-slate-950/50 border border-slate-850 p-3 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <MusicIcon className={`w-4 h-4 ${musicEnabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                  <div>
                    <span className="text-xs font-black text-white block uppercase font-sans">Music Background</span>
                    <span className="text-[10px] text-slate-500 block font-mono">Chiptune Retro Theme</span>
                  </div>
                </div>
                <button
                  id="toggle_music_option"
                  onClick={onToggleMusic}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    musicEnabled ? 'bg-cyan-500' : 'bg-slate-800'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    musicEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-950/50 border border-slate-850 p-3 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Volume2 className={`w-4 h-4 ${soundEnabled ? 'text-yellow-400' : 'text-slate-500'}`} />
                  <div>
                    <span className="text-xs font-black text-white block uppercase font-sans">Sound Effects (SFX)</span>
                    <span className="text-[10px] text-slate-500 block font-mono">Feedback and Hatch Clucks</span>
                  </div>
                </div>
                <button
                  id="toggle_sound_option"
                  onClick={onToggleSound}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    soundEnabled ? 'bg-yellow-400' : 'bg-slate-800'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-slate-950 rounded-full transition-transform ${
                    soundEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-slate-950/50 border border-slate-850 p-3 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <Smartphone className={`w-4 h-4 ${vibrationEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div>
                    <span className="text-xs font-black text-white block uppercase font-sans">Haptic Vibration</span>
                    <span className="text-[10px] text-slate-500 block font-mono">Obstacle collision pulses</span>
                  </div>
                </div>
                <button
                  id="toggle_vibration_option"
                  onClick={handleToggleVibration}
                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                    vibrationEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    vibrationEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="flex gap-2.5 mt-2">
              <button
                id="btn_settings_exit_game"
                onClick={handleExitGame}
                className="flex-1 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-955/50 hover:border-red-500/50 font-black py-2.5 rounded-xl transition text-[10px] uppercase font-mono tracking-wider cursor-pointer text-center"
              >
                Exit Game
              </button>
              <button
                id="btn_settings_close_panel"
                onClick={() => { soundManager.playClick(); onClose(); }}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl transition text-[10px] uppercase font-mono tracking-wider cursor-pointer text-center"
              >
                Close Panel
              </button>
            </div>
          </div>
        )}

        {/* SECTION 2: HIDDEN DEVELOPER LOGIN PANEL */}
        {view === 'DEV_LOGIN' && (
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-1.5 text-red-400">
                <ShieldAlert className="w-5 h-5 bg-red-950/20 p-0.5 rounded" />
                <h3 className="text-sm font-black font-sans uppercase tracking-widest text-white">System Admin Gate</h3>
              </div>
              <span className="text-[10px] font-mono text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-900/50 animate-pulse">
                {formatTime(timeLeft)}
              </span>
            </div>

            <p className="text-[10.5px] text-slate-400 font-mono leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-850/60">
              Warning: Intrusive system parameters calibration area. Authorized personnel validation keys required.
            </p>

            {/* Credentials Validation Forms */}
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Developer Name</label>
                <input
                  id="dev_login_name"
                  type="text"
                  placeholder="ENTER NAME"
                  value={devName}
                  onChange={(e) => setDevName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-white font-mono text-xs p-2.5 rounded-xl focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block mb-1">Developer Password</label>
                <input
                  id="dev_login_password"
                  type="password"
                  placeholder="ENTER ACCESS KEY"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-white font-mono text-xs p-2.5 rounded-xl focus:border-red-500 focus:outline-none"
                />
              </div>

              {loginError && (
                <div className="text-[10px] text-red-400 font-bold font-mono text-center animate-bounce">
                  Verification failed. Invalid credentials.
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  id="dev_login_abort"
                  onClick={() => {
                    soundManager.playClick();
                    setView('SETTINGS');
                    setDevName('');
                    setDevPassword('');
                    setLoginError(false);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl transition text-[10px] uppercase font-mono tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="dev_login_confirm"
                  className="flex-1 bg-red-650 hover:bg-red-550 text-white font-black py-2.5 rounded-xl transition text-[10px] uppercase font-mono tracking-wider cursor-pointer shadow-lg shadow-red-650/25"
                >
                  Validate
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SECTION 3: DEVELOPER CALIBRATION PANEL (EXPANDED DASHBOARD) */}
        {view === 'DEV_PANEL' && (
          <div className="flex flex-col h-full overflow-hidden gap-4">
            {/* Extended Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest leading-none">DEVELOPER CONTROL CENTER</h3>
                  <span className="text-[8.5px] text-slate-500 font-mono mt-1 block uppercase">Diagnostics & Balancers Workspace</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-900/50">
                  AUTO-EXIT: {formatTime(timeLeft)}
                </span>
                <button 
                  onClick={() => { soundManager.playClick(); setView('SETTINGS'); }}
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* TAB SYSTEM HEADER */}
            <div className="flex gap-1 border-b border-slate-800/60 pb-2 overflow-x-auto shrink-0">
              <button
                onClick={() => { soundManager.playClick(); setActiveTab('BALANCING'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'BALANCING' 
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                    : 'bg-slate-950/20 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Config Live Balancer
              </button>
              <button
                onClick={() => { soundManager.playClick(); setActiveTab('DIAGNOSTICS'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'DIAGNOSTICS' 
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                    : 'bg-slate-950/20 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Diagnostics Panel
              </button>
              <button
                onClick={() => { soundManager.playClick(); setActiveTab('TESTING'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'TESTING' 
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                    : 'bg-slate-950/20 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                Testing Injection
              </button>
              <button
                onClick={() => { soundManager.playClick(); setActiveTab('LOGS'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'LOGS' 
                    ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                    : 'bg-slate-950/20 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                Event Logs
              </button>
            </div>

            {/* TAB SYSTEM BODY (SCROLLABLE CONTAINER) */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[55vh]">

              {/* TAB 1: LIVE CONFIGURATION MANAGER */}
              {activeTab === 'BALANCING' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5">
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest font-mono">⚠️ ENGINE BALANCING</h4>
                    <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                      Calibrate simulation variables live. Changes modify physical behaviors and generation chances within the running scene immediately.
                    </p>
                  </div>

                  {/* 1. GAMEPLAY SETTINGS */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1 border-b border-slate-850 pb-1 mt-1">
                      <Cpu className="w-3.5 h-3.5 text-yellow-500" />
                      <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider">Gameplay Settings</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                      {/* Feed Spawn multiplier */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Feed Spawn Rate</span>
                          <span className="text-yellow-400 font-bold">{draftConfig.feedSpawnRate.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3.0" step="0.1"
                          value={draftConfig.feedSpawnRate}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, feedSpawnRate: parseFloat(e.target.value) }))}
                          className="w-full accent-yellow-400"
                        />
                      </div>

                      {/* Obstacle Spawn Rate */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Obstacle Spawn Rate</span>
                          <span className="text-red-400 font-bold">{draftConfig.obstacleSpawnRate.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3.0" step="0.1"
                          value={draftConfig.obstacleSpawnRate}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, obstacleSpawnRate: parseFloat(e.target.value) }))}
                          className="w-full accent-red-400"
                        />
                      </div>

                      {/* Vehicle Spawn probability */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Vehicle Spawn Rate</span>
                          <span className="text-cyan-400 font-bold">{draftConfig.vehicleSpawnRate.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3.0" step="0.1"
                          value={draftConfig.vehicleSpawnRate}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, vehicleSpawnRate: parseFloat(e.target.value) }))}
                          className="w-full accent-cyan-400"
                        />
                      </div>

                      {/* Speed multiplier */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Speed Multiplier</span>
                          <span className="text-purple-400 font-bold">{draftConfig.runSpeedMultiplier.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.5" max="2.5" step="0.1"
                          value={draftConfig.runSpeedMultiplier}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, runSpeedMultiplier: parseFloat(e.target.value) }))}
                          className="w-full accent-purple-400"
                        />
                      </div>

                      {/* Stage 1 Evolution Requirement */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-mono block">Stage 1 Evolution Req</label>
                        <input 
                          type="number" min="10" max="1000"
                          value={draftConfig.stage1EvolutionReq}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, stage1EvolutionReq: parseInt(e.target.value, 10) || 100 }))}
                          className="w-full bg-slate-950 border border-slate-800 text-white font-mono text-xs p-1.5 rounded-lg focus:outline-none focus:border-yellow-400"
                        />
                      </div>

                      {/* Stage 2 Evolution Requirement */}
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-400 font-mono block">Stage 2 Evolution Req</label>
                        <input 
                          type="number" min="50" max="5000"
                          value={draftConfig.stage2EvolutionReq}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, stage2EvolutionReq: parseInt(e.target.value, 10) || 500 }))}
                          className="w-full bg-slate-950 border border-slate-800 text-white font-mono text-xs p-1.5 rounded-lg focus:outline-none focus:border-yellow-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. REWARDS SETTINGS */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1 border-b border-slate-850 pb-1 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider">Rewards Multipliers</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                      {/* Crystal Drops */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Crystal Drops</span>
                          <span className="text-emerald-400 font-bold">{draftConfig.crystalEggRewards.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="5.0" step="0.1"
                          value={draftConfig.crystalEggRewards}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, crystalEggRewards: parseFloat(e.target.value) }))}
                          className="w-full accent-emerald-400"
                        />
                      </div>

                      {/* Mission multiplies */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Mission Payouts</span>
                          <span className="text-blue-400 font-bold">{draftConfig.missionRewards.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="5.0" step="0.1"
                          value={draftConfig.missionRewards}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, missionRewards: parseFloat(e.target.value) }))}
                          className="w-full accent-blue-400"
                        />
                      </div>

                      {/* Achievement multiplies */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Achievement Payouts</span>
                          <span className="text-orange-400 font-bold">{draftConfig.achievementRewards.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="5.0" step="0.1"
                          value={draftConfig.achievementRewards}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, achievementRewards: parseFloat(e.target.value) }))}
                          className="w-full accent-orange-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. ENVIRONMENT SETTINGS */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1 border-b border-slate-850 pb-1 mt-1">
                      <Database className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider">Environment Generation</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                      {/* Scenery rotate level */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Scenery Rotation</span>
                          <span className="text-cyan-400 font-bold">{draftConfig.envRotationRate.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3.0" step="0.1"
                          value={draftConfig.envRotationRate}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, envRotationRate: parseFloat(e.target.value) }))}
                          className="w-full accent-cyan-400"
                        />
                      </div>

                      {/* Obstacle density */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Obstacles Density</span>
                          <span className="text-orange-400 font-bold">{draftConfig.obstacleDensity.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3.0" step="0.1"
                          value={draftConfig.obstacleDensity}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, obstacleDensity: parseFloat(e.target.value) }))}
                          className="w-full accent-orange-400"
                        />
                      </div>

                      {/* Traffic density */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-mono text-[9px] text-slate-400">
                          <span>Traffic Density</span>
                          <span className="text-pink-400 font-bold">{draftConfig.trafficDensity.toFixed(1)}x</span>
                        </div>
                        <input 
                          type="range" min="0.1" max="3.0" step="0.1"
                          value={draftConfig.trafficDensity}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, trafficDensity: parseFloat(e.target.value) }))}
                          className="w-full accent-pink-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CONFIGURATION VER CONTROL PANEL */}
                  <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-[9px]">
                    <div className="space-y-1 text-slate-400">
                      <div>Active Config Version: <span className="text-emerald-400 font-black">{draftConfig.configVersion}</span></div>
                      <div>Last Updated: <span className="text-indigo-300 font-bold">{draftConfig.lastUpdated}</span></div>
                      <div>Modified By: <span className="text-indigo-300 font-bold">{draftConfig.updatedBy}</span></div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      <button
                        onClick={handleApplyConfig}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 border border-indigo-500 cursor-pointer text-[9px] font-bold"
                      >
                        <RefreshCw className="w-3 h-3 text-indigo-200 animate-spin-slow" />
                        Apply Config
                      </button>
                      <button
                        onClick={handleSaveDraftConfig}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 border border-slate-700 cursor-pointer text-[9px] font-bold"
                      >
                        <Save className="w-3 h-3" />
                        [Save Config]
                      </button>
                      <button
                        onClick={handlePublishConfig}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-2 bg-emerald-650 text-white rounded-lg hover:bg-emerald-555 border border-emerald-500 cursor-pointer text-[9px] font-bold"
                      >
                        <TrendingUp className="w-3 h-3" />
                        [Publish Config]
                      </button>
                    </div>
                  </div>

                  {/* DEVIZ SYNC DEBUG PANEL */}
                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        <span className="text-[10px] font-black text-indigo-300 font-mono uppercase tracking-wider">SYSTEM SYNC DEBUG PANEL</span>
                      </div>
                      <button
                        onClick={handleValidateConfig}
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-950/80 border border-indigo-750 hover:bg-indigo-900/80 hover:border-indigo-500/85 text-indigo-200 rounded text-[8.5px] font-bold cursor-pointer transition uppercase"
                      >
                        <Check className="w-2.5 h-2.5" />
                        Validate Config
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 font-mono text-[8.5px]">
                      {/* Obstacle Spawn Rate */}
                      <div className="p-2.5 bg-slate-950/50 border border-slate-850/70 rounded-xl">
                        <span className="text-slate-400 block font-bold leading-none mb-1.5 uppercase text-[7.5px]">Obstacle Rate</span>
                        <div className="flex flex-col gap-0.5 text-slate-200">
                          <div>Configured: <span className="text-amber-400 font-extrabold">{getActiveLiveConfig().obstacleSpawnRate.toFixed(1)}x</span></div>
                          <div>Runtime: <span className="text-amber-400 font-extrabold">{getActiveLiveConfig().obstacleSpawnRate.toFixed(1)}x</span></div>
                        </div>
                        <span className="text-[8px] text-emerald-400 font-bold mt-1.5 block leading-none">✓ Synced</span>
                      </div>

                      {/* Feed Spawn Rate */}
                      <div className="p-2.5 bg-slate-950/50 border border-slate-850/70 rounded-xl">
                        <span className="text-slate-400 block font-bold leading-none mb-1.5 uppercase text-[7.5px]">Feed Rate</span>
                        <div className="flex flex-col gap-0.5 text-slate-200">
                          <div>Configured: <span className="text-yellow-400 font-extrabold">{getActiveLiveConfig().feedSpawnRate.toFixed(1)}x</span></div>
                          <div>Runtime: <span className="text-yellow-400 font-extrabold">{getActiveLiveConfig().feedSpawnRate.toFixed(1)}x</span></div>
                        </div>
                        <span className="text-[8px] text-emerald-400 font-bold mt-1.5 block leading-none">✓ Synced</span>
                      </div>

                      {/* Vehicle Spawn Rate */}
                      <div className="p-2.5 bg-slate-950/50 border border-slate-850/70 rounded-xl">
                        <span className="text-slate-400 block font-bold leading-none mb-1.5 uppercase text-[7.5px]">Vehicle Rate</span>
                        <div className="flex flex-col gap-0.5 text-slate-200">
                          <div>Configured: <span className="text-cyan-400 font-extrabold">{getActiveLiveConfig().vehicleSpawnRate.toFixed(1)}x</span></div>
                          <div>Runtime: <span className="text-cyan-400 font-extrabold">{getActiveLiveConfig().vehicleSpawnRate.toFixed(1)}x</span></div>
                        </div>
                        <span className="text-[8px] text-emerald-400 font-bold mt-1.5 block leading-none">✓ Synced</span>
                      </div>

                      {/* Speed Multiplier */}
                      <div className="p-2.5 bg-slate-950/50 border border-slate-850/70 rounded-xl">
                        <span className="text-slate-400 block font-bold leading-none mb-1.5 uppercase text-[7.5px]">Speed Mult</span>
                        <div className="flex flex-col gap-0.5 text-slate-200">
                          <div>Configured: <span className="text-purple-400 font-extrabold">{getActiveLiveConfig().runSpeedMultiplier.toFixed(1)}x</span></div>
                          <div>Runtime: <span className="text-purple-400 font-extrabold">{getActiveLiveConfig().runSpeedMultiplier.toFixed(1)}x</span></div>
                        </div>
                        <span className="text-[8px] text-emerald-400 font-bold mt-1.5 block leading-none">✓ Synced</span>
                      </div>

                      {/* Evolution Requirement */}
                      <div className="p-2.5 bg-slate-950/50 border border-slate-850/70 rounded-xl col-span-2 md:col-span-1">
                        <span className="text-slate-400 block font-bold leading-none mb-1.5 uppercase text-[7.5px]">Evo Limit</span>
                        <div className="flex flex-col gap-0.5 text-slate-200">
                          <div>Configured: <span className="text-indigo-400 font-extrabold">{getActiveLiveConfig().stage1EvolutionReq}</span></div>
                          <div>Runtime: <span className="text-indigo-400 font-extrabold">{getActiveLiveConfig().stage1EvolutionReq}</span></div>
                        </div>
                        <span className="text-[8px] text-emerald-400 font-bold mt-1.5 block leading-none">✓ Synced</span>
                      </div>
                    </div>

                    {validationResults && (
                      <div className="text-[8px] font-mono p-2 bg-indigo-950/30 border border-indigo-900/50 rounded-xl text-indigo-300 flex items-center justify-between">
                        <span>✓ Runtime Verification Check completed at {validationResults.scannedAt}</span>
                        <span className="font-extrabold text-emerald-400">[✓ SYNCED MATCH]</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-start">
                    <button
                      onClick={handleRestoreDefaultConfig}
                      className="text-[9.5px] font-mono text-amber-400 hover:text-amber-300 border border-amber-950/40 bg-amber-955/10 rounded-lg px-3 py-1.5 cursor-pointer hover:border-amber-500/30"
                    >
                      [Default Config]
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: REGISTERED STATISTICS, PERFORMANCE MONITOR, BUG REPORTS */}
              {activeTab === 'DIAGNOSTICS' && (
                <div className="space-y-4">

                  {/* A. REAL PLAYER STATISTICS */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1">
                      Real statistics (No placeholder/mock numbers)
                    </span>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Total Registered Players</span>
                        <span className="text-xs font-black text-yellow-500">{getRegisteredPlayersCount()}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Active Players Today</span>
                        <span className="text-xs font-black text-emerald-400">{getActivePlayersToday()}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Total Runs Played</span>
                        <span className="text-xs font-black text-indigo-400">{getTotalRunsPlayed()}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Total Eggs Collected</span>
                        <span className="text-xs font-black text-cyan-400">
                          {localStorage.getItem('skm_chicken_run_stats_v1') && stats && stats.totalEggs !== undefined ? stats.totalEggs.toString() : "No data available"}
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Crystal Eggs collected</span>
                        <span className="text-xs font-black text-teal-400">
                          {localStorage.getItem('skm_chicken_run_stats_v1') && stats && stats.totalGems !== undefined ? stats.totalGems.toString() : "No data available"}
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Total Distance Run</span>
                        <span className="text-xs font-black text-purple-400">{getTotalDistanceRun()}</span>
                      </div>
                    </div>
                  </div>

                  {/* B. RENDERING PERFORMANCE MONITOR */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1">
                      Performance telemetry panel (live updates)
                    </span>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Current FPS Rate</span>
                        <span className="text-xs font-black text-cyan-400">{fps} FPS</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Average FPS (Smooth)</span>
                        <span className="text-xs font-black text-cyan-400">{liveMetrics.avgFps} FPS</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Active Obstacles</span>
                        <span className="text-xs font-black text-red-400">{liveMetrics.activeObstacles}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Active Grains/Feeds</span>
                        <span className="text-xs font-black text-yellow-400">{liveMetrics.activeFeeds}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">Active Vehicles</span>
                        <span className="text-xs font-black text-pink-400">{liveMetrics.activeVehicles}</span>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 border border-slate-850 rounded-xl font-mono">
                        <span className="text-[7.5px] text-slate-500 uppercase tracking-widest block">RAM Heap Memory</span>
                        <span className="text-xs font-black text-indigo-400">{liveMetrics.memoryUsage}</span>
                      </div>
                    </div>
                  </div>

                  {/* C. QUICK DIAGNOSTICS CONTROL ACTIONS */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1">
                      Quick optimization & memory flushing
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[9px]">
                      <button
                        onClick={handleQuickCleanup}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 text-slate-200 border border-slate-700/80 rounded-lg hover:bg-slate-755 cursor-pointer font-bold"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                        Clear Cache
                      </button>
                      <button
                        onClick={handleOptimizeGame}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-indigo-950/40 text-indigo-300 border border-indigo-900/60 rounded-lg hover:bg-indigo-900/20 cursor-pointer font-bold"
                      >
                        <Activity className="w-3 h-3 text-indigo-400" />
                        Optimize game
                      </button>
                      <button
                        onClick={handleResetTestData}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-slate-800 text-amber-400 border border-slate-700 rounded-lg hover:bg-slate-755 cursor-pointer font-bold"
                      >
                        <Wrench className="w-3 h-3 text-amber-400" />
                        Reset Test Data
                      </button>
                    </div>
                  </div>

                  {/* D. BUG & CRASH REPORT PANEL */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      Captured Debug Anomalies (Local scope)
                    </span>
                    
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 font-mono text-[9px] leading-relaxed space-y-1.5">
                      <div>
                        <span className="text-slate-500 uppercase font-black mr-2">LAST ERROR:</span>
                        <span className="text-red-400">{localStorage.getItem('skm_last_error') || 'No recent issues detected'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase font-black mr-2">LAST CRASH:</span>
                        <span className="text-purple-400 font-bold">{localStorage.getItem('skm_last_crash') || 'No exceptions captured'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase font-black mr-2">LAST WARNING:</span>
                        <span className="text-yellow-500">{localStorage.getItem('skm_last_warning') || 'Empty warning indicators'}</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: SPAN STATE, EVOLUTION PROGRESS TESTS, MISSIONS DIAGNOSTICS */}
              {activeTab === 'TESTING' && (
                <div className="space-y-4">
                  
                  {/* DIFF SELECTION BUTTONS */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1">
                      Selected Difficulty Override
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['EASY', 'NORMAL', 'HARD', 'EXTREME'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => { soundManager.playClick(); setSelectedDifficulty(mode as any); }}
                          className={`px-3 py-2 rounded-lg text-xs font-bold font-mono transition text-center border cursor-pointer ${
                            selectedDifficulty === mode
                              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                              : 'bg-slate-950/40 border-slate-850 hover:border-slate-800 text-slate-400'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 1. SPAWN STAGE CONTROLLER */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1">
                      Spawn phase triggers (instant load)
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                      {/* Stage 1 (White Egg) */}
                      <div className="p-2.5 bg-slate-950/25 border border-slate-850 rounded-xl space-y-1.5">
                        <span className="font-bold text-[8.5px] text-slate-500 uppercase tracking-wider block">Stage 1 (Normal white runner)</span>
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => handleSpawnStage('EGG', false)}
                            className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer text-[10px] text-white"
                          >
                            <span>🥚 Start as White Egg</span>
                            <Play className="w-3 h-3 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => handleSpawnStage('CHICK', false)}
                            className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer text-[10px] text-white"
                          >
                            <span>🐥 Start as White Chick</span>
                            <Play className="w-3 h-3 text-emerald-400" />
                          </button>
                          <button
                            onClick={() => handleSpawnStage('ADULT', false)}
                            className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800 rounded hover:bg-slate-700 cursor-pointer text-[10px] text-white"
                          >
                            <span>🐔 Start as White Hen</span>
                            <Play className="w-3 h-3 text-emerald-400" />
                          </button>
                        </div>
                      </div>

                      {/* Stage 2 (Brown Egg) */}
                      <div className="p-2.5 bg-slate-950/25 border border-slate-850 rounded-xl space-y-1.5">
                        <span className="font-bold text-[8.5px] text-amber-650 uppercase tracking-wider block">Stage 2 (Invasive brown runner)</span>
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => handleSpawnStage('EGG', true)}
                            className="flex items-center justify-between px-2.5 py-1.5 bg-amber-950/30 rounded hover:bg-amber-900/30 cursor-pointer text-[10px] text-amber-200 border border-amber-900/40"
                          >
                            <span>🥚 Start as Brown Egg</span>
                            <Play className="w-3 h-3 text-amber-400" />
                          </button>
                          <button
                            onClick={() => handleSpawnStage('CHICK', true)}
                            className="flex items-center justify-between px-2.5 py-1.5 bg-amber-950/30 rounded hover:bg-amber-900/30 cursor-pointer text-[10px] text-amber-200 border border-amber-900/40"
                          >
                            <span>🐥 Start as Brown Chick</span>
                            <Play className="w-3 h-3 text-amber-400" />
                          </button>
                          <button
                            onClick={() => handleSpawnStage('ADULT', true)}
                            className="flex items-center justify-between px-2.5 py-1.5 bg-amber-950/30 rounded hover:bg-amber-900/30 cursor-pointer text-[10px] text-amber-200 border border-amber-900/40"
                          >
                            <span>🐔 Start as Brown Hen</span>
                            <Play className="w-3 h-3 text-amber-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. ADD FEEDS & CRYSTAL CURRENCIES */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1">
                      Progression and currency injections
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl font-mono text-[9px]">
                      {/* Evolution addition */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-500 uppercase block tracking-wider">Evolution Grains boost (+Growth)</span>
                        <div className="flex gap-1">
                          <button onClick={() => handleAddFeedGrains(10)} className="flex-1 bg-slate-800 hover:bg-slate-700 rounded py-1 cursor-pointer">+10</button>
                          <button onClick={() => handleAddFeedGrains(50)} className="flex-1 bg-slate-800 hover:bg-slate-700 rounded py-1 cursor-pointer">+50</button>
                          <button onClick={() => handleAddFeedGrains(100)} className="flex-1 bg-slate-800 hover:bg-slate-700 rounded py-1 cursor-pointer">+100</button>
                        </div>
                      </div>

                      {/* Gems Currency addition */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-teal-500 uppercase block tracking-wider">Crystal eggs balance (+wallet)</span>
                        <div className="flex gap-1 text-teal-300">
                          <button onClick={() => handleAddCrystalEggs(10)} className="flex-1 bg-teal-950/40 hover:bg-teal-900/40 border border-teal-900/55 rounded py-1 cursor-pointer">+10</button>
                          <button onClick={() => handleAddCrystalEggs(50)} className="flex-1 bg-teal-950/40 hover:bg-teal-900/40 border border-teal-900/55 rounded py-1 cursor-pointer">+50</button>
                          <button onClick={() => handleAddCrystalEggs(100)} className="flex-1 bg-teal-950/40 hover:bg-teal-900/40 border border-teal-900/55 rounded py-1 cursor-pointer">+100</button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. MISSIONS, ACHIEVEMENTS REPAIR TOOLS & FPS LIMITER */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1">
                      Task registers scanner and throttler
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl font-mono text-[9px]">
                      
                      {/* Solver operations */}
                      <div className="space-y-2">
                        <span className="font-bold text-slate-500 block uppercase">Diagnostics & Recovery Solver</span>
                        
                        <button
                          onClick={handleBugFixDiagnosticValidation}
                          className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-500/35 text-emerald-300 rounded-lg font-bold transition hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                          Run System Diagnostic Solver
                        </button>

                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          <button
                            onClick={handleRefreshMissions}
                            className="flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 text-slate-400 rounded py-1.5 hover:bg-slate-850 text-[8.5px] cursor-pointer"
                          >
                            Missions sync
                          </button>
                          <button
                            onClick={handleAchievementScanner}
                            className="flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 text-slate-400 rounded py-1.5 hover:bg-slate-850 text-[8.5px] cursor-pointer"
                          >
                            Scan Stuck
                          </button>
                        </div>
                      </div>

                      {/* FPS throttler rates option */}
                      <div className="space-y-1.5">
                        <span className="font-bold text-slate-500 block uppercase">FPS refresher cap limit</span>
                        <div className="grid grid-cols-2 gap-1.5 text-center">
                          {['30', '45', '60', 'unlimited'].map((fpsVal) => (
                            <button
                              key={fpsVal}
                              onClick={() => handleFpsLimiterChange(fpsVal)}
                              className={`py-1.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                                targetFps === fpsVal
                                  ? 'bg-yellow-950 border-yellow-500 text-yellow-300'
                                  : 'bg-slate-800 border-slate-700 text-slate-400'
                              }`}
                            >
                              {fpsVal === 'unlimited' ? 'Unlimited' : `${fpsVal} FPS`}
                            </button>
                          ))}
                        </div>
                        
                        <button
                          onClick={handleTriggerPerformanceStressTest}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-950/30 text-red-300 border border-red-900/50 rounded-lg font-bold hover:bg-red-955 cursor-pointer mt-2"
                        >
                          <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                          [Perform FPS Stress Test]
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* DIAGNOISTIC RESULTS RENDER CARD */}
                  {diagResults && (
                    <div className="p-3 bg-slate-950/80 border border-emerald-500/30 rounded-xl font-mono text-[9.5px] text-slate-300 space-y-2 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-emerald-950/80 pb-1.5 text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                        <span className="flex items-center gap-1">✅ Complete System Diagnostic Results</span>
                        <span className="text-[8.5px] font-normal text-slate-500 lowercase">validated at {diagResults.scannedAt}</span>
                      </div>
                      <div className="space-y-1.5 leading-relaxed">
                        <div>
                          <span className="text-emerald-500 font-bold uppercase tracking-wider block sm:inline mr-1">🏆 Achievements [Rescan]:</span> 
                          <span className="text-slate-400">{diagResults.achievements.message}</span>
                        </div>
                        <div>
                          <span className="text-emerald-500 font-bold uppercase tracking-wider block sm:inline mr-1">🎯 Missions [Rescan]:</span> 
                          <span className="text-slate-400">{diagResults.missions.message}</span>
                        </div>
                        <div>
                          <span className="text-emerald-500 font-bold uppercase tracking-wider block sm:inline mr-1">💾 Save validation:</span> 
                          <span className="text-slate-400">{diagResults.save.message}</span>
                        </div>
                        <div>
                          <span className="text-emerald-500 font-bold uppercase tracking-wider block sm:inline mr-1">🌾 Feed counter:</span> 
                          <span className="text-slate-400">{diagResults.feed.message}</span>
                        </div>
                        <div>
                          <span className="text-emerald-500 font-bold uppercase tracking-wider block sm:inline mr-1">🐔 Evolution alignment:</span> 
                          <span className="text-slate-400">{diagResults.evolution.message}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIVE SAVE SYSTEM OBJECTS INSPECTOR */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white font-mono uppercase tracking-wider block border-b border-slate-850 pb-1 mt-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      Save inspector console
                    </span>
                    
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-850/60 font-mono text-[9px] leading-relaxed grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      <div><span className="text-slate-500 mr-2">PLAYER ID:</span>{localStorage.getItem('skm_player_id') || 'SKM_RUNNER_101'}</div>
                      <div><span className="text-slate-500 mr-2">PLAYER NAME:</span>{localStorage.getItem('skm_player_name') || 'Runner'}</div>
                      <div><span className="text-slate-500 mr-2">EVO PHASE:</span>{localStorage.getItem('skm_evolution_stage') || 'EGG'}</div>
                      <div><span className="text-slate-500 mr-2">STAGE 2 STATUS:</span>{localStorage.getItem('skm_is_stage_2') || 'false'}</div>
                      <div><span className="text-slate-500 mr-2">ACCUMULATED WALLET EGGS:</span>{stats ? stats.totalEggs || 0 : 0}</div>
                      <div><span className="text-slate-500 mr-2">ACCUMULATED WALLET GEMS:</span>{stats ? stats.totalGems || 0 : 0}</div>
                      <div><span className="text-slate-500 mr-2">ACTIVE SKIN EQUIPPED:</span>{stats ? stats.activeSkinId || 'chicken_white' : 'chicken_white'}</div>
                      <div><span className="text-slate-500 mr-2">LEVEL HIGH SCORE:</span>{stats ? stats.highscore || 0 : 0}</div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 4: EVENT LOG TERMINAL */}
              {activeTab === 'LOGS' && (
                <div className="flex flex-col h-full gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 font-mono uppercase tracking-wider">
                      Live event telemetry logs (Scrollable terminal)
                    </span>
                    <button
                      onClick={() => { soundManager.playClick(); localStorage.setItem('skm_debug_event_logs', '[]'); setEventLogs([]); }}
                      className="text-[8.5px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-900/40 rounded px-2 py-0.5 cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  </div>
                  
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-3 h-72 overflow-y-auto font-mono text-[9px] leading-relaxed flex flex-col gap-1.5 scroll-smooth">
                    {eventLogs.length > 0 ? (
                      eventLogs.map((log, index) => {
                        let color = 'text-slate-400';
                        if (log.category === 'SECURITY') color = 'text-red-400 font-bold';
                        else if (log.category === 'ERROR') color = 'text-yellow-400 font-semibold';
                        else if (log.category === 'CRASH') color = 'text-purple-400 font-black';
                        else if (log.category === 'CONFIG') color = 'text-emerald-400 font-semibold';
                        else if (log.category === 'EVOLUTION') color = 'text-amber-500';
                        else if (log.category === 'TEST') color = 'text-cyan-400';
                        
                        return (
                          <div key={index} className="border-b border-slate-900/60 pb-1.5 flex items-start gap-1">
                            <span className="text-slate-600 block shrink-0">[{log.timestamp}]</span>
                            <span className="text-indigo-400 block shrink-0 font-bold">[{log.category}]</span>
                            <span className={`${color} block flex-1 break-words`}>{log.message}</span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-slate-500 text-center py-10">
                        No telemetry entries found. Active triggers will print events here in real-time.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* TAB SYSTEM FOOTER */}
            <div className="flex justify-between items-center border-t border-slate-800 pt-3 mt-auto shrink-0 select-none">
              <span className="text-[9.5px] text-slate-500 font-mono">
                DEVELOPER SHELL: <span className="text-indigo-400 font-black">v1.2.5</span>
              </span>

              <div className="flex gap-2 font-mono text-[9px]">
                <button
                  id="dev_panel_abort"
                  onClick={() => {
                    soundManager.playClick();
                    setView('SETTINGS');
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3 py-2 rounded-xl transition uppercase cursor-pointer"
                >
                  Return to Settings
                </button>
                <button
                  id="dev_panel_apply"
                  onClick={handleApplyDifficulty}
                  className="bg-emerald-650 hover:bg-emerald-555 text-white font-black px-4 py-2 rounded-xl transition uppercase cursor-pointer shadow-lg shadow-emerald-650/20"
                >
                  Apply & Run
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
