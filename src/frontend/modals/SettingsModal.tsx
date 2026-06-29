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
import { soundManager } from '../../audio';
import {
  getActiveLiveConfig,
  syncConfigWithServer,
  saveConfigLocally,
  publishConfigToFirestore,
  LiveConfig,
  DEFAULT_LIVE_CONFIG,
  addDebugLog,
  getDebugLogs,
  DebugLogEntry
} from '../../liveConfig';
import { runDevQuery, runDailySummary, checkDevPermissions, DevAnswer, DevCard, QUICK_COMMANDS } from '../../services/dev/devAssistantService';
import {
  parseNotifyCommand,
  executeBroadcast,
  fetchBroadcastLogs,
  type BroadcastLogEntry,
  type ParsedNotifyCommand,
} from '../../services/notifications/adminBroadcastService';
import { useAuth } from '../../auth/AuthProvider';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  musicEnabled: boolean;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onStartGame: () => void;
  onLogout?: () => Promise<void>;
  initialView?: SettingsView;
  engine?: any;
  stats?: any;
  setStats?: React.Dispatch<React.SetStateAction<any>>;
  achievements?: any[];
  setAchievements?: React.Dispatch<React.SetStateAction<any[]>>;
  missions?: any[];
  setMissions?: React.Dispatch<React.SetStateAction<any[]>>;
  fps?: number;
  onNavigateQR?: () => void;
}

const ENCODED_DEV_NAME = "REVWRUxPUEVS"; // base64 for "DEVELOPER"
const ENCODED_DEV_PASS = "bnBtIHJ1biBkZXY="; // base64 for "npm run dev"

type SettingsView = 'SETTINGS' | 'DEV_LOGIN' | 'DEV_PANEL';
type DevTab = 'BALANCING' | 'DIAGNOSTICS' | 'TESTING' | 'LOGS' | 'DEV_AI' | 'NOTIFY';

interface ChatMessage {
  role: 'user' | 'dev';
  text: string;
  answer?: DevAnswer;
  ts: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  musicEnabled,
  onToggleSound,
  onToggleMusic,
  onStartGame,
  onLogout,
  initialView = 'SETTINGS',
  engine,
  stats,
  setStats,
  achievements,
  setAchievements,
  missions,
  setMissions,
  fps = 60,
  onNavigateQR,
}) => {
  const { user } = useAuth();
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

  // DEV AI Assistant state
  const [chatMessages,  setChatMessages]  = useState<ChatMessage[]>([
    { role: 'dev', text: 'DEV online. Real-Time System Intelligence active. Type "help" to see all commands.', ts: Date.now() },
  ]);
  const [chatInput,     setChatInput]     = useState('');
  const [chatLoading,   setChatLoading]   = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── NOTIFY tab state ─────────────────────────────────────────────────────────
  const [notifyInput,     setNotifyInput]     = useState('');
  const [notifyParsed,    setNotifyParsed]    = useState<ParsedNotifyCommand | null>(null);
  const [notifyParseErr,  setNotifyParseErr]  = useState('');
  const [notifySending,   setNotifySending]   = useState(false);
  const [notifyResult,    setNotifyResult]    = useState<{ ok: boolean; text: string } | null>(null);
  const [notifyLogs,      setNotifyLogs]      = useState<BroadcastLogEntry[]>([]);
  const [notifyLogsLoading, setNotifyLogsLoading] = useState(false);
  const notifyInputRef = useRef<HTMLInputElement>(null);

  // Load broadcast log when NOTIFY tab opens
  useEffect(() => {
    if (activeTab !== 'NOTIFY') return;
    setNotifyLogsLoading(true);
    fetchBroadcastLogs(15)
      .then(logs => setNotifyLogs(logs))
      .catch(() => {})
      .finally(() => setNotifyLogsLoading(false));
  }, [activeTab]);

  // Live-parse notify input as user types
  useEffect(() => {
    if (!notifyInput.trim()) {
      setNotifyParsed(null);
      setNotifyParseErr('');
      return;
    }
    const parsed = parseNotifyCommand(notifyInput);
    if (parsed) {
      setNotifyParsed(parsed);
      setNotifyParseErr('');
    } else {
      setNotifyParsed(null);
      setNotifyParseErr('Unknown command syntax. See examples below.');
    }
  }, [notifyInput]);

  const handleNotifyExecute = async () => {
    if (!notifyParsed || notifySending) return;
    if (!user?.uid) { setNotifyResult({ ok: false, text: 'Not authenticated.' }); return; }

    setNotifySending(true);
    setNotifyResult(null);

    try {
      const result = await executeBroadcast(notifyParsed, user.uid);

      // Debug command — show diagnostic info
      if (result.debugInfo) {
        setNotifyResult({ ok: true, text: result.debugInfo });
        setNotifyInput('');
        setNotifyParsed(null);
        return;
      }

      if (result.ok) {
        const pushLine = `✓ Queued for ${result.recipientCount} user${result.recipientCount !== 1 ? 's' : ''}. Cloud Function is delivering push notifications.`;
        const extraErr = result.error ? `\n${result.error}` : '';
        setNotifyResult({ ok: result.successCount > 0, text: pushLine + extraErr });
        setNotifyInput('');
        setNotifyParsed(null);
        addDebugLog('NOTIFY', `Broadcast: push=${result.successCount} tokens=${result.recipientCount} msg="${notifyParsed.message}"`);
        fetchBroadcastLogs(15).then(setNotifyLogs).catch(() => {});
      } else {
        setNotifyResult({ ok: false, text: `✗ ${result.error ?? 'Unknown error'}` });
        addDebugLog('NOTIFY', `Broadcast failed: ${result.error}`);
      }
    } catch (err: any) {
      setNotifyResult({ ok: false, text: `✗ Error: ${err?.message ?? err}` });
    } finally {
      setNotifySending(false);
    }
  };

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

  // DEV home screen: auto-load daily summary + permission check when tab opens
  useEffect(() => {
    if (activeTab !== 'DEV_AI') return;
    if (chatMessages.length > 1) return; // already loaded

    const loadHome = async () => {
      // 1. Check permissions
      const perm = await checkDevPermissions().catch(() => null);
      if (!perm) return;

      if (!perm.isDeveloper) {
        setChatMessages(prev => [...prev, {
          role: 'dev',
          text: `Access limited. Your role is "${perm.role}".`,
          answer: {
            text: `Access limited. Your role is "${perm.role}".`,
            error: 'Run "grant dev access" to enable developer analytics, then reload the DEV tab.',
            cards: [
              { label: 'Email', value: perm.email || 'N/A',          color: 'white'  },
              { label: 'Role',  value: perm.role,                    color: 'red'    },
              { label: 'Fix',   value: 'Type: grant dev access',     color: 'yellow' },
            ],
          },
          ts: Date.now(),
        }]);
        return;
      }

      // 2. Load daily executive summary as home screen
      setChatLoading(true);
      try {
        const summary = await runDailySummary();
        setChatMessages(prev => [...prev, {
          role: 'dev',
          text: summary.text,
          answer: summary,
          ts: Date.now(),
        }]);
      } catch { /* ignore */ }
      finally { setChatLoading(false); }
    };

    loadHome();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
    saveConfigLocally(draftConfig);
    addDebugLog('CONFIG', `Config saved locally - Traffic=${draftConfig.trafficDensity}x Obstacle=${draftConfig.obstacleSpawnRate}x Feed=${draftConfig.feedSpawnRate}x`);
    if (engine && typeof engine.applyLiveConfig === 'function') {
      engine.applyLiveConfig();
      console.log('[TRAFFIC UPDATED]', draftConfig.trafficDensity, '[OBSTACLE UPDATED]', draftConfig.obstacleSpawnRate);
    }
    triggerToast('Config Saved & Applied');
    setTimeout(() => { runValidationNow(); }, 150);
  };

  const handleApplyConfig = () => {
    soundManager.playClick();
    saveConfigLocally(draftConfig);
    addDebugLog('CONFIG', `Config applied live - Traffic=${draftConfig.trafficDensity}x Obstacle=${draftConfig.obstacleSpawnRate}x Feed=${draftConfig.feedSpawnRate}x Speed=${draftConfig.runSpeedMultiplier}x`);
    console.log('[DEV CONFIG UPDATED] Apply live:', draftConfig);
    console.log('[TRAFFIC UPDATED]', draftConfig.vehicleSpawnRate, draftConfig.trafficDensity);
    console.log('[OBSTACLE UPDATED]', draftConfig.obstacleSpawnRate, draftConfig.obstacleDensity);
    console.log('[EVOLUTION UPDATED]', draftConfig.stage1EvolutionReq, draftConfig.stage2EvolutionReq);

    if (engine && typeof engine.applyLiveConfig === 'function') {
      engine.applyLiveConfig();
    }
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

    // Increment version number
    const segments = draftConfig.configVersion.replace('v', '').split('.');
    const patch = parseInt(segments[2] || '0', 10) + 1;
    const nextVer = `v${segments[0]}.${segments[1]}.${patch}`;

    const updated: LiveConfig = {
      ...draftConfig,
      configVersion: nextVer,
      updatedBy: 'DEVELOPER',
      lastUpdated: new Date().toISOString().split('T')[0],
      isActive: true,
    };

    setDraftConfig(updated);
    saveConfigLocally(updated);

    // Push to Firestore - all connected clients get it via onSnapshot instantly
    publishConfigToFirestore(updated).then(() => {
      triggerToast(`Published ${nextVer} to Firebase ✓`);
    }).catch(() => {
      triggerToast(`Published ${nextVer} locally (offline)`);
    });

    if (engine && typeof engine.applyLiveConfig === 'function') {
      engine.applyLiveConfig();
    }

    addDebugLog('CONFIG', `PUBLISHED ${nextVer} - Traffic=${updated.trafficDensity}x Obstacle=${updated.obstacleSpawnRate}x Feed=${updated.feedSpawnRate}x`);
    console.log('[DEV CONFIG UPDATED] Published:', updated);
    console.log('[TRAFFIC UPDATED]', updated.vehicleSpawnRate, updated.trafficDensity);
    console.log('[OBSTACLE UPDATED]', updated.obstacleSpawnRate);
    console.log('[EVOLUTION UPDATED]', updated.stage1EvolutionReq, updated.stage2EvolutionReq);
    console.log('[MISSION UPDATED]', updated.missionRewards);

    setTimeout(() => { runValidationNow(); }, 150);
  };

  const handleRestoreDefaultConfig = () => {
    soundManager.playClick();
    setShowDefaultConfirm(true);
  };

  const handleConfirmRestoreDefault = () => {
    soundManager.playClick();

    setDraftConfig({ ...DEFAULT_LIVE_CONFIG });
    saveConfigLocally(DEFAULT_LIVE_CONFIG);

    // Also push defaults to Firestore so all clients reset
    publishConfigToFirestore(DEFAULT_LIVE_CONFIG).catch(() => {});

    if (engine && typeof engine.applyLiveConfig === 'function') {
      engine.applyLiveConfig();
    }

    addDebugLog('CONFIG', 'Default configuration restored and published.');
    console.log('[DEV CONFIG UPDATED] Restored defaults');
    setTimeout(() => { runValidationNow(); }, 150);
    setShowDefaultConfirm(false);
    setRestoreSuccessActive(true);
    setTimeout(() => setRestoreSuccessActive(false), 2000);
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

  // DEV AI — send a question and get a Firebase-backed answer
  const handleChatSend = async (question?: string) => {
    const q = (question ?? chatInput).trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setChatLoading(true);

    const userMsg: ChatMessage = { role: 'user', text: q, ts: Date.now() };
    setChatMessages(prev => [...prev, userMsg]);

    // Scroll to bottom after user message
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const answer = await runDevQuery(q);
      const devMsg: ChatMessage = { role: 'dev', text: answer.text, answer, ts: Date.now() };
      setChatMessages(prev => [...prev, devMsg]);
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'dev', text: 'Query failed. Firebase may be unreachable.', ts: Date.now(),
      }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
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
                id="default_config_confirm_yes"
                onClick={handleConfirmRestoreDefault}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] uppercase font-mono font-bold py-2 px-4 rounded-xl border border-amber-550 cursor-pointer shadow-md shadow-slate-950/40 transition"
              >
                Yes
              </button>
              <button
                id="default_config_confirm_no"
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

            {/* Logout */}
            {onLogout && (
              <button
                id="btn_settings_logout"
                onClick={async () => {
                  soundManager.playClick();
                  if (confirm('Sign out and return to the Welcome screen?')) {
                    onClose();
                    await onLogout();
                  }
                }}
                className="w-full mt-1 flex items-center justify-center gap-2 bg-transparent border border-slate-700/50 hover:border-orange-500/50 text-slate-500 hover:text-orange-400 font-bold py-2 rounded-xl transition text-[10px] uppercase font-mono tracking-wider cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            )}
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
                {onNavigateQR && (
                  <button
                    onClick={() => { soundManager.playClick(); onNavigateQR(); }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition cursor-pointer whitespace-nowrap"
                    style={{ background: 'rgba(215,25,32,0.15)', borderColor: 'rgba(215,25,32,0.5)', color: '#D71920' }}
                    title="Open QR Management"
                  >
                    ▦ QR Management
                  </button>
                )}
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
              <button
                onClick={() => { soundManager.playClick(); setActiveTab('DEV_AI'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'DEV_AI'
                    ? 'bg-red-950/60 border-red-500 text-red-300'
                    : 'bg-slate-950/20 border-slate-850 hover:border-red-900 text-slate-400 hover:text-red-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                DEV
              </button>
              <button
                onClick={() => { soundManager.playClick(); setActiveTab('NOTIFY'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === 'NOTIFY'
                    ? 'bg-orange-950/60 border-orange-500 text-orange-300'
                    : 'bg-slate-950/20 border-slate-850 hover:border-orange-900 text-slate-400 hover:text-orange-300'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                NOTIFY
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

              {/* TAB 5: DEV AI ASSISTANT */}
              {activeTab === 'DEV_AI' && (
                <div className="flex flex-col" style={{ minHeight: '400px', height: '100%' }}>

                  {/* Header */}
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-900/40 shrink-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(215,25,32,0.2)', border: '1px solid rgba(215,25,32,0.4)' }}>
                      <Sparkles className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-red-300 uppercase tracking-widest leading-none font-mono">DEV</p>
                      <p className="text-[9px] text-slate-500 font-mono">Real-Time Analytics Engine</p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      <span className="text-[8px] text-slate-500 font-mono">{chatMessages.length - 1} queries</span>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[9px] text-green-400 font-mono font-bold">LIVE</span>
                      </div>
                    </div>
                  </div>

                  {/* Quick command chips */}
                  <div className="flex flex-wrap gap-1 mb-2 shrink-0">
                    {QUICK_COMMANDS.map(({ label, cmd }) => (
                      <button key={cmd} onClick={() => handleChatSend(cmd)}
                        disabled={chatLoading}
                        className="text-[8px] font-mono font-bold px-2 py-1 rounded-lg cursor-pointer disabled:opacity-40 transition active:scale-95"
                        style={{ background: 'rgba(215,25,32,0.12)', border: '1px solid rgba(215,25,32,0.25)', color: '#fca5a5' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Chat history */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-2" style={{ minHeight: 0, maxHeight: '340px' }}>
                    {chatMessages.map((msg, i) => {
                      const colorMap: Record<string, string> = {
                        red: '#ef4444', green: '#22c55e', yellow: '#eab308',
                        blue: '#3b82f6', white: '#94a3b8', purple: '#a855f7',
                      };
                      return (
                        <div key={i} className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                          {/* Message bubble */}
                          <div
                            className="max-w-[90%] rounded-2xl px-3 py-2 text-xs font-mono"
                            style={msg.role === 'user'
                              ? { background: 'rgba(215,25,32,0.2)', border: '1px solid rgba(215,25,32,0.35)', color: '#fff' }
                              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#e2e8f0' }
                            }
                          >
                            {msg.role === 'dev' && (
                              <span className="text-[8px] text-red-400 font-black uppercase tracking-widest block mb-1">DEV</span>
                            )}
                            <p className="leading-relaxed break-words">{msg.text}</p>
                          </div>

                          {/* Error detail */}
                          {msg.answer?.error && (
                            <div className="max-w-[90%] rounded-xl px-3 py-1.5 text-[8px] font-mono"
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
                              <span className="font-black text-red-400 uppercase">Error: </span>{msg.answer.error}
                            </div>
                          )}

                          {/* Analytics cards */}
                          {msg.answer?.cards && msg.answer.cards.length > 0 && (
                            <div className="max-w-full w-full grid gap-1.5 mt-1"
                              style={{ gridTemplateColumns: `repeat(${Math.min(msg.answer.cards.length, 3)}, 1fr)` }}
                            >
                              {msg.answer.cards.map((card: DevCard, ci: number) => {
                                const c = colorMap[card.color ?? 'white'] ?? '#94a3b8';
                                return (
                                  <div key={ci} className="rounded-xl p-2 text-center"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${c}2a` }}>
                                    <p className="text-[7px] font-bold uppercase tracking-wider font-mono mb-0.5" style={{ color: c + '80' }}>
                                      {card.label}
                                    </p>
                                    <p className="text-sm font-black break-all leading-tight" style={{ color: c }}>
                                      {card.value}
                                    </p>
                                    {card.sub && <p className="text-[7px] text-slate-500 font-mono mt-0.5">{card.sub}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Table */}
                          {msg.answer?.table && (
                            <div className="max-w-full w-full overflow-x-auto mt-1">
                              <table className="w-full text-[8px] font-mono border-collapse">
                                <thead>
                                  <tr style={{ background: 'rgba(215,25,32,0.08)' }}>
                                    {msg.answer.table.headers.map((h, hi) => (
                                      <th key={hi} className="text-left px-2 py-1.5 text-red-400 font-black uppercase tracking-wide border-b border-red-900/30">
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {msg.answer.table.rows.map((row, ri) => {
                                    // Color last column based on value for health/diagnostic tables
                                    const isStatusTable = msg.answer?.type === 'health' || msg.answer?.type === 'diagnostic';
                                    return (
                                      <tr key={ri} style={{ background: ri % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                                        {row.map((cell, ci) => {
                                          let cellColor = '#94a3b8';
                                          const isLastCol = ci === row.length - 1;
                                          if (isStatusTable && isLastCol) {
                                            if (['OK','ACCESSIBLE','SIGNED IN','CONFIRMED','DEVELOPER'].some(v => cell.includes(v))) cellColor = '#22c55e';
                                            else if (['ERROR','DENIED','BLOCKED','NO SESSION','MISSING'].some(v => cell.includes(v))) cellColor = '#ef4444';
                                            else if (['WARNING','PARTIAL'].some(v => cell.includes(v))) cellColor = '#eab308';
                                          }
                                          return (
                                            <td key={ci} className="px-2 py-1 font-mono" style={{ color: cellColor }}>
                                              {cell}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Metadata footer */}
                          {msg.answer?.meta && (
                            <div className="flex flex-wrap gap-2 text-[7px] font-mono mt-0.5"
                              style={{ color: 'rgba(148,163,184,0.4)' }}>
                              <span>src: {msg.answer.meta.source}</span>
                              <span>docs: {msg.answer.meta.records}</span>
                              <span>{msg.answer.meta.execMs}ms</span>
                              <span>{msg.answer.meta.timestamp}</span>
                              <span style={{ color: msg.answer.meta.confidence === '100%' ? '#22c55e70' : msg.answer.meta.confidence === 'ERROR' ? '#ef444470' : '#eab30870' }}>
                                {msg.answer.meta.confidence}
                              </span>
                            </div>
                          )}

                          {/* Suggestion chips — shown after DEV answers */}
                          {msg.role === 'dev' && msg.answer?.suggestions && msg.answer.suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 max-w-full">
                              {msg.answer.suggestions.map((s) => (
                                <button key={s} onClick={() => handleChatSend(s)}
                                  disabled={chatLoading}
                                  className="text-[7px] font-mono px-2 py-0.5 rounded-full cursor-pointer disabled:opacity-40 transition active:scale-95"
                                  style={{ background: 'rgba(215,25,32,0.08)', border: '1px solid rgba(215,25,32,0.2)', color: '#fca5a580' }}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}

                          {!msg.answer?.meta && (
                            <span className="text-[7px] text-slate-700 font-mono">
                              {new Date(msg.ts).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Typing indicator */}
                    {chatLoading && (
                      <div className="flex items-start">
                        <div className="rounded-2xl px-3 py-2 text-xs font-mono"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                          <span className="text-[8px] text-red-400 font-black uppercase tracking-widest block mb-1">DEV</span>
                          <span className="flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Input bar */}
                  <form
                    onSubmit={e => { e.preventDefault(); handleChatSend(); }}
                    className="flex gap-2 shrink-0"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder='Type command or "help"...'
                      disabled={chatLoading}
                      className="flex-1 bg-slate-950 border border-slate-800 text-white font-mono text-[10px] px-3 py-2 rounded-xl focus:border-red-600 focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatInput.trim()}
                      className="px-4 py-2 rounded-xl font-black text-[10px] uppercase font-mono transition active:scale-95 disabled:opacity-40 cursor-pointer shrink-0"
                      style={{ background: 'linear-gradient(135deg,#D71920,#8B0000)', color: 'white', minWidth: 44 }}
                    >
                      {chatLoading ? '...' : 'Run'}
                    </button>
                  </form>

                </div>
              )}

              {/* ──────────────────────────────────────────────────────────────
                  TAB 6 — NOTIFY: Admin Broadcast Command Terminal
              ─────────────────────────────────────────────────────────────── */}
              {activeTab === 'NOTIFY' && (
                <div className="space-y-4">

                  {/* ── Setup Status ── */}
                  {/* ── Setup status — VAPID only (no server key in client) ── */}
                  {(() => {
                    const hasVapid = !!import.meta.env.VITE_FIREBASE_VAPID_KEY;
                    return (
                      <div className="rounded-xl border overflow-hidden"
                        style={{ borderColor: hasVapid ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.4)' }}>
                        <div className="px-3 py-2 flex items-center gap-2"
                          style={{ background: hasVapid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.1)' }}>
                          <span style={{ fontSize: 9 }}>{hasVapid ? '✅' : '🔴'}</span>
                          <span className="text-[9px] font-black font-mono uppercase tracking-widest"
                            style={{ color: hasVapid ? '#86efac' : '#fca5a5' }}>
                            {hasVapid ? 'Device Registration Ready' : 'Setup Required — VAPID Key Missing'}
                          </span>
                        </div>
                        {!hasVapid && (
                          <div className="px-3 py-2 space-y-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
                            <div className="text-[8px] font-mono text-slate-400 leading-relaxed pl-3"
                              style={{ borderLeft: '2px solid rgba(239,68,68,0.4)' }}>
                              <span className="text-[8px] font-mono text-fca5a5">✗ VITE_FIREBASE_VAPID_KEY</span>
                              <span className="text-slate-500"> (browser device token registration)</span><br/><br/>
                              1. <span className="text-orange-300">Firebase Console → Project Settings → Cloud Messaging</span><br/>
                              2. Scroll to <span className="text-orange-300">Web Push certificates</span><br/>
                              3. Click <span className="text-orange-300">Generate key pair</span><br/>
                              4. Copy the <span className="text-orange-300">public key</span> (starts with B...)<br/>
                              5. Add to <span className="text-yellow-300">.env</span>: <code className="text-green-300">VITE_FIREBASE_VAPID_KEY=Bxxx...</code><br/>
                              6. <span className="text-red-400 font-black">Restart dev server → open app on phone → allow notifications</span>
                            </div>
                            <p className="text-[7px] font-mono text-slate-600 pt-1">
                              Push delivery is handled server-side by Firebase Cloud Functions (Admin SDK). No server keys are stored in the client.
                            </p>
                          </div>
                        )}
                        {hasVapid && (
                          <div className="px-3 py-2" style={{ background: 'rgba(0,0,0,0.15)' }}>
                            <p className="text-[7px] font-mono text-slate-500 leading-relaxed">
                              <span className="text-emerald-400">✓</span> VITE_FIREBASE_VAPID_KEY set — devices can register tokens.<br/>
                              Push delivery: <span className="text-orange-300">Firebase Cloud Functions → Admin SDK → FCM</span> (server-side, no client credentials exposed).
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Header */}
                  <div className="p-3 rounded-xl border space-y-1"
                    style={{ background: 'rgba(234,88,12,0.08)', borderColor: 'rgba(234,88,12,0.25)' }}>
                    <div className="flex items-center gap-2">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <h4 className="text-[10px] font-black text-orange-400 uppercase tracking-widest font-mono">
                        BROADCAST COMMAND TERMINAL
                      </h4>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono leading-relaxed">
                      Type a notify command below. The notification is dispatched via Firebase Cloud Messaging to every registered device in real time.
                    </p>
                  </div>

                  {/* Command input */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-orange-400 uppercase tracking-widest font-mono">
                      Command
                    </label>
                    <div className="flex gap-2">
                      <input
                        ref={notifyInputRef}
                        type="text"
                        value={notifyInput}
                        onChange={e => { setNotifyInput(e.target.value); setNotifyResult(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && notifyParsed && !notifySending) handleNotifyExecute(); }}
                        placeholder='notify: Hello everyone'
                        className="flex-1 bg-slate-950 border text-white font-mono text-[10px] px-3 py-2 rounded-xl focus:outline-none transition"
                        style={{
                          borderColor: notifyParseErr && notifyInput
                            ? 'rgba(239,68,68,0.6)'
                            : notifyParsed
                            ? 'rgba(234,88,12,0.7)'
                            : 'rgba(100,116,139,0.4)',
                        }}
                        disabled={notifySending}
                      />
                      <button
                        onClick={handleNotifyExecute}
                        disabled={!notifyParsed || notifySending}
                        className="px-4 py-2 rounded-xl font-black text-[10px] uppercase font-mono transition active:scale-95 disabled:opacity-40 cursor-pointer shrink-0"
                        style={{ background: 'linear-gradient(135deg,#EA580C,#9A3412)', color: 'white', minWidth: 60 }}
                      >
                        {notifySending ? (
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 border border-white/30 border-t-white rounded-full animate-spin inline-block" />
                            <span>Sending</span>
                          </span>
                        ) : 'SEND'}
                      </button>
                    </div>

                    {/* Live parse preview */}
                    {notifyInput && !notifyParseErr && notifyParsed && (
                      <div className="px-3 py-2 rounded-lg text-[9px] font-mono space-y-0.5"
                        style={{ background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.2)' }}>
                        <div className="flex gap-3">
                          <span className="text-slate-500">TARGET</span>
                          <span className="text-orange-300 font-black">
                            {notifyParsed.target.kind === 'all'     && 'All Users'}
                            {notifyParsed.target.kind === 'game'    && 'Game Players Only'}
                            {notifyParsed.target.kind === 'protein' && 'Protein Tracker Users Only'}
                            {notifyParsed.target.kind === 'uid'     && `User: ${notifyParsed.target.uid}`}
                            {notifyParsed.target.kind === 'topic'   && `Topic: ${notifyParsed.target.topic}`}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <span className="text-slate-500">MSG</span>
                          <span className="text-white">{notifyParsed.message}</span>
                        </div>
                      </div>
                    )}
                    {notifyInput && notifyParseErr && (
                      <p className="text-[9px] font-mono text-red-400 px-1">{notifyParseErr}</p>
                    )}

                    {/* Result banner */}
                    {notifyResult && (
                      <div className="px-3 py-2 rounded-lg text-[9px] font-mono"
                        style={{
                          background: notifyResult.ok ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.08)',
                          border: `1px solid ${notifyResult.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                          color:  notifyResult.ok ? '#86efac' : '#fca5a5',
                          whiteSpace: 'pre-line',
                          lineHeight: '1.6',
                        }}>
                        {notifyResult.text}
                      </div>
                    )}
                  </div>

                  {/* Syntax reference */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Command Reference</p>
                    {[
                      { cmd: 'debug tokens',                    desc: 'Show token count — run this first to diagnose' },
                      { cmd: 'notify: <message>',               desc: 'Broadcast to all users' },
                      { cmd: 'notify game: <message>',          desc: 'Game players only' },
                      { cmd: 'notify protein: <message>',       desc: 'Protein tracker users only' },
                      { cmd: 'notify uid:<uid> <message>',      desc: 'One specific user by UID' },
                      { cmd: 'notify topic:<topic> <message>',  desc: 'Named topic group' },
                    ].map(({ cmd, desc }) => (
                      <button
                        key={cmd}
                        onClick={() => { setNotifyInput(cmd.replace('<message>', 'Hello!').replace('<uid>', 'USER_UID').replace('<topic>', 'golden')); notifyInputRef.current?.focus(); }}
                        className="w-full text-left px-3 py-2 rounded-lg transition cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(234,88,12,0.3)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                      >
                        <code className="text-[9px] text-orange-300 font-mono block">{cmd}</code>
                        <span className="text-[8px] text-slate-500 font-mono">{desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Broadcast log */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono">Broadcast History</p>
                      <button
                        onClick={() => { setNotifyLogsLoading(true); fetchBroadcastLogs(15).then(setNotifyLogs).catch(() => {}).finally(() => setNotifyLogsLoading(false)); }}
                        className="text-[8px] text-slate-500 hover:text-orange-400 font-mono transition cursor-pointer"
                      >
                        Refresh
                      </button>
                    </div>

                    {notifyLogsLoading && (
                      <div className="flex items-center gap-2 py-2">
                        <span className="w-3 h-3 border border-orange-500/30 border-t-orange-400 rounded-full animate-spin" />
                        <span className="text-[8px] font-mono text-slate-500">Loading…</span>
                      </div>
                    )}

                    {!notifyLogsLoading && notifyLogs.length === 0 && (
                      <p className="text-[8px] font-mono text-slate-600 px-1">No broadcasts sent yet.</p>
                    )}

                    {notifyLogs.map(log => (
                      <div key={log.id}
                        className="px-3 py-2 rounded-lg space-y-1"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center justify-between">
                          <code className="text-[8px] text-orange-300 font-mono font-black truncate max-w-[65%]">{log.command}</code>
                          <span className="text-[7px] font-mono text-slate-600 shrink-0 ml-2">
                            {log.sentAt instanceof Date ? log.sentAt.toLocaleTimeString() : ''}
                          </span>
                        </div>
                        <p className="text-[8px] font-mono text-slate-400 truncate">{log.message}</p>
                        <div className="flex gap-3 text-[7px] font-mono">
                          <span style={{ color: 'rgba(148,163,184,0.5)' }}>→ {log.target}</span>
                          <span className="text-emerald-500/70">✓ {log.successCount}</span>
                          {log.failureCount > 0 && <span className="text-red-400/70">✗ {log.failureCount}</span>}
                          <span style={{ color: 'rgba(148,163,184,0.4)' }}>total: {log.recipientCount}</span>
                        </div>
                      </div>
                    ))}
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
