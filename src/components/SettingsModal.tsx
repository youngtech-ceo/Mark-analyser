import { useEffect, useState } from 'react';
import { Check, RotateCcw, Settings, X } from 'lucide-react';
import type { AppSettings, GradeRule } from '../types/marks';
import { DEFAULT_GRADE_SCALE } from '../lib/defaults';

interface SettingsModalProps {
  isOpen: boolean;
  settings: AppSettings;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

export function SettingsModal({
  isOpen,
  settings,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [targetPct, setTargetPct] = useState(settings.targetPercentage);
  const [passingPct, setPassingPct] = useState(settings.passingPercentage);
  const [gradeScale, setGradeScale] = useState<GradeRule[]>(settings.gradeScale);

  useEffect(() => {
    if (!isOpen) return;
    setTargetPct(settings.targetPercentage);
    setPassingPct(settings.passingPercentage);
    setGradeScale(settings.gradeScale);
  }, [isOpen, settings]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const updateGradeRule = (index: number, patch: Partial<GradeRule>) => {
    setGradeScale((prev) =>
      prev.map((rule, idx) => (idx === index ? { ...rule, ...patch } : rule))
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedScale = [...gradeScale].sort(
      (a, b) => b.minPercentage - a.minPercentage
    );
    onSave({
      ...settings,
      targetPercentage: Math.min(100, Math.max(1, targetPct)),
      passingPercentage: Math.min(99, Math.max(0, passingPct)),
      gradeScale: cleanedScale,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Goal &amp; Grading Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Percentage (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={0.5}
                  value={targetPct}
                  onChange={(e) => setTargetPct(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold font-mono-num text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Used as your benchmark line on charts and gap insights.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Passing Threshold (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  step={0.5}
                  value={passingPct}
                  onChange={(e) => setPassingPct(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold font-mono-num text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Papers below this % trigger at-risk alerts.
                </p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Grade Scale Thresholds
                </span>
                <button
                  type="button"
                  onClick={() => setGradeScale(DEFAULT_GRADE_SCALE)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset Default
                </button>
              </div>

              <div className="space-y-2">
                {gradeScale.map((rule, idx) => (
                  <div
                    key={`${rule.label}_${idx}`}
                    className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={rule.label}
                        onChange={(e) =>
                          updateGradeRule(idx, { label: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <div className="col-span-4 text-right text-[11px] text-slate-500 dark:text-slate-400">
                      Min % ≥
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.minPercentage}
                        onChange={(e) =>
                          updateGradeRule(idx, {
                            minPercentage: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold font-mono-num text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

