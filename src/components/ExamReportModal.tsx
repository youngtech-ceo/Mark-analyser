import { useEffect } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Edit3,
  Printer,
  X,
} from 'lucide-react';
import type { AppSettings, ExamSummary, SubjectStats } from '../types/marks';
import {
  calcPercentage,
  canonicalSubjectKey,
  formatMarks,
  formatPct,
  getGradeForPercentage,
} from '../lib/analytics';
import { GradeBadge, getBarColor } from './GradeBadge';

interface ExamReportModalProps {
  summary: ExamSummary | null;
  subjectStats: SubjectStats[];
  settings: AppSettings;
  onClose: () => void;
  onEdit: () => void;
}

export function ExamReportModal({
  summary,
  subjectStats,
  settings,
  onClose,
  onEdit,
}: ExamReportModalProps) {
  useEffect(() => {
    if (!summary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [summary, onClose]);

  if (!summary) return null;

  const subjectAvgMap = new Map<string, number>();
  for (const st of subjectStats) {
    subjectAvgMap.set(st.key, st.weightedAveragePct);
  }

  const sortedSubjects = [...summary.exam.subjects]
    .map((s) => {
      const pct = calcPercentage(s.scoredMarks, s.totalMarks);
      const avg = subjectAvgMap.get(canonicalSubjectKey(s.name)) ?? pct;
      return {
        ...s,
        pct,
        grade: getGradeForPercentage(pct, settings.gradeScale),
        vsAvg: pct - avg,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
      <div className="print-only-area flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {summary.exam.category}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Calendar className="h-3.5 w-3.5" />
                {summary.exam.date}
              </span>
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">
              {summary.exam.name}
            </h2>
          </div>

          <div className="no-print flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Total Score
              </div>
              <div className="mt-1 text-base font-bold font-mono-num text-slate-900 dark:text-white">
                {formatMarks(summary.totalScored)} / {formatMarks(summary.totalMax)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Overall %
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-base font-bold font-mono-num text-indigo-600 dark:text-indigo-400">
                  {formatPct(summary.percentage)}
                </span>
                <GradeBadge grade={summary.grade} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                vs Previous Exam
              </div>
              <div className="mt-1 text-base font-bold font-mono-num">
                {summary.deltaFromPrevious === null ? (
                  <span className="text-slate-400">First Exam</span>
                ) : summary.deltaFromPrevious >= 0 ? (
                  <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRight className="h-4 w-4" />+
                    {summary.deltaFromPrevious.toFixed(1)}%
                  </span>
                ) : (
                  <span className="inline-flex items-center text-rose-600 dark:text-rose-400">
                    <ArrowDownRight className="h-4 w-4" />
                    {summary.deltaFromPrevious.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Subjects Passed
              </div>
              <div className="mt-1 text-base font-bold font-mono-num text-slate-900 dark:text-white">
                {summary.passedCount} / {summary.subjectCount}
              </div>
            </div>
          </div>

          {/* Subject Breakdown */}
          <div>
            <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Subject Breakdown (Ranked Highest to Lowest)
            </h3>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {sortedSubjects.map((sub, index) => (
                <div key={sub.id} className="p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-bold font-mono-num text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {sub.name}
                        </div>
                        {sub.notes && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {sub.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                          {formatMarks(sub.scoredMarks)}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            / {formatMarks(sub.totalMarks)}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                          {Math.abs(sub.vsAvg) >= 0.1
                            ? `${sub.vsAvg >= 0 ? '+' : ''}${sub.vsAvg.toFixed(1)}% vs your avg`
                            : 'Matches your avg'}
                        </div>
                      </div>
                      <span className="w-14 text-right text-sm font-bold font-mono-num text-slate-800 dark:text-slate-100">
                        {formatPct(sub.pct)}
                      </span>
                      <GradeBadge grade={sub.grade} />
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${getBarColor(
                        sub.pct,
                        settings.targetPercentage,
                        settings.passingPercentage
                      )}`}
                      style={{ width: `${Math.min(100, Math.max(2, sub.pct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {summary.exam.notes && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">
                Exam Notes:{' '}
              </span>
              {summary.exam.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

