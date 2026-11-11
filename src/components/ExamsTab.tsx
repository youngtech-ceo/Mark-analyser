import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Copy,
  Edit3,
  FileText,
  LayoutGrid,
  List,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import type { AppSettings, Exam, ExamSummary } from '../types/marks';
import { calcPercentage, formatMarks, formatPct } from '../lib/analytics';
import { GradeBadge, getBarColor } from './GradeBadge';

interface ExamsTabProps {
  examSummaries: ExamSummary[];
  settings: AppSettings;
  onAddExam: () => void;
  onEditExam: (exam: Exam) => void;
  onDuplicateExam: (exam: Exam) => void;
  onDeleteExam: (examId: string) => void;
  onInspectExam: (summary: ExamSummary) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'pct-desc' | 'pct-asc';

export function ExamsTab({
  examSummaries,
  settings,
  onAddExam,
  onEditExam,
  onDuplicateExam,
  onDeleteExam,
  onInspectExam,
}: ExamsTabProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const s of examSummaries) {
      if (s.exam.category) set.add(s.exam.category);
    }
    return ['ALL', ...Array.from(set)];
  }, [examSummaries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = examSummaries.filter((s) => {
      if (categoryFilter !== 'ALL' && s.exam.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.exam.name.toLowerCase().includes(q) ||
        s.exam.category.toLowerCase().includes(q) ||
        (s.exam.notes ?? '').toLowerCase().includes(q) ||
        s.exam.subjects.some((sub) => sub.name.toLowerCase().includes(q))
      );
    });

    list.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return a.exam.date.localeCompare(b.exam.date);
        case 'pct-desc':
          return b.percentage - a.percentage;
        case 'pct-asc':
          return a.percentage - b.percentage;
        case 'date-desc':
        default:
          return (
            b.exam.date.localeCompare(a.exam.date) ||
            (b.exam.createdAt ?? 0) - (a.exam.createdAt ?? 0)
          );
      }
    });

    return list;
  }, [examSummaries, search, categoryFilter, sortBy]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exam, subject, or notes..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'All Categories' : cat}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort exams"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="pct-desc">Highest % First</option>
            <option value="pct-asc">Lowest % First</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Card View"
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`rounded-lg p-1.5 transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onAddExam}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Exam
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            No exams match your current search or filter.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((summary) => (
            <div
              key={summary.exam.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {summary.exam.category}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar className="h-3.5 w-3.5" />
                        {summary.exam.date}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
                      {summary.exam.name}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xl font-extrabold font-mono-num text-slate-900 dark:text-white">
                        {formatPct(summary.percentage)}
                      </span>
                      <GradeBadge grade={summary.grade} />
                    </div>
                    <div className="mt-0.5 flex items-center justify-end gap-2 text-xs font-mono-num text-slate-500 dark:text-slate-400">
                      <span>
                        {formatMarks(summary.totalScored)} /{' '}
                        {formatMarks(summary.totalMax)}
                      </span>
                      {summary.deltaFromPrevious !== null && (
                        <span
                          className={`inline-flex items-center font-semibold ${
                            summary.deltaFromPrevious >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {summary.deltaFromPrevious >= 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {summary.deltaFromPrevious >= 0 ? '+' : ''}
                          {summary.deltaFromPrevious.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overall progress bar */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full ${getBarColor(
                      summary.percentage,
                      settings.targetPercentage,
                      settings.passingPercentage
                    )}`}
                    style={{
                      width: `${Math.min(100, Math.max(2, summary.percentage))}%`,
                    }}
                  />
                </div>

                {/* Subject chips */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {summary.exam.subjects.map((sub) => {
                    const pct = calcPercentage(sub.scoredMarks, sub.totalMarks);
                    const isBelowPass = pct < settings.passingPercentage;
                    const isAboveTarget = pct >= settings.targetPercentage;
                    return (
                      <div
                        key={sub.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                          isBelowPass
                            ? 'border-rose-200 bg-rose-50/70 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
                            : isAboveTarget
                            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200'
                        }`}
                      >
                        <span className="font-medium">{sub.name}</span>
                        <span className="font-mono-num font-bold">
                          {formatMarks(sub.scoredMarks)}/{formatMarks(sub.totalMarks)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {summary.exam.notes && (
                  <p className="mt-3 text-xs italic text-slate-500 dark:text-slate-400">
                    “{summary.exam.notes}”
                  </p>
                )}
              </div>

              {/* Card Actions */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onInspectExam(summary)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/15 cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Report Card
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDuplicateExam(summary.exam)}
                    title="Duplicate exam subjects for next test"
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditExam(summary.exam)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>

                  {confirmDeleteId === summary.exam.id ? (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteExam(summary.exam.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500 cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(summary.exam.id)}
                      title="Delete exam"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Compact Table View */
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Exam</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-center">Subjects</th>
                <th className="px-4 py-3 text-right">Marks</th>
                <th className="px-4 py-3 text-right">Percentage</th>
                <th className="px-4 py-3 text-center">Grade</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((summary) => (
                <tr
                  key={summary.exam.id}
                  className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    <button
                      type="button"
                      onClick={() => onInspectExam(summary)}
                      className="hover:text-indigo-600 dark:hover:text-indigo-400 text-left cursor-pointer"
                    >
                      {summary.exam.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono-num text-slate-500 dark:text-slate-400">
                    {summary.exam.date}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {summary.exam.category}
                  </td>
                  <td className="px-4 py-3 text-center font-mono-num text-slate-600 dark:text-slate-300">
                    {summary.subjectCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-medium text-slate-700 dark:text-slate-200">
                    {formatMarks(summary.totalScored)} / {formatMarks(summary.totalMax)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                    {formatPct(summary.percentage)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <GradeBadge grade={summary.grade} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onInspectExam(summary)}
                        title="Report Card"
                        className="rounded-md p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/15 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateExam(summary.exam)}
                        title="Duplicate"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditExam(summary.exam)}
                        title="Edit"
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === summary.exam.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteExam(summary.exam.id);
                            setConfirmDeleteId(null);
                          }}
                          className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(summary.exam.id)}
                          title="Delete"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

