/**
 * SKM EGG RUNNER — Services Barrel
 * Import any backend service from here.
 *
 * Usage:
 *   import { registerPlayer, saveGameProgress, submitScore } from '../services';
 */

// Firebase core
export { auth, db, analytics } from './firebase/firebase';

// Auth
export {
  registerPlayer,
  loginPlayer,
  loginAnonymous,
  logoutPlayer,
  getCurrentPlayer,
  onPlayerAuthChange,
} from './auth/authService';

// Player profile & save
export {
  createPlayer,
  getPlayer,
  updatePlayer,
  saveGameProgress,
  loadGameProgress,
  updateDistance,
  updateScore,
  updateStage,
  incrementTotalRuns,
} from './player/playerService';

// Crystal eggs wallet
export {
  getCrystalEggBalance,
  addCrystalEggs,
  removeCrystalEggs,
} from './player/crystalEggService';

// Leaderboard
export {
  submitScore,
  getTop100Players,
  getPlayerRank,
} from './leaderboard/leaderboardService';

// Missions
export {
  generateAndStoreDailyMissions,
  getPlayerMissions,
  updateMissionProgress,
  claimMissionReward,
} from './missions/missionService';

// Achievements
export {
  initPlayerAchievements,
  checkAchievements,
  updateAchievementProgress,
  claimAchievement,
} from './achievements/achievementService';

// Settings
export {
  saveSettings,
  loadSettings,
} from './settings/settingsService';

// Developer config
export {
  getGameConfig,
  updateGameConfig,
  validateConfig,
} from './config/configService';

// Analytics
export {
  trackRunStarted,
  trackRunEnded,
  trackRunCrashed,
  trackReviveUsed,
  trackFeedsCollected,
  trackCrystalEggCollected,
  trackBrownEggLaid,
  trackStageEvolved,
  trackStage2Entered,
  trackSkinPurchased,
  trackMissionClaimed,
  trackAchievementClaimed,
  trackDailyRewardClaimed,
  trackSessionStarted,
  trackSessionEnded,
  trackNewHighScore,
} from './analytics/analyticsService';
