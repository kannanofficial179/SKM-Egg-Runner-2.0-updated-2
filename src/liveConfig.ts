/**
 * LIVE CONFIGURATION MANAGER
 * Allows live game balancing & real-time changes
 */

export interface LiveConfig {
  configVersion: string;
  updatedBy: string;
  lastUpdated: string;
  isActive: boolean;

  // GAMEPLAY
  feedSpawnRate: number; // Multiplier, default: 1.0
  obstacleSpawnRate: number; // Multiplier, default: 1.0
  vehicleSpawnRate: number; // Multiplier, default: 1.0
  runSpeedMultiplier: number; // Multiplier, default: 1.0
  stage1EvolutionReq: number; // Default: 100 grains
  stage2EvolutionReq: number; // Default: 500 grains

  // REWARDS
  crystalEggRewards: number; // Multiplier, default: 1.0
  missionRewards: number; // Multiplier, default: 1.0
  achievementRewards: number; // Multiplier, default: 1.0

  // ENVIRONMENT
  envRotationRate: number; // Multiplier, default: 1.0
  obstacleDensity: number; // Multiplier, default: 1.0
  trafficDensity: number; // Multiplier, default: 1.0
}

export const DEFAULT_LIVE_CONFIG: LiveConfig = {
  configVersion: 'v1.0.0',
  updatedBy: 'SYSTEM',
  lastUpdated: '2026-06-17',
  isActive: true,

  feedSpawnRate: 1.0,
  obstacleSpawnRate: 1.0,
  vehicleSpawnRate: 1.0,
  runSpeedMultiplier: 1.0,
  stage1EvolutionReq: 100,
  stage2EvolutionReq: 500,

  crystalEggRewards: 1.0,
  missionRewards: 1.0,
  achievementRewards: 1.0,

  envRotationRate: 1.0,
  obstacleDensity: 1.0,
  trafficDensity: 1.0,
};

// Global function to get the current ACTIVE configuration
export function getActiveLiveConfig(): LiveConfig {
  // 1. check client active configuration
  const localConfigStr = localStorage.getItem('skm_local_client_config');
  if (localConfigStr) {
    try {
      return JSON.parse(localConfigStr);
    } catch (e) {
      console.error('Failed to parse local client configuration, falling back:', e);
    }
  }

  // Fallback to initialized static default
  return DEFAULT_LIVE_CONFIG;
}

// Function that handles players opening the game: downloads & applies active server config
export function syncConfigWithServer(): { synced: boolean; config: LiveConfig; message: string } {
  const serverConfigStr = localStorage.getItem('skm_server_database_config');
  
  if (!serverConfigStr) {
    // If no server database exists yet, initialize it with current default config
    localStorage.setItem('skm_server_database_config', JSON.stringify(DEFAULT_LIVE_CONFIG));
    localStorage.setItem('skm_local_client_config', JSON.stringify(DEFAULT_LIVE_CONFIG));
    addDebugLog('SYSTEM', 'Initialize default server configuration v1.0.0');
    return { synced: true, config: DEFAULT_LIVE_CONFIG, message: 'Server configuration initialized and synced.' };
  }

  try {
    const serverConfig = JSON.parse(serverConfigStr);
    const clientConfig = getActiveLiveConfig();

    // If client config matches or server is newer, apply server configuration
    if (clientConfig.configVersion !== serverConfig.configVersion) {
      localStorage.setItem('skm_local_client_config', JSON.stringify(serverConfig));
      addDebugLog('CONFIG', `Downloaded and applied active remote config ${serverConfig.configVersion}`);
      return { synced: true, config: serverConfig, message: `Synced config ${serverConfig.configVersion} automatically from server` };
    }
    
    return { synced: false, config: clientConfig, message: 'Already up to date' };
  } catch (e) {
    console.error('Error syncing configuration from server:', e);
    return { synced: false, config: DEFAULT_LIVE_CONFIG, message: 'Sync error: local offline fallback utilized.' };
  }
}

// Helper to push log entry
export interface DebugLogEntry {
  timestamp: string;
  category: string;
  message: string;
}

export function addDebugLog(category: string, message: string): void {
  try {
    const logsStr = localStorage.getItem('skm_debug_event_logs');
    const logs: DebugLogEntry[] = logsStr ? JSON.parse(logsStr) : [];
    
    const timeStr = new Date().toLocaleTimeString();
    logs.unshift({ timestamp: timeStr, category, message });

    // Keep only last 50 entries
    if (logs.length > 50) {
      logs.splice(50);
    }

    localStorage.setItem('skm_debug_event_logs', JSON.stringify(logs));
    window.dispatchEvent(new CustomEvent('skm_debug_log_added'));
  } catch (e) {
    console.error('Failed to write debug log:', e);
  }
}

export function getDebugLogs(): DebugLogEntry[] {
  try {
    const logsStr = localStorage.getItem('skm_debug_event_logs');
    return logsStr ? JSON.parse(logsStr) : [];
  } catch (_) {
    return [];
  }
}
