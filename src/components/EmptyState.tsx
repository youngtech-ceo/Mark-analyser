import { Cloud, Database, Plus, Sparkles, TrendingUp } from 'lucide-react';

interface EmptyStateProps {
  onAddExam: () => void;
  onLoadSample: () => void;
  onOpenCloud: () => void;
  vaultKey: string;
}

export function EmptyState({
  onAddExam,
  onLoadSample,
  onOpenCloud,
  vaultKey,
}: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-3xl py-10 sm:py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
          <TrendingUp className="h-7 w-7" />
        </div>

        <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Welcome to Your Personal Mark Analyser
        </h2>
        <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Log your exams, add subjects with custom total marks for each paper, and unlock
          trajectory trends, subject gap analysis, heatmaps, and target score predictions —
          automatically synced to Firebase Cloud so you can check your progress anywhere.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAddExam}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-500 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Your First Exam
          </button>

          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            Explore with Sample Data
          </button>

          <button
            type="button"
            onClick={onOpenCloud}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            <Cloud className="h-4 w-4 text-indigo-500" />
            Connect Existing Vault / Sign In
          </button>
        </div>

        <div className="mt-8 grid gap-4 border-t border-slate-100 pt-7 text-left sm:grid-cols-3 dark:border-slate-800">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Flexible Total Marks
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Set custom max marks per exam or individually per subject (25, 50, 80, 100, or any number).
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Deep Telemetry
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Weighted averages, linear trendlines, consistency scores, subject × exam heatmaps, and target predictors.
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <Database className="h-3.5 w-3.5" />
              Cloud Vault Ready
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Current Vault: <span className="font-mono-num font-semibold">{vaultKey}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

