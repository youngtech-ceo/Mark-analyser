import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Cloud,
  Copy,
  Download,
  KeyRound,
  Link2,
  LogOut,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import type { CloudConnectionInfo, Exam } from '../types/marks';
import {
  formatFirebaseError,
  RECOMMENDED_RTDB_RULES,
  sanitizeVaultKey,
  signInEmail,
  signInWithGoogle,
  signOutAccount,
  signUpEmail,
} from '../lib/cloudSync';
import { generateVaultKey } from '../lib/defaults';
import { exportExamsToCSV, sanitizeImportedExams } from '../lib/analytics';

interface CloudModalProps {
  isOpen: boolean;
  cloud: CloudConnectionInfo;
  exams: Exam[];
  onClose: () => void;
  onSwitchVault: (vaultKey: string) => void;
  onUseVaultMode: () => void;
  onUseAccountMode: () => void;
  onRetrySync: () => void;
  onImportExams: (exams: Exam[], mode: 'merge' | 'replace') => void;
  onLoadSample: () => void;
  onClearAll: () => void;
}

export function CloudModal({
  isOpen,
  cloud,
  exams,
  onClose,
  onSwitchVault,
  onUseVaultMode,
  onUseAccountMode,
  onRetrySync,
  onImportExams,
  onLoadSample,
  onClearAll,
}: CloudModalProps) {
  const [activeTab, setActiveTab] = useState<'vault' | 'account' | 'backup'>(
    cloud.mode === 'account' ? 'account' : 'vault'
  );
  const [vaultInput, setVaultInput] = useState(cloud.vaultKey);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  // Account auth states
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Backup import state
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setVaultInput(cloud.vaultKey);
    setAuthError(null);
    setImportMsg(null);
    setConfirmClear(false);
  }, [isOpen, cloud.vaultKey]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?vault=${encodeURIComponent(
          cloud.vaultKey
        )}`
      : `?vault=${cloud.vaultKey}`;

  const copyText = async (text: string, which: 'key' | 'link' | 'rules') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'key') {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 1800);
      } else if (which === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
      } else {
        setCopiedRules(true);
        setTimeout(() => setCopiedRules(false), 1800);
      }
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleVaultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeVaultKey(vaultInput);
    if (cleaned.length < 4) return;
    onSwitchVault(cleaned);
    onUseVaultMode();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (authMode === 'signin') {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password);
      }
      onUseAccountMode();
      setEmail('');
      setPassword('');
    } catch (err) {
      setAuthError(formatFirebaseError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithGoogle();
      onUseAccountMode();
    } catch (err) {
      setAuthError(formatFirebaseError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOutAccount();
      onUseVaultMode();
    } finally {
      setAuthBusy(false);
    }
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const rawList = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.exams)
          ? parsed.exams
          : null;
        if (!rawList) {
          throw new Error('Expected a JSON array of exams or backup object.');
        }
        const sanitized = sanitizeImportedExams(rawList);
        onImportExams(sanitized, 'merge');
        setImportMsg(`Imported ${sanitized.length} exam(s) cleanly.`);
      } catch (err) {
        setImportMsg(
          err instanceof Error ? err.message : 'Failed to parse JSON file.'
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Cloud Storage &amp; Anywhere Access
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Firebase Realtime Database · Project <span className="font-mono-num">yt-web-58043</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Banner */}
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  cloud.status === 'synced'
                    ? 'bg-emerald-500'
                    : cloud.status === 'syncing' || cloud.status === 'connecting'
                    ? 'bg-indigo-500 animate-pulse'
                    : cloud.status === 'permission-denied'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {cloud.status === 'synced' && 'Synced live to Firebase Cloud'}
                {cloud.status === 'syncing' && 'Saving changes to cloud...'}
                {cloud.status === 'connecting' && 'Connecting to Firebase RTDB...'}
                {cloud.status === 'offline' && 'Offline — saved locally, syncs on reconnect'}
                {cloud.status === 'permission-denied' &&
                  'Cloud Rules Need One-Time Setup in Firebase Console'}
                {cloud.status === 'error' && (cloud.errorMessage || 'Sync error')}
              </span>
            </div>

            {cloud.lastSyncedAt && (
              <span className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                Last sync: {new Date(cloud.lastSyncedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-5 pt-2 dark:border-slate-800">
          {[
            { id: 'vault', label: 'Cloud Vault Key', icon: KeyRound },
            { id: 'account', label: 'Firebase Account', icon: User },
            { id: 'backup', label: 'Export & Backup', icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Permission Denied Troubleshooting Box */}
          {cloud.status === 'permission-denied' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-2 flex-1">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Firebase Realtime Database blocked access (PERMISSION_DENIED)
                  </p>
                  <p className="text-amber-800 dark:text-amber-300">
                    Your data is safe locally! To enable cloud sync across devices, open your Firebase Console →{' '}
                    <strong>Realtime Database → Rules</strong> and paste these rules (or sign in under the Firebase Account tab if you only allow authenticated users):
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono-num text-[11px] text-emerald-300">
                    {RECOMMENDED_RTDB_RULES}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(RECOMMENDED_RTDB_RULES, 'rules')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                    >
                      {copiedRules ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedRules ? 'Copied Rules!' : 'Copy RTDB Rules'}
                    </button>
                    <button
                      type="button"
                      onClick={onRetrySync}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry Cloud Sync
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Your Active Cloud Vault Key
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-lg font-extrabold font-mono-num tracking-wide text-indigo-600 dark:text-indigo-400">
                        {cloud.vaultKey}
                      </span>
                      {cloud.mode === 'vault' && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                          Active Mode
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(cloud.vaultKey, 'key')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedKey ? 'Copied!' : 'Copy Key'}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText(shareUrl, 'link')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                    >
                      {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                      {copiedLink ? 'Link Copied!' : 'Copy Sync Link'}
                    </button>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-400">
                  Save this key or bookmark the Sync Link. Open MarkPulse on your phone, tablet, or any browser with the same Vault Key to view and edit your marks live anywhere.
                </p>
              </div>

              <form onSubmit={handleVaultSubmit} className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Switch to or Create a Custom Vault Key
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={vaultInput}
                    onChange={(e) => setVaultInput(e.target.value)}
                    placeholder="e.g., RITHISH-MARKS-2026"
                    className="flex-1 min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono-num uppercase text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setVaultInput(generateVaultKey())}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Generate New
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 cursor-pointer"
                  >
                    Connect Vault
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tip: Choose a unique, private passphrase (minimum 4 characters, letters/numbers/hyphens).
                </p>
              </form>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-4">
              {cloud.userId ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        Signed In via Firebase Auth
                      </span>
                      <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {cloud.userEmail || cloud.userId}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cloud.mode !== 'account' && (
                        <button
                          type="button"
                          onClick={onUseAccountMode}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
                        >
                          Sync to Account
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={authBusy}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {authError && (
                    <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleEmailAuth} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {authMode === 'signin'
                          ? 'Sign In to Personal Account'
                          : 'Create Personal Account'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                          setAuthError(null);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
                      >
                        {authMode === 'signin'
                          ? 'Need an account? Sign up'
                          : 'Already have an account? Sign in'}
                      </button>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password (min 6 chars)"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="submit"
                        disabled={authBusy}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
                      >
                        {authBusy
                          ? 'Please wait...'
                          : authMode === 'signin'
                          ? 'Sign In with Email'
                          : 'Create Account'}
                      </button>

                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={authBusy}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        Continue with Google
                      </button>
                    </div>
                  </form>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Note: Email/Google sign-in requires those providers to be enabled under Firebase Console → Authentication → Sign-in method. Cloud Vault Key works immediately without setting up Auth providers.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      JSON.stringify({ exams, exportedAt: new Date().toISOString() }, null, 2),
                      `markpulse-backup-${new Date().toISOString().slice(0, 10)}.json`,
                      'application/json'
                    )
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Export Full Backup (JSON)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {exams.length} exams · re-import anytime
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      exportExamsToCSV(exams),
                      `markpulse-marks-${new Date().toISOString().slice(0, 10)}.csv`,
                      'text/csv;charset=utf-8'
                    )
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Export Spreadsheet (CSV)
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Open in Excel or Google Sheets
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Import JSON Backup
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Merges exams into your current cloud workspace
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Upload className="h-3.5 w-3.5" />
                    Choose JSON File
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileImport}
                    className="hidden"
                  />
                </label>
                {importMsg && (
                  <p className="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                    {importMsg}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onLoadSample();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Load Sample Dataset
                </button>

                {confirmClear ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600 font-semibold">
                      Erase all exams?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearAll();
                        setConfirmClear(false);
                        onClose();
                      }}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Yes, Clear All
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All Exams
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

