import { describe, expect, it } from 'vitest';
import {
  analyzeMarks,
  calcPercentage,
  exportExamsToCSV,
  predictRequiredScore,
  sanitizeImportedExams,
} from './analytics';
import { DEFAULT_SETTINGS } from './defaults';
import type { Exam } from '../types/marks';

describe('analytics engine', () => {
  it('handles zero or invalid total marks safely', () => {
    expect(calcPercentage(50, 0)).toBe(0);
    expect(calcPercentage(40, -10)).toBe(0);
    expect(calcPercentage(45, 50)).toBe(90);
  });

  it('analyzes exams with varying total marks and canonicalizes subject names', () => {
    const exams: Exam[] = [
      {
        id: 'e2',
        name: 'Mid Term',
        date: '2026-09-10',
        category: 'Mid-Term',
        defaultTotalMarks: 100,
        createdAt: 200,
        updatedAt: 200,
        subjects: [
          { id: 's3', name: 'Math', scoredMarks: 85, totalMarks: 100 },
          { id: 's4', name: 'Physics Lab', scoredMarks: 27, totalMarks: 30 },
        ],
      },
      {
        id: 'e1',
        name: 'Unit Test 1',
        date: '2026-08-01',
        category: 'Unit Test',
        defaultTotalMarks: 50,
        createdAt: 100,
        updatedAt: 100,
        subjects: [
          { id: 's1', name: ' math  ', scoredMarks: 35, totalMarks: 50 },
          { id: 's2', name: 'Physics Lab', scoredMarks: 16, totalMarks: 20 },
        ],
      },
    ];

    const res = analyzeMarks(exams, DEFAULT_SETTINGS);

    expect(res.examCount).toBe(2);
    // Sorted chronologically: e1 first, e2 second
    expect(res.examSummaries[0].exam.id).toBe('e1');
    expect(res.examSummaries[1].exam.id).toBe('e2');

    // e1: (35+16)/(50+20) = 51/70 = 72.857%
    expect(res.examSummaries[0].totalScored).toBe(51);
    expect(res.examSummaries[0].totalMax).toBe(70);
    expect(res.examSummaries[0].percentage).toBeCloseTo(72.857, 2);
    expect(res.examSummaries[0].deltaFromPrevious).toBeNull();

    // e2: (85+27)/(100+30) = 112/130 = 86.154%
    expect(res.examSummaries[1].totalScored).toBe(112);
    expect(res.examSummaries[1].totalMax).toBe(130);
    expect(res.examSummaries[1].percentage).toBeCloseTo(86.154, 2);
    expect(res.examSummaries[1].deltaFromPrevious).toBeCloseTo(13.297, 2);

    // Grand total: 163 / 200 = 81.5%
    expect(res.totalScored).toBe(163);
    expect(res.totalMax).toBe(200);
    expect(res.weightedOverallPct).toBeCloseTo(81.5, 2);

    // Canonical subject grouping merged " math  " and "Math"
    expect(res.uniqueSubjectCount).toBe(2);
    const math = res.subjectStats.find((s) => s.key === 'math');
    expect(math).toBeDefined();
    expect(math?.appearances).toBe(2);
    expect(math?.totalScored).toBe(120);
    expect(math?.totalMax).toBe(150);
    expect(math?.weightedAveragePct).toBeCloseTo(80, 2);
  });

  it('predicts required scores accurately across all feasibility states', () => {
    // Achievable: currently 160/200 (80%), upcoming 100, target 83% -> need 0.83*300 - 160 = 89/100
    const achievable = predictRequiredScore({
      currentScored: 160,
      currentMax: 200,
      upcomingMax: 100,
      targetPct: 83,
    });
    expect(achievable.status).toBe('achievable');
    expect(achievable.requiredMarks).toBeCloseTo(89, 2);
    expect(achievable.requiredPct).toBeCloseTo(89, 2);

    // Stretch: target 85% -> need 0.85*300 - 160 = 95/100
    const stretch = predictRequiredScore({
      currentScored: 160,
      currentMax: 200,
      upcomingMax: 100,
      targetPct: 85,
    });
    expect(stretch.status).toBe('stretch');
    expect(stretch.requiredMarks).toBeCloseTo(95, 2);

    // Already met: currently 180/200 (90%), upcoming 50, target 70% -> 0.7*250 = 175 <= 180
    const met = predictRequiredScore({
      currentScored: 180,
      currentMax: 200,
      upcomingMax: 50,
      targetPct: 70,
    });
    expect(met.status).toBe('already-met');
    expect(met.requiredMarks).toBe(0);

    // Impossible in 1 exam: currently 120/200 (60%), upcoming 100, target 85% -> need 135/100
    const multi = predictRequiredScore({
      currentScored: 120,
      currentMax: 200,
      upcomingMax: 100,
      targetPct: 85,
      assumedPacePct: 95,
    });
    expect(multi.status).toBe('impossible-single');
    expect(multi.examsNeededAtAssumedPace).toBe(5);
  });

  it('exports CSV and sanitizes imported JSON cleanly', () => {
    const imported = sanitizeImportedExams([
      {
        name: 'Final Exam',
        date: '2026-11-01',
        subjects: [
          { name: 'Chemistry, Organic', scoredMarks: 44, totalMarks: 50 },
        ],
      },
    ]);

    expect(imported).toHaveLength(1);
    const csv = exportExamsToCSV(imported);
    expect(csv).toContain('"Chemistry, Organic"');
    expect(csv).toContain('88.00%');
  });
});

