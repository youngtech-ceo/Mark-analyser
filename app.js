/* MarkPulse — Main Application Controller (Vanilla JS + Firebase RTDB + Chart.js) */
(function () {
  'use strict';

  const A = window.MarkAnalytics;

  // User-provided Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCUwsvNGxWj98aMkuzFHXwBRl91xLbacwY",
    authDomain: "yt-web-58043.firebaseapp.com",
    databaseURL: "https://yt-web-58043-default-rtdb.firebaseio.com",
    projectId: "yt-web-58043",
    storageBucket: "yt-web-58043.firebasestorage.app",
    messagingSenderId: "32116509565",
    appId: "1:32116509565:web:143feab9e000dcabf81a14",
    measurementId: "G-Z6VT7XHZPD"
  };

  const STORAGE_STORE_KEY = 'markpulse_store_v1';
  const STORAGE_VAULT_KEY = 'markpulse_vault_key_v1';
  const STORAGE_MODE_KEY = 'markpulse_sync_mode_v1';

  const RECOMMENDED_RTDB_RULES = JSON.stringify(
    {
      rules: {
        markAnalyser: {
          vaults: {
            $vaultId: {
              '.read': true,
              '.write': true,
            },
          },
          users: {
            $uid: {
              '.read': 'auth != null && auth.uid == $uid',
              '.write': 'auth != null && auth.uid == $uid',
            },
          },
        },
      },
    },
    null,
    2
  );

  // Firebase Init
  let db = null;
  let auth = null;
  let googleProvider = null;
  if (typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.database();
      auth = firebase.auth();
      googleProvider = new firebase.auth.GoogleAuthProvider();
    } catch (e) {
      console.error('Firebase initialization warning:', e);
    }
  }

  // App State
  const state = {
    store: loadLocalStore(),
    activeTab: 'overview',
    overviewSeries: 'ALL',
    showTrendline: true,
    examsSearch: '',
    examsCategory: 'ALL',
    examsSort: 'date-desc',
    examsView: 'cards',
    confirmDeleteId: null,
    focusedSubjectKey: null,
    predictorScope: 'OVERALL',
    predictorTargetPct: null,
    predictorUpcomingMax: 100,
    predictorPacePct: 92,
    predictorMatrixMax: 100,
    cloudModalTab: 'vault',
    cloudAuthMode: 'signin',
    cloudAuthError: null,
    cloudImportMsg: null,
    cloudConfirmClear: false,
    // Sync state
    syncMode: localStorage.getItem(STORAGE_MODE_KEY) === 'account' ? 'account' : 'vault',
    vaultKey: getInitialVaultKey(),
    authUser: null,
    rtdbConnected: true,
    cloudStatus: db ? 'connecting' : 'offline',
    cloudError: null,
    lastSyncedAt: null,
    pendingLocalWrite: false,
    explicitSwitch: false,
    // Modal draft state
    editingExamId: null,
    draftDefaultTotal: 100,
    draftSubjects: [],
  };

  let cloudRef = null;
  let cloudListener = null;
  let charts = {
    trajectory: null,
    radar: null,
    subjectLine: null,
  };
  let toastTimer = null;

  // --- Utilities ---
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeVaultKey(raw) {
    return String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
  }

  function getInitialVaultKey() {
    const params = new URLSearchParams(window.location.search);
    const urlVault = params.get('vault');
    if (urlVault) {
      const cleaned = sanitizeVaultKey(urlVault);
      if (cleaned.length >= 4) {
        localStorage.setItem(STORAGE_VAULT_KEY, cleaned);
        return cleaned;
      }
    }
    const saved = localStorage.getItem(STORAGE_VAULT_KEY);
    if (saved) {
      const cleaned = sanitizeVaultKey(saved);
      if (cleaned.length >= 4) return cleaned;
    }
    const fresh = A.generateVaultKey();
    localStorage.setItem(STORAGE_VAULT_KEY, fresh);
    return fresh;
  }

  function stripUndefined(val) {
    if (Array.isArray(val)) return val.map(stripUndefined);
    if (val !== null && typeof val === 'object') {
      const out = {};
      Object.keys(val).forEach(function (k) {
        if (val[k] !== undefined) out[k] = stripUndefined(val[k]);
      });
      return out;
    }
    return val;
  }

  function normalizeArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.filter(Boolean);
    if (typeof val === 'object') return Object.values(val).filter(Boolean);
    return [];
  }

  function normalizeStore(raw) {
    if (!raw || typeof raw !== 'object') {
      return { exams: [], settings: cloneDefaults(), updatedAt: 0 };
    }
    const rawExams = normalizeArray(raw.exams);
    const exams = rawExams.map(function (ex) {
      const subs = normalizeArray(ex.subjects).map(function (s) {
        const out = {
          id: String(s.id || A.createId('sub')),
          name: String(s.name || 'Subject'),
          scoredMarks: Number(s.scoredMarks) || 0,
          totalMarks: Math.max(1, Number(s.totalMarks) || 100),
        };
        if (typeof s.notes === 'string' && s.notes) out.notes = s.notes;
        return out;
      });
      const outExam = {
        id: String(ex.id || A.createId('exam')),
        name: String(ex.name || 'Untitled Exam'),
        date: String(ex.date || new Date().toISOString().slice(0, 10)),
        category: String(ex.category || 'Exam'),
        defaultTotalMarks: Number(ex.defaultTotalMarks) || 100,
        subjects: subs,
        createdAt: Number(ex.createdAt) || Date.now(),
        updatedAt: Number(ex.updatedAt) || Date.now(),
      };
      if (typeof ex.notes === 'string' && ex.notes) outExam.notes = ex.notes;
      if (ex.isSample) outExam.isSample = true;
      return outExam;
    });

    const rs = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    const gradeScale = normalizeArray(rs.gradeScale);
    const settings = {
      targetPercentage: typeof rs.targetPercentage === 'number' ? rs.targetPercentage : A.DEFAULT_SETTINGS.targetPercentage,
      passingPercentage: typeof rs.passingPercentage === 'number' ? rs.passingPercentage : A.DEFAULT_SETTINGS.passingPercentage,
      theme: rs.theme === 'dark' ? 'dark' : 'light',
      gradeScale: gradeScale.length > 0 ? gradeScale : A.DEFAULT_GRADE_SCALE.slice(),
    };

    return {
      exams: exams,
      settings: settings,
      updatedAt: Number(raw.updatedAt) || 0,
    };
  }

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(A.DEFAULT_SETTINGS));
  }

  function loadLocalStore() {
    try {
      const raw = localStorage.getItem(STORAGE_STORE_KEY);
      if (!raw) return { exams: [], settings: cloneDefaults(), updatedAt: 0 };
      return normalizeStore(JSON.parse(raw));
    } catch {
      return { exams: [], settings: cloneDefaults(), updatedAt: 0 };
    }
  }

  function saveLocalStore(store) {
    try {
      localStorage.setItem(STORAGE_STORE_KEY, JSON.stringify(stripUndefined(store)));
    } catch {
      // Ignore quota errors
    }
  }

  function mergeStores(local, remote) {
    const map = new Map();
    remote.exams.forEach(function (ex) {
      if (ex.id) map.set(ex.id, ex);
    });
    local.exams.forEach(function (ex) {
      if (!ex.id) return;
      const existing = map.get(ex.id);
      if (!existing || (ex.updatedAt || 0) > (existing.updatedAt || 0)) {
        map.set(ex.id, ex);
      }
    });
    const useLocalSettings = local.updatedAt > remote.updatedAt;
    return {
      exams: Array.from(map.values()),
      settings: useLocalSettings ? local.settings : remote.settings,
      updatedAt: Math.max(local.updatedAt, remote.updatedAt, Date.now()),
    };
  }

  function isPermissionErr(err) {
    if (!err) return false;
    const msg = String(err.message || '').toLowerCase();
    const code = String(err.code || '').toLowerCase();
    return msg.indexOf('permission_denied') !== -1 || msg.indexOf('permission denied') !== -1 || code.indexOf('permission-denied') !== -1;
  }

  function formatFirebaseError(err) {
    if (!err) return 'Unexpected cloud error.';
    const code = String(err.code || '');
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Try signing in.';
    }
    if (code === 'auth/weak-password') {
      return 'Password should be at least 6 characters.';
    }
    if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
      return 'Sign-in method is not enabled in Firebase Authentication Console yet. Use Cloud Vault Key sync right now or enable the provider in Firebase.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Sign-in popup closed before completing.';
    }
    if (isPermissionErr(err)) {
      return 'Firebase Realtime Database rules blocked read/write access.';
    }
    return err.message || 'Cloud sync error.';
  }

  function getActiveCloudPath() {
    if (state.syncMode === 'account' && state.authUser) {
      return 'markAnalyser/users/' + state.authUser.uid;
    }
    const key = sanitizeVaultKey(state.vaultKey) || 'DEFAULT-VAULT';
    return 'markAnalyser/vaults/' + key;
  }

  function showToast(msg) {
    const el = document.getElementById('toastEl');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.add('hidden');
    }, 2800);
  }

  // --- Cloud Sync Lifecycle ---
  function writeCloudStore(path, store) {
    if (!db) return Promise.resolve();
    const payload = stripUndefined({
      exams: store.exams,
      settings: store.settings,
      updatedAt: store.updatedAt,
    });
    return db.ref(path).set(payload);
  }

  function persistAndSync(nextStore, toastMsg) {
    state.store = nextStore;
    saveLocalStore(nextStore);
    state.pendingLocalWrite = true;
    state.cloudStatus = db ? 'syncing' : 'offline';
    state.cloudError = null;
    renderAll();

    if (!db) {
      if (toastMsg) showToast(toastMsg + ' (Saved locally)');
      return;
    }

    const path = getActiveCloudPath();
    writeCloudStore(path, nextStore)
      .then(function () {
        state.pendingLocalWrite = false;
        state.cloudStatus = state.rtdbConnected ? 'synced' : 'offline';
        state.lastSyncedAt = Date.now();
        updateHeaderCloudUI();
        if (toastMsg) showToast(toastMsg);
      })
      .catch(function (err) {
        if (isPermissionErr(err)) {
          state.cloudStatus = 'permission-denied';
          state.cloudError = formatFirebaseError(err);
        } else if (!state.rtdbConnected) {
          state.cloudStatus = 'offline';
        } else {
          state.cloudStatus = 'error';
          state.cloudError = formatFirebaseError(err);
        }
        updateHeaderCloudUI();
      });
  }

  function detachCloudSubscription() {
    if (cloudRef && cloudListener) {
      cloudRef.off('value', cloudListener);
    }
    cloudRef = null;
    cloudListener = null;
  }

  function attachCloudSubscription() {
    detachCloudSubscription();
    if (!db) {
      state.cloudStatus = 'offline';
      updateHeaderCloudUI();
      return;
    }

    state.cloudStatus = 'connecting';
    state.cloudError = null;
    updateHeaderCloudUI();

    const path = getActiveCloudPath();
    cloudRef = db.ref(path);
    cloudListener = function (snapshot) {
      const exists = snapshot.exists();
      const remoteStore = exists ? normalizeStore(snapshot.val()) : null;
      const local = state.store;

      if (!remoteStore) {
        if (state.explicitSwitch) {
          state.explicitSwitch = false;
          state.store = { exams: [], settings: local.settings, updatedAt: Date.now() };
          saveLocalStore(state.store);
          state.cloudStatus = 'synced';
          state.lastSyncedAt = Date.now();
          renderAll();
          return;
        }
        if (local.exams.length > 0) {
          writeCloudStore(path, local)
            .then(function () {
              state.pendingLocalWrite = false;
              state.cloudStatus = 'synced';
              state.lastSyncedAt = Date.now();
              updateHeaderCloudUI();
            })
            .catch(function (err) {
              state.cloudStatus = isPermissionErr(err) ? 'permission-denied' : 'error';
              state.cloudError = formatFirebaseError(err);
              updateHeaderCloudUI();
            });
        } else {
          state.cloudStatus = 'synced';
          state.lastSyncedAt = Date.now();
          updateHeaderCloudUI();
        }
        return;
      }

      if (state.explicitSwitch) {
        state.explicitSwitch = false;
        state.store = remoteStore;
        saveLocalStore(remoteStore);
        state.pendingLocalWrite = false;
        state.cloudStatus = 'synced';
        state.lastSyncedAt = Date.now();
        renderAll();
        return;
      }

      if (state.pendingLocalWrite && local.updatedAt > remoteStore.updatedAt) {
        const merged = mergeStores(local, remoteStore);
        state.store = merged;
        saveLocalStore(merged);
        writeCloudStore(path, merged)
          .then(function () { state.pendingLocalWrite = false; })
          .catch(function () {});
      } else if (remoteStore.updatedAt >= local.updatedAt || local.exams.length === 0) {
        state.store = remoteStore;
        saveLocalStore(remoteStore);
        state.pendingLocalWrite = false;
      }

      state.cloudStatus = 'synced';
      state.lastSyncedAt = Date.now();
      renderAll();
    };

    cloudRef.on('value', cloudListener, function (err) {
      state.cloudStatus = isPermissionErr(err) ? 'permission-denied' : 'error';
      state.cloudError = formatFirebaseError(err);
      updateHeaderCloudUI();
    });
  }

  // --- UI Helpers ---
  function applyTheme() {
    const isDark = state.store.settings.theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    const wrap = document.getElementById('themeIconWrap');
    if (wrap) {
      wrap.innerHTML = isDark
        ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>'
        : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    }
  }

  function gradeBadgeHtml(grade) {
    return '<span class="grade-badge grade-' + escapeHtml(grade.color || 'indigo') + ' mono">' + escapeHtml(grade.label) + '</span>';
  }

  function barColorClass(pct, targetPct, passingPct) {
    if (pct >= targetPct) return 'fill-emerald';
    if (pct >= passingPct + (targetPct - passingPct) * 0.5) return 'fill-indigo';
    if (pct >= passingPct) return 'fill-amber';
    return 'fill-rose';
  }

  function updateHeaderCloudUI() {
    const pill = document.getElementById('cloudPillBtn');
    const dot = document.getElementById('cloudStatusDot');
    const label = document.getElementById('cloudPillLabel');
    if (!pill || !dot || !label) return;

    pill.className = 'cloud-pill';
    dot.className = 'status-dot';

    const effectiveAccount = state.syncMode === 'account' && state.authUser;
    let text = effectiveAccount && state.authUser.email ? state.authUser.email.split('@')[0] : state.vaultKey;
    const status = !state.rtdbConnected && state.cloudStatus === 'synced' ? 'offline' : state.cloudStatus;

    if (status === 'connecting' || status === 'syncing') {
      dot.classList.add('syncing');
      text = status === 'connecting' ? 'Connecting...' : 'Syncing...';
    } else if (status === 'permission-denied') {
      pill.classList.add('warn');
      dot.classList.add('warn');
      text = 'Cloud Setup';
    } else if (status === 'offline' || status === 'error') {
      pill.classList.add('err');
      dot.classList.add('err');
      text = status === 'offline' ? 'Offline' : 'Sync Error';
    }

    label.textContent = text;
  }

  function updateNavUI() {
    const count = state.store.exams.length;
    const c1 = document.getElementById('navExamCount');
    const c2 = document.getElementById('navExamCountMobile');
    if (c1) c1.textContent = String(count);
    if (c2) c2.textContent = String(count);

    document.querySelectorAll('.nav-btn[data-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === state.activeTab);
    });
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) {
      if (charts[k]) {
        charts[k].destroy();
        charts[k] = null;
      }
    });
  }

  // --- Main Render Dispatcher ---
  function renderAll() {
    applyTheme();
    updateHeaderCloudUI();
    updateNavUI();
    destroyCharts();

    const root = document.getElementById('mainRoot');
    if (!root) return;

    const exams = state.store.exams;
    const settings = state.store.settings;

    if (exams.length === 0) {
      root.innerHTML = renderEmptyStateHtml();
      bindMainEvents();
      return;
    }

    const analytics = A.analyzeMarks(exams, settings);
    if (state.predictorTargetPct === null) {
      state.predictorTargetPct = settings.targetPercentage;
    }

    if (state.activeTab === 'overview') {
      root.innerHTML = renderOverviewHtml(analytics, settings);
      bindMainEvents(analytics);
      renderTrajectoryChart(analytics, settings);
    } else if (state.activeTab === 'exams') {
      root.innerHTML = renderExamsTabHtml(analytics, settings);
      bindMainEvents(analytics);
    } else if (state.activeTab === 'subjects') {
      root.innerHTML = renderSubjectsTabHtml(analytics, settings);
      bindMainEvents(analytics);
      renderSubjectsCharts(analytics, settings);
    } else if (state.activeTab === 'predictor') {
      root.innerHTML = renderPredictorTabHtml(analytics, settings);
      bindMainEvents(analytics);
    }

    // Keep open Cloud Modal fresh if visible
    if (!document.getElementById('cloudModal').classList.contains('hidden')) {
      renderCloudModal();
    }
  }

  function renderEmptyStateHtml() {
    return (
      '<div class="card empty-box">' +
      '  <div class="empty-icon">' +
      '    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>' +
      '  </div>' +
      '  <h2 style="margin:0;font-size:22px;font-weight:800;">Welcome to Your Personal Mark Analyser</h2>' +
      '  <p style="max-width:560px;margin:10px auto 0;font-size:13px;color:var(--text-muted);">' +
      '    Log your exams, add subjects with custom total marks for each paper, and unlock trajectory trends, subject gap analysis, heatmaps, and target predictions — synced to Firebase Cloud so you can access it anywhere.' +
      '  </p>' +
      '  <div class="empty-actions">' +
      '    <button type="button" class="btn btn-primary" data-action="open-add-exam">+ Add Your First Exam</button>' +
      '    <button type="button" class="btn btn-secondary" data-action="load-sample">✨ Explore with Sample Data</button>' +
      '    <button type="button" class="btn btn-secondary" data-action="open-cloud">☁️ Connect Existing Vault / Sign In</button>' +
      '  </div>' +
      '  <div class="grid-3 empty-features">' +
      '    <div class="mini-box"><div style="font-size:11px;font-weight:800;color:var(--primary);text-transform:uppercase;">Flexible Total Marks</div><p style="margin:5px 0 0;font-size:12px;color:var(--text-soft);">Set custom max marks per exam or per subject (25, 50, 80, 100, or any number).</p></div>' +
      '    <div class="mini-box"><div style="font-size:11px;font-weight:800;color:var(--emerald-text);text-transform:uppercase;">Deep Telemetry</div><p style="margin:5px 0 0;font-size:12px;color:var(--text-soft);">Weighted averages, trendlines, consistency scores, heatmaps &amp; score predictors.</p></div>' +
      '    <div class="mini-box"><div style="font-size:11px;font-weight:800;text-transform:uppercase;">Cloud Vault Ready</div><p style="margin:5px 0 0;font-size:12px;color:var(--text-soft);">Active Vault: <strong class="mono">' + escapeHtml(state.vaultKey) + '</strong></p></div>' +
      '  </div>' +
      '</div>'
    );
  }

  function renderOverviewHtml(analytics, settings) {
    const hasSample = state.store.exams.some(function (e) { return e.isSample; });
    const overallGrade = A.getGradeForPercentage(analytics.weightedOverallPct, settings.gradeScale);
    const delta = analytics.recentMomentumDelta;
    const deltaHtml =
      delta === null
        ? ''
        : '<span class="mono ' + (delta >= 0 ? 'delta-up' : 'delta-down') + '" style="font-size:12px;">' +
          (delta >= 0 ? '↗ +' : '↘ ') + delta.toFixed(1) + '%</span>';

    const sampleHtml = hasSample
      ? '<div class="sample-banner">' +
        '  <div><strong>Sample Dataset Active:</strong> You are exploring demo exams. Add your own real exams anytime or clear sample data in one click.</div>' +
        '  <button type="button" class="btn btn-secondary btn-sm" data-action="clear-sample">Clear Sample Data</button>' +
        '</div>'
      : '';

    const kpisHtml =
      '<div class="grid-4">' +
      '  <div class="card">' +
      '    <div style="display:flex;justify-content:space-between;align-items:center;"><span class="kpi-label">Cumulative Avg</span>' + gradeBadgeHtml(overallGrade) + '</div>' +
      '    <div style="display:flex;align-items:baseline;gap:8px;"><div class="kpi-value mono">' + A.formatPct(analytics.weightedOverallPct) + '</div>' + deltaHtml + '</div>' +
      '    <div class="kpi-sub mono">' + A.formatMarks(analytics.totalScored) + ' / ' + A.formatMarks(analytics.totalMax) + ' marks · ' + analytics.examCount + ' exam(s)</div>' +
      '  </div>' +
      '  <div class="card">' +
      '    <div class="kpi-label">Best Exam Peak</div>' +
      '    <div class="kpi-value mono">' + (analytics.bestExam ? A.formatPct(analytics.bestExam.percentage) : '—') + '</div>' +
      '    <div class="kpi-sub">' + (analytics.bestExam ? escapeHtml(analytics.bestExam.exam.name) + ' (' + A.formatMarks(analytics.bestExam.totalScored) + '/' + A.formatMarks(analytics.bestExam.totalMax) + ')' : 'No exams yet') + '</div>' +
      '  </div>' +
      '  <div class="card">' +
      '    <div class="kpi-label">Subject Extremes</div>' +
      (analytics.bestSubject
        ? '<div style="margin-top:10px;" class="stack-md">' +
          '  <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--emerald-text);"><span>▲ ' + escapeHtml(analytics.bestSubject.displayName) + '</span><span class="mono">' + A.formatPct(analytics.bestSubject.weightedAveragePct) + '</span></div>' +
          (analytics.focusSubject
            ? '<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--amber-text);"><span>▼ ' + escapeHtml(analytics.focusSubject.displayName) + '</span><span class="mono">' + A.formatPct(analytics.focusSubject.weightedAveragePct) + '</span></div>'
            : '<div class="kpi-sub">Add more subjects to compare</div>') +
          '</div>'
        : '<div class="kpi-sub">—</div>') +
      '  </div>' +
      '  <div class="card">' +
      '    <div class="kpi-label">Stability &amp; Pass Rate</div>' +
      '    <div class="kpi-value" style="font-size:22px;">' + (analytics.examCount >= 2 ? escapeHtml(analytics.consistencyLabel) : 'Baseline') + '</div>' +
      '    <div class="kpi-sub mono">' + (analytics.examCount >= 2 ? 'σ = ' + analytics.consistencyStdDev.toFixed(1) + '% · ' : '') + 'Pass rate: ' + A.formatPct(analytics.passRatePct, 0) + ' (' + analytics.totalSubjectEntries + ' papers)</div>' +
      '  </div>' +
      '</div>';

    // Trajectory + Insights
    const seriesOptions = ['<option value="ALL">All Subjects (Exam Total)</option>']
      .concat(
        analytics.subjectStats.map(function (s) {
          const sel = state.overviewSeries === s.key ? ' selected' : '';
          return '<option value="' + escapeHtml(s.key) + '"' + sel + '>' + escapeHtml(s.displayName) + ' (' + s.appearances + ')</option>';
        })
      )
      .join('');

    const insightsHtml = analytics.insights.length
      ? analytics.insights
          .map(function (ins) {
            return (
              '<div class="insight-item ' + escapeHtml(ins.kind) + '">' +
              '  <div class="insight-top">' +
              '    <span class="insight-title">' + escapeHtml(ins.title) + '</span>' +
              (ins.metric ? '<span class="insight-metric mono">' + escapeHtml(ins.metric) + '</span>' : '') +
              '  </div>' +
              '  <p class="insight-desc">' + escapeHtml(ins.description) + '</p>' +
              '</div>'
            );
          })
          .join('')
      : '<div class="mini-box" style="font-size:12px;color:var(--text-soft);">Add more exams to unlock trend &amp; leverage insights.</div>';

    const middleRow =
      '<div class="grid-12">' +
      '  <div class="card col-8">' +
      '    <div class="card-header">' +
      '      <div>' +
      '        <h3 class="card-title">Performance Trajectory</h3>' +
      '        <p class="card-subtitle">Chronological progression vs your ' + settings.targetPercentage + '% target</p>' +
      '      </div>' +
      '      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
      '        <select class="select select-sm" id="overviewSeriesSelect" style="width:auto;">' + seriesOptions + '</select>' +
      '        <label style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer;">' +
      '          <input type="checkbox" id="showTrendlineCheck" ' + (state.showTrendline ? 'checked' : '') + ' /> Trendline' +
      '        </label>' +
      '      </div>' +
      '    </div>' +
      '    <div class="chart-wrap"><canvas id="trajectoryCanvas"></canvas></div>' +
      '  </div>' +
      '  <div class="card col-4">' +
      '    <h3 class="card-title">Analytical Insights</h3>' +
      '    <p class="card-subtitle">Auto-computed patterns from your marks</p>' +
      '    <div class="stack-md" style="margin-top:14px;">' + insightsHtml + '</div>' +
      '  </div>' +
      '</div>';

    // Subject Mastery + Recent Exams
    const masteryHtml = analytics.subjectStats
      .map(function (sub) {
        const trendHtml =
          sub.trendDelta === null
            ? ''
            : '<span class="mono ' + (sub.trendDelta >= 0 ? 'delta-up' : 'delta-down') + '">' + (sub.trendDelta >= 0 ? '↑ ' : '↓ ') + Math.abs(sub.trendDelta).toFixed(1) + '%</span>';
        const fillClass = barColorClass(sub.weightedAveragePct, settings.targetPercentage, settings.passingPercentage);
        const widthPct = Math.min(100, Math.max(2, sub.weightedAveragePct));
        const targetPos = Math.min(99, settings.targetPercentage);
        return (
          '<button type="button" class="mastery-row" data-action="focus-subject" data-subject="' + escapeHtml(sub.key) + '">' +
          '  <div class="mastery-top">' +
          '    <div><strong>' + escapeHtml(sub.displayName) + '</strong> <span class="mono" style="color:var(--text-soft);margin-left:6px;">' + A.formatMarks(sub.totalScored) + '/' + A.formatMarks(sub.totalMax) + '</span></div>' +
          '    <div style="display:flex;align-items:center;gap:10px;">' + trendHtml + '<strong class="mono">' + A.formatPct(sub.weightedAveragePct) + '</strong></div>' +
          '  </div>' +
          '  <div class="progress-track">' +
          '    <div class="progress-fill ' + fillClass + '" style="width:' + widthPct + '%;"></div>' +
          '    <div class="target-tick" style="left:' + targetPos + '%;" title="Target ' + settings.targetPercentage + '%"></div>' +
          '  </div>' +
          '</button>'
        );
      })
      .join('');

    const recentExams = analytics.examSummaries.slice().reverse().slice(0, 5);
    const recentHtml = recentExams
      .map(function (s) {
        return (
          '<button type="button" class="list-row-btn" data-action="inspect-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">' +
          '  <div>' +
          '    <div style="font-size:13px;font-weight:700;">' + escapeHtml(s.exam.name) + '</div>' +
          '    <div style="font-size:11px;color:var(--text-soft);">' + escapeHtml(s.exam.date) + ' · ' + s.subjectCount + ' subjects</div>' +
          '  </div>' +
          '  <div style="display:flex;align-items:center;gap:10px;">' +
          '    <div style="text-align:right;">' +
          '      <div class="mono" style="font-size:13px;font-weight:800;">' + A.formatPct(s.percentage) + '</div>' +
          '      <div class="mono" style="font-size:11px;color:var(--text-soft);">' + A.formatMarks(s.totalScored) + '/' + A.formatMarks(s.totalMax) + '</div>' +
          '    </div>' +
          gradeBadgeHtml(s.grade) +
          '  </div>' +
          '</button>'
        );
      })
      .join('');

    const bottomRow =
      '<div class="grid-12">' +
      '  <div class="card col-7">' +
      '    <h3 class="card-title">Subject Mastery vs Target (' + settings.targetPercentage + '%)</h3>' +
      '    <p class="card-subtitle">Weighted averages · click any subject for deep-dive</p>' +
      '    <div style="margin-top:12px;">' + masteryHtml + '</div>' +
      '  </div>' +
      '  <div class="card col-5">' +
      '    <div class="card-header">' +
      '      <div><h3 class="card-title">Recent Exams</h3><p class="card-subtitle">Click an exam for full report card</p></div>' +
      '      <button type="button" class="btn btn-ghost btn-sm" data-action="go-exams" style="color:var(--primary);">View All →</button>' +
      '    </div>' +
      '    <div style="margin-top:10px;">' + recentHtml + '</div>' +
      '  </div>' +
      '</div>';

    return '<div class="stack-lg">' + sampleHtml + kpisHtml + middleRow + bottomRow + '</div>';
  }

  function renderExamsTabHtml(analytics, settings) {
    const categories = ['ALL'];
    analytics.examSummaries.forEach(function (s) {
      if (s.exam.category && categories.indexOf(s.exam.category) === -1) {
        categories.push(s.exam.category);
      }
    });

    const q = state.examsSearch.trim().toLowerCase();
    const filtered = analytics.examSummaries.filter(function (s) {
      if (state.examsCategory !== 'ALL' && s.exam.category !== state.examsCategory) return false;
      if (!q) return true;
      return (
        s.exam.name.toLowerCase().indexOf(q) !== -1 ||
        s.exam.category.toLowerCase().indexOf(q) !== -1 ||
        (s.exam.notes || '').toLowerCase().indexOf(q) !== -1 ||
        s.exam.subjects.some(function (sub) { return sub.name.toLowerCase().indexOf(q) !== -1; })
      );
    });

    filtered.sort(function (a, b) {
      if (state.examsSort === 'date-asc') return a.exam.date.localeCompare(b.exam.date);
      if (state.examsSort === 'pct-desc') return b.percentage - a.percentage;
      if (state.examsSort === 'pct-asc') return a.percentage - b.percentage;
      return b.exam.date.localeCompare(a.exam.date) || (b.exam.createdAt || 0) - (a.exam.createdAt || 0);
    });

    const catOptions = categories
      .map(function (c) {
        const sel = state.examsCategory === c ? ' selected' : '';
        return '<option value="' + escapeHtml(c) + '"' + sel + '>' + (c === 'ALL' ? 'All Categories' : escapeHtml(c)) + '</option>';
      })
      .join('');

    const toolbar =
      '<div class="card" style="padding:14px 16px;">' +
      '  <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">' +
      '    <div style="display:flex;flex-wrap:wrap;gap:8px;flex:1;min-width:240px;">' +
      '      <input class="input input-sm" id="examsSearchInput" type="text" value="' + escapeHtml(state.examsSearch) + '" placeholder="Search exam, subject, or notes..." style="max-width:260px;" />' +
      '      <select class="select select-sm" id="examsCatSelect" style="width:auto;">' + catOptions + '</select>' +
      '      <select class="select select-sm" id="examsSortSelect" style="width:auto;">' +
      '        <option value="date-desc"' + (state.examsSort === 'date-desc' ? ' selected' : '') + '>Newest First</option>' +
      '        <option value="date-asc"' + (state.examsSort === 'date-asc' ? ' selected' : '') + '>Oldest First</option>' +
      '        <option value="pct-desc"' + (state.examsSort === 'pct-desc' ? ' selected' : '') + '>Highest % First</option>' +
      '        <option value="pct-asc"' + (state.examsSort === 'pct-asc' ? ' selected' : '') + '>Lowest % First</option>' +
      '      </select>' +
      '    </div>' +
      '    <div style="display:flex;gap:8px;align-items:center;">' +
      '      <button type="button" class="chip-btn ' + (state.examsView === 'cards' ? 'active' : '') + '" data-action="exams-view" data-view="cards">Cards</button>' +
      '      <button type="button" class="chip-btn ' + (state.examsView === 'table' ? 'active' : '') + '" data-action="exams-view" data-view="table">Table</button>' +
      '      <button type="button" class="btn btn-primary btn-sm" data-action="open-add-exam">+ Add Exam</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    if (filtered.length === 0) {
      return '<div class="stack-lg">' + toolbar + '<div class="card" style="text-align:center;padding:40px;color:var(--text-soft);">No exams match your current filter.</div></div>';
    }

    let bodyHtml = '';
    if (state.examsView === 'cards') {
      bodyHtml =
        '<div class="grid-2">' +
        filtered
          .map(function (s) {
            const delta = s.deltaFromPrevious;
            const deltaHtml =
              delta === null
                ? ''
                : '<span class="mono ' + (delta >= 0 ? 'delta-up' : 'delta-down') + '">' + (delta >= 0 ? '↗ +' : '↘ ') + delta.toFixed(1) + '%</span>';
            const chips = s.exam.subjects
              .map(function (sub) {
                const p = A.calcPercentage(sub.scoredMarks, sub.totalMarks);
                const cls = p < settings.passingPercentage ? 'bad' : p >= settings.targetPercentage ? 'good' : '';
                return '<span class="chip ' + cls + '">' + escapeHtml(sub.name) + ' <strong class="mono">' + A.formatMarks(sub.scoredMarks) + '/' + A.formatMarks(sub.totalMarks) + '</strong></span>';
              })
              .join('');
            const deleteActions =
              state.confirmDeleteId === s.exam.id
                ? '<button type="button" class="btn btn-danger btn-sm" data-action="confirm-delete" data-exam-id="' + escapeHtml(s.exam.id) + '">Confirm</button>' +
                  '<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-delete">Cancel</button>'
                : '<button type="button" class="btn btn-ghost btn-sm" data-action="ask-delete" data-exam-id="' + escapeHtml(s.exam.id) + '" title="Delete">🗑</button>';

            return (
              '<div class="card" style="display:flex;flex-direction:column;justify-content:space-between;">' +
              '  <div>' +
              '    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">' +
              '      <div>' +
              '        <div style="display:flex;gap:8px;align-items:center;font-size:11px;color:var(--text-soft);">' +
              '          <span class="chip" style="padding:2px 7px;font-weight:700;">' + escapeHtml(s.exam.category) + '</span>' +
              '          <span class="mono">' + escapeHtml(s.exam.date) + '</span>' +
              '        </div>' +
              '        <h3 style="margin:6px 0 0;font-size:16px;font-weight:700;">' + escapeHtml(s.exam.name) + '</h3>' +
              '      </div>' +
              '      <div style="text-align:right;">' +
              '        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;">' +
              '          <strong class="mono" style="font-size:20px;">' + A.formatPct(s.percentage) + '</strong>' +
              gradeBadgeHtml(s.grade) +
              '        </div>' +
              '        <div class="mono" style="font-size:12px;color:var(--text-soft);margin-top:2px;">' + A.formatMarks(s.totalScored) + ' / ' + A.formatMarks(s.totalMax) + ' ' + deltaHtml + '</div>' +
              '      </div>' +
              '    </div>' +
              '    <div class="progress-track" style="margin-top:12px;height:6px;">' +
              '      <div class="progress-fill ' + barColorClass(s.percentage, settings.targetPercentage, settings.passingPercentage) + '" style="width:' + Math.min(100, Math.max(2, s.percentage)) + '%;"></div>' +
              '    </div>' +
              '    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;">' + chips + '</div>' +
              (s.exam.notes ? '<p style="margin:10px 0 0;font-size:12px;color:var(--text-soft);font-style:italic;">“' + escapeHtml(s.exam.notes) + '”</p>' : '') +
              '  </div>' +
              '  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">' +
              '    <button type="button" class="btn btn-ghost btn-sm" style="color:var(--primary);" data-action="inspect-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">📄 Report Card</button>' +
              '    <div style="display:flex;gap:4px;align-items:center;">' +
              '      <button type="button" class="btn btn-ghost btn-sm" data-action="duplicate-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">Duplicate</button>' +
              '      <button type="button" class="btn btn-ghost btn-sm" data-action="edit-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">Edit</button>' +
              deleteActions +
              '    </div>' +
              '  </div>' +
              '</div>'
            );
          })
          .join('') +
        '</div>';
    } else {
      bodyHtml =
        '<div class="card card-flush"><div class="table-wrap"><table class="data-table">' +
        '<thead><tr><th>Exam</th><th>Date</th><th>Category</th><th class="text-center">Subjects</th><th class="text-right">Marks</th><th class="text-right">Percentage</th><th class="text-center">Grade</th><th class="text-right">Actions</th></tr></thead>' +
        '<tbody>' +
        filtered
          .map(function (s) {
            const delBtn =
              state.confirmDeleteId === s.exam.id
                ? '<button type="button" class="btn btn-danger btn-sm" data-action="confirm-delete" data-exam-id="' + escapeHtml(s.exam.id) + '">Confirm</button>'
                : '<button type="button" class="btn btn-ghost btn-sm" data-action="ask-delete" data-exam-id="' + escapeHtml(s.exam.id) + '">🗑</button>';
            return (
              '<tr>' +
              '  <td><button type="button" class="btn btn-ghost btn-sm" style="padding:0;font-weight:700;" data-action="inspect-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">' + escapeHtml(s.exam.name) + '</button></td>' +
              '  <td class="mono">' + escapeHtml(s.exam.date) + '</td>' +
              '  <td>' + escapeHtml(s.exam.category) + '</td>' +
              '  <td class="text-center mono">' + s.subjectCount + '</td>' +
              '  <td class="text-right mono">' + A.formatMarks(s.totalScored) + ' / ' + A.formatMarks(s.totalMax) + '</td>' +
              '  <td class="text-right mono"><strong>' + A.formatPct(s.percentage) + '</strong></td>' +
              '  <td class="text-center">' + gradeBadgeHtml(s.grade) + '</td>' +
              '  <td class="text-right">' +
              '    <button type="button" class="btn btn-ghost btn-sm" data-action="inspect-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">Report</button>' +
              '    <button type="button" class="btn btn-ghost btn-sm" data-action="duplicate-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">Copy</button>' +
              '    <button type="button" class="btn btn-ghost btn-sm" data-action="edit-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">Edit</button>' +
              delBtn +
              '  </td>' +
              '</tr>'
            );
          })
          .join('') +
        '</tbody></table></div></div>';
    }

    return '<div class="stack-lg">' + toolbar + bodyHtml + '</div>';
  }

  function renderSubjectsTabHtml(analytics, settings) {
    if (!analytics.subjectStats.length) {
      return '<div class="card" style="text-align:center;padding:40px;color:var(--text-soft);">No subject data recorded yet.</div>';
    }

    if (
      !state.focusedSubjectKey ||
      !analytics.subjectStats.some(function (s) { return s.key === state.focusedSubjectKey; })
    ) {
      state.focusedSubjectKey = analytics.subjectStats[0].key;
    }

    const activeSub = analytics.subjectStats.find(function (s) {
      return s.key === state.focusedSubjectKey;
    }) || analytics.subjectStats[0];

    const leaderboardRows = analytics.subjectStats
      .map(function (sub) {
        const selected = sub.key === activeSub.key;
        const grade = A.getGradeForPercentage(sub.weightedAveragePct, settings.gradeScale);
        const trendHtml =
          sub.trendDelta === null
            ? '<span style="color:var(--text-faint);">—</span>'
            : '<span class="mono ' + (sub.trendDelta >= 0 ? 'delta-up' : 'delta-down') + '">' + (sub.trendDelta >= 0 ? '↗ +' : '↘ ') + sub.trendDelta.toFixed(1) + '%</span>';
        const gapClass = sub.targetGapPct >= 0 ? 'delta-up' : 'delta-down';
        return (
          '<tr class="' + (selected ? 'selected' : '') + '" style="cursor:pointer;" data-action="select-subject-row" data-subject="' + escapeHtml(sub.key) + '">' +
          '  <td><strong>' + (selected ? '● ' : '') + escapeHtml(sub.displayName) + '</strong></td>' +
          '  <td class="text-center mono">' + sub.appearances + '</td>' +
          '  <td class="text-right mono">' + A.formatMarks(sub.totalScored) + ' / ' + A.formatMarks(sub.totalMax) + '</td>' +
          '  <td class="text-right mono"><strong>' + A.formatPct(sub.weightedAveragePct) + '</strong></td>' +
          '  <td class="text-right mono" style="color:var(--text-soft);">' + sub.lowestPct.toFixed(0) + '% – ' + sub.bestPct.toFixed(0) + '%</td>' +
          '  <td class="text-right">' + trendHtml + '</td>' +
          '  <td class="text-right mono ' + gapClass + '">' + (sub.targetGapPct >= 0 ? '+' : '') + sub.targetGapPct.toFixed(1) + '%</td>' +
          '  <td class="text-center">' + gradeBadgeHtml(grade) + '</td>' +
          '</tr>'
        );
      })
      .join('');

    const subOptions = analytics.subjectStats
      .map(function (s) {
        return '<option value="' + escapeHtml(s.key) + '"' + (s.key === activeSub.key ? ' selected' : '') + '>' + escapeHtml(s.displayName) + '</option>';
      })
      .join('');

    const subHistoryChips = activeSub.history
      .map(function (h) {
        return '<span class="chip">' + escapeHtml(h.examName) + ': <strong class="mono">' + A.formatMarks(h.scoredMarks) + '/' + A.formatMarks(h.totalMarks) + ' (' + A.formatPct(h.percentage) + ')</strong></span>';
      })
      .join('');

    // Heatmap
    const midCutoff = settings.passingPercentage + (settings.targetPercentage - settings.passingPercentage) * 0.5;
    function heatClass(pct) {
      if (pct === null) return 'heat-na';
      if (pct >= settings.targetPercentage) return 'heat-great';
      if (pct >= midCutoff) return 'heat-mid';
      if (pct >= settings.passingPercentage) return 'heat-pass';
      return 'heat-fail';
    }

    const heatHeaders = analytics.examSummaries
      .map(function (s) {
        return (
          '<th style="text-align:center;min-width:95px;">' +
          '  <button type="button" class="btn btn-ghost btn-sm" style="flex-direction:column;gap:1px;" data-action="inspect-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">' +
          '    <strong>' + escapeHtml(s.exam.name) + '</strong>' +
          '    <span class="mono" style="font-size:10px;color:var(--text-soft);">' + escapeHtml(s.exam.date) + '</span>' +
          '  </button>' +
          '</th>'
        );
      })
      .join('');

    const heatRows = analytics.subjectStats
      .map(function (sub) {
        const byExam = new Map(sub.history.map(function (h) { return [h.examId, h]; }));
        const cells = analytics.examSummaries
          .map(function (s) {
            const entry = byExam.get(s.exam.id);
            const cls = heatClass(entry ? entry.percentage : null);
            return (
              '<td><button type="button" class="heat-cell ' + cls + '" data-action="inspect-exam" data-exam-id="' + escapeHtml(s.exam.id) + '">' +
              (entry
                ? '<div class="mono" style="font-weight:800;">' + entry.percentage.toFixed(0) + '%</div><div class="mono" style="font-size:10px;opacity:0.85;">' + A.formatMarks(entry.scoredMarks) + '/' + A.formatMarks(entry.totalMarks) + '</div>'
                : '<span>—</span>') +
              '</button></td>'
            );
          })
          .join('');
        return (
          '<tr>' +
          '  <td><button type="button" class="btn btn-ghost btn-sm" style="padding:2px 4px;font-weight:700;" data-action="select-subject-row" data-subject="' + escapeHtml(sub.key) + '">' + escapeHtml(sub.displayName) + '</button></td>' +
          cells +
          '  <td class="text-right mono"><strong>' + A.formatPct(sub.weightedAveragePct) + '</strong></td>' +
          '</tr>'
        );
      })
      .join('');

    const heatFooter = analytics.examSummaries
      .map(function (s) {
        return '<td class="text-center mono" style="padding-top:10px;border-top:1px solid var(--border);"><strong>' + A.formatPct(s.percentage) + '</strong><div style="font-size:10px;color:var(--text-soft);">' + A.formatMarks(s.totalScored) + '/' + A.formatMarks(s.totalMax) + '</div></td>';
      })
      .join('');

    return (
      '<div class="stack-lg">' +
      '  <div class="card card-flush">' +
      '    <div class="card-header card-header-bordered">' +
      '      <div><h3 class="card-title">Subject Performance Leaderboard</h3><p class="card-subtitle">Click any subject row to inspect its full exam-by-exam trajectory below</p></div>' +
      '      <span style="font-size:12px;color:var(--text-soft);">' + analytics.uniqueSubjectCount + ' subjects tracked</span>' +
      '    </div>' +
      '    <div class="table-wrap"><table class="data-table"><thead><tr><th>Subject</th><th class="text-center">Exams</th><th class="text-right">Total Marks</th><th class="text-right">Weighted Avg</th><th class="text-right">Min – Max</th><th class="text-right">Latest Trend</th><th class="text-right">vs Target</th><th class="text-center">Grade</th></tr></thead><tbody>' + leaderboardRows + '</tbody></table></div>' +
      '  </div>' +
      '  <div class="grid-12">' +
      '    <div class="card col-5">' +
      '      <h3 class="card-title">' + (analytics.subjectStats.length >= 3 ? 'Subject Balance Radar' : 'Subject Comparison') + '</h3>' +
      '      <p class="card-subtitle">Comparing subject averages against ' + settings.targetPercentage + '% target</p>' +
      '      <div class="chart-wrap"><canvas id="radarCanvas"></canvas></div>' +
      '    </div>' +
      '    <div class="card col-7">' +
      '      <div class="card-header">' +
      '        <div>' +
      '          <span class="kpi-label" style="color:var(--primary);">Subject Deep-Dive</span>' +
      '          <h3 class="card-title" style="font-size:18px;margin-top:2px;">' + escapeHtml(activeSub.displayName) + '</h3>' +
      '          <p class="card-subtitle">Best: ' + A.formatPct(activeSub.bestPct) + ' (' + escapeHtml(activeSub.bestExamName) + ') · Lowest: ' + A.formatPct(activeSub.lowestPct) + ' (' + escapeHtml(activeSub.lowestExamName) + ') · σ = ' + activeSub.stdDevPct.toFixed(1) + '%</p>' +
      '        </div>' +
      '        <select class="select select-sm" id="spotlightSubjectSelect" style="width:auto;">' + subOptions + '</select>' +
      '      </div>' +
      '      <div class="chart-wrap chart-wrap-sm"><canvas id="subjectSpotlightCanvas"></canvas></div>' +
      '      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">' + subHistoryChips + '</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="card card-flush">' +
      '    <div class="card-header card-header-bordered">' +
      '      <div><h3 class="card-title">Subject × Exam Performance Matrix</h3><p class="card-subtitle">Color-coded heatmap across chronological exams · click any exam to open its report card</p></div>' +
      '    </div>' +
      '    <div class="table-wrap" style="padding:14px;">' +
      '      <table class="heatmap-table">' +
      '        <thead><tr><th style="text-align:left;min-width:130px;">Subject</th>' + heatHeaders + '<th class="text-right" style="min-width:75px;">Avg</th></tr></thead>' +
      '        <tbody>' + heatRows + '<tr><td style="padding-top:10px;border-top:1px solid var(--border);font-weight:800;">Exam Total</td>' + heatFooter + '<td class="text-right mono" style="padding-top:10px;border-top:1px solid var(--border);color:var(--primary);font-weight:800;">' + A.formatPct(analytics.weightedOverallPct) + '</td></tr></tbody>' +
      '      </table>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  }

  function renderPredictorTabHtml(analytics, settings) {
    const targetPct = state.predictorTargetPct != null ? state.predictorTargetPct : settings.targetPercentage;
    let ctx = {
      label: 'Overall Cumulative Average',
      currentScored: analytics.totalScored,
      currentMax: analytics.totalMax,
      currentPct: analytics.weightedOverallPct,
    };
    if (state.predictorScope !== 'OVERALL') {
      const sub = analytics.subjectStats.find(function (s) { return s.key === state.predictorScope; });
      if (sub) {
        ctx = {
          label: sub.displayName,
          currentScored: sub.totalScored,
          currentMax: sub.totalMax,
          currentPct: sub.weightedAveragePct,
        };
      }
    }

    const pred = A.predictRequiredScore({
      currentScored: ctx.currentScored,
      currentMax: ctx.currentMax,
      upcomingMax: state.predictorUpcomingMax,
      targetPct: targetPct,
      assumedPacePct: state.predictorPacePct,
    });

    const scopeOptions = ['<option value="OVERALL"' + (state.predictorScope === 'OVERALL' ? ' selected' : '') + '>Overall Cumulative Average (' + A.formatPct(analytics.weightedOverallPct) + ')</option>']
      .concat(
        analytics.subjectStats.map(function (s) {
          return '<option value="' + escapeHtml(s.key) + '"' + (state.predictorScope === s.key ? ' selected' : '') + '>' + escapeHtml(s.displayName) + ' (Current: ' + A.formatPct(s.weightedAveragePct) + ')</option>';
        })
      )
      .join('');

    const presetBtns = [25, 50, 80, 100, 200, 300, 500]
      .map(function (v) {
        return '<button type="button" class="chip-btn mono ' + (state.predictorUpcomingMax === v ? 'active' : '') + '" data-action="pred-max-preset" data-val="' + v + '">' + v + '</button>';
      })
      .join('');

    let statusBadge = 'Comfortably Achievable';
    let badgeClass = 'grade-indigo';
    let headline = 'Need ' + A.formatMarks(Math.ceil(pred.requiredMarks * 10) / 10) + ' / ' + pred.upcomingMax;
    let subtext = 'Scoring ' + A.formatPct(pred.requiredPct) + ' in your next ' + pred.upcomingMax + '-mark exam brings ' + ctx.label + ' to ' + targetPct + '%.';

    if (pred.status === 'already-met') {
      statusBadge = 'Buffer Available';
      badgeClass = 'grade-emerald';
      headline = 'You already exceed ' + targetPct + '%!';
      subtext = 'Even 0 marks keeps you above ' + targetPct + '% right now, though aiming for ' + targetPct + '% protects your buffer.';
    } else if (pred.status === 'stretch') {
      statusBadge = 'High-Effort Stretch (≥ 90%)';
      badgeClass = 'grade-amber';
      subtext = 'Requires ' + A.formatPct(pred.requiredPct) + ' on the next exam — challenging, but achievable in one shot.';
    } else if (pred.status === 'impossible-single') {
      statusBadge = 'Needs Multiple Exams';
      badgeClass = 'grade-rose';
      headline = 'Requires ' + A.formatPct(pred.requiredPct) + ' (>100%)';
      const maxYield = ((ctx.currentScored + pred.upcomingMax) / pred.projectedNewTotalMax) * 100;
      subtext = 'One ' + pred.upcomingMax + '-mark exam alone cannot reach ' + targetPct + '% (even 100% yields ' + A.formatPct(maxYield) + ').';
    }

    const paceSliderHtml =
      pred.status === 'impossible-single'
        ? '<div class="mini-box" style="margin-top:12px;">' +
          '  <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;"><span>Multi-Exam Recovery Pace</span><span class="mono" style="color:var(--primary);">' + state.predictorPacePct + '% / exam</span></div>' +
          '  <input type="range" id="predPaceRange" min="' + Math.min(99, Math.ceil(targetPct + 1)) + '" max="100" step="1" value="' + state.predictorPacePct + '" style="width:100%;margin-top:6px;" />' +
          '</div>'
        : '';

    const multiExamNote =
      pred.examsNeededAtAssumedPace !== null
        ? '<div class="mini-box" style="margin-top:12px;font-size:12px;">At <strong>' + state.predictorPacePct + '%</strong> per upcoming ' + pred.upcomingMax + '-mark exam, you reach <strong>' + targetPct + '%</strong> in <strong style="color:var(--primary);">' + pred.examsNeededAtAssumedPace + ' exam(s)</strong>.</div>'
        : '';

    const matrixRows = analytics.subjectStats
      .map(function (sub) {
        const res = A.predictRequiredScore({
          currentScored: sub.totalScored,
          currentMax: sub.totalMax,
          upcomingMax: state.predictorMatrixMax,
          targetPct: targetPct,
          assumedPacePct: state.predictorPacePct,
        });
        let statusTag = '<span class="grade-badge grade-indigo">Achievable</span>';
        if (res.status === 'already-met') statusTag = '<span class="grade-badge grade-emerald">Above Target</span>';
        else if (res.status === 'stretch') statusTag = '<span class="grade-badge grade-amber">Stretch</span>';
        else if (res.status === 'impossible-single') statusTag = '<span class="grade-badge grade-rose">2+ Exams</span>';

        return (
          '<tr>' +
          '  <td><strong>' + escapeHtml(sub.displayName) + '</strong></td>' +
          '  <td class="text-right mono" style="color:var(--text-soft);">' + A.formatMarks(sub.totalScored) + ' / ' + A.formatMarks(sub.totalMax) + '</td>' +
          '  <td class="text-right mono"><strong>' + A.formatPct(sub.weightedAveragePct) + '</strong></td>' +
          '  <td class="text-right mono"><strong>' + (res.status === 'already-met' ? '0 (Buffer)' : A.formatMarks(Math.ceil(res.requiredMarks * 10) / 10) + ' / ' + state.predictorMatrixMax) + '</strong></td>' +
          '  <td class="text-right mono">' + (res.status === 'already-met' ? '0.0%' : A.formatPct(res.requiredPct)) + '</td>' +
          '  <td class="text-right">' + statusTag + '</td>' +
          '</tr>'
        );
      })
      .join('');

    return (
      '<div class="stack-lg">' +
      '  <div class="grid-12">' +
      '    <div class="card col-6">' +
      '      <h3 class="card-title">What-If Target Score Calculator</h3>' +
      '      <p class="card-subtitle">Simulate what marks you need in your next exam to hit your desired average</p>' +
      '      <div class="stack-md" style="margin-top:16px;">' +
      '        <div><label class="field-label" for="predScopeSelect">Target Scope</label><select class="select" id="predScopeSelect">' + scopeOptions + '</select></div>' +
      '        <div>' +
      '          <div style="display:flex;justify-content:space-between;align-items:center;"><label class="field-label" style="margin:0;">Target Average (%)</label><input class="input input-sm mono" id="predTargetNum" type="number" min="1" max="100" step="0.5" value="' + targetPct + '" style="width:82px;text-align:right;font-weight:700;" /></div>' +
      '          <input type="range" id="predTargetRange" min="30" max="99" step="0.5" value="' + targetPct + '" style="width:100%;margin-top:6px;" />' +
      '        </div>' +
      '        <div>' +
      '          <label class="field-label">Upcoming Exam Total Marks</label>' +
      '          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">' + presetBtns + '</div>' +
      '          <input class="input mono" id="predMaxInput" type="number" min="1" step="any" value="' + state.predictorUpcomingMax + '" />' +
      '        </div>' +
      paceSliderHtml +
      '      </div>' +
      '    </div>' +
      '    <div class="card col-6" style="display:flex;flex-direction:column;justify-content:space-between;">' +
      '      <div>' +
      '        <div style="display:flex;justify-content:space-between;align-items:center;"><span class="kpi-label">Projection Result</span><span class="grade-badge ' + badgeClass + '">' + statusBadge + '</span></div>' +
      '        <div class="mini-box" style="margin-top:16px;padding:18px;">' +
      '          <div class="mono" style="font-size:22px;font-weight:800;">' + escapeHtml(headline) + '</div>' +
      '          <p style="margin:8px 0 0;font-size:12px;color:var(--text-muted);">' + escapeHtml(subtext) + '</p>' +
      multiExamNote +
      '        </div>' +
      '      </div>' +
      '      <div class="grid-3" style="margin-top:18px;padding-top:14px;border-top:1px solid var(--border);">' +
      '        <div><div style="font-size:11px;color:var(--text-soft);">Current Marks</div><div class="mono" style="font-weight:800;font-size:13px;">' + A.formatMarks(ctx.currentScored) + ' / ' + A.formatMarks(ctx.currentMax) + '</div></div>' +
      '        <div><div style="font-size:11px;color:var(--text-soft);">Current Avg</div><div class="mono" style="font-weight:800;font-size:13px;">' + A.formatPct(ctx.currentPct) + '</div></div>' +
      '        <div><div style="font-size:11px;color:var(--text-soft);">New Total Pool</div><div class="mono" style="font-weight:800;font-size:13px;">' + A.formatMarks(pred.projectedNewTotalMax) + '</div></div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="card card-flush">' +
      '    <div class="card-header card-header-bordered">' +
      '      <div><h3 class="card-title">Subject-by-Subject Target Matrix</h3><p class="card-subtitle">Marks needed in your next paper per subject to reach ' + targetPct + '% in each</p></div>' +
      '      <div style="display:flex;align-items:center;gap:8px;font-size:12px;"><span style="color:var(--text-soft);">Next paper max marks:</span><input class="input input-sm mono" id="predMatrixMaxInput" type="number" min="1" value="' + state.predictorMatrixMax + '" style="width:76px;text-align:center;font-weight:700;" /></div>' +
      '    </div>' +
      '    <div class="table-wrap"><table class="data-table"><thead><tr><th>Subject</th><th class="text-right">Current Marks</th><th class="text-right">Current Avg</th><th class="text-right">Needed / ' + state.predictorMatrixMax + '</th><th class="text-right">Required %</th><th class="text-right">Status</th></tr></thead><tbody>' + matrixRows + '</tbody></table></div>' +
      '  </div>' +
      '</div>'
    );
  }

  // --- Charts (Chart.js) ---
  function getChartColors() {
    const isDark = state.store.settings.theme === 'dark';
    return {
      grid: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.22)',
      tick: isDark ? '#94a3b8' : '#64748b',
      primary: '#6366f1',
      fill: isDark ? 'rgba(99, 102, 241, 0.22)' : 'rgba(79, 70, 229, 0.14)',
    };
  }

  function renderTrajectoryChart(analytics, settings) {
    if (typeof Chart === 'undefined') return;
    const canvas = document.getElementById('trajectoryCanvas');
    if (!canvas) return;

    let points = [];
    if (state.overviewSeries === 'ALL') {
      const regMap = new Map(analytics.regressionLine.map(function (r) { return [r.examId, r.trendPct]; }));
      points = analytics.examSummaries.map(function (s) {
        return {
          label: s.exam.name.length > 15 ? s.exam.name.slice(0, 13) + '…' : s.exam.name,
          fullName: s.exam.name,
          date: s.exam.date,
          pct: Number(s.percentage.toFixed(2)),
          trend: regMap.get(s.exam.id) || Number(s.percentage.toFixed(2)),
          scored: s.totalScored,
          total: s.totalMax,
        };
      });
    } else {
      const sub = analytics.subjectStats.find(function (s) { return s.key === state.overviewSeries; });
      if (sub) {
        const reg = A.computeLinearRegression(sub.history.map(function (h) { return h.percentage; }));
        points = sub.history.map(function (h, idx) {
          return {
            label: h.examName.length > 15 ? h.examName.slice(0, 13) + '…' : h.examName,
            fullName: h.examName,
            date: h.date,
            pct: Number(h.percentage.toFixed(2)),
            trend: Number(Math.max(0, Math.min(100, reg.intercept + reg.slope * idx)).toFixed(2)),
            scored: h.scoredMarks,
            total: h.totalMarks,
          };
        });
      }
    }

    const c = getChartColors();
    const datasets = [
      {
        label: 'Score %',
        data: points.map(function (p) { return p.pct; }),
        borderColor: c.primary,
        backgroundColor: c.fill,
        fill: true,
        tension: 0.28,
        borderWidth: 2.5,
        pointRadius: 4.5,
        pointHoverRadius: 6,
      },
      {
        label: 'Target (' + settings.targetPercentage + '%)',
        data: points.map(function () { return settings.targetPercentage; }),
        borderColor: '#10b981',
        borderDash: [5, 5],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
    ];

    if (state.showTrendline && points.length >= 2) {
      datasets.push({
        label: 'Trendline',
        data: points.map(function (p) { return p.trend; }),
        borderColor: '#f59e0b',
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
      });
    }

    charts.trajectory = new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: points.map(function (p) { return p.label; }),
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: c.grid },
            ticks: { color: c.tick, callback: function (v) { return v + '%'; } },
          },
          x: {
            grid: { display: false },
            ticks: { color: c.tick },
          },
        },
        plugins: {
          legend: { labels: { color: c.tick, boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: function (items) {
                const idx = items[0] ? items[0].dataIndex : 0;
                const p = points[idx];
                return p ? p.fullName + ' (' + p.date + ')' : '';
              },
              afterBody: function (items) {
                const idx = items[0] ? items[0].dataIndex : 0;
                const p = points[idx];
                return p ? ['Marks: ' + A.formatMarks(p.scored) + ' / ' + A.formatMarks(p.total)] : [];
              },
            },
          },
        },
      },
    });
  }

  function renderSubjectsCharts(analytics, settings) {
    if (typeof Chart === 'undefined') return;
    const c = getChartColors();

    // Radar / Bar
    const radarCanvas = document.getElementById('radarCanvas');
    if (radarCanvas) {
      const topSubs = analytics.subjectStats.slice(0, 8);
      if (topSubs.length >= 3) {
        charts.radar = new Chart(radarCanvas.getContext('2d'), {
          type: 'radar',
          data: {
            labels: topSubs.map(function (s) { return s.displayName; }),
            datasets: [
              {
                label: 'Average %',
                data: topSubs.map(function (s) { return Number(s.weightedAveragePct.toFixed(1)); }),
                borderColor: c.primary,
                backgroundColor: c.fill,
                borderWidth: 2,
              },
              {
                label: 'Target (' + settings.targetPercentage + '%)',
                data: topSubs.map(function () { return settings.targetPercentage; }),
                borderColor: '#10b981',
                borderDash: [4, 4],
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
                borderWidth: 1.5,
                pointRadius: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              r: {
                min: 0,
                max: 100,
                grid: { color: c.grid },
                angleLines: { color: c.grid },
                pointLabels: { color: c.tick, font: { size: 11 } },
                ticks: { color: c.tick, backdropColor: 'transparent', stepSize: 25 },
              },
            },
            plugins: { legend: { labels: { color: c.tick, font: { size: 11 } } } },
          },
        });
      } else {
        charts.radar = new Chart(radarCanvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels: topSubs.map(function (s) { return s.displayName; }),
            datasets: [
              {
                label: 'Average %',
                data: topSubs.map(function (s) { return Number(s.weightedAveragePct.toFixed(1)); }),
                backgroundColor: c.primary,
                borderRadius: 6,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 100, grid: { color: c.grid }, ticks: { color: c.tick } }, x: { ticks: { color: c.tick } } },
          },
        });
      }
    }

    // Spotlight line chart
    const spotCanvas = document.getElementById('subjectSpotlightCanvas');
    const activeSub = analytics.subjectStats.find(function (s) { return s.key === state.focusedSubjectKey; });
    if (spotCanvas && activeSub) {
      charts.subjectLine = new Chart(spotCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: activeSub.history.map(function (h) { return h.examName; }),
          datasets: [
            {
              label: activeSub.displayName + ' %',
              data: activeSub.history.map(function (h) { return Number(h.percentage.toFixed(1)); }),
              borderColor: c.primary,
              backgroundColor: c.fill,
              fill: true,
              tension: 0.25,
              borderWidth: 2.5,
              pointRadius: 4,
            },
            {
              label: 'Target',
              data: activeSub.history.map(function () { return settings.targetPercentage; }),
              borderColor: '#10b981',
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 100, grid: { color: c.grid }, ticks: { color: c.tick, callback: function (v) { return v + '%'; } } },
            x: { grid: { display: false }, ticks: { color: c.tick } },
          },
          plugins: { legend: { labels: { color: c.tick, font: { size: 11 } } } },
        },
      });
    }
  }

  // --- Event Binding for Main View ---
  function bindMainEvents(analytics) {
    document.querySelectorAll('[data-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        const action = el.getAttribute('data-action');
        const examId = el.getAttribute('data-exam-id');
        const subjectKey = el.getAttribute('data-subject');

        if (action === 'open-add-exam') openExamModal(null);
        else if (action === 'open-cloud') openCloudModal();
        else if (action === 'load-sample') loadSampleExams();
        else if (action === 'clear-sample') clearSampleExams();
        else if (action === 'go-exams') { state.activeTab = 'exams'; renderAll(); }
        else if (action === 'focus-subject' && subjectKey) {
          state.focusedSubjectKey = subjectKey;
          state.activeTab = 'subjects';
          renderAll();
        } else if (action === 'select-subject-row' && subjectKey) {
          state.focusedSubjectKey = subjectKey;
          renderAll();
        } else if (action === 'inspect-exam' && examId && analytics) {
          openReportModal(examId, analytics);
        } else if (action === 'edit-exam' && examId) {
          const ex = state.store.exams.find(function (e) { return e.id === examId; });
          if (ex) openExamModal(ex);
        } else if (action === 'duplicate-exam' && examId) {
          const ex = state.store.exams.find(function (e) { return e.id === examId; });
          if (ex) duplicateExam(ex);
        } else if (action === 'ask-delete' && examId) {
          state.confirmDeleteId = examId;
          renderAll();
        } else if (action === 'cancel-delete') {
          state.confirmDeleteId = null;
          renderAll();
        } else if (action === 'confirm-delete' && examId) {
          deleteExam(examId);
        } else if (action === 'exams-view') {
          state.examsView = el.getAttribute('data-view') || 'cards';
          renderAll();
        } else if (action === 'pred-max-preset') {
          state.predictorUpcomingMax = Number(el.getAttribute('data-val')) || 100;
          renderAll();
        }
      });
    });

    const ovSeries = document.getElementById('overviewSeriesSelect');
    if (ovSeries) {
      ovSeries.addEventListener('change', function (e) {
        state.overviewSeries = e.target.value;
        renderAll();
      });
    }
    const trendChk = document.getElementById('showTrendlineCheck');
    if (trendChk) {
      trendChk.addEventListener('change', function (e) {
        state.showTrendline = e.target.checked;
        renderAll();
      });
    }

    const searchInp = document.getElementById('examsSearchInput');
    if (searchInp) {
      searchInp.addEventListener('input', function (e) {
        state.examsSearch = e.target.value;
        renderAll();
        const nextInp = document.getElementById('examsSearchInput');
        if (nextInp) {
          nextInp.focus();
          nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
        }
      });
    }
    const catSel = document.getElementById('examsCatSelect');
    if (catSel) {
      catSel.addEventListener('change', function (e) {
        state.examsCategory = e.target.value;
        renderAll();
      });
    }
    const sortSel = document.getElementById('examsSortSelect');
    if (sortSel) {
      sortSel.addEventListener('change', function (e) {
        state.examsSort = e.target.value;
        renderAll();
      });
    }

    const spotSel = document.getElementById('spotlightSubjectSelect');
    if (spotSel) {
      spotSel.addEventListener('change', function (e) {
        state.focusedSubjectKey = e.target.value;
        renderAll();
      });
    }

    // Predictor bindings
    const predScope = document.getElementById('predScopeSelect');
    if (predScope) {
      predScope.addEventListener('change', function (e) {
        state.predictorScope = e.target.value;
        renderAll();
      });
    }
    const predTargetRange = document.getElementById('predTargetRange');
    const predTargetNum = document.getElementById('predTargetNum');
    if (predTargetRange) {
      predTargetRange.addEventListener('input', function (e) {
        state.predictorTargetPct = Number(e.target.value);
        renderAll();
      });
    }
    if (predTargetNum) {
      predTargetNum.addEventListener('change', function (e) {
        state.predictorTargetPct = Math.min(100, Math.max(1, Number(e.target.value) || 1));
        renderAll();
      });
    }
    const predMaxInput = document.getElementById('predMaxInput');
    if (predMaxInput) {
      predMaxInput.addEventListener('change', function (e) {
        state.predictorUpcomingMax = Math.max(1, Number(e.target.value) || 1);
        renderAll();
      });
    }
    const predPaceRange = document.getElementById('predPaceRange');
    if (predPaceRange) {
      predPaceRange.addEventListener('input', function (e) {
        state.predictorPacePct = Number(e.target.value);
        renderAll();
      });
    }
    const predMatrixMax = document.getElementById('predMatrixMaxInput');
    if (predMatrixMax) {
      predMatrixMax.addEventListener('change', function (e) {
        state.predictorMatrixMax = Math.max(1, Number(e.target.value) || 1);
        renderAll();
      });
    }
  }

  // --- CRUD Actions ---
  function loadSampleExams() {
    const sample = A.buildSampleExams();
    const existingIds = new Set(state.store.exams.map(function (e) { return e.id; }));
    const merged = state.store.exams.concat(sample.filter(function (e) { return !existingIds.has(e.id); }));
    persistAndSync({ exams: merged, settings: state.store.settings, updatedAt: Date.now() }, 'Sample exams loaded');
  }

  function clearSampleExams() {
    const realOnly = state.store.exams.filter(function (e) { return !e.isSample; });
    persistAndSync({ exams: realOnly, settings: state.store.settings, updatedAt: Date.now() }, 'Sample data cleared');
  }

  function deleteExam(examId) {
    state.confirmDeleteId = null;
    const next = state.store.exams.filter(function (e) { return e.id !== examId; });
    persistAndSync({ exams: next, settings: state.store.settings, updatedAt: Date.now() }, 'Exam removed');
  }

  function duplicateExam(exam) {
    const now = Date.now();
    const copy = {
      id: A.createId('exam'),
      name: exam.name + ' (Copy)',
      date: new Date().toISOString().slice(0, 10),
      category: exam.category,
      defaultTotalMarks: exam.defaultTotalMarks,
      notes: exam.notes || '',
      createdAt: now,
      updatedAt: now,
      subjects: exam.subjects.map(function (s) {
        return { id: A.createId('sub'), name: s.name, scoredMarks: s.scoredMarks, totalMarks: s.totalMarks, notes: s.notes || '' };
      }),
    };
    openExamModal(copy, true);
  }

  // --- Exam Add/Edit Modal ---
  function getExistingSubjectNames() {
    return A.analyzeMarks(state.store.exams, state.store.settings).subjectStats.map(function (s) {
      return s.displayName;
    });
  }

  function openExamModal(exam, isNewCopy) {
    const modal = document.getElementById('examModal');
    const titleEl = document.getElementById('examModalTitle');
    const errEl = document.getElementById('examFormError');
    errEl.classList.add('hidden');

    const catList = document.getElementById('examCategoriesList');
    catList.innerHTML = A.EXAM_CATEGORIES.map(function (c) { return '<option value="' + escapeHtml(c) + '"></option>'; }).join('');

    const subDatalist = document.getElementById('existingSubjectsDatalist');
    const existingNames = getExistingSubjectNames();
    subDatalist.innerHTML = existingNames.map(function (n) { return '<option value="' + escapeHtml(n) + '"></option>'; }).join('');

    if (exam) {
      state.editingExamId = isNewCopy ? null : exam.id;
      titleEl.textContent = isNewCopy ? 'Add Exam (Duplicated)' : 'Edit Exam & Marks';
      document.getElementById('examNameInput').value = exam.name;
      document.getElementById('examDateInput').value = exam.date;
      document.getElementById('examCategoryInput').value = exam.category || A.EXAM_CATEGORIES[0];
      document.getElementById('examNotesInput').value = exam.notes || '';
      state.draftDefaultTotal = exam.defaultTotalMarks || 100;
      document.getElementById('allowBonusCheck').checked = exam.subjects.some(function (s) {
        return s.scoredMarks > s.totalMarks;
      });
      state.draftSubjects = exam.subjects.map(function (s) {
        return {
          id: s.id || A.createId('sub'),
          name: s.name,
          scoredMarks: String(s.scoredMarks),
          totalMarks: String(s.totalMarks),
          notes: s.notes || '',
          showNote: Boolean(s.notes),
        };
      });
    } else {
      state.editingExamId = null;
      titleEl.textContent = 'Add New Exam';
      document.getElementById('examNameInput').value = '';
      document.getElementById('examDateInput').value = new Date().toISOString().slice(0, 10);
      document.getElementById('examCategoryInput').value = A.EXAM_CATEGORIES[0];
      document.getElementById('examNotesInput').value = '';
      state.draftDefaultTotal = 100;
      document.getElementById('allowBonusCheck').checked = false;
      state.draftSubjects = [makeEmptySubject(100), makeEmptySubject(100), makeEmptySubject(100)];
    }

    renderQuickTotalsControl();
    renderSubjectQuickAddPills();
    renderSubjectDraftRows();
    updateLiveExamFooter();
    modal.classList.remove('hidden');
    document.getElementById('examNameInput').focus();
  }

  function makeEmptySubject(defaultTotal) {
    return {
      id: A.createId('sub'),
      name: '',
      scoredMarks: '',
      totalMarks: String(defaultTotal),
      notes: '',
      showNote: false,
    };
  }

  function renderQuickTotalsControl() {
    const wrap = document.getElementById('quickTotalsWrap');
    const chips = A.QUICK_TOTAL_MARKS.map(function (v) {
      return '<button type="button" class="chip-btn mono ' + (state.draftDefaultTotal === v ? 'active' : '') + '" data-quick-total="' + v + '">' + v + '</button>';
    }).join('');
    wrap.innerHTML =
      chips +
      '<input class="input input-sm mono" id="customDefaultTotalInput" type="number" min="1" step="any" value="' + state.draftDefaultTotal + '" style="width:66px;font-weight:700;" />' +
      '<button type="button" class="btn btn-secondary btn-sm" id="applyAllTotalsBtn">Apply All</button>';

    wrap.querySelectorAll('[data-quick-total]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyDefaultTotalToAll(Number(btn.getAttribute('data-quick-total')));
      });
    });
    document.getElementById('customDefaultTotalInput').addEventListener('change', function (e) {
      state.draftDefaultTotal = Math.max(1, Number(e.target.value) || 1);
    });
    document.getElementById('applyAllTotalsBtn').addEventListener('click', function () {
      const val = Math.max(1, Number(document.getElementById('customDefaultTotalInput').value) || 1);
      applyDefaultTotalToAll(val);
    });
  }

  function applyDefaultTotalToAll(val) {
    state.draftDefaultTotal = val;
    state.draftSubjects.forEach(function (r) {
      r.totalMarks = String(val);
    });
    renderQuickTotalsControl();
    renderSubjectDraftRows();
    updateLiveExamFooter();
  }

  function renderSubjectQuickAddPills() {
    const wrap = document.getElementById('subjectQuickAddWrap');
    const existing = getExistingSubjectNames();
    const used = new Set(state.draftSubjects.map(function (s) { return s.name.trim().toLowerCase(); }));
    const unused = existing.filter(function (n) { return !used.has(n.toLowerCase()); });

    if (!unused.length) {
      wrap.classList.add('hidden');
      wrap.innerHTML = '';
      return;
    }

    wrap.classList.remove('hidden');
    wrap.innerHTML =
      '<span style="font-size:11px;color:var(--text-soft);margin-right:4px;">Quick add subject:</span>' +
      unused.slice(0, 10).map(function (n) {
        return '<button type="button" class="chip" data-quick-sub="' + escapeHtml(n) + '">+ ' + escapeHtml(n) + '</button>';
      }).join('');

    wrap.querySelectorAll('[data-quick-sub]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const subName = btn.getAttribute('data-quick-sub');
        const empty = state.draftSubjects.find(function (r) { return !r.name.trim() && !r.scoredMarks; });
        if (empty) {
          empty.name = subName;
        } else {
          const row = makeEmptySubject(state.draftDefaultTotal);
          row.name = subName;
          state.draftSubjects.push(row);
        }
        renderSubjectQuickAddPills();
        renderSubjectDraftRows();
        updateLiveExamFooter();
      });
    });
  }

  function renderSubjectDraftRows() {
    const container = document.getElementById('subjectRowsContainer');
    const header = document.getElementById('subjectsRowHeader');
    header.textContent = 'Subjects & Marks (' + state.draftSubjects.length + ')';

    const allowBonus = document.getElementById('allowBonusCheck').checked;

    container.innerHTML = state.draftSubjects
      .map(function (row, idx) {
        const scoredNum = Number(row.scoredMarks);
        const totalNum = Number(row.totalMarks);
        const validNums = row.scoredMarks !== '' && Number.isFinite(scoredNum) && Number.isFinite(totalNum) && totalNum > 0;
        const pct = validNums ? A.calcPercentage(scoredNum, totalNum) : 0;
        const grade = A.getGradeForPercentage(pct, state.store.settings.gradeScale);
        const invalid = !allowBonus && validNums && scoredNum > totalNum;

        return (
          '<div class="subject-row-card ' + (invalid ? 'invalid' : '') + '" data-row-id="' + escapeHtml(row.id) + '">' +
          '  <div class="subject-row-grid">' +
          '    <input class="input input-sm" data-field="name" list="existingSubjectsDatalist" value="' + escapeHtml(row.name) + '" placeholder="Subject ' + (idx + 1) + ' (e.g., Mathematics)" />' +
          '    <input class="input input-sm mono" data-field="scoredMarks" type="number" min="0" step="any" value="' + escapeHtml(row.scoredMarks) + '" placeholder="Scored" style="font-weight:700;" />' +
          '    <div style="text-align:center;color:var(--text-faint);font-weight:700;">/</div>' +
          '    <input class="input input-sm mono" data-field="totalMarks" type="number" min="1" step="any" value="' + escapeHtml(row.totalMarks) + '" placeholder="Total" />' +
          '    <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">' +
          (validNums
            ? '<span class="mono" style="font-size:12px;font-weight:700;">' + A.formatPct(pct) + '</span>' + gradeBadgeHtml(grade)
            : '<span style="font-size:12px;color:var(--text-faint);">—</span>') +
          '      <button type="button" class="btn btn-ghost btn-sm" data-row-action="note" title="Add remark">💬</button>' +
          '      <button type="button" class="btn btn-ghost btn-sm" data-row-action="remove" title="Remove" ' + (state.draftSubjects.length === 1 ? 'disabled' : '') + '>🗑</button>' +
          '    </div>' +
          '  </div>' +
          (row.showNote
            ? '<div style="margin-top:8px;"><input class="input input-sm" data-field="notes" type="text" value="' + escapeHtml(row.notes) + '" placeholder="Optional subject remark (e.g., Silly error in Q4)" /></div>'
            : '') +
          '</div>'
        );
      })
      .join('');

    container.querySelectorAll('.subject-row-card').forEach(function (card) {
      const id = card.getAttribute('data-row-id');
      const row = state.draftSubjects.find(function (r) { return r.id === id; });
      if (!row) return;

      card.querySelectorAll('input[data-field]').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          const field = e.target.getAttribute('data-field');
          row[field] = e.target.value;
          updateRowPreview(card, row);
          updateLiveExamFooter();
          if (field === 'name') renderSubjectQuickAddPills();
        });
      });

      const noteBtn = card.querySelector('[data-row-action="note"]');
      if (noteBtn) {
        noteBtn.addEventListener('click', function () {
          row.showNote = !row.showNote;
          renderSubjectDraftRows();
        });
      }
      const remBtn = card.querySelector('[data-row-action="remove"]');
      if (remBtn) {
        remBtn.addEventListener('click', function () {
          if (state.draftSubjects.length > 1) {
            state.draftSubjects = state.draftSubjects.filter(function (r) { return r.id !== id; });
            renderSubjectQuickAddPills();
            renderSubjectDraftRows();
            updateLiveExamFooter();
          }
        });
      }
    });
  }

  function updateRowPreview(card, row) {
    const allowBonus = document.getElementById('allowBonusCheck').checked;
    const scoredNum = Number(row.scoredMarks);
    const totalNum = Number(row.totalMarks);
    const valid = row.scoredMarks !== '' && Number.isFinite(scoredNum) && Number.isFinite(totalNum) && totalNum > 0;
    card.classList.toggle('invalid', !allowBonus && valid && scoredNum > totalNum);
    const badgeSlot = card.querySelector('.subject-row-grid > div:last-child');
    if (!badgeSlot) return;
    const buttons = Array.from(badgeSlot.querySelectorAll('button'));
    const pct = valid ? A.calcPercentage(scoredNum, totalNum) : 0;
    const grade = A.getGradeForPercentage(pct, state.store.settings.gradeScale);
    const leftHtml = valid
      ? '<span class="mono" style="font-size:12px;font-weight:700;">' + A.formatPct(pct) + '</span>' + gradeBadgeHtml(grade)
      : '<span style="font-size:12px;color:var(--text-faint);">—</span>';
    badgeSlot.innerHTML = leftHtml;
    buttons.forEach(function (b) { badgeSlot.appendChild(b); });
  }

  function updateLiveExamFooter() {
    let totalScored = 0;
    let totalMax = 0;
    state.draftSubjects.forEach(function (s) {
      const scored = Number(s.scoredMarks);
      const total = Number(s.totalMarks);
      if (s.name.trim() && Number.isFinite(total) && total > 0) {
        totalMax += total;
        if (s.scoredMarks !== '' && Number.isFinite(scored) && scored >= 0) {
          totalScored += scored;
        }
      }
    });
    const pct = A.calcPercentage(totalScored, totalMax);
    const grade = A.getGradeForPercentage(pct, state.store.settings.gradeScale);
    document.getElementById('liveExamSummaryText').textContent =
      A.formatMarks(totalScored) + ' / ' + A.formatMarks(totalMax) + ' (' + A.formatPct(pct) + ')';
    document.getElementById('liveExamSummaryGrade').innerHTML = totalMax > 0 ? gradeBadgeHtml(grade) : '';
  }

  function handleExamFormSubmit(e) {
    e.preventDefault();
    const errEl = document.getElementById('examFormError');
    errEl.classList.add('hidden');

    const name = document.getElementById('examNameInput').value.trim();
    const date = document.getElementById('examDateInput').value;
    const category = document.getElementById('examCategoryInput').value.trim() || 'Exam';
    const notes = document.getElementById('examNotesInput').value.trim();
    const allowBonus = document.getElementById('allowBonusCheck').checked;

    function showErr(msg) {
      errEl.textContent = msg;
      errEl.classList.remove('hidden');
    }

    if (!name) return showErr('Please enter an exam name.');
    if (!date) return showErr('Please select an exam date.');

    const nonEmpty = state.draftSubjects.filter(function (s) {
      return s.name.trim() !== '' || s.scoredMarks !== '';
    });
    if (!nonEmpty.length) return showErr('Please add at least one subject with marks.');

    const parsedSubjects = [];
    for (let i = 0; i < nonEmpty.length; i++) {
      const row = nonEmpty[i];
      const subName = row.name.trim();
      if (!subName) return showErr('Row ' + (i + 1) + ' has marks without a subject name.');
      const scored = Number(row.scoredMarks);
      const total = Number(row.totalMarks);
      if (row.scoredMarks === '' || !Number.isFinite(scored) || scored < 0) {
        return showErr('Enter valid marks scored for "' + subName + '".');
      }
      if (!Number.isFinite(total) || total <= 0) {
        return showErr('Total marks for "' + subName + '" must be greater than 0.');
      }
      if (!allowBonus && scored > total) {
        return showErr('Scored marks (' + scored + ') exceed total marks (' + total + ') for "' + subName + '". Enable "Allow bonus marks" if intentional.');
      }
      const subObj = { id: row.id || A.createId('sub'), name: subName, scoredMarks: scored, totalMarks: total };
      if (row.notes && row.notes.trim()) subObj.notes = row.notes.trim();
      parsedSubjects.push(subObj);
    }

    const now = Date.now();
    const existing = state.editingExamId
      ? state.store.exams.find(function (ex) { return ex.id === state.editingExamId; })
      : null;

    const examObj = {
      id: existing ? existing.id : A.createId('exam'),
      name: name,
      date: date,
      category: category,
      defaultTotalMarks: Math.max(1, state.draftDefaultTotal || 100),
      subjects: parsedSubjects,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    if (notes) examObj.notes = notes;

    const nextExams = existing
      ? state.store.exams.map(function (ex) { return ex.id === existing.id ? examObj : ex; })
      : state.store.exams.concat([examObj]);

    document.getElementById('examModal').classList.add('hidden');
    persistAndSync(
      { exams: nextExams, settings: state.store.settings, updatedAt: Date.now() },
      existing ? 'Exam updated & synced' : 'Exam saved & synced to cloud'
    );
  }

  // --- Exam Report Card Modal ---
  function openReportModal(examId, analytics) {
    const summary = analytics.examSummaries.find(function (s) { return s.exam.id === examId; });
    if (!summary) return;
    const settings = state.store.settings;

    const avgMap = new Map(analytics.subjectStats.map(function (st) { return [st.key, st.weightedAveragePct]; }));
    const sorted = summary.exam.subjects
      .map(function (s) {
        const pct = A.calcPercentage(s.scoredMarks, s.totalMarks);
        const avg = avgMap.has(A.canonicalSubjectKey(s.name)) ? avgMap.get(A.canonicalSubjectKey(s.name)) : pct;
        return {
          name: s.name,
          scoredMarks: s.scoredMarks,
          totalMarks: s.totalMarks,
          notes: s.notes,
          pct: pct,
          grade: A.getGradeForPercentage(pct, settings.gradeScale),
          vsAvg: pct - avg,
        };
      })
      .sort(function (a, b) { return b.pct - a.pct; });

    const deltaHtml =
      summary.deltaFromPrevious === null
        ? '<span style="color:var(--text-soft);">First Exam</span>'
        : '<span class="' + (summary.deltaFromPrevious >= 0 ? 'delta-up' : 'delta-down') + '">' + (summary.deltaFromPrevious >= 0 ? '↗ +' : '↘ ') + summary.deltaFromPrevious.toFixed(1) + '%</span>';

    const rowsHtml = sorted
      .map(function (sub, idx) {
        const vsText = Math.abs(sub.vsAvg) >= 0.1 ? (sub.vsAvg >= 0 ? '+' : '') + sub.vsAvg.toFixed(1) + '% vs your avg' : 'Matches your avg';
        return (
          '<div style="padding:12px 14px;border-bottom:1px solid var(--border);">' +
          '  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px;">' +
          '    <div style="display:flex;align-items:center;gap:10px;">' +
          '      <span class="chip mono" style="font-weight:800;">' + (idx + 1) + '</span>' +
          '      <div><strong>' + escapeHtml(sub.name) + '</strong>' + (sub.notes ? '<div style="font-size:11px;color:var(--text-soft);">' + escapeHtml(sub.notes) + '</div>' : '') + '</div>' +
          '    </div>' +
          '    <div style="display:flex;align-items:center;gap:12px;">' +
          '      <div style="text-align:right;"><div class="mono" style="font-weight:800;">' + A.formatMarks(sub.scoredMarks) + ' <span style="color:var(--text-soft);font-weight:400;">/ ' + A.formatMarks(sub.totalMarks) + '</span></div><div class="mono" style="font-size:11px;color:var(--text-soft);">' + vsText + '</div></div>' +
          '      <strong class="mono" style="min-width:52px;text-align:right;">' + A.formatPct(sub.pct) + '</strong>' +
          gradeBadgeHtml(sub.grade) +
          '    </div>' +
          '  </div>' +
          '  <div class="progress-track" style="height:6px;"><div class="progress-fill ' + barColorClass(sub.pct, settings.targetPercentage, settings.passingPercentage) + '" style="width:' + Math.min(100, Math.max(2, sub.pct)) + '%;"></div></div>' +
          '</div>'
        );
      })
      .join('');

    const content = document.getElementById('reportModalContent');
    content.innerHTML =
      '<div class="modal-header">' +
      '  <div>' +
      '    <div style="display:flex;gap:8px;align-items:center;font-size:12px;color:var(--text-soft);"><span class="chip">' + escapeHtml(summary.exam.category) + '</span><span class="mono">' + escapeHtml(summary.exam.date) + '</span></div>' +
      '    <h2 class="modal-title" style="font-size:20px;margin-top:6px;">' + escapeHtml(summary.exam.name) + '</h2>' +
      '  </div>' +
      '  <div class="no-print" style="display:flex;gap:6px;">' +
      '    <button type="button" class="btn btn-secondary btn-sm" id="printReportBtn">🖨 Print / PDF</button>' +
      '    <button type="button" class="btn btn-primary btn-sm" id="editFromReportBtn">Edit</button>' +
      '    <button type="button" class="icon-btn" data-close-modal="reportModal">✕</button>' +
      '  </div>' +
      '</div>' +
      '<div class="modal-body stack-md">' +
      '  <div class="grid-4" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));">' +
      '    <div class="mini-box"><div class="kpi-label">Total Score</div><div class="mono" style="font-weight:800;font-size:15px;margin-top:4px;">' + A.formatMarks(summary.totalScored) + ' / ' + A.formatMarks(summary.totalMax) + '</div></div>' +
      '    <div class="mini-box"><div class="kpi-label">Overall %</div><div style="display:flex;align-items:center;gap:8px;margin-top:4px;"><strong class="mono" style="font-size:15px;color:var(--primary);">' + A.formatPct(summary.percentage) + '</strong>' + gradeBadgeHtml(summary.grade) + '</div></div>' +
      '    <div class="mini-box"><div class="kpi-label">vs Previous</div><div class="mono" style="font-weight:800;font-size:15px;margin-top:4px;">' + deltaHtml + '</div></div>' +
      '    <div class="mini-box"><div class="kpi-label">Passed</div><div class="mono" style="font-weight:800;font-size:15px;margin-top:4px;">' + summary.passedCount + ' / ' + summary.subjectCount + '</div></div>' +
      '  </div>' +
      '  <div><div class="kpi-label" style="margin-bottom:8px;">Subject Breakdown (Highest to Lowest)</div><div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;">' + rowsHtml + '</div></div>' +
      (summary.exam.notes ? '<div class="mini-box" style="font-size:12px;"><strong>Exam Notes:</strong> ' + escapeHtml(summary.exam.notes) + '</div>' : '') +
      '</div>';

    document.getElementById('reportModal').classList.remove('hidden');
    document.getElementById('printReportBtn').addEventListener('click', function () { window.print(); });
    document.getElementById('editFromReportBtn').addEventListener('click', function () {
      document.getElementById('reportModal').classList.add('hidden');
      openExamModal(summary.exam);
    });
    bindModalCloseButtons(content);
  }

  // --- Cloud Modal ---
  function openCloudModal() {
    state.cloudAuthError = null;
    state.cloudImportMsg = null;
    state.cloudConfirmClear = false;
    state.cloudModalTab = state.syncMode === 'account' ? 'account' : 'vault';
    renderCloudModal();
    document.getElementById('cloudModal').classList.remove('hidden');
  }

  function renderCloudModal() {
    const content = document.getElementById('cloudModalContent');
    const shareUrl = window.location.origin + window.location.pathname + '?vault=' + encodeURIComponent(state.vaultKey);
    const statusText =
      state.cloudStatus === 'synced'
        ? 'Synced live to Firebase Cloud'
        : state.cloudStatus === 'syncing'
        ? 'Saving changes to cloud...'
        : state.cloudStatus === 'connecting'
        ? 'Connecting to Firebase RTDB...'
        : state.cloudStatus === 'permission-denied'
        ? 'Cloud Rules Need One-Time Setup in Firebase Console'
        : state.cloudStatus === 'offline'
        ? 'Offline — saved locally, syncs on reconnect'
        : state.cloudError || 'Cloud sync error';

    const permBox =
      state.cloudStatus === 'permission-denied'
        ? '<div class="alert-warn">' +
          '  <strong>Firebase Realtime Database blocked access (PERMISSION_DENIED)</strong>' +
          '  <p style="margin:6px 0 0;">Your data is safe locally! In Firebase Console → <strong>Realtime Database → Rules</strong>, paste these rules (or sign in under Firebase Account):</p>' +
          '  <pre class="code-block mono">' + escapeHtml(RECOMMENDED_RTDB_RULES) + '</pre>' +
          '  <div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '    <button type="button" class="btn btn-primary btn-sm" id="copyRulesBtn">Copy RTDB Rules</button>' +
          '    <button type="button" class="btn btn-secondary btn-sm" id="retrySyncBtn">Retry Cloud Sync</button>' +
          '  </div>' +
          '</div>'
        : '';

    let tabBody = '';
    if (state.cloudModalTab === 'vault') {
      tabBody =
        '<div class="mini-box">' +
        '  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;">' +
        '    <div><div class="kpi-label">Your Active Cloud Vault Key</div><div class="mono" style="font-size:18px;font-weight:800;color:var(--primary);margin-top:4px;">' + escapeHtml(state.vaultKey) + '</div></div>' +
        '    <div style="display:flex;gap:6px;"><button type="button" class="btn btn-secondary btn-sm" id="copyVaultKeyBtn">Copy Key</button><button type="button" class="btn btn-primary btn-sm" id="copyVaultLinkBtn">Copy Sync Link</button></div>' +
        '  </div>' +
        '  <p style="margin:10px 0 0;font-size:12px;color:var(--text-soft);">Save this key or bookmark the Sync Link. Open MarkPulse on your phone or another device with the same Vault Key to view &amp; edit marks live anywhere.</p>' +
        '</div>' +
        '<form id="switchVaultForm" class="stack-md" style="margin-top:14px;">' +
        '  <label class="field-label" for="vaultKeyInput">Switch to or Create a Custom Vault Key</label>' +
        '  <div style="display:flex;flex-wrap:wrap;gap:8px;">' +
        '    <input class="input mono" id="vaultKeyInput" type="text" value="' + escapeHtml(state.vaultKey) + '" style="flex:1;min-width:180px;text-transform:uppercase;" />' +
        '    <button type="button" class="btn btn-secondary" id="genVaultBtn">Generate New</button>' +
        '    <button type="submit" class="btn btn-primary">Connect Vault</button>' +
        '  </div>' +
        '</form>';
    } else if (state.cloudModalTab === 'account') {
      if (state.authUser) {
        tabBody =
          '<div class="mini-box">' +
          '  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
          '    <div><div class="kpi-label" style="color:var(--emerald-text);">Signed In via Firebase Auth</div><div style="font-weight:700;margin-top:4px;">' + escapeHtml(state.authUser.email || state.authUser.uid) + '</div></div>' +
          '    <div style="display:flex;gap:8px;">' +
          (state.syncMode !== 'account' ? '<button type="button" class="btn btn-primary btn-sm" id="useAccountModeBtn">Sync to Account</button>' : '') +
          '      <button type="button" class="btn btn-secondary btn-sm" id="signOutBtn">Sign Out</button>' +
          '    </div>' +
          '  </div>' +
          '</div>';
      } else {
        tabBody =
          (state.cloudAuthError ? '<div class="alert-error" style="margin-bottom:12px;">' + escapeHtml(state.cloudAuthError) + '</div>' : '') +
          '<form id="emailAuthForm" class="stack-md">' +
          '  <div style="display:flex;justify-content:space-between;align-items:center;">' +
          '    <strong style="font-size:13px;">' + (state.cloudAuthMode === 'signin' ? 'Sign In to Personal Account' : 'Create Personal Account') + '</strong>' +
          '    <button type="button" class="btn btn-ghost btn-sm" id="toggleAuthModeBtn" style="color:var(--primary);">' + (state.cloudAuthMode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in') + '</button>' +
          '  </div>' +
          '  <div class="grid-2">' +
          '    <input class="input" id="authEmailInput" type="email" placeholder="Email address" required />' +
          '    <input class="input" id="authPassInput" type="password" minlength="6" placeholder="Password (min 6 chars)" required />' +
          '  </div>' +
          '  <div style="display:flex;flex-wrap:wrap;gap:8px;">' +
          '    <button type="submit" class="btn btn-primary">' + (state.cloudAuthMode === 'signin' ? 'Sign In with Email' : 'Create Account') + '</button>' +
          '    <button type="button" class="btn btn-secondary" id="googleSignInBtn">Continue with Google</button>' +
          '  </div>' +
          '  <p style="margin:4px 0 0;font-size:11px;color:var(--text-soft);">Email/Google sign-in requires those providers enabled in Firebase Console → Authentication. Cloud Vault Key works immediately without auth setup.</p>' +
          '</form>';
      }
    } else {
      tabBody =
        '<div class="grid-2">' +
        '  <button type="button" class="mini-box" id="exportJsonBtn" style="text-align:left;cursor:pointer;"><strong style="font-size:13px;">Export Backup (JSON)</strong><div style="font-size:11px;color:var(--text-soft);margin-top:3px;">' + state.store.exams.length + ' exams · re-import anytime</div></button>' +
        '  <button type="button" class="mini-box" id="exportCsvBtn" style="text-align:left;cursor:pointer;"><strong style="font-size:13px;">Export Spreadsheet (CSV)</strong><div style="font-size:11px;color:var(--text-soft);margin-top:3px;">Open in Excel or Google Sheets</div></button>' +
        '</div>' +
        '<div class="mini-box" style="margin-top:12px;">' +
        '  <label style="display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;">' +
        '    <div><strong style="font-size:13px;">Import JSON Backup</strong><div style="font-size:11px;color:var(--text-soft);">Merges exams into your active cloud workspace</div></div>' +
        '    <span class="btn btn-secondary btn-sm">Choose File</span>' +
        '    <input type="file" id="importJsonFile" accept=".json,application/json" class="hidden" />' +
        '  </label>' +
        (state.cloudImportMsg ? '<div style="margin-top:8px;font-size:12px;color:var(--primary);font-weight:600;">' + escapeHtml(state.cloudImportMsg) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);">' +
        '  <button type="button" class="btn btn-secondary btn-sm" id="modalLoadSampleBtn">✨ Load Sample Dataset</button>' +
        (state.cloudConfirmClear
          ? '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:var(--rose-text);font-weight:700;">Erase all exams?</span><button type="button" class="btn btn-danger btn-sm" id="confirmClearAllBtn">Yes, Clear</button><button type="button" class="btn btn-ghost btn-sm" id="cancelClearAllBtn">Cancel</button></div>'
          : '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--rose-text);" id="askClearAllBtn">🗑 Clear All Exams</button>') +
        '</div>';
    }

    content.innerHTML =
      '<div class="modal-header">' +
      '  <div><h2 class="modal-title">Cloud Storage &amp; Anywhere Access</h2><p class="card-subtitle">Firebase Realtime Database · Project <span class="mono">yt-web-58043</span></p></div>' +
      '  <button type="button" class="icon-btn" data-close-modal="cloudModal">✕</button>' +
      '</div>' +
      '<div style="padding:10px 20px;background:var(--surface-subtle);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:12px;">' +
      '  <strong>' + escapeHtml(statusText) + '</strong>' +
      (state.lastSyncedAt ? '<span class="mono" style="font-size:11px;color:var(--text-soft);">' + new Date(state.lastSyncedAt).toLocaleTimeString() + '</span>' : '') +
      '</div>' +
      '<div class="modal-tabs">' +
      '  <button type="button" class="modal-tab-btn ' + (state.cloudModalTab === 'vault' ? 'active' : '') + '" data-cloud-tab="vault">Cloud Vault Key</button>' +
      '  <button type="button" class="modal-tab-btn ' + (state.cloudModalTab === 'account' ? 'active' : '') + '" data-cloud-tab="account">Firebase Account</button>' +
      '  <button type="button" class="modal-tab-btn ' + (state.cloudModalTab === 'backup' ? 'active' : '') + '" data-cloud-tab="backup">Export &amp; Backup</button>' +
      '</div>' +
      '<div class="modal-body stack-md">' + permBox + tabBody + '</div>';

    bindModalCloseButtons(content);
    content.querySelectorAll('[data-cloud-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.cloudModalTab = btn.getAttribute('data-cloud-tab');
        renderCloudModal();
      });
    });

    const copyRulesBtn = document.getElementById('copyRulesBtn');
    if (copyRulesBtn) {
      copyRulesBtn.addEventListener('click', function () {
        copyToClipboard(RECOMMENDED_RTDB_RULES, 'RTDB Rules copied!');
      });
    }
    const retrySyncBtn = document.getElementById('retrySyncBtn');
    if (retrySyncBtn) {
      retrySyncBtn.addEventListener('click', function () {
        attachCloudSubscription();
      });
    }

    const copyKeyBtn = document.getElementById('copyVaultKeyBtn');
    if (copyKeyBtn) {
      copyKeyBtn.addEventListener('click', function () {
        copyToClipboard(state.vaultKey, 'Vault Key copied!');
      });
    }
    const copyLinkBtn = document.getElementById('copyVaultLinkBtn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', function () {
        copyToClipboard(shareUrl, 'Sync Link copied!');
      });
    }
    const genVaultBtn = document.getElementById('genVaultBtn');
    if (genVaultBtn) {
      genVaultBtn.addEventListener('click', function () {
        document.getElementById('vaultKeyInput').value = A.generateVaultKey();
      });
    }
    const switchVaultForm = document.getElementById('switchVaultForm');
    if (switchVaultForm) {
      switchVaultForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const cleaned = sanitizeVaultKey(document.getElementById('vaultKeyInput').value);
        if (cleaned.length < 4) return;
        localStorage.setItem(STORAGE_VAULT_KEY, cleaned);
        localStorage.setItem(STORAGE_MODE_KEY, 'vault');
        state.syncMode = 'vault';
        if (cleaned !== state.vaultKey) {
          state.explicitSwitch = true;
          state.vaultKey = cleaned;
          attachCloudSubscription();
          showToast('Switched to Vault: ' + cleaned);
        }
        renderCloudModal();
      });
    }

    const toggleAuth = document.getElementById('toggleAuthModeBtn');
    if (toggleAuth) {
      toggleAuth.addEventListener('click', function () {
        state.cloudAuthMode = state.cloudAuthMode === 'signin' ? 'signup' : 'signin';
        state.cloudAuthError = null;
        renderCloudModal();
      });
    }
    const emailAuthForm = document.getElementById('emailAuthForm');
    if (emailAuthForm && auth) {
      emailAuthForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const email = document.getElementById('authEmailInput').value.trim();
        const pass = document.getElementById('authPassInput').value;
        state.cloudAuthError = null;
        const p =
          state.cloudAuthMode === 'signin'
            ? auth.signInWithEmailAndPassword(email, pass)
            : auth.createUserWithEmailAndPassword(email, pass);
        p.then(function () {
          localStorage.setItem(STORAGE_MODE_KEY, 'account');
          state.syncMode = 'account';
          attachCloudSubscription();
        }).catch(function (err) {
          state.cloudAuthError = formatFirebaseError(err);
          renderCloudModal();
        });
      });
    }
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn && auth && googleProvider) {
      googleBtn.addEventListener('click', function () {
        state.cloudAuthError = null;
        auth
          .signInWithPopup(googleProvider)
          .then(function () {
            localStorage.setItem(STORAGE_MODE_KEY, 'account');
            state.syncMode = 'account';
            attachCloudSubscription();
          })
          .catch(function (err) {
            state.cloudAuthError = formatFirebaseError(err);
            renderCloudModal();
          });
      });
    }
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn && auth) {
      signOutBtn.addEventListener('click', function () {
        auth.signOut().then(function () {
          localStorage.setItem(STORAGE_MODE_KEY, 'vault');
          state.syncMode = 'vault';
          attachCloudSubscription();
        });
      });
    }
    const useAccBtn = document.getElementById('useAccountModeBtn');
    if (useAccBtn) {
      useAccBtn.addEventListener('click', function () {
        localStorage.setItem(STORAGE_MODE_KEY, 'account');
        state.syncMode = 'account';
        attachCloudSubscription();
      });
    }

    const expJsonBtn = document.getElementById('exportJsonBtn');
    if (expJsonBtn) {
      expJsonBtn.addEventListener('click', function () {
        downloadFile(
          JSON.stringify({ exams: state.store.exams, exportedAt: new Date().toISOString() }, null, 2),
          'markpulse-backup-' + new Date().toISOString().slice(0, 10) + '.json',
          'application/json'
        );
      });
    }
    const expCsvBtn = document.getElementById('exportCsvBtn');
    if (expCsvBtn) {
      expCsvBtn.addEventListener('click', function () {
        downloadFile(
          A.exportExamsToCSV(state.store.exams),
          'markpulse-marks-' + new Date().toISOString().slice(0, 10) + '.csv',
          'text/csv;charset=utf-8'
        );
      });
    }
    const impInput = document.getElementById('importJsonFile');
    if (impInput) {
      impInput.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const parsed = JSON.parse(String(reader.result));
            const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed && parsed.exams) ? parsed.exams : null;
            if (!rawList) throw new Error('Expected a JSON array of exams or backup file.');
            const sanitized = A.sanitizeImportedExams(rawList);
            const map = new Map(state.store.exams.map(function (ex) { return [ex.id, ex]; }));
            sanitized.forEach(function (ex) { map.set(ex.id, ex); });
            persistAndSync(
              { exams: Array.from(map.values()), settings: state.store.settings, updatedAt: Date.now() },
              'Imported ' + sanitized.length + ' exam(s)'
            );
            state.cloudImportMsg = 'Imported ' + sanitized.length + ' exam(s) cleanly.';
          } catch (err) {
            state.cloudImportMsg = err.message || 'Invalid JSON file.';
          }
          renderCloudModal();
        };
        reader.readAsText(file);
      });
    }
    const loadSampleBtn = document.getElementById('modalLoadSampleBtn');
    if (loadSampleBtn) {
      loadSampleBtn.addEventListener('click', function () {
        loadSampleExams();
        document.getElementById('cloudModal').classList.add('hidden');
      });
    }
    const askClearBtn = document.getElementById('askClearAllBtn');
    if (askClearBtn) {
      askClearBtn.addEventListener('click', function () {
        state.cloudConfirmClear = true;
        renderCloudModal();
      });
    }
    const cancelClearBtn = document.getElementById('cancelClearAllBtn');
    if (cancelClearBtn) {
      cancelClearBtn.addEventListener('click', function () {
        state.cloudConfirmClear = false;
        renderCloudModal();
      });
    }
    const confirmClearBtn = document.getElementById('confirmClearAllBtn');
    if (confirmClearBtn) {
      confirmClearBtn.addEventListener('click', function () {
        state.cloudConfirmClear = false;
        document.getElementById('cloudModal').classList.add('hidden');
        persistAndSync({ exams: [], settings: state.store.settings, updatedAt: Date.now() }, 'All exams cleared');
      });
    }
  }

  // --- Settings Modal ---
  function openSettingsModal() {
    const s = state.store.settings;
    let draftScale = JSON.parse(JSON.stringify(s.gradeScale));

    function renderSettings() {
      const content = document.getElementById('settingsModalContent');
      const scaleHtml = draftScale
        .map(function (rule, idx) {
          return (
            '<div style="display:grid;grid-template-columns:1fr auto 90px;gap:10px;align-items:center;border:1px solid var(--border);border-radius:10px;padding:8px 10px;">' +
            '  <input class="input input-sm" data-scale-idx="' + idx + '" data-scale-field="label" value="' + escapeHtml(rule.label) + '" style="font-weight:700;" />' +
            '  <span style="font-size:11px;color:var(--text-soft);">Min % ≥</span>' +
            '  <input class="input input-sm mono" data-scale-idx="' + idx + '" data-scale-field="minPercentage" type="number" min="0" max="100" value="' + rule.minPercentage + '" style="text-align:right;font-weight:700;" />' +
            '</div>'
          );
        })
        .join('');

      content.innerHTML =
        '<div class="modal-header">' +
        '  <h2 class="modal-title">Goal &amp; Grading Settings</h2>' +
        '  <button type="button" class="icon-btn" data-close-modal="settingsModal">✕</button>' +
        '</div>' +
        '<form id="settingsForm" style="display:flex;flex-direction:column;flex:1;overflow:hidden;">' +
        '  <div class="modal-body stack-md">' +
        '    <div class="grid-2">' +
        '      <div><label class="field-label" for="targetPctInput">Target Percentage (%)</label><input class="input mono" id="targetPctInput" type="number" min="1" max="100" step="0.5" value="' + s.targetPercentage + '" style="font-weight:700;" /></div>' +
        '      <div><label class="field-label" for="passingPctInput">Passing Threshold (%)</label><input class="input mono" id="passingPctInput" type="number" min="0" max="99" step="0.5" value="' + s.passingPercentage + '" style="font-weight:700;" /></div>' +
        '    </div>' +
        '    <div>' +
        '      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span class="kpi-label">Grade Scale Thresholds</span><button type="button" class="btn btn-ghost btn-sm" id="resetScaleBtn" style="color:var(--primary);">Reset Default</button></div>' +
        '      <div class="stack-md">' + scaleHtml + '</div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="modal-footer">' +
        '    <span></span>' +
        '    <div style="display:flex;gap:8px;"><button type="button" class="btn btn-secondary" data-close-modal="settingsModal">Cancel</button><button type="submit" class="btn btn-primary">Save Settings</button></div>' +
        '  </div>' +
        '</form>';

      bindModalCloseButtons(content);
      content.querySelectorAll('[data-scale-idx]').forEach(function (inp) {
        inp.addEventListener('input', function (e) {
          const i = Number(e.target.getAttribute('data-scale-idx'));
          const f = e.target.getAttribute('data-scale-field');
          draftScale[i][f] = f === 'minPercentage' ? Number(e.target.value) || 0 : e.target.value;
        });
      });
      document.getElementById('resetScaleBtn').addEventListener('click', function () {
        draftScale = JSON.parse(JSON.stringify(A.DEFAULT_GRADE_SCALE));
        renderSettings();
      });
      document.getElementById('settingsForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const nextSettings = {
          targetPercentage: Math.min(100, Math.max(1, Number(document.getElementById('targetPctInput').value) || 85)),
          passingPercentage: Math.min(99, Math.max(0, Number(document.getElementById('passingPctInput').value) || 40)),
          theme: state.store.settings.theme,
          gradeScale: draftScale.slice().sort(function (a, b) { return b.minPercentage - a.minPercentage; }),
        };
        state.predictorTargetPct = nextSettings.targetPercentage;
        document.getElementById('settingsModal').classList.add('hidden');
        persistAndSync({ exams: state.store.exams, settings: nextSettings, updatedAt: Date.now() }, 'Settings saved');
      });
    }

    renderSettings();
    document.getElementById('settingsModal').classList.remove('hidden');
  }

  function copyToClipboard(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast(msg);
      });
    }
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function bindModalCloseButtons(rootEl) {
    (rootEl || document).querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-close-modal');
        document.getElementById(id).classList.add('hidden');
      });
    });
  }

  // --- Boot & Global Listeners ---
  function init() {
    document.querySelectorAll('.nav-btn[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeTab = btn.getAttribute('data-tab');
        renderAll();
      });
    });

    document.getElementById('addExamBtn').addEventListener('click', function () {
      openExamModal(null);
    });
    document.getElementById('cloudPillBtn').addEventListener('click', openCloudModal);
    document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
    document.getElementById('themeBtn').addEventListener('click', function () {
      const nextTheme = state.store.settings.theme === 'dark' ? 'light' : 'dark';
      const nextSettings = Object.assign({}, state.store.settings, { theme: nextTheme });
      persistAndSync({ exams: state.store.exams, settings: nextSettings, updatedAt: Date.now() });
    });

    document.getElementById('addSubjectRowBtn').addEventListener('click', function () {
      state.draftSubjects.push(makeEmptySubject(state.draftDefaultTotal));
      renderSubjectDraftRows();
    });
    document.getElementById('allowBonusCheck').addEventListener('change', function () {
      renderSubjectDraftRows();
    });
    document.getElementById('examForm').addEventListener('submit', handleExamFormSubmit);

    bindModalCloseButtons(document);

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        ['examModal', 'reportModal', 'cloudModal', 'settingsModal'].forEach(function (id) {
          document.getElementById(id).classList.add('hidden');
        });
      }
    });

    if (db) {
      db.ref('.info/connected').on('value', function (snap) {
        state.rtdbConnected = Boolean(snap.val());
        updateHeaderCloudUI();
      });
    }

    if (auth) {
      auth.onAuthStateChanged(function (user) {
        state.authUser = user ? { uid: user.uid, email: user.email } : null;
        if (!user && state.syncMode === 'account') {
          state.syncMode = 'vault';
          localStorage.setItem(STORAGE_MODE_KEY, 'vault');
        }
        attachCloudSubscription();
      });
    } else {
      attachCloudSubscription();
    }

    renderAll();
  }

  init();
})();
