import { useEffect, useState, useCallback } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { updateProfile, deleteUser, reauthenticateWithPopup, GoogleAuthProvider, reauthenticateWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { db, auth } from '../services/firebase/firebase';
import {
  getTrackerSettings, saveTrackerSettings, getStreakInfo, DEFAULT_DAILY_GOAL,
  type StreakInfo, type TrackerSettings,
} from '../services/protein/proteinTrackerService';
import {
  UserIcon, EditIcon, LogoutIcon, TrashIcon, BellIcon, TargetIcon,
  FlameIcon, EggIcon, SettingsIcon, ChevronRightIcon, CheckIcon,
} from './Icons';
import NotificationSettings from '../components/notifications/NotificationSettings';

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
  const [view,     setView]     = useState<View>('profile');
  const [streak,   setStreak]   = useState<StreakInfo>({ currentStreak: 0, bestStreak: 0, lastActiveDate: '' });
  const [settings, setSettings] = useState<TrackerSettings | null>(null);
  const [userDoc,  setUserDoc]  = useState<Record<string, unknown>>({});
  const [loading,  setLoading]  = useState(true);

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
      const [si, stg, snap] = await Promise.all([
        getStreakInfo(user.uid),
        getTrackerSettings(user.uid),
        getDoc(doc(db, 'users', user.uid)),
      ]);
      setStreak(si); setSettings(stg);
      if (snap.exists()) setUserDoc(snap.data());
    } catch (e) { console.error('[Profile]', e); }
    finally { setLoading(false); }
  }, [user.uid]);

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

  const handleToggleReminder = async () => {
    if (!settings) return;
    const next = !settings.reminderEnabled;
    await saveTrackerSettings(user.uid, { reminderEnabled: next });
    setSettings(s => s ? { ...s, reminderEnabled: next } : s);
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
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#D71920,#B31217)', padding: '20px 20px 52px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <h2 style={{ fontSize: 17, fontWeight: 900, color: '#fff', margin: '0 0 20px' }}>Profile</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.5)' }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '3px solid rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>{playerName[0].toUpperCase()}</span>
            </div>
          )}
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0 }}>{playerName}</h3>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: '2px 0' }}>{user.email}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', margin: 0 }}>Joined {joinedDate}</p>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 90, marginTop: -16 }}>
        <div style={{ padding: '0 16px' }}>

          {/* Health stats */}
          <div style={{ background: '#fff', borderRadius: 24, padding: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <StatTile icon={<FlameIcon size={16} color="#D71920" />} value={streak.currentStreak}                            label="Streak"      />
              <StatTile icon={<FlameIcon size={16} color="#8B5CF6" />} value={streak.bestStreak}                               label="Best Streak" color="#8B5CF6" />
              <StatTile icon={<EggIcon   size={16} color="#D71920" />} value={(userDoc.lifetimeConsumption as number) ?? 0}    label="Total Eggs"  />
            </div>
          </div>

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

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <ActionRow icon={<EditIcon   size={18} color="#D71920" />} label="Edit Profile"      onClick={() => { setProfile({ playerName, age: String(userDoc.age ?? ''), gender: String(userDoc.gender ?? ''), height: String(userDoc.height ?? ''), weight: String(userDoc.weight ?? ''), goalWeight: String(userDoc.goalWeight ?? ''), phone: String(userDoc.phone ?? '') }); setView('edit_profile'); }} />
            <ActionRow icon={<TargetIcon size={18} color="#D71920" />} label="Change Daily Goal" onClick={() => { setNewGoal(String(settings?.dailyGoal ?? DEFAULT_DAILY_GOAL)); setView('edit_goal'); }} />
          </div>

          {/* Notification Settings */}
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 4px' }}>Notifications</p>
            <NotificationSettings />
          </div>

          {/* Settings */}
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px 4px' }}>Settings</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ActionRow icon={<BellIcon     size={18} color="#D71920" />} label={`Reminders: ${settings?.reminderEnabled ? 'On' : 'Off'}`} onClick={handleToggleReminder} right={settings?.reminderEnabled ? <CheckIcon size={16} color="#22C55E" /> : null} />
              <ActionRow icon={<SettingsIcon size={18} color="#666" />}    label="Back to Module Select"  onClick={onBackToMenu} />
            </div>
          </div>

          {/* Account actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            <ActionRow icon={<LogoutIcon size={18} color="#D71920" />} label="Logout"         onClick={onLogout}                    variant="outline" />
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
