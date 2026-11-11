import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  MessageSquarePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { AppSettings, Exam, SubjectMark } from '../types/marks';
import {
  createId,
  EXAM_CATEGORIES,
  QUICK_TOTAL_MARKS,
} from '../lib/defaults';
import {
  calcPercentage,
  formatMarks,
  formatPct,
  getGradeForPercentage,
} from '../lib/analytics';
import { GradeBadge } from './GradeBadge';

interface ExamModalProps {
  isOpen: boolean;
  editingExam: Exam | null;
  existingSubjectNames: string[];
  settings: AppSettings;
  onClose: () => void;
  onSave: (exam: Exam) => void;
}

interface DraftSubject {
  id: string;
  name: string;
  scoredMarks: string;
  totalMarks: string;
  notes: string;
  showNote: boolean;
}

function makeEmptySubject(defaultTotal: number): DraftSubject {
  return {
    id: createId('sub'),
    name: '',
    scoredMarks: '',
    totalMarks: String(defaultTotal),
    notes: '',
    showNote: false,
  };
}

export function ExamModal({
  isOpen,
  editingExam,
  existingSubjectNames,
  settings,
  onClose,
  onSave,
}: ExamModalProps) {
  const [name, setName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState(EXAM_CATEGORIES[0]);
  const [defaultTotal, setDefaultTotal] = useState<number>(100);
  const [notes, setNotes] = useState('');
  const [allowBonus, setAllowBonus] = useState(false);
  const [subjects, setSubjects] = useState<DraftSubject[]>([
    makeEmptySubject(100),
    makeEmptySubject(100),
    makeEmptySubject(100),
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (editingExam) {
      setName(editingExam.name);
      setDate(editingExam.date);
      setCategory(editingExam.category || EXAM_CATEGORIES[0]);
      const defTot = editingExam.defaultTotalMarks || 100;
      setDefaultTotal(defTot);
      setNotes(editingExam.notes ?? '');
      const hasBonus = editingExam.subjects.some(
        (s) => s.scoredMarks > s.totalMarks
      );
      setAllowBonus(hasBonus);
      setSubjects(
        editingExam.subjects.map((s) => ({
          id: s.id || createId('sub'),
          name: s.name,
          scoredMarks: String(s.scoredMarks),
          totalMarks: String(s.totalMarks),
          notes: s.notes ?? '',
          showNote: Boolean(s.notes),
        }))
      );
    } else {
      setName('');
      setDate(new Date().toISOString().slice(0, 10));
      setCategory(EXAM_CATEGORIES[0]);
      setDefaultTotal(100);
      setNotes('');
      setAllowBonus(false);
      setSubjects([
        makeEmptySubject(100),
        makeEmptySubject(100),
        makeEmptySubject(100),
      ]);
    }
  }, [isOpen, editingExam]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const unusedSuggestions = useMemo(() => {
    const used = new Set(subjects.map((s) => s.name.trim().toLowerCase()));
    return existingSubjectNames.filter((n) => !used.has(n.toLowerCase()));
  }, [existingSubjectNames, subjects]);

  const liveSummary = useMemo(() => {
    let totalScored = 0;
    let totalMax = 0;
    let validRows = 0;
    for (const s of subjects) {
      const scored = Number(s.scoredMarks);
      const total = Number(s.totalMarks);
      if (s.name.trim() && Number.isFinite(total) && total > 0) {
        validRows += 1;
        totalMax += total;
        if (s.scoredMarks !== '' && Number.isFinite(scored) && scored >= 0) {
          totalScored += scored;
        }
      }
    }
    const pct = calcPercentage(totalScored, totalMax);
    const grade = getGradeForPercentage(pct, settings.gradeScale);
    return { totalScored, totalMax, pct, grade, validRows };
  }, [subjects, settings.gradeScale]);

  if (!isOpen) return null;

  const updateSubject = (id: string, patch: Partial<DraftSubject>) => {
    setSubjects((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const addSubjectRow = (prefillName = '') => {
    setSubjects((prev) => {
      // Fill first empty-name row if prefilling from suggestion pill
      if (prefillName) {
        const emptyIdx = prev.findIndex((r) => !r.name.trim() && !r.scoredMarks);
        if (emptyIdx !== -1) {
          return prev.map((r, i) =>
            i === emptyIdx ? { ...r, name: prefillName } : r
          );
        }
      }
      return [
        ...prev,
        {
          ...makeEmptySubject(defaultTotal),
          name: prefillName,
        },
      ];
    });
  };

  const removeSubjectRow = (id: string) => {
    setSubjects((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const applyDefaultTotalToAll = (newTotal: number) => {
    setDefaultTotal(newTotal);
    setSubjects((prev) =>
      prev.map((r) => ({ ...r, totalMarks: String(newTotal) }))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter an exam name (e.g., Mid-Term Exam or Unit Test 1).');
      return;
    }
    if (!date) {
      setError('Please select an exam date.');
      return;
    }

    const nonEmptyRows = subjects.filter(
      (s) => s.name.trim() !== '' || s.scoredMarks !== ''
    );
    if (nonEmptyRows.length === 0) {
      setError('Please add at least one subject with marks.');
      return;
    }

    const parsedSubjects: SubjectMark[] = [];
    for (let i = 0; i < nonEmptyRows.length; i++) {
      const row = nonEmptyRows[i];
      const subName = row.name.trim();
      if (!subName) {
        setError(`Row ${i + 1} has marks entered without a subject name.`);
        return;
      }
      const scored = Number(row.scoredMarks);
      const total = Number(row.totalMarks);
      if (row.scoredMarks === '' || !Number.isFinite(scored) || scored < 0) {
        setError(`Please enter valid non-negative marks scored for "${subName}".`);
        return;
      }
      if (!Number.isFinite(total) || total <= 0) {
        setError(`Total marks for "${subName}" must be greater than 0.`);
        return;
      }
      if (!allowBonus && scored > total) {
        setError(
          `Scored marks (${scored}) exceed total marks (${total}) for "${subName}". Enable "Allow bonus marks" if intentional.`
        );
        return;
      }

      parsedSubjects.push({
        id: row.id || createId('sub'),
        name: subName,
        scoredMarks: scored,
        totalMarks: total,
        ...(row.notes.trim() ? { notes: row.notes.trim() } : {}),
      });
    }

    const now = Date.now();
    const exam: Exam = {
      id: editingExam?.id ?? createId('exam'),
      name: trimmedName,
      date,
      category: category.trim() || 'Exam',
      defaultTotalMarks: Math.max(1, defaultTotal || 100),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      subjects: parsedSubjects,
      createdAt: editingExam?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(exam);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingExam ? 'Edit Exam & Marks' : 'Add New Exam'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set custom total marks per exam or per subject. Syncs automatically to cloud.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Exam Metadata */}
            <div className="grid gap-3.5 sm:grid-cols-12">
              <div className="sm:col-span-5">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Exam Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Mid-Term Examination"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Exam Date *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Category / Term
                </label>
                <input
                  type="text"
                  list="exam-categories-list"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Unit Test, Final..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <datalist id="exam-categories-list">
                  {EXAM_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Default Total Marks Quick-Setter */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Default Max Marks per Subject
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Set a quick default or customize each subject&apos;s total marks individually below.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_TOTAL_MARKS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => applyDefaultTotalToAll(val)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold font-mono-num transition cursor-pointer ${
                        defaultTotal === val
                          ? 'bg-indigo-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 ml-1">
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={defaultTotal}
                      onChange={(e) => setDefaultTotal(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold font-mono-num text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      aria-label="Custom default total marks"
                    />
                    <button
                      type="button"
                      onClick={() => applyDefaultTotalToAll(defaultTotal)}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300 cursor-pointer"
                    >
                      Apply All
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Reuse Existing Subjects */}
            {unusedSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1">
                  Quick add subject:
                </span>
                {unusedSuggestions.slice(0, 10).map((subName) => (
                  <button
                    key={subName}
                    type="button"
                    onClick={() => addSubjectRow(subName)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/15 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" />
                    {subName}
                  </button>
                ))}
              </div>
            )}

            {/* Subjects Table */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Subjects &amp; Marks ({subjects.length})
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowBonus}
                    onChange={(e) => setAllowBonus(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Allow bonus marks (&gt; total)
                </label>
              </div>

              <datalist id="existing-subjects-datalist">
                {existingSubjectNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>

              <div className="space-y-2">
                {subjects.map((row, idx) => {
                  const scoredNum = Number(row.scoredMarks);
                  const totalNum = Number(row.totalMarks);
                  const hasValidNums =
                    row.scoredMarks !== '' &&
                    Number.isFinite(scoredNum) &&
                    Number.isFinite(totalNum) &&
                    totalNum > 0;
                  const rowPct = hasValidNums ? calcPercentage(scoredNum, totalNum) : 0;
                  const rowGrade = getGradeForPercentage(rowPct, settings.gradeScale);
                  const exceedsTotal = !allowBonus && hasValidNums && scoredNum > totalNum;

                  return (
                    <div
                      key={row.id}
                      className={`rounded-xl border p-2.5 transition ${
                        exceedsTotal
                          ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/5'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-12 sm:col-span-5">
                          <input
                            type="text"
                            list="existing-subjects-datalist"
                            value={row.name}
                            onChange={(e) =>
                              updateSubject(row.id, { name: e.target.value })
                            }
                            placeholder={`Subject ${idx + 1} (e.g., Mathematics)`}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>

                        <div className="col-span-5 sm:col-span-2">
                          <div className="relative">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={row.scoredMarks}
                              onChange={(e) =>
                                updateSubject(row.id, { scoredMarks: e.target.value })
                              }
                              placeholder="Scored"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold font-mono-num text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              aria-label={`Scored marks for subject ${idx + 1}`}
                            />
                          </div>
                        </div>

                        <div className="col-span-1 text-center text-xs font-bold text-slate-400">
                          /
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <input
                            type="number"
                            min={1}
                            step="any"
                            value={row.totalMarks}
                            onChange={(e) =>
                              updateSubject(row.id, { totalMarks: e.target.value })
                            }
                            placeholder="Total"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-mono-num text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            aria-label={`Total marks for subject ${idx + 1}`}
                          />
                        </div>

                        <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end gap-1.5">
                          {hasValidNums ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold font-mono-num text-slate-700 dark:text-slate-200">
                                {formatPct(rowPct)}
                              </span>
                              <GradeBadge grade={rowGrade} />
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}

                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() =>
                                updateSubject(row.id, { showNote: !row.showNote })
                              }
                              title="Add subject note / remark"
                              className={`rounded-lg p-1.5 transition cursor-pointer ${
                                row.showNote || row.notes
                                  ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/15 dark:text-indigo-300'
                                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800'
                              }`}
                            >
                              <MessageSquarePlus className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => removeSubjectRow(row.id)}
                              disabled={subjects.length === 1}
                              title="Remove subject"
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {row.showNote && (
                        <div className="mt-2">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) =>
                              updateSubject(row.id, { notes: e.target.value })
                            }
                            placeholder="Optional subject remark (e.g., Silly calculation error in Q4)"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => addSubjectRow()}
                className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-xs font-semibold text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Another Subject
              </button>
            </div>

            {/* Exam Reflection Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Overall Exam Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reflections, topics to revise, or exam conditions..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Live Summary & Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/90 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Live Total:
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                  {formatMarks(liveSummary.totalScored)} / {formatMarks(liveSummary.totalMax)}
                </span>
                <span className="text-sm font-bold font-mono-num text-indigo-600 dark:text-indigo-400">
                  ({formatPct(liveSummary.pct)})
                </span>
                {liveSummary.totalMax > 0 && (
                  <GradeBadge grade={liveSummary.grade} size="sm" />
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                {editingExam ? 'Save Changes' : 'Save Exam'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

