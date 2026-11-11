import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Grid3X3,
  TrendingUp,
} from 'lucide-react';
import type {
  AppSettings,
  ExamSummary,
  OverallAnalytics,
  SubjectStats,
} from '../types/marks';
import { formatMarks, formatPct, getGradeForPercentage } from '../lib/analytics';
import { GradeBadge } from './GradeBadge';

interface SubjectsTabProps {
  analytics: OverallAnalytics;
  settings: AppSettings;
  focusedSubjectKey: string | null;
  onInspectExam: (summary: ExamSummary) => void;
}

export function SubjectsTab({
  analytics,
  settings,
  focusedSubjectKey,
  onInspectExam,
}: SubjectsTabProps) {
  const [selectedKey, setSelectedKey] = useState<string>(
    focusedSubjectKey ?? analytics.subjectStats[0]?.key ?? ''
  );

  useEffect(() => {
    if (focusedSubjectKey) {
      setSelectedKey(focusedSubjectKey);
    } else if (
      !analytics.subjectStats.some((s) => s.key === selectedKey) &&
      analytics.subjectStats[0]
    ) {
      setSelectedKey(analytics.subjectStats[0].key);
    }
  }, [focusedSubjectKey, analytics.subjectStats, selectedKey]);

  const activeSubject: SubjectStats | null = useMemo(
    () =>
      analytics.subjectStats.find((s) => s.key === selectedKey) ??
      analytics.subjectStats[0] ??
      null,
    [analytics.subjectStats, selectedKey]
  );

  const radarData = useMemo(
    () =>
      analytics.subjectStats.slice(0, 8).map((s) => ({
        subject:
          s.displayName.length > 13
            ? `${s.displayName.slice(0, 11)}…`
            : s.displayName,
        fullName: s.displayName,
        average: Number(s.weightedAveragePct.toFixed(1)),
        target: settings.targetPercentage,
      })),
    [analytics.subjectStats, settings.targetPercentage]
  );

  const getHeatmapCellStyle = (pct: number | null) => {
    if (pct === null) {
      return 'bg-slate-50 text-slate-300 dark:bg-slate-800/30 dark:text-slate-600';
    }
    if (pct >= settings.targetPercentage) {
      return 'bg-emerald-500/15 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30';
    }
    if (pct >= settings.passingPercentage + (settings.targetPercentage - settings.passingPercentage) * 0.5) {
      return 'bg-indigo-500/12 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30';
    }
    if (pct >= settings.passingPercentage) {
      return 'bg-amber-500/15 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30';
    }
    return 'bg-rose-500/15 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30';
  };

  if (analytics.subjectStats.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        No subject data recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subject Ranking Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Subject Performance Leaderboard
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any subject row to inspect its full exam-by-exam trajectory below
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {analytics.uniqueSubjectCount} subjects tracked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 text-center">Exams</th>
                <th className="px-4 py-3 text-right">Total Marks</th>
                <th className="px-4 py-3 text-right">Weighted Avg</th>
                <th className="px-4 py-3 text-right">Min – Max</th>
                <th className="px-4 py-3 text-right">Latest Trend</th>
                <th className="px-4 py-3 text-right">vs Target</th>
                <th className="px-4 py-3 text-center">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {analytics.subjectStats.map((sub) => {
                const isSelected = activeSubject?.key === sub.key;
                const grade = getGradeForPercentage(
                  sub.weightedAveragePct,
                  settings.gradeScale
                );
                return (
                  <tr
                    key={sub.key}
                    onClick={() => setSelectedKey(sub.key)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-500/10'
                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                        )}
                        <span>{sub.displayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono-num text-slate-600 dark:text-slate-300">
                      {sub.appearances}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-slate-700 dark:text-slate-300">
                      {formatMarks(sub.totalScored)} / {formatMarks(sub.totalMax)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num font-bold text-slate-900 dark:text-white">
                      {formatPct(sub.weightedAveragePct)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-slate-500 dark:text-slate-400">
                      {sub.lowestPct.toFixed(0)}% – {sub.bestPct.toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num">
                      {sub.trendDelta === null ? (
                        <span className="text-slate-400">—</span>
                      ) : sub.trendDelta >= 0 ? (
                        <span className="inline-flex items-center font-semibold text-emerald-600 dark:text-emerald-400">
                          <ArrowUpRight className="h-3.5 w-3.5" />+
                          {sub.trendDelta.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center font-semibold text-rose-600 dark:text-rose-400">
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          {sub.trendDelta.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono-num font-semibold ${
                        sub.targetGapPct >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {sub.targetGapPct >= 0 ? '+' : ''}
                      {sub.targetGapPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <GradeBadge grade={grade} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visualizations Row: Radar + Selected Subject Spotlight */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Radar Chart or Spread View */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {radarData.length >= 3
              ? 'Subject Balance Radar'
              : 'Subject Score Range'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {radarData.length >= 3
              ? `Comparing your averages against ${settings.targetPercentage}% target`
              : 'Add at least 3 subjects to unlock the radar shape'}
          </p>

          <div className="mt-3 h-72 w-full">
            {radarData.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="#94A3B8" strokeOpacity={0.25} />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: '#94A3B8' }}
                  />
                  <Radar
                    name="Target"
                    dataKey="target"
                    stroke="#10B981"
                    strokeDasharray="4 4"
                    fill="#10B981"
                    fillOpacity={0.06}
                  />
                  <Radar
                    name="Average %"
                    dataKey="average"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    fill="#6366F1"
                    fillOpacity={0.28}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, '']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col justify-center space-y-4">
                {analytics.subjectStats.map((s) => (
                  <div key={s.key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>{s.displayName}</span>
                      <span className="font-mono-num">
                        {formatPct(s.weightedAveragePct)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${Math.min(100, s.weightedAveragePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Selected Subject Spotlight */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          {activeSubject && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Subject Deep-Dive
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {activeSubject.displayName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Best: {formatPct(activeSubject.bestPct)} ({activeSubject.bestExamName}) ·
                    Lowest: {formatPct(activeSubject.lowestPct)} ({activeSubject.lowestExamName}) ·
                    σ = {activeSubject.stdDevPct.toFixed(1)}%
                  </p>
                </div>

                <select
                  value={activeSubject.key}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  aria-label="Select subject for deep dive"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {analytics.subjectStats.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={activeSubject.history.map((h) => ({
                      ...h,
                      shortName:
                        h.examName.length > 14
                          ? `${h.examName.slice(0, 12)}…`
                          : h.examName,
                      pctRounded: Number(h.percentage.toFixed(1)),
                    }))}
                    margin={{ top: 8, right: 12, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#94A3B8"
                      strokeOpacity={0.2}
                    />
                    <XAxis
                      dataKey="shortName"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <ReferenceLine
                      y={settings.targetPercentage}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                    />
                    <Tooltip
                      formatter={(val) => [`${val}%`, activeSubject.displayName]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pctRounded"
                      stroke="#4F46E5"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {activeSubject.history.map((h) => (
                  <div
                    key={`${h.examId}_${h.date}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/50"
                  >
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {h.examName}:{' '}
                    </span>
                    <span className="font-bold font-mono-num text-slate-900 dark:text-white">
                      {formatMarks(h.scoredMarks)}/{formatMarks(h.totalMarks)} (
                      {formatPct(h.percentage)})
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Subject × Exam Heatmap Matrix */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Grid3X3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Subject × Exam Performance Matrix
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Color-coded heatmap across chronological exams · click any exam column header to view its report card
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500/40" />
              ≥ {settings.targetPercentage}%
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-indigo-500/40" />
              Mid-high
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-amber-500/40" />
              ≥ {settings.passingPercentage}%
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-xs bg-rose-500/40" />
              &lt; {settings.passingPercentage}%
            </span>
          </div>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full border-separate border-spacing-1.5 text-xs">
            <thead>
              <tr>
                <th className="min-w-[140px] px-2 py-1.5 text-left font-semibold text-slate-600 dark:text-slate-300">
                  Subject
                </th>
                {analytics.examSummaries.map((summary) => (
                  <th
                    key={summary.exam.id}
                    className="min-w-[100px] px-2 py-1.5 text-center"
                  >
                    <button
                      type="button"
                      onClick={() => onInspectExam(summary)}
                      className="group inline-flex flex-col items-center hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                    >
                      <span className="font-semibold text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
                        {summary.exam.name}
                      </span>
                      <span className="text-[10px] font-normal text-slate-400 font-mono-num">
                        {summary.exam.date}
                      </span>
                    </button>
                  </th>
                ))}
                <th className="min-w-[85px] px-2 py-1.5 text-right font-semibold text-slate-600 dark:text-slate-300">
                  Avg
                </th>
              </tr>
            </thead>
            <tbody>
              {analytics.subjectStats.map((sub) => {
                const byExamId = new Map(sub.history.map((h) => [h.examId, h]));
                return (
                  <tr key={sub.key}>
                    <td className="px-2 py-1 font-semibold text-slate-800 dark:text-slate-200">
                      <button
                        type="button"
                        onClick={() => setSelectedKey(sub.key)}
                        className="text-left hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                      >
                        {sub.displayName}
                      </button>
                    </td>

                    {analytics.examSummaries.map((summary) => {
                      const entry = byExamId.get(summary.exam.id);
                      const pct = entry ? entry.percentage : null;
                      return (
                        <td key={summary.exam.id}>
                          <button
                            type="button"
                            onClick={() => onInspectExam(summary)}
                            className={`w-full rounded-lg border border-transparent px-2 py-1.5 text-center transition hover:scale-[1.02] cursor-pointer ${getHeatmapCellStyle(
                              pct
                            )}`}
                          >
                            {entry ? (
                              <>
                                <div className="font-bold font-mono-num">
                                  {entry.percentage.toFixed(0)}%
                                </div>
                                <div className="text-[10px] opacity-80 font-mono-num">
                                  {formatMarks(entry.scoredMarks)}/
                                  {formatMarks(entry.totalMarks)}
                                </div>
                              </>
                            ) : (
                              <span className="text-[11px]">—</span>
                            )}
                          </button>
                        </td>
                      );
                    })}

                    <td className="px-2 py-1 text-right font-bold font-mono-num text-slate-900 dark:text-white">
                      {formatPct(sub.weightedAveragePct)}
                    </td>
                  </tr>
                );
              })}

              {/* Exam Total Summary Footer Row */}
              <tr>
                <td className="border-t border-slate-200 px-2 pt-2.5 font-bold text-slate-900 dark:border-slate-800 dark:text-white">
                  <span className="inline-flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                    Exam Total
                  </span>
                </td>
                {analytics.examSummaries.map((summary) => (
                  <td
                    key={summary.exam.id}
                    className="border-t border-slate-200 px-2 pt-2.5 text-center font-bold font-mono-num text-slate-900 dark:border-slate-800 dark:text-white"
                  >
                    <div>{formatPct(summary.percentage)}</div>
                    <div className="text-[10px] font-normal text-slate-500">
                      {formatMarks(summary.totalScored)}/{formatMarks(summary.totalMax)}
                    </div>
                  </td>
                ))}
                <td className="border-t border-slate-200 px-2 pt-2.5 text-right font-extrabold font-mono-num text-indigo-600 dark:border-slate-800 dark:text-indigo-400">
                  {formatPct(analytics.weightedOverallPct)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

