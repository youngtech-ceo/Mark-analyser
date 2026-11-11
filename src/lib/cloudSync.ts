import {
  onValue,
  ref,
  set,
  get,
  type Unsubscribe,
} from 'firebase/database';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth, db, googleProvider } from './firebase';
import { DEFAULT_SETTINGS, generateVaultKey } from './defaults';
import type { AppSettings, Exam, UserMarkStore } from '../types/marks';

const STORAGE_STORE_KEY = 'markpulse_store_v1';
const STORAGE_VAULT_KEY = 'markpulse_vault_key_v1';
const STORAGE_MODE_KEY = 'markpulse_sync_mode_v1';

export function sanitizeVaultKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function getInitialVaultKey(): string {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlVault = urlParams.get('vault');
    if (urlVault) {
      const cleaned = sanitizeVaultKey(urlVault);
      if (cleaned.length >= 4) {
        localStorage.setItem(STORAGE_VAULT_KEY, cleaned);
        return cleaned;
      }
    }
    const stored = localStorage.getItem(STORAGE_VAULT_KEY);
    if (stored) {
      const cleaned = sanitizeVaultKey(stored);
      if (cleaned.length >= 4) return cleaned;
    }
  }
  const fresh = generateVaultKey();
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_VAULT_KEY, fresh);
  }
  return fresh;
}

export function persistVaultKey(key: string): string {
  const cleaned = sanitizeVaultKey(key);
  if (typeof window !== 'undefined' && cleaned) {
    localStorage.setItem(STORAGE_VAULT_KEY, cleaned);
  }
  return cleaned;
}

export function getStoredSyncMode(): 'vault' | 'account' {
  if (typeof window === 'undefined') return 'vault';
  return localStorage.getItem(STORAGE_MODE_KEY) === 'account' ? 'account' : 'vault';
}

export function persistSyncMode(mode: 'vault' | 'account'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  }
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function normalizeArray<T>(val: unknown): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean) as T[];
  if (typeof val === 'object') {
    return Object.values(val as Record<string, T>).filter(Boolean);
  }
  return [];
}

export function normalizeStore(raw: unknown): UserMarkStore {
  if (!raw || typeof raw !== 'object') {
    return {
      exams: [],
      settings: { ...DEFAULT_SETTINGS },
      updatedAt: 0,
    };
  }
  const obj = raw as Record<string, unknown>;
  const rawExams = normalizeArray<Record<string, unknown>>(obj.exams);
  const exams: Exam[] = rawExams.map((ex) => {
    const subjectsRaw = normalizeArray<Record<string, unknown>>(ex.subjects);
    return {
      id: String(ex.id ?? ''),
      name: String(ex.name ?? 'Untitled Exam'),
      date: String(ex.date ?? new Date().toISOString().slice(0, 10)),
      category: String(ex.category ?? 'Exam'),
      defaultTotalMarks: Number(ex.defaultTotalMarks) || 100,
      ...(typeof ex.notes === 'string' && ex.notes ? { notes: ex.notes } : {}),
      ...(ex.isSample ? { isSample: true } : {}),
      createdAt: Number(ex.createdAt) || Date.now(),
      updatedAt: Number(ex.updatedAt) || Date.now(),
      subjects: subjectsRaw.map((sub) => ({
        id: String(sub.id ?? ''),
        name: String(sub.name ?? 'Subject'),
        scoredMarks: Number(sub.scoredMarks) || 0,
        totalMarks: Math.max(1, Number(sub.totalMarks) || 100),
        ...(typeof sub.notes === 'string' && sub.notes ? { notes: sub.notes } : {}),
      })),
    };
  });

  const rawSettings =
    obj.settings && typeof obj.settings === 'object'
      ? (obj.settings as Partial<AppSettings>)
      : {};
  const gradeScale = normalizeArray(rawSettings.gradeScale);

  const settings: AppSettings = {
    targetPercentage:
      typeof rawSettings.targetPercentage === 'number'
        ? rawSettings.targetPercentage
        : DEFAULT_SETTINGS.targetPercentage,
    passingPercentage:
      typeof rawSettings.passingPercentage === 'number'
        ? rawSettings.passingPercentage
        : DEFAULT_SETTINGS.passingPercentage,
    theme: rawSettings.theme === 'dark' ? 'dark' : 'light',
    gradeScale:
      gradeScale.length > 0
        ? (gradeScale as AppSettings['gradeScale'])
        : DEFAULT_SETTINGS.gradeScale,
  };

  return {
    exams,
    settings,
    updatedAt: Number(obj.updatedAt) || 0,
  };
}

export function loadLocalStore(): UserMarkStore {
  if (typeof window === 'undefined') {
    return { exams: [], settings: { ...DEFAULT_SETTINGS }, updatedAt: 0 };
  }
  try {
    const raw = localStorage.getItem(STORAGE_STORE_KEY);
    if (!raw) {
      return { exams: [], settings: { ...DEFAULT_SETTINGS }, updatedAt: 0 };
    }
    return normalizeStore(JSON.parse(raw));
  } catch {
    return { exams: [], settings: { ...DEFAULT_SETTINGS }, updatedAt: 0 };
  }
}

export function saveLocalStore(store: UserMarkStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_STORE_KEY, JSON.stringify(stripUndefined(store)));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function getCloudPath(params: {
  mode: 'vault' | 'account';
  vaultKey: string;
  userId: string | null;
}): string {
  if (params.mode === 'account' && params.userId) {
    return `markAnalyser/users/${params.userId}`;
  }
  const safeKey = sanitizeVaultKey(params.vaultKey) || 'DEFAULT-VAULT';
  return `markAnalyser/vaults/${safeKey}`;
}

export function mergeStores(local: UserMarkStore, remote: UserMarkStore): UserMarkStore {
  const byId = new Map<string, Exam>();
  for (const ex of remote.exams) {
    if (ex.id) byId.set(ex.id, ex);
  }
  for (const ex of local.exams) {
    if (!ex.id) continue;
    const existing = byId.get(ex.id);
    if (!existing || (ex.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
      byId.set(ex.id, ex);
    }
  }
  const mergedExams = Array.from(byId.values());
  const useLocalSettings = local.updatedAt > remote.updatedAt;
  return {
    exams: mergedExams,
    settings: useLocalSettings ? local.settings : remote.settings,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt, Date.now()),
  };
}

export async function writeCloudStore(path: string, store: UserMarkStore): Promise<void> {
  const payload = stripUndefined({
    exams: store.exams,
    settings: store.settings,
    updatedAt: store.updatedAt,
  });
  await set(ref(db, path), payload);
}

export async function fetchCloudStoreOnce(path: string): Promise<UserMarkStore | null> {
  const snap = await get(ref(db, path));
  if (!snap.exists()) return null;
  return normalizeStore(snap.val());
}

export function subscribeToCloudStore(
  path: string,
  onData: (store: UserMarkStore | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const targetRef = ref(db, path);
  return onValue(
    targetRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
      } else {
        onData(normalizeStore(snapshot.val()));
      }
    },
    (error) => {
      onError(error);
    }
  );
}

export function subscribeToRtdbConnection(onConnected: (connected: boolean) => void): Unsubscribe {
  const connRef = ref(db, '.info/connected');
  return onValue(connRef, (snap) => {
    onConnected(Boolean(snap.val()));
  });
}

export function subscribeToAuth(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

export async function signInEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signUpEmail(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export function isPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  const code = String((err as { code?: string }).code ?? '').toLowerCase();
  return msg.includes('permission_denied') || msg.includes('permission denied') || code.includes('permission-denied');
}

export function formatFirebaseError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Unexpected cloud error occurred.';
  const code = String((err as { code?: string }).code ?? '');
  const message = String((err as { message?: string }).message ?? '');
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'auth/weak-password') {
    return 'Password should be at least 6 characters.';
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return 'This sign-in method is not enabled in your Firebase Authentication console yet. You can enable it there, or use Cloud Vault Key sync right now.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in popup was closed before completing.';
  }
  if (isPermissionError(err)) {
    return 'Firebase Realtime Database rules blocked read/write access for this path.';
  }
  return message || 'Cloud sync failed.';
}

export const RECOMMENDED_RTDB_RULES = `{
  "rules": {
    "markAnalyser": {
      "vaults": {
        "$vaultId": {
          ".read": true,
          ".write": true
        }
      },
      "users": {
        "$uid": {
          ".read": "auth != null && auth.uid == $uid",
          ".write": "auth != null && auth.uid == $uid"
        }
      }
    }
  }
}`;

