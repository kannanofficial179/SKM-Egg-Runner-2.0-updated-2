import { StrictMode, useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx';
import WelcomeScreen from './auth/WelcomeScreen.tsx';
import ProfileSetupScreen from './auth/ProfileSetupScreen.tsx';
import ModuleSelectScreen from './auth/ModuleSelectScreen.tsx';
import ProteinTrackerScreen from './auth/ProteinTrackerScreen.tsx';
import QRManagementPage from './pages/qr-management/QRManagementPage.tsx';
import LoadingScreen from './auth/LoadingScreen.tsx';
import OfflineScreen from './auth/OfflineScreen.tsx';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './services/firebase/firebase.ts';
import { startRealtimeConfigSync } from './liveConfig.ts';
import { soundManager } from './audio.ts';
import './index.css';

// Start Firestore real-time config sync as soon as the app loads.
// This ensures every client gets live developer config updates instantly.
startRealtimeConfigSync();

// Prewarm AudioContext on the very first user gesture so click sounds are
// instant when RUN NOW is tapped (AudioContext requires a user gesture to start).
const _prewarmAudio = () => {
  soundManager.prewarm();
  window.removeEventListener('pointerdown', _prewarmAudio, true);
};
window.addEventListener('pointerdown', _prewarmAudio, true);

// ─────────────────────────────────────────────────────────────────────────────
// Flow:
//   Loading → Login → Profile Setup (new users only) → Module Select → Module
//
// Auth navigation is driven exclusively by onAuthStateChanged in AuthProvider.
// WelcomeScreen's onAuthSuccess is intentionally a no-op — the user state
// change fires automatically and AppRoot re-renders into the correct screen.
//
// Profile status:
//   CHECKING  — waiting for Firestore read
//   NEEDED    — doc missing, show ProfileSetupScreen
//   READY     — doc exists, show ModuleSelectScreen
// ─────────────────────────────────────────────────────────────────────────────

type ProfileStatus = 'CHECKING' | 'NEEDED' | 'READY';
type AppScreen     = 'MODULE_SELECT' | 'GAME' | 'PROTEIN_TRACKER' | 'QR_MANAGEMENT';

// Check if the URL path is /codes on initial load
const INITIAL_PATH = window.location.pathname;

function AppRoot() {
  const { user } = useAuth();
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('CHECKING');
  const [screen,        setScreen]        = useState<AppScreen>('MODULE_SELECT');
  // Track the last UID we checked so re-renders don't re-fire the Firestore read
  const checkedUidRef = useRef<string | null>(null);

  useEffect(() => {
    // user === undefined  → Firebase hasn't resolved yet (initial load)
    // user === null       → definitely logged out
    // user = User object  → logged in

    if (!user) {
      // Reset so next login re-checks profile
      checkedUidRef.current = null;
      setProfileStatus('CHECKING');
      return;
    }

    // Already checked this UID this session — don't re-run
    if (checkedUidRef.current === user.uid) return;
    checkedUidRef.current = user.uid;

    console.log('[AUTH] User UID:', user.uid, '| Email:', user.email);
    setProfileStatus('CHECKING');

    getDoc(doc(db, 'users', user.uid))
      .then(snap => {
        console.log('[AUTH] User document exists:', snap.exists());
        if (snap.exists()) {
          setProfileStatus('READY');
          console.log('[AUTH] Redirecting to module selection');
          // Update lastLogin for every sign-in (non-Google providers don't do this elsewhere)
          updateDoc(doc(db, 'users', user.uid), { lastLogin: serverTimestamp() })
            .catch(() => { /* non-fatal */ });
        } else {
          // New user — show profile setup
          setProfileStatus('NEEDED');
          console.log('[AUTH] Profile needed — showing ProfileSetupScreen');
        }
      })
      .catch(err => {
        // Firestore error (offline, rules, etc.) — treat as READY so the user
        // is never stuck on the login screen due to a Firestore permission issue.
        // Profile creation will happen lazily when they next reach ProfileSetup.
        console.warn('[AUTH] Firestore read failed, treating as READY:', err?.message);
        setProfileStatus('READY');
      });
  }, [user]);

  // Reset screen to MODULE_SELECT when a different user logs in,
  // but honour /codes deep-link if that's where they arrived.
  useEffect(() => {
    if (user?.uid) {
      if (INITIAL_PATH === '/codes') {
        setScreen('QR_MANAGEMENT');
        // Clean up the URL so refresh doesn't re-trigger unexpectedly
        window.history.replaceState(null, '', '/codes');
      } else {
        setScreen('MODULE_SELECT');
      }
    }
  }, [user?.uid]);

  // BGM ownership: the game engine is the SOLE owner of startMusic().
  // Every non-GAME screen must be silent. Stop the sequencer immediately
  // on any transition away from the game so QR Management, Module Select,
  // Protein Tracker, and the login screen are all quiet.
  // The engine's start() call re-starts BGM when a run begins.
  useEffect(() => {
    if (screen !== 'GAME') {
      soundManager.stopMusic();
      if (screen === 'QR_MANAGEMENT') {
        console.log('[AUDIO] Entered Admin Route: /codes — Game BGM stopped.');
      }
    } else {
      console.log('[AUDIO] Returned to Game — Game BGM resumed.');
    }
    // No startMusic() here — engine.start() handles that exclusively.
  }, [screen]);

  // ── Loading splash ────────────────────────────────────────────────────────
  if (user === undefined || (user && profileStatus === 'CHECKING')) {
    const dataReady = user !== undefined && profileStatus !== 'CHECKING';
    return (
      <LoadingScreen
        ready={dataReady}
        onDone={() => {
          // onDone fires after fade-out — React will re-render naturally
          // once profileStatus leaves CHECKING, so this is a no-op.
        }}
      />
    );
  }

  // ── Not logged in → login screen ─────────────────────────────────────────
  if (user === null) {
    console.log('[AUTH] Login started — showing WelcomeScreen');
    return (
      // onAuthSuccess is a no-op: navigation is driven by onAuthStateChanged
      // firing in AuthProvider, which updates `user` and re-renders AppRoot.
      <WelcomeScreen onAuthSuccess={() => {}} />
    );
  }

  // ── Logged in, new user → profile setup ──────────────────────────────────
  if (profileStatus === 'NEEDED') {
    return (
      <ProfileSetupScreen
        user={user}
        onProfileCreated={(playerName) => {
          localStorage.setItem(`skm_player_name_${user.uid}`, playerName);
          console.log('[AUTH] Profile created for', user.uid, '— redirecting to module selection');
          setProfileStatus('READY');
        }}
      />
    );
  }

  // ── Module selection ──────────────────────────────────────────────────────
  if (screen === 'MODULE_SELECT') {
    return (
      <ModuleSelectScreen
        onSelectGame={()    => setScreen('GAME')}
        onSelectTracker={() => setScreen('PROTEIN_TRACKER')}
        onSelectQR={() => {
          window.history.replaceState(null, '', '/codes');
          setScreen('QR_MANAGEMENT');
        }}
      />
    );
  }

  // ── Protein Tracker ───────────────────────────────────────────────────────
  if (screen === 'PROTEIN_TRACKER') {
    return (
      <ProteinTrackerScreen
        onBack={() => setScreen('MODULE_SELECT')}
      />
    );
  }

  // ── QR Management (/codes) — admin only ───────────────────────────────────
  if (screen === 'QR_MANAGEMENT') {
    return (
      <QRManagementPage
        onBack={() => {
          window.history.replaceState(null, '', '/');
          setScreen('MODULE_SELECT');
        }}
      />
    );
  }

  // ── Game ──────────────────────────────────────────────────────────────────
  return <App onBackToMenu={() => setScreen('MODULE_SELECT')} />;
}

function OnlineGate() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!isOnline) return <OfflineScreen />;

  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OnlineGate />
  </StrictMode>,
);
