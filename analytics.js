/* MarkPulse — Pure JavaScript Analytics Engine
 * Works both in the browser (window.MarkAnalytics) and in Node.js for unit tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MarkAnalytics = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_GRADE_SCALE = [
    { label: 'A+', minPercentage: 90, color: 'emerald' },
    { label: 'A', minPercentage: 80, color: 'emerald' },
    { label: 'B+', minPercentage: 70, color: 'indigo' },
    { label: 'B', minPercentage: 60, color: 'indigo' },
    { label: 'C', minPercentage: 50, color: 'amber' },
    { label: 'D', minPercentage: 40, color: 'orange' },
    { label: 'F', minPercentage: 0, color: 'rose' },
  ];

  const DEFAULT_SETTINGS = {
    targetPercentage: 85,
    passingPercentage: 40,
    theme: 'light',
    gradeScale: DEFAULT_GRADE_SCALE,
  };

  const EXAM_CATEGORIES = [
    'Unit Test',
    'Mid-Term',
    'Final Exam',
    'Mock Test',
    'Lab / Practical',
    'Assignment / Quiz',
    'Semester Exam',
  ];

  const QUICK_TOTAL_MARKS = [20, 25, 30, 50, 70, 80, 100];

  function createId(prefix) {
    const p = prefix || 'id';
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return p + '_' + crypto.randomUUID().slice(0, 12);
    }
    return p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function generateVaultKey() {
    const words = ['APEX', 'NOVA', 'PULSE', 'DELTA', 'ZENITH', 'SOLAR', 'ORBIT', 'PRISM'];
    const word = words[Math.floor(Math.random() * words.length)];
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const num = Math.floor(10 + Math.random() * 89);
    return word + '-' + code + '-' + num;
  }

  function calcPercentage(scored, total) {
    if (!Number.isFinite(scored) || !Number.isFinite(total) || total <= 0) {
      return 0;
    }
    return Math.max(0, (scored / total) * 100);
  }

  function formatPct(pct, decimals) {
    const dec = typeof decimals === 'number' ? decimals : 1;
    if (!Number.isFinite(pct)) return '0.0%';
    return pct.toFixed(dec) + '%';
  }

  function formatMarks(n) {
    if (!Number.isFinite(n)) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  }

  function getGradeForPercentage(percentage, gradeScale) {
    const scale = Array.isArray(gradeScale) && gradeScale.length ? gradeScale : DEFAULT_GRADE_SCALE;
    const sorted = scale.slice().sort(function (a, b) {
      return b.minPercentage - a.minPercentage;
    });
    for (let i = 0; i < sorted.length; i++) {
      if (percentage >= sorted[i].minPercentage) {
        return sorted[i];
      }
    }
    return sorted[sorted.length - 1] || { label: 'F', minPercentage: 0, color: 'rose' };
  }

  function canonicalSubjectKey(name) {
    return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function computeStdDev(values) {
    if (!values || values.length <= 1) return 0;
    const mean = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    const variance = values.reduce(function (acc, v) { return acc + Math.pow(v - mean, 2); }, 0) / values.length;
    return Math.sqrt(variance);
  }

  function computeLinearRegression(values) {
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

    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return { slope: 0, intercept: sumY / n };
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return { slope: slope, intercept: intercept };
  }

  function sortExamsChronologically(exams) {
    return (exams || []).slice().sort(function (a, b) {
      const cmp = String(a.date || '').localeCompare(String(b.date || ''));
      if (cmp !== 0) return cmp;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  function getConsistencyLabel(stdDev) {
    if (stdDev <= 4) return 'Very Steady';
    if (stdDev <= 8.5) return 'Consistent';
    if (stdDev <= 14) return 'Moderate Variance';
    return 'Volatile';
  }

  function generateInsights(params) {
    const examSummaries = params.examSummaries;
    const subjectStats = params.subjectStats;
    const weightedOverallPct = params.weightedOverallPct;
    const trendSlopePerExam = params.trendSlopePerExam;
    const consistencyStdDev = params.consistencyStdDev;
    const grandTotalMax = params.grandTotalMax;
    const settings = params.settings;

    const insights = [];
    if (examSummaries.length === 0) return insights;

    // 1. Target check
    const targetDiff = weightedOverallPct - settings.targetPercentage;
    if (targetDiff >= 0) {
      insights.push({
        id: 'target-met',
        kind: 'positive',
        title: 'Exceeding Your Target Benchmark',
        description:
          'Your cumulative average (' +
          formatPct(weightedOverallPct) +
          ') is ' +
          formatPct(targetDiff) +
          ' above your ' +
          settings.targetPercentage +
          '% target.',
        metric: '+' + formatPct(targetDiff),
      });
    } else {
      insights.push({
        id: 'target-gap',
        kind: 'opportunity',
        title: 'Distance to Personal Target',
        description:
          'You are ' +
          formatPct(Math.abs(targetDiff)) +
          ' away from your ' +
          settings.targetPercentage +
          '% goal. Use the Predictor tab to plan your next exam score.',
        metric: '-' + formatPct(Math.abs(targetDiff)),
      });
    }

    // 2. Trajectory trend
    if (examSummaries.length >= 3) {
      if (trendSlopePerExam >= 1.2) {
        insights.push({
          id: 'upward-trend',
          kind: 'positive',
          title: 'Strong Upward Trajectory',
          description:
            'Across ' +
            examSummaries.length +
            ' exams, your overall score is trending up by an average of +' +
            trendSlopePerExam.toFixed(1) +
            '% per exam.',
          metric: '+' + trendSlopePerExam.toFixed(1) + '%/exam',
        });
      } else if (trendSlopePerExam <= -1.2) {
        insights.push({
          id: 'downward-trend',
          kind: 'warning',
          title: 'Downward Score Drift Detected',
          description:
            'Your recent exams show an average drift of ' +
            trendSlopePerExam.toFixed(1) +
            '% per exam. Review recent lowest-scoring subjects.',
          metric: trendSlopePerExam.toFixed(1) + '%/exam',
        });
      }
    }

    // 3. Improvement streak
    if (examSummaries.length >= 3) {
      let streak = 0;
      for (let i = examSummaries.length - 1; i > 0; i--) {
        if ((examSummaries[i].deltaFromPrevious || 0) > 0) streak++;
        else break;
      }
      if (streak >= 2) {
        insights.push({
          id: 'win-streak',
          kind: 'positive',
          title: streak + '-Exam Improvement Streak',
          description:
            'You improved your overall percentage in each of your last ' +
            streak +
            ' consecutive transitions.',
          metric: streak + ' in a row',
        });
      }
    }

    // 4. Highest-leverage improvement subject
    if (subjectStats.length >= 2 && grandTotalMax > 0) {
      let topLeverage = null;
      let maxMissed = 0;
      for (let i = 0; i < subjectStats.length; i++) {
        const sub = subjectStats[i];
        const missed = sub.totalMax - sub.totalScored;
        if (sub.weightedAveragePct < settings.targetPercentage && missed > maxMissed) {
          maxMissed = missed;
          topLeverage = sub;
        }
      }
      if (!topLeverage) topLeverage = subjectStats[subjectStats.length - 1];
      if (topLeverage) {
        const gainMarks = topLeverage.totalMax * 0.1;
        const overallBoost = (gainMarks / grandTotalMax) * 100;
        insights.push({
          id: 'leverage-subject',
          kind: 'opportunity',
          title: 'Highest-Leverage Subject: ' + topLeverage.displayName,
          description:
            'Currently averaging ' +
            formatPct(topLeverage.weightedAveragePct) +
            ' across ' +
            topLeverage.appearances +
            ' exam(s). Improving ' +
            topLeverage.displayName +
            ' by +10% adds +' +
            overallBoost.toFixed(1) +
            '% to your overall average.',
          metric: '+' + overallBoost.toFixed(1) + '% lift',
        });
      }
    }

    // 5. Recent sharp subject drop
    const withTrend = subjectStats.filter(function (s) {
      return s.trendDelta !== null;
    });
    if (withTrend.length > 0) {
      const sharpestDrop = withTrend.slice().sort(function (a, b) {
        return a.trendDelta - b.trendDelta;
      })[0];
      if (sharpestDrop && sharpestDrop.trendDelta <= -6) {
        insights.push({
          id: 'subject-drop',
          kind: 'warning',
          title: 'Recent Dip in ' + sharpestDrop.displayName,
          description:
            sharpestDrop.displayName +
            ' dropped ' +
            formatPct(Math.abs(sharpestDrop.trendDelta)) +
            ' in the latest exam compared to the one before it.',
          metric: sharpestDrop.trendDelta.toFixed(1) + '%',
        });
      }
    }

    // 6. Passing threshold check
    const atRisk = subjectStats.filter(function (s) {
      return s.latestPct < settings.passingPercentage;
    });
    if (atRisk.length > 0) {
      insights.push({
        id: 'pass-alert',
        kind: 'warning',
        title: 'Below Passing Threshold (' + settings.passingPercentage + '%)',
        description:
          atRisk.map(function (s) { return s.displayName; }).join(', ') +
          ' scored below ' +
          settings.passingPercentage +
          '% in the most recent recorded exam.',
        metric: atRisk.length + ' subject' + (atRisk.length > 1 ? 's' : ''),
      });
    } else if (examSummaries.length >= 3 && consistencyStdDev <= 4.5) {
      insights.push({
        id: 'high-consistency',
        kind: 'info',
        title: 'Highly Consistent Performance',
        description:
          'Your exam percentages stay within a tight band (σ = ' +
          consistencyStdDev.toFixed(1) +
          '%), showing steady preparation.',
        metric: 'σ = ' + consistencyStdDev.toFixed(1) + '%',
      });
    }

    return insights.slice(0, 5);
  }

  function analyzeMarks(exams, customSettings) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, customSettings || {});
    const sortedExams = sortExamsChronologically(exams || []);

    let grandTotalScored = 0;
    let grandTotalMax = 0;
    let totalSubjectEntries = 0;
    let passedEntries = 0;

    const examSummaries = [];
    const subjectMap = new Map();

    sortedExams.forEach(function (exam, idx) {
      const subjects = Array.isArray(exam.subjects) ? exam.subjects : [];
      let examScored = 0;
      let examMax = 0;
      let passedCount = 0;
      let failedCount = 0;
      let highestSubject = subjects[0] || null;
      let lowestSubject = subjects[0] || null;
      let highestPct = -1;
      let lowestPct = Infinity;

      for (let i = 0; i < subjects.length; i++) {
        const sub = subjects[i];
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
          subjectMap.set(key, { displayNames: new Map(), history: [] });
        }
        const bucket = subjectMap.get(key);
        const cleanName = String(sub.name).trim().replace(/\s+/g, ' ');
        bucket.displayNames.set(cleanName, (bucket.displayNames.get(cleanName) || 0) + 1);
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
        exam: exam,
        totalScored: examScored,
        totalMax: examMax,
        percentage: percentage,
        grade: getGradeForPercentage(percentage, settings.gradeScale),
        subjectCount: subjects.length,
        passedCount: passedCount,
        failedCount: failedCount,
        highestSubject: highestSubject,
        lowestSubject: lowestSubject,
        deltaFromPrevious: deltaFromPrevious,
      });
    });

    const subjectStats = [];
    subjectMap.forEach(function (bucket, key) {
      let displayName = key;
      let maxFreq = -1;
      bucket.displayNames.forEach(function (freq, name) {
        if (freq >= maxFreq) {
          maxFreq = freq;
          displayName = name;
        }
      });

      const history = bucket.history;
      const appearances = history.length;
      const totalScored = history.reduce(function (s, h) { return s + h.scoredMarks; }, 0);
      const totalMax = history.reduce(function (s, h) { return s + h.totalMarks; }, 0);
      const weightedAveragePct = calcPercentage(totalScored, totalMax);
      const pcts = history.map(function (h) { return h.percentage; });
      const simpleAveragePct =
        appearances > 0
          ? pcts.reduce(function (a, b) { return a + b; }, 0) / appearances
          : 0;

      let bestEntry = history[0];
      let lowestEntry = history[0];
      let passedTimes = 0;

      for (let i = 0; i < history.length; i++) {
        const h = history[i];
        if (h.percentage > bestEntry.percentage) bestEntry = h;
        if (h.percentage < lowestEntry.percentage) lowestEntry = h;
        if (h.percentage >= settings.passingPercentage) passedTimes += 1;
      }

      const latestPct = history[appearances - 1] ? history[appearances - 1].percentage : 0;
      const previousPct = appearances >= 2 ? history[appearances - 2].percentage : null;
      const trendDelta = previousPct !== null ? latestPct - previousPct : null;
      const reg = computeLinearRegression(pcts);
      const stdDevPct = computeStdDev(pcts);
      const targetGapPct = weightedAveragePct - settings.targetPercentage;
      const passRatePct = appearances > 0 ? (passedTimes / appearances) * 100 : 0;

      subjectStats.push({
        key: key,
        displayName: displayName,
        appearances: appearances,
        totalScored: totalScored,
        totalMax: totalMax,
        weightedAveragePct: weightedAveragePct,
        simpleAveragePct: simpleAveragePct,
        bestPct: bestEntry ? bestEntry.percentage : 0,
        bestExamName: bestEntry ? bestEntry.examName : '',
        lowestPct: lowestEntry ? lowestEntry.percentage : 0,
        lowestExamName: lowestEntry ? lowestEntry.examName : '',
        latestPct: latestPct,
        previousPct: previousPct,
        trendDelta: trendDelta,
        slopePerExam: reg.slope,
        stdDevPct: stdDevPct,
        targetGapPct: targetGapPct,
        passRatePct: passRatePct,
        history: history,
      });
    });

    subjectStats.sort(function (a, b) {
      return b.weightedAveragePct - a.weightedAveragePct;
    });

    const examPcts = examSummaries.map(function (s) { return s.percentage; });
    const weightedOverallPct = calcPercentage(grandTotalScored, grandTotalMax);
    const unweightedExamAvgPct =
      examPcts.length > 0
        ? examPcts.reduce(function (a, b) { return a + b; }, 0) / examPcts.length
        : 0;
    const consistencyStdDev = computeStdDev(examPcts);
    const consistencyLabel = getConsistencyLabel(consistencyStdDev);
    const regAll = computeLinearRegression(examPcts);

    const regressionLine = examSummaries.map(function (s, idx) {
      const trend = Math.max(0, Math.min(100, regAll.intercept + regAll.slope * idx));
      return {
        examId: s.exam.id,
        examName: s.exam.name,
        date: s.exam.date,
        actualPct: Number(s.percentage.toFixed(2)),
        trendPct: Number(trend.toFixed(2)),
      };
    });

    const recentMomentumDelta =
      examSummaries.length >= 2
        ? examSummaries[examSummaries.length - 1].deltaFromPrevious
        : null;

    let bestExam = null;
    let lowestExam = null;
    for (let i = 0; i < examSummaries.length; i++) {
      const s = examSummaries[i];
      if (!bestExam || s.percentage > bestExam.percentage) bestExam = s;
      if (!lowestExam || s.percentage < lowestExam.percentage) lowestExam = s;
    }

    const bestSubject = subjectStats[0] || null;
    const focusSubject = subjectStats.length > 1 ? subjectStats[subjectStats.length - 1] : null;
    const passRatePct = totalSubjectEntries > 0 ? (passedEntries / totalSubjectEntries) * 100 : 100;

    const insights = generateInsights({
      examSummaries: examSummaries,
      subjectStats: subjectStats,
      weightedOverallPct: weightedOverallPct,
      trendSlopePerExam: regAll.slope,
      consistencyStdDev: consistencyStdDev,
      grandTotalMax: grandTotalMax,
      settings: settings,
    });

    return {
      examCount: examSummaries.length,
      totalSubjectEntries: totalSubjectEntries,
      uniqueSubjectCount: subjectStats.length,
      totalScored: grandTotalScored,
      totalMax: grandTotalMax,
      weightedOverallPct: weightedOverallPct,
      unweightedExamAvgPct: unweightedExamAvgPct,
      consistencyStdDev: consistencyStdDev,
      consistencyLabel: consistencyLabel,
      trendSlopePerExam: regAll.slope,
      recentMomentumDelta: recentMomentumDelta,
      bestExam: bestExam,
      lowestExam: lowestExam,
      bestSubject: bestSubject,
      focusSubject: focusSubject,
      passRatePct: passRatePct,
      examSummaries: examSummaries,
      subjectStats: subjectStats,
      insights: insights,
      regressionLine: regressionLine,
    };
  }

  function predictRequiredScore(params) {
    const currentScored = Number(params.currentScored) || 0;
    const currentMax = Number(params.currentMax) || 0;
    const safeUpcoming = Math.max(1, Number(params.upcomingMax) || 100);
    const targetPct = Number(params.targetPct) || 85;
    const assumedPacePct = typeof params.assumedPacePct === 'number' ? params.assumedPacePct : 92;

    const projectedNewTotalMax = currentMax + safeUpcoming;
    const targetTotalPoints = (targetPct / 100) * projectedNewTotalMax;
    const rawRequiredMarks = targetTotalPoints - currentScored;
    const requiredMarks = Math.max(0, rawRequiredMarks);
    const requiredPct = (requiredMarks / safeUpcoming) * 100;

    let status = 'achievable';
    if (rawRequiredMarks <= 0) status = 'already-met';
    else if (requiredPct > 100) status = 'impossible-single';
    else if (requiredPct >= 90) status = 'stretch';

    let examsNeededAtAssumedPace = null;
    if (status === 'impossible-single' && assumedPacePct > targetPct) {
      const numerator = (targetPct / 100) * currentMax - currentScored;
      const perExamSurplus = ((assumedPacePct - targetPct) / 100) * safeUpcoming;
      if (perExamSurplus > 0) {
        examsNeededAtAssumedPace = Math.ceil(numerator / perExamSurplus);
      }
    }

    return {
      targetPct: targetPct,
      upcomingMax: safeUpcoming,
      requiredMarks: requiredMarks,
      requiredPct: requiredPct,
      projectedNewTotalMax: projectedNewTotalMax,
      status: status,
      examsNeededAtAssumedPace: examsNeededAtAssumedPace,
    };
  }

  function exportExamsToCSV(exams) {
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
    function escapeCell(val) {
      const str = String(val == null ? '' : val);
      if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }

    const rows = [headers.join(',')];
    const sorted = sortExamsChronologically(exams || []);
    for (let i = 0; i < sorted.length; i++) {
      const exam = sorted[i];
      const subjects = exam.subjects || [];
      for (let j = 0; j < subjects.length; j++) {
        const sub = subjects[j];
        const pct = calcPercentage(sub.scoredMarks, sub.totalMarks).toFixed(2);
        rows.push(
          [
            escapeCell(exam.name),
            escapeCell(exam.date),
            escapeCell(exam.category),
            escapeCell(sub.name),
            escapeCell(sub.scoredMarks),
            escapeCell(sub.totalMarks),
            escapeCell(pct + '%'),
            escapeCell(sub.notes),
            escapeCell(exam.notes),
          ].join(',')
        );
      }
    }
    return rows.join('\n');
  }

  function sanitizeImportedExams(raw) {
    if (!Array.isArray(raw)) {
      throw new Error('Invalid format: expected an array of exams.');
    }
    const now = Date.now();
    return raw
      .filter(function (item) {
        return Boolean(item && typeof item === 'object');
      })
      .map(function (item) {
        const subjectsRaw = Array.isArray(item.subjects) ? item.subjects : [];
        const subjects = subjectsRaw
          .filter(function (s) { return Boolean(s && typeof s === 'object'); })
          .map(function (s) {
            const total = Math.max(1, Number(s.totalMarks) || 100);
            const scored = Math.max(0, Number(s.scoredMarks) || 0);
            const out = {
              id: typeof s.id === 'string' && s.id ? s.id : createId('sub'),
              name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Untitled Subject',
              scoredMarks: scored,
              totalMarks: total,
            };
            if (typeof s.notes === 'string' && s.notes.trim()) {
              out.notes = s.notes.trim();
            }
            return out;
          });

        const exam = {
          id: typeof item.id === 'string' && item.id ? item.id : createId('exam'),
          name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Imported Exam',
          date:
            typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
              ? item.date
              : new Date().toISOString().slice(0, 10),
          category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Exam',
          defaultTotalMarks: Math.max(1, Number(item.defaultTotalMarks) || 100),
          subjects: subjects,
          createdAt: Number(item.createdAt) || now,
          updatedAt: Number(item.updatedAt) || now,
        };
        if (typeof item.notes === 'string' && item.notes.trim()) {
          exam.notes = item.notes.trim();
        }
        return exam;
      })
      .filter(function (exam) {
        return exam.subjects.length > 0;
      });
  }

  function buildSampleExams() {
    const base = Date.now() - 1000 * 60 * 60 * 24 * 90;
    return [
      {
        id: 'sample_exam_1',
        name: 'Unit Test 1',
        date: '2026-07-14',
        category: 'Unit Test',
        defaultTotalMarks: 25,
        notes: 'Early diagnostic assessment — struggled with Calculus timing.',
        createdAt: base,
        updatedAt: base,
        isSample: true,
        subjects: [
          { id: 's1_math', name: 'Mathematics', scoredMarks: 17, totalMarks: 25, notes: 'Ran out of time' },
          { id: 's1_phys', name: 'Physics', scoredMarks: 19, totalMarks: 25 },
          { id: 's1_chem', name: 'Chemistry', scoredMarks: 21, totalMarks: 25 },
          { id: 's1_cs', name: 'Computer Science', scoredMarks: 22, totalMarks: 25 },
          { id: 's1_eng', name: 'English', scoredMarks: 20, totalMarks: 25 },
        ],
      },
      {
        id: 'sample_exam_2',
        name: 'Unit Test 2',
        date: '2026-08-18',
        category: 'Unit Test',
        defaultTotalMarks: 50,
        notes: 'Better pacing in Math; Organic Chemistry reactions needed revision.',
        createdAt: base + 1000 * 60 * 60 * 24 * 30,
        updatedAt: base + 1000 * 60 * 60 * 24 * 30,
        isSample: true,
        subjects: [
          { id: 's2_math', name: 'Mathematics', scoredMarks: 38, totalMarks: 50 },
          { id: 's2_phys', name: 'Physics', scoredMarks: 41, totalMarks: 50 },
          { id: 's2_chem', name: 'Chemistry', scoredMarks: 37, totalMarks: 50, notes: 'Organic section weak' },
          { id: 's2_cs', name: 'Computer Science', scoredMarks: 45, totalMarks: 50 },
          { id: 's2_eng', name: 'English', scoredMarks: 42, totalMarks: 50 },
        ],
      },
      {
        id: 'sample_exam_3',
        name: 'Mid-Term Examination',
        date: '2026-09-24',
        category: 'Mid-Term',
        defaultTotalMarks: 80,
        notes: 'Theory papers out of 80 + practical lab assessment out of 30.',
        createdAt: base + 1000 * 60 * 60 * 24 * 60,
        updatedAt: base + 1000 * 60 * 60 * 24 * 60,
        isSample: true,
        subjects: [
          { id: 's3_math', name: 'Mathematics', scoredMarks: 66, totalMarks: 80 },
          { id: 's3_phys', name: 'Physics', scoredMarks: 68, totalMarks: 80 },
          { id: 's3_chem', name: 'Chemistry', scoredMarks: 65, totalMarks: 80 },
          { id: 's3_cs', name: 'Computer Science', scoredMarks: 74, totalMarks: 80 },
          { id: 's3_eng', name: 'English', scoredMarks: 67, totalMarks: 80 },
          { id: 's3_lab', name: 'Physics Lab', scoredMarks: 27, totalMarks: 30 },
        ],
      },
      {
        id: 'sample_exam_4',
        name: 'Pre-Final Mock',
        date: '2026-10-28',
        category: 'Mock Test',
        defaultTotalMarks: 100,
        notes: 'Full syllabus 100-mark simulation. Strong improvement in Mathematics!',
        createdAt: base + 1000 * 60 * 60 * 24 * 80,
        updatedAt: base + 1000 * 60 * 60 * 24 * 80,
        isSample: true,
        subjects: [
          { id: 's4_math', name: 'Mathematics', scoredMarks: 86, totalMarks: 100, notes: 'Much faster problem solving' },
          { id: 's4_phys', name: 'Physics', scoredMarks: 88, totalMarks: 100 },
          { id: 's4_chem', name: 'Chemistry', scoredMarks: 81, totalMarks: 100 },
          { id: 's4_cs', name: 'Computer Science', scoredMarks: 95, totalMarks: 100 },
          { id: 's4_eng', name: 'English', scoredMarks: 84, totalMarks: 100 },
          { id: 's4_lab', name: 'Physics Lab', scoredMarks: 28, totalMarks: 30 },
        ],
      },
    ];
  }

  return {
    DEFAULT_GRADE_SCALE: DEFAULT_GRADE_SCALE,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    EXAM_CATEGORIES: EXAM_CATEGORIES,
    QUICK_TOTAL_MARKS: QUICK_TOTAL_MARKS,
    createId: createId,
    generateVaultKey: generateVaultKey,
    calcPercentage: calcPercentage,
    formatPct: formatPct,
    formatMarks: formatMarks,
    getGradeForPercentage: getGradeForPercentage,
    canonicalSubjectKey: canonicalSubjectKey,
    computeStdDev: computeStdDev,
    computeLinearRegression: computeLinearRegression,
    sortExamsChronologically: sortExamsChronologically,
    analyzeMarks: analyzeMarks,
    predictRequiredScore: predictRequiredScore,
    exportExamsToCSV: exportExamsToCSV,
    sanitizeImportedExams: sanitizeImportedExams,
    buildSampleExams: buildSampleExams,
  };
});

