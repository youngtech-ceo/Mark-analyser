import type {
  AppSettings,
  Exam,
  ExamSummary,
  GradeRule,
  InsightItem,
  OverallAnalytics,
  SubjectStats,
} from '../types/marks';
import { createId, DEFAULT_SETTINGS } from './defaults';

export function calcPercentage(scored: number, total: number): number {
  if (!Number.isFinite(scored) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Math.max(0, (scored / total) * 100);
}

export function formatPct(pct: number, decimals = 1): string {
  if (!Number.isFinite(pct)) return '0.0%';
  return `${pct.toFixed(decimals)}%`;
}

export function formatMarks(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export function getGradeForPercentage(
  percentage: number,
  gradeScale: GradeRule[] = DEFAULT_SETTINGS.gradeScale
): GradeRule {
  const sorted = [...gradeScale].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const rule of sorted) {
    if (percentage >= rule.minPercentage) {
      return rule;
    }
  }
  return (
    sorted[sorted.length - 1] ?? {
      label: 'F',
      minPercentage: 0,
      color: 'rose',
    }
  );
}

export function canonicalSubjectKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function computeStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeLinearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0] };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export function sortExamsChronologically(exams: Exam[]): Exam[] {
  return [...exams].sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

function getConsistencyLabel(
  stdDev: number
): OverallAnalytics['consistencyLabel'] {
  if (stdDev <= 4) return 'Very Steady';
  if (stdDev <= 8.5) return 'Consistent';
  if (stdDev <= 14) return 'Moderate Variance';
  return 'Volatile';
}

export function analyzeMarks(
  exams: Exam[],
  settings: AppSettings = DEFAULT_SETTINGS
): OverallAnalytics {
  const sortedExams = sortExamsChronologically(exams);

  let grandTotalScored = 0;
  let grandTotalMax = 0;
  let totalSubjectEntries = 0;
  let passedEntries = 0;

  const examSummaries: ExamSummary[] = [];

  // Map canonical subject key -> aggregated entries
  const subjectMap = new Map<
    string,
    {
      displayNames: Map<string, number>;
      history: SubjectStats['history'];
    }
  >();

  sortedExams.forEach((exam, idx) => {
    let examScored = 0;
    let examMax = 0;
    let passedCount = 0;
    let failedCount = 0;
    let highestSubject = exam.subjects[0] ?? null;
    let lowestSubject = exam.subjects[0] ?? null;
    let highestPct = -1;
    let lowestPct = Infinity;

    for (const sub of exam.subjects) {
      const scored = Number(sub.scoredMarks) || 0;
      const total = Number(sub.totalMarks) || 0;
      const subPct = calcPercentage(scored, total);

      examScored += scored;
      examMax += total;
      totalSubjectEntries += 1;

      if (subPct >= settings.passingPercentage) {
        passedCount += 1;
        passedEntries += 1;
      } else {
        failedCount += 1;
      }

      if (subPct > highestPct) {
        highestPct = subPct;
        highestSubject = sub;
      }
      if (subPct < lowestPct) {
        lowestPct = subPct;
        lowestSubject = sub;
      }

      const key = canonicalSubjectKey(sub.name);
      if (!key) continue;

      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          displayNames: new Map(),
          history: [],
        });
      }
      const bucket = subjectMap.get(key)!;
      const cleanName = sub.name.trim().replace(/\s+/g, ' ');
      bucket.displayNames.set(cleanName, (bucket.displayNames.get(cleanName) ?? 0) + 1);
      bucket.history.push({
        examId: exam.id,
        examName: exam.name,
        date: exam.date,
        scoredMarks: scored,
        totalMarks: total,
        percentage: subPct,
        notes: sub.notes,
      });
    }

    grandTotalScored += examScored;
    grandTotalMax += examMax;

    const percentage = calcPercentage(examScored, examMax);
    const prevSummary = idx > 0 ? examSummaries[idx - 1] : null;
    const deltaFromPrevious = prevSummary ? percentage - prevSummary.percentage : null;

    examSummaries.push({
      exam,
      totalScored: examScored,
      totalMax: examMax,
      percentage,
      grade: getGradeForPercentage(percentage, settings.gradeScale),
      subjectCount: exam.subjects.length,
      passedCount,
      failedCount,
      highestSubject,
      lowestSubject,
      deltaFromPrevious,
    });
  });

  // Compute subject stats
  const subjectStats: SubjectStats[] = [];
  for (const [key, bucket] of subjectMap.entries()) {
    // Pick most common (or latest) capitalization for displayName
    let displayName = key;
    let maxFreq = -1;
    for (const [name, freq] of bucket.displayNames.entries()) {
      if (freq >= maxFreq) {
        maxFreq = freq;
        displayName = name;
      }
    }

    const history = bucket.history;
    const appearances = history.length;
    const totalScored = history.reduce((sum, h) => sum + h.scoredMarks, 0);
    const totalMax = history.reduce((sum, h) => sum + h.totalMarks, 0);
    const weightedAveragePct = calcPercentage(totalScored, totalMax);
    const pcts = history.map((h) => h.percentage);
    const simpleAveragePct =
      appearances > 0 ? pcts.reduce((a, b) => a + b, 0) / appearances : 0;

    let bestEntry = history[0];
    let lowestEntry = history[0];
    let passedTimes = 0;

    for (const h of history) {
      if (h.percentage > bestEntry.percentage) bestEntry = h;
      if (h.percentage < lowestEntry.percentage) lowestEntry = h;
      if (h.percentage >= settings.passingPercentage) passedTimes += 1;
    }

    const latestPct = history[appearances - 1]?.percentage ?? 0;
    const previousPct = appearances >= 2 ? history[appearances - 2].percentage : null;
    const trendDelta = previousPct !== null ? latestPct - previousPct : null;
    const { slope: slopePerExam } = computeLinearRegression(pcts);
    const stdDevPct = computeStdDev(pcts);
    const targetGapPct = weightedAveragePct - settings.targetPercentage;
    const passRatePct = appearances > 0 ? (passedTimes / appearances) * 100 : 0;

    subjectStats.push({
      key,
      displayName,
      appearances,
      totalScored,
      totalMax,
      weightedAveragePct,
      simpleAveragePct,
      bestPct: bestEntry?.percentage ?? 0,
      bestExamName: bestEntry?.examName ?? '',
      lowestPct: lowestEntry?.percentage ?? 0,
      lowestExamName: lowestEntry?.examName ?? '',
      latestPct,
      previousPct,
      trendDelta,
      slopePerExam,
      stdDevPct,
      targetGapPct,
      passRatePct,
      history,
    });
  }

  subjectStats.sort((a, b) => b.weightedAveragePct - a.weightedAveragePct);

  const examPcts = examSummaries.map((s) => s.percentage);
  const weightedOverallPct = calcPercentage(grandTotalScored, grandTotalMax);
  const unweightedExamAvgPct =
    examPcts.length > 0 ? examPcts.reduce((a, b) => a + b, 0) / examPcts.length : 0;

  const consistencyStdDev = computeStdDev(examPcts);
  const consistencyLabel = getConsistencyLabel(consistencyStdDev);
  const { slope: trendSlopePerExam, intercept } = computeLinearRegression(examPcts);

  const regressionLine = examSummaries.map((s, idx) => ({
    examId: s.exam.id,
    examName: s.exam.name,
    date: s.exam.date,
    actualPct: Number(s.percentage.toFixed(2)),
    trendPct: Number(Math.max(0, Math.min(100, intercept + trendSlopePerExam * idx)).toFixed(2)),
  }));

  const recentMomentumDelta =
    examSummaries.length >= 2
      ? examSummaries[examSummaries.length - 1].deltaFromPrevious
      : null;

  let bestExam: ExamSummary | null = null;
  let lowestExam: ExamSummary | null = null;
  for (const s of examSummaries) {
    if (!bestExam || s.percentage > bestExam.percentage) bestExam = s;
    if (!lowestExam || s.percentage < lowestExam.percentage) lowestExam = s;
  }

  const bestSubject = subjectStats[0] ?? null;
  const focusSubject =
    subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : null;
  const passRatePct =
    totalSubjectEntries > 0 ? (passedEntries / totalSubjectEntries) * 100 : 100;

  const insights = generateInsights({
    examSummaries,
    subjectStats,
    weightedOverallPct,
    trendSlopePerExam,
    consistencyStdDev,
    grandTotalScored,
    grandTotalMax,
    settings,
  });

  return {
    examCount: examSummaries.length,
    totalSubjectEntries,
    uniqueSubjectCount: subjectStats.length,
    totalScored: grandTotalScored,
    totalMax: grandTotalMax,
    weightedOverallPct,
    unweightedExamAvgPct,
    consistencyStdDev,
    consistencyLabel,
    trendSlopePerExam,
    recentMomentumDelta,
    bestExam,
    lowestExam,
    bestSubject,
    focusSubject,
    passRatePct,
    examSummaries,
    subjectStats,
    insights,
    regressionLine,
  };
}

function generateInsights(params: {
  examSummaries: ExamSummary[];
  subjectStats: SubjectStats[];
  weightedOverallPct: number;
  trendSlopePerExam: number;
  consistencyStdDev: number;
  grandTotalScored: number;
  grandTotalMax: number;
  settings: AppSettings;
}): InsightItem[] {
  const {
    examSummaries,
    subjectStats,
    weightedOverallPct,
    trendSlopePerExam,
    consistencyStdDev,
    grandTotalMax,
    settings,
  } = params;

  const insights: InsightItem[] = [];
  if (examSummaries.length === 0) return insights;

  // 1. Target achievement or gap
  const targetDiff = weightedOverallPct - settings.targetPercentage;
  if (targetDiff >= 0) {
    insights.push({
      id: 'target-met',
      kind: 'positive',
      title: 'Exceeding Your Target Benchmark',
      description: `Your cumulative average (${formatPct(weightedOverallPct)}) is ${formatPct(targetDiff)} above your ${settings.targetPercentage}% target.`,
      metric: `+${formatPct(targetDiff)}`,
    });
  } else {
    insights.push({
      id: 'target-gap',
      kind: 'opportunity',
      title: 'Distance to Personal Target',
      description: `You are ${formatPct(Math.abs(targetDiff))} away from your ${settings.targetPercentage}% goal. Use the Predictor tab to plan your next exam score.`,
      metric: `-${formatPct(Math.abs(targetDiff))}`,
    });
  }

  // 2. Overall trajectory trend
  if (examSummaries.length >= 3) {
    if (trendSlopePerExam >= 1.2) {
      insights.push({
        id: 'upward-trend',
        kind: 'positive',
        title: 'Strong Upward Trajectory',
        description: `Across ${examSummaries.length} exams, your overall score is trending up by an average of +${trendSlopePerExam.toFixed(1)}% per exam.`,
        metric: `+${trendSlopePerExam.toFixed(1)}%/exam`,
      });
    } else if (trendSlopePerExam <= -1.2) {
      insights.push({
        id: 'downward-trend',
        kind: 'warning',
        title: 'Downward Score Drift Detected',
        description: `Your recent exams show an average downward drift of ${trendSlopePerExam.toFixed(1)}% per exam. Review recent lowest-scoring subjects.`,
        metric: `${trendSlopePerExam.toFixed(1)}%/exam`,
      });
    }
  }

  // 3. Consecutive improvement streak
  if (examSummaries.length >= 3) {
    let streak = 0;
    for (let i = examSummaries.length - 1; i > 0; i--) {
      if ((examSummaries[i].deltaFromPrevious ?? 0) > 0) streak++;
      else break;
    }
    if (streak >= 2) {
      insights.push({
        id: 'win-streak',
        kind: 'positive',
        title: `${streak}-Exam Improvement Streak`,
        description: `You improved your overall percentage in each of your last ${streak} consecutive transitions.`,
        metric: `${streak} in a row`,
      });
    }
  }

  // 4. Highest leverage subject improvement opportunity
  if (subjectStats.length >= 2 && grandTotalMax > 0) {
    // Find subject below target with highest lost marks (totalMax - totalScored)
    let topLeverage: SubjectStats | null = null;
    let maxMissedMarks = 0;
    for (const sub of subjectStats) {
      const missed = sub.totalMax - sub.totalScored;
      if (sub.weightedAveragePct < settings.targetPercentage && missed > maxMissedMarks) {
        maxMissedMarks = missed;
        topLeverage = sub;
      }
    }
    if (!topLeverage) {
      topLeverage = subjectStats[subjectStats.length - 1];
    }
    if (topLeverage) {
      const gain10PctMarks = topLeverage.totalMax * 0.1;
      const overallBoost = (gain10PctMarks / grandTotalMax) * 100;
      insights.push({
        id: 'leverage-subject',
        kind: 'opportunity',
        title: `Highest-Leverage Subject: ${topLeverage.displayName}`,
        description: `Currently averaging ${formatPct(topLeverage.weightedAveragePct)} across ${topLeverage.appearances} exam(s). Improving ${topLeverage.displayName} by +10% adds +${overallBoost.toFixed(1)}% to your overall average.`,
        metric: `+${overallBoost.toFixed(1)}% lift`,
      });
    }
  }

  // 5. Recent sharp subject drop or surge
  const subjectsWithTrend = subjectStats.filter((s) => s.trendDelta !== null);
  if (subjectsWithTrend.length > 0) {
    const sharpestDrop = [...subjectsWithTrend].sort(
      (a, b) => (a.trendDelta ?? 0) - (b.trendDelta ?? 0)
    )[0];
    if (sharpestDrop && (sharpestDrop.trendDelta ?? 0) <= -6) {
      insights.push({
        id: 'subject-drop',
        kind: 'warning',
        title: `Recent Dip in ${sharpestDrop.displayName}`,
        description: `${sharpestDrop.displayName} dropped ${formatPct(Math.abs(sharpestDrop.trendDelta!))} in the latest exam compared to the one before it.`,
        metric: `${sharpestDrop.trendDelta!.toFixed(1)}%`,
      });
    }
  }

  // 6. Passing threshold alert
  const atRiskSubjects = subjectStats.filter(
    (s) => s.latestPct < settings.passingPercentage
  );
  if (atRiskSubjects.length > 0) {
    insights.push({
      id: 'pass-alert',
      kind: 'warning',
      title: `Below Passing Threshold (${settings.passingPercentage}%)`,
      description: `${atRiskSubjects.map((s) => s.displayName).join(', ')} scored below ${settings.passingPercentage}% in the most recent recorded exam.`,
      metric: `${atRiskSubjects.length} subject${atRiskSubjects.length > 1 ? 's' : ''}`,
    });
  } else if (examSummaries.length >= 3 && consistencyStdDev <= 4.5) {
    insights.push({
      id: 'high-consistency',
      kind: 'info',
      title: 'Highly Consistent Performance',
      description: `Your exam percentages stay within a tight band (σ = ${consistencyStdDev.toFixed(1)}%), showing reliable preparation.`,
      metric: `σ = ${consistencyStdDev.toFixed(1)}%`,
    });
  }

  return insights.slice(0, 5);
}

export interface PredictionResult {
  targetPct: number;
  upcomingMax: number;
  requiredMarks: number;
  requiredPct: number;
  projectedNewTotalMax: number;
  status: 'already-met' | 'achievable' | 'stretch' | 'impossible-single';
  examsNeededAtAssumedPace: number | null;
}

export function predictRequiredScore(params: {
  currentScored: number;
  currentMax: number;
  upcomingMax: number;
  targetPct: number;
  assumedPacePct?: number;
}): PredictionResult {
  const { currentScored, currentMax, upcomingMax, targetPct, assumedPacePct = 92 } = params;
  const safeUpcoming = Math.max(1, upcomingMax);
  const projectedNewTotalMax = currentMax + safeUpcoming;
  const targetTotalPoints = (targetPct / 100) * projectedNewTotalMax;
  const rawRequiredMarks = targetTotalPoints - currentScored;
  const requiredMarks = Math.max(0, rawRequiredMarks);
  const requiredPct = (requiredMarks / safeUpcoming) * 100;

  let status: PredictionResult['status'] = 'achievable';
  if (rawRequiredMarks <= 0) {
    status = 'already-met';
  } else if (requiredPct > 100) {
    status = 'impossible-single';
  } else if (requiredPct >= 90) {
    status = 'stretch';
  } else {
    status = 'achievable';
  }

  // If impossible in 1 exam, calculate how many upcoming exams of `safeUpcoming` marks at `assumedPacePct` are needed
  let examsNeededAtAssumedPace: number | null = null;
  if (status === 'impossible-single' && assumedPacePct > targetPct) {
    const numerator = (targetPct / 100) * currentMax - currentScored;
    const perExamSurplus = ((assumedPacePct - targetPct) / 100) * safeUpcoming;
    if (perExamSurplus > 0) {
      examsNeededAtAssumedPace = Math.ceil(numerator / perExamSurplus);
    }
  }

  return {
    targetPct,
    upcomingMax: safeUpcoming,
    requiredMarks,
    requiredPct,
    projectedNewTotalMax,
    status,
    examsNeededAtAssumedPace,
  };
}

export function exportExamsToCSV(exams: Exam[]): string {
  const headers = [
    'Exam Name',
    'Date',
    'Category',
    'Subject',
    'Marks Scored',
    'Total Marks',
    'Percentage',
    'Subject Notes',
    'Exam Notes',
  ];
  const escape = (val: string | number | undefined): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows: string[] = [headers.join(',')];
  for (const exam of sortExamsChronologically(exams)) {
    for (const sub of exam.subjects) {
      const pct = calcPercentage(sub.scoredMarks, sub.totalMarks).toFixed(2);
      rows.push(
        [
          escape(exam.name),
          escape(exam.date),
          escape(exam.category),
          escape(sub.name),
          escape(sub.scoredMarks),
          escape(sub.totalMarks),
          escape(`${pct}%`),
          escape(sub.notes),
          escape(exam.notes),
        ].join(',')
      );
    }
  }
  return rows.join('\n');
}

export function sanitizeImportedExams(raw: unknown): Exam[] {
  if (!Array.isArray(raw)) {
    throw new Error('Invalid format: expected an array of exams.');
  }
  const now = Date.now();
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const subjectsRaw = Array.isArray(item.subjects) ? item.subjects : [];
      const subjects = subjectsRaw
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
        .map((s) => {
          const total = Math.max(1, Number(s.totalMarks) || 100);
          const scored = Math.max(0, Number(s.scoredMarks) || 0);
          return {
            id: typeof s.id === 'string' && s.id ? s.id : createId('sub'),
            name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Untitled Subject',
            scoredMarks: scored,
            totalMarks: total,
            notes: typeof s.notes === 'string' ? s.notes : undefined,
          };
        });

      return {
        id: typeof item.id === 'string' && item.id ? item.id : createId('exam'),
        name:
          typeof item.name === 'string' && item.name.trim()
            ? item.name.trim()
            : 'Imported Exam',
        date:
          typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            ? item.date
            : new Date().toISOString().slice(0, 10),
        category:
          typeof item.category === 'string' && item.category.trim()
            ? item.category.trim()
            : 'Exam',
        defaultTotalMarks: Math.max(1, Number(item.defaultTotalMarks) || 100),
        notes: typeof item.notes === 'string' ? item.notes : undefined,
        subjects,
        createdAt: Number(item.createdAt) || now,
        updatedAt: Number(item.updatedAt) || now,
      };
    })
    .filter((exam) => exam.subjects.length > 0);
}

