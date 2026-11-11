import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type {
  AppSettings,
  CloudConnectionInfo,
  CloudStatus,
  Exam,
  ExamSummary,
  UserMarkStore,
} from './types/marks';
import { createId, DEFAULT_SETTINGS } from './lib/defaults';
import { analyzeMarks } from './lib/analytics';
import { buildSampleExams } from './lib/sampleData';
import {
  formatFirebaseError,
  getCloudPath,
  getInitialVaultKey,
  getStoredSyncMode,
  isPermissionError,
  loadLocalStore,
  mergeStores,
  persistSyncMode,
  persistVaultKey,
  saveLocalStore,
  subscribeToAuth,
  subscribeToCloudStore,
  subscribeToRtdbConnection,
  writeCloudStore,
} from './lib/cloudSync';
import { Header, type ActiveTab } from './components/Header';
import { EmptyState } from './components/EmptyState';
import { OverviewTab } from './components/OverviewTab';
import { ExamsTab } from './components/ExamsTab';
import { SubjectsTab } from './components/SubjectsTab';
import { PredictorTab } from './components/PredictorTab';
import { ExamModal } from './components/ExamModal';
import { ExamReportModal } from './components/ExamReportModal';
import { CloudModal } from './components/CloudModal';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [store, setStore] = useState<UserMarkStore>(() => loadLocalStore());
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [focusedSubjectKey, setFocusedSubjectKey] = useState<string | null>(null);

  // Modals
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [inspectingExamId, setInspectingExamId] = useState<string | null>(null);
  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Cloud state
  const [syncMode, setSyncMode] = useState<'vault' | 'account'>(() =>
    getStoredSyncMode()
  );
  const [vaultKey, setVaultKey] = useState<string>(() => getInitialVaultKey());
  const [authUser, setAuthUser] = useState<{
    uid: string;
    email: string | null;
  } | null>(null);
  const [rtdbConnected, setRtdbConnected] = useState<boolean>(true);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('connecting');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [syncEpoch, setSyncEpoch] = useState(0);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const storeRef = useRef<UserMarkStore>(store);
  const pendingLocalWriteRef = useRef<boolean>(false);
  const explicitSwitchRef = useRef<boolean>(false);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  // Apply dark mode class cleanly
  useEffect(() => {
    const isDark = store.settings.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  }, [store.settings.theme]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      if (user) {
        setAuthUser({ uid: user.uid, email: user.email });
      } else {
        setAuthUser(null);
        setSyncMode((prev) => {
          if (prev === 'account') {
            persistSyncMode('vault');
            return 'vault';
          }
          return prev;
        });
      }
    });
    return unsub;
  }, []);

  // Listen to RTDB .info/connected
  useEffect(() => {
    const unsub = subscribeToRtdbConnection((connected) => {
      setRtdbConnected(connected);
    });
    return unsub;
  }, []);

  const effectiveMode =
    syncMode === 'account' && authUser ? 'account' : 'vault';

  const cloudPath = useMemo(
    () =>
      getCloudPath({
        mode: effectiveMode,
        vaultKey,
        userId: authUser?.uid ?? null,
      }),
    [effectiveMode, vaultKey, authUser]
  );

  // Write store locally and push to Firebase RTDB
  const persistAndSync = useCallback(
    async (nextStore: UserMarkStore, silentToast?: string) => {
      setStore(nextStore);
      storeRef.current = nextStore;
      saveLocalStore(nextStore);
      pendingLocalWriteRef.current = true;
      setCloudStatus('syncing');
      setCloudError(null);

      try {
        await writeCloudStore(cloudPath, nextStore);
        pendingLocalWriteRef.current = false;
        setCloudStatus(rtdbConnected ? 'synced' : 'offline');
        setLastSyncedAt(Date.now());
        if (silentToast) showToast(silentToast);
      } catch (err) {
        if (isPermissionError(err)) {
          setCloudStatus('permission-denied');
          setCloudError(formatFirebaseError(err));
        } else if (!rtdbConnected) {
          setCloudStatus('offline');
        } else {
          setCloudStatus('error');
          setCloudError(formatFirebaseError(err));
        }
      }
    },
    [cloudPath, rtdbConnected, showToast]
  );

  // Subscribe to remote RTDB path
  useEffect(() => {
    setCloudStatus('connecting');
    setCloudError(null);

    const unsub = subscribeToCloudStore(
      cloudPath,
      async (remoteStore) => {
        const local = storeRef.current;

        if (!remoteStore) {
          // Remote node does not exist yet
          if (explicitSwitchRef.current) {
            explicitSwitchRef.current = false;
            // New empty vault: reset to clean empty state unless user just created it
            const empty: UserMarkStore = {
              exams: [],
              settings: local.settings,
              updatedAt: Date.now(),
            };
            setStore(empty);
            saveLocalStore(empty);
            setCloudStatus('synced');
            setLastSyncedAt(Date.now());
          } else if (local.exams.length > 0) {
            // Push existing local exams up to initialize cloud path
            try {
              await writeCloudStore(cloudPath, local);
              pendingLocalWriteRef.current = false;
              setCloudStatus('synced');
              setLastSyncedAt(Date.now());
            } catch (err) {
              if (isPermissionError(err)) {
                setCloudStatus('permission-denied');
                setCloudError(formatFirebaseError(err));
              } else {
                setCloudStatus('error');
                setCloudError(formatFirebaseError(err));
              }
            }
          } else {
            setCloudStatus('synced');
            setLastSyncedAt(Date.now());
          }
          return;
        }

        // Remote exists
        if (explicitSwitchRef.current) {
          explicitSwitchRef.current = false;
          setStore(remoteStore);
          saveLocalStore(remoteStore);
          pendingLocalWriteRef.current = false;
          setCloudStatus('synced');
          setLastSyncedAt(Date.now());
          return;
        }

        if (pendingLocalWriteRef.current && local.updatedAt > remoteStore.updatedAt) {
          // Reconcile offline edits with remote
          const merged = mergeStores(local, remoteStore);
          setStore(merged);
          saveLocalStore(merged);
          try {
            await writeCloudStore(cloudPath, merged);
            pendingLocalWriteRef.current = false;
          } catch {
            // Keep pending flag
          }
        } else if (remoteStore.updatedAt >= local.updatedAt || local.exams.length === 0) {
          setStore(remoteStore);
          saveLocalStore(remoteStore);
          pendingLocalWriteRef.current = false;
        }

        setCloudStatus('synced');
        setLastSyncedAt(Date.now());
      },
      (err) => {
        if (isPermissionError(err)) {
          setCloudStatus('permission-denied');
        } else {
          setCloudStatus('error');
        }
        setCloudError(formatFirebaseError(err));
      }
    );

    return unsub;
  }, [cloudPath, syncEpoch]);

  // Analytics computation
  const analytics = useMemo(
    () => analyzeMarks(store.exams, store.settings),
    [store.exams, store.settings]
  );

  const existingSubjectNames = useMemo(
    () => analytics.subjectStats.map((s) => s.displayName),
    [analytics.subjectStats]
  );

  const hasSampleData = useMemo(
    () => store.exams.some((e) => e.isSample),
    [store.exams]
  );

  const inspectingSummary: ExamSummary | null = useMemo(
    () =>
      analytics.examSummaries.find((s) => s.exam.id === inspectingExamId) ??
      null,
    [analytics.examSummaries, inspectingExamId]
  );

  const cloudInfo: CloudConnectionInfo = {
    mode: effectiveMode,
    vaultKey,
    userEmail: authUser?.email ?? null,
    userId: authUser?.uid ?? null,
    status: !rtdbConnected && cloudStatus === 'synced' ? 'offline' : cloudStatus,
    lastSyncedAt,
    errorMessage: cloudError,
  };

  // Exam CRUD actions
  const handleSaveExam = (exam: Exam) => {
    const exists = store.exams.some((e) => e.id === exam.id);
    const nextExams = exists
      ? store.exams.map((e) => (e.id === exam.id ? exam : e))
      : [...store.exams, exam];

    persistAndSync(
      {
        ...store,
        exams: nextExams,
        updatedAt: Date.now(),
      },
      exists ? 'Exam updated & synced' : 'Exam added & synced to cloud'
    );
    setExamModalOpen(false);
    setEditingExam(null);
  };

  const handleDuplicateExam = (exam: Exam) => {
    const now = Date.now();
    const copy: Exam = {
      ...exam,
      id: createId('exam'),
      name: `${exam.name} (Copy)`,
      date: new Date().toISOString().slice(0, 10),
      isSample: false,
      createdAt: now,
      updatedAt: now,
      subjects: exam.subjects.map((s) => ({
        ...s,
        id: createId('sub'),
      })),
    };
    setEditingExam(copy);
    setExamModalOpen(true);
  };

  const handleDeleteExam = (examId: string) => {
    const nextExams = store.exams.filter((e) => e.id !== examId);
    persistAndSync(
      {
        ...store,
        exams: nextExams,
        updatedAt: Date.now(),
      },
      'Exam removed'
    );
  };

  const handleUpdateSettings = (nextSettings: AppSettings) => {
    persistAndSync(
      {
        ...store,
        settings: nextSettings,
        updatedAt: Date.now(),
      },
      'Settings saved'
    );
  };

  const handleToggleTheme = () => {
    const nextTheme = store.settings.theme === 'dark' ? 'light' : 'dark';
    persistAndSync({
      ...store,
      settings: {
        ...store.settings,
        theme: nextTheme,
      },
      updatedAt: Date.now(),
    });
  };

  const handleLoadSample = () => {
    const sample = buildSampleExams();
    const existingIds = new Set(store.exams.map((e) => e.id));
    const merged = [
      ...store.exams,
      ...sample.filter((e) => !existingIds.has(e.id)),
    ];
    persistAndSync(
      {
        ...store,
        exams: merged,
        updatedAt: Date.now(),
      },
      'Sample exams loaded'
    );
  };

  const handleClearSampleData = () => {
    const realOnly = store.exams.filter((e) => !e.isSample);
    persistAndSync(
      {
        ...store,
        exams: realOnly,
        updatedAt: Date.now(),
      },
      'Sample data cleared'
    );
  };

  const handleClearAll = () => {
    persistAndSync(
      {
        ...store,
        exams: [],
        updatedAt: Date.now(),
      },
      'All exams cleared'
    );
  };

  const handleImportExams = (imported: Exam[], mode: 'merge' | 'replace') => {
    let nextExams: Exam[];
    if (mode === 'replace') {
      nextExams = imported;
    } else {
      const byId = new Map(store.exams.map((e) => [e.id, e]));
      for (const ex of imported) {
        byId.set(ex.id, ex);
      }
      nextExams = Array.from(byId.values());
    }
    persistAndSync(
      {
        ...store,
        exams: nextExams,
        updatedAt: Date.now(),
      },
      `Imported ${imported.length} exam(s)`
    );
  };

  const handleSwitchVault = (newKey: string) => {
    const cleaned = persistVaultKey(newKey);
    if (!cleaned || cleaned === vaultKey) return;
    explicitSwitchRef.current = true;
    setVaultKey(cleaned);
    showToast(`Switched to Vault: ${cleaned}`);
  };

  const handleUseVaultMode = () => {
    persistSyncMode('vault');
    setSyncMode('vault');
  };

  const handleUseAccountMode = () => {
    persistSyncMode('account');
    setSyncMode('account');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        examCount={store.exams.length}
        cloud={cloudInfo}
        theme={store.settings.theme}
        onToggleTheme={handleToggleTheme}
        onOpenAddExam={() => {
          setEditingExam(null);
          setExamModalOpen(true);
        }}
        onOpenCloud={() => setCloudModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {store.exams.length === 0 ? (
          <EmptyState
            onAddExam={() => {
              setEditingExam(null);
              setExamModalOpen(true);
            }}
            onLoadSample={handleLoadSample}
            onOpenCloud={() => setCloudModalOpen(true)}
            vaultKey={vaultKey}
          />
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                analytics={analytics}
                settings={store.settings}
                hasSampleData={hasSampleData}
                onClearSampleData={handleClearSampleData}
                onInspectExam={(summary) => setInspectingExamId(summary.exam.id)}
                onSelectSubject={(key) => {
                  setFocusedSubjectKey(key);
                  setActiveTab('subjects');
                }}
                onViewAllExams={() => setActiveTab('exams')}
              />
            )}

            {activeTab === 'exams' && (
              <ExamsTab
                examSummaries={[...analytics.examSummaries].reverse()}
                settings={store.settings}
                onAddExam={() => {
                  setEditingExam(null);
                  setExamModalOpen(true);
                }}
                onEditExam={(exam) => {
                  setEditingExam(exam);
                  setExamModalOpen(true);
                }}
                onDuplicateExam={handleDuplicateExam}
                onDeleteExam={handleDeleteExam}
                onInspectExam={(summary) => setInspectingExamId(summary.exam.id)}
              />
            )}

            {activeTab === 'subjects' && (
              <SubjectsTab
                analytics={analytics}
                settings={store.settings}
                focusedSubjectKey={focusedSubjectKey}
                onInspectExam={(summary) => setInspectingExamId(summary.exam.id)}
              />
            )}

            {activeTab === 'predictor' && (
              <PredictorTab analytics={analytics} settings={store.settings} />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <ExamModal
        isOpen={examModalOpen}
        editingExam={editingExam}
        existingSubjectNames={existingSubjectNames}
        settings={store.settings}
        onClose={() => {
          setExamModalOpen(false);
          setEditingExam(null);
        }}
        onSave={handleSaveExam}
      />

      <ExamReportModal
        summary={inspectingSummary}
        subjectStats={analytics.subjectStats}
        settings={store.settings}
        onClose={() => setInspectingExamId(null)}
        onEdit={() => {
          if (inspectingSummary) {
            setEditingExam(inspectingSummary.exam);
            setExamModalOpen(true);
          }
        }}
      />

      <CloudModal
        isOpen={cloudModalOpen}
        cloud={cloudInfo}
        exams={store.exams}
        onClose={() => setCloudModalOpen(false)}
        onSwitchVault={handleSwitchVault}
        onUseVaultMode={handleUseVaultMode}
        onUseAccountMode={handleUseAccountMode}
        onRetrySync={() => setSyncEpoch((n) => n + 1)}
        onImportExams={handleImportExams}
        onLoadSample={handleLoadSample}
        onClearAll={handleClearAll}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        settings={store.settings ?? DEFAULT_SETTINGS}
        onClose={() => setSettingsModalOpen(false)}
        onSave={handleUpdateSettings}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

export default App;

