/**
 * SKM EGG RUNNER — Authentication Service
 * Handles player registration, login, logout, and session retrieval.
 * All auth operations use Firebase Anonymous Auth + optional email upgrade.
 */

import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User,
  UserCredential,
  AuthError,
} from 'firebase/auth';
import { auth } from '../firebase/firebase';
import { createPlayer, getPlayer } from '../player/playerService';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
}

// ─────────────────────────────────────────────
// Register a new player with email + password
// ─────────────────────────────────────────────

export async function registerPlayer(
  email: string,
  password: string,
  playerName: string
): Promise<AuthResult> {
  try {
    if (!email || !password || !playerName) {
      return { success: false, error: 'Email, password, and player name are required.' };
    }
    if (playerName.trim().length < 2) {
      return { success: false, error: 'Player name must be at least 2 characters.' };
    }

    const credential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    // Set display name on the Firebase Auth user
    await updateProfile(credential.user, { displayName: playerName.trim() });

    // Create the Firestore player document
    await createPlayer(credential.user.uid, playerName.trim());

    return { success: true, user: credential.user };
  } catch (err) {
    const error = err as AuthError;
    return { success: false, error: mapAuthError(error.code) };
  }
}

// ─────────────────────────────────────────────
// Login an existing player
// ─────────────────────────────────────────────

export async function loginPlayer(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' };
    }

    const credential: UserCredential = await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

    return { success: true, user: credential.user };
  } catch (err) {
    const error = err as AuthError;
    return { success: false, error: mapAuthError(error.code) };
  }
}

// ─────────────────────────────────────────────
// Login as anonymous guest (no account needed)
// ─────────────────────────────────────────────

export async function loginAnonymous(playerName?: string): Promise<AuthResult> {
  try {
    const credential: UserCredential = await signInAnonymously(auth);

    // Create a player profile for the anonymous user
    const name = playerName?.trim() || 'Anonymous Runner';
    const existing = await getPlayer(credential.user.uid);
    if (!existing) {
      await createPlayer(credential.user.uid, name);
    }

    return { success: true, user: credential.user };
  } catch (err) {
    const error = err as AuthError;
    return { success: false, error: mapAuthError(error.code) };
  }
}

// ─────────────────────────────────────────────
// Logout the current player
// ─────────────────────────────────────────────

export async function logoutPlayer(): Promise<AuthResult> {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    const error = err as AuthError;
    return { success: false, error: mapAuthError(error.code) };
  }
}

// ─────────────────────────────────────────────
// Get the currently authenticated player
// Returns null if no user is signed in
// ─────────────────────────────────────────────

export function getCurrentPlayer(): User | null {
  return auth.currentUser;
}

// ─────────────────────────────────────────────
// Subscribe to auth state changes
// Returns an unsubscribe function
// ─────────────────────────────────────────────

export function onPlayerAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// ─────────────────────────────────────────────
// Map Firebase error codes to human-readable messages
// ─────────────────────────────────────────────

function mapAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use':    'That email is already registered. Try logging in.',
    'auth/invalid-email':           'Invalid email address.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/user-not-found':          'No account found with that email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/too-many-requests':       'Too many attempts. Please wait and try again.',
    'auth/network-request-failed':  'Network error. Check your connection.',
    'auth/user-disabled':           'This account has been disabled.',
    'auth/operation-not-allowed':   'This sign-in method is not enabled.',
  };
  return map[code] ?? `Authentication error (${code}).`;
}
