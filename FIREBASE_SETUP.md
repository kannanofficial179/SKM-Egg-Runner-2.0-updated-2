# SKM Egg Runner — Firebase Backend Setup Guide

## Prerequisites

- Node.js 18+
- Firebase account at https://console.firebase.google.com
- Firebase CLI: `npm install -g firebase-tools`

---

## Step 1 — Firebase Project (Already Created)

Your Firebase project **`skm-egg-runner`** is already created and configured.
Project ID: `skm-egg-runner`
App ID: `1:635492295830:web:d572a5d8b35e42ef8f4eb7`

---

## Step 2 — Enable Services

### Authentication
1. Firebase Console → **Authentication** → **Get started**
2. **Sign-in method** tab → enable:
   - **Email/Password**
   - **Anonymous**

### Firestore
1. Firebase Console → **Firestore Database** → **Create database**
2. Choose **production mode** (rules will be deployed separately)
3. Recommended region: `asia-south1` (Mumbai) for Indian users

### Analytics
- Already enabled in your project.

---

## Step 3 — Environment Variables (Already Configured)

Your `.env` file has been created with your real project credentials.
**Do not commit `.env` to version control** — add it to `.gitignore`.

Current config (already in `.env`):

```env
VITE_FIREBASE_API_KEY=AIzaSyBcGsQCma6dB3yDSZxhPAiwJtNR3CofcJc
VITE_FIREBASE_AUTH_DOMAIN=skm-egg-runner.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=skm-egg-runner
VITE_FIREBASE_STORAGE_BUCKET=skm-egg-runner.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=635492295830
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_USE_FIREBASE_EMULATOR=false
```

---

## Step 5 — Install Firebase SDK

```bash
npm install firebase
```

---

## Step 6 — Deploy Firestore Rules & Indexes

```bash
# Login to Firebase CLI
firebase login

# Set your project
firebase use skm-egg-runner

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Firestore indexes
firebase deploy --only firestore:indexes
```

---

## Step 7 — Set Developer UID for gameConfig Write Access

1. Register your developer account in the app
2. Firebase Console → **Authentication** → find your email → copy the **UID**
3. Open `firestore.rules` and replace `YOUR_DEVELOPER_UID` with your real UID:
   ```
   && request.auth.uid == 'abc123xyz...'
   ```
4. Redeploy: `firebase deploy --only firestore:rules`

---

## Step 8 — Test Locally with Emulator (Optional)

```bash
# Install emulators
firebase init emulators
# Select: Authentication, Firestore

# Start emulators
firebase emulators:start

# Set in .env
VITE_USE_FIREBASE_EMULATOR=true
```

---

## Firestore Schema

```
users/
  {uid}/                        ← Player profile
    uid, playerName, bestScore, bestDistance,
    currentStage, totalRuns, totalFeeds,
    totalCrystalEggs, totalBrownEggs,
    totalTrays, totalBatches, level, xp,
    unlockedSkins[], activeSkinId,
    dailyRewardStreak, lastDailyRewardClaim,
    createdAt, updatedAt

leaderboard/
  {uid}/                        ← One record per player (best score)
    uid, playerName, score, distance,
    feeds, eggs, stage, createdAt, updatedAt

missions/
  {uid}/
    daily/
      {missionId}/              ← One per daily mission
        id, text, progress, target, completed, claimed,
        rewardType, rewardValue, type, difficulty,
        uid, dateKey, generatedAt, updatedAt

achievements/
  {uid}/
    list/
      {achievementId}/          ← a1, a2, a3...
        id, name, description, progress, target,
        completed, claimed, rewardType, rewardValue,
        uid, updatedAt

settings/
  {uid}/                        ← Player preferences
    uid, musicEnabled, sfxEnabled, vibrationEnabled, updatedAt

gameConfig/
  active/                       ← Single live-balance document
    configVersion, updatedBy, lastUpdated, isActive,
    feedSpawnRate, obstacleSpawnRate, vehicleSpawnRate,
    runSpeedMultiplier, stage1EvolutionReq, stage2EvolutionReq,
    crystalEggRewards, missionRewards, achievementRewards,
    envRotationRate, obstacleDensity, trafficDensity,
    updatedAt
```

---

## Service File Overview

| File | Purpose |
|------|---------|
| `src/services/firebase/firebase.ts` | Firebase app init, auth, db, analytics exports |
| `src/services/auth/authService.ts` | registerPlayer, loginPlayer, logoutPlayer, getCurrentPlayer |
| `src/services/player/playerService.ts` | createPlayer, getPlayer, updatePlayer, saveGameProgress, loadGameProgress |
| `src/services/player/crystalEggService.ts` | addCrystalEggs, removeCrystalEggs, getCrystalEggBalance |
| `src/services/leaderboard/leaderboardService.ts` | submitScore, getTop100Players, getPlayerRank |
| `src/services/missions/missionService.ts` | generateAndStoreDailyMissions, getPlayerMissions, updateMissionProgress, claimMissionReward |
| `src/services/achievements/achievementService.ts` | checkAchievements, updateAchievementProgress, claimAchievement |
| `src/services/settings/settingsService.ts` | saveSettings, loadSettings |
| `src/services/config/configService.ts` | getGameConfig, updateGameConfig, validateConfig |
| `src/services/analytics/analyticsService.ts` | trackRun*, trackFeed*, trackStage*, trackSession* |
| `src/services/index.ts` | Barrel re-export of all services |

---

## Usage in App.tsx (Integration Pattern)

The backend is fully standalone — the frontend does not need to change.
Wire up services at game events:

```typescript
import {
  loginAnonymous,
  saveGameProgress,
  submitScore,
  trackRunEnded,
} from './services';

// On game over
const uid = getCurrentPlayer()?.uid;
if (uid) {
  await saveGameProgress(uid, stats, currentStage, totalBrownEggs);
  await submitScore(uid, playerName, score, distance, feeds, gems, currentStage);
  trackRunEnded({ uid, score, distance, feeds, crystalEggs: gems, stage: currentStage, durationMs });
}
```
