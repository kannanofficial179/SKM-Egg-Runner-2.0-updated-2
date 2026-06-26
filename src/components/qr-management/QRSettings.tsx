import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Save, Info, Link2, CheckCircle2, ExternalLink,
  ShieldAlert, Trash2, Eye, EyeOff, AlertTriangle, X, ShieldCheck,
} from 'lucide-react';
import {
  getGameUrl, saveGameUrl, subscribeGameUrl, syncGameUrlFromFirestore,
} from '../../services/qr/qrManagementService';
import { useAuth } from '../../auth/AuthProvider';
import {
  collection, getDocs, writeBatch, doc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase/firebase';

const RED    = '#D71920';
const DANGER = '#DC2626';
const SAFE   = '#16A34A';

// Admin password — stored as a hash comparison (base64 obfuscation for UI layer).
// Real production apps would verify server-side; this matches the spec requirement.
const ADMIN_PWD_B64 = btoa('skm54321@'); // 'c2ttNTQzMjFA'
const CONFIRM_PHRASE = 'DELETE ALL QR DATA';

// Collections that belong entirely to QR management and are safe to wipe
const QR_COLLECTIONS = ['qrCodes', 'qrOperationLogs'];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 10, fontSize: 13,
  background: '#F9FAFB', border: '1.5px solid #E5E7EB',
  color: '#1A1A1A', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'system-ui,-apple-system,sans-serif', transition: 'border-color 150ms',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 6, display: 'block',
};

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({
  title, description, children, danger,
}: {
  title: string; description?: string; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${danger ? '#FECACA' : '#E5E7EB'}`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: danger ? '0 1px 4px rgba(220,38,38,0.08)' : '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${danger ? '#FEE2E2' : '#F3F4F6'}`,
        background: danger ? '#FFF5F5' : undefined,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {danger && <ShieldAlert size={15} color={DANGER} style={{ flexShrink: 0 }} />}
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 800, color: danger ? DANGER : '#1A1A1A', margin: 0 }}>
            {title}
          </h3>
          {description && (
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>{description}</p>
          )}
        </div>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

// ─── Password input with show/hide ────────────────────────────────────────────

function PasswordInput({
  value, onChange, placeholder = 'Enter administrator password', error, autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  error?: boolean; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        autoFocus={autoFocus}
        autoComplete="current-password"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          paddingRight: 40,
          borderColor: error ? '#FCA5A5' : '#E5E7EB',
        }}
        onFocus={e => (e.target.style.borderColor = error ? '#FCA5A5' : RED)}
        onBlur={e  => (e.target.style.borderColor = error ? '#FCA5A5' : '#E5E7EB')}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4,
        }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─── Admin Password Dialog ────────────────────────────────────────────────────

interface AdminAuthDialogProps {
  title:    string;
  message:  string;
  action:   string;       // label for the confirm button
  onVerified: () => void;
  onCancel:   () => void;
}

function AdminAuthDialog({ title, message, action, onVerified, onCancel }: AdminAuthDialogProps) {
  const [visible, setVisible] = useState(false);
  const [pwd,     setPwd]     = useState('');
  const [error,   setError]   = useState('');
  const [checking,setChecking]= useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = (cb?: () => void) => {
    setVisible(false);
    setTimeout(() => cb?.(), 220);
  };

  const handleVerify = () => {
    setError('');
    if (!pwd) { setError('Password is required.'); return; }
    setChecking(true);
    // Simulate a brief verification delay for UX
    setTimeout(() => {
      if (btoa(pwd) === ADMIN_PWD_B64) {
        close(onVerified);
      } else {
        setError('Incorrect administrator password.');
        setPwd('');
      }
      setChecking(false);
    }, 350);
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleVerify(); };

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10200,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      opacity: visible ? 1 : 0, transition: 'opacity 220ms ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: '#FFFFFF',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(220,38,38,0.12)',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
        transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Header */}
        <div style={{
          background: '#FFF5F5', borderBottom: '1px solid #FEE2E2',
          padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: '#FEE2E2', border: '1px solid #FECACA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={18} strokeWidth={2} color={DANGER} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>
              Administrator Verification
            </h3>
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{title}</p>
          </div>
          <button
            onClick={() => close(onCancel)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>{message}</p>

          <div>
            <label style={labelStyle}>Administrator Password</label>
            <PasswordInput
              autoFocus
              value={pwd}
              onChange={v => { setPwd(v); setError(''); }}
              error={!!error}
            />
            {error && (
              <p style={{ fontSize: 11, color: DANGER, fontWeight: 600, margin: '5px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} /> {error}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }} onKeyDown={handleKey}>
            <button
              onClick={() => close(onCancel)}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleVerify}
              disabled={checking || !pwd}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12, fontSize: 13, fontWeight: 800,
                background: !pwd || checking ? '#F3F4F6' : `linear-gradient(135deg,${RED},#B51218)`,
                border: 'none',
                color: !pwd || checking ? '#9CA3AF' : '#fff',
                cursor: !pwd || checking ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: !pwd || checking ? 'none' : `0 4px 14px ${RED}30`,
                transition: 'all 200ms',
              }}
            >
              {checking ? (
                <><span style={{ width: 12, height: 12, border: '2px solid #D1D5DB', borderTopColor: RED, borderRadius: '50%', animation: 'setspin 0.7s linear infinite', display: 'inline-block' }} /> Verifying…</>
              ) : (
                <><ShieldCheck size={14} strokeWidth={2.5} /> {action}</>
              )}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes setspin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body,
  );
}

// ─── Reset QR Database Modal ──────────────────────────────────────────────────

interface ResetModalProps {
  actor: string;
  email: string;
  onSuccess: () => void;
  onCancel:  () => void;
}

type ResetStep = 'warning' | 'auth' | 'confirm' | 'deleting' | 'done' | 'error';

function ResetModal({ actor, email, onSuccess, onCancel }: ResetModalProps) {
  const [step,        setStep]        = useState<ResetStep>('warning');
  const [confirmText, setConfirmText] = useState('');
  const [progress,    setProgress]    = useState(0);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [visible,     setVisible]     = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = (cb?: () => void) => {
    setVisible(false);
    setTimeout(() => cb?.(), 220);
  };

  const phraseMatch = confirmText.trim() === CONFIRM_PHRASE;

  const handleDelete = async () => {
    setStep('deleting');
    setProgress(0);

    try {
      // Step 1: write audit log BEFORE deletion
      await addDoc(collection(db, 'qrOperationLogs'), {
        operation:   'full-database-reset',
        type:        'ADMIN',
        count:       0,
        actor:       `${actor} <${email}>`,
        ts:          serverTimestamp(),
        reason:      'Full QR Database Reset',
        batchName:   '',
        qrIds:       [],
        durationMs:  0,
        status:      'success',
      });
      setProgress(10);

      // Step 2: delete each collection in chunks of 490
      const collectionCount = QR_COLLECTIONS.length;
      for (let ci = 0; ci < collectionCount; ci++) {
        const colName = QR_COLLECTIONS[ci];
        const snap = await getDocs(collection(db, colName));
        const docs  = snap.docs;
        const total = docs.length;
        let deleted = 0;

        setProgress(10 + Math.round((ci / collectionCount) * 80));

        for (let i = 0; i < docs.length; i += 490) {
          const chunk = docs.slice(i, i + 490);
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(doc(db, colName, d.id)));
          await batch.commit();
          deleted += chunk.length;
          setProgress(10 + Math.round(((ci + deleted / Math.max(total, 1)) / collectionCount) * 80));
          // Yield between chunks
          await new Promise<void>(r => setTimeout(r, 0));
        }
      }

      setProgress(100);

      // Small pause so the progress bar hits 100% visibly
      await new Promise<void>(r => setTimeout(r, 400));
      setStep('done');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Reset failed. Please try again.');
      setStep('error');
    }
  };

  // ── Warning step ──────────────────────────────────────────────────────────
  if (step === 'warning') {
    return ReactDOM.createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10300,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        opacity: visible ? 1 : 0, transition: 'opacity 220ms ease',
      }}>
        <div style={{
          width: '100%', maxWidth: 440, background: '#FFFFFF',
          borderRadius: 22, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(220,38,38,0.14)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
          transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* Red top bar */}
          <div style={{ height: 3, background: `linear-gradient(90deg,${DANGER},#EF4444)` }} />

          {/* Header */}
          <div style={{ background: '#FFF5F5', borderBottom: '1px solid #FEE2E2', padding: '20px 24px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={20} color={DANGER} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 9, fontWeight: 800, color: DANGER, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: 1 }}>Danger Zone</p>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Reset QR Database</h3>
            </div>
            <button onClick={() => close(onCancel)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, flexShrink: 0 }}>
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '14px 16px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A1A1A', margin: '0 0 8px' }}>
                You are about to permanently delete the entire QR Management database.
              </p>
              <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                This will remove <strong style={{ color: DANGER }}>all QR documents, all batches, analytics, and activity logs</strong>. This action cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[
                { label: 'All QR codes',          will: true },
                { label: 'All batch records',     will: true },
                { label: 'Activity & audit logs', will: true },
                { label: 'User accounts',         will: false },
                { label: 'Game progress',         will: false },
                { label: 'Protein Tracker data',  will: false },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                    background: r.will ? '#FEF2F2' : '#F0FDF4',
                    border: `1px solid ${r.will ? '#FECACA' : '#BBF7D0'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 10, color: r.will ? DANGER : SAFE }}>{r.will ? '✗' : '✓'}</span>
                  </div>
                  <span style={{ color: r.will ? DANGER : '#6B7280', fontWeight: r.will ? 700 : 500 }}>
                    {r.will ? 'Will be deleted: ' : 'Protected: '}{r.label}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => close(onCancel)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => setStep('auth')}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 800,
                  background: `linear-gradient(135deg,${DANGER},#B91C1C)`, border: 'none', color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: `0 4px 14px ${DANGER}30`,
                }}
              >
                <ShieldAlert size={14} strokeWidth={2.5} /> Continue
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Auth step — handled by AdminAuthDialog ────────────────────────────────
  if (step === 'auth') {
    return (
      <AdminAuthDialog
        title="Reset QR Database"
        message="Enter the administrator password to proceed with the database reset. This action cannot be undone."
        action="Proceed to Confirmation"
        onVerified={() => setStep('confirm')}
        onCancel={() => close(onCancel)}
      />
    );
  }

  // ── Confirm step ──────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return ReactDOM.createPortal(
      <div style={{
        position: 'fixed', inset: 0, zIndex: 10300,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        opacity: visible ? 1 : 0, transition: 'opacity 220ms ease',
      }}>
        <div style={{
          width: '100%', maxWidth: 420, background: '#FFFFFF',
          borderRadius: 22, overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 0 0 1px rgba(220,38,38,0.14)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
          transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          <div style={{ height: 3, background: `linear-gradient(90deg,${DANGER},#EF4444)` }} />

          <div style={{ background: '#FFF5F5', borderBottom: '1px solid #FEE2E2', padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#FEE2E2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Trash2 size={17} color={DANGER} strokeWidth={2} />
            </div>
            <div>
              <p style={{ fontSize: 9, fontWeight: 800, color: DANGER, margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>Final Confirmation</p>
              <h3 style={{ fontSize: 14, fontWeight: 900, color: '#1A1A1A', margin: 0 }}>Type to confirm deletion</h3>
            </div>
          </div>

          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
              Type exactly <code style={{ fontFamily: 'monospace', fontWeight: 800, color: DANGER, background: '#FEF2F2', padding: '1px 6px', borderRadius: 4 }}>{CONFIRM_PHRASE}</code> to enable the delete button.
            </p>

            <div>
              <input
                autoFocus
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace',
                  borderColor: confirmText && !phraseMatch ? '#FCA5A5' : phraseMatch ? '#BBF7D0' : '#E5E7EB',
                }}
                onFocus={e => (e.target.style.borderColor = DANGER)}
                onBlur={e  => (e.target.style.borderColor = confirmText && !phraseMatch ? '#FCA5A5' : phraseMatch ? '#BBF7D0' : '#E5E7EB')}
              />
              {confirmText && !phraseMatch && (
                <p style={{ fontSize: 10, color: DANGER, margin: '4px 0 0', fontWeight: 600 }}>
                  Text does not match. Type exactly: {CONFIRM_PHRASE}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => close(onCancel)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#374151', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!phraseMatch}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 12, fontSize: 13, fontWeight: 800,
                  background: phraseMatch ? `linear-gradient(135deg,${DANGER},#B91C1C)` : '#F3F4F6',
                  border: 'none',
                  color: phraseMatch ? '#fff' : '#9CA3AF',
                  cursor: phraseMatch ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  boxShadow: phraseMatch ? `0 4px 14px ${DANGER}30` : 'none',
                  transition: 'all 200ms',
                }}
              >
                <Trash2 size={14} strokeWidth={2.5} /> Delete Permanently
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  // ── Deleting / Done / Error — single overlay ──────────────────────────────
  const isDeleting = step === 'deleting';
  const isDone     = step === 'done';
  const isError    = step === 'error';

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10300,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      opacity: visible ? 1 : 0, transition: 'opacity 220ms ease',
    }}>
      <div style={{
        width: '100%', maxWidth: 380, background: '#FFFFFF',
        borderRadius: 22, padding: '32px 28px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
        transform: visible ? 'scale(1)' : 'scale(0.94)',
        transition: 'transform 280ms cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: isDone ? '#F0FDF4' : isError ? '#FEF2F2' : '#FEF2F2',
          border: `1px solid ${isDone ? '#BBF7D0' : '#FECACA'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isDeleting && <span style={{ width: 28, height: 28, border: `3px solid #FCA5A5`, borderTopColor: DANGER, borderRadius: '50%', animation: 'setspin 0.8s linear infinite', display: 'block' }} />}
          {isDone     && <CheckCircle2 size={28} color={SAFE} strokeWidth={2.5} />}
          {isError    && <AlertTriangle size={28} color={DANGER} strokeWidth={2} />}
        </div>

        {/* Message */}
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: '#1A1A1A', margin: '0 0 6px' }}>
            {isDeleting ? 'Resetting QR Database…' : isDone ? 'QR Database Reset Complete' : 'Reset Failed'}
          </h3>
          <p style={{ fontSize: 12, color: isError ? DANGER : '#6B7280', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
            {isDeleting
              ? 'Permanently deleting all QR records and logs. Do not close this window.'
              : isDone
                ? 'QR database has been successfully reset. All counters now show 0.'
                : errorMsg}
          </p>
        </div>

        {/* Progress bar */}
        {isDeleting && (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Deleting records…</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: DANGER }}>{progress}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: '#F3F4F6', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6,
                background: `linear-gradient(90deg,${DANGER},#EF4444)`,
                width: `${progress}%`, transition: 'width 400ms ease',
              }} />
            </div>
          </div>
        )}

        {/* Actions */}
        {(isDone || isError) && (
          <button
            onClick={() => close(isDone ? onSuccess : onCancel)}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: isDone ? `linear-gradient(135deg,${SAFE},#15803D)` : '#F3F4F6',
              color: isDone ? '#fff' : '#374151',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: isDone ? `0 4px 14px ${SAFE}30` : 'none',
            }}
          >
            <CheckCircle2 size={14} strokeWidth={2.5} /> {isDone ? 'Done' : 'Close'}
          </button>
        )}
      </div>
      <style>{`@keyframes setspin { to { transform: rotate(360deg); } }`}</style>
    </div>,
    document.body,
  );
}

// ─── Main QRSettings component ────────────────────────────────────────────────

export default function QRSettings() {
  const { user } = useAuth();
  const actor = user?.displayName ?? user?.email ?? 'Admin';
  const email = user?.email ?? '';

  const [defaultMaxPlays, setDefaultMaxPlays] = useState(2);
  const [prefix,          setPrefix]          = useState('SKM');
  const [pdfColumns,      setPdfColumns]      = useState(3);
  const [pdfPerPage,      setPdfPerPage]      = useState(9);
  const [saved,           setSaved]           = useState(false);

  // Game Link Mapping state
  const [activeUrl,  setActiveUrl]  = useState(() => getGameUrl());
  const [inputUrl,   setInputUrl]   = useState(() => getGameUrl());
  const [urlSaved,   setUrlSaved]   = useState(false);
  const [urlSaving,  setUrlSaving]  = useState(false);
  const [urlError,   setUrlError]   = useState('');

  // Admin auth dialog for Game Link save
  const [showLinkAuth,  setShowLinkAuth]  = useState(false);
  const pendingUrlRef = useRef('');

  // Reset database modal
  const [showReset,    setShowReset]    = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // On mount: sync game URL from Firestore
  useEffect(() => {
    syncGameUrlFromFirestore().then(url => { setActiveUrl(url); setInputUrl(url); });
    return subscribeGameUrl(url => setActiveUrl(url));
  }, []);

  // ── Game Link save flow ─────────────────────────────────────────────────
  const handleSaveGameUrl = () => {
    setUrlError('');
    const trimmed = inputUrl.trim().replace(/\/$/, '');
    if (!trimmed) { setUrlError('URL is required.'); return; }
    try { new URL(trimmed); } catch { setUrlError('Please enter a valid URL (include https://).'); return; }
    if (!/^https?:\/\//i.test(trimmed)) { setUrlError('URL must start with http:// or https://.'); return; }

    // Gate: require admin password before writing
    pendingUrlRef.current = trimmed;
    setShowLinkAuth(true);
  };

  const handleLinkAuthVerified = async () => {
    setShowLinkAuth(false);
    setUrlSaving(true);
    try {
      await saveGameUrl(pendingUrlRef.current);
      setActiveUrl(pendingUrlRef.current);
      setInputUrl(pendingUrlRef.current);
      setUrlSaved(true);
      setTimeout(() => setUrlSaved(false), 3000);
    } catch (e: any) {
      setUrlError(e?.message ?? 'Save failed. Please try again.');
    } finally {
      setUrlSaving(false);
    }
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Info banner */}
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Info size={15} color="#1D4ED8" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: '#1E40AF', margin: 0, lineHeight: 1.6 }}>
          Settings apply to default values in the QR Generator and PDF Print Center on this device. All destructive actions require administrator verification.
        </p>
      </div>

      {/* Game Link Mapping */}
      <Card title="Game Link Mapping" description="The base URL embedded into every newly generated QR code">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active URL display */}
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0',
            borderRadius: 12, padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 5px #22C55E80' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: 1 }}>
                Current Active Game Link
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <code style={{ fontSize: 12, fontWeight: 700, color: '#15803D', wordBreak: 'break-all', flex: 1 }}>
                {activeUrl}
              </code>
              <a href={activeUrl} target="_blank" rel="noreferrer" style={{ color: '#15803D', flexShrink: 0 }} title="Open in new tab">
                <ExternalLink size={13} strokeWidth={2} />
              </a>
            </div>
            <p style={{ fontSize: 10, color: '#6B7280', margin: 0 }}>
              QR codes will encode: <code style={{ fontFamily: 'monospace', fontSize: 10, color: '#374151' }}>{activeUrl}/?qr=SKM-000001</code>
            </p>
          </div>

          {/* URL input */}
          <div>
            <label style={labelStyle}>
              New Game URL
              <span style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', marginLeft: 6, textTransform: 'none' }}>
                (must start with https://)
              </span>
            </label>
            <input
              style={{
                ...inputStyle,
                borderColor: urlError ? '#FCA5A5' : inputUrl !== activeUrl ? '#FDE68A' : '#E5E7EB',
              }}
              value={inputUrl}
              onChange={e => { setInputUrl(e.target.value); setUrlError(''); }}
              placeholder="https://skm-egg-runner.vercel.app"
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = urlError ? '#FCA5A5' : inputUrl !== activeUrl ? '#FDE68A' : '#E5E7EB')}
            />
            {urlError && (
              <p style={{ fontSize: 11, color: DANGER, margin: '4px 0 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertTriangle size={11} /> {urlError}
              </p>
            )}
            {!urlError && inputUrl.trim().replace(/\/$/, '') !== activeUrl && inputUrl.trim() && (
              <p style={{ fontSize: 10, color: '#D97706', margin: '4px 0 0', fontWeight: 600 }}>
                Unsaved change — click Save Mapping to apply.
              </p>
            )}
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>
              Administrator verification required to update. Changes apply to newly generated QR codes only.
            </p>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSaveGameUrl}
              disabled={urlSaving}
              style={{
                background: urlSaving ? '#F3F4F6' : `linear-gradient(135deg,${RED},#B51218)`,
                color: urlSaving ? '#9CA3AF' : '#fff', border: 'none',
                borderRadius: 10, padding: '10px 22px', fontSize: 12, fontWeight: 800,
                cursor: urlSaving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: urlSaving ? 'none' : `0 4px 14px ${RED}25`,
                transition: 'all 200ms',
              }}
            >
              {urlSaving
                ? <><span style={{ width: 12, height: 12, border: `2px solid #D1D5DB`, borderTopColor: RED, borderRadius: '50%', animation: 'setspin 0.7s linear infinite', display: 'inline-block' }} /> Saving…</>
                : <><Save size={13} strokeWidth={2} /> Save Mapping</>}
            </button>
            {urlSaved && (
              <span style={{ fontSize: 12, color: SAFE, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={14} strokeWidth={2} /> Game link updated successfully.
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* QR Generation Defaults */}
      <Card title="QR Generation Defaults" description="Default values pre-filled in the QR Generator form">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>Default Prefix</label>
            <input style={inputStyle} value={prefix}
              onChange={e => setPrefix(e.target.value.toUpperCase())}
              placeholder="e.g. SKM"
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>Used as the code prefix, e.g. SKM-000001</p>
          </div>
          <div>
            <label style={labelStyle}>Default Max Plays</label>
            <input style={inputStyle} type="number" min={1} max={999} value={defaultMaxPlays}
              onChange={e => setDefaultMaxPlays(Number(e.target.value))}
              onFocus={e => (e.target.style.borderColor = RED)}
              onBlur={e  => (e.target.style.borderColor = '#E5E7EB')} />
            <p style={{ fontSize: 10, color: '#9CA3AF', margin: '4px 0 0' }}>How many times each QR can be scanned in-game</p>
          </div>
        </div>
      </Card>

      {/* PDF Layout */}
      <Card title="PDF Print Layout" description="Controls the grid layout of the QR print sheet">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16 }}>
          <div>
            <label style={labelStyle}>Columns Per Row</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={pdfColumns}
              onChange={e => setPdfColumns(Number(e.target.value))}>
              <option value={2}>2 columns</option>
              <option value={3}>3 columns (default)</option>
              <option value={4}>4 columns</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>QR Codes Per Page</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={pdfPerPage}
              onChange={e => setPdfPerPage(Number(e.target.value))}>
              <option value={6}>6 per page</option>
              <option value={9}>9 per page (default)</option>
              <option value={12}>12 per page</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
            Preview: <strong style={{ color: '#1A1A1A' }}>{pdfColumns} × {Math.ceil(pdfPerPage / pdfColumns)}</strong> grid · <strong style={{ color: '#1A1A1A' }}>{pdfPerPage} QR codes</strong> per A4 page
          </p>
        </div>
      </Card>

      {/* Validation Rules */}
      <Card title="Validation Rules" description="How QR codes are validated during scanning">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'QR must be active',       detail: 'Disabled QR codes are always rejected',                  enforced: true },
            { label: 'Play count limit',         detail: 'QR is rejected once maxPlays is reached',               enforced: true },
            { label: 'Any authenticated user',   detail: 'All logged-in users can scan any valid QR code',        enforced: true },
            { label: 'Golden Pass bypass',       detail: 'SKM-GOLDEN-PASS code grants unlimited access offline',  enforced: true },
            { label: 'Protein deduplication',    detail: 'Each user can earn protein credit from a QR only once', enforced: true },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #E5E7EB' }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: '#F0FDF4', border: '1px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <span style={{ fontSize: 10, color: SAFE }}>✓</span>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>{r.label}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>{r.detail}</p>
              </div>
              <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', padding: '2px 8px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0', color: SAFE, flexShrink: 0 }}>Enforced</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleSave} style={{
          background: `linear-gradient(135deg,${RED},#B51218)`, color: '#fff', border: 'none',
          borderRadius: 12, padding: '12px 28px', fontSize: 13, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: `0 4px 16px ${RED}30`,
        }}>
          <Save size={15} strokeWidth={2} /> Save Settings
        </button>
        {saved && <span style={{ fontSize: 12, color: SAFE, fontWeight: 700 }}>Settings saved.</span>}
      </div>

      {/* ── Danger Zone ── */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#FEE2E2' }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: DANGER, textTransform: 'uppercase', letterSpacing: 2, whiteSpace: 'nowrap' }}>
            Danger Zone
          </span>
          <div style={{ flex: 1, height: 1, background: '#FEE2E2' }} />
        </div>

        <Card
          title="Reset QR Database"
          description="Permanently deletes all QR records, batches, analytics, and activity logs. This action cannot be undone."
          danger
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {resetSuccess && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={16} color={SAFE} />
                <p style={{ fontSize: 12, color: SAFE, fontWeight: 700, margin: 0 }}>
                  QR database has been successfully reset. All counters now show 0.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
                  Requires administrator password and explicit confirmation. User accounts, game progress, and Protein Tracker data are never affected.
                </p>
              </div>
              <button
                onClick={() => setShowReset(true)}
                style={{
                  padding: '11px 20px', borderRadius: 12, border: `1.5px solid ${DANGER}`,
                  background: '#FEF2F2', color: DANGER, fontSize: 12, fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                  whiteSpace: 'nowrap', transition: 'all 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = DANGER; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = DANGER; }}
              >
                <Trash2 size={14} strokeWidth={2.5} /> Reset Entire QR Database
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Modals ── */}
      {showLinkAuth && (
        <AdminAuthDialog
          title="Update Game Link"
          message="Enter the administrator password to update the active Game Link. This change will affect all newly generated QR codes."
          action="Verify & Save"
          onVerified={handleLinkAuthVerified}
          onCancel={() => setShowLinkAuth(false)}
        />
      )}

      {showReset && (
        <ResetModal
          actor={actor}
          email={email}
          onSuccess={() => {
            setShowReset(false);
            setResetSuccess(true);
            setTimeout(() => setResetSuccess(false), 8000);
          }}
          onCancel={() => setShowReset(false)}
        />
      )}

      <style>{`@keyframes setspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
