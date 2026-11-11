import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Calculator,
  CheckCircle2,
  Target,
} from 'lucide-react';
import type { AppSettings, OverallAnalytics } from '../types/marks';
import {
  formatMarks,
  formatPct,
  predictRequiredScore,
} from '../lib/analytics';

interface PredictorTabProps {
  analytics: OverallAnalytics;
  settings: AppSettings;
}

export function PredictorTab({ analytics, settings }: PredictorTabProps) {
  const [scope, setScope] = useState<string>('OVERALL');
  const [targetPct, setTargetPct] = useState<number>(settings.targetPercentage);
  const [upcomingMax, setUpcomingMax] = useState<number>(100);
  const [assumedPacePct, setAssumedPacePct] = useState<number>(92);
  const [matrixPerSubjectMax, setMatrixPerSubjectMax] = useState<number>(100);

  const selectedContext = useMemo(() => {
    if (scope === 'OVERALL') {
      return {
        label: 'Overall Cumulative Average',
        currentScored: analytics.totalScored,
        currentMax: analytics.totalMax,
        currentPct: analytics.weightedOverallPct,
      };
    }
    const sub = analytics.subjectStats.find((s) => s.key === scope);
    if (!sub) {
      return {
        label: 'Overall Cumulative Average',
        currentScored: analytics.totalScored,
        currentMax: analytics.totalMax,
        currentPct: analytics.weightedOverallPct,
      };
    }
    return {
      label: sub.displayName,
      currentScored: sub.totalScored,
      currentMax: sub.totalMax,
      currentPct: sub.weightedAveragePct,
    };
  }, [scope, analytics]);

  const prediction = useMemo(
    () =>
      predictRequiredScore({
        currentScored: selectedContext.currentScored,
        currentMax: selectedContext.currentMax,
        upcomingMax,
        targetPct,
        assumedPacePct,
      }),
    [selectedContext, upcomingMax, targetPct, assumedPacePct]
  );

  const statusMeta = {
    'already-met': {
      badge: 'Buffer Available',
      color:
        'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
      headline: `You already exceed ${targetPct}%!`,
      subtext: `Even scoring 0 marks in the next ${upcomingMax}-mark exam keeps you on track, though aiming for ${targetPct}% protects your buffer.`,
    },
    achievable: {
      badge: 'Comfortably Achievable',
      color:
        'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300',
      icon: <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      headline: `Need ${formatMarks(Math.ceil(prediction.requiredMarks * 10) / 10)} / ${upcomingMax}`,
      subtext: `Scoring ${formatPct(prediction.requiredPct)} in your next ${upcomingMax}-mark exam will bring ${selectedContext.label} to exactly ${targetPct}%.`,
    },
    stretch: {
      badge: 'High-Effort Stretch (≥ 90%)',
      color:
        'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
      icon: <Award className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      headline: `Need ${formatMarks(Math.ceil(prediction.requiredMarks * 10) / 10)} / ${upcomingMax}`,
      subtext: `This requires ${formatPct(prediction.requiredPct)} on the upcoming exam — challenging, but mathematically possible in one shot.`,
    },
    'impossible-single': {
      badge: 'Needs Multiple Exams',
      color:
        'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
      icon: <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
      headline: `Requires ${formatPct(prediction.requiredPct)} (>100%)`,
      subtext: `A single ${upcomingMax}-mark exam cannot reach ${targetPct}% alone (even 100% yields ${formatPct(
        ((selectedContext.currentScored + upcomingMax) /
          prediction.projectedNewTotalMax) *
          100
      )}).`,
    },
  }[prediction.status];

  const subjectMatrixRows = useMemo(() => {
    return analytics.subjectStats.map((sub) => {
      const res = predictRequiredScore({
        currentScored: sub.totalScored,
        currentMax: sub.totalMax,
        upcomingMax: matrixPerSubjectMax,
        targetPct,
        assumedPacePct,
      });
      return { sub, res };
    });
  }, [analytics.subjectStats, matrixPerSubjectMax, targetPct, assumedPacePct]);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Calculator Controls */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              What-If Target Score Calculator
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Simulate what marks you need in your next exam to hit your desired percentage
          </p>

          <div className="mt-5 space-y-4">
            {/* Scope selector */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Scope
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="OVERALL">
                  Overall Cumulative Average ({formatPct(analytics.weightedOverallPct)})
                </option>
                {analytics.subjectStats.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.displayName} (Current: {formatPct(s.weightedAveragePct)})
                  </option>
                ))}
              </select>
            </div>

            {/* Target % slider */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Average (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={0.5}
                    value={targetPct}
                    onChange={(e) =>
                      setTargetPct(
                        Math.min(100, Math.max(1, Number(e.target.value) || 1))
                      )
                    }
                    className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-bold font-mono-num text-indigo-600 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-indigo-400"
                  />
                  <span className="text-xs font-bold text-slate-400">%</span>
                </div>
              </div>
              <input
                type="range"
                min={30}
                max={99}
                step={0.5}
                value={targetPct}
                onChange={(e) => setTargetPct(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Upcoming Exam Max Marks */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Upcoming Exam Total Marks
              </label>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {[25, 50, 80, 100, 200, 300, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setUpcomingMax(val)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold font-mono-num transition cursor-pointer ${
                      upcomingMax === val
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={1}
                step="any"
                value={upcomingMax}
                onChange={(e) =>
                  setUpcomingMax(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold font-mono-num text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {prediction.status === 'impossible-single' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Multi-Exam Recovery Pace (% per exam)</span>
                  <span className="font-mono-num text-indigo-600 dark:text-indigo-400">
                    {assumedPacePct}%
                  </span>
                </div>
                <input
                  type="range"
                  min={Math.min(99, Math.ceil(targetPct + 1))}
                  max={100}
                  step={1}
                  value={assumedPacePct}
                  onChange={(e) => setAssumedPacePct(Number(e.target.value))}
                  className="mt-2 w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Result Panel */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Projection Result
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.color}`}
              >
                {statusMeta.badge}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                {statusMeta.icon}
                <h4 className="text-xl font-extrabold font-mono-num text-slate-900 dark:text-white">
                  {statusMeta.headline}
                </h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {statusMeta.subtext}
              </p>

              {prediction.examsNeededAtAssumedPace !== null && (
                <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  At <strong>{assumedPacePct}%</strong> per upcoming {upcomingMax}-mark exam, you will reach{' '}
                  <strong>{targetPct}%</strong> in{' '}
                  <strong className="text-indigo-600 dark:text-indigo-400">
                    {prediction.examsNeededAtAssumedPace} exam
                    {prediction.examsNeededAtAssumedPace === 1 ? '' : 's'}
                  </strong>
                  .
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Current Marks
              </div>
              <div className="mt-0.5 text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                {formatMarks(selectedContext.currentScored)} /{' '}
                {formatMarks(selectedContext.currentMax)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Current Avg
              </div>
              <div className="mt-0.5 text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                {formatPct(selectedContext.currentPct)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                New Total Pool
              </div>
              <div className="mt-0.5 text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                {formatMarks(prediction.projectedNewTotalMax)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subject-by-Subject Next Exam Target Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Subject-by-Subject Target Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Exact marks needed in your next paper per subject to reach {targetPct}% overall in each subject
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">
              Next paper max marks:
            </span>
            <input
              type="number"
              min={1}
              value={matrixPerSubjectMax}
              onChange={(e) =>
                setMatrixPerSubjectMax(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-center font-bold font-mono-num text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 text-right">Current Marks</th>
                <th className="px-4 py-3 text-right">Current Avg</th>
                <th className="px-4 py-3 text-right">
                  Needed / {matrixPerSubjectMax}
                </th>
                <th className="px-4 py-3 text-right">Required %</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {subjectMatrixRows.map(({ sub, res }) => (
                <tr
                  key={sub.key}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {sub.displayName}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-slate-500 dark:text-slate-400">
                    {formatMarks(sub.totalScored)} / {formatMarks(sub.totalMax)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold text-slate-800 dark:text-slate-200">
                    {formatPct(sub.weightedAveragePct)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                    {res.status === 'already-met'
                      ? '0 (Buffer)'
                      : `${formatMarks(Math.ceil(res.requiredMarks * 10) / 10)} / ${matrixPerSubjectMax}`}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold">
                    {res.status === 'already-met' ? '0.0%' : formatPct(res.requiredPct)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {res.status === 'already-met' && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        Above Target
                      </span>
                    )}
                    {res.status === 'achievable' && (
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        Achievable
                      </span>
                    )}
                    {res.status === 'stretch' && (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        Stretch
                      </span>
                    )}
                    {res.status === 'impossible-single' && (
                      <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                        2+ Exams
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

