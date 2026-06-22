/**
 * PROTEIN TRACKER — QR Scan Screen
 *
 * Uses validateEggForProtein() — read-only QR check that does NOT
 * consume game play credits. The protein tracker and the game runner
 * are independent systems that share the same QR codes but track
 * usage separately.
 *
 * Flow:
 *   idle → camera open → scanning → QR detected →
 *   validateEggForProtein (read-only Firestore) →
 *   logEggScan (writes protein_logs + daily_stats + streak + rewards) →
 *   success screen
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import type { User } from 'firebase/auth';
import { validateEggForProtein } from '../services/qr/qrService';
import {
  logEggScan, getRecentEntries, getTodayStats, getTrackerSettings,
  PROTEIN_PER_EGG, COINS_PER_EGG, XP_PER_EGG,
  type ProteinLogEntry, type DailyStats, type TrackerSettings,
} from '../services/protein/proteinTrackerService';
import { CameraIcon, EggIcon, CheckCircleIcon, AlertIcon, ZapIcon } from './Icons';

type Phase = 'idle' | 'opening' | 'scanning' | 'processing' | 'success' | 'error';

interface QRScanScreenProps {
  user: User;
  onScanSuccess: () => void;
}

interface ScanResult {
  protein: number;
  xp: number;
  coins: number;
  streak: number;
  todayEggs: number;
  todayProtein: number;
  goal: number;
  eggCode: string;
}

const QR_ELEMENT_ID = 'protein-qr-reader';

export default function QRScanScreen({ user, onScanSuccess }: QRScanScreenProps) {
  const [phase,          setPhase]          = useState<Phase>('idle');
  const [errorMessage,   setErrorMessage]   = useState('');
  const [result,         setResult]         = useState<ScanResult | null>(null);
  const [dots,           setDots]           = useState(0);
  const [scanHistory,    setScanHistory]    = useState<ProteinLogEntry[]>([]);
  const [todayStats,     setTodayStats]     = useState<DailyStats | null>(null);
  const [settings,       setSettings]       = useState<TrackerSettings | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const scannerRef     = useRef<Html5Qrcode | null>(null);
  const processingRef  = useRef(false);   // prevents duplicate scan callbacks
  const mountedRef     = useRef(true);    // prevents setState after unmount

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load today's history ────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const [entries, ts, stg] = await Promise.all([
        getRecentEntries(user.uid, 30),
        getTodayStats(user.uid),
        getTrackerSettings(user.uid),
      ]);
      if (!mountedRef.current) return;
      const today = new Date().toISOString().slice(0, 10);
      setScanHistory(entries.filter(e => e.type === 'qr_scan' && e.dateKey === today));
      setTodayStats(ts);
      setSettings(stg);
    } catch (e) {
      console.error('[SCAN] loadHistory error:', e);
    } finally {
      if (mountedRef.current) setLoadingHistory(false);
    }
  }, [user.uid]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Scanner lifecycle ───────────────────────────────────────
  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED) {
        await scannerRef.current.stop();
      }
      scannerRef.current.clear();
    } catch { /* ignore cleanup errors */ }
    scannerRef.current = null;
  }, []);

  // Always stop scanner on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  // Animated dots while scanning
  useEffect(() => {
    if (phase !== 'scanning') return;
    const t = setInterval(() => setDots(d => (d + 1) % 4), 500);
    return () => clearInterval(t);
  }, [phase]);

  // ── Open camera ─────────────────────────────────────────────
  const openCamera = useCallback(async () => {
    console.log('[SCAN BUTTON CLICKED]');
    setPhase('opening');
    setErrorMessage('');
    processingRef.current = false;

    // Ensure any previous scanner is cleaned up
    await stopScanner();

    // Give the DOM a tick to render the qr-reader div
    await new Promise(r => setTimeout(r, 80));

    const el = document.getElementById(QR_ELEMENT_ID);
    if (!el) {
      console.error('[SCAN] QR reader DOM element not found');
      setErrorMessage('Camera view unavailable. Please try again.');
      setPhase('error');
      return;
    }

    try {
      const scanner = new Html5Qrcode(QR_ELEMENT_ID);
      scannerRef.current = scanner;

      console.log('[CAMERA OPENED]');
      setPhase('scanning');

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        async (decoded) => {
          // Strict guard — only process the first detected code
          if (processingRef.current) return;
          processingRef.current = true;
          console.log('[QR DETECTED]', decoded.slice(0, 30));
          await handleScan(decoded);
        },
        () => { /* ignore scan errors (no QR in frame) */ }
      );
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      console.error('[SCAN] Camera start error:', msg);
      const isPermission = msg.toLowerCase().includes('permission') ||
                           msg.toLowerCase().includes('denied') ||
                           msg.toLowerCase().includes('notallowed');
      setErrorMessage(
        isPermission
          ? 'Camera permission denied. Please allow camera access in your browser settings and try again.'
          : 'Unable to open camera. Please check your device settings.'
      );
      setPhase('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopScanner]);

  // ── Core scan handler ────────────────────────────────────────
  const handleScan = async (raw: string) => {
    await stopScanner();
    if (mountedRef.current) setPhase('processing');

    try {
      // Step 1: Validate QR — READ ONLY, does not affect game play counts
      console.log('[QR VALIDATED] starting validation...');
      const validation = await validateEggForProtein(raw);

      if (!validation.ok) {
        const failedValidation = validation as { ok: false; reason: string; message: string };
        console.warn('[SCAN] Validation failed:', failedValidation.reason, failedValidation.message);
        if (mountedRef.current) {
          setErrorMessage(failedValidation.message);
          setPhase('error');
        }
        return;
      }

      console.log('[QR VALIDATED] code accepted:', validation.eggCode);

      // Step 2: Log egg scan — writes to protein_logs, daily_stats, streak, rewards
      console.log('[PROTEIN ADDED] logging to Firebase...');
      const { streak: streakInfo, xpEarned, coinsEarned } = await logEggScan(
        user.uid,
        validation.eggCode
      );
      console.log('[FIREBASE UPDATED] protein_logs + daily_stats + streak + rewards written');

      // Step 3: Reload today's stats to get accurate post-scan totals
      const [ts, stg] = await Promise.all([
        getTodayStats(user.uid),
        getTrackerSettings(user.uid),
      ]);

      if (!mountedRef.current) return;

      setResult({
        protein: PROTEIN_PER_EGG,
        xp: xpEarned,
        coins: coinsEarned,
        streak: streakInfo.currentStreak,
        todayEggs: ts?.totalEggs ?? 0,
        todayProtein: ts?.totalProtein ?? 0,
        goal: stg.dailyGoal,
        eggCode: validation.eggCode,
      });
      setPhase('success');

    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? String(err);
      console.error('[SCAN] handleScan error:', msg);
      if (mountedRef.current) {
        // Classify common Firestore errors for the user
        if (msg.includes('permission') || msg.includes('insufficient')) {
          setErrorMessage('Permission error. Please log out and log back in, then try again.');
        } else if (msg.includes('network') || msg.includes('offline')) {
          setErrorMessage('Network error. Please check your connection and try again.');
        } else {
          setErrorMessage('Something went wrong. Please try again.');
        }
        setPhase('error');
      }
    }
  };

  // ── UI actions ───────────────────────────────────────────────
  const reset = useCallback(async () => {
    await stopScanner();
    processingRef.current = false;
    if (!mountedRef.current) return;
    setPhase('idle');
    setErrorMessage('');
    setResult(null);
    await loadHistory();
  }, [stopScanner, loadHistory]);

  const scanAnother = useCallback(async () => {
    await stopScanner();
    processingRef.current = false;
    if (!mountedRef.current) return;
    setPhase('idle');
    setResult(null);
    await loadHistory();
    setTimeout(() => openCamera(), 150);
  }, [stopScanner, loadHistory, openCamera]);

  // ── Derived values ────────────────────────────────────────────
  const goal      = settings?.dailyGoal ?? 60;
  const consumed  = todayStats?.totalProtein ?? 0;
  const eggs      = todayStats?.totalEggs ?? 0;
  const pct       = Math.min(100, Math.round((consumed / goal) * 100));
  const remaining = Math.max(0, goal - consumed);
  const eggsToGoal = Math.max(0, Math.ceil(remaining / PROTEIN_PER_EGG));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header with live progress ── */}
      <div style={{
        background: 'linear-gradient(135deg,#D71920,#B31217)',
        padding: '18px 18px 16px', flexShrink: 0,
        boxShadow: '0 4px 20px rgba(215,25,32,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CameraIcon size={21} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>Scan SKM Egg</h2>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: 0, marginTop: 1 }}>
              +{PROTEIN_PER_EGG}g protein  +{XP_PER_EGG} XP  +{COINS_PER_EGG} coins per scan
            </p>
          </div>
        </div>

        {/* Live progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
            Today: {eggs} egg{eggs !== 1 ? 's' : ''} scanned
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontWeight: 700 }}>
            {consumed}g / {goal}g
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: pct >= 100 ? '#4ade80' : 'rgba(255,255,255,0.9)',
            borderRadius: 3, transition: 'width 600ms ease',
          }} />
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', margin: '4px 0 0', fontWeight: 600 }}>
          {pct >= 100
            ? 'Goal reached! Keep going for bonus XP.'
            : `${eggsToGoal} more egg${eggsToGoal !== 1 ? 's' : ''} (${remaining}g) to reach today's goal`}
        </p>
      </div>

      {/* ── Screen content ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90 }}>

        {/* IDLE */}
        {phase === 'idle' && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Main scan card */}
            <div style={{ background: '#fff', borderRadius: 22, padding: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: '#FCE8E8', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CameraIcon size={32} color="#D71920" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1A1A1A', margin: '0 0 6px' }}>Ready to Scan</h3>
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 18px', lineHeight: 1.6 }}>
                Point your camera at the QR code on any SKM Egg package to log your protein and earn rewards.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                {[
                  { label: '+1 Egg logged',        bg: '#FCE8E8', color: '#D71920' },
                  { label: `+${XP_PER_EGG} XP earned`,      bg: '#FEF3C7', color: '#D97706' },
                  { label: `+${PROTEIN_PER_EGG}g protein`,   bg: '#F0FDF4', color: '#16A34A' },
                  { label: `+${COINS_PER_EGG} coins`,        bg: '#F5F3FF', color: '#7C3AED' },
                ].map(b => (
                  <div key={b.label} style={{ background: b.bg, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: b.color }}>{b.label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={openCamera}
                style={{
                  width: '100%', padding: '15px 0', borderRadius: 18, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#D71920,#B31217)',
                  color: '#fff', fontWeight: 900, fontSize: 15, letterSpacing: 0.5,
                  boxShadow: '0 6px 20px rgba(215,25,32,0.4)',
                }}
              >
                Open Camera
              </button>
            </div>

            {/* Today's scan history */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Today's Scans</p>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#D71920' }}>
                  {loadingHistory ? '...' : `${scanHistory.length} egg${scanHistory.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {loadingHistory ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2.5px solid #FCE8E8', borderTopColor: '#D71920', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : scanHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '18px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 13, background: '#F5F5F5', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EggIcon size={20} color="#ccc" />
                  </div>
                  <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>No eggs scanned yet today.</p>
                  <p style={{ fontSize: 11, color: '#D71920', margin: '4px 0 0', fontWeight: 700 }}>Tap Open Camera to start!</p>
                </div>
              ) : (
                <>
                  {scanHistory.map((entry, i) => {
                    let timeStr = '';
                    try {
                      const ts = entry.loggedAt as unknown;
                      if (ts && typeof ts === 'object' && 'toDate' in (ts as object)) {
                        timeStr = (ts as { toDate: () => Date }).toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                      }
                    } catch { /* ignore */ }
                    return (
                      <div key={entry.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        paddingTop: i > 0 ? 10 : 0, marginTop: i > 0 ? 10 : 0,
                        borderTop: i > 0 ? '1px solid #F8F8F8' : 'none',
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: 11, background: '#FCE8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <EggIcon size={17} color="#D71920" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>SKM Egg</p>
                          <p style={{ fontSize: 10, color: '#bbb', margin: 0 }}>
                            {timeStr}{timeStr && entry.meal ? ' · ' : ''}{entry.meal}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 12, fontWeight: 900, color: '#D71920', margin: 0 }}>+{entry.protein}g</p>
                          <p style={{ fontSize: 9, color: '#bbb', margin: 0 }}>+{XP_PER_EGG} XP</p>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{
                    marginTop: 12, padding: '10px 12px', borderRadius: 12,
                    background: pct >= 100 ? '#F0FDF4' : '#FFF5F5',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 100 ? '#16A34A' : '#D71920' }}>
                      {pct >= 100 ? 'Daily goal reached!' : `${remaining}g remaining`}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: pct >= 100 ? '#16A34A' : '#D71920' }}>
                      {consumed}g / {goal}g
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* How it works */}
            <div style={{ background: '#fff', borderRadius: 20, padding: 18, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>How It Works</p>
              {['Purchase any SKM Egg product', 'Find the QR code on the packaging', 'Tap "Open Camera" and scan the code', 'Protein and rewards are added instantly'].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < 3 ? 10 : 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#D71920', color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
                  <p style={{ fontSize: 12, color: '#1A1A1A', margin: 0, paddingTop: 2, lineHeight: 1.4 }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OPENING CAMERA */}
        {phase === 'opening' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #FCE8E8', borderTopColor: '#D71920', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ fontSize: 14, color: '#666', fontWeight: 600, margin: 0 }}>Opening camera...</p>
            {/* Hidden mount point for scanner */}
            <div id={QR_ELEMENT_ID} style={{ display: 'none' }} />
          </div>
        )}

        {/* SCANNING */}
        {phase === 'scanning' && (
          <div style={{ padding: 14 }}>
            <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <div style={{ position: 'relative' }}>
                <div id={QR_ELEMENT_ID} style={{ width: '100%' }} />
                {/* Corner frame overlay */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ position: 'relative', width: 200, height: 200 }}>
                    {[
                      { top: 0, left: 0,    borderTop: '3px solid #D71920', borderLeft: '3px solid #D71920',    borderTopLeftRadius: 6 },
                      { top: 0, right: 0,   borderTop: '3px solid #D71920', borderRight: '3px solid #D71920',   borderTopRightRadius: 6 },
                      { bottom: 0, left: 0, borderBottom: '3px solid #D71920', borderLeft: '3px solid #D71920', borderBottomLeftRadius: 6 },
                      { bottom: 0, right: 0, borderBottom: '3px solid #D71920', borderRight: '3px solid #D71920', borderBottomRightRadius: 6 },
                    ].map((s, i) => (
                      <div key={i} style={{ position: 'absolute', width: 22, height: 22, ...s }} />
                    ))}
                    <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#D71920,transparent)', animation: 'scanline 2s ease-in-out infinite' }} />
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 18px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: '0 0 12px' }}>
                  Align QR code in the frame{'.'.repeat(dots)}
                </p>
                <button onClick={reset} style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: '1.5px solid #E8E8E8', background: '#F5F5F5', color: '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PROCESSING */}
        {phase === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid #FCE8E8', borderTopColor: '#D71920', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A', margin: '0 0 4px' }}>Logging Egg...</p>
              <p style={{ fontSize: 12, color: '#bbb', margin: 0 }}>Saving protein, XP, and rewards</p>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {phase === 'success' && result && (
          <div style={{ padding: 14 }}>
            <div style={{ background: '#fff', borderRadius: 22, padding: 22, boxShadow: '0 4px 24px rgba(0,0,0,0.1)', textAlign: 'center' }}>

              <div style={{
                width: 76, height: 76, borderRadius: '50%', margin: '0 auto 14px',
                background: 'linear-gradient(135deg,#D71920,#B31217)',
                boxShadow: '0 8px 28px rgba(215,25,32,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <CheckCircleIcon size={38} color="#fff" />
              </div>

              <h3 style={{ fontSize: 21, fontWeight: 900, color: '#1A1A1A', margin: '0 0 4px' }}>Egg Logged!</h3>
              <p style={{ fontSize: 12, color: '#666', margin: '0 0 18px' }}>Protein intake recorded and rewards added.</p>

              {/* Reward cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
                <RBox label="Protein Added"  value={`+${result.protein}g`} color="#D71920" bg="#FCE8E8" />
                <RBox label="XP Earned"      value={`+${result.xp} XP`}   color="#D97706" bg="#FEF3C7" />
                <RBox label="Coins Earned"   value={`+${result.coins}`}   color="#7C3AED" bg="#F5F3FF" />
                <RBox label="Day Streak"     value={`${result.streak}d`}  color="#16A34A" bg="#F0FDF4" />
              </div>

              {/* Today's progress */}
              <div style={{ background: '#F8F8F8', borderRadius: 14, padding: '12px 14px', marginBottom: 14, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#1A1A1A' }}>Today's Progress</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: '#D71920' }}>
                    {result.todayProtein}g / {result.goal}g
                  </span>
                </div>
                <div style={{ height: 8, background: '#E8E8E8', borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round((result.todayProtein / result.goal) * 100))}%`,
                    background: result.todayProtein >= result.goal ? '#22C55E' : 'linear-gradient(90deg,#D71920,#B31217)',
                    borderRadius: 4, transition: 'width 800ms ease',
                  }} />
                </div>
                {result.todayProtein >= result.goal ? (
                  <p style={{ fontSize: 11, color: '#16A34A', margin: 0, fontWeight: 700 }}>
                    Daily goal reached! Bonus XP unlocked.
                  </p>
                ) : (
                  <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
                    {Math.max(0, Math.ceil((result.goal - result.todayProtein) / PROTEIN_PER_EGG))} more egg{Math.ceil((result.goal - result.todayProtein) / PROTEIN_PER_EGG) !== 1 ? 's' : ''} to reach today's goal
                  </p>
                )}
              </div>

              {/* Eggs today */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
                <EggIcon size={15} color="#D71920" />
                <span style={{ fontSize: 13, fontWeight: 800, color: '#1A1A1A' }}>
                  {result.todayEggs} egg{result.todayEggs !== 1 ? 's' : ''} scanned today
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={scanAnother} style={{
                  flex: 1, padding: '13px 0', borderRadius: 15, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#D71920,#B31217)',
                  color: '#fff', fontWeight: 900, fontSize: 13,
                  boxShadow: '0 4px 16px rgba(215,25,32,0.4)',
                }}>
                  Scan Another
                </button>
                <button onClick={onScanSuccess} style={{
                  flex: 1, padding: '13px 0', borderRadius: 15, border: '1.5px solid #E8E8E8', cursor: 'pointer',
                  background: '#F5F5F5', color: '#666', fontWeight: 700, fontSize: 13,
                }}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {phase === 'error' && (
          <div style={{ padding: 14 }}>
            <div style={{ background: '#fff', borderRadius: 22, padding: 26, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center' }}>
              <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto 16px', background: '#FCE8E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertIcon size={36} color="#D71920" />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1A1A1A', margin: '0 0 8px' }}>Scan Failed</h3>
              <p style={{ fontSize: 13, color: '#666', margin: '0 0 22px', lineHeight: 1.6 }}>{errorMessage}</p>
              <button onClick={reset} style={{
                width: '100%', padding: '14px 0', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#D71920,#B31217)', color: '#fff',
                fontWeight: 900, fontSize: 13, letterSpacing: 0.5,
                boxShadow: '0 6px 18px rgba(215,25,32,0.4)',
              }}>
                Try Again
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Hidden QR reader div — always present so html5-qrcode can always find it */}
      {(phase === 'opening') && <div id={QR_ELEMENT_ID} style={{ display: 'none' }} />}

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes scanline { 0% { top:0%; } 50% { top:calc(100% - 2px); } 100% { top:0%; } }
        @keyframes popIn    { from { transform:scale(0.5); opacity:0; } to { transform:scale(1); opacity:1; } }
      `}</style>
    </div>
  );
}

function RBox({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 13, padding: '13px 10px', textAlign: 'center' }}>
      <p style={{ fontSize: 19, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 700, color, opacity: 0.8, margin: 0, marginTop: 4 }}>{label}</p>
    </div>
  );
}
