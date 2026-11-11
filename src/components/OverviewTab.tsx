import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  CheckCircle2,
  ChevronRight,
  Info,
  Lightbulb,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import type {
  AppSettings,
  ExamSummary,
  OverallAnalytics,
} from '../types/marks';
import {
  computeLinearRegression,
  formatMarks,
  formatPct,
  getGradeForPercentage,
} from '../lib/analytics';
import { GradeBadge, getBarColor } from './GradeBadge';

interface OverviewTabProps {
  analytics: OverallAnalytics;
  settings: AppSettings;
  hasSampleData: boolean;
  onClearSampleData: () => void;
  onInspectExam: (summary: ExamSummary) => void;
  onSelectSubject: (subjectKey: string) => void;
  onViewAllExams: () => void;
}

interface ChartPoint {
  label: string;
  fullName: string;
  date: string;
  percentage: number;
  trendPct: number;
  scoredMarks: number;
  totalMarks: number;
  delta: number | null;
}

export function OverviewTab({
  analytics,
  settings,
  hasSampleData,
  onClearSampleData,
  onInspectExam,
  onSelectSubject,
  onViewAllExams,
}: OverviewTabProps) {
  const [selectedSeries, setSelectedSeries] = useState<string>('ALL');
  const [showTrendline, setShowTrendline] = useState<boolean>(true);

  const chartData = useMemo<ChartPoint[]>(() => {
    if (selectedSeries === 'ALL') {
      const regMap = new Map(
        analytics.regressionLine.map((r) => [r.examId, r.trendPct])
      );
      return analytics.examSummaries.map((s) => ({
        label:
          s.exam.name.length > 14
            ? `${s.exam.name.slice(0, 12)}…`
            : s.exam.name,
        fullName: s.exam.name,
        date: s.exam.date,
        percentage: Number(s.percentage.toFixed(2)),
        trendPct: regMap.get(s.exam.id) ?? Number(s.percentage.toFixed(2)),
        scoredMarks: s.totalScored,
        totalMarks: s.totalMax,
        delta: s.deltaFromPrevious,
      }));
    }

    const sub = analytics.subjectStats.find((s) => s.key === selectedSeries);
    if (!sub) return [];
    const pcts = sub.history.map((h) => h.percentage);
    const { slope, intercept } = computeLinearRegression(pcts);

    return sub.history.map((h, idx) => ({
      label:
        h.examName.length > 14
          ? `${h.examName.slice(0, 12)}…`
          : h.examName,
      fullName: h.examName,
      date: h.date,
      percentage: Number(h.percentage.toFixed(2)),
      trendPct: Number(
        Math.max(0, Math.min(100, intercept + slope * idx)).toFixed(2)
      ),
      scoredMarks: h.scoredMarks,
      totalMarks: h.totalMarks,
      delta: idx > 0 ? h.percentage - sub.history[idx - 1].percentage : null,
    }));
  }, [analytics, selectedSeries]);

  const overallGrade = getGradeForPercentage(
    analytics.weightedOverallPct,
    settings.gradeScale
  );

  const recentExams = useMemo(
    () => [...analytics.examSummaries].reverse().slice(0, 5),
    [analytics.examSummaries]
  );

  return (
    <div className="space-y-6">
      {hasSampleData && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <strong>Sample Dataset Active:</strong> You&apos;re exploring demo exams. Add your own real exams anytime or clear sample data in one click.
            </span>
          </div>
          <button
            type="button"
            onClick={onClearSampleData}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-slate-900 dark:text-amber-300 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            Clear Sample Data
          </button>
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Cumulative Average */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cumulative Avg
            </span>
            <GradeBadge grade={overallGrade} size="sm" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2.5">
            <span className="text-3xl font-extrabold tracking-tight font-mono-num text-slate-900 dark:text-white">
              {formatPct(analytics.weightedOverallPct)}
            </span>
            {analytics.recentMomentumDelta !== null && (
              <span
                className={`inline-flex items-center text-xs font-semibold font-mono-num ${
                  analytics.recentMomentumDelta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {analytics.recentMomentumDelta >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {analytics.recentMomentumDelta >= 0 ? '+' : ''}
                {analytics.recentMomentumDelta.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {formatMarks(analytics.totalScored)} / {formatMarks(analytics.totalMax)} total marks ·{' '}
            {analytics.examCount} exam{analytics.examCount === 1 ? '' : 's'}
          </p>
        </div>

        {/* KPI 2: Best Exam Peak */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Best Exam Peak
            </span>
            <Award className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight font-mono-num text-slate-900 dark:text-white">
              {analytics.bestExam ? formatPct(analytics.bestExam.percentage) : '—'}
            </span>
          </div>
          <p className="mt-1.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {analytics.bestExam
              ? `${analytics.bestExam.exam.name} (${formatMarks(analytics.bestExam.totalScored)}/${formatMarks(analytics.bestExam.totalMax)})`
              : 'No exams yet'}
          </p>
        </div>

        {/* KPI 3: Strongest vs Focus Subject */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Subject Extremes
            </span>
            <Target className="h-4 w-4 text-indigo-500" />
          </div>
          {analytics.bestSubject ? (
            <div className="mt-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-semibold text-emerald-700 dark:text-emerald-400">
                  ▲ {analytics.bestSubject.displayName}
                </span>
                <span className="font-bold font-mono-num text-emerald-700 dark:text-emerald-400">
                  {formatPct(analytics.bestSubject.weightedAveragePct)}
                </span>
              </div>
              {analytics.focusSubject ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-semibold text-amber-700 dark:text-amber-400">
                    ▼ {analytics.focusSubject.displayName}
                  </span>
                  <span className="font-bold font-mono-num text-amber-700 dark:text-amber-400">
                    {formatPct(analytics.focusSubject.weightedAveragePct)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Add more subjects to compare</p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">—</p>
          )}
        </div>

        {/* KPI 4: Consistency & Pass Rate */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Stability &amp; Pass Rate
            </span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {analytics.examCount >= 2 ? analytics.consistencyLabel : 'Baseline'}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {analytics.examCount >= 2
              ? `σ = ${analytics.consistencyStdDev.toFixed(1)}% · `
              : ''}
            Pass rate: {formatPct(analytics.passRatePct, 0)} ({analytics.totalSubjectEntries} papers)
          </p>
        </div>
      </div>

      {/* Main Chart & Smart Insights */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Trajectory Chart */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Performance Trajectory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chronological score progression vs your {settings.targetPercentage}% target
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value)}
                aria-label="Filter trajectory by subject"
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Subjects (Exam Total)</option>
                {analytics.subjectStats.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.displayName} ({s.appearances})
                  </option>
                ))}
              </select>

              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showTrendline}
                  onChange={(e) => setShowTrendline(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Trendline
              </label>
            </div>
          </div>

          <div className="mt-4 h-72 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 12, left: -12, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#6366F1" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#94A3B8"
                    strokeOpacity={0.2}
                  />
                  <XAxis
                    dataKey="label"
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
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const pt = payload[0].payload as ChartPoint;
                      const grade = getGradeForPercentage(
                        pt.percentage,
                        settings.gradeScale
                      );
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/95">
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {pt.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {pt.date}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-base font-extrabold font-mono-num text-indigo-600 dark:text-indigo-400">
                              {formatPct(pt.percentage)}
                            </span>
                            <GradeBadge grade={grade} />
                          </div>
                          <div className="mt-1 text-xs font-mono-num text-slate-600 dark:text-slate-300">
                            Marks: {formatMarks(pt.scoredMarks)} /{' '}
                            {formatMarks(pt.totalMarks)}
                          </div>
                          {pt.delta !== null && (
                            <div
                              className={`mt-1 text-[11px] font-semibold font-mono-num ${
                                pt.delta >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {pt.delta >= 0 ? '+' : ''}
                              {pt.delta.toFixed(1)}% vs previous
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine
                    y={settings.targetPercentage}
                    stroke="#10B981"
                    strokeDasharray="4 4"
                    label={{
                      value: `Target ${settings.targetPercentage}%`,
                      position: 'insideTopRight',
                      fill: '#10B981',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                  <ReferenceLine
                    y={settings.passingPercentage}
                    stroke="#F43F5E"
                    strokeDasharray="2 4"
                    strokeOpacity={0.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="percentage"
                    stroke="#4F46E5"
                    strokeWidth={2.5}
                    fill="url(#scoreAreaGrad)"
                    dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
                  />
                  {showTrendline && chartData.length >= 2 && (
                    <Line
                      type="linear"
                      dataKey="trendPct"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                Not enough data points to render chart.
              </div>
            )}
          </div>
        </div>

        {/* Insights Feed */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Analytical Insights
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Auto-computed patterns from your marks
          </p>

          <div className="mt-4 space-y-2.5">
            {analytics.insights.length > 0 ? (
              analytics.insights.map((ins) => {
                const styleMap = {
                  positive: {
                    wrap: 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-500/5',
                    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
                    pill: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
                  },
                  warning: {
                    wrap: 'border-rose-200/80 bg-rose-50/50 dark:border-rose-500/20 dark:bg-rose-500/5',
                    icon: <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
                    pill: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300',
                  },
                  opportunity: {
                    wrap: 'border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-500/20 dark:bg-indigo-500/5',
                    icon: <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
                    pill: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300',
                  },
                  info: {
                    wrap: 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40',
                    icon: <Info className="h-4 w-4 text-slate-600 dark:text-slate-300" />,
                    pill: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
                  },
                }[ins.kind];

                return (
                  <div
                    key={ins.id}
                    className={`rounded-xl border p-3 ${styleMap.wrap}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {styleMap.icon}
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {ins.title}
                        </span>
                      </div>
                      {ins.metric && (
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold font-mono-num ${styleMap.pill}`}
                        >
                          {ins.metric}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                      {ins.description}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-slate-800">
                Add more exams to unlock trend &amp; leverage insights.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subject Mastery vs Target & Recent Exams */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Subject Mastery Bars */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Subject Mastery vs Target ({settings.targetPercentage}%)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Weighted averages across all exams · click any subject for deep-dive
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3.5">
            {analytics.subjectStats.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => onSelectSubject(sub.key)}
                className="group block w-full text-left rounded-xl p-1.5 -mx-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-semibold text-slate-800 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
                      {sub.displayName}
                    </span>
                    <span className="text-[11px] font-mono-num text-slate-400">
                      {formatMarks(sub.totalScored)}/{formatMarks(sub.totalMax)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {sub.trendDelta !== null && (
                      <span
                        className={`text-[11px] font-semibold font-mono-num ${
                          sub.trendDelta >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {sub.trendDelta >= 0 ? '↑' : '↓'}{' '}
                        {Math.abs(sub.trendDelta).toFixed(1)}%
                      </span>
                    )}
                    <span className="w-12 text-right font-bold font-mono-num text-slate-900 dark:text-white">
                      {formatPct(sub.weightedAveragePct)}
                    </span>
                  </div>
                </div>

                <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all ${getBarColor(
                      sub.weightedAveragePct,
                      settings.targetPercentage,
                      settings.passingPercentage
                    )}`}
                    style={{
                      width: `${Math.min(100, Math.max(2, sub.weightedAveragePct))}%`,
                    }}
                  />
                  {/* Target vertical tick */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900/50 dark:bg-white/60"
                    style={{ left: `${Math.min(99, settings.targetPercentage)}%` }}
                    title={`Target: ${settings.targetPercentage}%`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Exams */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Recent Exams
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click an exam for full report card
              </p>
            </div>
            <button
              type="button"
              onClick={onViewAllExams}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 cursor-pointer"
            >
              View All
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {recentExams.map((summary) => (
              <button
                key={summary.exam.id}
                type="button"
                onClick={() => onInspectExam(summary)}
                className="flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-slate-50/80 -mx-2 px-2 rounded-xl dark:hover:bg-slate-800/40 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {summary.exam.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{summary.exam.date}</span>
                    <span>·</span>
                    <span>{summary.subjectCount} subjects</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono-num text-slate-900 dark:text-white">
                      {formatPct(summary.percentage)}
                    </div>
                    <div className="text-[11px] font-mono-num text-slate-400">
                      {formatMarks(summary.totalScored)}/{formatMarks(summary.totalMax)}
                    </div>
                  </div>
                  <GradeBadge grade={summary.grade} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

