import { useEffect, useState, useCallback } from 'react';

// IS_DEV: true when VITE_DEV_TOOLS=true in .env — survives production deploys.
// Flip to false in .env only for the official public launch.
const IS_DEV = import.meta.env.VITE_DEV_TOOLS === 'true';

const DEV_MODE_KEY = 'skm_dev_mode_enabled';
function readDevMode(): boolean {
  try { return localStorage.getItem(DEV_MODE_KEY) === 'true'; } catch { return false; }
}
function writeDevMode(v: boolean): void {
  try { localStorage.setItem(DEV_MODE_KEY, v ? 'true' : 'false'); } catch { /* ignore */ }
}
import type { User } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { updateProfile, deleteUser, reauthenticateWithPopup, GoogleAuthProvider, reauthenticateWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { db, auth } from '../services/firebase/firebase';
import {
  getTrackerSettings, saveTrackerSettings, getStreakInfo, DEFAULT_DAILY_GOAL,
  type StreakInfo, type TrackerSettings,
} from '../services/protein/proteinTrackerService';
import {
  UserIcon, EditIcon, LogoutIcon, TrashIcon, TargetIcon,
  FlameIcon, EggIcon, SettingsIcon, ChevronRightIcon,
} from './Icons';
import {
  MILESTONES, getClaimedStickers, getClaimedWithDates,
  RARITY_COLOR, RARITY_BG,
  type MilestoneDef, type Rarity,
} from '../services/protein/milestoneRewardService';
import StickerArt from './StickerArt';
import StickerDetailModal from './StickerDetailModal';
import {
  isDevUser,
  devAddTestProtein, devAddStreakDays, devResetTodayEgg,
  devSimulateTomorrow, devUnlockAllMilestones, devUnlockMilestone,
  devResetStreakData, devTriggerTestNotification,
} from '../services/protein/devToolsService';

type View = 'profile' | 'edit_profile' | 'edit_goal' | 'delete_confirm';

interface ProfileScreenProps {
  user: User;
  onLogout: () => Promise<void>;
  onDataDeleted: () => void;
  onBackToMenu: () => void;
}

interface ExtendedProfile {
  playerName: string;
  age: string;
  gender: string;
  height: string;
  weight: string;
  goalWeight: string;
  phone: string;
}

export default function ProfileScreen({ user, onLogout, onDataDeleted, onBackToMenu }: ProfileScreenProps) {
  const [view,        setView]        = useState<View>('profile');
  const [streak,      setStreak]      = useState<StreakInfo>({ currentStreak: 0, bestStreak: 0, lastActiveDate: '' });
  const [settings,    setSettings]    = useState<TrackerSettings | null>(null);
  const [userDoc,     setUserDoc]     = useState<Record<string, unknown>>({});
  const [claimed,     setClaimed]     = useState<Set<number>>(new Set());
  const [loading,     setLoading]     = useState(true);
  const [isDevRole,       setIsDevRole]       = useState(false);
  const [devMode,         setDevMode]         = useState<boolean>(readDevMode);
  const [devMsg,          setDevMsg]          = useState('');
  const [devBusy,         setDevBusy]         = useState(false);
  const [devDebugOpen,    setDevDebugOpen]    = useState(false);
  const [claimedDates,    setClaimedDates]    = useState<Map<number, string>>(new Map());
  const [favorites,       setFavorites]       = useState<Set<number>>(new Set());
  const [activeSticker,   setActiveSticker]   = useState<MilestoneDef | null>(null);
  const [rarityFilter,    setRarityFilter]    = useState<Rarity | 'All'>('All');
  const [lockedToast,     setLockedToast]     = useState<number | null>(null); // days value of locked sticker tapped
  const [shakingDays,     setShakingDays]     = useState<number | null>(null); // for shake animation

  const [profile,       setProfile]       = useState<ExtendedProfile>({ playerName: '', age: '', gender: '', height: '', weight: '', goalWeight: '', phone: '' });
  const [profileErr,    setProfileErr]    = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [newGoal,       setNewGoal]       = useState('');
  const [goalErr,       setGoalErr]       = useState('');
  const [goalSaving,    setGoalSaving]    = useState(false);
  const [delLoading,    setDelLoading]    = useState(false);
  const [delErr,        setDelErr]        = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [si, stg, snap, cl, dates, devRole] = await Promise.all([
        getStreakInfo(user.uid),
        getTrackerSettings(user.uid),
        getDoc(doc(db, 'users', user.uid)),
        getClaimedStickers(user.uid),
        getClaimedWithDates(user.uid),
        isDevUser(user.uid),
      ]);
      setStreak(si); setSettings(stg); setClaimed(cl); setClaimedDates(dates);
      setIsDevRole(devRole);
      if (snap.exists()) setUserDoc(snap.data());
    } catch (e) { console.error('[Profile]', e); }
    finally { setLoading(false); }
  }, [user.uid]);

  const runDevAction = async (label: string, fn: () => Promise<void>) => {
    setDevBusy(true);
    setDevMsg(`Running: ${label}…`);
    try {
      await fn();
      setDevMsg(`✅ ${label} done`);
      await load();
    } catch (e: unknown) {
      setDevMsg(`❌ Error: ${(e as Error).message ?? String(e)}`);
    } finally {
      setDevBusy(false);
      setTimeout(() => setDevMsg(''), 3000);
    }
  };

  useEffect(() => { load(); }, [load]);

  const playerName = user.displayName ?? 'Champion';
  const joinedDate = user.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const handleSaveProfile = async () => {
    const name = profile.playerName.trim();
    if (name.length < 3)  { setProfileErr('Name must be at least 3 characters.'); return; }
    if (name.length > 20) { setProfileErr('Name must be at most 20 characters.'); return; }
    setProfileSaving(true); setProfileErr('');
    try {
      await updateProfile(auth.currentUser!, { displayName: name });
      await updateDoc(doc(db, 'users', user.uid), {
        playerName: name,
        ...(profile.age        ? { age:       parseInt(profile.age)          } : {}),
        ...(profile.gender     ? { gender:    profile.gender                  } : {}),
        ...(profile.height     ? { height:    parseFloat(profile.height)      } : {}),
        ...(profile.weight     ? { weight:    parseFloat(profile.weight)      } : {}),
        ...(profile.goalWeight ? { goalWeight:parseFloat(profile.goalWeight)  } : {}),
        ...(profile.phone      ? { phone:     profile.phone.trim()            } : {}),
        updatedAt: serverTimestamp(),
      });
      await load(); setView('profile');
    } catch { setProfileErr('Failed to update. Please try again.'); }
    finally { setProfileSaving(false); }
  };

  const handleSaveGoal = async () => {
    const g = parseInt(newGoal, 10);
    if (isNaN(g) || g < 10 || g > 300) { setGoalErr('Enter a value between 10 and 300.'); return; }
    setGoalSaving(true); setGoalErr('');
    try {
      await saveTrackerSettings(user.uid, { dailyGoal: g });
      await load(); setView('profile'); setNewGoal('');
    } catch { setGoalErr('Failed to save. Try again.'); }
    finally { setGoalSaving(false); }
  };

  const handleDelete = async () => {
    setDelLoading(true); setDelErr('');
    const currentUser = auth.currentUser;
    if (!currentUser) { setDelErr('No authenticated user. Please log in again.'); setDelLoading(false); return; }
    try {
      const provider = currentUser.providerData[0]?.providerId ?? '';
      if (provider === 'google.com') {
        await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      } else if (provider === 'phone') {
        const tempDiv = document.createElement('div');
        tempDiv.id = 'reauth-recaptcha-' + Date.now();
        tempDiv.style.display = 'none';
        document.body.appendChild(tempDiv);
        try {
          const verifier = new RecaptchaVerifier(auth, tempDiv.id, { size: 'invisible' });
          const confirmResult = await reauthenticateWithPhoneNumber(currentUser, currentUser.phoneNumber!, verifier);
          verifier.clear(); document.body.removeChild(tempDiv);
          const code = window.prompt('Enter the OTP sent to ' + currentUser.phoneNumber + ' to confirm deletion:');
          if (!code) { setDelErr('OTP is required to delete your account.'); setDelLoading(false); return; }
          await confirmResult.confirm(code.trim());
        } catch (e) {
          try { document.body.removeChild(tempDiv); } catch { /* already removed */ }
          throw e;
        }
      }

      const uid = currentUser.uid;
      const topLevel = ['users', 'settings', 'tracker_settings', 'login_streaks'];
      await Promise.allSettled(topLevel.map(p => deleteDoc(doc(db, p, uid))));

      const subCols: [string, string][] = [
        ['protein_logs', 'entries'],
        ['daily_stats', 'days'],
      ];
      await Promise.allSettled(subCols.map(async ([col, sub]) => {
        const snap = await getDocs(collection(db, col, uid, sub));
        return Promise.allSettled(snap.docs.map(d => deleteDoc(d.ref)));
      }));

      await deleteUser(currentUser);
      onDataDeleted();
    } catch (err: unknown) {
      console.error('[DELETE]', err);
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/requires-recent-login') {
        setDelErr('Session expired. Please log out, log back in, then try again.');
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setDelErr('Re-authentication cancelled. Please try again.');
      } else if (code === 'auth/invalid-verification-code') {
        setDelErr('Incorrect OTP. Please try again.');
      } else {
        setDelErr('Deletion failed. Please try again.');
      }
      setDelLoading(false);
    }
  };

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #FCE8E8', borderTopColor: '#D71920', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── DELETE CONFIRM ─────────────────────────────────────────
  if (view === 'delete_confirm') return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 90 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FCE8E8', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TrashIcon size={32} color="#D71920" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 900, color: '#1A1A1A', margin: '0 0 6px' }}>Delete Account?</h3>
        <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>This action is permanent and cannot be undone.</p>
        <div style={{ textAlign: 'left', marginBottom: 18 }}>
          {['Profile and Name', 'Protein Logs', 'Daily Statistics', 'Scan History'].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#FCE8E8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 900, color: '#D71920' }}>✕</span>
              </div>
              <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>{item}</span>
            </div>
          ))}
        </div>
        {delErr && <p style={{ fontSize: 12, color: '#D71920', marginBottom: 12 }}>{delErr}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { setView('profile'); setDelErr(''); }} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid #E8E8E8', background: '#F5F5F5', color: '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleDelete} disabled={delLoading} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#D71920,#B31217)', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', opacity: delLoading ? 0.7 : 1 }}>
            {delLoading ? 'Deleting…' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── EDIT PROFILE ───────────────────────────────────────────
  if (view === 'edit_profile') return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 90 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1A1A1A', margin: '0 0 16px' }}>Edit Profile</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <InputField label="Name *"       value={profile.playerName} onChange={v => setProfile(p => ({ ...p, playerName: v }))} placeholder={playerName} />
          <InputField label="Phone"        value={profile.phone}      onChange={v => setProfile(p => ({ ...p, phone: v }))}       placeholder="+91 9999..." type="tel" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <InputField label="Age"   value={profile.age}    onChange={v => setProfile(p => ({ ...p, age: v }))}    placeholder="Years"  type="number" />
            <SelectField label="Gender" value={profile.gender} onChange={v => setProfile(p => ({ ...p, gender: v }))} options={['Male','Female','Other','Prefer not to say']} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <InputField label="Height (cm)" value={profile.height}     onChange={v => setProfile(p => ({ ...p, height: v }))}     placeholder="170" type="number" />
            <InputField label="Weight (kg)" value={profile.weight}     onChange={v => setProfile(p => ({ ...p, weight: v }))}     placeholder="70"  type="number" />
            <InputField label="Goal (kg)"   value={profile.goalWeight} onChange={v => setProfile(p => ({ ...p, goalWeight: v }))} placeholder="65"  type="number" />
          </div>
        </div>
        {profileErr && <p style={{ fontSize: 12, color: '#D71920', textAlign: 'center', margin: '10px 0 0' }}>{profileErr}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => { setView('profile'); setProfileErr(''); }} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid #E8E8E8', background: '#F5F5F5', color: '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSaveProfile} disabled={profileSaving} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#D71920,#B31217)', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', opacity: profileSaving ? 0.7 : 1 }}>
            {profileSaving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── EDIT GOAL ──────────────────────────────────────────────
  if (view === 'edit_goal') return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 90 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 900, color: '#1A1A1A', margin: '0 0 4px' }}>Daily Protein Goal</h3>
        <p style={{ fontSize: 12, color: '#999', margin: '0 0 16px' }}>Current: {settings?.dailyGoal ?? DEFAULT_DAILY_GOAL}g</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {[30, 60, 90, 120].map(g => (
            <button key={g} onClick={() => setNewGoal(String(g))} style={{
              padding: '10px 4px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: newGoal === String(g) ? '#D71920' : '#F5F5F5',
              color:      newGoal === String(g) ? '#fff'    : '#666',
            }}>{g}g</button>
          ))}
        </div>
        <input type="number" min="10" max="300" value={newGoal} autoFocus
          onChange={e => { setNewGoal(e.target.value); setGoalErr(''); }}
          placeholder="Custom amount in grams"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 14, border: '1.5px solid #E8E8E8', fontSize: 14, fontWeight: 700, textAlign: 'center', color: '#D71920', outline: 'none', boxSizing: 'border-box', marginBottom: 4 }} />
        {goalErr && <p style={{ fontSize: 12, color: '#D71920', textAlign: 'center', margin: '4px 0 0' }}>{goalErr}</p>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={() => { setView('profile'); setNewGoal(''); setGoalErr(''); }} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1.5px solid #E8E8E8', background: '#F5F5F5', color: '#666', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSaveGoal} disabled={goalSaving} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#D71920,#B31217)', color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer', opacity: goalSaving ? 0.7 : 1 }}>
            {goalSaving ? 'Saving…' : 'Set Goal'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── MAIN PROFILE ───────────────────────────────────────────
  const streakLevel =
    streak.currentStreak >= 100 ? 'Legend' :
    streak.currentStreak >= 30  ? 'Master' :
    streak.currentStreak >= 14  ? 'Pro' :
    streak.currentStreak >= 7   ? 'Rising' : 'Starter';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── RED PROFILE HERO ── */}
      <div style={{
        background: 'linear-gradient(160deg,#D71920 0%,#B31217 55%,#7C1015 100%)',
        padding: '24px 20px 28px', flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        {/* Avatar + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px 20px' }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {user.photoURL ? (
              <img src={user.photoURL} alt="" style={{ width: 76, height: 76, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.6)' }} />
            ) : (
              <div style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: '3px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 30, fontWeight: 900, color: '#fff' }}>{playerName[0]?.toUpperCase() ?? '?'}</span>
              </div>
            )}
            {/* Level badge */}
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              background: 'linear-gradient(135deg,#F59E0B,#D97706)',
              borderRadius: 8, padding: '2px 6px',
              fontSize: 8, fontWeight: 900, color: '#fff',
              border: '2px solid #D71920', whiteSpace: 'nowrap',
            }}>
              {streakLevel}
            </div>
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 2px', letterSpacing: -0.3 }}>{playerName}</h3>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '2px 8px' }}>
                🔥 {streak.currentStreak}d streak
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '2px 8px' }}>
                🏆 {claimed.size}/{MILESTONES.length} stickers
              </span>
            </div>
          </div>
        </div>

        {/* Glassmorphism stats bar */}
        <div style={{
          margin: '0 16px',
          background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 20, padding: '14px 0',
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}>
          {[
            { value: streak.currentStreak, label: 'Streak', unit: 'd' },
            { value: streak.bestStreak,    label: 'Best',   unit: 'd' },
            { value: (userDoc.lifetimeConsumption as number) ?? 0, label: 'Eggs', unit: '' },
          ].map((s, i) => (
            <div key={s.label} style={{
              textAlign: 'center',
              borderRight: i < 2 ? '1px solid rgba(255,255,255,0.12)' : 'none',
            }}>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>
                {s.value}{s.unit}
              </p>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90, marginTop: 0 }}>
        <div style={{ padding: '14px 16px 0' }}>

          {/* Account info */}
          <SectionCard title="Account" style={{ marginTop: 14 }}>
            <InfoRow label="Name"       value={playerName} />
            <InfoRow label="Email"      value={user.email ?? '—'} />
            <InfoRow label="Daily Goal" value={`${settings?.dailyGoal ?? DEFAULT_DAILY_GOAL}g protein`} highlight />
            {(userDoc.age    as number) && <InfoRow label="Age"    value={`${userDoc.age} years`} />}
            {(userDoc.gender as string) && <InfoRow label="Gender" value={userDoc.gender as string} />}
            {(userDoc.height as number) && <InfoRow label="Height" value={`${userDoc.height} cm`} />}
            {(userDoc.weight as number) && <InfoRow label="Weight" value={`${userDoc.weight} kg`} />}
          </SectionCard>

          {/* Actions — Change Daily Goal only */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <ActionRow icon={<TargetIcon size={18} color="#D71920" />} label="Change Daily Goal" onClick={() => { setNewGoal(String(settings?.dailyGoal ?? DEFAULT_DAILY_GOAL)); setView('edit_goal'); }} />
          </div>

          {/* ── STICKER COLLECTION GALLERY ── */}
          <div style={{ marginTop: 14 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Sticker Collection</p>
                <p style={{ fontSize: 10, color: '#999', margin: '2px 0 0', fontWeight: 600 }}>
                  {claimed.size} / {MILESTONES.length} collected
                </p>
              </div>
              <div style={{
                background: 'linear-gradient(135deg,#D71920,#B31217)',
                borderRadius: 20, padding: '4px 12px',
                boxShadow: '0 3px 10px rgba(215,25,32,0.3)',
              }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>
                  {Math.round((claimed.size / MILESTONES.length) * 100)}%
                </span>
              </div>
            </div>

            {/* Red-only progress bar */}
            <div style={{ height: 8, background: '#F0F0F0', borderRadius: 12, overflow: 'hidden', marginBottom: 10, position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${(claimed.size / MILESTONES.length) * 100}%`,
                background: 'linear-gradient(90deg,#D71920,#FF4D4F)',
                borderRadius: 12,
                transition: 'width 400ms ease',
                boxShadow: '0 0 8px rgba(215,25,32,0.35)',
              }} />
            </div>

            {/* Next unlock info */}
            {(() => {
              const next = MILESTONES.find(m => !claimed.has(m.days));
              if (!next) return (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #86EFAC' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', margin: 0 }}>🏆 All stickers collected! You're a legend.</p>
                </div>
              );
              const remaining = next.days - streak.currentStreak;
              return (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 1px' }}>Next Unlock</p>
                    <p style={{ fontSize: 12, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>{next.stickerName}</p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#D71920', background: '#fff', borderRadius: 8, padding: '3px 8px', border: '1px solid #FECACA', whiteSpace: 'nowrap' }}>
                    {remaining > 0 ? `${remaining} days left` : 'Claim now!'}
                  </span>
                </div>
              );
            })()}

            {/* Newest sticker banner */}
            {claimed.size > 0 && (() => {
              const newest = [...MILESTONES].reverse().find(m => claimed.has(m.days));
              if (!newest) return null;
              return (
                <div
                  onClick={() => setActiveSticker(newest)}
                  style={{
                    background: `linear-gradient(135deg, ${newest.color}20, ${newest.color2}12)`,
                    border: `2px solid ${newest.color}44`,
                    borderRadius: 18, padding: '14px 16px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                    background: `linear-gradient(135deg,${newest.color},${newest.color2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 6px 16px ${newest.color}44`,
                    overflow: 'hidden',
                  }}>
                    <StickerArt days={newest.days} fallback={newest.sticker} size={40} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: '#999', margin: 0, fontWeight: 700 }}>Newest Sticker</p>
                    <p style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', margin: '2px 0 2px' }}>{newest.stickerName}</p>
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: RARITY_COLOR[newest.rarity],
                      background: RARITY_BG[newest.rarity], borderRadius: 4, padding: '2px 6px',
                    }}>
                      {newest.rarity.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: 18, color: '#ccc' }}>›</span>
                </div>
              );
            })()}

            {/* Rarity filter tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
              {(['All', 'Common', 'Rare', 'Epic', 'Legendary'] as const).map(r => {
                const active = rarityFilter === r;
                const col = r === 'All' ? '#D71920' : RARITY_COLOR[r as Rarity];
                return (
                  <button key={r} onClick={() => setRarityFilter(r)} style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none',
                    background: active ? col : '#F0F0F0',
                    color: active ? '#fff' : '#666',
                    fontWeight: 800, fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 150ms',
                  }}>
                    {r}
                  </button>
                );
              })}
            </div>

            {/* Sticker grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {MILESTONES
                .filter(m => rarityFilter === 'All' || m.rarity === rarityFilter)
                .map(m => {
                  const unlocked = claimed.has(m.days);
                  const isFav    = favorites.has(m.days);
                  const rc       = RARITY_COLOR[m.rarity];
                  const shaking  = shakingDays === m.days;

                  if (unlocked) {
                    // ── COLLECTED: fully clickable, opens detail modal ──
                    return (
                      <div
                        key={m.days}
                        onClick={() => setActiveSticker(m)}
                        style={{
                          background: `linear-gradient(135deg, ${m.color}20, ${m.color2}10)`,
                          border: `1.5px solid ${m.color}44`,
                          borderRadius: 16, padding: '10px 6px', textAlign: 'center',
                          cursor: 'pointer', position: 'relative',
                          boxShadow: `0 4px 14px ${m.color}28`,
                          transition: 'transform 120ms, box-shadow 120ms',
                        }}
                        onPointerDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
                        onPointerUp={e   => (e.currentTarget.style.transform = 'scale(1)')}
                        onPointerLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        {isFav && (
                          <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 9 }}>⭐</div>
                        )}
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 44, height: 44, margin: '0 auto 6px', overflow: 'hidden',
                        }}>
                          <StickerArt days={m.days} fallback={m.sticker} size={40} />
                        </div>
                        <p style={{ fontSize: 8, fontWeight: 800, color: '#1A1A1A', margin: '0 0 3px', lineHeight: 1.2 }}>
                          {m.stickerName}
                        </p>
                        <span style={{
                          fontSize: 7, fontWeight: 800, color: rc,
                          background: `${rc}15`, borderRadius: 3, padding: '1px 4px', display: 'block',
                        }}>
                          {m.rarity.toUpperCase()}
                        </span>
                        <div style={{ fontSize: 8, color: '#22C55E', fontWeight: 800, marginTop: 3 }}>✅</div>
                      </div>
                    );
                  }

                  // ── LOCKED: no modal, shake + toast on tap ──
                  return (
                    <div
                      key={m.days}
                      onClick={() => {
                        setLockedToast(m.days);
                        setShakingDays(m.days);
                        setTimeout(() => setShakingDays(null), 500);
                        setTimeout(() => setLockedToast(null), 2200);
                      }}
                      style={{
                        background: '#F5F5F5',
                        border: '1.5px solid #E8E8E8',
                        borderRadius: 16, padding: '10px 6px', textAlign: 'center',
                        cursor: 'default', position: 'relative',
                        opacity: 0.6,
                        animation: shaking ? 'sticker-lock-shake 0.45s ease' : 'none',
                      }}
                    >
                      {/* Lock overlay */}
                      <div style={{
                        position: 'absolute', top: 4, left: 4,
                        fontSize: 9, lineHeight: 1,
                        background: 'rgba(0,0,0,0.35)', borderRadius: 5,
                        padding: '2px 4px', color: '#fff', fontWeight: 800,
                      }}>🔒</div>

                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 44, height: 44, margin: '0 auto 6px', overflow: 'hidden',
                      }}>
                        <StickerArt days={m.days} fallback={m.sticker} size={40} locked />
                      </div>
                      <p style={{ fontSize: 8, fontWeight: 800, color: '#bbb', margin: '0 0 3px', lineHeight: 1.2 }}>
                        {m.days}d streak
                      </p>
                      <span style={{
                        fontSize: 7, fontWeight: 700, color: '#ccc',
                        borderRadius: 3, padding: '1px 4px', display: 'block',
                      }}>
                        {m.rarity.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
            </div>

            {/* Lock toast — shown when a locked sticker is tapped */}
            {lockedToast !== null && (
              <div style={{
                marginTop: 10,
                background: '#1A1A1A', borderRadius: 12, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 8,
                animation: 'sticker-toast-in 220ms cubic-bezier(0.34,1.56,0.64,1)',
              }}>
                <span style={{ fontSize: 14 }}>🔒</span>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', margin: 0 }}>
                  Reach a {lockedToast}-day streak to unlock this sticker.
                </p>
              </div>
            )}
          </div>

          <style>{`
            @keyframes sticker-lock-shake {
              0%,100% { transform: translateX(0); }
              18%     { transform: translateX(-5px) rotate(-3deg); }
              36%     { transform: translateX(5px)  rotate(3deg); }
              54%     { transform: translateX(-4px) rotate(-2deg); }
              72%     { transform: translateX(4px)  rotate(2deg); }
              88%     { transform: translateX(-2px); }
            }
            @keyframes sticker-toast-in {
              from { transform: translateY(8px); opacity: 0; }
              to   { transform: translateY(0);   opacity: 1; }
            }
          `}</style>

          {/* Sticker detail modal */}
          <StickerDetailModal
            milestone={activeSticker}
            claimed={activeSticker ? claimed.has(activeSticker.days) : false}
            claimedDate={activeSticker ? claimedDates.get(activeSticker.days) : undefined}
            ownerName={user.displayName ?? 'Champion'}
            collectionIndex={activeSticker ? ([...claimed].sort((a,b)=>a-b).indexOf(activeSticker.days)+1) : 0}
            totalCollected={claimed.size}
            isFavorite={activeSticker ? favorites.has(activeSticker.days) : false}
            onToggleFavorite={days => setFavorites(f => {
              const next = new Set(f);
              next.has(days) ? next.delete(days) : next.add(days);
              return next;
            })}
            onClose={() => setActiveSticker(null)}
          />

          {/* ── DEVELOPER TOOLS — always visible in non-production builds ── */}
          {IS_DEV && (
            <div style={{ marginTop: 14 }}>

              {/* Development build badge */}
              <div style={{
                background: 'linear-gradient(135deg,#064E3B,#065F46)',
                borderRadius: 16, padding: '10px 14px', marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: '#34D399',
                    boxShadow: '0 0 6px #34D399', flexShrink: 0,
                    animation: 'dev-pulse 2s ease-in-out infinite',
                  }} />
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 900, color: '#34D399', margin: 0, letterSpacing: 0.5 }}>
                      🟢 DEVELOPMENT BUILD
                    </p>
                    <p style={{ fontSize: 9, color: '#6EE7B7', margin: 0, fontWeight: 600 }}>
                      {isDevRole ? 'Role: Developer' : 'Testing environment'} · v2.0
                    </p>
                  </div>
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 800, color: '#064E3B',
                  background: '#34D399', borderRadius: 6, padding: '2px 7px',
                }}>DEV</span>
              </div>

              {/* Card */}
              <div style={{
                background: '#fff', borderRadius: 20,
                border: '2px solid #C4B5FD',
                boxShadow: '0 4px 20px rgba(124,58,237,0.1)',
                overflow: 'hidden',
              }}>
                {/* Card header with toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px',
                  background: devMode ? 'linear-gradient(135deg,#7C3AED,#6D28D9)' : '#F9F7FF',
                  borderBottom: devMode ? 'none' : '1.5px solid #EDE9FE',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 11,
                      background: devMode ? 'rgba(255,255,255,0.2)' : '#EDE9FE',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17,
                    }}>🛠</div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 900, color: devMode ? '#fff' : '#1A1A1A', margin: 0 }}>Developer Tools</p>
                      <p style={{ fontSize: 10, color: devMode ? 'rgba(255,255,255,0.7)' : '#8B5CF6', margin: 0, fontWeight: 600 }}>
                        {devMode ? 'Mode active — testing enabled' : 'Tap to enable testing mode'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle switch */}
                  <div
                    onClick={() => setDevMode(m => { const next = !m; writeDevMode(next); return next; })}
                    style={{
                      width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
                      background: devMode ? '#A78BFA' : '#E8E8E8',
                      position: 'relative', transition: 'background 200ms', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 3,
                      left: devMode ? 25 : 3,
                      width: 20, height: 20, borderRadius: '50%',
                      background: devMode ? '#fff' : '#ccc',
                      transition: 'left 200ms',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }} />
                  </div>
                </div>

                {/* Status message */}
                {devMsg && (
                  <div style={{
                    margin: '10px 14px 0',
                    background: devMsg.startsWith('✅') ? '#F0FDF4' : devMsg.startsWith('❌') ? '#FEF2F2' : '#F5F3FF',
                    border: `1px solid ${devMsg.startsWith('✅') ? '#86EFAC' : devMsg.startsWith('❌') ? '#FECACA' : '#C4B5FD'}`,
                    borderRadius: 10, padding: '8px 12px', fontSize: 11, fontWeight: 700,
                    color: devMsg.startsWith('✅') ? '#166534' : devMsg.startsWith('❌') ? '#991B1B' : '#5B21B6',
                  }}>
                    {devMsg}
                  </div>
                )}

                {/* Action buttons — only when mode is ON */}
                {devMode && (
                  <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>

                    <DevSectionLabel label="Protein & Eggs" />
                    <DevBtn disabled={devBusy} label="🥚 Add Test Protein (+6g)" onClick={() => runDevAction('Add Test Protein', () => devAddTestProtein(user.uid))} />
                    <DevBtn disabled={devBusy} label="❌ Reset Today's Egg"      onClick={() => runDevAction("Reset Today's Egg", () => devResetTodayEgg(user.uid))} color="#EF4444" />

                    <DevSectionLabel label="Streak Simulation" />
                    <DevBtn disabled={devBusy} label="🔥 Add 1 Streak Day"   onClick={() => runDevAction('Add 1 Streak Day',   () => devAddStreakDays(user.uid, 1))} />
                    <DevBtn disabled={devBusy} label="🔥 Add 7-Day Streak"   onClick={() => runDevAction('Add 7 Streak Days',  () => devAddStreakDays(user.uid, 7))} />
                    <DevBtn disabled={devBusy} label="🔥 Add 30-Day Streak"  onClick={() => runDevAction('Add 30 Streak Days', () => devAddStreakDays(user.uid, 30))} />
                    <DevBtn disabled={devBusy} label="📅 Simulate Tomorrow"  onClick={() => runDevAction('Simulate Tomorrow',   () => devSimulateTomorrow(user.uid))} />
                    <DevBtn disabled={devBusy} label="🗑 Reset Streak Data"  onClick={() => runDevAction('Reset Streak Data',   () => devResetStreakData(user.uid))} color="#EF4444" />

                    <DevSectionLabel label="Milestones & Stickers" />
                    <DevBtn disabled={devBusy} label="🏆 Unlock Test Milestone" onClick={() => {
                      const next = MILESTONES.find(m => !claimed.has(m.days));
                      if (!next) { setDevMsg('All milestones already unlocked'); return; }
                      runDevAction(`Unlock ${next.days}d Milestone`, () => devUnlockMilestone(user.uid, next.days));
                    }} />
                    <DevBtn disabled={devBusy} label="🪪 Unlock All Stickers"   onClick={() => runDevAction('Unlock All Stickers', () => devUnlockAllMilestones(user.uid))} />

                    <DevSectionLabel label="Notifications & Debug" />
                    <DevBtn disabled={devBusy} label="📢 Send Test Notification" onClick={() => runDevAction('Test Notification', () => devTriggerTestNotification(user.uid))} />
                    <DevBtn disabled={devBusy} label="♻ Refresh Profile Data"   onClick={() => runDevAction('Refresh', async () => { await load(); })} />
                    <DevBtn disabled={devBusy} label="📊 View Debug Information" onClick={() => setDevDebugOpen(d => !d)} />

                    {devDebugOpen && (
                      <div style={{
                        background: '#1E1B4B', borderRadius: 12, padding: 12,
                        fontFamily: 'monospace', fontSize: 10, color: '#A5B4FC',
                        lineHeight: 1.7,
                      }}>
                        <p style={{ color: '#818CF8', fontWeight: 800, margin: '0 0 6px', fontSize: 11 }}>Debug Info</p>
                        <p style={{ margin: 0 }}>uid: {user.uid}</p>
                        <p style={{ margin: 0 }}>email: {user.email}</p>
                        <p style={{ margin: 0 }}>role: {isDevRole ? 'developer' : 'user'}</p>
                        <p style={{ margin: 0 }}>streak: {streak.currentStreak}d (best: {streak.bestStreak}d)</p>
                        <p style={{ margin: 0 }}>goal: {settings?.dailyGoal ?? 60}g/day</p>
                        <p style={{ margin: 0 }}>stickers: {claimed.size}/{MILESTONES.length}</p>
                        <p style={{ margin: 0 }}>lastActive: {streak.lastActiveDate || '—'}</p>
                        <p style={{ margin: 0 }}>build: {import.meta.env.MODE}</p>
                        <p style={{ margin: 0 }}>provider: {user.providerData[0]?.providerId ?? '—'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <style>{`@keyframes dev-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
            </div>
          )}

          {/* Account actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <ActionRow icon={<LogoutIcon size={18} color="#D71920" />} label="Logout"         onClick={onLogout}                       variant="outline" />
            <ActionRow icon={<TrashIcon  size={18} color="#D71920" />} label="Delete Account" onClick={() => setView('delete_confirm')} variant="danger" />
          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function StatTile({ icon, value, label, color = '#D71920' }: { icon: React.ReactNode; value: number | string; label: string; color?: string }) {
  return (
    <div style={{ background: '#F8F8F8', borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
      <p style={{ fontSize: 18, fontWeight: 900, color, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 8, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 0.3, margin: '3px 0 0' }}>{label}</p>
    </div>
  );
}

function SectionCard({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', ...style }}>
      <p style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1, padding: '14px 16px 8px', margin: 0 }}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #F5F5F5' }}>
      <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: highlight ? '#D71920' : '#1A1A1A' }}>{value}</span>
    </div>
  );
}

function ActionRow({ icon, label, onClick, variant = 'default', right }: {
  icon: React.ReactNode; label: string; onClick: () => void; variant?: 'default' | 'outline' | 'danger'; right?: React.ReactNode | null;
}) {
  const bgMap  = { default: '#fff', outline: '#fff', danger: '#FCE8E8' };
  const colMap = { default: '#1A1A1A', outline: '#D71920', danger: '#D71920' };
  const bdrMap = { default: 'none', outline: '1.5px solid rgba(215,25,32,0.35)', danger: 'none' };
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', borderRadius: 16,
      background: bgMap[variant], color: colMap[variant], border: bdrMap[variant],
      fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'left',
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: variant === 'danger' ? '#FCE8E8' : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <span style={{ flex: 1 }}>{label}</span>
      {right !== undefined ? right : <ChevronRightIcon size={16} color="#ccc" />}
    </button>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #E8E8E8', fontSize: 13, color: '#1A1A1A', outline: 'none', boxSizing: 'border-box' }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '11px 14px', borderRadius: 12, border: '1.5px solid #E8E8E8', fontSize: 13, color: '#1A1A1A', outline: 'none', background: '#fff', boxSizing: 'border-box' }}>
        <option value="">Select…</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function DevBtn({ label, onClick, disabled, color = '#7C3AED' }: { label: string; onClick: () => void; disabled?: boolean; color?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '11px 14px', borderRadius: 12,
        border: `1.5px solid ${color}33`,
        background: disabled ? '#F5F5F5' : `${color}10`,
        color: disabled ? '#bbb' : color,
        fontWeight: 700, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left', opacity: disabled ? 0.7 : 1,
        transition: 'background 120ms',
      }}
    >
      {label}
    </button>
  );
}

function DevSectionLabel({ label }: { label: string }) {
  return (
    <p style={{
      fontSize: 9, fontWeight: 800, color: '#8B5CF6',
      textTransform: 'uppercase', letterSpacing: 1,
      margin: '6px 0 2px 2px',
    }}>
      {label}
    </p>
  );
}
